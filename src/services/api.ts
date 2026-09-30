import {
  User,
  District,
  AcademicYear,
  MemberCounts,
  UnitDetails,
  OfficialContact,
  StatutoryDocument,
  OfficialMember,
  DistrictUserRecord,
  AuditLogRecord,
  EmailLogRecord,
  DeadlineRecord,
  CensusConfirmation,
  SupportTicket
} from "../types";

const TOKEN_KEY = "erbsg_auth_token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const isGetOrSafe = !options.method || options.method.toUpperCase() === "GET";
  const maxAttempts = isGetOrSafe ? 3 : 1;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`/api${endpoint}`, {
        ...options,
        headers,
      });

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        throw new Error(`API endpoint /api${endpoint} returned HTML instead of JSON`);
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          // Session expired or invalid
          if (token) {
            clearStoredToken();
            window.dispatchEvent(new CustomEvent("erbsg_auth_expired"));
          }
        }
        if (response.status === 503 && data.maintenanceMode) {
          window.dispatchEvent(new CustomEvent("erbsg_maintenance_mode", { detail: data }));
        }
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      return data as T;
    } catch (err: any) {
      lastError = err;
      // Do not retry 4xx errors, or non-GET mutations unless network failure
      const isNetworkError =
        err?.name === "TypeError" ||
        err?.message?.includes("Failed to fetch") ||
        err?.message?.includes("NetworkError") ||
        err?.message?.includes("Load failed");

      if (!isNetworkError || attempt === maxAttempts) {
        throw err;
      }

      // Exponential backoff before retry (250ms, 600ms)
      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }

  throw lastError;
}

