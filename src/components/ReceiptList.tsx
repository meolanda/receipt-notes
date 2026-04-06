import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import SyncButton from "@/components/SyncButton";
import FilterBar, { type SortKey } from "@/components/FilterBar";
import ReceiptCard from "@/components/ReceiptCard";
import ReceiptEmptyState from "@/components/ReceiptEmptyState";
import { type Receipt, type Profile, deleteReceipt, downloadCSV } from "@/lib/receipt-store";
import { isServerSyncAvailable, deleteReceiptFromServer } from "@/lib/server-sync";
import { toast } from "sonner";

interface ReceiptListProps {
  receipts: Receipt[];
  profile: Profile;
  onChanged: () => void;
  onDuplicate: (receipt: Receipt) => void;
  onEdit: (receipt: Receipt) => void;
}

const PAGE_SIZE = 20;

export default function ReceiptList({ receipts, profile, onChanged, onDuplicate, onEdit }: ReceiptListProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [filterDocType, setFilterDocType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  let filtered = receipts.filter((r) => r.profile === profile);

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.category.includes(search) ||
        r.storeName?.toLowerCase().includes(q) ||
        r.project?.toLowerCase().includes(q)
    );
  }
  if (filterCategory !== "all") filtered = filtered.filter((r) => r.category === filterCategory);
  if (filterTag !== "all") filtered = filtered.filter((r) => r.tag === filterTag);
  if (filterDocType !== "all") filtered = filtered.filter((r) => r.documentType === filterDocType);
  if (dateFrom) filtered = filtered.filter((r) => r.date >= dateFrom);
  if (dateTo) filtered = filtered.filter((r) => r.date <= dateTo);

  filtered.sort((a, b) => sortBy === "amount" ? b.grandTotal - a.grandTotal : b.date.localeCompare(a.date));

  // Reset pagination เมื่อ filter/search เปลี่ยน
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, filterCategory, filterTag, filterDocType, dateFrom, dateTo, sortBy, profile]);

  const totalAll = filtered.reduce((sum, r) => sum + r.grandTotal, 0);
  const visibleReceipts = filtered.slice(0, visibleCount);
  const profileLabel = profile === "personal" ? "ส่วนตัว" : "บริษัท";

  const handleDelete = (id: string) => {
    deleteReceipt(id);
    toast.success("ลบใบเสร็จแล้ว");
    onChanged();
    if (isServerSyncAvailable()) {
      deleteReceiptFromServer(id).catch((err) => console.error("Delete sync error:", err));
    }
  };

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">ประวัติใบเสร็จ ({profileLabel})</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} รายการ · รวม ฿{totalAll.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
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
      />

      <SyncButton receipts={filtered} />

      {filtered.length === 0 ? (
        <ReceiptEmptyState hasReceipts={receipts.length > 0} />
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
