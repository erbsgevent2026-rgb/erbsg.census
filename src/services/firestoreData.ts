import { db } from "../firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp
} from "firebase/firestore";
import { District, MemberCounts, User } from "../types";
import { logDatabaseOperation, sanitizeForFirestore } from "./firestoreAudit";

/**
 * Sync District list to Firestore and fetch from Firestore with database fallback
 */
export async function syncDistrictsToFirestore(districts: District[]): Promise<void> {
  try {
    for (const d of districts) {
      const sanitized = sanitizeForFirestore({
        ...d,
        syncedAt: serverTimestamp()
      });
      await setDoc(doc(db, "districts", d.id), sanitized, { merge: true });
    }
  } catch (err) {
    console.warn("Could not sync districts to Firestore:", err);
  }
}

export async function getDistrictsFromFirestore(): Promise<District[] | null> {
  try {
    const col = collection(db, "districts");
    const snap = await getDocs(col);
    if (snap.empty) return null;
    return snap.docs.map((d) => d.data() as District);
  } catch (err) {
    console.warn("Firestore getDistricts fallback:", err);
    return null;
  }
}

/**
 * Save Member Counts with Firestore persistence and automated audit log interception
 */
export async function saveMemberCountsFirestore(
  districtId: string,
  yearId: string,
  data: MemberCounts,
  currentUser: User | null
): Promise<void> {
  const docId = `mc_${districtId}_${yearId}`;
  const docRef = doc(db, "member_counts", docId);

  // Check if doc exists to determine CREATE vs UPDATE
  const existingSnap = await getDoc(docRef);
  const isCreate = !existingSnap.exists();
  const previousData = existingSnap.exists() ? existingSnap.data() : null;

  const payload = sanitizeForFirestore({
    ...data,
    district_id: districtId,
    year_id: yearId,
    updated_by: currentUser?.name || data.updated_by || "System",
    updated_at: new Date().toISOString(),
    firestoreTimestamp: serverTimestamp()
  });

  // Perform Firestore DB write
  await setDoc(docRef, payload, { merge: true });

  // Intercept write operation with Audit Logging Service
  await logDatabaseOperation({
    userId: currentUser?.id,
    userName: currentUser?.name,
    bsgId: currentUser?.bsgId,
    role: currentUser?.role,
    action: isCreate ? "CREATE" : "UPDATE",
    module: "MEMBERS",
    targetEntity: "member_counts",
    targetId: docId,
    districtId: districtId,
    details: `${isCreate ? "Created" : "Updated"} census records for ${yearId}: Total ${data.grand_total} (Youth: ${data.youth_total}, Leaders: ${data.unit_leaders_total}, Staff: ${data.professionals_total})`,
    payloadBefore: previousData,
    payloadAfter: payload,
    timestamp: new Date().toISOString()
  });
}

/**
 * Read Member Counts from Firestore
 */
export async function getMemberCountsFirestore(
  districtId: string,
  yearId: string
): Promise<MemberCounts | null> {
  try {
    const docId = `mc_${districtId}_${yearId}`;
    const snap = await getDoc(doc(db, "member_counts", docId));
    if (snap.exists()) {
      return snap.data() as MemberCounts;
    }
    return null;
  } catch (err) {
    console.warn("Could not read member counts from Firestore:", err);
    return null;
  }
}

/**
 * Update District details in Firestore with audit interception
 */
export async function updateDistrictFirestore(
  districtId: string,
  changes: Partial<District>,
  currentUser: User | null
): Promise<void> {
  const docRef = doc(db, "districts", districtId);
  const existingSnap = await getDoc(docRef);
  const previousData = existingSnap.exists() ? existingSnap.data() : null;

  const payload = sanitizeForFirestore({
    ...changes,
    updatedAt: new Date().toISOString(),
    firestoreTimestamp: serverTimestamp()
  });

  await setDoc(docRef, payload, { merge: true });

  await logDatabaseOperation({
    userId: currentUser?.id,
    userName: currentUser?.name,
    bsgId: currentUser?.bsgId,
    role: currentUser?.role,
    action: "UPDATE",
    module: "DISTRICT_MANAGEMENT",
    targetEntity: "districts",
    targetId: districtId,
    districtId: districtId,
    details: `Updated district configuration: ${Object.keys(changes).join(", ")}`,
    payloadBefore: previousData,
    payloadAfter: payload,
    timestamp: new Date().toISOString()
  });
}
