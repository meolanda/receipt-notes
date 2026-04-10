import { useState, useEffect } from "react";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";

const provider = new GoogleAuthProvider();

export interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err.code === "auth/popup-closed-by-user") return;
      if (err.code === "auth/popup-blocked") {
        toast.error("Pop-up ถูกบล็อก — กรุณาอนุญาต Pop-up แล้วลองใหม่");
        return;
      }
      toast.error("เข้าสู่ระบบไม่สำเร็จ: " + err.message);
    }
  };

  const logout = async () => {
    await signOut(auth);
    toast.info("ออกจากระบบแล้ว");
  };

  return { user, loading, signIn, logout };
}
