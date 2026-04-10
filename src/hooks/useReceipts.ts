/**
 * useReceipts.ts
 * Real-time Firestore listener สำหรับดึงใบเสร็จของ user
 * ใช้ onSnapshot → update state อัตโนมัติเมื่อข้อมูลเปลี่ยน
 */
import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Receipt } from "@/lib/receipt-store";

export function useReceipts(uid: string | null) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setReceipts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, "users", uid, "receipts"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Receipt));
        setReceipts(data);
        setLoading(false);
      },
      (err) => {
        console.error("[useReceipts] snapshot error:", err);
        setLoading(false);
      }
    );

    return unsub;
  }, [uid]);

  return { receipts, loading };
}
