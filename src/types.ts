export type UserRole = "STATE_ADMIN" | "DISTRICT_USER";

export interface User {
  id: string;
  bsgId: string;
  email: string;
  name: string;
  role: UserRole;
  stateId: string;
  districtId: string | null;
  districtName: string | null;
  mustChangePassword: boolean;
  mfaEnabled?: boolean;
}

export interface District {
  id: string;
  state_id: string;
  name: string;
  code: string;
  bsg_id: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  established_year?: number;
  registration_no?: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  logo_url: string | null;
  created_at: string;
}

export interface AcademicYear {
  id: string;
  label: string;
  is_current: number;
  status: string;
}

export interface MemberCounts {
  id?: string;
  state_id?: string;
  district_id: string;
  year_id: string;
  // Youth
  bunnies?: number;
  bunny_aunties?: number;
  bulbul: number;
  guide: number;
  ranger: number;
  scout: number;
  rover: number;
  cub: number;
  // Leadership (Unit Leaders)
  flock_leaders: number;
  guide_captains: number;
  ranger_leaders: number;
  cub_masters: number;
  lady_cub_masters: number;
  scout_masters?: number;
  rover_scout_leaders?: number;
  // Professionals
  professional_guides: number;
  voluntary_commissioners: number;
  support_staff: number;
  professionals_staff: number;
  // Totals
  youth_total: number;
  unit_leaders_total: number;
  professionals_total: number;
  grand_total: number;
  updated_by?: string;
  updated_at?: string;
}

export interface OfficialContact {
  id: string;
  state_id: string;
  district_id: string;
  year_id: string;
  name: string;
  railway_designation?: string;
  scouting_rank?: string;
  bsg_id?: string;
  designation?: string;
  bsg_uid?: string;
  email: string | null;
  phone: string | null;
  is_selected: number;
  created_at?: string;
}

export interface StatutoryDocument {
  id: string;
  state_id: string;
  district_id: string;
  district_name?: string;
  year_id: string;
  file_name: string;
  file_size: number;
  file_data?: string;
  version: number;
  uploaded_by: string;
  uploaded_at: string;
  status: string;
}

export interface OfficialMember {
  id: string;
  state_id: string;
  district_id?: string;
  year_id: string;
  name: string;
  bsg_uid: string;
  designation: string;
  email: string | null;
  phone: string | null;
  created_at?: string;
}

export interface DistrictUserRecord {
  id: string;
  bsg_id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  district_id: string;
  district_name: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  must_change_password: number;
  password_changed_at: string | null;
  last_login: string | null;
  created_at: string;
}

export interface AuditLogRecord {
  id: string;
  user_id: string | null;
  user_name: string | null;
  bsg_id: string | null;
  role: string | null;
  action: string;
  module: string;
  state_id: string | null;
  district_id: string | null;
  district_name: string | null;
  details: string;
  ip_address: string | null;
  timestamp: string;
}

export interface EmailLogRecord {
  id: string;
  recipient_email: string;
  recipient_name: string;
  bsg_id: string;
  subject: string;
  body: string;
  type: string;
  status: string;
  created_at: string;
}

export interface DeadlineRecord {
  id: string;
  year_id: string;
  deadline_date: string;
  status: "OPEN" | "UPCOMING" | "EXPIRED";
  notes: string | null;
}
