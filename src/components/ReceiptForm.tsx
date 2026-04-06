import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Camera, ImageIcon, Plus, Trash2, Receipt, Bot, Loader2, X, Pencil } from "lucide-react";
import { TAGS, type Profile, type ReceiptTag, type Receipt as ReceiptType } from "@/lib/receipt-store";
import { useReceiptForm, DOC_TYPE_LABELS } from "@/hooks/useReceiptForm";

interface ReceiptFormProps {
  profile: Profile;
  onSaved: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  duplicateData?: ReceiptType | null;
  editData?: ReceiptType | null;
  onCancelEdit?: () => void;
}

export default function ReceiptForm({ profile, onSaved, onDirtyChange, duplicateData, editData, onCancelEdit }: ReceiptFormProps) {
  const form = useReceiptForm({ profile, onSaved, onDirtyChange, duplicateData, editData });
  const lowConfCls = form.isLowConfidence ? "ring-2 ring-yellow-400 bg-yellow-50" : "";
  const isPersonal = form.profile === "personal";
  const isEditing = !!editData;

  return (
    <Card className="receipt-shadow fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {isEditing ? <Pencil className="h-5 w-5 text-primary" /> : <Receipt className="h-5 w-5 text-primary" />}
          {isEditing ? "แก้ไขใบเสร็จ" : "บันทึกใบเสร็จใหม่"}
          <div className="ml-auto flex items-center gap-1.5">
            {isEditing && onCancelEdit && (
              <Button type="button" variant="ghost" size="sm" onClick={onCancelEdit} className="text-muted-foreground">
                <X className="h-4 w-4 mr-1" /> ยกเลิก
              </Button>
            )}
            {form.scanDocType && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                {DOC_TYPE_LABELS[form.scanDocType] || form.scanDocType}
              </Badge>
            )}
            {form.scanModel && (
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                {form.scanModel} ✓
              </Badge>
            )}
            {form.scanConfidence && (
              <Badge
                variant="outline"
                className={`text-xs ${
                  form.scanConfidence === "high"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : form.scanConfidence === "medium"
                    ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}
              >
                {form.scanConfidence === "high" ? "✅" : "⚠️"} {form.scanConfidence}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit} className="space-y-5">
          {/* Image upload */}
          <div>
            <Label>รูปใบเสร็จ (ไม่บังคับ)</Label>
            {/* input สำหรับกล้องโดยตรง (มือถือ) */}
            <input ref={form.fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={form.handleImageUpload} />
            {/* input สำหรับเลือกรูปจากคลัง */}
            <input id="galleryInput" type="file" accept="image/*" className="hidden" onChange={form.handleImageUpload} />
            {form.imageData ? (
              <div className="relative mt-2">
                <img src={form.imageData} alt="ใบเสร็จ" className="w-full max-h-48 object-cover rounded-lg border border-border" />
                <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => form.setImageData(undefined)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="border-dashed h-20 flex flex-col gap-1" onClick={() => form.fileRef.current?.click()}>
                  <Camera className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">ถ่ายรูป</span>
                </Button>
                <Button type="button" variant="outline" className="border-dashed h-20 flex flex-col gap-1" onClick={() => document.getElementById("galleryInput")?.click()}>
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">เลือกจากคลัง</span>
                </Button>
              </div>
            )}
            {form.imageData && (
              <Button type="button" variant="secondary" className="mt-2 w-full gap-2" onClick={form.handleScan} disabled={form.scanning}>
                {form.scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                {form.scanning ? "กำลังสแกน..." : "🤖 สแกนด้วย AI"}
              </Button>
            )}
          </div>

          {/* Profile picker */}
          {!editData && (
            <div className="flex rounded-lg overflow-hidden border border-border">
              <button
                type="button"
                onClick={() => form.setProfile("personal")}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  isPersonal ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                🧑 ส่วนตัว
              </button>
              <button
                type="button"
                onClick={() => form.setProfile("company")}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  !isPersonal ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                🏢 บริษัท
              </button>
            </div>
          )}

          {/* Basic info */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="title">ชื่อรายการ *</Label>
              <Input ref={form.titleRef} id="title" placeholder="เช่น ซื้ออะไหล่แอร์, ค่าอาหารกลางวัน" value={form.title} onChange={(e) => form.setTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="storeName">ร้านค้า/ผู้รับเงิน</Label>
              <Input id="storeName" placeholder="เช่น โฮมโปร, 7-Eleven" value={form.storeName} onChange={(e) => form.setStoreName(e.target.value)} className={`mt-1 ${lowConfCls}`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="date">วันที่ *</Label>
                <Input id="date" type="date" value={form.date} onChange={(e) => form.setDate(e.target.value)} className={`mt-1 ${lowConfCls}`} />
              </div>
              <div>
                <Label htmlFor="category">หมวดหมู่ *</Label>
                <Select value={form.category} onValueChange={form.setCategory}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="เลือก..." /></SelectTrigger>
                  <SelectContent position="popper">
                    {form.categories.map((c) => (
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
            <Select value={form.tag} onValueChange={(v) => form.setTag(v as ReceiptTag)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TAGS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Profile-specific fields */}
          {form.profile === "company" && (
            <div>
              <Label htmlFor="project">โครงการ/ลูกค้า</Label>
              <Input id="project" placeholder="เช่น คอนโด ABC" value={form.project} onChange={(e) => form.setProject(e.target.value)} className="mt-1" />
            </div>
          )}

          <div>
            <Label htmlFor="desc">หมายเหตุ</Label>
            <Textarea id="desc" placeholder="รายละเอียดเพิ่มเติม..." value={form.description} onChange={(e) => form.setDescription(e.target.value)} className={`mt-1 ${lowConfCls}`} rows={2} />
          </div>

          {/* Items */}
          <div>
            <Label>รายการสินค้า/บริการ</Label>
            <div className="mt-2 space-y-3">
              {form.items.map((item, idx) => (
                <div key={idx} className="space-y-1.5 p-3 rounded-lg bg-muted/50 border border-border/50 sm:p-0 sm:bg-transparent sm:border-0 sm:space-y-0 sm:flex sm:items-center sm:gap-2">
                  <Input placeholder="ชื่อรายการ" value={item.name} onChange={(e) => form.updateItem(idx, "name", e.target.value)} className={`flex-1 h-11 ${lowConfCls}`} />
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} value={item.quantity} onChange={(e) => form.updateItem(idx, "quantity", parseInt(e.target.value) || 1)} className={`w-20 h-11 text-center ${lowConfCls}`} placeholder="จำนวน" />
                    <Input type="number" min={0} step={0.01} placeholder="ราคา" value={item.price || ""} onChange={(e) => form.updateItem(idx, "price", parseFloat(e.target.value) || 0)} className={`flex-1 sm:w-28 h-11 ${lowConfCls}`} />
                    {form.items.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-muted-foreground" onClick={() => form.removeItem(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" className="mt-2 text-primary h-11" onClick={form.addItem}>
              <Plus className="h-4 w-4 mr-1" /> เพิ่มรายการ
            </Button>
          </div>

          {/* VAT Toggle */}
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted">
            <Label htmlFor="vat" className="cursor-pointer">คิด VAT 7%</Label>
            <Switch id="vat" checked={form.vatEnabled} onCheckedChange={form.setVatEnabled} />
          </div>

          {/* Total */}
          <div className="space-y-1 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">ยอดรวม</span>
              <span className="font-medium">฿{form.totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
            </div>
            {form.vatEnabled && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">VAT 7%</span>
                <span className="font-medium text-accent">฿{form.vatAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="font-medium text-muted-foreground">ยอดรวมสุทธิ</span>
              <span className="text-2xl font-bold font-display text-primary">
                ฿{form.grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Reimbursement note - company only */}
          {form.profile === "company" && (
            <div>
              <Label htmlFor="reimburse">หมายเหตุการเบิก</Label>
              <Input id="reimburse" placeholder="เช่น เบิกจากโครงการ X" value={form.reimbursementNote} onChange={(e) => form.setReimbursementNote(e.target.value)} className="mt-1" />
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={form.saving}>
            {form.saving ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />กำลังอัปโหลด...</>
            ) : isEditing ? "💾 บันทึกการแก้ไข" : "บันทึกใบเสร็จ"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
