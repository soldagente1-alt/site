import { db } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Garante que o usuário exista no Firestore
 * e aplica fallback de role para usuários antigos
 */
export async function syncUserWithFirestore(firebaseUser, roleFromFlow) {
  const ref = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(ref);

  // 👉 USUÁRIO JÁ EXISTE
  if (snap.exists()) {
    const data = snap.data();

    // 🔁 fallback automático
    if (!data.role) {
      const fallbackRole = data.user_type || roleFromFlow || "family";

      await updateDoc(ref, {
        role: fallbackRole,
        user_type: fallbackRole,
      });

      return { ...data, role: fallbackRole };
    }

    return data;
  }

  // 👉 NOVO USUÁRIO
  const role = roleFromFlow || "family";

  const newUser = {
    uid: firebaseUser.uid,
    full_name: firebaseUser.displayName || "Usuário",
    email: firebaseUser.email.toLowerCase(),

    // 🔑 CONTROLE DE ACESSO
    role,
    user_type: role,

    status: "active",
    created_at: serverTimestamp(),
    last_login_at: serverTimestamp(),
  };

  await setDoc(ref, newUser);
  return newUser;
}

/**
 * Retorna o role do usuário
 */
export async function getUserRole(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const data = snap.data();
  return data.role || data.user_type || "family";
}
