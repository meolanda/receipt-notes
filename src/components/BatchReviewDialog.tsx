import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, SkipForward, AlertTriangle, PenLine, CheckCircle2, Loader2, FileX } from "lucide-react";
import { getCategoriesForProfile, type Profile } from "@/lib/receipt-store";
import type { PendingReviewItem, ReviewEdits } from "@/hooks/useBatchScan";

interface BatchReviewDialogProps {
  items: PendingReviewItem[];
  reviewTotal: number;
  profile: Profile;
  onSave: (item: PendingReviewItem, edits: ReviewEdits) => void;
  onSkip: (item: PendingReviewItem) => void;
  onSaveAll: (editsMap: Record<string, ReviewEdits>) => Promise<void>;
}

function initEditsForItem(item: PendingReviewItem, categories: string[]): ReviewEdits {
  const r = item.result;
  const currentYear = new Date().getFullYear();
  let date = r.date || new Date().toISOString().slice(0, 10);

  // แก้ปีอัตโนมัติถ้า OCR อ่านผิด
  const parts = date.split("-");
  if (parts.length === 3) {
    const yr = parseInt(parts[0]);
    if (!isNaN(yr) && (yr < currentYear - 2 || yr > currentYear + 1)) {
      date = `${currentYear}-${parts[1]}-${parts[2]}`;
    }
  }

  const category =
    r.document_type === "market_bill" && categories.includes("อาหาร")
      ? "อาหาร"
      : categories[0] || "อื่นๆ";

  return {
    storeName: r.store_name || r.recipient_name || "",
    date,
    grandTotal: r.total ?? 0,
    category,
  };
}

export default function BatchReviewDialog({
  items, reviewTotal, profile, onSave, onSkip, onSaveAll,
}: BatchReviewDialogProps) {
  const categories = getCategoriesForProfile(profile);
  const [editsMap, setEditsMap] = useState<Record<string, ReviewEdits>>({});
  const [savingAll, setSavingAll] = useState(false);

  const current = items[0];
  const doneCount = reviewTotal - items.length;
  const progressPct = reviewTotal > 0 ? (doneCount / reviewTotal) * 100 : 0;

  // Init edits สำหรับ item ปัจจุบัน
  useEffect(() => {
    if (!current) return;
    setEditsMap((prev) => {
      if (prev[current.id]) return prev;
      return { ...prev, [current.id]: initEditsForItem(current, categories) };
    });
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null;

  const edits = editsMap[current.id] || initEditsForItem(current, categories);

  const updateEdit = (field: keyof ReviewEdits, value: string | number) => {
    setEditsMap((prev) => ({
      ...prev,
      [current.id]: { ...prev[current.id], [field]: value },
    }));
  };

  // ตรวจสอบปีที่น่าสงสัย
  const currentYear = new Date().getFullYear();
  const scannedYear = edits.date ? parseInt(edits.date.slice(0, 4)) : 0;
  const isYearSuspicious =
    scannedYear > 0 && (scannedYear < currentYear - 2 || scannedYear > currentYear + 1);

  const handleSave = () => onSave(current, edits);
  const handleSkip = () => onSkip(current);

  const handleSaveAll = async () => {
    setSavingAll(true);
    // build edits สำหรับทุกใบที่เหลือ (ใช้ค่า AI ถ้ายังไม่ได้แก้)
    const allEdits: Record<string, ReviewEdits> = { ...editsMap };
    for (const item of items) {
      if (!allEdits[item.id]) {
        allEdits[item.id] = initEditsForItem(item, categories);
      }
    }
    try {
      await onSaveAll(allEdits);
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">

      {/* ── Header + Progress ── */}
      <div className="px-4 pt-4 pb-3 border-b shrink-0 bg-background">
        <div className="flex items-center justify-between mb-2">
          {/* Badge เหตุผล */}
          <div className="flex gap-1.5 flex-wrap">
            {current.manualEntry ? (
              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-300">
                <PenLine className="h-3 w-3 mr-1" />สแกนไม่ได้
              </Badge>
            ) : current.result.confidence === "low" ? (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                <AlertTriangle className="h-3 w-3 mr-1" />AI ไม่มั่นใจ
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                ตรวจสอบก่อนบันทึก
              </Badge>
            )}
          </div>
          {/* ตัวเลข progress */}
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
            {doneCount + 1} / {reviewTotal}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* ชื่อไฟล์ */}
        <p className="text-xs text-muted-foreground mt-1.5 truncate">📄 {current.fileName}</p>
      </div>

      {/* ── รูปใบเสร็จ — ใหญ่ขึ้น ── */}
      {current.imageData ? (
        <div
          className="shrink-0 bg-muted flex items-center justify-center overflow-hidden"
          style={{ height: "48vh" }}
        >
          <img
            src={current.imageData}
            alt="ใบเสร็จ"
            className="h-full w-full object-contain"
          />
        </div>
      ) : (
        <div
          className="shrink-0 bg-muted flex flex-col items-center justify-center gap-2"
          style={{ height: "16vh" }}
        >
          <FileX className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">ไม่มีรูปภาพ</p>
        </div>
      )}

      {/* ── Form — 3 field หลัก ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <div>
          <Label className="text-sm">ร้านค้า / ชื่อรายการ</Label>
          <Input
            value={edits.storeName}
            onChange={(e) => updateEdit("storeName", e.target.value)}
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
              value={edits.date}
              onChange={(e) => updateEdit("date", e.target.value)}
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
              value={edits.grandTotal}
              onChange={(e) => updateEdit("grandTotal", parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="mt-1 h-11"
              step="0.01"
              min="0"
            />
          </div>
        </div>

        <div>
          <Label className="text-sm">หมวดหมู่</Label>
          <Select value={edits.category} onValueChange={(v) => updateEdit("category", v)}>
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

      {/* ── Buttons ── */}
      <div className="px-4 py-3 border-t shrink-0 bg-background grid grid-cols-3 gap-2">
        {/* ข้าม */}
        <Button
          variant="outline"
          className="h-12 gap-1.5 text-muted-foreground"
          onClick={handleSkip}
        >
          <SkipForward className="h-4 w-4" />
          ข้าม
        </Button>

        {/* บันทึกใบนี้ */}
        <Button
          className="h-12 gap-1.5"
          onClick={handleSave}
        >
          <Save className="h-4 w-4" />
          บันทึก
        </Button>

        {/* บันทึกที่เหลือทั้งหมด */}
        <Button
          variant="secondary"
          className="h-12 gap-1 text-xs leading-tight"
          onClick={handleSaveAll}
          disabled={savingAll}
        >
          {savingAll ? (
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          )}
          <span>{savingAll ? "กำลังบันทึก..." : "บันทึกที่เหลือ"}</span>
        </Button>
      </div>
    </div>
  );
}
