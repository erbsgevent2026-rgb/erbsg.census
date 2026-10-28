# ERBSG Data Control Portal — Production Hostinger Deployment Guide

**Application:** Eastern Railway Bharat Scouts and Guides (ERBSG) Data Control Portal  
**Production Domain:** `https://erbsg.org`  
**Repository:** `https://github.com/erbsgevent2026-rgb/erbsg.census`  
**Target Branch:** `main`  
**Runtime:** Node.js 22 LTS (Node.js 20+ compatible)

---

## 1. Quick Technical Specifications

| Parameter | Confirmed Value | Notes |
| :--- | :--- | :--- |
| **Node.js Version** | **22.x** (or 20.x LTS) | Selected in Hostinger hPanel Node.js selector |
| **Application Root** | `/home/u681527468/domains/erbsg.org/nodejs` *(or your repo root folder)* | Path where `package.json` resides |
| **Application Startup File** | `dist/server.cjs` | Bundled Node.js 22 server produced by `npm run build` |
| **Build Command** | `npm run build` | Builds Vite frontend into `dist/` and server bundle into `dist/server.cjs` |
| **Start Command** | `npm start` (runs `node dist/server.cjs`) | Configured in `package.json` |
| **Persistent DB Directory** | `/home/u681527468/domains/erbsg.org/nodejs/data` | **Must be outside versioned `/current/` or `/hbuilds/` folders** |
| **Backup Directory** | `/home/u681527468/domains/erbsg.org/nodejs/data/backups` | Automatic rolling snapshots & manual snapshots |

---

## 2. Persistent Storage Architecture (Why Previous Deployments Failed)

### The Root Cause
On Hostinger Cloud, Git deployments use ephemeral version directories (`.../hbuilds/...` or `.../current/`).
Because database files (`*.sqlite`) are gitignored, every fresh deployment creates a clean directory tree without an existing database file.
When `ALLOW_DATABASE_CREATION=false`, the safety protection correctly prevented an unintended blank database from being spawned silently, returning an HTTP 503 error on the health check and login API.

### The Solution: External Persistent Storage
We store the production database at an explicit, persistent path located outside the release versions:
```
/home/u681527468/domains/erbsg.org/nodejs/data/erbsg.sqlite
```
- **Read/Write/Atomic Rename**: The application actively runs permission probes on startup.
- **Backups**: Pre-startup snapshot backups are automatically preserved in `/home/u681527468/domains/erbsg.org/nodejs/data/backups`.
- **Locked After Bootstrap**: Once initialized, `ALLOW_DATABASE_CREATION=false` permanently safeguards against accidental deletion or resets.

---

## 3. Hostinger Environment Variables

In your Hostinger hPanel under **Advanced > Node.js > Environment Variables**, configure the following variables:

```ini
# Core Environment
NODE_ENV=production
PORT=3000

# Persistent Database File Path (Outside volatile deployment folders)
DATABASE_PATH=/home/u681527468/domains/erbsg.org/nodejs/data/erbsg.sqlite
DATABASE_BACKUP_DIR=/home/u681527468/domains/erbsg.org/nodejs/data/backups

# First-Time Setup Flag: Set to true ONLY during initial deployment, then set to false
ALLOW_DATABASE_CREATION=true

# Security: Generate a strong, random 64-character string (DO NOT use default or short secret)
# Generate with terminal: openssl rand -base64 48
JWT_SECRET=your_generated_random_64_character_production_secret_key_here

# Initial Passwords for One-Time Setup (Only applied on brand-new database)
INITIAL_ADMIN_PASSWORD=Admin@ERBSG2026
INITIAL_DISTRICT_PASSWORD=Test@1234

# Public Portal URL
APP_URL=https://erbsg.org
```

> **Restart vs. Redeployment Rule:**
> - Changes to `DATABASE_PATH`, `DATABASE_BACKUP_DIR`, `ALLOW_DATABASE_CREATION`, `JWT_SECRET`, or `PORT` only require clicking **Restart Application** in Hostinger hPanel.
> - Frontend changes or `VITE_*` environment variables require running `npm run build` (redeployment).

---

## 4. First-Time Production Bootstrap Sequence

Follow this exact sequence to deploy and initialize a fresh, verified database:

