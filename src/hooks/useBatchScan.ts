import { useCallback, useRef, useState } from "react";
import { getCategoriesForProfile, isDuplicateReceipt, type DocumentTypeValue, type Profile, type Receipt } from "@/lib/receipt-store";
import { saveReceiptFS } from "@/lib/firestore-store";
import { uploadReceiptImage } from "@/lib/firebase-storage";
import { scanBatch, scanPDF, type ScanResult } from "@/lib/claude-api";
import { compressImage } from "@/lib/image-utils";
import { toast } from "sonner";
import { DOC_TYPE_LABELS } from "@/hooks/useReceiptForm";

const BATCH_GROUP_SIZE = 5;    // จำนวนรูปต่อ 1 Gemini request
const GROUP_DELAY_MS   = 3_000; // หน่วงระหว่าง group (rate limit)
const PDF_DELAY_MS     = 2_000; // หน่วงระหว่าง PDF

// ข้อมูลที่ผู้ใช้แก้ไขในหน้า review
export interface ReviewEdits {
  storeName: string;
  date: string;
  grandTotal: number;
  category: string;
}

// รายการ low confidence ที่รอผู้ใช้ตรวจก่อนบันทึก
export interface PendingReviewItem {
  id: string;
  fileName: string;
  imageData: string;
  result: ScanResult;
  manualEntry?: boolean;  // true = scan fail ทั้งหมด ต้องกรอกเอง
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function autoTitle(result: ScanResult): string {
  const docLabel = DOC_TYPE_LABELS[result.document_type] || "เอกสาร";
  const storePart = result.store_name || result.recipient_name || "";
  const dateStr = result.date || new Date().toISOString().slice(0, 10);
  return storePart ? storePart : `${docLabel} ${dateStr}`;
}

function isDuplicateResult(result: ScanResult, profile: Profile, existingReceipts: Receipt[]): boolean {
  const grandTotal = result.total || 0;
  const date = result.date || new Date().toISOString().slice(0, 10);
  const storeName = (result.store_name || result.recipient_name || "").trim();
  // ตรวจแค่ใน 30 วันล่าสุด
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = existingReceipts.filter((r) => new Date(r.createdAt).getTime() >= cutoff);
  return isDuplicateReceipt({ date, grandTotal, storeName, profile }, recent);
}

/**
 * เดา category จาก store name + items + document_type
 */
function smartGuessCategory(result: ScanResult, available: string[]): string {
  const has = (cat: string) => available.includes(cat);
  const text = [
    result.store_name, result.recipient_name, result.notes,
    ...(result.items || []).map((i) => i.name),
  ].filter(Boolean).join(" ").toLowerCase();

  if (has("อาหาร") && /kfc|mcdonald|burger|pizza|starbucks|cafe|coffee|ชา|กาแฟ|อาหาร|ร้านอาหาร|ข้าว|ก๋วยเตี๋ยว|ส้มตำ|ไก่|หมู|seafood|sushi/.test(text)) return "อาหาร";
  if (result.document_type === "market_bill" && has("อาหาร")) return "อาหาร";
  if (has("ขนส่ง") && /lalamove|grab|kerry|flash|ไปรษณีย์|จัดส่ง|ขนส่ง|delivery|logistics|shippop|dhl|fedex|scg/.test(text)) return "ขนส่ง";
  if (has("อะไหล่") && /อะไหล่|spare|compressor|refrigerant|r410|r22|r32|freon|pump|valve|motor|pcb|inverter|บราก|เทป|ท่อ|น้ำยา|แอร์|air|coil|fan|filter|sensor|relay|capacitor|contactor|fuse/.test(text)) return "อะไหล่";
  if (has("ค่าน้ำ/ไฟ") && /การไฟฟ้า|ประปา|pea|mea|electricity|water|ค่าไฟ|ค่าน้ำ|true|ais|dtac|internet|wifi|โทรศัพท์/.test(text)) return "ค่าน้ำ/ไฟ";
  if (has("สุขภาพ") && /hospital|clinic|pharmacy|โรงพยาบาล|คลินิก|ร้านขายยา|ยา|วิตามิน|dental|doctor/.test(text)) return "สุขภาพ";
  if (has("ช้อปปิ้ง") && /lazada|shopee|amazon|central|robinson|homepro|bigc|lotus|makro|tesco|tops/.test(text)) return "ช้อปปิ้ง";
  if (has("ท่องเที่ยว") && /hotel|resort|motel|hostel|airbnb|agoda|booking|โรงแรม|ที่พัก/.test(text)) return "ท่องเที่ยว";

  return available[0] || "อื่นๆ";
}

/**
 * แก้ปีอัตโนมัติถ้า OCR อ่านปีผิด
 */
function autoCorrectYear(dateStr: string | null): { date: string; corrected: boolean; originalYear?: number } {
  if (!dateStr) return { date: new Date().toISOString().slice(0, 10), corrected: false };
  const currentYear = new Date().getFullYear();
  const parts = dateStr.split("-");
  if (parts.length !== 3) return { date: dateStr, corrected: false };
  const scannedYear = parseInt(parts[0], 10);
  if (isNaN(scannedYear)) return { date: dateStr, corrected: false };
  if (scannedYear < currentYear - 2 || scannedYear > currentYear + 1) {
    return { date: `${currentYear}-${parts[1]}-${parts[2]}`, corrected: true, originalYear: scannedYear };
  }
  return { date: dateStr, corrected: false };
}

/**
 * Auto-save สำหรับ high/medium confidence → Firestore + Storage
 */
async function autoSaveResult(
  result: ScanResult,
  imageData: string | undefined,
  profile: Profile,
  uid: string
): Promise<{ yearCorrected: boolean; originalYear?: number }> {
  const categories = getCategoriesForProfile(profile);
  const category = smartGuessCategory(result, categories);

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

  const { date: correctedDate, corrected, originalYear } = autoCorrectYear(result.date);

  // บันทึกลง Firestore (ไม่มี imageData — เก็บใน Storage แยก)
  const saved = await saveReceiptFS(uid, {
    profile,
    title: autoTitle(result),
    storeName: result.store_name || result.recipient_name || "",
    description,
    category,
    tag,
    date: correctedDate,
    totalAmount,
    vatEnabled: vatAmount > 0,
    vatAmount,
    grandTotal,
    items: items.filter((i) => i.name.trim()),
    project: "",
    reimbursementNote: "",
    documentType: result.document_type as DocumentTypeValue,
  });

  // อัปโหลดรูป → Storage (ทำ background ไม่ block)
  if (imageData) {
    uploadReceiptImage(uid, saved.id, imageData).catch((err) =>
      console.error("[batch] upload image error:", err)
    );
  }

  return { yearCorrected: corrected, originalYear };
}

/** บันทึกหลังผู้ใช้ review และแก้ไขแล้ว */
export async function saveReviewedResult(
  result: ScanResult,
  imageData: string,
  profile: Profile,
  edits: ReviewEdits,
  uid: string
): Promise<void> {
  const vatAmount = result.vat != null ? Number(result.vat) : 0;
  const totalAmount = Math.max(0, edits.grandTotal - vatAmount);
  const originalTotal = result.total || 1;
  const ratio = edits.grandTotal / (originalTotal || 1);

  const items = result.items.length > 0
    ? result.items.map((i) => ({
        name: i.name,
        quantity: i.quantity || 1,
        price: Math.round((i.unit_price || (i.total / (i.quantity || 1)) || 0) * ratio * 100) / 100,
      }))
    : [{ name: edits.storeName || "รายการ", quantity: 1, price: edits.grandTotal }];

  const tag = profile === "company" ? "บริษัท" as const : "ส่วนตัว" as const;

  const saved = await saveReceiptFS(uid, {
    profile,
    title: edits.storeName || autoTitle(result),
    storeName: edits.storeName,
    description: result.doc_number || result.notes || "",
    category: edits.category,
    tag,
    date: edits.date,
    totalAmount,
    vatEnabled: vatAmount > 0,
    vatAmount,
    grandTotal: edits.grandTotal,
    items: items.filter((i) => i.name.trim()),
    project: "",
    reimbursementNote: "",
    documentType: result.document_type as DocumentTypeValue,
  });

  // อัปโหลดรูป background
  if (imageData) {
    uploadReceiptImage(uid, saved.id, imageData).catch((err) =>
      console.error("[review] upload image error:", err)
    );
  }
}

export interface BatchSummary {
  saved: number;
  skipped: number;    // ซ้ำ
  review: number;     // รอตรวจ
  failed: number;
  yearFixed: number;  // แก้ปีอัตโนมัติ
}

export interface UseBatchScanReturn {
  isBatchScanning: boolean;
  batchProgress: number;
  batchTotal: number;
  batchCurrentFile: string;
  failedFiles: { name: string; reason: string; file: File }[];
  pendingReview: PendingReviewItem[];
  reviewTotal: number;
  batchSummary: BatchSummary | null;
  clearSummary: () => void;
  saveReviewedItem: (item: PendingReviewItem, edits: ReviewEdits) => Promise<void>;
  saveAllReviewItems: (editsMap: Record<string, ReviewEdits>) => Promise<void>;
  skipReviewItem: (item: PendingReviewItem) => void;
  batchInputRef: React.RefObject<HTMLInputElement>;
  handleBatchFiles: (files: FileList | File[]) => Promise<void>;
  retryFailed: () => Promise<void>;
  cancelBatch: () => void;
}

export function useBatchScan(
  profile: Profile,
  uid: string,
  receipts: Receipt[],
  onComplete: () => void
): UseBatchScanReturn {
  const [isBatchScanning, setIsBatchScanning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchCurrentFile, setBatchCurrentFile] = useState("");
  const [failedFiles, setFailedFiles] = useState<{ name: string; reason: string; file: File }[]>([]);
  const [pendingReview, setPendingReview] = useState<PendingReviewItem[]>([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const clearSummary = useCallback(() => setBatchSummary(null), []);
  const cancelBatch = useCallback(() => { cancelRef.current = true; }, []);

  const runBatch = useCallback(async (fileArray: File[]) => {
    cancelRef.current = false;
    setFailedFiles([]);
    setPendingReview([]);
    setReviewTotal(0);
    setBatchTotal(fileArray.length);
    setBatchProgress(0);
    setBatchCurrentFile("");
    setIsBatchScanning(true);

    let savedCount = 0;
    let skippedCount = 0;
    let yearFixedCount = 0;
    let doneCount = 0;
    const failed: { name: string; reason: string; file: File }[] = [];
    const toReview: PendingReviewItem[] = [];

    // snapshot ของ receipts ณ เวลา batch start (ป้องกัน race condition)
    const existingReceipts = [...receipts];

    const pdfs = fileArray.filter((f) => f.type === "application/pdf");
    const images = fileArray.filter((f) => f.type !== "application/pdf");

    // ─── PDF ───
    for (const file of pdfs) {
      if (cancelRef.current) break;
      setBatchCurrentFile(file.name);
      try {
        const base64 = await fileToBase64(file);
        const results = await scanPDF(base64);
        let saved = 0, skipped = 0;
        for (const result of results) {
          if (isDuplicateResult(result, profile, existingReceipts)) { skipped++; skippedCount++; continue; }
          await autoSaveResult(result, undefined, profile, uid);
          saved++;
          savedCount++;
        }
        if (skipped > 0) toast.info(`PDF "${file.name}": บันทึก ${saved} ใบ (ข้าม ${skipped} ซ้ำ)`);
        else toast.success(`PDF "${file.name}": พบ ${results.length} ใบเสร็จ ✅`);
      } catch (err: any) {
        failed.push({ name: file.name, reason: err.message, file });
        toast.error(`❌ PDF "${file.name}": ${err.message.slice(0, 60)}`);
      }
      doneCount++;
      setBatchProgress(doneCount);
      if (!cancelRef.current && pdfs.indexOf(file) < pdfs.length - 1) {
        await new Promise((r) => setTimeout(r, PDF_DELAY_MS));
      }
    }

    // ─── รูปภาพ (แบบ group) ───
    for (let gi = 0; gi < images.length; gi += BATCH_GROUP_SIZE) {
      if (cancelRef.current) break;

      const group = images.slice(gi, gi + BATCH_GROUP_SIZE);
      setBatchCurrentFile(`กลุ่ม ${Math.floor(gi / BATCH_GROUP_SIZE) + 1}: ${group[0].name}${group.length > 1 ? ` +${group.length - 1} รูป` : ""}`);

      let imagePayloads: Array<{ mimeType: string; base64: string; file: File; imageData: string }> = [];
      try {
        for (const file of group) {
          const raw = await fileToBase64(file);
          const match = raw.match(/^data:(image\/\w+);base64,(.+)$/);
          if (!match) { failed.push({ name: file.name, reason: "รูปแบบไฟล์ไม่ถูกต้อง", file }); continue; }
          let compressed = raw;
          try { compressed = await compressImage(raw, 1200, 0.7); } catch { /* ใช้ต้นฉบับ */ }
          const compMatch = compressed.match(/^data:(image\/\w+);base64,(.+)$/);
          if (!compMatch) continue;
          imagePayloads.push({ mimeType: compMatch[1], base64: compMatch[2], file, imageData: compressed });
        }

        if (imagePayloads.length === 0) {
          doneCount += group.length;
          setBatchProgress(doneCount);
          continue;
        }

        toast.info(`🤖 กำลังสแกนกลุ่มที่ ${Math.floor(gi / BATCH_GROUP_SIZE) + 1} (${imagePayloads.length} รูป)...`);
        const results = await scanBatch(
          imagePayloads.map((p) => ({ mimeType: p.mimeType, base64: p.base64 }))
        );

        for (let k = 0; k < imagePayloads.length; k++) {
          const { file, imageData } = imagePayloads[k];
          const result = results[k];
          if (!result) { failed.push({ name: file.name, reason: "ไม่ได้รับผลลัพธ์", file }); continue; }

          if (isDuplicateResult(result, profile, existingReceipts)) {
            skippedCount++;
            doneCount++;
            setBatchProgress(doneCount);
            continue;
          }

          // ส่งทุกใบเข้า review เสมอ — ไม่ auto-save (AI อ่านผิดบ่อย)
          toReview.push({ id: crypto.randomUUID(), fileName: file.name, imageData, result });
        }

      } catch (err: any) {
        toast.warning(`⚠️ สแกนไม่ได้ ${imagePayloads.length || group.length} รูป — โปรดกรอกข้อมูลเอง`);
        const emptyResult: ScanResult = {
          confidence: "low", document_type: "other",
          store_name: null, date: null, total: null,
          items: [], subtotal: null, vat: null, notes: null,
          recipient_name: null, bank: null, time: null,
          doc_number: null, tax_id: null, reference_id: null, amount: null,
        };
        if (imagePayloads.length > 0) {
          for (const p of imagePayloads) {
            toReview.push({ id: crypto.randomUUID(), fileName: p.file.name, imageData: p.imageData, result: emptyResult, manualEntry: true });
          }
        } else {
          for (const file of group) {
            failed.push({ name: file.name, reason: err.message, file });
          }
        }
      }

      doneCount += group.length;
      setBatchProgress(doneCount);

      if (gi + BATCH_GROUP_SIZE < images.length && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, GROUP_DELAY_MS));
      }
    }

    // ─── เสร็จแล้ว ───
    setIsBatchScanning(false);
    setBatchProgress(0);
    setBatchTotal(0);
    setBatchCurrentFile("");
    setFailedFiles(failed);

    if (toReview.length > 0) {
      setPendingReview(toReview);
      setReviewTotal(toReview.length);
    }

    setBatchSummary({
      saved: savedCount,
      skipped: skippedCount,
      review: toReview.length,
      failed: failed.length,
      yearFixed: yearFixedCount,
    });

    if (batchInputRef.current) batchInputRef.current.value = "";
    if (savedCount > 0) onComplete();
  }, [profile, uid, receipts, onComplete]);

  const handleBatchFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.isArray(files) ? files : Array.from(files);
    if (fileArray.length === 0) return;
    await runBatch(fileArray);
  }, [runBatch]);

  const retryFailed = useCallback(async () => {
    if (failedFiles.length === 0) return;
    await runBatch(failedFiles.map((f) => f.file));
  }, [failedFiles, runBatch]);

  const saveReviewedItem = useCallback(async (item: PendingReviewItem, edits: ReviewEdits) => {
    try {
      await saveReviewedResult(item.result, item.imageData, profile, edits, uid);
      toast.success(`✅ บันทึก: ${edits.storeName || "ใบเสร็จ"} ฿${edits.grandTotal.toLocaleString("th-TH")}`);
      onComplete();
    } catch (err: any) {
      toast.error("บันทึกไม่สำเร็จ: " + err.message);
    }
    setPendingReview((prev) => prev.filter((p) => p.id !== item.id));
  }, [profile, uid, onComplete]);

  const saveAllReviewItems = useCallback(async (editsMap: Record<string, ReviewEdits>) => {
    let savedCount = 0;
    const errors: string[] = [];

    // ใช้ functional update เพื่อได้ current pendingReview
    let currentItems: PendingReviewItem[] = [];
    setPendingReview((prev) => { currentItems = prev; return prev; });

    for (const item of currentItems) {
      const edits = editsMap[item.id];
      if (!edits) continue;
      try {
        await saveReviewedResult(item.result, item.imageData, profile, edits, uid);
        savedCount++;
      } catch (err: any) {
        console.error("[saveAll]", err);
        errors.push(item.fileName);
      }
    }

    if (savedCount > 0) {
      toast.success(`✅ บันทึกทั้งหมด ${savedCount} ใบ`);
      onComplete();
    }
    if (errors.length > 0) {
      toast.error(`❌ บันทึกไม่ได้ ${errors.length} ใบ`);
    }
    setPendingReview([]);
  }, [profile, uid, onComplete]);

  const skipReviewItem = useCallback((item: PendingReviewItem) => {
    toast.info(`ข้าม: ${item.fileName}`);
    setPendingReview((prev) => prev.filter((p) => p.id !== item.id));
  }, []);

  return {
    isBatchScanning, batchProgress, batchTotal, batchCurrentFile,
    failedFiles, pendingReview, reviewTotal,
    batchSummary, clearSummary,
    saveReviewedItem, saveAllReviewItems, skipReviewItem,
    batchInputRef, handleBatchFiles, retryFailed, cancelBatch,
  };
}
