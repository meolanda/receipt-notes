import { useState, useRef, useCallback } from "react";
import { getCategoriesForProfile, getReceipts, saveReceipt, updateReceipt, type ReceiptItem, type Profile, type ReceiptTag, type Receipt, type DocumentTypeValue } from "@/lib/receipt-store";
import { isServerSyncAvailable, syncReceiptToServer, updateReceiptOnServer } from "@/lib/server-sync";
import { isGoogleConnected, syncReceiptToGoogle } from "@/lib/google-api";
import { scanReceipt, type ScanResult } from "@/lib/claude-api";
import { compressImage } from "@/lib/image-utils";
import { toast } from "sonner";

const DOC_TYPE_LABELS: Record<string, string> = {
  receipt: "ใบเสร็จ",
  quotation: "ใบเสนอราคา",
  tax_invoice: "ใบกำกับภาษี",
  invoice: "ใบแจ้งหนี้",
  bank_slip: "สลิปโอนเงิน",
  market_bill: "บิลตลาด/มือเขียน",
  other: "อื่นๆ",
};

export { DOC_TYPE_LABELS };

export interface UseReceiptFormProps {
  profile: Profile;
  onSaved: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  duplicateData?: Receipt | null;
  editData?: Receipt | null;
}

export function useReceiptForm({ profile: initialProfile, onSaved, onDirtyChange, duplicateData, editData }: UseReceiptFormProps) {
  const prefill = editData || duplicateData;
  const [profile, setProfileState] = useState<Profile>(prefill?.profile || initialProfile);
  const [title, setTitle] = useState(prefill?.title || "");
  const [storeName, setStoreName] = useState(prefill?.storeName || "");
  const [description, setDescription] = useState(prefill?.description || "");
  const defaultCategory = prefill?.category || getCategoriesForProfile(prefill?.profile || initialProfile)[0] || "";
  const [category, setCategory] = useState(defaultCategory);
  const [tag, setTag] = useState<ReceiptTag>(prefill?.tag || "ส่วนตัว");
  const [date, setDate] = useState(prefill?.date || new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<ReceiptItem[]>(
    prefill?.items.length ? [...prefill.items] : [{ name: "", quantity: 1, price: 0 }]
  );
  const [imageData, setImageData] = useState<string | undefined>(prefill?.imageData);
  const [project, setProject] = useState(prefill?.project || "");
  const [reimbursementNote, setReimbursementNote] = useState(prefill?.reimbursementNote || "");
  const [vatEnabled, setVatEnabled] = useState(prefill?.vatEnabled || false);
  const [scanning, setScanning] = useState(false);
  const [scanModel, setScanModel] = useState<string | null>(null);
  const [scanConfidence, setScanConfidence] = useState<string | null>(null);
  const [scanDocType, setScanDocType] = useState<string | null>(editData?.documentType || null);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const markDirty = useCallback(() => onDirtyChange?.(true), [onDirtyChange]);

  const setProfile = useCallback((p: Profile) => {
    setProfileState(p);
    setCategory(getCategoriesForProfile(p)[0] || "");
    markDirty();
  }, [markDirty]);

  const categories = getCategoriesForProfile(profile);
  const totalAmount = Math.round(items.reduce((sum, i) => sum + i.quantity * i.price, 0) * 100) / 100;
  const vatAmount = vatEnabled ? Math.round(totalAmount * 0.07 * 100) / 100 : 0;
  const grandTotal = Math.round((totalAmount + vatAmount) * 100) / 100;
  const isLowConfidence = scanConfidence === "low";

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("ไฟล์ใหญ่เกินไป (สูงสุด 20MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = reader.result as string;
      try {
        const compressed = await compressImage(raw, 1200, 0.7);
        const savedKB = Math.round((raw.length - compressed.length) / 1024);
        if (savedKB > 10) {
          toast.info(`บีบอัดรูปแล้ว ประหยัด ${savedKB}KB`);
        }
        setImageData(compressed);
      } catch {
        setImageData(raw);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const addItem = useCallback(() => setItems(prev => [...prev, { name: "", quantity: 1, price: 0 }]), []);

  const removeItem = useCallback((idx: number) => {
    setItems(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx));
  }, []);

  const updateItem = useCallback((idx: number, field: keyof ReceiptItem, value: string | number) => {
    setItems(prev => {
      const updated = [...prev];
      let finalValue = value;
      if (field === "quantity") finalValue = Math.max(1, Number(value) || 1);
      if (field === "price") finalValue = Math.max(0, Number(value) || 0);
      updated[idx] = { ...updated[idx], [field]: finalValue };
      return updated;
    });
  }, []);

  const applyAutoFill = useCallback((result: ScanResult) => {
    setTitle("");
    setScanConfidence(result.confidence);
    setScanDocType(result.document_type);

    if (result.date) setDate(result.date);

    if (result.items.length > 0) {
      setItems(
        result.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.unit_price || (i.total / (i.quantity || 1)),
        }))
      );
    }

    if (result.vat && result.vat > 0) setVatEnabled(true);

    if (result.document_type !== "bank_slip") {
      const catGuess = result.document_type === "market_bill" ? "อาหาร" : null;
      if (catGuess) {
        const matched = categories.find((c) => c === catGuess);
        if (matched) setCategory(matched);
      }
    }

    switch (result.document_type) {
      case "bank_slip":
        setStoreName(result.recipient_name || "");
        setCategory("อื่นๆ");
        {
          const parts = [`Ref: ${result.reference_id || "-"}`];
          const extra: string[] = [];
          if (result.bank) extra.push(result.bank);
          if (result.time) extra.push(result.time);
          if (extra.length) parts[0] += " | " + extra.join(" | ");
          if (result.notes) parts.push(result.notes);
          setDescription(parts.join("\n"));
        }
        if (result.total) {
          setItems([{ name: `โอนเงินให้ ${result.recipient_name || ""}`, quantity: 1, price: result.total }]);
        }
        break;

      case "receipt":
      case "tax_invoice":
        setStoreName(result.store_name || "");
        if (result.doc_number) setDescription(result.doc_number);
        else if (result.tax_id) setDescription(`Tax ID: ${result.tax_id}`);
        else if (result.notes) setDescription(result.notes);
        break;

      case "quotation":
      case "invoice":
        setStoreName(result.store_name || "");
        {
          const parts: string[] = [];
          if (result.doc_number) parts.push(`เลขที่: ${result.doc_number}`);
          if (result.notes) parts.push(result.notes);
          setDescription(parts.join("\n") || "");
        }
        break;

      case "market_bill":
        setStoreName(result.store_name || "ร้านค้า/ตลาด");
        if (result.notes) setDescription(result.notes);
        break;

      default:
        setStoreName(result.store_name || "");
        if (result.notes) setDescription(result.notes);
        break;
    }
  }, [categories]);

  const handleScan = useCallback(async () => {
    if (!imageData) {
      toast.error("กรุณาอัปโหลดรูปใบเสร็จก่อน");
      return;
    }
    setScanning(true);
    setScanModel(null);
    setScanConfidence(null);
    setScanDocType(null);
    try {
      const scanPromise = scanReceipt(imageData);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("สแกนใช้เวลานานเกินไป (30 วินาที) กรุณาลองใหม่")), 30_000)
      );
      const result = await Promise.race([scanPromise, timeoutPromise]);
      applyAutoFill(result);
      setScanModel(result.modelUsed);

      const typeLabel = DOC_TYPE_LABELS[result.document_type] || result.document_type;

      if (result.document_type === "market_bill") {
        toast.warning("⚠️ บิลมือเขียน โปรดตรวจสอบข้อมูลก่อนบันทึก");
      }

      if (result.confidence === "low") {
        toast.warning("⚠️ AI ไม่แน่ใจในบางข้อมูล กรุณาตรวจสอบก่อนบันทึก");
      } else if (result.confidence === "high") {
        toast.success(`✅ สแกนสำเร็จ (${typeLabel}) - ${result.modelUsed}`);
      } else {
        toast.success(`สแกนสำเร็จ ✅ (${typeLabel}) - ${result.modelUsed}`);
      }

      toast.info("กรุณาตั้งชื่อรายการก่อนบันทึก");
      setTimeout(() => titleRef.current?.focus(), 100);
    } catch (err: any) {
      console.error("AI scan error:", err);
      toast.error("สแกนไม่สำเร็จ: " + err.message);
    } finally {
      setScanning(false);
    }
  }, [imageData, applyAutoFill]);

  const [saving, setSaving] = useState(false);

  const resetForm = useCallback(() => {
    setProfileState(initialProfile);
    setTitle("");
    setStoreName("");
    setDescription("");
    setCategory(getCategoriesForProfile(initialProfile)[0] || "");
    setTag("ส่วนตัว");
    setDate(new Date().toISOString().slice(0, 10));
    setItems([{ name: "", quantity: 1, price: 0 }]);
    setImageData(undefined);
    setProject("");
    setReimbursementNote("");
    setVatEnabled(false);
    setScanModel(null);
    setScanConfidence(null);
    setScanDocType(null);
    onDirtyChange?.(false);
  }, [onDirtyChange]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("กรุณากรอกชื่อรายการ");
      titleRef.current?.focus();
      return;
    }
    if (!category) {
      toast.error("กรุณาเลือกหมวดหมู่");
      return;
    }

    setSaving(true);

    try {
      // ตรวจสอบใบเสร็จซ้ำ (เฉพาะรายการใหม่)
      if (!editData) {
        const now = Date.now();
        const recent = getReceipts().filter(r => now - new Date(r.createdAt).getTime() < 24 * 60 * 60 * 1000);
        const isDuplicate = recent.some(
          r => r.grandTotal === grandTotal && r.date === date && r.title.trim().toLowerCase() === title.trim().toLowerCase()
        );
        if (isDuplicate) {
          const confirmed = window.confirm("พบรายการที่คล้ายกันบันทึกไว้แล้วใน 24 ชั่วโมงที่ผ่านมา\nต้องการบันทึกซ้ำหรือไม่?");
          if (!confirmed) { setSaving(false); return; }
        }
      }

      const receiptData = {
        profile,
        title: title.trim(),
        storeName: storeName.trim(),
        description: description.trim(),
        category,
        tag,
        date,
        totalAmount,
        vatEnabled,
        vatAmount,
        grandTotal,
        items: items.filter((i) => i.name.trim()),
        project: project.trim(),
        reimbursementNote: reimbursementNote.trim(),
        imageData,
        documentType: (scanDocType as DocumentTypeValue) || undefined,
      };

      if (editData) {
        const updated = updateReceipt(editData.id, { ...receiptData, synced: false });
        toast.success("แก้ไขใบเสร็จเรียบร้อย! ✏️");
        if (updated && isServerSyncAvailable()) {
          updateReceiptOnServer(updated).catch((err) => {
            console.error("Update sync error:", err);
          });
        }
      } else {
        const newReceipt = saveReceipt(receiptData);
        toast.success("บันทึกใบเสร็จเรียบร้อย!");

        // Server sync (Vercel + Apps Script) — ไม่ต้อง login Google
        if (isServerSyncAvailable()) {
          syncReceiptToServer(newReceipt).then((imageUrl) => {
            updateReceipt(newReceipt.id, { synced: true, ...(imageUrl ? { imageUrl } : {}) });
            if (imageUrl) toast.success("Sync + อัปโหลดรูปไป Google Drive ✅");
            else toast.success("Sync ไปยัง Google Sheets สำเร็จ ✅");
          }).catch((err) => {
            console.error("Server sync error:", err);
            if (err.message !== "not_configured") {
              toast.error("Sync ไม่สำเร็จ: " + err.message);
            }
          });
        } else if (isGoogleConnected()) {
          // Fallback: OAuth (localhost dev)
          syncReceiptToGoogle(newReceipt).then(() => {
            toast.success("Sync ไปยัง Google Sheets สำเร็จ ✅");
          }).catch((err) => {
            console.error("Google sync error:", err);
            toast.error("Sync ไม่สำเร็จ: " + err.message);
          });
        }
      }

      resetForm();
      onSaved();
    } finally {
      setSaving(false);
    }
  }, [title, storeName, description, category, tag, date, totalAmount, vatEnabled, vatAmount, grandTotal, items, project, reimbursementNote, imageData, scanDocType, profile, onSaved, editData, resetForm]);

  // Dirty-tracking wrappers
  const setTitleD = useCallback((v: string) => { setTitle(v); markDirty(); }, [markDirty]);
  const setStoreNameD = useCallback((v: string) => { setStoreName(v); markDirty(); }, [markDirty]);
  const setDescriptionD = useCallback((v: string) => { setDescription(v); markDirty(); }, [markDirty]);
  const setCategoryD = useCallback((v: string) => { setCategory(v); markDirty(); }, [markDirty]);
  const setTagD = useCallback((v: ReceiptTag) => { setTag(v); markDirty(); }, [markDirty]);
  const setImageDataD = useCallback((v: string | undefined) => { setImageData(v); if (v) markDirty(); }, [markDirty]);

  return {
    profile, setProfile,
    title, setTitle: setTitleD,
    storeName, setStoreName: setStoreNameD,
    description, setDescription: setDescriptionD,
    category, setCategory: setCategoryD,
    tag, setTag: setTagD,
    date, setDate,
    items,
    imageData, setImageData: setImageDataD,
    project, setProject,
    reimbursementNote, setReimbursementNote,
    vatEnabled, setVatEnabled,
    scanning,
    scanModel,
    scanConfidence,
    scanDocType,
    fileRef, titleRef,
    categories, totalAmount, vatAmount, grandTotal, isLowConfidence,
    saving,
    handleImageUpload, addItem, removeItem, updateItem, handleScan, handleSubmit,
  };
}
