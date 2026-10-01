import initSqlJs from "sql.js";
import type { Database as SqlJsDatabase } from "sql.js";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

export function getDatabasePath(): string {
  if (process.env.DATABASE_PATH && process.env.DATABASE_PATH.trim()) {
    return path.resolve(process.env.DATABASE_PATH.trim());
  }
  return path.resolve(process.cwd(), "data", "erbsg.sqlite");
}

let dbInstance: SqlJsDatabase | null = null;

// Ensure database directory exists
function ensureDbDirectory(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Automatic rolling pre-startup backup before any startup logic
function createPreStartupBackup(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) return;
    const stats = fs.statSync(filePath);
    if (stats.size === 0) return;

    // Use dedicated DATABASE_BACKUP_DIR if configured, otherwise default to <database_dir>/backups
    const backupDir = process.env.DATABASE_BACKUP_DIR && process.env.DATABASE_BACKUP_DIR.trim()
      ? path.resolve(process.env.DATABASE_BACKUP_DIR.trim())
      : path.join(path.dirname(filePath), "backups");

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = Date.now();
    const backupPath = path.join(backupDir, `erbsg_autobackup_${timestamp}.sqlite`);
    fs.copyFileSync(filePath, backupPath);
    console.log(`[DATABASE SAFETY] Pre-startup backup snapshot created at: ${backupPath} (${(stats.size / 1024).toFixed(1)} KB)`);

    // Clean up older auto backups, keep the 5 most recent
    const files = fs.readdirSync(backupDir)
      .filter((f) => f.startsWith("erbsg_autobackup_") && f.endsWith(".sqlite"))
      .map((f) => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 5) {
      for (const oldFile of files.slice(5)) {
        try {
          fs.unlinkSync(path.join(backupDir, oldFile.name));
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn("[DATABASE SAFETY] Warning: Could not create pre-startup backup:", err);
  }
}

export function saveDatabase(): void {
  if (!dbInstance) return;
  const targetPath = getDatabasePath();
  try {
    ensureDbDirectory(targetPath);
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    
    // Write atomically via temporary file to prevent corruption on unexpected crash or reboot
    const tempPath = `${targetPath}.tmp_${Date.now()}`;
    fs.writeFileSync(tempPath, buffer);
    fs.renameSync(tempPath, targetPath);
  } catch (err) {
    console.error(`[DATABASE ERROR] Failed to save SQLite database to "${targetPath}":`, err);
  }
}

export async function getDb(): Promise<SqlJsDatabase> {
  if (dbInstance) return dbInstance;

  const targetPath = getDatabasePath();
  ensureDbDirectory(targetPath);
  const fileExists = fs.existsSync(targetPath);

  // Requirement 15: Startup validation that logs resolved path and confirms existence
  console.log(`[DATABASE PERSISTENCE AUDIT] Resolved DATABASE_PATH: "${targetPath}"`);
  console.log(
    `[DATABASE PERSISTENCE AUDIT] Persistent database confirmed on disk: ${
      fileExists ? "YES (" + (fs.statSync(targetPath).size / 1024).toFixed(1) + " KB)" : "NO"
    }`
  );

  // Strict Safety Enforcement:
  // If the database file does not exist, FAIL SAFELY unless ALLOW_DATABASE_CREATION === "true".
  if (!fileExists) {
    if (process.env.ALLOW_DATABASE_CREATION !== "true") {
      const errorMsg = `[CRITICAL DATABASE SAFETY ERROR] Database file not found at: "${targetPath}". ALLOW_DATABASE_CREATION is "${process.env.ALLOW_DATABASE_CREATION || 'false'}". Startup aborted to prevent creating a blank database and losing existing data. If this is an intentional fresh setup, explicitly set ALLOW_DATABASE_CREATION=true.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  // Create an automated safety backup snapshot of existing file before any operations
  if (fileExists) {
    createPreStartupBackup(targetPath);
  }

  const SQL = await initSqlJs();

  if (fileExists) {
    try {
      console.log(`[DATABASE PERSISTENCE AUDIT] Opening verified persistent database from: "${targetPath}"`);
      const fileBuffer = fs.readFileSync(targetPath);
      dbInstance = new SQL.Database(fileBuffer);
      console.log(`[DATABASE PERSISTENCE] Loaded existing ERBSG SQLite database from disk: ${targetPath}`);
    } catch (e: any) {
      // Requirement 18:
      // If the database cannot be opened, the application FAILS SAFELY instead of silently creating a new empty production database!
      const errorMsg = `[CRITICAL DATABASE ERROR] Failed to load existing database file at "${targetPath}": ${e?.message || e}. Startup aborted to prevent data loss.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  } else {
    // Only reachable when ALLOW_DATABASE_CREATION === "true"
    dbInstance = new SQL.Database();
    console.warn(`[DATABASE PERSISTENCE WARNING] Initialized new empty SQLite database at: ${targetPath} (ALLOW_DATABASE_CREATION=true)`);
  }

  // Run non-destructive schema migrations only
  initSchemaAndSeed(dbInstance);

  // Ensure Session 2025-2026 and 2026-2027 exist for all 9 districts, preserving all historical data
  ensureSessionYear(2025, 2026, false, "ACTIVE");
  ensureSessionYear(2026, 2027, true, "ACTIVE");

  // Ensure state admin password and official email are synchronized
  try {
    const adminHash = bcrypt.hashSync("Admin@ERBSG2026", 10);
    dbInstance.run(
      "UPDATE users SET password_hash = ?, email = 'erbsgevent2026@gmail.com' WHERE bsg_id = 'BSG-ER-STATE' OR role = 'STATE_ADMIN'",
      [adminHash]
    );
  } catch (syncErr) {
    console.warn("Could not sync admin credentials on startup:", syncErr);
  }

  saveDatabase();
  return dbInstance;
}

export function runQuery(sql: string, params: any[] = []): void {
  if (!dbInstance) throw new Error("Database not initialized");
  dbInstance.run(sql, params);
  saveDatabase();
}

export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  if (!dbInstance) throw new Error("Database not initialized");
  const stmt = dbInstance.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const rows = queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Automatic Financial Year (FY) cycle calculation (April 1 to March 31)
export function getCurrentFinancialYear(now = new Date()): { startYear: number; endYear: number; id: string; label: string } {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1 to 12 (Jan=1, Apr=4, Dec=12)
  const startYear = currentMonth >= 4 ? currentYear : currentYear - 1;
  const endYear = startYear + 1;
  return {
    startYear,
    endYear,
    id: `year_${startYear}_${endYear}`,
    label: `${startYear}-${endYear}`
  };
}

/**
 * Creates or ensures a session year is available for all 9 districts.
 * Non-destructive: Existing district data is 100% preserved and never overwritten.
 */
export function ensureSessionYear(
  startYear: number,
  endYear: number,
  isCurrent: boolean = false,
  status: string = "ACTIVE"
): { id: string; label: string; created: boolean; is_current: boolean } {
  if (!dbInstance) {
    return {
      id: `year_${startYear}_${endYear}`,
      label: `${startYear}-${endYear}`,
      created: false,
      is_current: isCurrent
    };
  }

  const id = `year_${startYear}_${endYear}`;
  const label = `${startYear}-${endYear}`;

  const existing = queryOne<any>(
    "SELECT id, label, is_current, status FROM academic_years WHERE id = ? OR label = ?",
    [id, label]
  );

  let created = false;

  if (!existing) {
    dbInstance.run(
      "INSERT INTO academic_years (id, label, is_current, status) VALUES (?, ?, ?, ?)",
      [id, label, isCurrent ? 1 : 0, status]
    );

    if (isCurrent) {
      dbInstance.run("UPDATE academic_years SET is_current = 0 WHERE id != ?", [id]);
    }

    // Create official deadline for this session
    const deadlineId = `dl_${startYear}_${endYear}`;
    const deadlineDate = `${startYear}-07-31`;
    dbInstance.run(
      "INSERT OR IGNORE INTO deadlines (id, year_id, deadline_date, status, notes) VALUES (?, ?, ?, 'OPEN', ?)",
      [deadlineId, id, deadlineDate, `Official annual census and statutory returns deadline for Session ${label}`]
    );

    // Initialize base baseline entries for all 9 districts so historical/new views immediately function
    const districts = queryAll<any>("SELECT id FROM districts WHERE status = 'ACTIVE'");
    for (const d of districts) {
      // 1. Member Counts (0 baseline)
      const checkMc = queryOne("SELECT id FROM member_counts WHERE district_id = ? AND year_id = ?", [d.id, id]);
      if (!checkMc) {
        const mcId = `mc_${d.id}_${startYear}_${endYear}`;
        dbInstance.run(
          `INSERT INTO member_counts (
            id, state_id, district_id, year_id,
            bunnies, bunny_aunties, bulbul, guide, ranger, scout, rover, cub,
            flock_leaders, guide_captains, ranger_leaders, cub_masters, lady_cub_masters,
            scout_masters, rover_scout_leaders,
            professional_guides, voluntary_commissioners, support_staff, professionals_staff,
            youth_total, unit_leaders_total, professionals_total, grand_total,
            updated_by
          ) VALUES (?, 'state_er', ?, ?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'System Session Initialization')`,
          [mcId, d.id, id]
        );
      }

      // 2. Unit Details (0 baseline)
      const checkUd = queryOne("SELECT id FROM unit_details WHERE district_id = ? AND year_id = ?", [d.id, id]);
      if (!checkUd) {
        const udId = `ud_${d.id}_${startYear}_${endYear}`;
        dbInstance.run(
          `INSERT INTO unit_details (
            id, state_id, district_id, year_id,
            bulbul_flock, guide_company, ranger_team, cub_pack, scout_troop, rover_crew,
            updated_by
          ) VALUES (?, 'state_er', ?, ?, 0, 0, 0, 0, 0, 0, 'System Session Initialization')`,
          [udId, d.id, id]
        );
      }
    }

    created = true;
    saveDatabase();
    return { id, label, created: true, is_current: isCurrent };
  }

  // If already exists, preserve data! Check if current needs marking only if requested
  if (isCurrent && !existing.is_current) {
    dbInstance.run("UPDATE academic_years SET is_current = 0 WHERE id != ?", [existing.id]);
    dbInstance.run("UPDATE academic_years SET is_current = 1 WHERE id = ?", [existing.id]);
    saveDatabase();
  }

  return {
    id: existing.id,
    label: existing.label,
    created: false,
    is_current: isCurrent ? true : Boolean(existing.is_current)
  };
}

export function ensureCurrentFinancialYear(targetDate = new Date()): { id: string; label: string; created: boolean } {
  if (!dbInstance) return { id: "year_2026_2027", label: "2026-2027", created: false };
  const fy = getCurrentFinancialYear(targetDate);
  const existing = queryOne<any>("SELECT id, is_current FROM academic_years WHERE id = ?", [fy.id]);

  if (!existing) {
    const res = ensureSessionYear(fy.startYear, fy.endYear, false, "ACTIVE");
    return { id: res.id, label: res.label, created: res.created };
  }

  // Ensure at least one session is marked as current
  const anyCurrent = queryOne<any>("SELECT id FROM academic_years WHERE is_current = 1");
  if (!anyCurrent) {
    dbInstance.run("UPDATE academic_years SET is_current = 1 WHERE id = ?", [fy.id]);
    saveDatabase();
  }

  return { id: fy.id, label: fy.label, created: false };
}

export function setCurrentSessionYear(yearId: string): { success: boolean; label?: string; id?: string } {
  if (!dbInstance) return { success: false };
  const yr = queryOne<any>("SELECT id, label FROM academic_years WHERE id = ?", [yearId]);
  if (!yr) return { success: false };

  dbInstance.run("UPDATE academic_years SET is_current = 0");
  dbInstance.run("UPDATE academic_years SET is_current = 1 WHERE id = ?", [yearId]);
  saveDatabase();

  return { success: true, label: yr.label, id: yr.id };
}

export function getSessionSummary(): any[] {
  if (!dbInstance) return [];
  const years = queryAll<any>("SELECT * FROM academic_years ORDER BY label DESC");
  const districts = queryAll<any>("SELECT id, name FROM districts WHERE status = 'ACTIVE'");
  const totalDistricts = districts.length;

  return years.map((y) => {
    // Total members across all districts for this year
    const memberSum = queryOne<any>(
      "SELECT COALESCE(SUM(grand_total), 0) as total_members, COALESCE(SUM(youth_total), 0) as youth, COALESCE(SUM(unit_leaders_total), 0) as leaders, COALESCE(SUM(professionals_total), 0) as staff FROM member_counts WHERE year_id = ?",
      [y.id]
    );

    // Total units across all districts for this year
    const unitSum = queryOne<any>(
      `SELECT
        COALESCE(SUM(bulbul_flock + guide_company + ranger_team + cub_pack + scout_troop + rover_crew), 0) as total_units
      FROM unit_details WHERE year_id = ?`,
      [y.id]
    );

    // Number of districts with confirmed census
    const confirmedCount = queryOne<any>(
      "SELECT COUNT(*) as count FROM census_confirmations WHERE year_id = ? AND is_confirmed = 1",
      [y.id]
    );

    // Compliance documents uploaded for this year
    const arCount = queryOne<any>("SELECT COUNT(DISTINCT district_id) as count FROM annual_reports WHERE year_id = ?", [y.id]);
    const crCount = queryOne<any>("SELECT COUNT(DISTINCT district_id) as count FROM census_reports WHERE year_id = ?", [y.id]);
    const asCount = queryOne<any>("SELECT COUNT(DISTINCT district_id) as count FROM audited_statements WHERE year_id = ?", [y.id]);
    const deadline = queryOne<any>("SELECT deadline_date, status FROM deadlines WHERE year_id = ?", [y.id]);

    return {
      id: y.id,
      label: y.label,
      is_current: Boolean(y.is_current),
      status: y.status || "ACTIVE",
      total_districts: totalDistricts,
      total_members: memberSum?.total_members || 0,
      youth_members: memberSum?.youth || 0,
      unit_leaders: memberSum?.leaders || 0,
      professionals_staff: memberSum?.staff || 0,
      total_units: unitSum?.total_units || 0,
      confirmed_districts: confirmedCount?.count || 0,
      annual_reports_count: arCount?.count || 0,
      census_reports_count: crCount?.count || 0,
      audited_statements_count: asCount?.count || 0,
      deadline_date: deadline?.deadline_date || null,
      deadline_status: deadline?.status || "OPEN"
    };
  });
}

// -------------------------------------------------------------
// System Settings & Maintenance Mode Persistence
// -------------------------------------------------------------
export function getMaintenanceMode(): {
  enabled: boolean;
  message: string;
  updatedAt: string;
  updatedBy: string;
} {
  try {
    const row = queryOne<any>(
      "SELECT value, message, updated_at, updated_by FROM system_settings WHERE key = 'maintenance_mode'"
    );
    if (!row) {
      return {
        enabled: false,
        message: "ERBSG Data Control Portal is currently under maintenance. Please try again later.",
        updatedAt: new Date().toISOString(),
        updatedBy: "SYSTEM"
      };
    }
    return {
      enabled: row.value === "true" || row.value === "1",
      message: row.message || "ERBSG Data Control Portal is currently under maintenance. Please try again later.",
      updatedAt: row.updated_at || new Date().toISOString(),
      updatedBy: row.updated_by || "STATE_ADMIN"
    };
  } catch (_) {
    return {
      enabled: false,
      message: "ERBSG Data Control Portal is currently under maintenance. Please try again later.",
      updatedAt: new Date().toISOString(),
      updatedBy: "SYSTEM"
    };
  }
}

export function setMaintenanceMode(
  enabled: boolean,
  message?: string,
  updatedBy: string = "STATE_ADMIN"
): { enabled: boolean; message: string; updatedAt: string; updatedBy: string } {
  const msg =
    message && message.trim()
      ? message.trim()
      : "ERBSG Data Control Portal is currently under maintenance. Please try again later.";
  const val = enabled ? "true" : "false";

  const existing = queryOne<any>("SELECT key FROM system_settings WHERE key = 'maintenance_mode'");
  if (existing) {
    runQuery(
      "UPDATE system_settings SET value = ?, message = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE key = 'maintenance_mode'",
      [val, msg, updatedBy]
    );
  } else {
    runQuery(
      "INSERT INTO system_settings (key, value, message, updated_at, updated_by) VALUES ('maintenance_mode', ?, ?, CURRENT_TIMESTAMP, ?)",
      [val, msg, updatedBy]
    );
  }

  return getMaintenanceMode();
}

// -------------------------------------------------------------
// Annual Census Return Final Confirmation & Locking
// -------------------------------------------------------------
export function getCensusConfirmation(
  districtId: string,
  yearId: string
): {
  is_confirmed: boolean;
  confirmed_at: string | null;
  confirmed_by?: string | null;
  confirmed_by_name?: string | null;
  confirmed_by_bsg_id?: string | null;
} {
  try {
    const row = queryOne<any>(
      "SELECT is_confirmed, confirmed_at, confirmed_by, confirmed_by_name, confirmed_by_bsg_id FROM census_confirmations WHERE district_id = ? AND year_id = ?",
      [districtId, yearId]
    );
    if (!row) {
      return { is_confirmed: false, confirmed_at: null };
    }
    return {
      is_confirmed: Boolean(row.is_confirmed),
      confirmed_at: row.confirmed_at || null,
      confirmed_by: row.confirmed_by || null,
      confirmed_by_name: row.confirmed_by_name || null,
      confirmed_by_bsg_id: row.confirmed_by_bsg_id || null,
    };
  } catch (_) {
    return { is_confirmed: false, confirmed_at: null };
  }
}

export function setCensusConfirmation(
  districtId: string,
  yearId: string,
  confirmedBy: string,
  confirmedByName: string,
  confirmedByBsgId: string,
  ipAddress?: string
): {
  is_confirmed: boolean;
  confirmed_at: string;
  confirmed_by: string;
  confirmed_by_name: string;
  confirmed_by_bsg_id: string;
} {
  const existing = queryOne<any>(
    "SELECT id FROM census_confirmations WHERE district_id = ? AND year_id = ?",
    [districtId, yearId]
  );
  const nowIso = new Date().toISOString();

  if (existing) {
    runQuery(
      `UPDATE census_confirmations SET
        is_confirmed = 1,
        confirmed_at = CURRENT_TIMESTAMP,
        confirmed_by = ?,
        confirmed_by_name = ?,
        confirmed_by_bsg_id = ?,
        ip_address = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE district_id = ? AND year_id = ?`,
      [confirmedBy, confirmedByName, confirmedByBsgId, ipAddress || null, districtId, yearId]
    );
  } else {
    const id = `cc_${districtId}_${yearId}`;
    runQuery(
      `INSERT INTO census_confirmations (
        id, state_id, district_id, year_id,
        is_confirmed, confirmed_at, confirmed_by, confirmed_by_name, confirmed_by_bsg_id, ip_address, updated_at
      ) VALUES (?, 'state_er', ?, ?, 1, CURRENT_TIMESTAMP, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [id, districtId, yearId, confirmedBy, confirmedByName, confirmedByBsgId, ipAddress || null]
    );
  }

  return {
    is_confirmed: true,
    confirmed_at: nowIso,
    confirmed_by: confirmedBy,
    confirmed_by_name: confirmedByName,
    confirmed_by_bsg_id: confirmedByBsgId,
  };
}

export function unlockCensusConfirmation(districtId: string, yearId: string): void {
  runQuery(
    `UPDATE census_confirmations SET
      is_confirmed = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE district_id = ? AND year_id = ?`,
    [districtId, yearId]
  );
}

// -------------------------------------------------------------
// Support & Feedback System Persistence
// -------------------------------------------------------------
export function createSupportFeedback(ticket: {
  id?: string;
  district_id: string;
  district_name: string;
  user_id: string;
  user_name: string;
  bsg_id: string;
  user_email?: string | null;
  category: string;
  priority: string;
  subject: string;
  message: string;
}): any {
  const id = ticket.id || `sup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  runQuery(
    `INSERT INTO support_feedback (
      id, state_id, district_id, district_name, user_id, user_name, bsg_id, user_email,
      category, priority, subject, message, status, created_at, updated_at
    ) VALUES (?, 'state_er', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      id,
      ticket.district_id,
      ticket.district_name,
      ticket.user_id,
      ticket.user_name,
      ticket.bsg_id,
      ticket.user_email || null,
      ticket.category || "SUPPORT",
      ticket.priority || "NORMAL",
      ticket.subject,
      ticket.message
    ]
  );
  return getSupportFeedbackById(id);
}

export function getSupportFeedback(filters: {
  district_id?: string;
  status?: string;
  search?: string;
}): any[] {
  let sql = "SELECT * FROM support_feedback WHERE 1=1";
  const params: any[] = [];

  if (filters.district_id && filters.district_id !== "ALL") {
    sql += " AND district_id = ?";
    params.push(filters.district_id);
  }

  if (filters.status && filters.status !== "ALL") {
    sql += " AND status = ?";
    params.push(filters.status);
  }

  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`;
    sql += " AND (subject LIKE ? OR message LIKE ? OR user_name LIKE ? OR bsg_id LIKE ? OR district_name LIKE ?)";
    params.push(term, term, term, term, term);
  }

  sql += " ORDER BY created_at DESC";
  return queryAll<any>(sql, params);
}

export function getSupportFeedbackById(id: string): any | null {
  return queryOne<any>("SELECT * FROM support_feedback WHERE id = ?", [id]);
}

export function updateSupportFeedback(
  id: string,
  update: {
    status?: string;
    admin_reply?: string;
    admin_name?: string;
  }
): any | null {
  const existing = getSupportFeedbackById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const newStatus = update.status || existing.status;
  const adminReply = update.admin_reply !== undefined ? update.admin_reply : existing.admin_reply;
  const adminName = update.admin_name || existing.admin_replied_by || "State Admin";
  const resolvedAt = newStatus === "RESOLVED" ? (existing.resolved_at || now) : null;
  const adminRepliedAt = adminReply ? (existing.admin_replied_at || now) : existing.admin_replied_at;

  runQuery(
    `UPDATE support_feedback SET
      status = ?,
      admin_reply = ?,
      admin_replied_at = ?,
      admin_replied_by = ?,
      resolved_at = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
    [newStatus, adminReply, adminRepliedAt, adminName, resolvedAt, id]
  );

  return getSupportFeedbackById(id);
}

function initSchemaAndSeed(db: SqlJsDatabase) {
  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS states (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      bsg_id TEXT NOT NULL UNIQUE,
      email TEXT,
      phone TEXT,
      address TEXT,
      logo_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS districts (
      id TEXT PRIMARY KEY,
      state_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      bsg_id TEXT NOT NULL UNIQUE,
      email TEXT,
      phone TEXT,
      address TEXT,
      established_year INTEGER DEFAULT 1952,
      registration_no TEXT,
      status TEXT DEFAULT 'ACTIVE',
      logo_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS academic_years (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL UNIQUE,
      is_current INTEGER DEFAULT 0,
      status TEXT DEFAULT 'ACTIVE'
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      bsg_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('STATE_ADMIN', 'DISTRICT_USER')),
      state_id TEXT NOT NULL,
      district_id TEXT,
      status TEXT DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
      must_change_password INTEGER DEFAULT 0,
      password_changed_at DATETIME,
      last_login DATETIME,
      mfa_enabled INTEGER DEFAULT 0,
      mfa_secret TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS member_counts (
      id TEXT PRIMARY KEY,
      state_id TEXT NOT NULL,
      district_id TEXT NOT NULL,
      year_id TEXT NOT NULL,
      -- Youth Categories
      bunnies INTEGER DEFAULT 0,
      bunny_aunties INTEGER DEFAULT 0,
      bulbul INTEGER DEFAULT 0,
      guide INTEGER DEFAULT 0,
      ranger INTEGER DEFAULT 0,
      scout INTEGER DEFAULT 0,
      rover INTEGER DEFAULT 0,
      cub INTEGER DEFAULT 0,
      -- Leadership Categories (Unit Leaders)
      flock_leaders INTEGER DEFAULT 0,
      guide_captains INTEGER DEFAULT 0,
      ranger_leaders INTEGER DEFAULT 0,
      cub_masters INTEGER DEFAULT 0,
      lady_cub_masters INTEGER DEFAULT 0,
      scout_masters INTEGER DEFAULT 0,
      rover_scout_leaders INTEGER DEFAULT 0,
      -- Professional & Support
      professional_guides INTEGER DEFAULT 0,
      voluntary_commissioners INTEGER DEFAULT 0,
      support_staff INTEGER DEFAULT 0,
      professionals_staff INTEGER DEFAULT 0,
      -- Calculated totals
      youth_total INTEGER DEFAULT 0,
      unit_leaders_total INTEGER DEFAULT 0,
      professionals_total INTEGER DEFAULT 0,
      grand_total INTEGER DEFAULT 0,
      updated_by TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(district_id, year_id)
    );

    CREATE TABLE IF NOT EXISTS unit_details (
      id TEXT PRIMARY KEY,
      state_id TEXT NOT NULL DEFAULT 'state_er',
      district_id TEXT NOT NULL,
      year_id TEXT NOT NULL,
      bulbul_flock INTEGER DEFAULT 0,
      guide_company INTEGER DEFAULT 0,
      ranger_team INTEGER DEFAULT 0,
      cub_pack INTEGER DEFAULT 0,
      scout_troop INTEGER DEFAULT 0,
      rover_crew INTEGER DEFAULT 0,
      updated_by TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(district_id, year_id)
    );

    CREATE TABLE IF NOT EXISTS state_members (
      id TEXT PRIMARY KEY,
      state_id TEXT NOT NULL,
      year_id TEXT NOT NULL,
      name TEXT NOT NULL,
      bsg_uid TEXT NOT NULL,
      designation TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS district_members (
      id TEXT PRIMARY KEY,
      state_id TEXT NOT NULL,
      district_id TEXT NOT NULL,
      year_id TEXT NOT NULL,
      name TEXT NOT NULL,
      bsg_uid TEXT NOT NULL,
      designation TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS annual_reports (
      id TEXT PRIMARY KEY,
      state_id TEXT NOT NULL,
      district_id TEXT NOT NULL,
      year_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_data TEXT, -- Base64 encoded or virtual storage URL
      version INTEGER DEFAULT 1,
      uploaded_by TEXT NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'APPROVED'
    );

    CREATE TABLE IF NOT EXISTS census_reports (
      id TEXT PRIMARY KEY,
      state_id TEXT NOT NULL,
      district_id TEXT NOT NULL,
      year_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_data TEXT,
      version INTEGER DEFAULT 1,
      uploaded_by TEXT NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'APPROVED'
    );

    CREATE TABLE IF NOT EXISTS audited_statements (
      id TEXT PRIMARY KEY,
      state_id TEXT NOT NULL,
      district_id TEXT NOT NULL,
      year_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_data TEXT,
      version INTEGER DEFAULT 1,
      uploaded_by TEXT NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'APPROVED'
    );

    CREATE TABLE IF NOT EXISTS official_contacts (
      id TEXT PRIMARY KEY,
      state_id TEXT NOT NULL,
      district_id TEXT NOT NULL,
      year_id TEXT NOT NULL,
      name TEXT NOT NULL,
      railway_designation TEXT,
      scouting_rank TEXT,
      bsg_id TEXT,
      designation TEXT,
      bsg_uid TEXT,
      email TEXT,
      phone TEXT,
      is_selected INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS deadlines (
      id TEXT PRIMARY KEY,
      year_id TEXT NOT NULL UNIQUE,
      deadline_date TEXT NOT NULL,
      status TEXT DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'UPCOMING', 'EXPIRED')),
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      bsg_id TEXT,
      role TEXT,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      state_id TEXT,
      district_id TEXT,
      district_name TEXT,
      details TEXT,
      ip_address TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      recipient_email TEXT NOT NULL,
      recipient_name TEXT,
      bsg_id TEXT,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'SENT',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      message TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS census_confirmations (
      id TEXT PRIMARY KEY,
      state_id TEXT NOT NULL DEFAULT 'state_er',
      district_id TEXT NOT NULL,
      year_id TEXT NOT NULL,
      is_confirmed INTEGER DEFAULT 0,
      confirmed_at DATETIME,
      confirmed_by TEXT,
      confirmed_by_name TEXT,
      confirmed_by_bsg_id TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(district_id, year_id)
    );

    CREATE TABLE IF NOT EXISTS support_feedback (
      id TEXT PRIMARY KEY,
      state_id TEXT NOT NULL DEFAULT 'state_er',
      district_id TEXT NOT NULL,
      district_name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      bsg_id TEXT NOT NULL,
      user_email TEXT,
      category TEXT NOT NULL DEFAULT 'SUPPORT',
      priority TEXT NOT NULL DEFAULT 'NORMAL',
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'NEW',
      admin_reply TEXT,
      admin_replied_at DATETIME,
      admin_replied_by TEXT,
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        message TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT
      )
    `);
    db.run(`
      INSERT OR IGNORE INTO system_settings (key, value, message, updated_at, updated_by)
      VALUES ('maintenance_mode', 'false', 'ERBSG Data Control Portal is currently under maintenance. Please try again later.', CURRENT_TIMESTAMP, 'SYSTEM')
    `);
  } catch (_) {}

  try {
    db.run("ALTER TABLE member_counts ADD COLUMN scout_masters INTEGER DEFAULT 0");
  } catch (_) {}
  try {
    db.run("ALTER TABLE member_counts ADD COLUMN rover_scout_leaders INTEGER DEFAULT 0");
  } catch (_) {}
  try {
    db.run("ALTER TABLE districts ADD COLUMN established_year INTEGER DEFAULT 1952");
  } catch (_) {}
  try {
    db.run("ALTER TABLE districts ADD COLUMN registration_no TEXT");
  } catch (_) {}
  try {
    db.run("UPDATE districts SET registration_no = bsg_id WHERE registration_no IS NULL OR registration_no = ''");
  } catch (_) {}
  try {
    db.run("UPDATE districts SET established_year = 1952 WHERE established_year IS NULL");
  } catch (_) {}
  try {
    // Zero out deprecated bunny aunties if non-zero and align totals
    db.run(`
      UPDATE member_counts SET
        bunnies = 0,
        bunny_aunties = 0,
        youth_total = bulbul + guide + ranger + scout + rover + cub,
        grand_total = (bulbul + guide + ranger + scout + rover + cub) + unit_leaders_total + professionals_total
      WHERE (bunnies IS NOT NULL AND bunnies != 0) OR (bunny_aunties IS NOT NULL AND bunny_aunties != 0)
    `);
  } catch (_) {}

  // --- Idempotent check & Migration: Liluah District (9th District) ---
  try {
    const checkLiluah = db.exec("SELECT id FROM districts WHERE id = 'dist_llh'");
    if (!checkLiluah[0]?.values?.length) {
      console.log("Seeding Liluah District into Eastern Railway state...");
      db.run(
        `INSERT INTO districts (id, state_id, name, code, bsg_id, email, phone, address, established_year, registration_no, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "dist_llh",
          "state_er",
          "Liluah District",
          "ER-LLH",
          "BSG918582829",
          "liluah@erbsg.org",
          "+91 98300 11009",
          "Divisional Carriage & Wagon Workshop, Liluah, Howrah - 711204",
          1952,
          "BSG918582829",
          "ACTIVE"
        ]
      );
    }
  } catch (err) {
    console.error("Error ensuring Liluah District exists:", err);
  }

  // Ensure Liluah District User exists
  try {
    const checkLiluahUser = db.exec("SELECT id FROM users WHERE id = 'usr_dist_llh' OR bsg_id = 'BSG918582829' OR bsg_id = 'BSG-ER-LLH'");
    if (!checkLiluahUser[0]?.values?.length) {
      const defaultDistrictPasswordHash = bcrypt.hashSync("Test@1234", 10);
      db.run(
        `INSERT INTO users (id, bsg_id, email, name, phone, password_hash, role, state_id, district_id, status, must_change_password)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "usr_dist_llh",
          "BSG918582829",
          "liluah@erbsg.org",
          "Liluah District User",
          "+91 98300 11009",
          defaultDistrictPasswordHash,
          "DISTRICT_USER",
          "state_er",
          "dist_llh",
          "ACTIVE",
          1
        ]
      );
    }
  } catch (err) {
    console.error("Error ensuring Liluah District user exists:", err);
  }

  // --- Migration: District name correction "Asansole District" -> "Asansol District" ---
  try {
    db.run("UPDATE districts SET name = 'Asansol District', email = 'asansol@erbsg.org' WHERE id = 'dist_asn' OR name LIKE '%Asansole%'");
    db.run("UPDATE users SET name = 'Asansol District User', email = 'asansol@erbsg.org' WHERE district_id = 'dist_asn' AND (name LIKE '%Asansole%' OR name = 'Asansole District User' OR name = 'Asansole User')");
    db.run("UPDATE audit_logs SET district_name = 'Asansol District' WHERE district_id = 'dist_asn' OR district_name LIKE '%Asansole%'");
  } catch (err) {
    console.error("Error updating Asansol district name:", err);
  }

  // --- Migration: Official BSG IDs for District Users and Districts ---
  const districtBsgMap: Record<string, string> = {
    dist_asn: "BSG287206516",
    dist_cen: "BSG414635725",
    dist_clw: "BSG497632275",
    dist_hwh: "BSG778778724",
    dist_jmp: "BSG283090263",
    dist_kpa: "BSG337400383",
    dist_llh: "BSG918582829",
    dist_mldt: "BSG896907989",
    dist_sdah: "BSG454137323"
  };

  try {
    for (const [distId, bsgId] of Object.entries(districtBsgMap)) {
      // Update users table login ID (preserves existing password_hash and must_change_password)
      db.run("UPDATE users SET bsg_id = ? WHERE district_id = ?", [bsgId, distId]);
      // Update districts table bsg_id and registration_no
      db.run("UPDATE districts SET bsg_id = ?, registration_no = ? WHERE id = ?", [bsgId, bsgId, distId]);
    }
  } catch (err) {
    console.error("Error mapping district user BSG IDs:", err);
  }

  // --- Migration: Ensure initial District Users have default password hash if missing ---
  try {
    const defaultDistrictPasswordHash = bcrypt.hashSync("Test@1234", 10);
    db.run(
      "UPDATE users SET password_hash = ? WHERE role = 'DISTRICT_USER' AND (password_hash IS NULL OR password_hash = '')",
      [defaultDistrictPasswordHash]
    );
  } catch (err) {
    console.error("Error ensuring default password hashes for district users:", err);
  }

  // --- Migration: Ensure official_contacts table has railway_designation, scouting_rank, bsg_id, position_order, position_name ---
  try {
    const tableInfo = db.exec("PRAGMA table_info(official_contacts)");
    const cols = tableInfo[0]?.values?.map((v: any) => v[1]) || [];
    if (!cols.includes("railway_designation")) {
      db.run("ALTER TABLE official_contacts ADD COLUMN railway_designation TEXT DEFAULT ''");
    }
    if (!cols.includes("scouting_rank")) {
      db.run("ALTER TABLE official_contacts ADD COLUMN scouting_rank TEXT DEFAULT ''");
    }
    if (!cols.includes("bsg_id")) {
      db.run("ALTER TABLE official_contacts ADD COLUMN bsg_id TEXT DEFAULT ''");
    }
    if (!cols.includes("position_order")) {
      db.run("ALTER TABLE official_contacts ADD COLUMN position_order INTEGER DEFAULT 0");
    }
    if (!cols.includes("position_name")) {
      db.run("ALTER TABLE official_contacts ADD COLUMN position_name TEXT DEFAULT ''");
    }

    // Populate scouting_rank from designation if empty
    db.run("UPDATE official_contacts SET scouting_rank = designation WHERE (scouting_rank IS NULL OR scouting_rank = '') AND designation IS NOT NULL AND designation != ''");

    // Populate bsg_id from bsg_uid if empty
    db.run("UPDATE official_contacts SET bsg_id = bsg_uid WHERE (bsg_id IS NULL OR bsg_id = '') AND bsg_uid IS NOT NULL AND bsg_uid != ''");

    // Map known designations to the 17 standard position names & orders
    db.run(`
      UPDATE official_contacts
      SET position_order = 3, position_name = 'District Secretary'
      WHERE (position_order = 0 OR position_order IS NULL) AND designation LIKE '%Secretary%' AND designation NOT LIKE '%Jt%' AND designation NOT LIKE '%Asstt%'
    `);
    db.run(`
      UPDATE official_contacts
      SET position_order = 4, position_name = 'District Commissioner (S)'
      WHERE (position_order = 0 OR position_order IS NULL) AND (designation LIKE '%Commissioner (Scout)%' OR designation LIKE '%Commissioner (S)%')
    `);
    db.run(`
      UPDATE official_contacts
      SET position_order = 5, position_name = 'District Commissioner (G)'
      WHERE (position_order = 0 OR position_order IS NULL) AND (designation LIKE '%Guide Commissioner%' OR designation LIKE '%Commissioner (G)%')
    `);
  } catch (err) {
    console.error("Error migrating official_contacts table columns:", err);
  }

  // --- Migration: Ensure 18 Official Positions for all 9 Districts ---
  try {
    const FIXED_18_POSITIONS = [
      "1. President",
      "2. District Chief Commissioner",
      "3. District Commissioners (S)",
      "4. District Commissioner (G)",
      "5. District Secretary",
      "6. Jt. District Secretary",
      "7. Asstt. District Secretary",
      "8. District Treasurer",
      "9. District Organising Commissioner (Scouts)",
      "10. District Organising Commissioner (Guides)",
      "11. District Training Commissioner (Scouts)",
      "12. District Training Commissioner (Guides)",
      "13. Chairman District Youth Committee",
      "14. Co-chairman District Youth Committee",
      "15. District Media Co-ordinator",
      "16. Nodal Officer of Aapdamitra",
      "17. Growth Coordinator",
      "18. District OYMS Co-ordinator"
    ];

    // Renames: update position names if previously stored under old names
    db.run(`UPDATE official_contacts SET position_name = '13. Chairman District Youth Committee' WHERE position_name LIKE '%Youth Committee Chairman%' OR position_name LIKE '%Chairman%Youth Committee%'`);
    db.run(`UPDATE official_contacts SET position_name = '14. Co-chairman District Youth Committee' WHERE position_name LIKE '%Co-chairman of Youth Committee%' OR position_name LIKE '%Co-chairman District Youth Committee%'`);

    const allDists = ["dist_asn", "dist_cen", "dist_clw", "dist_hwh", "dist_jmp", "dist_kpa", "dist_llh", "dist_mldt", "dist_sdah"];
    for (const distId of allDists) {
      const existingReps = db.exec(`SELECT position_order, position_name, name FROM official_contacts WHERE district_id = '${distId}' AND year_id = 'year_2026_2027'`);
      const existingRows = existingReps[0]?.values || [];
      const hasRows = existingRows.length > 0;

      if (!hasRows) {
        // Seed full initial set of 18 positions for this district
        FIXED_18_POSITIONS.forEach((posName, idx) => {
          const posOrder = idx + 1;
          const ocId = `oc_${distId}_year_2026_2027_pos_${posOrder}`;
          db.run(
            `INSERT INTO official_contacts (id, state_id, district_id, year_id, position_order, position_name, name, bsg_id, bsg_uid, designation, scouting_rank, email, phone, is_selected)
             VALUES (?, 'state_er', ?, 'year_2026_2027', ?, ?, '', '', '', ?, ?, '', '', 1)`,
            [ocId, distId, posOrder, posName, posName, posName]
          );
        });
      } else {
        // Ensure position 18 exists for this district
        const hasPos18 = existingRows.some((r: any) => r[0] === 18 || (r[1] && String(r[1]).includes("OYMS")));
        if (!hasPos18) {
          const ocId = `oc_${distId}_year_2026_2027_pos_18`;
          const posName = "18. District OYMS Co-ordinator";
          db.run(
            `INSERT INTO official_contacts (id, state_id, district_id, year_id, position_order, position_name, name, bsg_id, bsg_uid, designation, scouting_rank, email, phone, is_selected)
             VALUES (?, 'state_er', ?, 'year_2026_2027', 18, ?, '', '', '', ?, ?, '', '', 1)`,
            [ocId, distId, posName, posName, posName]
          );
        }
      }
    }
  } catch (err) {
    console.error("Error seeding initial 18 official positions:", err);
  }

  // --- Migration: Ensure census_reports table exists ---
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS census_reports (
        id TEXT PRIMARY KEY,
        state_id TEXT NOT NULL,
        district_id TEXT NOT NULL,
        year_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_data TEXT,
        version INTEGER DEFAULT 1,
        uploaded_by TEXT NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'APPROVED'
      );
    `);
  } catch (err) {
    console.error("Error creating census_reports table:", err);
  }

  // Ensure initial Unit Details records exist for all 9 districts with 0 by default
  try {
    const allDistIds = ["dist_asn", "dist_cen", "dist_clw", "dist_hwh", "dist_jmp", "dist_kpa", "dist_llh", "dist_mldt", "dist_sdah"];
    for (const distId of allDistIds) {
      const existingUd = db.exec(`SELECT id FROM unit_details WHERE district_id = '${distId}' AND year_id = 'year_2026_2027'`);
      if (!existingUd[0]?.values?.length) {
        db.run(
          `INSERT INTO unit_details (
            id, state_id, district_id, year_id,
            bulbul_flock, guide_company, ranger_team, cub_pack, scout_troop, rover_crew,
            updated_by
          ) VALUES (?, 'state_er', ?, 'year_2026_2027', 0, 0, 0, 0, 0, 0, 'Initial System Setup')`,
          [`ud_${distId}_year_2026_2027`, distId]
        );
      }
    }
  } catch (err) {
    console.error("Error seeding unit_details:", err);
  }

  // Idempotent check: Ensure current academic year exists
  const requiredYears = [
    { id: "year_2026_2027", label: "2026-2027", isCurrent: 1 },
  ];

  for (const y of requiredYears) {
    const check = db.exec(`SELECT count(*) FROM academic_years WHERE id = '${y.id}'`);
    const cnt = check[0]?.values[0]?.[0] || 0;
    if (Number(cnt) === 0) {
      db.run(`INSERT INTO academic_years (id, label, is_current, status) VALUES (?, ?, ?, ?)`, [y.id, y.label, y.isCurrent, "ACTIVE"]);
    }
  }

  // Ensure initial Member Counts entries exist for all 9 districts with 0 values
  try {
    const allDistIds = ["dist_asn", "dist_cen", "dist_clw", "dist_hwh", "dist_jmp", "dist_kpa", "dist_llh", "dist_mldt", "dist_sdah"];
    for (const distId of allDistIds) {
      const existingMc = db.exec(`SELECT id FROM member_counts WHERE district_id = '${distId}' AND year_id = 'year_2026_2027'`);
      if (!existingMc[0]?.values?.length) {
        db.run(
          `INSERT INTO member_counts (
            id, state_id, district_id, year_id,
            bunnies, bunny_aunties, bulbul, guide, ranger, scout, rover, cub,
            flock_leaders, guide_captains, ranger_leaders, cub_masters, lady_cub_masters,
            scout_masters, rover_scout_leaders,
            professional_guides, voluntary_commissioners, support_staff, professionals_staff,
            youth_total, unit_leaders_total, professionals_total, grand_total,
            updated_by
          ) VALUES (?, 'state_er', ?, 'year_2026_2027', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'Initial System Setup')`,
          [`mc_${distId}_year_2026_2027`, distId]
        );
      }
    }
  } catch (err) {
    console.error("Error ensuring initial member counts:", err);
  }

  const stateCheckResult = db.exec("SELECT count(*) FROM states");
  const stateCount = stateCheckResult[0]?.values[0]?.[0] || 0;

  if (Number(stateCount) === 0) {
    console.log("Seeding Eastern Railway State and 9 initial Districts...");
    db.run(
      `INSERT OR IGNORE INTO states (id, name, code, bsg_id, email, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "state_er",
        "Eastern Railway Bharat Scouts and Guides",
        "ER",
        "BSG-ER-HQ",
        "stateadmin@easternrailway.bsg.org",
        "+91 33 2222 4567",
        "Headquarters Office, 17 Netaji Subhas Road, Fairlie Place, Kolkata - 700001, West Bengal"
      ]
    );

    // Initial 9 districts sorted in proper alphabetical order:
    const initialDistricts = [
      { id: "dist_asn", name: "Asansol District", code: "ER-ASN", bsgId: "BSG287206516", email: "asansol@erbsg.org", phone: "+91 98300 11004", address: "DRM Office, Rail Nagar, Asansol - 713301" },
      { id: "dist_cen", name: "Central District", code: "ER-CEN", bsgId: "BSG414635725", email: "central@erbsg.org", phone: "+91 98300 11001", address: "Central Division HQ, Sealdah Station Complex, Kolkata - 700014" },
      { id: "dist_clw", name: "CLW District", code: "ER-CLW", bsgId: "BSG497632275", email: "clw@erbsg.org", phone: "+91 98300 11005", address: "Chittaranjan Locomotive Works Campus, Chittaranjan - 713331" },
      { id: "dist_hwh", name: "Howrah District", code: "ER-HWH", bsgId: "BSG778778724", email: "howrah@erbsg.org", phone: "+91 98300 11003", address: "DRM Building, Howrah Railway Station Yard, Howrah - 711101" },
      { id: "dist_jmp", name: "Jamalpur District", code: "ER-JMP", bsgId: "BSG283090263", email: "jamalpur@erbsg.org", phone: "+91 98300 11008", address: "Jamalpur Locomotive Workshop Area, Jamalpur, Munger, Bihar - 811214" },
      { id: "dist_kpa", name: "Kanchrapara District", code: "ER-KPA", bsgId: "BSG337400383", email: "kanchrapara@erbsg.org", phone: "+91 98300 11007", address: "Railway Workshop Grounds, Kanchrapara - 743145" },
      { id: "dist_llh", name: "Liluah District", code: "ER-LLH", bsgId: "BSG918582829", email: "liluah@erbsg.org", phone: "+91 98300 11009", address: "Divisional Carriage & Wagon Workshop, Liluah, Howrah - 711204" },
      { id: "dist_mldt", name: "Malda District", code: "ER-MLDT", bsgId: "BSG896907989", email: "malda@erbsg.org", phone: "+91 98300 11006", address: "Divisional Railway Manager Office, Jhaljhalia, Malda - 732102" },
      { id: "dist_sdah", name: "Sealdah District", code: "ER-SDAH", bsgId: "BSG454137323", email: "sealdah@erbsg.org", phone: "+91 98300 11002", address: "DRM Office Building, Kaiser Street, Sealdah, Kolkata - 700014" },
    ];

    for (const d of initialDistricts) {
      db.run(
        `INSERT OR IGNORE INTO districts (id, state_id, name, code, bsg_id, email, phone, address, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [d.id, "state_er", d.name, d.code, d.bsgId, d.email, d.phone, d.address, "ACTIVE"]
      );
    }

    // Seed Academic Years
    const years = [
      { id: "year_2026_2027", label: "2026-2027", isCurrent: 1 },
    ];
    for (const y of years) {
      db.run(`INSERT OR IGNORE INTO academic_years (id, label, is_current, status) VALUES (?, ?, ?, ?)`, [y.id, y.label, y.isCurrent, "ACTIVE"]);
    }

    // Seed Deadlines
    db.run(
      `INSERT OR IGNORE INTO deadlines (id, year_id, deadline_date, status, notes) VALUES (?, ?, ?, ?, ?)`,
      ["dl_2026_2027", "year_2026_2027", "2026-07-31", "OPEN", "Official annual census and member registration deadline"]
    );

    // Hash passwords securely using bcrypt (NO PLAINTEXT STORAGE)
    const saltRounds = 10;
    const adminPasswordHash = bcrypt.hashSync("Admin@ERBSG2026", saltRounds);
    const defaultDistrictPasswordHash = bcrypt.hashSync("Test@1234", saltRounds);

    // 1. Seed State Admin
    db.run(
      `INSERT OR IGNORE INTO users (id, bsg_id, email, name, phone, password_hash, role, state_id, district_id, status, must_change_password)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "usr_state_admin",
        "BSG-ER-STATE",
        "erbsgevent2026@gmail.com",
        "State Administrator (Eastern Railway)",
        "+91 33 2222 4567",
        adminPasswordHash,
        "STATE_ADMIN",
        "state_er",
        null,
        "ACTIVE",
        0
      ]
    );

    // 2. Seed 9 District Users with MUST_CHANGE_PASSWORD = 1 and Test@1234 hash
    for (const d of initialDistricts) {
      const userId = `usr_${d.id}`;
      db.run(
        `INSERT OR IGNORE INTO users (id, bsg_id, email, name, phone, password_hash, role, state_id, district_id, status, must_change_password)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          d.bsgId,
          d.email,
          `${d.name} User`,
          d.phone,
          defaultDistrictPasswordHash,
          "DISTRICT_USER",
          "state_er",
          d.id,
          "ACTIVE",
          1 // MUST change password on first login
        ]
      );
    }

    // Seed clean Initial Member Data (0 values) for 2026-2027 across the 9 districts
    for (const d of initialDistricts) {
      db.run(
        `INSERT OR IGNORE INTO member_counts (
          id, state_id, district_id, year_id,
          bunnies, bunny_aunties, bulbul, guide, ranger, scout, rover, cub,
          flock_leaders, guide_captains, ranger_leaders, cub_masters, lady_cub_masters,
          professional_guides, voluntary_commissioners, support_staff, professionals_staff,
          youth_total, unit_leaders_total, professionals_total, grand_total,
          updated_by
        ) VALUES (?, 'state_er', ?, 'year_2026_2027', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'Initial System Setup')`,
        [`mc_${d.id}_2026`, d.id]
      );
    }

    // Seed State Members
    const stateMembers = [
      { name: "Dr. Ananya Mukherjee", uid: "BSG-UID-ER-001", designation: "State Guide Commissioner", email: "sgc@easternrailway.bsg.org", phone: "+91 98301 22331" },
      { name: "Shri Debasish Roy", uid: "BSG-UID-ER-002", designation: "State Organising Commissioner", email: "soc@easternrailway.bsg.org", phone: "+91 98301 22332" },
      { name: "Shri Soumen Banerjee", uid: "BSG-UID-ER-003", designation: "State Secretary", email: "secretary@easternrailway.bsg.org", phone: "+91 98301 22333" },
      { name: "Smt. Mousumi Ghosh", uid: "BSG-UID-ER-004", designation: "State Training Commissioner", email: "stc@easternrailway.bsg.org", phone: "+91 98301 22334" },
    ];
    for (const sm of stateMembers) {
      db.run(
        `INSERT OR IGNORE INTO state_members (id, state_id, year_id, name, bsg_uid, designation, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [`sm_${sm.uid}`, "state_er", "year_2026_2027", sm.name, sm.uid, sm.designation, sm.email, sm.phone]
      );
    }

    // Initial Audit Log
    db.run(
      `INSERT OR IGNORE INTO audit_logs (id, user_id, user_name, bsg_id, role, action, module, state_id, district_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "log_init_01",
        "usr_state_admin",
        "State Administrator (Eastern Railway)",
        "BSG-ER-STATE",
        "STATE_ADMIN",
        "SYSTEM_INITIALIZE",
        "DATABASE",
        "state_er",
        null,
        "System initialized with Eastern Railway State, 9 Districts, and production-ready security credentials."
      ]
    );
  }
}
