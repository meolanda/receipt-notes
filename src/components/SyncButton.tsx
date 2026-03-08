import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RefreshCw } from "lucide-react";
import { isGoogleConnected, getGoogleSettings, syncReceiptToGoogle } from "@/lib/google-api";
import type { Receipt } from "@/lib/receipt-store";
import { toast } from "sonner";

interface SyncButtonProps {
  receipts: Receipt[];
}

export default function SyncButton({ receipts }: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");

  const handleSync = async () => {
    if (!isGoogleConnected()) {
      toast.error("กรุณาเชื่อมต่อ Google Account ก่อน (ไปที่แท็บตั้งค่า)");
      return;
    }

    const settings = getGoogleSettings();
    if (!settings.spreadsheetId) {
      toast.error("กรุณากรอก Spreadsheet ID ก่อน");
      return;
    }

    setSyncing(true);
    setProgress(0);

    let success = 0;
    let errors = 0;
    const total = receipts.length;

    for (let i = 0; i < total; i++) {
      setStatusText(`กำลัง sync ${i + 1}/${total}...`);
      setProgress(((i + 1) / total) * 100);
      try {
        await syncReceiptToGoogle(receipts[i]);
        success++;
      } catch (err) {
        console.error(`Sync error for receipt ${receipts[i].id}:`, err);
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

  if (receipts.length === 0) return null;

  return (
    <div className="space-y-2">
      <Button
        onClick={handleSync}
        disabled={syncing}
        variant="outline"
        size="sm"
        className="w-full"
      >
        <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? statusText : `Sync ไปยัง Google (${receipts.length} รายการ)`}
      </Button>
      {syncing && <Progress value={progress} className="h-2" />}
    </div>
  );
}
