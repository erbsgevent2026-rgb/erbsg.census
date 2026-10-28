import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { getDb, ensureCurrentFinancialYear, getMaintenanceMode, queryOne, saveDatabase } from "./server/db.ts";
import { apiRouter } from "./server/routes.ts";

process.env.DISABLE_HMR = "true";

// Global error handlers to prevent unexpected process exits and restart loops in production
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception thrown:", error);
});

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  
  // Use Hostinger-provided PORT environment variable; fallback to 3000 for local development
  const PORT = Number(process.env.PORT) || 3000;

  // Security hardening: Disable fingerprinting and enforce standard security headers
  app.disable("x-powered-by");

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  // Support up to 25MB JSON payload for document PDFs and logo images
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Validate production security configuration
  if (process.env.NODE_ENV === "production") {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === "erbsg_production_jwt_secret_key_railway_scouts_guides") {
      console.warn("[SECURITY AUDIT] WARNING: Using default or weak JWT_SECRET in production. Set a random 64-character secret in Hostinger environment variables.");
    }
  }

  let dbInitError: string | null = null;

  // Initialize SQLite database
  try {
    await getDb();
    console.log("[DATABASE CONNECTED] ERBSG Persistent Database loaded and connected successfully.");

    // Automatic Financial Year check (runs hourly to detect April 1 transition)
    setInterval(() => {
      try {
        ensureCurrentFinancialYear();
      } catch (e) {
        console.error("Auto FY check error:", e);
      }
    }, 60 * 60 * 1000);
  } catch (err: any) {
    dbInitError = err?.message || String(err);
    console.error("[CRITICAL DATABASE INIT ERROR] Failed to initialize ERBSG Database on startup:", dbInitError);
  }

  // Truthful and robust Health Check endpoint (accessible without authentication)
  app.get(["/api/health", "/health"], async (req, res) => {
    let dbStatus = "connected";
    let dbError: string | null = dbInitError;
    try {
      const db = await getDb();
      if (!db) {
        dbStatus = "degraded";
      } else {
        queryOne("SELECT 1");
      }
    } catch (err: any) {
      dbStatus = "error";
      dbError = err?.message || "Database not initialized";
    }

    const maint = getMaintenanceMode();
    const isHealthy = dbStatus === "connected" && !dbError;

    // Standardized health check schema per specification
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? "healthy" : "unhealthy",
      database: dbStatus,
      error: dbError,
      app: "ERBSG Data Control Portal",
      organization: "Eastern Railway Bharat Scouts and Guides",
      state: "Eastern Railway",
      maintenanceMode: maint?.enabled || false,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    });
  });

  // Mount primary API router
  app.use("/api", apiRouter);

  // Return clean JSON 404 for any unmatched /api route rather than falling through to Vite SPA html
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.path} not found` });
  });

  // Vite middleware setup in development; static production assets in production
  if (process.env.NODE_ENV !== "production") {
    if (process.env.APPLET_ID || process.env.GOOGLE_RUNTIME) {
      if (process.env.DISABLE_HMR === undefined) {
        process.env.DISABLE_HMR = "true";
      }
    }
    const isHmrDisabled = process.env.DISABLE_HMR === "true";
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled
          ? false
          : {
              server: httpServer,
              port: PORT,
              clientPort: PORT,
            },
        ws: isHmrDisabled ? false : undefined,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: locate built Vite dist assets reliably
    const currentDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
    const possibleDistPaths = [
      path.join(process.cwd(), "dist"),
      path.join(currentDir, "../dist"),
      path.join(currentDir, "dist"),
      currentDir,
    ];
    let distPath = path.join(process.cwd(), "dist");
    for (const candidate of possibleDistPaths) {
      if (fs.existsSync(path.join(candidate, "index.html"))) {
        distPath = candidate;
        break;
      }
    }

    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Graceful shutdown handling for SIGTERM and SIGINT
  const gracefulShutdown = (signal: string) => {
    console.log(`[SHUTDOWN] Received ${signal}. Flushing pending database transactions to disk...`);
    try {
      saveDatabase();
      console.log("[SHUTDOWN] Database safely saved to disk.");
    } catch (saveErr) {
      console.error("[SHUTDOWN] Warning: Error saving database on shutdown:", saveErr);
    }

    httpServer.close(() => {
      console.log("[SHUTDOWN] HTTP server closed gracefully.");
      process.exit(0);
    });

    // Enforce shutdown if connections do not close within 10 seconds
    setTimeout(() => {
      console.error("[SHUTDOWN] Forcefully shutting down after timeout.");
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Ensure server listens on 0.0.0.0 and process.env.PORT
  httpServer.listen(PORT, "0.0.0.0", () => {
    if (dbInitError) {
      console.warn(`[SERVER IN DEGRADED MODE] HTTP listening at http://0.0.0.0:${PORT}, but database is unavailable. API and login requests will return HTTP 503 until DATABASE_PATH is initialized.`);
    } else {
      console.log(`ERBSG Portal Server running at http://0.0.0.0:${PORT} (env: ${process.env.NODE_ENV || "development"})`);
    }
  });
}

startServer();
