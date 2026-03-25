import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../api/firebaseAuth";
import {
  syncUserWithFirestore,
  getUserRole,
} from "../api/userService";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        await syncUserWithFirestore(firebaseUser);

        const role = await getUserRole(firebaseUser.uid);

        if (!role) {
          throw new Error("Usuário sem role definido");
        }

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role,
        });
      } catch (err) {
        console.error("Erro AuthContext:", err);
        setUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
