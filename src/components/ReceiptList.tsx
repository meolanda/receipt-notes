import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download, Search, Trash2, ChevronDown, ChevronUp, ImageIcon } from "lucide-react";
import { type Receipt, deleteReceipt, downloadCSV } from "@/lib/receipt-store";
import { toast } from "sonner";

interface ReceiptListProps {
  receipts: Receipt[];
  onChanged: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  "อาหาร": "bg-orange-100 text-orange-700 border-orange-200",
  "เดินทาง": "bg-blue-100 text-blue-700 border-blue-200",
  "ช้อปปิ้ง": "bg-pink-100 text-pink-700 border-pink-200",
  "สาธารณูปโภค": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "สุขภาพ": "bg-green-100 text-green-700 border-green-200",
  "การศึกษา": "bg-indigo-100 text-indigo-700 border-indigo-200",
  "บันเทิง": "bg-purple-100 text-purple-700 border-purple-200",
  "อื่นๆ": "bg-gray-100 text-gray-700 border-gray-200",
};

export default function ReceiptList({ receipts, onChanged }: ReceiptListProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = receipts.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase()) ||
      r.category.includes(search)
  );

  const totalAll = filtered.reduce((sum, r) => sum + r.totalAmount, 0);

  const handleDelete = (id: string) => {
    deleteReceipt(id);
    toast.success("ลบใบเสร็จแล้ว");
    onChanged();
  };

  return (
    <div className="space-y-4 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">ประวัติใบเสร็จ</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} รายการ · รวม ฿{totalAll.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
        </div>
        {receipts.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => downloadCSV(receipts)}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="ค้นหาใบเสร็จ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

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
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{r.date}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold font-display text-primary">฿{r.totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
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

                      <div className="flex justify-end">
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
