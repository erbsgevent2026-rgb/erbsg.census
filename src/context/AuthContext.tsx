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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedYear, setSelectedYear] = useState<string>("year_2026_2027");
  const [availableYears, setAvailableYears] = useState<AcademicYear[]>([
    { id: "year_2026_2027", label: "2026-2027", is_current: 1, status: "ACTIVE" },
  ]);
  const [districts, setDistricts] = useState<District[]>([]);
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
      const sorted = Array.isArray(list) ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : [];
      setDistricts(sorted);
      // Synchronize districts into Firestore in background
      if (sorted.length > 0) {
        syncDistrictsToFirestore(sorted).catch(() => {});
      }
      if (sorted.length > 0 && !user?.districtId) {
        setActiveDistrictId(sorted[0].id);
      }
    } catch (e) {
      console.error("Failed to load districts from API, attempting Firestore fallback:", e);
      try {
        const firestoreList = await getDistrictsFromFirestore();
        if (firestoreList && firestoreList.length > 0) {
          const sorted = [...firestoreList].sort((a, b) => a.name.localeCompare(b.name));
          setDistricts(sorted);
          if (!user?.districtId) {
            setActiveDistrictId(sorted[0].id);
          }
        }
      } catch (err) {
        console.error("Firestore fallback error:", err);
      }
    }
  }, [user]);

  const refreshYears = useCallback(async () => {
    try {
      const list = await api.getYears();
      if (list && list.length > 0) {
        setAvailableYears(list);
        const curr = list.find((y) => y.is_current === 1);
        if (curr) setSelectedYear(curr.id);
      }
    } catch (e) {
      console.error("Failed to load academic years:", e);
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
