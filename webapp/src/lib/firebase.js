import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Three Firebase app instances are intentional:
// 1. auth/db      -> normal administrator email + password session
// 2. codeAuth/db  -> administrator dashboard-code session
// 3. provisionAuth -> creates/rotates the hidden Firebase account used by a code
//    without replacing the currently logged-in administrator/code session.
const app = initializeApp(firebaseConfig);
const codeApp = initializeApp(firebaseConfig, "safetrak-code-auth");
const provisionApp = initializeApp(firebaseConfig, "safetrak-code-provision");
// Guardian reads use a separate Firestore client with no Firebase Auth
// session attached. This prevents an old admin session from changing the
// request.auth state used by the guardian read rules.
const guardianApp = initializeApp(firebaseConfig, "safetrak-guardian");

export const auth = getAuth(app);
export const db = getFirestore(app);
export const codeAuth = getAuth(codeApp);
export const codeDb = getFirestore(codeApp);
export const provisionAuth = getAuth(provisionApp);
export const guardianDb = getFirestore(guardianApp);

export { onAuthStateChanged, signOut, createUserWithEmailAndPassword };

export async function getAdminProfileForUser(user, firestoreDb = db) {
  if (!user) return null;
  const { doc, getDoc } = await import("firebase/firestore");
  const snap = await getDoc(doc(firestoreDb, "admins", user.uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data?.role !== "Admin") return null;
  return { id: snap.id, ...data };
}

export default app;

export function makeAccessEmail(code) {
  return `access-${code.toLowerCase()}@safetrak.local`;
}

export function generateAccessCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => chars[n % chars.length]).join("");
}
