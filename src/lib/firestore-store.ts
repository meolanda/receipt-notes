/**
 * firestore-store.ts
 * Async Firestore CRUD — แทนที่ localStorage ใน receipt-store.ts
 * โครงสร้าง: users/{uid}/receipts/{receiptId}
 */
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  query, orderBy, getDocs, writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Receipt, Profile } from "./receipt-store";
import { isDuplicateReceipt } from "./receipt-store";

// ────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────

function receiptsCol(uid: string) {
  return collection(db, "users", uid, "receipts");
}

function receiptRef(uid: string, id: string) {
  return doc(db, "users", uid, "receipts", id);
}

/** ลบ imageData (base64 ใหญ่เกิน 1MB) ออกก่อนบันทึก Firestore */
function stripBase64(data: object): object {
  const { imageData, ...rest } = data as Record<string, unknown>;
  return rest;
}

// ────────────────────────────────────────────────────────────
// CRUD
// ────────────────────────────────────────────────────────────

export async function saveReceiptFS(
  uid: string,
  receipt: Omit<Receipt, "id" | "createdAt">
): Promise<Receipt> {
  const data = {
    ...stripBase64(receipt),
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(receiptsCol(uid), data);
  return { ...data, id: ref.id } as Receipt;
}

export async function updateReceiptFS(
  uid: string,
  id: string,
  data: Partial<Omit<Receipt, "id" | "createdAt">>
): Promise<void> {
  await updateDoc(receiptRef(uid, id), stripBase64(data) as object);
}

export async function deleteReceiptFS(uid: string, id: string): Promise<void> {
  await deleteDoc(receiptRef(uid, id));
}

export async function deleteReceiptsByIds(uid: string, ids: string[]): Promise<number> {
  let count = 0;
  for (const id of ids) {
    try { await deleteDoc(receiptRef(uid, id)); count++; } catch {}
  }
  return count;
}

export async function getAllReceiptsFS(uid: string): Promise<Receipt[]> {
  const q = query(receiptsCol(uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as Receipt));
}

// ────────────────────────────────────────────────────────────
// Migration จาก localStorage → Firestore (ทำแค่ครั้งเดียว)
// ────────────────────────────────────────────────────────────

const MIGRATED_KEY = "fb-migrated-v1";

export async function migrateLocalStorageToFirestore(uid: string): Promise<number> {
  if (localStorage.getItem(MIGRATED_KEY) === uid) return 0; // ทำแล้ว

  const raw = localStorage.getItem("receipt-tracker-data");
  if (!raw) {
    localStorage.setItem(MIGRATED_KEY, uid);
    return 0;
  }

  let local: Receipt[] = [];
  try {
    local = JSON.parse(raw);
  } catch {
    return 0;
  }
  if (local.length === 0) {
    localStorage.setItem(MIGRATED_KEY, uid);
    return 0;
  }

  // ดึงรายการที่มีอยู่แล้วใน Firestore ก่อน (ป้องกันซ้ำถ้า migrate ครึ่งทาง)
  const existing = await getAllReceiptsFS(uid);

  // เรียงจากเก่าสุด → ใหม่สุด
  const sorted = [...local].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  let count = 0;
  const CHUNK = 400; // writeBatch รับ max 500 ops

  for (let i = 0; i < sorted.length; i += CHUNK) {
    const chunk = sorted.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    for (const r of chunk) {
      // ข้ามถ้าซ้ำกับ Firestore แล้ว
      if (isDuplicateReceipt(
        { date: r.date, grandTotal: r.grandTotal, storeName: r.storeName, profile: r.profile },
        existing
      )) continue;

      const { id, imageData, ...rest } = r;
      const ref = doc(db, "users", uid, "receipts", id);
      batch.set(ref, rest);
      count++;
    }
    await batch.commit();
  }

  localStorage.setItem(MIGRATED_KEY, uid);
  return count;
}

// ────────────────────────────────────────────────────────────
// Dedup ใน Firestore (ลบซ้ำตาม date+grandTotal)
// ────────────────────────────────────────────────────────────

export async function deduplicateFirestore(
  uid: string
): Promise<{ found: number; deleted: number }> {
  const all = await getAllReceiptsFS(uid);
  // เรียงเก่า→ใหม่ เก็บอันเก่า ลบอันใหม่
  const sorted = [...all].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const kept: Receipt[] = [];
  const toDelete: string[] = [];
  for (const r of sorted) {
    if (isDuplicateReceipt(
      { date: r.date, grandTotal: r.grandTotal, storeName: r.storeName, profile: r.profile as Profile },
      kept
    )) {
      toDelete.push(r.id);
    } else {
      kept.push(r);
    }
  }

  for (let i = 0; i < toDelete.length; i += 400) {
    const batch = writeBatch(db);
    toDelete.slice(i, i + 400).forEach((id) => batch.delete(receiptRef(uid, id)));
    await batch.commit();
  }

  return { found: toDelete.length, deleted: toDelete.length };
}
