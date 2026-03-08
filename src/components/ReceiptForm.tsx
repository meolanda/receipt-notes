import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Camera, Plus, Trash2, Receipt, Bot, Loader2 } from "lucide-react";
import { saveReceipt, getCategoriesForProfile, TAGS, type ReceiptItem, type Profile, type ReceiptTag, type Receipt as ReceiptType } from "@/lib/receipt-store";
import { isGoogleConnected, syncReceiptToGoogle } from "@/lib/google-api";
import { scanReceipt, getClaudeSettings, type ScanResult } from "@/lib/claude-api";
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

interface ReceiptFormProps {
  profile: Profile;
  onSaved: () => void;
  duplicateData?: ReceiptType | null;
}

export default function ReceiptForm({ profile, onSaved, duplicateData }: ReceiptFormProps) {
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("ไฟล์ใหญ่เกินไป (สูงสุด 5MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result as string);
    reader.readAsDataURL(file);
  };

  const addItem = () => setItems([...items, { name: "", quantity: 1, price: 0 }]);

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof ReceiptItem, value: string | number) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };

  const applyAutoFill = (result: ScanResult) => {
    // Never auto-fill title
    setTitle("");
    setScanConfidence(result.confidence);
    setScanDocType(result.document_type);

    // Date
    if (result.date) setDate(result.date);

    // Items
    if (result.items.length > 0) {
      setItems(
        result.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.unit_price || (i.total / (i.quantity || 1)),
        }))
      );
    }

    // VAT
    if (result.vat && result.vat > 0) {
      setVatEnabled(true);
    }

    // Category matching
    if (result.document_type !== "bank_slip") {
      // Try to match from notes or doc type
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
  };

  const handleScan = async () => {
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

      // Confidence-based toast messages
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

      // Auto-focus title field
      setTimeout(() => titleRef.current?.focus(), 100);
    } catch (err: any) {
      console.error("AI scan error:", err);
      toast.error("สแกนไม่สำเร็จ: " + err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
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
  };

  // Yellow highlight class for low confidence fields
  const lowConfCls = isLowConfidence ? "ring-2 ring-yellow-400 bg-yellow-50" : "";

  return (
    <Card className="receipt-shadow fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Receipt className="h-5 w-5 text-primary" />
          บันทึกใบเสร็จใหม่
          <div className="ml-auto flex items-center gap-1.5">
            {scanDocType && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                {DOC_TYPE_LABELS[scanDocType] || scanDocType}
              </Badge>
            )}
            {scanModel && (
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                {scanModel} ✓
              </Badge>
            )}
            {scanConfidence && (
              <Badge
                variant="outline"
                className={`text-xs ${
                  scanConfidence === "high"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : scanConfidence === "medium"
                    ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}
              >
                {scanConfidence === "high" ? "✅" : scanConfidence === "medium" ? "⚠️" : "⚠️"} {scanConfidence}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Image upload */}
          <div>
            <Label>รูปใบเสร็จ (ไม่บังคับ)</Label>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
            {imageData ? (
              <div className="relative mt-2">
                <img src={imageData} alt="ใบเสร็จ" className="w-full max-h-48 object-cover rounded-lg border border-border" />
                <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => setImageData(undefined)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="mt-2 w-full border-dashed h-24 flex flex-col gap-1" onClick={() => fileRef.current?.click()}>
                <Camera className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">ถ่ายรูป / เลือกรูป</span>
              </Button>
            )}
            {imageData && (
              <Button
                type="button"
                variant="secondary"
                className="mt-2 w-full gap-2"
                onClick={handleScan}
                disabled={scanning}
              >
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                {scanning ? "กำลังสแกน..." : "🤖 สแกนด้วย AI"}
              </Button>
            )}
          </div>

          {/* Basic info */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="title">ชื่อรายการ *</Label>
              <Input
                ref={titleRef}
                id="title"
                placeholder="เช่น ซื้ออะไหล่แอร์, ค่าอาหารกลางวัน"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="storeName">ร้านค้า/ผู้รับเงิน</Label>
              <Input
                id="storeName"
                placeholder="เช่น โฮมโปร, 7-Eleven"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className={`mt-1 ${lowConfCls}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="date">วันที่ *</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1 ${lowConfCls}`} />
              </div>
              <div>
                <Label htmlFor="category">หมวดหมู่ *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="เลือก..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Tag */}
          <div>
            <Label htmlFor="tag">แท็ก</Label>
            <Select value={tag} onValueChange={(v) => setTag(v as ReceiptTag)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAGS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Profile-specific fields */}
          {profile === "company" && (
            <div>
              <Label htmlFor="project">โครงการ/ลูกค้า</Label>
              <Input id="project" placeholder="เช่น คอนโด ABC" value={project} onChange={(e) => setProject(e.target.value)} className="mt-1" />
            </div>
          )}

          <div>
            <Label htmlFor="desc">หมายเหตุ</Label>
            <Textarea id="desc" placeholder="รายละเอียดเพิ่มเติม..." value={description} onChange={(e) => setDescription(e.target.value)} className={`mt-1 ${lowConfCls}`} rows={2} />
          </div>

          {/* Items */}
          <div>
            <Label>รายการสินค้า/บริการ</Label>
            <div className="mt-2 space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input placeholder="ชื่อรายการ" value={item.name} onChange={(e) => updateItem(idx, "name", e.target.value)} className={`flex-1 ${lowConfCls}`} />
                  <Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)} className={`w-16 text-center ${lowConfCls}`} />
                  <Input type="number" min={0} step={0.01} placeholder="ราคา" value={item.price || ""} onChange={(e) => updateItem(idx, "price", parseFloat(e.target.value) || 0)} className={`w-24 ${lowConfCls}`} />
                  {items.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={() => removeItem(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" className="mt-2 text-primary" onClick={addItem}>
              <Plus className="h-4 w-4 mr-1" /> เพิ่มรายการ
            </Button>
          </div>

          {/* VAT Toggle */}
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted">
            <Label htmlFor="vat" className="cursor-pointer">คิด VAT 7%</Label>
            <Switch id="vat" checked={vatEnabled} onCheckedChange={setVatEnabled} />
          </div>

          {/* Total */}
          <div className="space-y-1 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">ยอดรวม</span>
              <span className="font-medium">฿{totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
            </div>
            {vatEnabled && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">VAT 7%</span>
                <span className="font-medium text-accent">฿{vatAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="font-medium text-muted-foreground">ยอดรวมสุทธิ</span>
              <span className="text-2xl font-bold font-display text-primary">
                ฿{grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Reimbursement note - company only */}
          {profile === "company" && (
            <div>
              <Label htmlFor="reimburse">หมายเหตุการเบิก</Label>
              <Input id="reimburse" placeholder="เช่น เบิกจากโครงการ X" value={reimbursementNote} onChange={(e) => setReimbursementNote(e.target.value)} className="mt-1" />
            </div>
          )}

          <Button type="submit" className="w-full" size="lg">
            บันทึกใบเสร็จ
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
