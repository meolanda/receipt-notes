import { Card, CardContent } from "@/components/ui/card";
import { type Receipt } from "@/lib/receipt-store";
import { TrendingUp, CalendarDays, Receipt as ReceiptIcon } from "lucide-react";

interface ExpenseSummaryProps {
  receipts: Receipt[];
}

export default function ExpenseSummary({ receipts }: ExpenseSummaryProps) {
  const now = new Date();
  const thisMonth = receipts.filter((r) => {
    const d = new Date(r.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthTotal = thisMonth.reduce((s, r) => s + r.totalAmount, 0);
  const allTimeTotal = receipts.reduce((s, r) => s + r.totalAmount, 0);

  const stats = [
    {
      label: "เดือนนี้",
      value: `฿${thisMonthTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
      icon: CalendarDays,
      sub: `${thisMonth.length} ใบเสร็จ`,
    },
    {
      label: "ทั้งหมด",
      value: `฿${allTimeTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      sub: `${receipts.length} ใบเสร็จ`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 fade-in">
      {stats.map((s) => (
        <Card key={s.label} className="receipt-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
            </div>
            <p className="text-xl font-bold font-display text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
