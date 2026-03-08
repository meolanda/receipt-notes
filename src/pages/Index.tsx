import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, ListChecks } from "lucide-react";
import { getReceipts, type Receipt as ReceiptType } from "@/lib/receipt-store";
import ReceiptForm from "@/components/ReceiptForm";
import ReceiptList from "@/components/ReceiptList";
import ExpenseSummary from "@/components/ExpenseSummary";

const Index = () => {
  const [receipts, setReceipts] = useState<ReceiptType[]>(getReceipts);
  const [tab, setTab] = useState("add");

  const refresh = useCallback(() => setReceipts(getReceipts()), []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-2">
          <span className="text-2xl">🧾</span>
          <h1 className="text-lg font-bold font-display">บันทึกใบเสร็จ</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 pb-24 space-y-5">
        <ExpenseSummary receipts={receipts} />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="add" className="flex-1 gap-1.5">
              <Receipt className="h-4 w-4" /> บันทึก
            </TabsTrigger>
            <TabsTrigger value="list" className="flex-1 gap-1.5">
              <ListChecks className="h-4 w-4" /> ประวัติ
            </TabsTrigger>
          </TabsList>
          <TabsContent value="add" className="mt-4">
            <ReceiptForm onSaved={() => { refresh(); setTab("list"); }} />
          </TabsContent>
          <TabsContent value="list" className="mt-4">
            <ReceiptList receipts={receipts} onChanged={refresh} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
