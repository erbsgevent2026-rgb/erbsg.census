import initSqlJs from "sql.js";
import type { Database as SqlJsDatabase } from "sql.js";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "erbsg.sqlite");

let dbInstance: SqlJsDatabase | null = null;

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function saveDatabase(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error("Failed to save SQLite database:", err);
  }
}

export async function getDb(): Promise<SqlJsDatabase> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
      console.log("Loaded existing ERBSG SQLite database from disk.");
    } catch (e) {
      console.warn("Failed to load existing DB file, creating a fresh one:", e);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
    console.log("Initialized new ERBSG SQLite database.");
  }

  initSchemaAndSeed(dbInstance);
  ensureCurrentFinancialYear();

  // Ensure state admin password and official email are synchronized
  try {
    const adminHash = bcrypt.hashSync("Admin@1234", 10);
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

export function ensureCurrentFinancialYear(targetDate = new Date()): { id: string; label: string; created: boolean } {
  if (!dbInstance) return { id: "year_2026_2027", label: "2026-2027", created: false };
  const fy = getCurrentFinancialYear(targetDate);
  const existing = queryOne<any>("SELECT id, is_current FROM academic_years WHERE id = ?", [fy.id]);
  let created = false;

  if (!existing) {
    dbInstance.run(
      "INSERT INTO academic_years (id, label, is_current, status) VALUES (?, ?, 1, 'ACTIVE')",
      [fy.id, fy.label]
    );
    // Demote other years so only current FY is marked as current
    dbInstance.run("UPDATE academic_years SET is_current = 0 WHERE id != ?", [fy.id]);

    // Create deadline for the new FY
    const deadlineId = `dl_${fy.startYear}_${fy.endYear}`;
    const deadlineDate = `${fy.startYear}-07-31`;
    dbInstance.run(
      "INSERT OR IGNORE INTO deadlines (id, year_id, deadline_date, status, notes) VALUES (?, ?, ?, 'OPEN', 'Official annual census and member registration deadline')",
      [deadlineId, fy.id, deadlineDate]
    );

    // Initialize base member count entries for all 9 districts so reports and dashboard immediately function
    const districts = queryAll<any>("SELECT id FROM districts WHERE status = 'ACTIVE'");
    for (const d of districts) {
      const checkMc = queryOne("SELECT id FROM member_counts WHERE district_id = ? AND year_id = ?", [d.id, fy.id]);
      if (!checkMc) {
        const mcId = `mc_${d.id}_${fy.startYear}_${fy.endYear}`;
        dbInstance.run(
          `INSERT INTO member_counts (
            id, state_id, district_id, year_id,
            bunnies, bunny_aunties, bulbul, guide, ranger, scout, rover, cub,
            flock_leaders, guide_captains, ranger_leaders, cub_masters, lady_cub_masters,
            scout_masters, rover_scout_leaders,
            professional_guides, voluntary_commissioners, support_staff, professionals_staff,
            youth_total, unit_leaders_total, professionals_total, grand_total,
            updated_by
          ) VALUES (?, 'state_er', ?, ?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'Automatic Financial Year System')`,
          [mcId, d.id, fy.id]
        );
      }
    }
    created = true;
    saveDatabase();
  } else if (!existing.is_current) {
    dbInstance.run("UPDATE academic_years SET is_current = 0 WHERE id != ?", [fy.id]);
    dbInstance.run("UPDATE academic_years SET is_current = 1 WHERE id = ?", [fy.id]);
    saveDatabase();
  }

  return { id: fy.id, label: fy.label, created };
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
  `);

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
    // Completely zero out bunnies and bunny aunties and align totals
    db.run(`
      UPDATE member_counts SET
        bunnies = 0,
        bunny_aunties = 0,
        youth_total = bulbul + guide + ranger + scout + rover + cub,
        grand_total = (bulbul + guide + ranger + scout + rover + cub) + unit_leaders_total + professionals_total
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

  // --- Migration: Permanently delete deprecated historical data (FY 2023-2024, FY 2024-2025, FY 2025-2026) ---
  try {
    const deprecatedYears = ["year_2023_2024", "year_2024_2025", "year_2025_2026"];
    for (const yr of deprecatedYears) {
      db.run("DELETE FROM academic_years WHERE id = ?", [yr]);
      db.run("DELETE FROM member_counts WHERE year_id = ?", [yr]);
      db.run("DELETE FROM annual_reports WHERE year_id = ?", [yr]);
      db.run("DELETE FROM census_reports WHERE year_id = ?", [yr]);
      db.run("DELETE FROM audited_statements WHERE year_id = ?", [yr]);
      db.run("DELETE FROM official_contacts WHERE year_id = ?", [yr]);
      db.run("DELETE FROM deadlines WHERE year_id = ?", [yr]);
      db.run("DELETE FROM state_members WHERE year_id = ?", [yr]);
      db.run("DELETE FROM district_members WHERE year_id = ?", [yr]);
    }
  } catch (err) {
    console.error("Error purging historical academic years:", err);
  }

  // --- Migration: Ensure all initial District Users with must_change_password = 1 have password hash matching Test@1234 ---
  try {
    const defaultDistrictPasswordHash = bcrypt.hashSync("Test@1234", 10);
    db.run(
      "UPDATE users SET password_hash = ? WHERE role = 'DISTRICT_USER' AND must_change_password = 1",
      [defaultDistrictPasswordHash]
    );
  } catch (err) {
    console.error("Error resetting default password hashes for district users:", err);
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

  // --- Migration: Ensure 17 Official Positions for all 9 Districts ---
  try {
    const FIXED_17_POSITIONS = [
      "President",
      "District Chief Commissioner",
      "District Secretary",
      "District Commissioner (S)",
      "District Commissioner (G)",
      "District Organising Commissioner (Scouts)",
      "District Organising Commissioner (Guides)",
      "District Training Commissioner of Scouts",
      "District Training Commissioner of Guides",
      "District Youth Committee Chairman",
      "District Media Co-ordinator",
      "Jt. District Secretary",
      "Asstt. District Secretary",
      "District Treasurer",
      "Nodal Officer of Aapdamitra",
      "Co-chairman of Youth Committee",
      "Growth Coordinator"
    ];

    const allDists = ["dist_asn", "dist_cen", "dist_clw", "dist_hwh", "dist_jmp", "dist_kpa", "dist_llh", "dist_mldt", "dist_sdah"];
    for (const distId of allDists) {
      const existingReps = db.exec(`SELECT position_order, position_name, name FROM official_contacts WHERE district_id = '${distId}' AND year_id = 'year_2026_2027'`);
      const existingRows = existingReps[0]?.values || [];
      const hasRows = existingRows.length > 0;

      if (!hasRows) {
        // Seed full initial set of 17 positions for this district
        FIXED_17_POSITIONS.forEach((posName, idx) => {
          const posOrder = idx + 1;
          const ocId = `oc_${distId}_year_2026_2027_pos_${posOrder}`;
          db.run(
            `INSERT INTO official_contacts (id, state_id, district_id, year_id, position_order, position_name, name, bsg_id, bsg_uid, designation, scouting_rank, email, phone, is_selected)
             VALUES (?, 'state_er', ?, 'year_2026_2027', ?, ?, '', '', '', ?, ?, '', '', 1)`,
            [ocId, distId, posOrder, posName, posName, posName]
          );
        });
      }
    }
  } catch (err) {
    console.error("Error seeding initial 17 official positions:", err);
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

    const crCheck = db.exec("SELECT count(*) FROM census_reports");
    const crCount = Number(crCheck[0]?.values[0]?.[0] || 0);
    if (crCount === 0) {
      const samplePdfBase64 = "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDY5L0ZpbHRlci9GbGF0ZURlY29kZT4+c3RyZWFtCnicS0wuyExWSEnNLchLLE7VUXBMTs1NzFEwtbAwt9BFyWdkZGBgcGZwcHQC0f55xRmlCsF5pXmpyQohGYl5eam5AFJMEe0KZW5kc3RyZWFtCmVuZG9iagoxIDAgb2JqCjw8L1R5cGUvUGFnZXMvQ291bnQgMS9LaWRzWzMgMCBSXT4+CmVuZG9iagozIDAgb2JqCjw8L1R5cGUvUGFnZS9QYXJlbnQgMSAwIFIvTWVkaWFCb3hbMCAwIDU5NSA4NDJdL1Jlc291cmNlczw8L0ZvbnQ8PC9GMSA0IDAgUj4+Pj4vQ29udGVudHMgMiAwIFI+PgplbmRvYmoKNCAwIG9iago8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+PgplbmRvYmoKNSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMSAwIFI+PgplbmRvYmoKdHJhaWxlcgo8PC9TaXplIDYvUm9vdCA1IDAgUj4+CiUlRU9G";
      db.run(
        `INSERT INTO census_reports (id, state_id, district_id, year_id, file_name, file_size, file_data, version, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ["cr_cen_2026", "state_er", "dist_cen", "year_2026_2027", "Central_District_Census_Report_2026_2027.pdf", 489100, samplePdfBase64, 1, "Central District User"]
      );
    }
  } catch (err) {
    console.error("Error creating or seeding census_reports table:", err);
  }

  // Ensure member counts exist for Liluah District across active academic year
  try {
    const liluahBase = {
      bulbul: 175, guide: 360, ranger: 140, scout: 480, rover: 160, cub: 240,
      flock_leaders: 22, guide_captains: 32, ranger_leaders: 20, cub_masters: 30, lady_cub_masters: 20,
      prof_guides: 7, vol_comm: 6, supp_staff: 11, prof_staff: 13
    };

    const allYearsToSeed = [
      { yearId: "year_2026_2027", factor: 1.0 },
    ];

    for (const y of allYearsToSeed) {
      const checkMc = db.exec(`SELECT id FROM member_counts WHERE district_id = 'dist_llh' AND year_id = '${y.yearId}'`);
      if (!checkMc[0]?.values?.length) {
        const bulbul = Math.round(liluahBase.bulbul * y.factor);
        const guide = Math.round(liluahBase.guide * y.factor);
        const ranger = Math.round(liluahBase.ranger * y.factor);
        const scout = Math.round(liluahBase.scout * y.factor);
        const rover = Math.round(liluahBase.rover * y.factor);
        const cub = Math.round(liluahBase.cub * y.factor);
        const flock_leaders = Math.round(liluahBase.flock_leaders * y.factor);
        const guide_captains = Math.round(liluahBase.guide_captains * y.factor);
        const ranger_leaders = Math.round(liluahBase.ranger_leaders * y.factor);
        const cub_masters = Math.round(liluahBase.cub_masters * y.factor);
        const lady_cub_masters = Math.round(liluahBase.lady_cub_masters * y.factor);
        const prof_guides = Math.round(liluahBase.prof_guides * y.factor);
        const vol_comm = Math.round(liluahBase.vol_comm * y.factor);
        const supp_staff = Math.round(liluahBase.supp_staff * y.factor);
        const prof_staff = Math.round(liluahBase.prof_staff * y.factor);

        const youthTotal = bulbul + guide + ranger + scout + rover + cub;
        const unitLeadersTotal = flock_leaders + guide_captains + ranger_leaders + cub_masters + lady_cub_masters;
        const profTotal = prof_guides + vol_comm + supp_staff + prof_staff;
        const grandTotal = youthTotal + unitLeadersTotal + profTotal;

        db.run(
          `INSERT INTO member_counts (
            id, state_id, district_id, year_id,
            bunnies, bunny_aunties, bulbul, guide, ranger, scout, rover, cub,
            flock_leaders, guide_captains, ranger_leaders, cub_masters, lady_cub_masters,
            scout_masters, rover_scout_leaders,
            professional_guides, voluntary_commissioners, support_staff, professionals_staff,
            youth_total, unit_leaders_total, professionals_total, grand_total,
            updated_by
          ) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `mc_dist_llh_${y.yearId}`, "state_er", "dist_llh", y.yearId,
            bulbul, guide, ranger, scout, rover, cub,
            flock_leaders, guide_captains, ranger_leaders, cub_masters, lady_cub_masters,
            prof_guides, vol_comm, supp_staff, prof_staff,
            youthTotal, unitLeadersTotal, profTotal, grandTotal,
            "System Seeder"
          ]
        );
      }
    }
  } catch (err) {
    console.error("Error seeding Liluah member counts:", err);
  }

  // Ensure Official Contacts exist for Liluah District
  try {
    const checkOc = db.exec("SELECT id FROM official_contacts WHERE district_id = 'dist_llh'");
    if (!checkOc[0]?.values?.length) {
      const liluahOfficials = [
        { id: "oc_llh_1", dist: "dist_llh", name: "Shri Subhasish Roy", desig: "District Commissioner (Scout)", uid: "BSG-UID-LLH-301", railway_desig: "Senior Section Engineer (SSE)", email: "dc.scout.llh@erbsg.org", phone: "+91 98333 44551" },
        { id: "oc_llh_2", dist: "dist_llh", name: "Smt. Manidipa Das", desig: "District Guide Commissioner", uid: "BSG-UID-LLH-302", railway_desig: "Senior Divisional Commercial Manager (Sr.DCM)", email: "dgc.llh@erbsg.org", phone: "+91 98333 44552" },
      ];
      for (const oc of liluahOfficials) {
        db.run(
          `INSERT INTO official_contacts (id, state_id, district_id, year_id, name, railway_designation, scouting_rank, bsg_id, designation, bsg_uid, email, phone, is_selected) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [oc.id, "state_er", oc.dist, "year_2026_2027", oc.name, oc.railway_desig, oc.desig, oc.uid, oc.desig, oc.uid, oc.email, oc.phone]
        );
        db.run(
          `INSERT INTO district_members (id, state_id, district_id, year_id, name, bsg_uid, designation, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [`dm_${oc.id}`, "state_er", oc.dist, "year_2026_2027", oc.name, oc.uid, oc.desig, oc.email, oc.phone]
        );
      }
    }
  } catch (err) {
    console.error("Error seeding Liluah official contacts:", err);
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

  // Idempotent check: Seed multi-year member counts if missing
  const yearDistribution: Record<string, { factor: number; targetGrandTotal: number }> = {};

  const sampleBaseCounts: Record<string, {
    bunnies: number; bunny_aunties: number; bulbul: number; guide: number; ranger: number;
    scout: number; rover: number; cub: number; flock_leaders: number; guide_captains: number;
    ranger_leaders: number; cub_masters: number; lady_cub_masters: number;
    prof_guides: number; vol_comm: number; supp_staff: number; prof_staff: number;
  }> = {
    dist_cen: { bunnies: 85, bunny_aunties: 12, bulbul: 240, guide: 480, ranger: 190, scout: 650, rover: 210, cub: 310, flock_leaders: 30, guide_captains: 45, ranger_leaders: 25, cub_masters: 40, lady_cub_masters: 28, prof_guides: 10, vol_comm: 8, supp_staff: 14, prof_staff: 18 },
    dist_sdah: { bunnies: 120, bunny_aunties: 16, bulbul: 310, guide: 590, ranger: 220, scout: 780, rover: 260, cub: 420, flock_leaders: 38, guide_captains: 55, ranger_leaders: 30, cub_masters: 50, lady_cub_masters: 34, prof_guides: 12, vol_comm: 10, supp_staff: 18, prof_staff: 22 },
    dist_hwh: { bunnies: 110, bunny_aunties: 14, bulbul: 290, guide: 540, ranger: 200, scout: 720, rover: 240, cub: 390, flock_leaders: 35, guide_captains: 50, ranger_leaders: 28, cub_masters: 48, lady_cub_masters: 32, prof_guides: 11, vol_comm: 9, supp_staff: 16, prof_staff: 20 },
    dist_asn: { bunnies: 70, bunny_aunties: 10, bulbul: 210, guide: 410, ranger: 160, scout: 560, rover: 180, cub: 280, flock_leaders: 26, guide_captains: 38, ranger_leaders: 22, cub_masters: 35, lady_cub_masters: 24, prof_guides: 8, vol_comm: 6, supp_staff: 12, prof_staff: 14 },
    dist_clw: { bunnies: 55, bunny_aunties: 8, bulbul: 160, guide: 330, ranger: 130, scout: 450, rover: 150, cub: 220, flock_leaders: 20, guide_captains: 30, ranger_leaders: 18, cub_masters: 28, lady_cub_masters: 18, prof_guides: 6, vol_comm: 5, supp_staff: 10, prof_staff: 12 },
    dist_llh: { bunnies: 0, bunny_aunties: 0, bulbul: 175, guide: 360, ranger: 140, scout: 480, rover: 160, cub: 240, flock_leaders: 22, guide_captains: 32, ranger_leaders: 20, cub_masters: 30, lady_cub_masters: 20, prof_guides: 7, vol_comm: 6, supp_staff: 11, prof_staff: 13 },
    dist_mldt: { bunnies: 60, bunny_aunties: 9, bulbul: 180, guide: 360, ranger: 140, scout: 490, rover: 160, cub: 240, flock_leaders: 22, guide_captains: 32, ranger_leaders: 20, cub_masters: 30, lady_cub_masters: 20, prof_guides: 7, vol_comm: 6, supp_staff: 11, prof_staff: 13 },
    dist_kpa: { bunnies: 65, bunny_aunties: 10, bulbul: 195, guide: 390, ranger: 150, scout: 520, rover: 170, cub: 260, flock_leaders: 24, guide_captains: 35, ranger_leaders: 21, cub_masters: 32, lady_cub_masters: 22, prof_guides: 8, vol_comm: 6, supp_staff: 12, prof_staff: 15 },
    dist_jmp: { bunnies: 50, bunny_aunties: 7, bulbul: 150, guide: 310, ranger: 120, scout: 430, rover: 140, cub: 200, flock_leaders: 18, guide_captains: 28, ranger_leaders: 16, cub_masters: 25, lady_cub_masters: 16, prof_guides: 5, vol_comm: 4, supp_staff: 9, prof_staff: 10 },
  };

  for (const [yearKey, cfg] of Object.entries(yearDistribution)) {
    const countCheck = db.exec(`SELECT count(*) FROM member_counts WHERE year_id = '${yearKey}'`);
    const existingCount = countCheck[0]?.values[0]?.[0] || 0;
    if (Number(existingCount) === 0) {
      const distKeys = Object.keys(sampleBaseCounts);
      let runningYearTotal = 0;

      distKeys.forEach((distId, idx) => {
        const c = sampleBaseCounts[distId];
        const isLast = idx === distKeys.length - 1;

        const bulbul = Math.round(c.bulbul * cfg.factor);
        const guide = Math.round(c.guide * cfg.factor);
        const ranger = Math.round(c.ranger * cfg.factor);
        const cub = Math.round(c.cub * cfg.factor);
        const scout = Math.round(c.scout * cfg.factor);
        const rover = Math.round(c.rover * cfg.factor);
        const flock_leaders = Math.round(c.flock_leaders * cfg.factor);
        const guide_captains = Math.round(c.guide_captains * cfg.factor);
        const ranger_leaders = Math.round(c.ranger_leaders * cfg.factor);
        const cub_masters = Math.round(c.cub_masters * cfg.factor);
        const lady_cub_masters = Math.round(c.lady_cub_masters * cfg.factor);
        const scout_masters = 0;
        const rover_scout_leaders = 0;
        const prof_guides = Math.round(c.prof_guides * cfg.factor);
        const vol_comm = Math.round(c.vol_comm * cfg.factor);
        const supp_staff = Math.round(c.supp_staff * cfg.factor);
        let prof_staff = Math.round(c.prof_staff * cfg.factor);

        let youthTotal = bulbul + guide + ranger + cub + scout + rover;
        let unitLeadersTotal = flock_leaders + guide_captains + ranger_leaders + cub_masters + lady_cub_masters;
        let profTotal = prof_guides + vol_comm + supp_staff + prof_staff;
        let grandTotal = youthTotal + unitLeadersTotal + profTotal;

        // Balance exact target total for last district
        if (isLast) {
          const diff = cfg.targetGrandTotal - (runningYearTotal + grandTotal);
          if (diff !== 0) {
            prof_staff += diff;
            profTotal += diff;
            grandTotal += diff;
          }
        }
        runningYearTotal += grandTotal;

        db.run(
          `INSERT INTO member_counts (
            id, state_id, district_id, year_id,
            bunnies, bunny_aunties, bulbul, guide, ranger, scout, rover, cub,
            flock_leaders, guide_captains, ranger_leaders, cub_masters, lady_cub_masters,
            scout_masters, rover_scout_leaders,
            professional_guides, voluntary_commissioners, support_staff, professionals_staff,
            youth_total, unit_leaders_total, professionals_total, grand_total,
            updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `mc_${distId}_${yearKey}`, "state_er", distId, yearKey,
            0, 0, bulbul, guide, ranger, scout, rover, cub,
            flock_leaders, guide_captains, ranger_leaders, cub_masters, lady_cub_masters,
            scout_masters, rover_scout_leaders,
            prof_guides, vol_comm, supp_staff, prof_staff,
            youthTotal, unitLeadersTotal, profTotal, grandTotal,
            "System Seeder"
          ]
        );
      });
    }
  }

  const stateCheckResult = db.exec("SELECT count(*) FROM states");
  const stateCount = stateCheckResult[0]?.values[0]?.[0] || 0;

  if (Number(stateCount) === 0) {
    console.log("Seeding Eastern Railway State and 9 initial Districts...");
    db.run(
      `INSERT INTO states (id, name, code, bsg_id, email, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)`,
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
        `INSERT INTO districts (id, state_id, name, code, bsg_id, email, phone, address, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [d.id, "state_er", d.name, d.code, d.bsgId, d.email, d.phone, d.address, "ACTIVE"]
      );
    }

    // Seed Academic Years
    const years = [
      { id: "year_2026_2027", label: "2026-2027", isCurrent: 1 },
    ];
    for (const y of years) {
      db.run(`INSERT INTO academic_years (id, label, is_current, status) VALUES (?, ?, ?, ?)`, [y.id, y.label, y.isCurrent, "ACTIVE"]);
    }

    // Seed Deadlines
    db.run(
      `INSERT INTO deadlines (id, year_id, deadline_date, status, notes) VALUES (?, ?, ?, ?, ?)`,
      ["dl_2026_2027", "year_2026_2027", "2026-07-31", "OPEN", "Official annual census and member registration deadline"]
    );

    // Hash passwords securely using bcrypt (NO PLAINTEXT STORAGE)
    const saltRounds = 10;
    const adminPasswordHash = bcrypt.hashSync("Admin@1234", saltRounds);
    const defaultDistrictPasswordHash = bcrypt.hashSync("Test@1234", saltRounds);

    // 1. Seed State Admin
    db.run(
      `INSERT INTO users (id, bsg_id, email, name, phone, password_hash, role, state_id, district_id, status, must_change_password)
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

    // 2. Seed 8 District Users with MUST_CHANGE_PASSWORD = 1 and Test@1234 hash
    for (const d of initialDistricts) {
      const userId = `usr_${d.id}`;
      db.run(
        `INSERT INTO users (id, bsg_id, email, name, phone, password_hash, role, state_id, district_id, status, must_change_password)
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

    // Seed realistic Initial Member Data for 2026-2027 across the 9 districts
    const initialCounts: Record<string, {
      bunnies: number; bunny_aunties: number; bulbul: number; guide: number; ranger: number;
      scout: number; rover: number; cub: number; flock_leaders: number; guide_captains: number;
      ranger_leaders: number; cub_masters: number; lady_cub_masters: number;
      prof_guides: number; vol_comm: number; supp_staff: number; prof_staff: number;
    }> = {
      dist_asn: { bunnies: 0, bunny_aunties: 0, bulbul: 210, guide: 410, ranger: 160, scout: 560, rover: 180, cub: 280, flock_leaders: 26, guide_captains: 38, ranger_leaders: 22, cub_masters: 35, lady_cub_masters: 24, prof_guides: 8, vol_comm: 6, supp_staff: 12, prof_staff: 14 },
      dist_cen: { bunnies: 0, bunny_aunties: 0, bulbul: 240, guide: 480, ranger: 190, scout: 650, rover: 210, cub: 310, flock_leaders: 30, guide_captains: 45, ranger_leaders: 25, cub_masters: 40, lady_cub_masters: 28, prof_guides: 10, vol_comm: 8, supp_staff: 14, prof_staff: 18 },
      dist_clw: { bunnies: 0, bunny_aunties: 0, bulbul: 160, guide: 330, ranger: 130, scout: 450, rover: 150, cub: 220, flock_leaders: 20, guide_captains: 30, ranger_leaders: 18, cub_masters: 28, lady_cub_masters: 18, prof_guides: 6, vol_comm: 5, supp_staff: 10, prof_staff: 12 },
      dist_hwh: { bunnies: 0, bunny_aunties: 0, bulbul: 290, guide: 540, ranger: 200, scout: 720, rover: 240, cub: 390, flock_leaders: 35, guide_captains: 50, ranger_leaders: 28, cub_masters: 48, lady_cub_masters: 32, prof_guides: 11, vol_comm: 9, supp_staff: 16, prof_staff: 20 },
      dist_jmp: { bunnies: 0, bunny_aunties: 0, bulbul: 150, guide: 310, ranger: 120, scout: 430, rover: 140, cub: 200, flock_leaders: 18, guide_captains: 28, ranger_leaders: 16, cub_masters: 25, lady_cub_masters: 16, prof_guides: 5, vol_comm: 4, supp_staff: 9, prof_staff: 10 },
      dist_kpa: { bunnies: 0, bunny_aunties: 0, bulbul: 195, guide: 390, ranger: 150, scout: 520, rover: 170, cub: 260, flock_leaders: 24, guide_captains: 35, ranger_leaders: 21, cub_masters: 32, lady_cub_masters: 22, prof_guides: 8, vol_comm: 6, supp_staff: 12, prof_staff: 15 },
      dist_llh: { bunnies: 0, bunny_aunties: 0, bulbul: 175, guide: 360, ranger: 140, scout: 480, rover: 160, cub: 240, flock_leaders: 22, guide_captains: 32, ranger_leaders: 20, cub_masters: 30, lady_cub_masters: 20, prof_guides: 7, vol_comm: 6, supp_staff: 11, prof_staff: 13 },
      dist_mldt: { bunnies: 0, bunny_aunties: 0, bulbul: 180, guide: 360, ranger: 140, scout: 490, rover: 160, cub: 240, flock_leaders: 22, guide_captains: 32, ranger_leaders: 20, cub_masters: 30, lady_cub_masters: 20, prof_guides: 7, vol_comm: 6, supp_staff: 11, prof_staff: 13 },
      dist_sdah: { bunnies: 0, bunny_aunties: 0, bulbul: 310, guide: 590, ranger: 220, scout: 780, rover: 260, cub: 420, flock_leaders: 38, guide_captains: 55, ranger_leaders: 30, cub_masters: 50, lady_cub_masters: 34, prof_guides: 12, vol_comm: 10, supp_staff: 18, prof_staff: 22 },
    };

    for (const [distId, c] of Object.entries(initialCounts)) {
      const youthTotal = c.bulbul + c.guide + c.ranger + c.scout + c.rover + c.cub;
      const unitLeadersTotal = c.flock_leaders + c.guide_captains + c.ranger_leaders + c.cub_masters + c.lady_cub_masters;
      const profTotal = c.prof_guides + c.vol_comm + c.supp_staff + c.prof_staff;
      const grandTotal = youthTotal + unitLeadersTotal + profTotal;

      db.run(
        `INSERT INTO member_counts (
          id, state_id, district_id, year_id,
          bunnies, bunny_aunties, bulbul, guide, ranger, scout, rover, cub,
          flock_leaders, guide_captains, ranger_leaders, cub_masters, lady_cub_masters,
          professional_guides, voluntary_commissioners, support_staff, professionals_staff,
          youth_total, unit_leaders_total, professionals_total, grand_total,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `mc_${distId}_2026`, "state_er", distId, "year_2026_2027",
          0, 0, c.bulbul, c.guide, c.ranger, c.scout, c.rover, c.cub,
          c.flock_leaders, c.guide_captains, c.ranger_leaders, c.cub_masters, c.lady_cub_masters,
          c.prof_guides, c.vol_comm, c.supp_staff, c.prof_staff,
          youthTotal, unitLeadersTotal, profTotal, grandTotal,
          "System Seeder"
        ]
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
        `INSERT INTO state_members (id, state_id, year_id, name, bsg_uid, designation, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [`sm_${sm.uid}`, "state_er", "year_2026_2027", sm.name, sm.uid, sm.designation, sm.email, sm.phone]
      );
    }

    // Seed Sample Official Contact Persons for Central and Sealdah
    const officials = [
      { id: "oc_cen_1", dist: "dist_cen", name: "Shri Rajeshwar Verma", desig: "District Commissioner (Scout)", uid: "BSG-UID-CEN-101", email: "dc.scout.cen@erbsg.org", phone: "+91 98311 55661" },
      { id: "oc_cen_2", dist: "dist_cen", name: "Smt. Swati Bose", desig: "District Secretary", uid: "BSG-UID-CEN-102", email: "sec.cen@erbsg.org", phone: "+91 98311 55662" },
      { id: "oc_sdah_1", dist: "dist_sdah", name: "Shri Amitava Sen", desig: "District Commissioner (Scout)", uid: "BSG-UID-SDAH-201", email: "dc.sdah@erbsg.org", phone: "+91 98322 77881" },
      { id: "oc_sdah_2", dist: "dist_sdah", name: "Smt. Papiya Sengupta", desig: "District Guide Commissioner", uid: "BSG-UID-SDAH-202", email: "dgc.sdah@erbsg.org", phone: "+91 98322 77882" },
    ];
    for (const oc of officials) {
      db.run(
        `INSERT INTO official_contacts (id, state_id, district_id, year_id, name, designation, bsg_uid, email, phone, is_selected) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [oc.id, "state_er", oc.dist, "year_2026_2027", oc.name, oc.desig, oc.uid, oc.email, oc.phone]
      );
      db.run(
        `INSERT INTO district_members (id, state_id, district_id, year_id, name, bsg_uid, designation, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [`dm_${oc.id}`, "state_er", oc.dist, "year_2026_2027", oc.name, oc.uid, oc.desig, oc.email, oc.phone]
      );
    }

    // Seed sample Annual Report & Audited Statement for Central and Sealdah
    const samplePdfBase64 = "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDY5L0ZpbHRlci9GbGF0ZURlY29kZT4+c3RyZWFtCnicS0wuyExWSEnNLchLLE7VUXBMTs1NzFEwtbAwt9BFyWdkZGBgcGZwcHQC0f55xRmlCsF5pXmpyQohGYl5eam5AFJMEe0KZW5kc3RyZWFtCmVuZG9iagoxIDAgb2JqCjw8L1R5cGUvUGFnZXMvQ291bnQgMS9LaWRzWzMgMCBSXT4+CmVuZG9iagozIDAgb2JqCjw8L1R5cGUvUGFnZS9QYXJlbnQgMSAwIFIvTWVkaWFCb3hbMCAwIDU5NSA4NDJdL1Jlc291cmNlczw8L0ZvbnQ8PC9GMSA0IDAgUj4+Pj4vQ29udGVudHMgMiAwIFI+PgplbmRvYmoKNCAwIG9iago8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+PgplbmRvYmoKNSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMSAwIFI+PgplbmRvYmoKdHJhaWxlcgo8PC9TaXplIDYvUm9vdCA1IDAgUj4+CiUlRU9G";

    db.run(
      `INSERT INTO annual_reports (id, state_id, district_id, year_id, file_name, file_size, file_data, version, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["ar_cen_2026", "state_er", "dist_cen", "year_2026_2027", "Central_District_Annual_Report_2026_2027.pdf", 458200, samplePdfBase64, 1, "Central District User"]
    );

    db.run(
      `INSERT INTO census_reports (id, state_id, district_id, year_id, file_name, file_size, file_data, version, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["cr_cen_2026", "state_er", "dist_cen", "year_2026_2027", "Central_District_Census_Report_2026_2027.pdf", 489100, samplePdfBase64, 1, "Central District User"]
    );

    db.run(
      `INSERT INTO audited_statements (id, state_id, district_id, year_id, file_name, file_size, file_data, version, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["as_cen_2026", "state_er", "dist_cen", "year_2026_2027", "Central_Audited_Statement_2026_2027.pdf", 512000, samplePdfBase64, 1, "Central District User"]
    );

    // Initial Audit Log
    db.run(
      `INSERT INTO audit_logs (id, user_id, user_name, bsg_id, role, action, module, state_id, district_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        "System initialized with Eastern Railway State, 8 Districts, and default secure credentials."
      ]
    );
  }
}
