import { useCallback, useRef, useState } from "react";
import { getCategoriesForProfile, getReceipts, saveReceipt, updateReceipt, type DocumentTypeValue, type Profile } from "@/lib/receipt-store";
import { scanReceipt, scanPDF, type ScanResult } from "@/lib/claude-api";
import { isServerSyncAvailable, syncReceiptToServer } from "@/lib/server-sync";
import { compressImage } from "@/lib/image-utils";
import { toast } from "sonner";
import { DOC_TYPE_LABELS } from "@/hooks/useReceiptForm";

const CONCURRENT_LIMIT = 2;
const SCAN_TIMEOUT_MS = 60_000;
const BATCH_DELAY_MS = 1_000; // หน่วงระหว่าง batch เพื่อไม่ให้ hit rate limit

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}: หมดเวลา (${ms / 1000}s)`)), ms)
    ),
  ]);
}

function autoTitle(result: ScanResult): string {
  const docLabel = DOC_TYPE_LABELS[result.document_type] || "เอกสาร";
  const storePart = result.store_name || result.recipient_name || "";
  const dateStr = result.date || new Date().toISOString().slice(0, 10);
  return storePart ? storePart : `${docLabel} ${dateStr}`;
}

function isDuplicateResult(result: ScanResult): boolean {
  const grandTotal = result.total || 0;
  const date = result.date || new Date().toISOString().slice(0, 10);
  const storeName = (result.store_name || result.recipient_name || "").trim().toLowerCase();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return getReceipts().some((r) => {
    if (new Date(r.createdAt).getTime() < cutoff) return false;
    if (r.grandTotal !== grandTotal) return false;
    if (r.date !== date) return false;
    if (storeName && r.storeName.trim().toLowerCase() !== storeName) return false;
    return true;
  });
}

function autoSaveResult(result: ScanResult, imageData: string | undefined, profile: Profile): void {
  const categories = getCategoriesForProfile(profile);
  const category = (result.document_type === "market_bill" && categories.includes("อาหาร"))
    ? "อาหาร"
    : categories[0] || "อื่นๆ";

  const vatAmount = result.vat != null ? Number(result.vat) : 0;
  const grandTotal = result.total || 0;
  const totalAmount = result.subtotal != null
    ? Number(result.subtotal)
    : Math.max(0, grandTotal - vatAmount);

  const items = result.items.length > 0
    ? result.items.map((i) => ({
        name: i.name,
        quantity: i.quantity || 1,
        price: i.unit_price || (i.total / (i.quantity || 1)) || 0,
      }))
    : [{ name: autoTitle(result), quantity: 1, price: grandTotal }];

  const tag = profile === "company" ? "บริษัท" as const : "ส่วนตัว" as const;

  let description = "";
  if (result.document_type === "bank_slip") {
    const parts = [`Ref: ${result.reference_id || "-"}`];
    if (result.bank) parts[0] += ` | ${result.bank}`;
    if (result.time) parts[0] += ` | ${result.time}`;
    if (result.notes) parts.push(result.notes);
    description = parts.join("\n");
  } else if (result.doc_number) {
    description = result.doc_number;
  } else if (result.notes) {
    description = result.notes;
  }

  const receipt = saveReceipt({
    profile,
    title: autoTitle(result),
    storeName: result.store_name || result.recipient_name || "",
    description,
    category,
    tag,
    date: result.date || new Date().toISOString().slice(0, 10),
    totalAmount,
    vatEnabled: vatAmount > 0,
    vatAmount,
    grandTotal,
    items: items.filter((i) => i.name.trim()),
    project: "",
    reimbursementNote: "",
    imageData,
    documentType: result.document_type as DocumentTypeValue,
  });

  if (isServerSyncAvailable()) {
    syncReceiptToServer(receipt).then((imageUrl) => {
      updateReceipt(receipt.id, { synced: true, ...(imageUrl ? { imageUrl } : {}) });
    }).catch(console.error);
  }
}

interface FileResult {
  saved: number;
  failReason: string | null; // null = success หรือ skip
}

async function processFile(
  file: File,
  profile: Profile,
  onProgress: () => void,
  cancelRef: React.MutableRefObject<boolean>
): Promise<FileResult> {
  if (cancelRef.current) return { saved: 0, failReason: null };

  if (file.size > 20 * 1024 * 1024) {
    onProgress();
    return { saved: 0, failReason: "ไฟล์ใหญ่เกินไป (>20MB)" };
  }

  try {
    const base64 = await fileToBase64(file);
    if (cancelRef.current) return { saved: 0, failReason: null };

    if (file.type === "application/pdf") {
      const results = await withTimeout(scanPDF(base64), SCAN_TIMEOUT_MS, file.name);
      if (cancelRef.current) return { saved: 0, failReason: null };
      let saved = 0, skipped = 0;
      for (const result of results) {
        if (isDuplicateResult(result)) { skipped++; continue; }
        autoSaveResult(result, undefined, profile);
        saved++;
      }
      if (skipped > 0) toast.info(`PDF "${file.name}": บันทึก ${saved} ใบ (ข้าม ${skipped} ซ้ำ)`);
      else toast.success(`PDF "${file.name}": พบ ${results.length} ใบเสร็จ`);
      onProgress();
      return { saved, failReason: null };
    } else {
      let imageData = base64;
      try { imageData = await compressImage(base64, 1200, 0.7); } catch { /* ใช้ต้นฉบับ */ }
      if (cancelRef.current) return { saved: 0, failReason: null };

      const result = await withTimeout(scanReceipt(imageData), SCAN_TIMEOUT_MS, file.name);
      if (cancelRef.current) return { saved: 0, failReason: null };

      const docLabel = DOC_TYPE_LABELS[result.document_type] || "เอกสาร";
      const totalStr = result.total ? ` ฿${result.total.toLocaleString("th-TH")}` : "";
      if (isDuplicateResult(result)) {
        toast.info(`ข้ามซ้ำ: ${result.store_name || docLabel}${totalStr}`);
        onProgress();
        return { saved: 0, failReason: null };
      }
      try {
        autoSaveResult(result, undefined, profile);
        toast.success(`✅ ${result.store_name || docLabel}${totalStr}`);
      } catch (saveErr: any) {
        onProgress();
        return { saved: 0, failReason: saveErr.message };
      }
      onProgress();
      return { saved: 1, failReason: null };
    }
  } catch (err: any) {
    onProgress();
    if (cancelRef.current) return { saved: 0, failReason: null };
    return { saved: 0, failReason: err.message };
  }
}

export interface UseBatchScanReturn {
  isBatchScanning: boolean;
  batchProgress: number;
  batchTotal: number;
  failedFiles: { name: string; reason: string }[];
  batchInputRef: React.RefObject<HTMLInputElement>;
  handleBatchFiles: (files: FileList) => Promise<void>;
  cancelBatch: () => void;
}

export function useBatchScan(profile: Profile, onComplete: () => void): UseBatchScanReturn {
  const [isBatchScanning, setIsBatchScanning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const cancelBatch = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const handleBatchFiles = useCallback(async (files: FileList) => {
    if (files.length === 0) return;

    const fileArray = Array.from(files);
    cancelRef.current = false;
    setBatchTotal(fileArray.length);
    setBatchProgress(0);
    setIsBatchScanning(true);

    let savedCount = 0;
    let doneCount = 0;

    const onProgress = () => {
      doneCount++;
      setBatchProgress(doneCount);
    };

    // ประมวลผล CONCURRENT_LIMIT ไฟล์พร้อมกัน หน่วงระหว่าง batch
    for (let i = 0; i < fileArray.length; i += CONCURRENT_LIMIT) {
      if (cancelRef.current) break;
      const chunk = fileArray.slice(i, i + CONCURRENT_LIMIT);
      const counts = await Promise.all(
        chunk.map((file) => processFile(file, profile, onProgress, cancelRef))
      );
      savedCount += counts.reduce((a, b) => a + b, 0);
      if (i + CONCURRENT_LIMIT < fileArray.length && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    setIsBatchScanning(false);
    setBatchProgress(0);
    setBatchTotal(0);
    if (batchInputRef.current) batchInputRef.current.value = "";

    if (cancelRef.current) {
      toast.info(`ยกเลิกแล้ว (บันทึกไปแล้ว ${savedCount} ใบ)`);
    } else if (savedCount > 0) {
      toast.success(`บันทึกอัตโนมัติ ${savedCount} ใบเสร็จเรียบร้อย! ✅`);
    }

    if (savedCount > 0) onComplete();
  }, [profile, onComplete]);

  return { isBatchScanning, batchProgress, batchTotal, batchInputRef, handleBatchFiles, cancelBatch };
}
