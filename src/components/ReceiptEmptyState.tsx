import { Receipt, Search } from "lucide-react";

interface ReceiptEmptyStateProps {
  hasReceipts: boolean;
}

export default function ReceiptEmptyState({ hasReceipts }: ReceiptEmptyStateProps) {
  if (hasReceipts) {
    return (
      <div className="text-center py-16 fade-in">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <Search className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-lg font-medium text-foreground mb-1">ไม่พบผลลัพธ์</p>
        <p className="text-sm text-muted-foreground">ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p>
      </div>
    );
  }

  return (
    <div className="text-center py-16 fade-in">
      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
        <Receipt className="h-9 w-9 text-muted-foreground" />
      </div>
      <p className="text-lg font-medium text-foreground mb-1">ยังไม่มีใบเสร็จ</p>
      <p className="text-sm text-muted-foreground">เริ่มบันทึกใบเสร็จใบแรกของคุณเลย!</p>
    </div>
  );
}
