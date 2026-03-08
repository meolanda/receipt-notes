import { useState, useRef, useCallback } from "react";
import { getCategoriesForProfile, saveReceipt, type ReceiptItem, type Profile, type ReceiptTag, type Receipt, type DocumentTypeValue } from "@/lib/receipt-store";
import { isGoogleConnected, syncReceiptToGoogle } from "@/lib/google-api";
import { scanReceipt, getClaudeSettings, type ScanResult } from "@/lib/claude-api";
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
  duplicateData?: Receipt | null;
}

export function useReceiptForm({ profile, onSaved, duplicateData }: UseReceiptFormProps) {
  const [title, setTitle] = useState(duplicateData?.title || "");
  const [storeName, setStoreName] = useState(duplicateData?.storeName || "");
  const [description, setDescription] = useState(duplicateData?.description || "");
  const [category, setCategory] = useState(duplicateData?.category || "");
  const [tag, setTag] = useState<ReceiptTag>(duplicateData?.tag || "ส่วนตัว");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<ReceiptItem[]>(
    duplicateData?.items.length ? [...duplicateData.items] : [{ name: "", quantity: 1, price: 0 }]
  );
  const [imageData, setImageData] = useState<string | undefined>(duplicateData?.imageData);
  const [project, setProject] = useState(duplicateData?.project || "");
  const [reimbursementNote, setReimbursementNote] = useState(duplicateData?.reimbursementNote || "");
  const [vatEnabled, setVatEnabled] = useState(duplicateData?.vatEnabled || false);
  const [scanning, setScanning] = useState(false);
  const [scanModel, setScanModel] = useState<string | null>(null);
  const [scanConfidence, setScanConfidence] = useState<string | null>(null);
  const [scanDocType, setScanDocType] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const categories = getCategoriesForProfile(profile);
  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.price, 0);
  const vatAmount = vatEnabled ? totalAmount * 0.07 : 0;
  const grandTotal = totalAmount + vatAmount;
  const isLowConfidence = scanConfidence === "low";

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("ไฟล์ใหญ่เกินไป (สูงสุด 5MB)");
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
        setImageData(raw); // fallback to original
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
      updated[idx] = { ...updated[idx], [field]: value };
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
    const claudeSettings = getClaudeSettings();
    if (!claudeSettings.apiKey) {
      toast.error("กรุณากรอก Claude API Key ก่อน (ไปที่แท็บตั้งค่า)");
      return;
    }

    setScanning(true);
    setScanModel(null);
    setScanConfidence(null);
    setScanDocType(null);
    try {
      const result = await scanReceipt(imageData);
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

  const handleSubmit = useCallback((e: React.FormEvent) => {
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
    const newReceipt = saveReceipt({
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
      documentType: (scanDocType as DocumentType) || undefined,
    });
    toast.success("บันทึกใบเสร็จเรียบร้อย!");

    if (isGoogleConnected()) {
      syncReceiptToGoogle(newReceipt).then(() => {
        toast.success("Sync ไปยัง Google Sheets สำเร็จ ✅");
      }).catch((err) => {
        console.error("Google sync error:", err);
        toast.error("Sync ไปยัง Google ไม่สำเร็จ: " + err.message);
      });
    }

    // Reset form
    setTitle("");
    setStoreName("");
    setDescription("");
    setCategory("");
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
    onSaved();
  }, [title, storeName, description, category, tag, date, totalAmount, vatEnabled, vatAmount, grandTotal, items, project, reimbursementNote, imageData, scanDocType, profile, onSaved]);

  return {
    // State
    title, setTitle,
    storeName, setStoreName,
    description, setDescription,
    category, setCategory,
    tag, setTag,
    date, setDate,
    items,
    imageData, setImageData,
    project, setProject,
    reimbursementNote, setReimbursementNote,
    vatEnabled, setVatEnabled,
    scanning,
    scanModel,
    scanConfidence,
    scanDocType,
    // Refs
    fileRef, titleRef,
    // Computed
    categories, totalAmount, vatAmount, grandTotal, isLowConfidence,
    // Actions
    handleImageUpload, addItem, removeItem, updateItem, handleScan, handleSubmit,
  };
}
