import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Camera, ImageIcon, Plus, Trash2, Receipt, Bot, Loader2, X, Pencil, Upload, RefreshCw, CheckCircle2, SkipForward, AlertTriangle, XCircle, CalendarClock } from "lucide-react";
import { TAGS, type Profile, type ReceiptTag, type Receipt as ReceiptType } from "@/lib/receipt-store";
import { useReceiptForm, DOC_TYPE_LABELS } from "@/hooks/useReceiptForm";
import { useBatchScan } from "@/hooks/useBatchScan";
import BatchReviewDialog from "@/components/BatchReviewDialog";

interface ReceiptFormProps {
  profile: Profile;
  uid: string;
  receipts: ReceiptType[];
  onSaved: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  duplicateData?: ReceiptType | null;
  editData?: ReceiptType | null;
  onCancelEdit?: () => void;
}

export default function ReceiptForm({ profile, uid, receipts, onSaved, onDirtyChange, duplicateData, editData, onCancelEdit }: ReceiptFormProps) {
  const form = useReceiptForm({ profile, uid, receipts, onSaved, onDirtyChange, duplicateData, editData });
  const batch = useBatchScan(profile, uid, receipts, onSaved);
  const lowConfCls = form.isLowConfidence ? "ring-2 ring-yellow-400 bg-yellow-50" : "";

  // ถ้าเลือกหลายรูป → batch, ถ้าเลือกรูปเดียว → single
  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (files.length > 1) {
      batch.handleBatchFiles(files);
    } else {
      form.handleImageUpload(e);
    }
  };
  const isPersonal = form.profile === "personal";
  const isEditing = !!editData;

  return (
    <>
    {/* Dialog ตรวจสอบ low-confidence receipts หลัง batch scan */}
    {batch.pendingReview.length > 0 && (
      <BatchReviewDialog
        items={batch.pendingReview}
        reviewTotal={batch.reviewTotal}
        profile={profile}
        onSave={batch.saveReviewedItem}
        onSkip={batch.skipReviewItem}
      />
    )}
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
            {/* input สำหรับเลือกรูปจากคลัง (รองรับหลายรูปพร้อมกัน) */}
            <input id="galleryInput" type="file" accept="image/*,.pdf,application/pdf" multiple className="hidden" onChange={handleGalleryChange} />
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

          {/* VAT Toggle — ซ่อนถ้าเป็น bank_slip */}
          {form.scanDocType !== "bank_slip" && (
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted">
              <Label htmlFor="vat" className="cursor-pointer">คิด VAT 7%</Label>
              <Switch id="vat" checked={form.vatEnabled} onCheckedChange={form.setVatEnabled} />
            </div>
          )}

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

          <Button type="submit" className="w-full" size="lg" disabled={form.saving || batch.isBatchScanning}>
            {form.saving ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />กำลังอัปโหลด...</>
            ) : isEditing ? "💾 บันทึกการแก้ไข" : "บันทึกใบเสร็จ"}
          </Button>

          {/* Batch scan section */}
          {!isEditing && (
            <div className="pt-3 border-t border-dashed border-border">
              <p className="text-xs text-muted-foreground mb-2 text-center">หรือสแกนหลายรูป / PDF พร้อมกัน (บันทึกอัตโนมัติ)</p>
              <input
                ref={batch.batchInputRef}
                id="batchInput"
                type="file"
                accept="image/*,.pdf,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && batch.handleBatchFiles(e.target.files)}
              />
              {batch.isBatchScanning ? (
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                      <p className="text-sm font-medium">{batch.batchProgress}/{batch.batchTotal}</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-destructive shrink-0" onClick={batch.cancelBatch}>
                      ยกเลิก
                    </Button>
                  </div>
                  {batch.batchCurrentFile && (
                    <p className="text-xs text-muted-foreground truncate">
                      📄 {batch.batchCurrentFile}
                    </p>
                  )}
                  <div className="w-full bg-border rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${batch.batchTotal ? (batch.batchProgress / batch.batchTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed gap-2 text-muted-foreground hover:text-foreground"
                  onClick={() => batch.batchInputRef.current?.click()}
                  disabled={form.saving}
                >
                  <Upload className="h-4 w-4" />
                  อัปโหลดหลายรูป / PDF
                </Button>
              )}

              {/* Summary Card หลัง scan เสร็จ */}
              {!batch.isBatchScanning && batch.batchSummary && (
                <div className="mt-2 rounded-lg border border-border overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-muted">
                    <span className="text-sm font-semibold">ผลการสแกน</span>
                    <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground" onClick={batch.clearSummary}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-y divide-border">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">บันทึกแล้ว</p>
                        <p className="font-bold text-green-700">{batch.batchSummary.saved} ใบ</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <SkipForward className="h-4 w-4 text-blue-500 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">ข้ามซ้ำ</p>
                        <p className="font-bold text-blue-600">{batch.batchSummary.skipped} ใบ</p>
                      </div>
                    </div>
                    {batch.batchSummary.review > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">รอตรวจสอบ</p>
                          <p className="font-bold text-amber-600">{batch.batchSummary.review} ใบ</p>
                        </div>
                      </div>
                    )}
                    {batch.batchSummary.failed > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2">
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">ล้มเหลว</p>
                          <p className="font-bold text-destructive">{batch.batchSummary.failed} ใบ</p>
                        </div>
                      </div>
                    )}
                    {batch.batchSummary.yearFixed > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 col-span-2">
                        <CalendarClock className="h-4 w-4 text-purple-500 shrink-0" />
                        <p className="text-xs text-purple-700">แก้ปีอัตโนมัติ {batch.batchSummary.yearFixed} ใบ (OCR อ่านปีผิด)</p>
                      </div>
                    )}
                  </div>

                  {/* ล้มเหลว: แสดงรายชื่อ + ลองใหม่ */}
                  {batch.failedFiles.length > 0 && (
                    <div className="border-t border-border px-3 py-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-destructive">ไฟล์ที่สแกนไม่ได้:</p>
                        <Button type="button" size="sm" variant="outline"
                          className="h-6 text-xs border-destructive/40 text-destructive gap-1"
                          onClick={batch.retryFailed}>
                          <RefreshCw className="h-3 w-3" /> ลองใหม่
                        </Button>
                      </div>
                      {batch.failedFiles.map((f, i) => (
                        <p key={i} className="text-xs text-destructive/80 truncate">• {f.name}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
    </>
  );
}
