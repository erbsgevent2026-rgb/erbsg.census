import { db } from "../firebase";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "firebase/firestore";
import { User, AuditLogRecord } from "../types";

export interface DatabaseAuditEntry {
  userId?: string | null;
  userName?: string | null;
  bsgId?: string | null;
  role?: string | null;
  action: "CREATE" | "UPDATE" | "DELETE" | string;
  module: string;
  targetEntity: string;
  targetId?: string;
  stateId?: string;
  districtId?: string;
  districtName?: string;
  details: string;
  payloadBefore?: any;
  payloadAfter?: any;
  timestamp?: string;
}

/**
 * Recursively sanitize objects for Firestore:
 * Replaces any `undefined` values with `null` so Firestore setDoc never throws.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as unknown as T;
  }
  if (data === null || typeof data !== "object") {
    return data;
  }
  if (data instanceof Date) {
    return data.toISOString() as unknown as T;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if ((data as any)?._methodName || (data as any)?.constructor?.name === "FieldValue") {
    return data;
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      sanitized[key] = null;
    } else if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      ((value as any)?._methodName || (value as any)?.constructor?.name === "FieldValue")
    ) {
      sanitized[key] = value;
    } else {
      sanitized[key] = sanitizeForFirestore(value);
    }
  }
  return sanitized as T;
}

/**
 * Client-side Audit Interceptor service
 * Writes write operation records directly to the Firestore `audit_logs` collection.
 */
export async function logDatabaseOperation(entry: DatabaseAuditEntry): Promise<void> {
  try {
    const logCol = collection(db, "audit_logs");
    const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const sanitizedEntry = sanitizeForFirestore({
      id: logId,
      user_id: entry.userId ?? null,
      user_name: entry.userName ?? "System",
      bsg_id: entry.bsgId ?? null,
      role: entry.role ?? null,
      action: entry.action,
      module: entry.module,
      target_entity: entry.targetEntity,
      target_id: entry.targetId ?? null,
      state_id: entry.stateId ?? "state_er",
      district_id: entry.districtId ?? null,
      district_name: entry.districtName ?? null,
      details: entry.details,
      payload_after: entry.payloadAfter ? JSON.stringify(entry.payloadAfter) : null,
      timestamp: entry.timestamp || new Date().toISOString(),
      created_at: serverTimestamp()
    });
    await setDoc(doc(logCol, logId), sanitizedEntry);
  } catch (err) {
    // Audit logging is non-blocking to prevent UI friction if network is offline
    console.warn("Firestore audit interceptor warning:", err);
  }
}

/**
 * Fetch real-time audit logs from Firestore
 */
export async function getFirestoreAuditLogs(districtId?: string | null): Promise<AuditLogRecord[]> {
  try {
    const logsCol = collection(db, "audit_logs");
    let q = query(logsCol, orderBy("timestamp", "desc"), limit(100));
    if (districtId) {
      q = query(logsCol, where("district_id", "==", districtId), limit(100));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        user_id: data.user_id || null,
        user_name: data.user_name || null,
        bsg_id: data.bsg_id || null,
        role: data.role || null,
        action: data.action,
        module: data.module,
        state_id: data.state_id || null,
        district_id: data.district_id || null,
        district_name: data.district_name || null,
        details: data.details || "",
        ip_address: data.ip_address || "Client Firestore SDK",
        timestamp: data.timestamp || new Date().toISOString()
      };
    });
  } catch (err) {
    console.warn("Could not query Firestore audit logs directly:", err);
    return [];
  }
}