### Step 1: Ensure Persistent Directory Exists & Permissions
Connect via SSH or Hostinger File Manager:
```bash
# Verify or create the persistent data directory
mkdir -p /home/u681527468/domains/erbsg.org/nodejs/data/backups

# Set write permissions for the web application user
chmod 755 /home/u681527468/domains/erbsg.org/nodejs/data
chmod 755 /home/u681527468/domains/erbsg.org/nodejs/data/backups
```

### Step 2: Configure Setup Flag
In Hostinger hPanel Node.js settings:
1. Ensure `ALLOW_DATABASE_CREATION` is set to `true`.
2. Save environment variables.

### Step 3: Deploy Application & Run Build
In Hostinger Git Deployment or SSH terminal:
```bash
git pull origin main
npm install
npm run build
```
*(Or use Hostinger's automatic Deploy button).*

### Step 4: Start/Restart Application
Click **Restart Application** in Hostinger hPanel.

### Step 5: Verify Startup in Runtime Logs
Open the Hostinger application logs. You will see:
```text
================================================================================
[DATABASE PERSISTENCE AUDIT & STARTUP DIAGNOSTICS]
  • Resolved DATABASE_PATH:        "/home/u681527468/domains/erbsg.org/nodejs/data/erbsg.sqlite"
  • Resolution Source:            Explicit DATABASE_PATH environment variable (Target file pending creation)
  • Is Persistent Location:       YES (outside version directory)
  • Parent Directory Exists:      YES (/home/u681527468/domains/erbsg.org/nodejs/data)
  • Parent Directory Permissions: OK (Writable & Atomic Rename Verified)
  • Database File Exists:         NO
  • ALLOW_DATABASE_CREATION:      "true"
================================================================================
[DATABASE INITIALIZATION] Creating and initializing fresh production SQLite database...
  • PRAGMA integrity_check:       PASSED (ok)
[DATABASE SAFETY] Backup snapshot created at: .../backups/erbsg_fresh_seeded_initial_<timestamp>.sqlite
================================================================================
[DATABASE INITIALIZATION COMPLETED SUCCESSFULLY]
  • Fresh production database created and saved at:
    "/home/u681527468/domains/erbsg.org/nodejs/data/erbsg.sqlite"
  • State Administrator account seeded:
    Login ID: BSG-ER-STATE
  • 9 District User accounts seeded:
    - Asansol District:      BSG287206516
    - Central District:      BSG414635725
    - CLW District:          BSG497632275
    - Howrah District:       BSG778778724
    - Jamalpur District:     BSG283090263
    - Kanchrapara District:  BSG337400383
    - Liluah District:       BSG918582829
    - Malda District:        BSG896907989
    - Sealdah District:      BSG454137323
  • Verified seeded entities: 10 users, 9 districts, 2 active sessions
================================================================================
ERBSG Portal Server running at http://0.0.0.0:3000 (env: production)
```

### Step 6: Verify Health Check via Browser or cURL
Open `https://erbsg.org/api/health` or run:
```bash
curl -i https://erbsg.org/api/health
```
Expected response:
```json
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "status": "healthy",
  "database": "connected",
  "error": null,
  "app": "ERBSG Data Control Portal",
  "organization": "Eastern Railway Bharat Scouts and Guides",
  "state": "Eastern Railway",
  "maintenanceMode": false,
  "timestamp": "2026-10-26T...",
  "uptime": 12
}
```

### Step 7: LOCKDOWN (Crucial Security Step)
Now that the database is created:
1. In Hostinger hPanel Environment Variables, change:
   ```ini
   ALLOW_DATABASE_CREATION=false
   ```
2. Click **Restart Application**.
3. Verify `https://erbsg.org/api/health` continues to return HTTP 200 with `status: "healthy"` and `database: "connected"`.
4. The database is now locked against accidental re-creation or accidental overwrite on all future deployments.

---

## 5. Seeded Production Accounts & Login Testing

### State Administrator
- **Login ID**: `BSG-ER-STATE`
- **Initial Password**: `Admin@ERBSG2026` (or value of `INITIAL_ADMIN_PASSWORD`)
- **Role**: `STATE_ADMIN`
- **Access**: Full state overview, all 9 districts, session management, backup management, maintenance mode.

### District Users
Initial password for all district users is `Test@1234`.  
On first login, the user is required to set their own new password (`must_change_password=1`).

| District Name | BSG Login ID | Email | Initial Password | Role |
| :--- | :--- | :--- | :--- | :--- |
| **Asansol District** | `BSG287206516` | `asansol@erbsg.org` | `Test@1234` | District User |
| **Central District** | `BSG414635725` | `central@erbsg.org` | `Test@1234` | District User |
| **CLW District** | `BSG497632275` | `clw@erbsg.org` | `Test@1234` | District User |
| **Howrah District** | `BSG778778724` | `howrah@erbsg.org` | `Test@1234` | District User |
| **Jamalpur District** | `BSG283090263` | `jamalpur@erbsg.org` | `Test@1234` | District User |
| **Kanchrapara District** | `BSG337400383` | `kanchrapara@erbsg.org` | `Test@1234` | District User |
| **Liluah District** | `BSG918582829` | `liluah@erbsg.org` | `Test@1234` | District User |
| **Malda District** | `BSG896907989` | `malda@erbsg.org` | `Test@1234` | District User |
| **Sealdah District** | `BSG454137323` | `sealdah@erbsg.org` | `Test@1234` | District User |

---

## 6. Verification: Data Persistence Across Restart & Redeployment

To confirm data survives application lifecycle events:
1. Log in as State Admin (`BSG-ER-STATE`).
2. Update an organizational setting or create an audit note.
3. In Hostinger hPanel, click **Restart Application**.
4. Refresh your browser. Verify the updated information is still present.
5. In Hostinger, trigger a git pull / redeploy.
6. Verify the database remains intact because `DATABASE_PATH` points outside the release directory.

---

## 7. Backup and Restore Procedures

### Automated Backups
On every server startup, a rolling backup snapshot (`erbsg_autobackup_<timestamp>.sqlite`) is automatically written to `/home/u681527468/domains/erbsg.org/nodejs/data/backups/`. Up to 5 rolling backups are retained automatically.

### Administrative API Backup Endpoints (State Admin Only)
- **List Backups**: `GET /api/admin/backups`
- **Create Immediate Snapshot**: `POST /api/admin/backups/create`
- **Restore From Snapshot**: `POST /api/admin/backups/:filename/restore`

### Manual File-Level Backup via SSH
```bash
# Create manual snapshot
cp /home/u681527468/domains/erbsg.org/nodejs/data/erbsg.sqlite \
   /home/u681527468/domains/erbsg.org/nodejs/data/backups/manual_backup_$(date +%Y%m%d_%H%M%S).sqlite

# Restore from snapshot
cp /home/u681527468/domains/erbsg.org/nodejs/data/backups/manual_backup_20261026.sqlite \
   /home/u681527468/domains/erbsg.org/nodejs/data/erbsg.sqlite
```

---

## 8. Troubleshooting & Diagnostics

| HTTP Status | Cause | Action |
| :--- | :--- | :--- |
| **503 Service Unavailable** | Database file missing at `DATABASE_PATH` and `ALLOW_DATABASE_CREATION=false`. | Check logs. If this is a fresh setup, set `ALLOW_DATABASE_CREATION=true`, restart once, verify health check, then set back to `false`. |
| **503 Service Unavailable** | Maintenance Mode activated by State Administrator. | State Admin must deactivate maintenance mode via portal dashboard or API (`POST /api/system/maintenance`). |
| **403 Forbidden** | Account inactive or District User attempting cross-district access. | District data isolation enforces strict district boundaries. District users can only access their assigned district records. |
| **428 Precondition Required** | User has `must_change_password=1`. | User must complete password change at `/change-password` before continuing. |
| **429 Too Many Requests** | Brute force protection triggered (10+ failed attempts). | Rate limiter locks client IP for 15 minutes. Wait for cooldown. |
| **404 Not Found (API)** | Unmatched route under `/api/*`. | Check requested URL endpoint and HTTP method. |

---

## 9. Rollback Plan

If a deployment fails:
1. In Hostinger Git Deployment, revert to the last working commit.
2. In Hostinger hPanel, click **Restart Application**.
3. If database records were corrupted by an external event, restore the latest backup from:
   `/home/u681527468/domains/erbsg.org/nodejs/data/backups/`
