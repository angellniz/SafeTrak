import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import { guardianDb } from "./firebase";

export function cleanPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

export function normalizeCardId(value) {
  return String(value || "").trim().toUpperCase();
}

export async function verifyGuardian(cardId, phone) {
  const normalizedCardId = normalizeCardId(cardId);
  const normalizedPhone = cleanPhone(phone);

  if (!normalizedCardId) throw new Error("Enter the SafeTrak card ID.");
  if (!normalizedPhone) throw new Error("Enter the guardian phone number.");

  const snap = await getDoc(doc(guardianDb, "students", normalizedCardId));
  if (!snap.exists()) throw new Error("No SafeTrak card was found with that ID.");

  const student = { id: snap.id, ...snap.data() };
  const storedPhone = cleanPhone(student.guardian_phone_clean || student.guardian_phone);

  if (!storedPhone || storedPhone !== normalizedPhone) {
    throw new Error("The card ID and guardian phone number do not match.");
  }

  return student;
}

export function saveGuardianSession(student, phone, remember = false) {
  const value = JSON.stringify({
    cardId: student.id,
    phone: cleanPhone(phone),
    name: student.name || "",
    savedAt: Date.now(),
  });
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem("safetrak_guardian_session", value);
  if (remember) sessionStorage.removeItem("safetrak_guardian_session");
  else localStorage.removeItem("safetrak_guardian_session");
}

export function getGuardianSession() {
  for (const storage of [sessionStorage, localStorage]) {
    const raw = storage.getItem("safetrak_guardian_session");
    if (!raw) continue;
    try {
      const session = JSON.parse(raw);
      if (session?.cardId && session?.phone) return session;
    } catch {
      storage.removeItem("safetrak_guardian_session");
    }
  }
  return null;
}

export function clearGuardianSession() {
  sessionStorage.removeItem("safetrak_guardian_session");
  localStorage.removeItem("safetrak_guardian_session");
}

export function watchStudent(cardId, callback, onError) {
  return onSnapshot(doc(guardianDb, "students", normalizeCardId(cardId)), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  }, onError);
}

export function watchLocation(cardId, callback, onError) {
  return onSnapshot(doc(guardianDb, "locations", normalizeCardId(cardId)), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  }, onError);
}

/**
 * Loads the history stored under the existing student document:
 * students/{cardId}/logs/{logId}
 *
 * We deliberately do not use orderBy() here. That keeps the guardian app
 * from requiring a composite Firestore index and lets the app work with the
 * log documents already present in the database.
 */
export async function loadGuardianLogs(cardId) {
  const normalizedCardId = normalizeCardId(cardId);
  const snap = await getDocs(collection(guardianDb, "students", normalizedCardId, "logs"));

  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => timestampValue(b.timestamp) - timestampValue(a.timestamp));
}

/**
 * Backward-compatible fallback for older data that may still be in alerts.
 */
export async function loadGuardianAlerts(cardId) {
  const snap = await getDocs(query(
    collection(guardianDb, "alerts"),
    where("student_id", "==", normalizeCardId(cardId))
  ));

  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => timestampValue(b.timestamp) - timestampValue(a.timestamp));
}

export async function loadGuardianHistory(cardId) {
  const logs = await loadGuardianLogs(cardId);
  if (logs.length) return logs.map((item) => ({ ...item, source: "logs" }));

  const alerts = await loadGuardianAlerts(cardId);
  return alerts.map((item) => ({ ...item, source: "alerts" }));
}

export function timestampValue(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value?.seconds != null) return Number(value.seconds) * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1e6);
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDateTime(value) {
  const time = timestampValue(value);
  if (!time) return "Not available";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
}

export function formatDate(value) {
  const time = timestampValue(value);
  if (!time) return "Unknown date";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(time));
}
