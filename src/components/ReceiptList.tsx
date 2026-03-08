import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search, Trash2, ChevronDown, ChevronUp, ImageIcon, Copy } from "lucide-react";
import SyncButton from "@/components/SyncButton";
import {
  type Receipt, type Profile, deleteReceipt, downloadCSV,
  CATEGORIES, TAGS, TAG_COLORS, CATEGORY_COLORS
} from "@/lib/receipt-store";
import { toast } from "sonner";

interface ReceiptListProps {
  receipts: Receipt[];
  profile: Profile;
  onChanged: () => void;
  onDuplicate: (receipt: Receipt) => void;
}

type SortKey = "date" | "amount";

export default function ReceiptList({ receipts, profile, onChanged, onDuplicate }: ReceiptListProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("date");

  let filtered = receipts.filter((r) => r.profile === profile);

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.category.includes(search) ||
        r.project?.toLowerCase().includes(q)
    );
  }
  if (filterCategory !== "all") {
    filtered = filtered.filter((r) => r.category === filterCategory);
  }
  if (filterTag !== "all") {
    filtered = filtered.filter((r) => r.tag === filterTag);
  }
  if (dateFrom) {
    filtered = filtered.filter((r) => r.date >= dateFrom);
  }
  if (dateTo) {
    filtered = filtered.filter((r) => r.date <= dateTo);
  }

  filtered.sort((a, b) => {
    if (sortBy === "amount") return b.grandTotal - a.grandTotal;
    return b.date.localeCompare(a.date);
  });

  const totalAll = filtered.reduce((sum, r) => sum + r.grandTotal, 0);

  const handleDelete = (id: string) => {
    deleteReceipt(id);
    toast.success("ลบใบเสร็จแล้ว");
    onChanged();
  };

  const profileLabel = profile === "personal" ? "ส่วนตัว" : "บริษัท";

  return (
    <div className="space-y-4 fade-in">
      {/* Header */}
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="ค้นหาใบเสร็จ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-2">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="text-xs h-9">
            <SelectValue placeholder="หมวดหมู่" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="text-xs h-9">
            <SelectValue placeholder="แท็ก" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกแท็ก</SelectItem>
            {TAGS.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" placeholder="จากวันที่" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-xs h-9" />
        <Input type="date" placeholder="ถึงวันที่" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-xs h-9" />
      </div>
      <div className="flex gap-2">
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="text-xs h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">เรียงตามวันที่</SelectItem>
            <SelectItem value="amount">เรียงตามยอดเงิน</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sync to Google */}
      <SyncButton receipts={filtered} />

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-4xl mb-2">🧾</p>
          <p>{receipts.length === 0 ? "ยังไม่มีใบเสร็จ" : "ไม่พบผลลัพธ์"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const isExpanded = expandedId === r.id;
            return (
              <Card key={r.id} className="receipt-shadow overflow-hidden transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{r.title}</span>
                        <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[r.category] || ""}`}>
                          {r.category}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${TAG_COLORS[r.tag] || ""}`}>
                          {r.tag}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.date}
                        {r.project && <span> · {r.project}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold font-display text-primary">฿{r.grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border space-y-3 fade-in">
                      {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}

                      {r.imageData && (
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <img src={r.imageData} alt="ใบเสร็จ" className="max-h-40 rounded-md border border-border" />
                        </div>
                      )}

                      {r.items.length > 0 && r.items.some(i => i.name) && (
                        <div className="bg-muted rounded-lg p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2">รายการ</p>
                          {r.items.filter(i => i.name).map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm py-0.5">
                              <span>{item.name} <span className="text-muted-foreground">x{item.quantity}</span></span>
                              <span className="font-medium">฿{(item.quantity * item.price).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {r.vatEnabled && (
                        <div className="text-sm text-muted-foreground">
                          VAT 7%: ฿{r.vatAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </div>
                      )}

                      {r.reimbursementNote && (
                        <div className="text-sm text-muted-foreground">
                          📝 {r.reimbursementNote}
                        </div>
                      )}

                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="text-primary" onClick={(e) => { e.stopPropagation(); onDuplicate(r); }}>
                          <Copy className="h-3.5 w-3.5 mr-1" /> คัดลอก
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}>
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> ลบ
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
