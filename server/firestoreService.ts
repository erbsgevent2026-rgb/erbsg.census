import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Firestore
} from "firebase/firestore";
import fs from "fs";
import path from "path";

let dbInstance: Firestore | null = null;

export function getFirestoreDb(): Firestore | null {
  if (dbInstance) return dbInstance;
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (!fs.existsSync(configPath)) {
      console.warn("firebase-applet-config.json not found on server.");
      return null;
    }
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const firebaseConfig = {
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    };

    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    dbInstance = config.firestoreDatabaseId
      ? getFirestore(app, config.firestoreDatabaseId)
      : getFirestore(app);

    console.log("Firestore successfully initialized on server.");
    return dbInstance;
  } catch (err) {
    console.error("Failed to initialize server-side Firestore:", err);
    return null;
  }
}

/**
 * Recursively sanitize objects for Firestore:
 * - Replaces any `undefined` values with `null`
 * - Converts dates/special objects safely
 * - Preserves Firestore FieldValue tokens (like serverTimestamp())
 * - Ensures Firestore setDoc/updateDoc never throws "Unsupported field value: undefined"
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
  // Check if it's a Firestore FieldValue token
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
 * Mirror audit log write directly to Firestore `audit_logs` collection
 */
export async function mirrorAuditLogToFirestore(logData: {
  id: string;
  userId?: string | null;
  userName?: string | null;
  bsgId?: string | null;
  role?: string | null;
  action: string;
  module: string;
  stateId?: string | null;
  districtId?: string | null;
  districtName?: string | null;
  targetEntity?: string | null;
  targetId?: string | null;
  details: string;
  ipAddress?: string | null;
  timestamp?: string;
}): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    const logDocRef = doc(db, "audit_logs", logData.id);
    const sanitizedLog = sanitizeForFirestore({
      id: logData.id,
      userId: logData.userId ?? null,
      userName: logData.userName ?? null,
      bsgId: logData.bsgId ?? null,
      role: logData.role ?? null,
      action: logData.action,
      module: logData.module,
      stateId: logData.stateId ?? "state_er",
      districtId: logData.districtId ?? null,
      districtName: logData.districtName ?? null,
      targetEntity: logData.targetEntity ?? null,
      targetId: logData.targetId ?? null,
      details: logData.details,
      ipAddress: logData.ipAddress ?? null,
      createdAt: logData.timestamp || new Date().toISOString(),
      firestoreTimestamp: serverTimestamp()
    });
    await setDoc(logDocRef, sanitizedLog, { merge: true });
  } catch (err) {
    // Non-blocking fallback
    console.warn("Firestore audit log mirror notice:", err);
  }
}

/**
 * Sync entity write (create, update, delete) to Firestore
 */
export async function syncEntityToFirestore(
  collectionName: string,
  docId: string,
  operation: "CREATE" | "UPDATE" | "DELETE",
  data?: any
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    const docRef = doc(db, collectionName, docId);
    if (operation === "DELETE") {
      await deleteDoc(docRef);
    } else {
      const sanitizedData = sanitizeForFirestore({
        ...(data || {}),
        updatedAt: new Date().toISOString()
      });
      await setDoc(docRef, sanitizedData, { merge: true });
    }
  } catch (err) {
    console.warn(`Firestore sync warning for ${collectionName}/${docId}:`, err);
  }
}
