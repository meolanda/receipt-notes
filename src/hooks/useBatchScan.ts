import { useCallback, useRef, useState } from "react";
import { getCategoriesForProfile, saveReceipt, updateReceipt, type DocumentTypeValue, type Profile } from "@/lib/receipt-store";
import { scanReceipt, scanPDF, type ScanResult } from "@/lib/claude-api";
import { isServerSyncAvailable, syncReceiptToServer } from "@/lib/server-sync";
import { compressImage } from "@/lib/image-utils";
import { toast } from "sonner";
import { DOC_TYPE_LABELS } from "@/hooks/useReceiptForm";

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

export interface UseBatchScanReturn {
  isBatchScanning: boolean;
  batchProgress: number;
  batchTotal: number;
  batchInputRef: React.RefObject<HTMLInputElement>;
  handleBatchFiles: (files: FileList) => Promise<void>;
}

export function useBatchScan(profile: Profile, onComplete: () => void): UseBatchScanReturn {
  const [isBatchScanning, setIsBatchScanning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const batchInputRef = useRef<HTMLInputElement>(null);

  const handleBatchFiles = useCallback(async (files: FileList) => {
    if (files.length === 0) return;

    const fileArray = Array.from(files);
    const totalFiles = fileArray.length;
    setBatchTotal(totalFiles);
    setBatchProgress(0);
    setIsBatchScanning(true);

    let savedCount = 0;

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setBatchProgress(i + 1);

      if (file.size > 20 * 1024 * 1024) {
        toast.error(`ไฟล์ "${file.name}" ใหญ่เกินไป (สูงสุด 20MB)`);
        continue;
      }

      try {
        const base64 = await fileToBase64(file);

        if (file.type === "application/pdf") {
          toast.info(`กำลังสแกน PDF "${file.name}"...`);
          const results = await scanPDF(base64);
          for (const result of results) {
            autoSaveResult(result, undefined, profile);
            savedCount++;
          }
          toast.success(`PDF "${file.name}": พบ ${results.length} ใบเสร็จ`);
        } else {
          // รูปภาพ: บีบอัดก่อน
          let imageData = base64;
          try { imageData = await compressImage(base64, 1200, 0.7); } catch { /* ใช้ต้นฉบับ */ }

          const result = await scanReceipt(imageData);
          const docLabel = DOC_TYPE_LABELS[result.document_type] || "เอกสาร";
          const totalStr = result.total ? `฿${result.total.toLocaleString("th-TH")}` : "";
          autoSaveResult(result, imageData, profile);
          savedCount++;
          toast.success(`สแกนสำเร็จ: ${result.store_name || docLabel}${totalStr ? " " + totalStr : ""}`);
        }
      } catch (err: any) {
        toast.error(`สแกนไม่สำเร็จ (${file.name}): ${err.message}`);
      }
    }

    setIsBatchScanning(false);
    setBatchProgress(0);
    setBatchTotal(0);

    // reset input
    if (batchInputRef.current) batchInputRef.current.value = "";

    if (savedCount > 0) {
      toast.success(`บันทึกอัตโนมัติ ${savedCount} ใบเสร็จเรียบร้อย! ✅`);
      onComplete();
    }
  }, [profile, onComplete]);

  return { isBatchScanning, batchProgress, batchTotal, batchInputRef, handleBatchFiles };
}
