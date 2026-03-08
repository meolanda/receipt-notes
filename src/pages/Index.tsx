import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, ListChecks, BarChart3 } from "lucide-react";
import { getReceipts, getActiveProfile, setActiveProfile, type Receipt as ReceiptType, type Profile } from "@/lib/receipt-store";
import ReceiptForm from "@/components/ReceiptForm";
import ReceiptList from "@/components/ReceiptList";
import ExpenseSummary from "@/components/ExpenseSummary";

const Index = () => {
  const [receipts, setReceipts] = useState<ReceiptType[]>(getReceipts);
  const [tab, setTab] = useState("add");
  const [profile, setProfile] = useState<Profile>(getActiveProfile);
  const [duplicateData, setDuplicateData] = useState<ReceiptType | null>(null);
  const [formKey, setFormKey] = useState(0);

  const refresh = useCallback(() => setReceipts(getReceipts()), []);

  const handleProfileChange = (p: Profile) => {
    setProfile(p);
    setActiveProfile(p);
  };

  const handleDuplicate = (receipt: ReceiptType) => {
    setDuplicateData(receipt);
    setTab("add");
  };

  const isPersonal = profile === "personal";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🧾</span>
              <h1 className="text-lg font-bold font-display">บันทึกใบเสร็จ</h1>
            </div>
          </div>
          {/* Profile Switcher */}
          <div className="flex mt-2 rounded-lg overflow-hidden border border-border">
            <button
              onClick={() => handleProfileChange("personal")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                isPersonal
                  ? "bg-orange-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              🧑 ส่วนตัว
            </button>
            <button
              onClick={() => handleProfileChange("company")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                !isPersonal
                  ? "bg-blue-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              🏢 บริษัท
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 pb-24 space-y-5">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="add" className="flex-1 gap-1.5">
              <Receipt className="h-4 w-4" /> บันทึก
            </TabsTrigger>
            <TabsTrigger value="list" className="flex-1 gap-1.5">
              <ListChecks className="h-4 w-4" /> ประวัติ
            </TabsTrigger>
            <TabsTrigger value="summary" className="flex-1 gap-1.5">
              <BarChart3 className="h-4 w-4" /> สรุป
            </TabsTrigger>
          </TabsList>
          <TabsContent value="add" className="mt-4">
            <ReceiptForm
              key={duplicateData?.id || profile}
              profile={profile}
              onSaved={() => { refresh(); setTab("list"); }}
              duplicateData={duplicateData}
              onDuplicateHandled={() => setDuplicateData(null)}
            />
          </TabsContent>
          <TabsContent value="list" className="mt-4">
            <ReceiptList receipts={receipts} profile={profile} onChanged={refresh} onDuplicate={handleDuplicate} />
          </TabsContent>
          <TabsContent value="summary" className="mt-4">
            <ExpenseSummary receipts={receipts} profile={profile} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
