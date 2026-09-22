import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { getDb, ensureCurrentFinancialYear } from "./server/db.js";
import { apiRouter } from "./server/routes.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support up to 25MB JSON payload for document PDFs and logo images
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Initialize SQLite database
  try {
    await getDb();
    console.log("ERBSG Database connected and seeded.");

    // Automatic Financial Year check (runs hourly to detect April 1 transition)
    setInterval(() => {
      try {
        ensureCurrentFinancialYear();
      } catch (e) {
        console.error("Auto FY check error:", e);
      }
    }, 60 * 60 * 1000);
  } catch (err) {
    console.error("Failed to initialize ERBSG Database:", err);
  }

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      app: "ERBSG Data Control Portal",
      state: "Eastern Railway",
      timestamp: new Date().toISOString()
    });
  });

  // Mount primary API router
  app.use("/api", apiRouter);

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ERBSG Portal Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
