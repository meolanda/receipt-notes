import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { isGoogleConnected, isTokenExpired, getGoogleSettings, syncReceiptToGoogle } from "@/lib/google-api";
import { isServerSyncAvailable, syncReceiptToServer } from "@/lib/server-sync";
import { updateReceipt, type Receipt } from "@/lib/receipt-store";
import { toast } from "sonner";

interface SyncButtonProps {
  receipts: Receipt[];
}

export default function SyncButton({ receipts }: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");

  const handleSync = async () => {
    const useServer = isServerSyncAvailable();

    if (!useServer) {
      // Localhost: ใช้ OAuth
      if (isTokenExpired()) {
        toast.error("Token หมดอายุแล้ว กรุณาเชื่อมต่อ Google Account ใหม่ที่แท็บตั้งค่า");
        return;
      }
      if (!isGoogleConnected()) {
        toast.error("กรุณาเชื่อมต่อ Google Account ก่อน (ไปที่แท็บตั้งค่า)");
        return;
      }
      const settings = getGoogleSettings();
      if (!settings.spreadsheetId) {
        toast.error("กรุณากรอก Spreadsheet ID ก่อน");
        return;
      }
    }

    setSyncing(true);
    setProgress(0);

    const pending = useServer ? receipts.filter((r) => !r.synced) : receipts;

    let success = 0;
    let errors = 0;
    const total = pending.length;

    if (total === 0) {
      setSyncing(false);
      toast.info("ข้อมูลทั้งหมด sync แล้ว ไม่มีรายการใหม่");
      return;
    }

    for (let i = 0; i < total; i++) {
      setStatusText(`กำลัง sync ${i + 1}/${total}...`);
      setProgress(((i + 1) / total) * 100);
      try {
        if (useServer) {
          const imageUrl = await syncReceiptToServer(pending[i]);
          updateReceipt(pending[i].id, { synced: true, ...(imageUrl ? { imageUrl } : {}) });
        } else {
          await syncReceiptToGoogle(pending[i]);
        }
        success++;
      } catch (err) {
        console.error(`Sync error for receipt ${pending[i].id}:`, err);
        errors++;
      }
    }

    setSyncing(false);
    setStatusText("");
    setProgress(0);

    if (errors === 0) {
      toast.success(`Sync สำเร็จ ${success} รายการ 🎉`);
    } else {
      toast.warning(`Sync สำเร็จ ${success} รายการ, ล้มเหลว ${errors} รายการ`);
    }
  };

  const useServer = isServerSyncAvailable();
  const pendingCount = useServer ? receipts.filter((r) => !r.synced).length : receipts.length;

  if (receipts.length === 0 || pendingCount === 0) return null;

  const tokenExpired = !useServer && isTokenExpired();

  return (
    <div className="space-y-2">
      {tokenExpired && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Token หมดอายุแล้ว — ไปที่ตั้งค่า &gt; เชื่อมต่อ Google Account ใหม่
        </div>
      )}
      <Button
        onClick={handleSync}
        disabled={syncing}
        variant="outline"
        size="sm"
        className="w-full"
      >
        <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? statusText : pendingCount > 0 ? `Sync ไปยัง Google (${pendingCount} รายการใหม่)` : "Sync ไปยัง Google ✅"}
      </Button>
      {syncing && <Progress value={progress} className="h-2" />}
    </div>
  );
}
