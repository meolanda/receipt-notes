import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { TAGS, getCategoriesForProfile, type Profile } from "@/lib/receipt-store";

const DOC_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "ทุกประเภทเอกสาร" },
  { value: "receipt", label: "ใบเสร็จ" },
  { value: "quotation", label: "ใบเสนอราคา" },
  { value: "tax_invoice", label: "ใบกำกับภาษี" },
  { value: "invoice", label: "ใบแจ้งหนี้" },
  { value: "bank_slip", label: "สลิปโอนเงิน" },
  { value: "market_bill", label: "บิลตลาด/มือเขียน" },
];

export type SortKey = "date" | "amount" | "createdAt";
export type DateMode = "receipt" | "saved";

interface FilterBarProps {
  profile: Profile;
  search: string;
  onSearchChange: (v: string) => void;
  filterCategory: string;
  onFilterCategoryChange: (v: string) => void;
  filterTag: string;
  onFilterTagChange: (v: string) => void;
  filterDocType: string;
  onFilterDocTypeChange: (v: string) => void;
  dateFrom: string;
  onDateFromChange: (v: string) => void;
  dateTo: string;
  onDateToChange: (v: string) => void;
  sortBy: SortKey;
  onSortChange: (v: SortKey) => void;
  dateMode: DateMode;
  onDateModeChange: (v: DateMode) => void;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function nDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function startOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function FilterBar({
  profile, search, onSearchChange,
  filterCategory, onFilterCategoryChange,
  filterTag, onFilterTagChange,
  filterDocType, onFilterDocTypeChange,
  dateFrom, onDateFromChange,
  dateTo, onDateToChange,
  sortBy, onSortChange,
  dateMode, onDateModeChange,
}: FilterBarProps) {
  const categories = getCategoriesForProfile(profile);
  const todayStr = today();

  // Quick filter active state
  const isQuickToday = dateFrom === todayStr && dateTo === todayStr;
  const isQuick7 = dateFrom === nDaysAgo(6) && dateTo === todayStr;
  const isQuickMonth = dateFrom === startOfMonth() && dateTo === todayStr;
  const hasDateFilter = dateFrom || dateTo;

  const setQuick = (from: string, to: string) => {
    onDateFromChange(from);
    onDateToChange(to);
  };

  const clearDate = () => {
    onDateFromChange("");
    onDateToChange("");
  };

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ค้นหาชื่อ, ร้านค้า, หมวดหมู่..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-11"
        />
        {search && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => onSearchChange("")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Date mode toggle */}
      <div className="flex rounded-lg overflow-hidden border border-border text-sm">
        <button
          type="button"
          onClick={() => onDateModeChange("receipt")}
          className={`flex-1 py-2 font-medium transition-colors ${
            dateMode === "receipt"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          📅 วันที่ในใบเสร็จ
        </button>
        <button
          type="button"
          onClick={() => onDateModeChange("saved")}
          className={`flex-1 py-2 font-medium transition-colors ${
            dateMode === "saved"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          🕐 วันที่บันทึก
        </button>
      </div>

      {/* Quick date filters (ใช้งานได้ทั้งสอง mode) */}
      <div className="flex gap-2 flex-wrap">
        <Button
          type="button"
          size="sm"
          variant={isQuickToday ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={() => isQuickToday ? clearDate() : setQuick(todayStr, todayStr)}
        >
          วันนี้
        </Button>
        <Button
          type="button"
          size="sm"
          variant={isQuick7 ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={() => isQuick7 ? clearDate() : setQuick(nDaysAgo(6), todayStr)}
        >
          7 วันล่าสุด
        </Button>
        <Button
          type="button"
          size="sm"
          variant={isQuickMonth ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={() => isQuickMonth ? clearDate() : setQuick(startOfMonth(), todayStr)}
        >
          เดือนนี้
        </Button>
        {hasDateFilter && !isQuickToday && !isQuick7 && !isQuickMonth && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-muted-foreground"
            onClick={clearDate}
          >
            <X className="h-3 w-3 mr-1" /> ล้างวันที่
          </Button>
        )}
      </div>

      {/* Filters grid */}
      <div className="grid grid-cols-2 gap-2">
        <Select value={filterCategory} onValueChange={onFilterCategoryChange}>
          <SelectTrigger className="text-xs sm:text-sm h-11"><SelectValue placeholder="หมวดหมู่" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterTag} onValueChange={onFilterTagChange}>
          <SelectTrigger className="text-xs sm:text-sm h-11"><SelectValue placeholder="แท็ก" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกแท็ก</SelectItem>
            {TAGS.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterDocType} onValueChange={onFilterDocTypeChange}>
          <SelectTrigger className="text-xs sm:text-sm h-11"><SelectValue placeholder="ประเภทเอกสาร" /></SelectTrigger>
          <SelectContent>
            {DOC_TYPE_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => onSortChange(v as SortKey)}>
          <SelectTrigger className="text-xs sm:text-sm h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">เรียงตามวันที่บันทึก</SelectItem>
            <SelectItem value="date">เรียงตามวันที่ใบเสร็จ</SelectItem>
            <SelectItem value="amount">เรียงตามยอดเงิน</SelectItem>
          </SelectContent>
        </Select>

        {/* Custom date range */}
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="text-xs h-11"
          title={dateMode === "saved" ? "วันที่บันทึก (ตั้งแต่)" : "วันที่ในใบเสร็จ (ตั้งแต่)"}
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="text-xs h-11"
          title={dateMode === "saved" ? "วันที่บันทึก (ถึง)" : "วันที่ในใบเสร็จ (ถึง)"}
        />
      </div>

      {/* Label บอก mode ปัจจุบัน */}
      {hasDateFilter && (
        <p className="text-xs text-muted-foreground text-center">
          {dateMode === "saved"
            ? "🕐 กรองตามวันที่บันทึกลงระบบ"
            : "📅 กรองตามวันที่ในใบเสร็จ"}
          {(dateFrom || dateTo) && (
            <span>
              {" "}({dateFrom || "..."} → {dateTo || "..."})
            </span>
          )}
        </p>
      )}
    </div>
  );
}
