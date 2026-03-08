import { Card, CardContent } from "@/components/ui/card";
import { type Receipt, type Profile, CATEGORY_COLORS } from "@/lib/receipt-store";
import { TrendingUp, CalendarDays, Clock } from "lucide-react";

interface ExpenseSummaryProps {
  receipts: Receipt[];
  profile: Profile;
}

export default function ExpenseSummary({ receipts, profile }: ExpenseSummaryProps) {
  const profileReceipts = receipts.filter((r) => r.profile === profile);
  const now = new Date();
  const thisMonth = profileReceipts.filter((r) => {
    const d = new Date(r.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthTotal = thisMonth.reduce((s, r) => s + r.grandTotal, 0);
  const allTimeTotal = profileReceipts.reduce((s, r) => s + r.grandTotal, 0);
  const pendingReimburse = profileReceipts
    .filter((r) => r.tag === "เบิกได้")
    .reduce((s, r) => s + r.grandTotal, 0);

  // Category breakdown for this profile
  const categoryTotals: Record<string, number> = {};
  profileReceipts.forEach((r) => {
    categoryTotals[r.category] = (categoryTotals[r.category] || 0) + r.grandTotal;
  });
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const maxCatTotal = sortedCategories.length > 0 ? sortedCategories[0][1] : 0;

  // Profile comparison
  const personalTotal = receipts.filter((r) => r.profile === "personal").reduce((s, r) => s + r.grandTotal, 0);
  const companyTotal = receipts.filter((r) => r.profile === "company").reduce((s, r) => s + r.grandTotal, 0);

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
      sub: `${profileReceipts.length} ใบเสร็จ`,
    },
  ];

  return (
    <div className="space-y-4 fade-in">
      <div className="grid grid-cols-2 gap-3">
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

      {/* Pending reimbursement */}
      {pendingReimburse > 0 && (
        <Card className="receipt-shadow border-yellow-200 bg-yellow-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="text-sm font-medium text-yellow-800">รอเบิก</p>
              <p className="text-lg font-bold text-yellow-700">฿{pendingReimburse.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile comparison */}
      <Card className="receipt-shadow">
        <CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">เปรียบเทียบโปรไฟล์</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-orange-600 font-medium">🧑 ส่วนตัว</span>
              <span className="font-bold">฿{personalTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-blue-600 font-medium">🏢 บริษัท</span>
              <span className="font-bold">฿{companyTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category breakdown */}
      {sortedCategories.length > 0 && (
        <Card className="receipt-shadow">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">ค่าใช้จ่ายตามหมวดหมู่</p>
            <div className="space-y-2">
              {sortedCategories.map(([cat, total]) => (
                <div key={cat}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className={`font-medium px-1.5 py-0.5 rounded text-xs ${CATEGORY_COLORS[cat] || ""}`}>{cat}</span>
                    <span className="font-medium">฿{total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${maxCatTotal > 0 ? (total / maxCatTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
