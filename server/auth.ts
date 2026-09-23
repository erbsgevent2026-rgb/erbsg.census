import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { queryOne, runQuery } from "./db.js";
import { mirrorAuditLogToFirestore } from "./firestoreService.js";

export const JWT_SECRET = process.env.JWT_SECRET || "erbsg_production_jwt_secret_key_railway_scouts_guides";

export function generatePasswordResetToken(userId: string, bsgId: string): string {
  return jwt.sign(
    {
      id: userId,
      bsg_id: bsgId,
      type: "password_reset"
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}

export function verifyPasswordResetToken(token: string): { id: string; bsg_id: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded && decoded.type === "password_reset" && decoded.id) {
      return { id: decoded.id, bsg_id: decoded.bsg_id };
    }
    return null;
  } catch {
    return null;
  }
}

export interface AuthenticatedUser {
  id: string;
  bsg_id: string;
  email: string;
  name: string;
  role: "STATE_ADMIN" | "DISTRICT_USER";
  state_id: string;
  district_id: string | null;
  must_change_password: boolean;
  mfa_enabled?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function generateToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      id: user.id,
      bsg_id: user.bsg_id,
      email: user.email,
      name: user.name,
      role: user.role,
      state_id: user.state_id,
      district_id: user.district_id,
      must_change_password: user.must_change_password,
      mfa_enabled: !!user.mfa_enabled,
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Access denied: Missing authentication token" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    // Always refresh latest user status from database to enforce active/deactivated state and password change status
    const freshUser = queryOne<any>("SELECT id, bsg_id, email, name, role, state_id, district_id, status, must_change_password, mfa_enabled FROM users WHERE id = ?", [decoded.id]);
    
    if (!freshUser) {
      res.status(401).json({ error: "User account no longer exists" });
      return;
    }

    if (freshUser.status !== "ACTIVE") {
      res.status(403).json({ error: `Account is ${freshUser.status.toLowerCase()}. Please contact the State Administrator.` });
      return;
    }

    req.user = {
      id: freshUser.id,
      bsg_id: freshUser.bsg_id,
      email: freshUser.email,
      name: freshUser.name,
      role: freshUser.role,
      state_id: freshUser.state_id,
      district_id: freshUser.district_id,
      must_change_password: Boolean(freshUser.must_change_password),
      mfa_enabled: Boolean(freshUser.mfa_enabled),
    };

    // If user must change password, restrict access only to password change routes or logout
    if (req.user.must_change_password && !req.path.includes("/change-password") && !req.path.includes("/auth/me") && !req.path.includes("/auth/logout")) {
      res.status(428).json({ 
        error: "Password change required before accessing the portal",
        must_change_password: true 
      });
      return;
    }

    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired session token. Please log in again." });
  }
}

export function requireStateAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "STATE_ADMIN") {
    res.status(403).json({ error: "Unauthorized: State Administrator access required" });
    return;
  }
  next();
}

/**
 * Strict district isolation checker:
 * - STATE_ADMIN can access any district within Eastern Railway (state_er)
 * - DISTRICT_USER can ONLY access their explicitly assigned district_id
 * Returns true if permitted, or sends 403 and returns false.
 */
export function enforceDistrictAccess(req: Request, res: Response, targetDistrictId: string | null | undefined): boolean {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }

  // State Admin is authorized for all districts in their state
  if (req.user.role === "STATE_ADMIN") {
    return true;
  }

  // District user must match the target district
  if (req.user.role === "DISTRICT_USER") {
    if (!targetDistrictId || req.user.district_id !== targetDistrictId) {
      // Record security alert in audit log
      logAuditAction({
        userId: req.user.id,
        userName: req.user.name,
        bsgId: req.user.bsg_id,
        role: req.user.role,
        action: "SECURITY_VIOLATION_ATTEMPT",
        module: "DISTRICT_ISOLATION",
        stateId: req.user.state_id,
        districtId: req.user.district_id || undefined,
        details: `District User ${req.user.bsg_id} attempted unauthorized access to District ID: ${targetDistrictId}`,
        ipAddress: req.ip
      });

      res.status(403).json({
        error: "Access Denied: District-level data isolation violation. You cannot access records outside your assigned district."
      });
      return false;
    }
    return true;
  }

  res.status(403).json({ error: "Forbidden" });
  return false;
}

export function logAuditAction(params: {
  userId?: string;
  userName?: string;
  bsgId?: string;
  role?: string;
  action: string;
  module: string;
  stateId?: string;
  districtId?: string;
  districtName?: string;
  targetEntity?: string;
  targetId?: string;
  details: string;
  ipAddress?: string;
}): void {
  try {
    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();
    runQuery(
      `INSERT INTO audit_logs (id, user_id, user_name, bsg_id, role, action, module, state_id, district_id, district_name, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.userId || null,
        params.userName || null,
        params.bsgId || null,
        params.role || null,
        params.action,
        params.module,
        params.stateId || "state_er",
        params.districtId || null,
        params.districtName || null,
        params.details,
        params.ipAddress || null
      ]
    );

    // Intercept and mirror to Firestore audit_logs collection with full metadata
    mirrorAuditLogToFirestore({
      id,
      userId: params.userId ?? null,
      userName: params.userName ?? null,
      bsgId: params.bsgId ?? null,
      role: params.role ?? null,
      action: params.action,
      module: params.module,
      stateId: params.stateId || "state_er",
      districtId: params.districtId ?? null,
      districtName: params.districtName ?? null,
      targetEntity: params.targetEntity || params.module,
      targetId: params.targetId ?? null,
      details: params.details,
      ipAddress: params.ipAddress ?? null,
      timestamp
    }).catch((err) => console.warn("Background firestore audit sync notice:", err));
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

export function sendPortalEmail(params: {
  to: string;
  name?: string;
  bsgId?: string;
  subject: string;
  body: string;
  type: string;
  sensitive?: boolean;
}): void {
  try {
    const id = `email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const storedBody = (params.sensitive || params.type === "ADMIN_TEMP_PASSWORD")
      ? "[SECURE TEMPORARY CREDENTIALS DISPATCHED TO OFFICIAL RECIPIENT - REDACTED FOR PRIVACY & SECURITY]"
      : params.body;

    runQuery(
      `INSERT INTO email_logs (id, recipient_email, recipient_name, bsg_id, subject, body, type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, params.to, params.name || "", params.bsgId || "", params.subject, storedBody, params.type, "SENT"]
    );
    console.log(`[EMAIL DISPATCHED] To: ${params.to} | Subject: ${params.subject} | Type: ${params.type}`);
  } catch (err) {
    console.error("Failed to record email log:", err);
  }
}
