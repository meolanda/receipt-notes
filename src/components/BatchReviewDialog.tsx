import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, SkipForward, AlertTriangle } from "lucide-react";
import { getCategoriesForProfile, type Profile } from "@/lib/receipt-store";
import type { PendingReviewItem, ReviewEdits } from "@/hooks/useBatchScan";

interface BatchReviewDialogProps {
  items: PendingReviewItem[];       // รายการที่รอตรวจ (ลดลงเรื่อยๆ)
  reviewTotal: number;              // จำนวนรวมตั้งแต่ต้น (สำหรับแสดง X/N)
  profile: Profile;
  onSave: (item: PendingReviewItem, edits: ReviewEdits) => void;
  onSkip: (item: PendingReviewItem) => void;
}

export default function BatchReviewDialog({
  items, reviewTotal, profile, onSave, onSkip,
}: BatchReviewDialogProps) {
  const categories = getCategoriesForProfile(profile);
  const current = items[0]; // แสดงอันแรกเสมอ (ลบออกเมื่อ save/skip)

  const [storeName, setStoreName] = useState("");
  const [date, setDate] = useState("");
  const [grandTotal, setGrandTotal] = useState<number | "">(0);
  const [category, setCategory] = useState(categories[0] || "อื่นๆ");

  // Reset form เมื่อ item เปลี่ยน
  useEffect(() => {
    if (!current) return;
    const r = current.result;
    setStoreName(r.store_name || r.recipient_name || "");
    setDate(r.date || new Date().toISOString().slice(0, 10));
    setGrandTotal(r.total ?? 0);
    // เดา category จาก document_type
    const guessCategory =
      r.document_type === "market_bill" && categories.includes("อาหาร")
        ? "อาหาร"
        : categories[0] || "อื่นๆ";
    setCategory(guessCategory);
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null;

  const currentYear = new Date().getFullYear();
  const scannedYear = date ? parseInt(date.slice(0, 4), 10) : 0;
  const isYearSuspicious = scannedYear > 0 && (scannedYear < 2010 || scannedYear > currentYear + 1);

  const doneCount = reviewTotal - items.length; // บันทึก/ข้ามไปแล้วกี่ใบ
  const progressPct = reviewTotal > 0 ? (doneCount / reviewTotal) * 100 : 0;

  const handleSave = () => {
    const total = typeof grandTotal === "number" ? grandTotal : parseFloat(String(grandTotal)) || 0;
    onSave(current, { storeName, date, grandTotal: total, category });
  };

  const handleSkip = () => {
    onSkip(current);
  };

  return (
    <Dialog open modal>
      <DialogContent
        className="max-w-sm w-[95vw] max-h-[92vh] overflow-y-auto p-0"
        onInteractOutside={(e) => e.preventDefault()} // บังคับให้ผ่านทุกใบก่อนปิด
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header */}
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border">
          <DialogTitle className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="text-base">ตรวจสอบก่อนบันทึก</span>
            </div>
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300 shrink-0">
              {doneCount + 1}/{reviewTotal} ใบ
            </Badge>
          </DialogTitle>

          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-1.5 mt-2">
            <div
              className="bg-amber-400 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </DialogHeader>

        <div className="px-4 py-4 space-y-4">
          {/* ชื่อไฟล์ */}
          <p className="text-xs text-muted-foreground truncate">
            📄 {current.fileName}
          </p>

          {/* รูปใบเสร็จ */}
          {current.imageData && (
            <div className="rounded-lg overflow-hidden border border-border bg-muted">
              <img
                src={current.imageData}
                alt="ใบเสร็จ"
                className="w-full max-h-44 object-contain"
              />
            </div>
          )}

          {/* Badge เหตุผล */}
          <div className="flex flex-wrap gap-1.5">
            {current.result.confidence === "low" && (
              <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                ⚠️ AI ไม่มั่นใจ
              </Badge>
            )}
            {isYearSuspicious && (
              <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                📅 ปีอาจผิด ({scannedYear})
              </Badge>
            )}
            {current.result.document_type === "market_bill" && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                ✍️ ลายมือ
              </Badge>
            )}
          </div>

          {/* Form */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm">ร้านค้า / ชื่อรายการ</Label>
              <Input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="ชื่อร้านหรือรายการ"
                className="mt-1 h-11"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm">วันที่</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`mt-1 h-11 ${isYearSuspicious ? "ring-2 ring-yellow-400 bg-yellow-50" : ""}`}
                />
                {isYearSuspicious && (
                  <p className="text-xs text-amber-600 mt-0.5">⚠️ ตรวจสอบปี</p>
                )}
              </div>
              <div>
                <Label className="text-sm">ยอดรวม (฿)</Label>
                <Input
                  type="number"
                  value={grandTotal}
                  onChange={(e) => setGrandTotal(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="mt-1 h-11"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm">หมวดหมู่</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* เหลือกี่ใบ */}
          {items.length > 1 && (
            <p className="text-xs text-center text-muted-foreground">
              เหลืออีก {items.length - 1} ใบที่ต้องตรวจ
            </p>
          )}

          {/* ปุ่ม */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1 h-11 gap-1.5 text-muted-foreground"
              onClick={handleSkip}
            >
              <SkipForward className="h-4 w-4" />
              ข้าม
            </Button>
            <Button
              className="flex-2 flex-1 h-11 gap-1.5 bg-primary"
              onClick={handleSave}
              disabled={!storeName.trim() && !grandTotal}
            >
              <Save className="h-4 w-4" />
              บันทึก
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
