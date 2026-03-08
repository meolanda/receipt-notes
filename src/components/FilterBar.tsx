import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
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

export type SortKey = "date" | "amount";

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
}

export default function FilterBar({
  profile, search, onSearchChange,
  filterCategory, onFilterCategoryChange,
  filterTag, onFilterTagChange,
  filterDocType, onFilterDocTypeChange,
  dateFrom, onDateFromChange,
  dateTo, onDateToChange,
  sortBy, onSortChange,
}: FilterBarProps) {
  const categories = getCategoriesForProfile(profile);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="ค้นหาใบเสร็จ..." value={search} onChange={(e) => onSearchChange(e.target.value)} className="pl-9" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={filterCategory} onValueChange={onFilterCategoryChange}>
          <SelectTrigger className="text-xs h-9"><SelectValue placeholder="หมวดหมู่" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterTag} onValueChange={onFilterTagChange}>
          <SelectTrigger className="text-xs h-9"><SelectValue placeholder="แท็ก" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกแท็ก</SelectItem>
            {TAGS.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterDocType} onValueChange={onFilterDocTypeChange}>
          <SelectTrigger className="text-xs h-9"><SelectValue placeholder="ประเภทเอกสาร" /></SelectTrigger>
          <SelectContent>
            {DOC_TYPE_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => onSortChange(v as SortKey)}>
          <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date">เรียงตามวันที่</SelectItem>
            <SelectItem value="amount">เรียงตามยอดเงิน</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" placeholder="จากวันที่" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} className="text-xs h-9" />
        <Input type="date" placeholder="ถึงวันที่" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} className="text-xs h-9" />
      </div>
    </div>
  );
}
