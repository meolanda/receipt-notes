import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import FilterBar, { type SortKey, type DateMode } from "@/components/FilterBar";
import ReceiptCard from "@/components/ReceiptCard";
import ReceiptEmptyState from "@/components/ReceiptEmptyState";
import { type Receipt, type Profile, downloadCSV } from "@/lib/receipt-store";
import { deleteReceiptFS } from "@/lib/firestore-store";
import { deleteReceiptImage } from "@/lib/firebase-storage";
import { toast } from "sonner";

interface ReceiptListProps {
  receipts: Receipt[];
  profile: Profile;
  uid: string;
  onChanged: () => void;
  onDuplicate: (receipt: Receipt) => void;
  onEdit: (receipt: Receipt) => void;
}

const PAGE_SIZE = 20;

export default function ReceiptList({ receipts, profile, uid, onChanged, onDuplicate, onEdit }: ReceiptListProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [filterDocType, setFilterDocType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [dateMode, setDateMode] = useState<DateMode>("saved");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());

  // รายการทั้งหมดใน profile นี้ (ไม่นับที่กำลังรอลบ)
  const allInProfile = receipts.filter((r) => r.profile === profile && !pendingDeleteIds.has(r.id));

  // กรองตาม profile + ซ่อนรายการที่กำลังรอลบ
  let filtered = allInProfile.slice();

  // ค้นหา
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.storeName?.toLowerCase().includes(q) ?? false) ||
        (r.project?.toLowerCase().includes(q) ?? false) ||
        (r.tag?.toLowerCase().includes(q) ?? false)
    );
  }

  if (filterCategory !== "all") filtered = filtered.filter((r) => r.category === filterCategory);
  if (filterTag !== "all") filtered = filtered.filter((r) => r.tag === filterTag);
  if (filterDocType !== "all") filtered = filtered.filter((r) => r.documentType === filterDocType);

  if (dateFrom || dateTo) {
    filtered = filtered.filter((r) => {
      const fieldDate = dateMode === "saved"
        ? (r.createdAt ?? r.date).slice(0, 10)
        : r.date;
      if (dateFrom && fieldDate < dateFrom) return false;
      if (dateTo && fieldDate > dateTo) return false;
      return true;
    });
  }

  filtered.sort((a, b) => {
    if (sortBy === "amount") return b.grandTotal - a.grandTotal;
    if (sortBy === "createdAt") return (b.createdAt ?? b.date).localeCompare(a.createdAt ?? a.date);
    return b.date.localeCompare(a.date);
  });

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, filterCategory, filterTag, filterDocType, dateFrom, dateTo, sortBy, dateMode, profile]);

  const totalAll = filtered.reduce((sum, r) => sum + r.grandTotal, 0);
  const visibleReceipts = filtered.slice(0, visibleCount);
  const profileLabel = profile === "personal" ? "ส่วนตัว" : "บริษัท";

  // ลบแบบ Undo — optimistic hide → ลบจริงใน Firestore หลัง 5 วินาที
  const handleDelete = useCallback((id: string) => {
    const receipt = receipts.find((r) => r.id === id);
    if (!receipt) return;

    setPendingDeleteIds((prev) => new Set([...prev, id]));

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      // ลบจาก Firestore
      deleteReceiptFS(uid, id).catch((err) => console.error("Delete error:", err));
      // ลบรูปจาก Storage (ไม่ block)
      deleteReceiptImage(uid, id).catch(() => {});
      setPendingDeleteIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }, 5000);

    toast(`ลบ "${receipt.title}" แล้ว`, {
      description: "กด ↩ ยกเลิก ภายใน 5 วินาที",
      action: {
        label: "↩ ยกเลิก",
        onClick: () => {
          cancelled = true;
          clearTimeout(timeoutId);
          setPendingDeleteIds((prev) => {
            const s = new Set(prev);
            s.delete(id);
            return s;
          });
          toast.success("ยกเลิกการลบแล้ว");
        },
      },
      duration: 5000,
    });
  }, [receipts, uid]);

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">ประวัติใบเสร็จ ({profileLabel})</h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} รายการ · รวม ฿{totalAll.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
          </p>
        </div>
        {filtered.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => downloadCSV(filtered, profileLabel)}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        )}
      </div>

      <FilterBar
        profile={profile}
        search={search} onSearchChange={setSearch}
        filterCategory={filterCategory} onFilterCategoryChange={setFilterCategory}
        filterTag={filterTag} onFilterTagChange={setFilterTag}
        filterDocType={filterDocType} onFilterDocTypeChange={setFilterDocType}
        dateFrom={dateFrom} onDateFromChange={setDateFrom}
        dateTo={dateTo} onDateToChange={setDateTo}
        sortBy={sortBy} onSortChange={setSortBy}
        dateMode={dateMode} onDateModeChange={setDateMode}
      />

      {filtered.length === 0 ? (
        <ReceiptEmptyState hasReceipts={receipts.filter((r) => r.profile === profile).length > 0} />
      ) : (
        <div className="space-y-2">
          {visibleReceipts.map((r) => (
            <ReceiptCard
              key={r.id}
              receipt={r}
              isExpanded={expandedId === r.id}
              onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
              onDelete={handleDelete}
              onDuplicate={onDuplicate}
              onEdit={onEdit}
            />
          ))}
          {visibleCount < filtered.length && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            >
              แสดงเพิ่มเติม ({filtered.length - visibleCount} รายการที่เหลือ)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
