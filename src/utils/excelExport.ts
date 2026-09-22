import * as XLSX from "xlsx";

export interface ExcelExportOptions {
  sheetName?: string;
  autoWidth?: boolean;
}

/**
 * Clean and sanitize data to safeguard sensitive information (PII / passwords)
 */
function sanitizeRecord(record: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  const sensitiveKeys = [
    "password",
    "password_hash",
    "token",
    "secret",
    "mfa_secret",
    "raw_password",
    "jwt"
  ];

  for (const [key, val] of Object.entries(record)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      continue; // Exclude sensitive security keys for data privacy
    }
    if (val === null || val === undefined) {
      sanitized[key] = "—";
    } else if (typeof val === "boolean") {
      sanitized[key] = val ? "YES" : "NO";
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

/**
 * Standard table export to Excel
 */
export function exportToExcel(
  data: any[],
  fileName: string,
  sheetName: string = "Data_Export"
) {
  try {
    if (!data || data.length === 0) {
      console.warn("No data provided to exportToExcel.");
      return;
    }

    const sanitizedData = data.map((item) =>
      typeof item === "object" && item !== null ? sanitizeRecord(item) : item
    );

    const worksheet = XLSX.utils.json_to_sheet(sanitizedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Dynamic column widths for clean readability
    const keys = Object.keys(sanitizedData[0]);
    worksheet["!cols"] = keys.map((key) => {
      let maxLen = key.length;
      for (const row of sanitizedData) {
        const valStr = String(row[key] ?? "");
        if (valStr.length > maxLen) maxLen = valStr.length;
      }
      return { wch: Math.min(Math.max(maxLen + 4, 12), 48) };
    });

    const safeFileName = fileName.replace(/[^a-zA-Z0-9_\-]/g, "_");
    XLSX.writeFile(workbook, `${safeFileName}.xlsx`);
  } catch (error) {
    console.error("Excel export error:", error);
  }
}

/**
 * Formal Membership Census export with section headers, sub-totals, and grand totals
 */
export function exportMembersToExcel(
  members: any,
  districtName: string,
  yearLabel: string
) {
  const formatted = [
    {
      "CENSUS CATEGORY": "1. YOUTH SECTION",
      "BSG WING / SUB-CLASSIFICATION": "Bulbuls",
      "REGISTERED COUNT": members.bulbul || 0,
      "STATUS": "ACTIVE"
    },
    {
      "CENSUS CATEGORY": "1. YOUTH SECTION",
      "BSG WING / SUB-CLASSIFICATION": "Guides",
      "REGISTERED COUNT": members.guide || 0,
      "STATUS": "ACTIVE"
    },
    {
      "CENSUS CATEGORY": "1. YOUTH SECTION",
      "BSG WING / SUB-CLASSIFICATION": "Rangers",
      "REGISTERED COUNT": members.ranger || 0,
      "STATUS": "ACTIVE"
    },
    {
      "CENSUS CATEGORY": "1. YOUTH SECTION",
      "BSG WING / SUB-CLASSIFICATION": "Cubs",
      "REGISTERED COUNT": members.cub || 0,
      "STATUS": "ACTIVE"
    },
    {
      "CENSUS CATEGORY": "1. YOUTH SECTION",
      "BSG WING / SUB-CLASSIFICATION": "Scouts",
      "REGISTERED COUNT": members.scout || 0,
      "STATUS": "ACTIVE"
    },
    {
      "CENSUS CATEGORY": "1. YOUTH SECTION",
      "BSG WING / SUB-CLASSIFICATION": "Rovers",
      "REGISTERED COUNT": members.rover || 0,
      "STATUS": "ACTIVE"
    },
    {
      "CENSUS CATEGORY": "=== SUB-TOTAL ===",
      "BSG WING / SUB-CLASSIFICATION": "YOUTH SECTION TOTAL",
      "REGISTERED COUNT": members.youth_total || 0,
      "STATUS": "VERIFIED"
    },

    {
      "CENSUS CATEGORY": "2. UNIT LEADERS",
      "BSG WING / SUB-CLASSIFICATION": "Flock Leaders & Assistants",
      "REGISTERED COUNT": members.flock_leaders || 0,
      "STATUS": "ACTIVE"
    },
    {
      "CENSUS CATEGORY": "2. UNIT LEADERS",
      "BSG WING / SUB-CLASSIFICATION": "Guide Captains & Assistants",
      "REGISTERED COUNT": members.guide_captains || 0,
      "STATUS": "ACTIVE"
    },
    {
      "CENSUS CATEGORY": "2. UNIT LEADERS",
      "BSG WING / SUB-CLASSIFICATION": "Ranger Leaders & Assistants",
      "REGISTERED COUNT": members.ranger_leaders || 0,
      "STATUS": "ACTIVE"
    },
    {
      "CENSUS CATEGORY": "2. UNIT LEADERS",
      "BSG WING / SUB-CLASSIFICATION": "Cub Masters & Assistants",
      "REGISTERED COUNT": members.cub_masters || 0,
      "STATUS": "ACTIVE"
    },
    {
      "CENSUS CATEGORY": "2. UNIT LEADERS",
      "BSG WING / SUB-CLASSIFICATION": "Scout Masters & Assistants",
      "REGISTERED COUNT": members.scout_masters || 0,
      "STATUS": "ACTIVE"
    },
    {
      "CENSUS CATEGORY": "2. UNIT LEADERS",
      "BSG WING / SUB-CLASSIFICATION": "Rover Scout Leaders & Assistants",
      "REGISTERED COUNT": members.rover_scout_leaders || 0,
      "STATUS": "ACTIVE"
    },
    {
      "CENSUS CATEGORY": "=== SUB-TOTAL ===",
      "BSG WING / SUB-CLASSIFICATION": "UNIT LEADERS TOTAL",
      "REGISTERED COUNT": members.unit_leaders_total || 0,
      "STATUS": "VERIFIED"
    },

    {
      "CENSUS CATEGORY": "3. PROFESSIONALS & SUPPORT STAFF",
      "BSG WING / SUB-CLASSIFICATION": "Professional Guides",
      "REGISTERED COUNT": members.professional_guides || 0,
      "STATUS": "ACTIVE"
    },
    {
      "CENSUS CATEGORY": "3. PROFESSIONALS & SUPPORT STAFF",
      "BSG WING / SUB-CLASSIFICATION": "Voluntary Commissioners",
      "REGISTERED COUNT": members.voluntary_commissioners || 0,
      "STATUS": "ACTIVE"
    },
    {
      "CENSUS CATEGORY": "3. PROFESSIONALS & SUPPORT STAFF",
      "BSG WING / SUB-CLASSIFICATION": "Support Staff",
      "REGISTERED COUNT": members.support_staff || 0,
      "STATUS": "ACTIVE"
    },
    {
      "CENSUS CATEGORY": "3. PROFESSIONALS & SUPPORT STAFF",
      "BSG WING / SUB-CLASSIFICATION": "Professionals / Staff",
      "REGISTERED COUNT": members.professionals_staff || 0,
      "STATUS": "ACTIVE"
    },
    {
      "CENSUS CATEGORY": "=== SUB-TOTAL ===",
      "BSG WING / SUB-CLASSIFICATION": "PROFESSIONALS & SUPPORT STAFF TOTAL",
      "REGISTERED COUNT": members.professionals_total || 0,
      "STATUS": "VERIFIED"
    },

    {
      "CENSUS CATEGORY": "★ GRAND TOTAL ★",
      "BSG WING / SUB-CLASSIFICATION": "ALL REGISTERED MEMBERS",
      "REGISTERED COUNT": members.grand_total || 0,
      "STATUS": "CERTIFIED"
    },
  ];

  const safeDistrict = districtName.replace(/[^a-zA-Z0-9_\-]/g, "_");
  const safeYear = yearLabel.replace(/[^a-zA-Z0-9_\-]/g, "_");
  exportToExcel(
    formatted,
    `ERBSG_Census_${safeDistrict}_${safeYear}`,
    "Membership Census"
  );
}
