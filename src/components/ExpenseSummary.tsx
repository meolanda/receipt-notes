import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { type Receipt, type Profile, CATEGORY_COLORS } from "@/lib/receipt-store";
import { TrendingUp, CalendarDays, Clock } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

interface ExpenseSummaryProps {
  receipts: Receipt[];
  profile: Profile;
}

const PIE_COLORS = [
  "#f97316", "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#6366f1",
  "#14b8a6", "#e11d48",
];

const MONTH_NAMES = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function formatBaht(v: number) {
  return `฿${v.toLocaleString("th-TH", { minimumFractionDigits: 0 })}`;
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

  // Category breakdown
  const categoryData = useMemo(() => {
    const totals: Record<string, number> = {};
    profileReceipts.forEach((r) => {
      totals[r.category] = (totals[r.category] || 0) + r.grandTotal;
    });
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
  }, [profileReceipts]);

  // Monthly data (last 6 months)
  const monthlyData = useMemo(() => {
    const months: { key: string; name: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, name: MONTH_NAMES[d.getMonth()], total: 0 });
    }
    profileReceipts.forEach((r) => {
      const rDate = new Date(r.date);
      const key = `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, "0")}`;
      const m = months.find((m) => m.key === key);
      if (m) m.total += r.grandTotal;
    });
    return months;
  }, [profileReceipts]);

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
      {/* Stats cards */}
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

      {/* Monthly bar chart */}
      {monthlyData.some((m) => m.total > 0) && (
        <Card className="receipt-shadow">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">ค่าใช้จ่ายรายเดือน (6 เดือนล่าสุด)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip
                  formatter={(value: number) => [formatBaht(value), "ยอดรวม"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Category pie chart */}
      {categoryData.length > 0 && (
        <Card className="receipt-shadow">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">สัดส่วนตามหมวดหมู่</p>
            <div className="flex items-center gap-2">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [formatBaht(value)]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {categoryData.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="truncate flex-1 text-muted-foreground">{cat.name}</span>
                    <span className="font-medium text-foreground shrink-0">{formatBaht(cat.value)}</span>
                  </div>
                ))}
              </div>
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

      {/* Empty state */}
      {profileReceipts.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-3xl mb-2">📊</p>
          <p>ยังไม่มีข้อมูลค่าใช้จ่าย</p>
          <p className="text-xs mt-1">เพิ่มใบเสร็จเพื่อดูกราฟสรุป</p>
        </div>
      )}
    </div>
  );
}
