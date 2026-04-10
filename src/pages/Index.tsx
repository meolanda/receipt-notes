import { useState, useCallback, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, ListChecks, BarChart3, Settings } from "lucide-react";
import { getReceipts, getActiveProfile, setActiveProfile, type Receipt as ReceiptType, type Profile } from "@/lib/receipt-store";
import { handleOAuthCallback } from "@/lib/google-api";
import { isServerSyncAvailable, restoreFromServer } from "@/lib/server-sync";
import ReceiptForm from "@/components/ReceiptForm";
import ReceiptList from "@/components/ReceiptList";
import ExpenseSummary from "@/components/ExpenseSummary";
import GoogleSettings from "@/components/GoogleSettings";
import ClaudeSettings from "@/components/ClaudeSettings";
import CategoryManager from "@/components/CategoryManager";
import { toast } from "sonner";

const Index = () => {
  const [receipts, setReceipts] = useState<ReceiptType[]>(getReceipts);
  const [tab, setTab] = useState("add");
  const [profile, setProfile] = useState<Profile>(getActiveProfile);
  const [duplicateData, setDuplicateData] = useState<ReceiptType | null>(null);
  const [editData, setEditData] = useState<ReceiptType | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [formDirty, setFormDirty] = useState(false);

  const syncFromServer = useCallback((silent = false) => {
    if (!isServerSyncAvailable()) return;
    restoreFromServer()
      .then(({ added }) => {
        if (added > 0) {
          setReceipts(getReceipts());
          toast.success(`มีข้อมูลใหม่ ${added} รายการจากเครื่องอื่น ✅`);
        }
      })
      .catch((err) => {
        console.error("[sync] failed:", err);
        if (!silent) toast.error("โหลดข้อมูลไม่สำเร็จ: " + err.message);
      });
  }, []);

  useEffect(() => {
    if (handleOAuthCallback()) {
      toast.success("เชื่อมต่อ Google Account สำเร็จ! ✅");
      setTab("settings");
      return;
    }
    // sync เมื่อเปิดแอป
    syncFromServer(true);

    // sync เมื่อกลับมาที่แอป (switch tab / กลับจาก app อื่น)
    const onVisible = () => {
      if (document.visibilityState === "visible") syncFromServer(true);
    };
    document.addEventListener("visibilitychange", onVisible);

    // polling ทุก 60 วินาที (กรณีเปิด tab ค้างไว้) — หยุดตอน tab ซ่อน
    const poll = setInterval(() => {
      if (!document.hidden) syncFromServer(true);
    }, 60_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
    };
  }, [syncFromServer]);

  const refresh = useCallback(() => setReceipts(getReceipts()), []);

  const handleTabChange = (newTab: string) => {
    if (formDirty && tab === "add" && newTab !== "add") {
      if (!window.confirm("มีข้อมูลที่กรอกอยู่ ถ้าออกไปข้อมูลจะหายไป ต้องการออกหรือไม่?")) return;
      setFormDirty(false);
    }
    setTab(newTab);
  };

  const handleProfileChange = (p: Profile) => {
    if (p === profile) return;
    if (tab === "add" && formDirty) {
      if (!window.confirm("มีข้อมูลที่กรอกอยู่ ถ้าเปลี่ยน Profile ข้อมูลจะหายไป ต้องการเปลี่ยนหรือไม่?")) return;
    }
    setProfile(p);
    setActiveProfile(p);
    setFormDirty(false);
    setFormKey((k) => k + 1);
  };

  const handleDuplicate = (receipt: ReceiptType) => {
    setDuplicateData(receipt);
    setEditData(null);
    setFormKey((k) => k + 1);
    setTab("add");
  };

  const handleEdit = (receipt: ReceiptType) => {
    setEditData(receipt);
    setDuplicateData(null);
    setFormKey((k) => k + 1);
    setTab("add");
  };

  const isPersonal = profile === "personal";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border safe-top">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🧾</span>
              <h1 className="text-lg font-bold font-display">บันทึกใบเสร็จ</h1>
            </div>
          </div>
          <div className="flex mt-2 rounded-lg overflow-hidden border border-border">
            <button
              onClick={() => handleProfileChange("personal")}
              className={`flex-1 py-3 text-sm font-medium transition-colors active:opacity-80 ${
                isPersonal
                  ? "bg-orange-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              🧑 ส่วนตัว
            </button>
            <button
              onClick={() => handleProfileChange("company")}
              className={`flex-1 py-3 text-sm font-medium transition-colors active:opacity-80 ${
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

      <main className="max-w-lg mx-auto px-4 py-5 pb-24 space-y-5 safe-bottom">
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList className="w-full h-12">
            <TabsTrigger value="add" className="flex-1 gap-1 sm:gap-1.5 text-xs sm:text-sm py-2.5">
              <Receipt className="h-4 w-4 shrink-0" />
              <span className="hidden xs:inline">{editData ? "แก้ไข" : "บันทึก"}</span>
            </TabsTrigger>
            <TabsTrigger value="list" className="flex-1 gap-1 sm:gap-1.5 text-xs sm:text-sm py-2.5">
              <ListChecks className="h-4 w-4 shrink-0" />
              <span className="hidden xs:inline">ประวัติ</span>
            </TabsTrigger>
            <TabsTrigger value="summary" className="flex-1 gap-1 sm:gap-1.5 text-xs sm:text-sm py-2.5">
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span className="hidden xs:inline">สรุป</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 gap-1 sm:gap-1.5 text-xs sm:text-sm py-2.5">
              <Settings className="h-4 w-4 shrink-0" />
              <span className="hidden xs:inline">ตั้งค่า</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="add" className="mt-4">
            <ReceiptForm
              key={`${profile}-${formKey}`}
              profile={profile}
              onSaved={() => { refresh(); setDuplicateData(null); setEditData(null); setFormDirty(false); setTab("list"); }}
              onDirtyChange={setFormDirty}
              duplicateData={duplicateData}
              editData={editData}
              onCancelEdit={() => { setEditData(null); setFormDirty(false); setFormKey((k) => k + 1); }}
            />
          </TabsContent>
          <TabsContent value="list" className="mt-4">
            <ReceiptList receipts={receipts} profile={profile} onChanged={refresh} onDuplicate={handleDuplicate} onEdit={handleEdit} />
          </TabsContent>
          <TabsContent value="summary" className="mt-4">
            <ExpenseSummary receipts={receipts} profile={profile} />
          </TabsContent>
          <TabsContent value="settings" className="mt-4 space-y-5">
            <ClaudeSettings onChanged={refresh} />
            <CategoryManager />
            <GoogleSettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
