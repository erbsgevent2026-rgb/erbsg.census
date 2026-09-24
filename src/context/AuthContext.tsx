import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { User, District, AcademicYear } from "../types";
import { api, getStoredToken, setStoredToken, clearStoredToken } from "../services/api";
import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { logDatabaseOperation } from "../services/firestoreAudit";
import { syncDistrictsToFirestore, getDistrictsFromFirestore } from "../services/firestoreData";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  token: string | null;
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  availableYears: AcademicYear[];
  districts: District[];
  activeDistrictId: string;
  setActiveDistrictId: (id: string) => void;
  login: (
    identifier: string,
    pass: string,
    mfaCode?: string,
    onSuccessTransition?: () => void
  ) => Promise<{ mfaRequired?: boolean; userId?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshDistricts: () => Promise<void>;
  refreshYears: () => Promise<void>;
  syncEventTimestamp: number;
}

const CANONICAL_DISTRICTS: District[] = [
  { id: "dist_asn", state_id: "state_er", code: "ER-ASN", name: "Asansol District", bsg_id: "BSG287206516", email: "asansol@erbsg.org", phone: "", address: "", status: "ACTIVE", logo_url: null, created_at: "2026-04-01T00:00:00Z" },
  { id: "dist_cen", state_id: "state_er", code: "ER-CEN", name: "Central District", bsg_id: "BSG757134370", email: "central@erbsg.org", phone: "", address: "", status: "ACTIVE", logo_url: null, created_at: "2026-04-01T00:00:00Z" },
  { id: "dist_clw", state_id: "state_er", code: "ER-CLW", name: "CLW District", bsg_id: "BSG630263604", email: "clw@erbsg.org", phone: "", address: "", status: "ACTIVE", logo_url: null, created_at: "2026-04-01T00:00:00Z" },
  { id: "dist_hwh", state_id: "state_er", code: "ER-HWH", name: "Howrah District", bsg_id: "BSG364024329", email: "howrah@erbsg.org", phone: "", address: "", status: "ACTIVE", logo_url: null, created_at: "2026-04-01T00:00:00Z" },
  { id: "dist_jmp", state_id: "state_er", code: "ER-JMP", name: "Jamalpur District", bsg_id: "BSG904481358", email: "jamalpur@erbsg.org", phone: "", address: "", status: "ACTIVE", logo_url: null, created_at: "2026-04-01T00:00:00Z" },
  { id: "dist_kpa", state_id: "state_er", code: "ER-KPA", name: "Kanchrapara District", bsg_id: "BSG268612959", email: "kanchrapara@erbsg.org", phone: "", address: "", status: "ACTIVE", logo_url: null, created_at: "2026-04-01T00:00:00Z" },
  { id: "dist_llh", state_id: "state_er", code: "ER-LLH", name: "Liluah District", bsg_id: "BSG496357778", email: "liluah@erbsg.org", phone: "", address: "", status: "ACTIVE", logo_url: null, created_at: "2026-04-01T00:00:00Z" },
  { id: "dist_mldt", state_id: "state_er", code: "ER-MLDT", name: "Malda District", bsg_id: "BSG210344510", email: "malda@erbsg.org", phone: "", address: "", status: "ACTIVE", logo_url: null, created_at: "2026-04-01T00:00:00Z" },
  { id: "dist_sdah", state_id: "state_er", code: "ER-SDAH", name: "Sealdah District", bsg_id: "BSG406456041", email: "sealdah@erbsg.org", phone: "", address: "", status: "ACTIVE", logo_url: null, created_at: "2026-04-01T00:00:00Z" },
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedYear, setSelectedYear] = useState<string>("year_2026_2027");
  const [availableYears, setAvailableYears] = useState<AcademicYear[]>([
    { id: "year_2026_2027", label: "2026-2027", is_current: 1, status: "ACTIVE" },
  ]);
  const [districts, setDistricts] = useState<District[]>(CANONICAL_DISTRICTS);
  const [activeDistrictId, setActiveDistrictId] = useState<string>("dist_cen");
  const [syncEventTimestamp, setSyncEventTimestamp] = useState<number>(Date.now());

  const refreshUser = useCallback(async () => {
    try {
      const stored = getStoredToken();
      if (!stored) {
        setUser(null);
        setLoading(false);
        return;
      }
      const data = await api.getMe();
      setUser(data.user);
      if (data.user.role === "DISTRICT_USER" && data.user.districtId) {
        setActiveDistrictId(data.user.districtId);
      }
    } catch {
      setUser(null);
      clearStoredToken();
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshDistricts = useCallback(async () => {
    try {
      const list = await api.getDistricts();
      const uniqueDistricts = Array.isArray(list)
        ? Array.from(new Map(list.map((d) => [d.id, d])).values())
        : [];
      if (uniqueDistricts.length > 0) {
        const sorted = [...uniqueDistricts].sort((a, b) => a.name.localeCompare(b.name));
        setDistricts(sorted);
        syncDistrictsToFirestore(sorted).catch(() => {});
        if (!user?.districtId) {
          setActiveDistrictId((prev) => (sorted.some((d) => d.id === prev) ? prev : sorted[0].id));
        }
      }
    } catch (e) {
      try {
        const firestoreList = await getDistrictsFromFirestore();
        if (firestoreList && firestoreList.length > 0) {
          const unique = Array.from(new Map(firestoreList.map((d) => [d.id, d])).values());
          const sorted = [...unique].sort((a, b) => a.name.localeCompare(b.name));
          setDistricts(sorted);
          if (!user?.districtId) {
            setActiveDistrictId((prev) => (sorted.some((d) => d.id === prev) ? prev : sorted[0].id));
          }
        } else {
          setDistricts(CANONICAL_DISTRICTS);
        }
      } catch {
        setDistricts(CANONICAL_DISTRICTS);
      }
    }
  }, [user]);

  const refreshYears = useCallback(async () => {
    try {
      const list = await api.getYears();
      if (Array.isArray(list) && list.length > 0) {
        setAvailableYears(list);
        const curr = list.find((y) => y.is_current === 1);
        if (curr) setSelectedYear(curr.id);
      }
    } catch {
      // Fallback already populated in initial state
    }
  }, []);

  useEffect(() => {
    refreshUser();
    refreshYears();
  }, [refreshUser, refreshYears]);

  useEffect(() => {
    if (user && !user.mustChangePassword) {
      refreshDistricts();
    }
  }, [user, refreshDistricts]);

  // Handle live Server-Sent Events (SSE) for Real-Time synchronization
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/sync/events");
      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type !== "CONNECTED") {
            setSyncEventTimestamp(Date.now());
          }
        } catch {
          // Ignore
        }
      };
      eventSource.onerror = () => {
        // SSE disconnected, will retry automatically
      };
    } catch {
      // Ignore
    }

    const onAuthExpired = () => {
      setUser(null);
      setToken(null);
    };
    window.addEventListener("erbsg_auth_expired", onAuthExpired);

    return () => {
      if (eventSource) eventSource.close();
      window.removeEventListener("erbsg_auth_expired", onAuthExpired);
    };
  }, []);

  const login = async (
    identifier: string,
    pass: string,
    mfaCode?: string,
    onSuccessTransition?: () => void
  ) => {
    const res = await api.login(identifier, pass, mfaCode);
    if (res.mfaRequired) {
      return { mfaRequired: true, userId: res.userId };
    }
    if (res.token && res.user) {
      setStoredToken(res.token);
      setToken(res.token);
      if (onSuccessTransition) {
        onSuccessTransition();
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      setUser(res.user);
      if (res.user.role === "DISTRICT_USER" && res.user.districtId) {
        setActiveDistrictId(res.user.districtId);
      }
      // Audit log the successful login into Firestore
      logDatabaseOperation({
        userId: res.user.id,
        userName: res.user.name,
        bsgId: res.user.bsgId,
        role: res.user.role,
        action: "LOGIN_SUCCESS",
        module: "AUTHENTICATION",
        targetEntity: "users",
        targetId: res.user.id,
        districtId: res.user.districtId || undefined,
        details: `User ${res.user.name} (${res.user.bsgId}) authenticated successfully`,
        timestamp: new Date().toISOString()
      }).catch(() => {});
    }
    return {};
  };

  const logout = () => {
    if (user) {
      logDatabaseOperation({
        userId: user.id,
        userName: user.name,
        bsgId: user.bsgId,
        role: user.role,
        action: "LOGOUT",
        module: "AUTHENTICATION",
        targetEntity: "users",
        targetId: user.id,
        districtId: user.districtId || undefined,
        details: `User ${user.name} logged out from the portal`,
        timestamp: new Date().toISOString()
      }).catch(() => {});
    }
    clearStoredToken();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        token,
        selectedYear,
        setSelectedYear,
        availableYears,
        districts,
        activeDistrictId,
        setActiveDistrictId,
        login,
        logout,
        refreshUser,
        refreshDistricts,
        refreshYears,
        syncEventTimestamp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
