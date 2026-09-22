import {
  User,
  District,
  AcademicYear,
  MemberCounts,
  OfficialContact,
  StatutoryDocument,
  OfficialMember,
  DistrictUserRecord,
  AuditLogRecord,
  EmailLogRecord,
  DeadlineRecord
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

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      // Session expired or invalid
      if (token) {
        clearStoredToken();
        window.dispatchEvent(new CustomEvent("erbsg_auth_expired"));
      }
    }
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
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
    request<{ data: MemberCounts; deadline: DeadlineRecord }>(`/members?district_id=${encodeURIComponent(districtId)}&year_id=${encodeURIComponent(yearId)}`),
  saveMembers: (districtId: string, yearId: string, categories: any) =>
    request<{ message: string; totals: any }>("/members", {
      method: "PUT",
      body: JSON.stringify({ district_id: districtId, year_id: yearId, categories })
    }),

  // Official Contacts
  getOfficialContacts: (districtId: string, yearId: string) =>
    request<OfficialContact[]>(`/official-contacts?district_id=${encodeURIComponent(districtId)}&year_id=${encodeURIComponent(yearId)}`),
  saveOfficialContacts: (districtId: string, yearId: string, contacts: any[]) =>
    request<{ message: string }>("/official-contacts", {
      method: "POST",
      body: JSON.stringify({ district_id: districtId, year_id: yearId, contacts })
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
  addYear: (label: string) => request<{ message: string }>("/years", { method: "POST", body: JSON.stringify({ label }) }),
  getDeadlines: () => request<DeadlineRecord[]>("/deadlines"),
  updateDeadline: (payload: any) => request<{ message: string }>("/deadlines", { method: "PUT", body: JSON.stringify(payload) }),

  // Audit Logs & Emails
  getAuditLogs: () => request<AuditLogRecord[]>("/audit-logs"),
  getEmailLogs: () => request<EmailLogRecord[]>("/email-logs"),
};
