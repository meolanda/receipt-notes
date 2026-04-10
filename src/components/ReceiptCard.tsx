import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, ImageIcon, Copy, Trash2, FileText, Pencil } from "lucide-react";
import { type Receipt, TAG_COLORS, CATEGORY_COLORS } from "@/lib/receipt-store";

const DOC_TYPE_LABELS: Record<string, string> = {
  receipt: "ใบเสร็จ",
  quotation: "ใบเสนอราคา",
  tax_invoice: "ใบกำกับภาษี",
  invoice: "ใบแจ้งหนี้",
  bank_slip: "สลิปโอนเงิน",
  market_bill: "บิลตลาด/มือเขียน",
  other: "อื่นๆ",
};

const DOC_TYPE_COLORS: Record<string, string> = {
  receipt: "bg-emerald-100 text-emerald-700 border-emerald-200",
  quotation: "bg-purple-100 text-purple-700 border-purple-200",
  tax_invoice: "bg-blue-100 text-blue-700 border-blue-200",
  invoice: "bg-indigo-100 text-indigo-700 border-indigo-200",
  bank_slip: "bg-cyan-100 text-cyan-700 border-cyan-200",
  market_bill: "bg-amber-100 text-amber-700 border-amber-200",
  other: "bg-gray-100 text-gray-700 border-gray-200",
};

interface ReceiptCardProps {
  receipt: Receipt;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (receipt: Receipt) => void;
  onEdit: (receipt: Receipt) => void;
}

export default function ReceiptCard({ receipt: r, isExpanded, onToggle, onDelete, onDuplicate, onEdit }: ReceiptCardProps) {
  const savedDate = r.createdAt ? r.createdAt.slice(0, 10) : null;
  const isDifferentDay = savedDate && savedDate !== r.date;

  return (
    <Card className="receipt-shadow overflow-hidden transition-all">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={onToggle}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{r.title}</span>
              {r.documentType && (
                <Badge variant="outline" className={`text-xs ${DOC_TYPE_COLORS[r.documentType] || DOC_TYPE_COLORS.other}`}>
                  <FileText className="h-3 w-3 mr-0.5" />
                  {DOC_TYPE_LABELS[r.documentType] || r.documentType}
                </Badge>
              )}
              <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[r.category] || ""}`}>
                {r.category}
              </Badge>
              <Badge variant="outline" className={`text-xs ${TAG_COLORS[r.tag] || ""}`}>
                {r.tag}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              📅 {r.date}
              {r.storeName && <span> · {r.storeName}</span>}
              {r.project && <span> · {r.project}</span>}
            </p>
            {/* แสดงวันที่บันทึกถ้าต่างจากวันที่ในใบเสร็จ */}
            {isDifferentDay && (
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                🕐 บันทึก {savedDate}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-bold font-display text-primary">฿{r.grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-border space-y-3 fade-in">
            {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}

            {/* แสดงรูปจาก Firebase Storage หรือ base64 */}
            {(r.imageUrl || r.imageData) && (
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                {r.imageUrl ? (
                  <img
                    src={r.imageUrl}
                    alt="ใบเสร็จ"
                    className="max-h-40 rounded-md border border-border cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); window.open(r.imageUrl, "_blank"); }}
                  />
                ) : r.imageData ? (
                  <img src={r.imageData} alt="ใบเสร็จ" className="max-h-40 rounded-md border border-border" />
                ) : null}
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

            <div className="flex justify-end gap-1 sm:gap-2 flex-wrap">
              <Button variant="ghost" size="sm" className="text-primary h-11 px-3" onClick={(e) => { e.stopPropagation(); onEdit(r); }}>
                <Pencil className="h-4 w-4 mr-1" /> แก้ไข
              </Button>
              <Button variant="ghost" size="sm" className="text-primary h-11 px-3" onClick={(e) => { e.stopPropagation(); onDuplicate(r); }}>
                <Copy className="h-4 w-4 mr-1" /> คัดลอก
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-11 px-3" onClick={(e) => { e.stopPropagation(); onDelete(r.id); }}>
                <Trash2 className="h-4 w-4 mr-1" /> ลบ
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