export const api = {
  // Auth
  login: (identifier: string, password: string, mfaCode?: string) =>
    request<{ token?: string; user?: User; mfaRequired?: boolean; userId?: string; message?: string }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ identifier, password, mfaCode }) }
    ),

  getMe: () => request<{ user: User }>("/auth/me"),

  changePassword: (payload: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    request<{ message: string; token: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  forgotPassword: (identifier: string) =>
    request<{ success: boolean; message: string; email?: string; bsgId?: string; resetLink?: string; token?: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ identifier })
    }),

  resetPasswordWithToken: (payload: { token: string; newPassword: string }) =>
    request<{ success: boolean; message: string; bsgId?: string }>("/auth/reset-password-with-token", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  toggleMfa: () =>
    request<{ mfaEnabled: boolean; mfaSecret?: string; message: string }>("/auth/toggle-mfa", {
      method: "POST"
    }),

  // State
  getStateDetails: () => request<any>("/state"),
  updateStateDetails: (payload: any) => request<{ message: string }>("/state", { method: "PUT", body: JSON.stringify(payload) }),

  // Districts
  getDistricts: () => request<District[]>("/districts"),
  getDistrict: (id: string) => request<District>(`/districts/${id}`),
  createDistrict: (payload: any) => request<{ message: string; id: string }>("/districts", { method: "POST", body: JSON.stringify(payload) }),
  updateDistrict: (id: string, payload: any) => request<{ message: string }>(`/districts/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  updateDistrictStatus: (id: string, status: string) => request<{ message: string }>(`/districts/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),

  // District Users (State Admin)
  getDistrictUsers: () => request<DistrictUserRecord[]>("/district-users"),
  createDistrictUser: (payload: any) => request<{ message: string }>("/district-users", { method: "POST", body: JSON.stringify(payload) }),
  resetDistrictPassword: (id: string) => request<{ message: string; temporaryPassword?: string }>(`/district-users/${id}/reset-password`, { method: "POST" }),
  forcePasswordChange: (id: string) => request<{ message: string }>(`/district-users/${id}/force-password-change`, { method: "POST" }),
  toggleUserStatus: (id: string) => request<{ message: string }>(`/district-users/${id}/toggle-status`, { method: "POST" }),

  // Dashboard Stats
  getDashboardStats: (yearId: string) => request<any>(`/dashboard/stats?year_id=${encodeURIComponent(yearId)}`),

  // Members
  getMembers: (districtId: string, yearId: string) =>
    request<{ data: MemberCounts; deadline: DeadlineRecord; confirmation?: CensusConfirmation }>(`/members?district_id=${encodeURIComponent(districtId)}&year_id=${encodeURIComponent(yearId)}`),
  saveMembers: (districtId: string, yearId: string, categories: any) =>
    request<{ message: string; totals: any }>("/members", {
      method: "PUT",
      body: JSON.stringify({ district_id: districtId, year_id: yearId, categories })
    }),

  // Census Confirmation & Locking
  getCensusConfirmation: (districtId: string, yearId: string) =>
    request<CensusConfirmation>(`/census-confirmation?district_id=${encodeURIComponent(districtId)}&year_id=${encodeURIComponent(yearId)}`),
  confirmCensus: (districtId: string, yearId: string) =>
    request<{ success: boolean; message: string; confirmation: CensusConfirmation }>("/census-confirmation", {
      method: "POST",
      body: JSON.stringify({ district_id: districtId, year_id: yearId })
    }),
  unlockCensus: (districtId: string, yearId: string) =>
    request<{ success: boolean; message: string }>("/census-confirmation/unlock", {
      method: "POST",
      body: JSON.stringify({ district_id: districtId, year_id: yearId })
    }),

  // Unit Details
  getUnitDetails: (districtId: string, yearId: string) =>
    request<{ data: UnitDetails; confirmation?: CensusConfirmation }>(`/unit-details?district_id=${encodeURIComponent(districtId)}&year_id=${encodeURIComponent(yearId)}`),
  saveUnitDetails: (districtId: string, yearId: string, units: Partial<UnitDetails>) =>
    request<{ message: string }>("/unit-details", {
      method: "PUT",
      body: JSON.stringify({ district_id: districtId, year_id: yearId, units })
    }),

  // Official Contacts
  getOfficialContacts: (districtId: string, yearId: string) =>
    request<OfficialContact[]>(`/official-contacts?district_id=${encodeURIComponent(districtId)}&year_id=${encodeURIComponent(yearId)}`),
  saveOfficialContacts: (districtId: string, yearId: string, contacts: any[]) =>
    request<{ message: string }>("/official-contacts", {
      method: "POST",
      body: JSON.stringify({ district_id: districtId, year_id: yearId, contacts })
    }),
  saveSingleOfficialContact: (districtId: string, yearId: string, contact: any) =>
    request<{ message: string }>("/official-contacts", {
      method: "POST",
      body: JSON.stringify({ district_id: districtId, year_id: yearId, contact })
    }),
  deleteOfficialContact: (id: string, districtId?: string) =>
    request<{ message: string }>(`/official-contacts/${encodeURIComponent(id)}${districtId ? `?district_id=${encodeURIComponent(districtId)}` : ""}`, {
      method: "DELETE"
    }),

  // Annual Reports
  getAnnualReports: (yearId?: string, districtId?: string) => {
    const params = new URLSearchParams();
    if (yearId) params.append("year_id", yearId);
    if (districtId) params.append("district_id", districtId);
    return request<StatutoryDocument[]>(`/annual-reports?${params.toString()}`);
  },
  uploadAnnualReport: (payload: { district_id: string; year_id: string; file_name: string; file_size: number; file_data: string }) =>
    request<{ message: string; id: string; version: number }>("/annual-reports", { method: "POST", body: JSON.stringify(payload) }),
  deleteAnnualReport: (id: string) => request<{ message: string }>(`/annual-reports/${id}`, { method: "DELETE" }),
  getAnnualReportFile: (id: string) => request<StatutoryDocument>(`/annual-reports/${id}`),

  // Census Reports
  getCensusReports: (yearId?: string, districtId?: string) => {
    const params = new URLSearchParams();
    if (yearId) params.append("year_id", yearId);
    if (districtId) params.append("district_id", districtId);
    return request<StatutoryDocument[]>(`/census-reports?${params.toString()}`);
  },
  uploadCensusReport: (payload: { district_id: string; year_id: string; file_name: string; file_size: number; file_data: string }) =>
    request<{ message: string; id: string; version: number }>("/census-reports", { method: "POST", body: JSON.stringify(payload) }),
  deleteCensusReport: (id: string) => request<{ message: string }>(`/census-reports/${id}`, { method: "DELETE" }),
  getCensusReportFile: (id: string) => request<StatutoryDocument>(`/census-reports/${id}`),

  // Audited Statements
  getAuditedStatements: (yearId?: string, districtId?: string) => {
    const params = new URLSearchParams();
    if (yearId) params.append("year_id", yearId);
    if (districtId) params.append("district_id", districtId);
    return request<StatutoryDocument[]>(`/audited-statements?${params.toString()}`);
  },
  uploadAuditedStatement: (payload: { district_id: string; year_id: string; file_name: string; file_size: number; file_data: string }) =>
    request<{ message: string; id: string; version: number }>("/audited-statements", { method: "POST", body: JSON.stringify(payload) }),
  deleteAuditedStatement: (id: string) => request<{ message: string }>(`/audited-statements/${id}`, { method: "DELETE" }),
  getAuditedStatementFile: (id: string) => request<StatutoryDocument>(`/audited-statements/${id}`),

  // State and District Officials
  getStateMembers: (yearId: string) => request<OfficialMember[]>(`/state-members?year_id=${encodeURIComponent(yearId)}`),
  addStateMember: (payload: any) => request<{ message: string }>("/state-members", { method: "POST", body: JSON.stringify(payload) }),
  deleteStateMember: (id: string) => request<{ message: string }>(`/state-members/${id}`, { method: "DELETE" }),

  getDistrictMembers: (districtId: string, yearId: string) =>
    request<OfficialMember[]>(`/district-members?district_id=${encodeURIComponent(districtId)}&year_id=${encodeURIComponent(yearId)}`),
  addDistrictMember: (payload: any) => request<{ message: string }>("/district-members", { method: "POST", body: JSON.stringify(payload) }),
  deleteDistrictMember: (id: string) => request<{ message: string }>(`/district-members/${id}`, { method: "DELETE" }),

  // Years & Deadlines
  getYears: () => request<AcademicYear[]>("/years"),
  createSessionYear: (payload: { label: string; set_as_current?: boolean }) =>
    request<{ success: boolean; message: string; year: AcademicYear }>("/years", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  setActiveSessionYear: (yearId: string) =>
    request<{ success: boolean; message: string }>(`/years/${encodeURIComponent(yearId)}/set-current`, {
      method: "PUT"
    }),
  getSessionsSummary: () =>
    request<any[]>("/sessions/summary"),
  getDeadlines: () => request<DeadlineRecord[]>("/deadlines"),
  updateDeadline: (payload: any) => request<{ message: string }>("/deadlines", { method: "PUT", body: JSON.stringify(payload) }),

  // Audit Logs & Emails
  getAuditLogs: () => request<AuditLogRecord[]>("/audit-logs"),
  getEmailLogs: () => request<EmailLogRecord[]>("/email-logs"),

  // System Settings & Maintenance Mode
  getMaintenanceStatus: () =>
    request<{ maintenanceMode: boolean; message: string; updatedAt: string; updatedBy: string }>(
      "/system/maintenance"
    ),
  setMaintenanceMode: (enabled: boolean, message?: string) =>
    request<{ success: boolean; maintenanceMode: boolean; message: string; updatedAt: string; updatedBy: string }>(
      "/system/maintenance",
      { method: "POST", body: JSON.stringify({ enabled, message }) }
    ),

  // Support & Feedback System
  getSupportTickets: (params?: { district_id?: string; status?: string; search?: string }) => {
    const sp = new URLSearchParams();
    if (params?.district_id && params.district_id !== "ALL") sp.append("district_id", params.district_id);
    if (params?.status && params.status !== "ALL") sp.append("status", params.status);
    if (params?.search) sp.append("search", params.search);
    const qs = sp.toString() ? `?${sp.toString()}` : "";
    return request<SupportTicket[]>(`/support${qs}`);
  },
  getSupportTicket: (id: string) => request<SupportTicket>(`/support/${encodeURIComponent(id)}`),
  submitSupportTicket: (payload: {
    category: string;
    priority: string;
    subject: string;
    message: string;
    district_id?: string;
  }) =>
    request<{ success: boolean; message: string; ticket: SupportTicket }>("/support", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateSupportTicket: (id: string, payload: { status: string; admin_reply?: string }) =>
    request<{ success: boolean; message: string; ticket: SupportTicket }>(`/support/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
};
