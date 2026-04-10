import { useState, useCallback, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, ListChecks, BarChart3, Settings, Loader2 } from "lucide-react";
import { getActiveProfile, setActiveProfile, type Receipt as ReceiptType, type Profile } from "@/lib/receipt-store";
import { migrateLocalStorageToFirestore } from "@/lib/firestore-store";
import { useAuth } from "@/hooks/useAuth";
import { useReceipts } from "@/hooks/useReceipts";
import AuthGate from "@/components/AuthGate";
import ReceiptForm from "@/components/ReceiptForm";
import ReceiptList from "@/components/ReceiptList";
import ExpenseSummary from "@/components/ExpenseSummary";
import ClaudeSettings from "@/components/ClaudeSettings";
import FirebaseSettings from "@/components/FirebaseSettings";
import CategoryManager from "@/components/CategoryManager";
import { toast } from "sonner";

const Index = () => {
  const { user, loading: authLoading, signIn, logout } = useAuth();
  const { receipts, loading: receiptsLoading } = useReceipts(user?.uid ?? null);

  const [tab, setTab] = useState("add");
  const [profile, setProfile] = useState<Profile>(getActiveProfile);
  const [duplicateData, setDuplicateData] = useState<ReceiptType | null>(null);
  const [editData, setEditData] = useState<ReceiptType | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [formDirty, setFormDirty] = useState(false);
  const [migrated, setMigrated] = useState(false);

  // ย้ายข้อมูล localStorage → Firestore เมื่อ login ครั้งแรก
  useEffect(() => {
    if (!user || migrated) return;
    migrateLocalStorageToFirestore(user.uid)
      .then((count) => {
        if (count > 0) {
          toast.success(`ย้ายข้อมูลเก่า ${count} ใบ → Firebase เรียบร้อย ✅`);
        }
        setMigrated(true);
      })
      .catch((err) => {
        console.error("[migration] error:", err);
        setMigrated(true);
      });
  }, [user, migrated]);

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

  const handleSaved = useCallback(() => {
    setDuplicateData(null);
    setEditData(null);
    setFormDirty(false);
    setTab("list");
  }, []);

  // ─── Loading / Auth states ───
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthGate onSignIn={signIn} />;
  }

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
            {/* avatar */}
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt="avatar"
                className="h-8 w-8 rounded-full border border-border cursor-pointer"
                onClick={() => setTab("settings")}
                title={user.displayName || user.email || ""}
              />
            )}
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
        {receiptsLoading && !receipts.length && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            <span className="text-muted-foreground text-sm">โหลดข้อมูล...</span>
          </div>
        )}

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
              uid={user.uid}
              receipts={receipts}
              onSaved={handleSaved}
              onDirtyChange={setFormDirty}
              duplicateData={duplicateData}
              editData={editData}
              onCancelEdit={() => {
                setEditData(null);
                setFormDirty(false);
                setFormKey((k) => k + 1);
              }}
            />
          </TabsContent>

          <TabsContent value="list" className="mt-4">
            <ReceiptList
              receipts={receipts}
              profile={profile}
              uid={user.uid}
              onChanged={() => {}} // real-time listener อัปเดตเอง
              onDuplicate={handleDuplicate}
              onEdit={handleEdit}
            />
          </TabsContent>

          <TabsContent value="summary" className="mt-4">
            <ExpenseSummary receipts={receipts} profile={profile} />
          </TabsContent>

          <TabsContent value="settings" className="mt-4 space-y-5">
            <ClaudeSettings />
            <FirebaseSettings
              user={user}
              receipts={receipts}
              profile={profile}
              onLogout={logout}
            />
            <CategoryManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
