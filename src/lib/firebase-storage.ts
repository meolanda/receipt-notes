/**
 * firebase-storage.ts
 * อัปโหลด/ลบรูปใบเสร็จจาก Firebase Storage
 * path: users/{uid}/receipts/{receiptId}.jpg
 */
import {
  ref,
  uploadString,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "./firebase";

/**
 * อัปโหลดรูป base64 dataURL → Firebase Storage
 * คืนค่า download URL ที่ใช้แสดงรูปได้
 */
export async function uploadReceiptImage(
  uid: string,
  receiptId: string,
  base64DataUrl: string
): Promise<string> {
  const storageRef = ref(storage, `users/${uid}/receipts/${receiptId}.jpg`);
  await uploadString(storageRef, base64DataUrl, "data_url");
  return await getDownloadURL(storageRef);
}

/**
 * ลบรูปจาก Firebase Storage (ไม่ error ถ้าไม่มีรูป)
 */
export async function deleteReceiptImage(
  uid: string,
  receiptId: string
): Promise<void> {
  try {
    const storageRef = ref(storage, `users/${uid}/receipts/${receiptId}.jpg`);
    await deleteObject(storageRef);
  } catch {
    // ถ้าไม่มีรูปหรือ permission error → ข้ามไป
  }
}
