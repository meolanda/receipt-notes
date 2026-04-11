import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, SkipForward, AlertTriangle, PenLine, CheckCircle2, ChevronRight, Loader2, FileX } from "lucide-react";
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

  // Auto-correct year
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  // Init edits เมื่อ items เปลี่ยน
  useEffect(() => {
    setEditsMap((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (!next[item.id]) {
          next[item.id] = initEditsForItem(item, categories);
        }
      }
      // ลบ item ที่ถูก save/skip ออกแล้ว
      for (const id of Object.keys(next)) {
        if (!items.find((i) => i.id === id)) delete next[id];
      }
      return next;
    });
    // ถ้า selectedId ถูกลบออกแล้ว ให้กลับ list
    setSelectedId((prev) => {
      if (prev && !items.find((i) => i.id === prev)) return null;
      return prev;
    });
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateEdit = (id: string, field: keyof ReviewEdits, value: string | number) => {
    setEditsMap((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleSaveAll = async () => {
    setSavingAll(true);
    try {
      await onSaveAll(editsMap);
    } finally {
      setSavingAll(false);
    }
  };

  if (items.length === 0) return null;

  // ════════════════════════════════════════
  // DETAIL VIEW — เมื่อกดเข้าดูรายละเอียด
  // ════════════════════════════════════════
  const selectedItem = selectedId ? items.find((i) => i.id === selectedId) : null;
  if (selectedItem) {
    const edits = editsMap[selectedItem.id] || initEditsForItem(selectedItem, categories);
    const idx = items.findIndex((i) => i.id === selectedId);
    const currentYear = new Date().getFullYear();
    const scannedYear = edits.date ? parseInt(edits.date.slice(0, 4)) : 0;
    const isYearSuspicious =
      scannedYear > 0 && (scannedYear < currentYear - 2 || scannedYear > currentYear + 1);

    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0 bg-background">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setSelectedId(null)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">ตรวจสอบใบเสร็จ</p>
            <p className="text-xs text-muted-foreground truncate">
              {idx + 1}/{items.length} · {selectedItem.fileName}
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            {selectedItem.manualEntry ? (
              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-300">
                <PenLine className="h-3 w-3 mr-1" />กรอกเอง
              </Badge>
            ) : selectedItem.result.confidence === "low" ? (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                <AlertTriangle className="h-3 w-3 mr-1" />ไม่มั่นใจ
              </Badge>
            ) : null}
          </div>
        </div>

        {/* รูปใบเสร็จ — ใหญ่ขึ้น */}
        {selectedItem.imageData ? (
          <div
            className="shrink-0 bg-muted flex items-center justify-center overflow-hidden"
            style={{ height: "42vh" }}
          >
            <img
              src={selectedItem.imageData}
              alt="ใบเสร็จ"
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <div
            className="shrink-0 bg-muted flex flex-col items-center justify-center gap-2"
            style={{ height: "18vh" }}
          >
            <FileX className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">ไม่มีรูปภาพ</p>
          </div>
        )}

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <div>
            <Label className="text-sm">ร้านค้า / ชื่อรายการ</Label>
            <Input
              value={edits.storeName}
              onChange={(e) => updateEdit(selectedItem.id, "storeName", e.target.value)}
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
                onChange={(e) => updateEdit(selectedItem.id, "date", e.target.value)}
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
                onChange={(e) =>
                  updateEdit(selectedItem.id, "grandTotal", parseFloat(e.target.value) || 0)
                }
                placeholder="0.00"
                className="mt-1 h-11"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm">หมวดหมู่</Label>
            <Select
              value={edits.category}
              onValueChange={(v) => updateEdit(selectedItem.id, "category", v)}
            >
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

        {/* Actions */}
        <div className="flex gap-2 px-4 py-3 border-t shrink-0 bg-background">
          <Button
            variant="outline"
            className="flex-1 h-12 gap-2 text-muted-foreground"
            onClick={() => {
              onSkip(selectedItem);
              setSelectedId(null);
            }}
          >
            <SkipForward className="h-4 w-4" />
            ข้าม
          </Button>
          <Button
            className="flex-[2] h-12 gap-2"
            onClick={() => {
              onSave(selectedItem, edits);
              setSelectedId(null);
            }}
          >
            <Save className="h-4 w-4" />
            บันทึก
          </Button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════
  // LIST VIEW — ภาพรวมทุกใบ
  // ════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b shrink-0 bg-background">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-base">รอตรวจสอบ {items.length} ใบ</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              แตะใบไหนก็ได้เพื่อแก้ไข หรือบันทึกทั้งหมดด้วยค่าที่ AI อ่านมา
            </p>
          </div>
          <Button
            className="gap-2 h-10 shrink-0"
            onClick={handleSaveAll}
            disabled={savingAll}
          >
            {savingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {savingAll ? "กำลังบันทึก..." : "บันทึกทั้งหมด"}
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.map((item) => {
          const edits = editsMap[item.id];
          const storeName = edits?.storeName || "ไม่ทราบร้าน";
          const total = edits?.grandTotal ?? 0;
          const date = edits?.date || "";

          return (
            <div
              key={item.id}
              className="border border-border rounded-xl overflow-hidden bg-card shadow-sm"
            >
              {/* แตะเพื่อดูรายละเอียด */}
              <button
                className="w-full flex gap-3 items-center p-3 text-left active:bg-muted/50 transition-colors"
                onClick={() => setSelectedId(item.id)}
              >
                {/* Thumbnail */}
                <div className="shrink-0 w-[68px] h-[68px] rounded-lg overflow-hidden bg-muted flex items-center justify-center border border-border/50">
                  {item.imageData ? (
                    <img
                      src={item.imageData}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl">📄</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">
                    {storeName || <span className="text-muted-foreground italic">ไม่ทราบร้าน</span>}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {date} · ฿{total.toLocaleString("th-TH", { minimumFractionDigits: 0 })}
                  </p>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {item.manualEntry ? (
                      <Badge
                        variant="outline"
                        className="text-xs py-0 h-5 bg-orange-50 text-orange-700 border-orange-200"
                      >
                        <PenLine className="h-3 w-3 mr-0.5" />กรอกเอง
                      </Badge>
                    ) : item.result.confidence === "low" ? (
                      <Badge
                        variant="outline"
                        className="text-xs py-0 h-5 bg-amber-50 text-amber-700 border-amber-200"
                      >
                        <AlertTriangle className="h-3 w-3 mr-0.5" />ไม่มั่นใจ
                      </Badge>
                    ) : null}
                  </div>
                </div>

                {/* Chevron */}
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </button>

              {/* Quick skip */}
              <div className="border-t border-border/40 px-3 py-1.5 flex justify-end bg-muted/30">
                <button
                  className="text-xs text-muted-foreground flex items-center gap-1 active:opacity-60 py-0.5"
                  onClick={() => onSkip(item)}
                >
                  <SkipForward className="h-3 w-3" />
                  ข้ามใบนี้
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
