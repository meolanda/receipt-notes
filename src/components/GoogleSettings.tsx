import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Link, Unlink, Save, AlertTriangle, Shield, Download, Loader2, Trash2 } from "lucide-react";
import {
  getGoogleSettings,
  saveGoogleSettings,
  isGoogleConnected,
  isTokenExpired,
  getTokenMinutesLeft,
  startGoogleOAuth,
  clearGoogleToken,
  type GoogleSettings as GoogleSettingsType,
} from "@/lib/google-api";
import { isServerSyncAvailable, restoreFromServer, deleteReceiptFromServer } from "@/lib/server-sync";
import { getReceipts, removeReceiptLocal } from "@/lib/receipt-store";
import { toast } from "sonner";

export default function GoogleSettings() {
  const [settings, setSettings] = useState<GoogleSettingsType>(getGoogleSettings);
  const [connected, setConnected] = useState(isGoogleConnected);
  const [tokenExpired, setTokenExpired] = useState(isTokenExpired);
  const [minutesLeft, setMinutesLeft] = useState(getTokenMinutesLeft);
  const [restoring, setRestoring] = useState(false);
  const serverSync = isServerSyncAvailable();

  const handleCleanCorrupted = async () => {
    const all = getReceipts();
    const corrupted = all.filter(r => r.grandTotal === 0);
    if (corrupted.length === 0) {
      toast.info("ไม่พบข้อมูลเสียหาย");
      return;
    }
    if (!window.confirm(`พบ ${corrupted.length} รายการที่ราคา ฿0.00 ต้องการลบออกไหม?`)) return;
    // ลบออกจาก localStorage
    corrupted.forEach(r => removeReceiptLocal(r.id));
    // ลบออกจาก Sheets ด้วย (mark "ลบ") เพื่อไม่ให้ restore กลับมา
    await Promise.allSettled(corrupted.map(r => deleteReceiptFromServer(r.id)));
    toast.success(`ลบข้อมูลเสียหาย ${corrupted.length} รายการแล้ว (ทั้งเครื่องและ Sheets)`);
    window.location.reload();
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const { added, skipped } = await restoreFromServer();
      if (added === 0) {
        toast.info(`ข้อมูลครบแล้ว (ข้าม ${skipped} รายการที่มีอยู่แล้ว)`);
      } else {
        toast.success(`โหลดสำเร็จ เพิ่ม ${added} รายการ (ข้าม ${skipped} รายการซ้ำ)`);
        // refresh page เพื่ออัปเดต list
        window.location.reload();
      }
    } catch (err: any) {
      toast.error("โหลดไม่สำเร็จ: " + err.message);
    } finally {
      setRestoring(false);
    }
  };

  useEffect(() => {
    setConnected(isGoogleConnected());
    setTokenExpired(isTokenExpired());
    setMinutesLeft(getTokenMinutesLeft());

    // อัปเดตสถานะ token ทุก 1 นาที
    const interval = setInterval(() => {
      setConnected(isGoogleConnected());
      setTokenExpired(isTokenExpired());
      setMinutesLeft(getTokenMinutesLeft());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = () => {
    saveGoogleSettings(settings);
    toast.success("บันทึกการตั้งค่า Google เรียบร้อย");
  };

  const handleConnect = () => {
    try {
      saveGoogleSettings(settings);
      startGoogleOAuth();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDisconnect = () => {
    clearGoogleToken();
    setConnected(false);
    toast.success("ยกเลิกการเชื่อมต่อ Google แล้ว");
  };

  return (
    <Card className="receipt-shadow fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="h-5 w-5 text-primary" />
          ตั้งค่า Google Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {serverSync ? (
          /* === Vercel mode: ไม่ต้อง OAuth === */
          <>
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
              <span className="text-sm font-medium">สถานะ</span>
              <Badge className="bg-green-100 text-green-700 border-green-200">
                ✅ เชื่อมต่อผ่าน Server แล้ว
              </Badge>
            </div>

            {/* Restore from Sheets */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-sm font-medium">โหลดข้อมูลจาก Google Sheets</p>
              <p className="text-xs text-muted-foreground">ใช้เมื่อเปิดแอปบนเครื่องใหม่ หรือข้อมูลในเครื่องหาย — จะดึงรายการจาก Sheets มาเพิ่มโดยไม่ลบข้อมูลเดิม</p>
              <Button onClick={handleRestore} disabled={restoring} variant="outline" className="w-full">
                {restoring
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />กำลังโหลด...</>
                  : <><Download className="h-4 w-4 mr-2" />โหลดข้อมูลจาก Google Sheets</>
                }
              </Button>
            </div>

            {/* ล้างข้อมูลเสียหาย */}
            <div className="rounded-lg border border-red-200 p-3 space-y-2">
              <p className="text-sm font-medium text-red-700">ล้างข้อมูลเสียหาย</p>
              <p className="text-xs text-muted-foreground">ลบรายการที่ราคา ฿0.00 ออกจากเครื่องนี้และ Google Sheets</p>
              <Button onClick={handleCleanCorrupted} variant="outline" className="w-full border-red-200 text-red-700 hover:bg-red-50">
                <Trash2 className="h-4 w-4 mr-2" />ล้างข้อมูลเสียหาย (฿0.00)
              </Button>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>ข้อมูลถูก sync ผ่าน Server อัตโนมัติ ไม่ต้องตั้งค่า OAuth</span>
            </div>
          </>
        ) : (
          /* === Localhost mode: ต้อง OAuth === */
          <>
            {/* Connection Status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="text-sm font-medium">สถานะการเชื่อมต่อ</span>
              {connected ? (
                <Badge className="bg-green-100 text-green-700 border-green-200">
                  ✅ เชื่อมต่อแล้ว {minutesLeft !== null && `(${minutesLeft} นาที)`}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  ❌ ยังไม่เชื่อมต่อ
                </Badge>
              )}
            </div>

            {tokenExpired && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Token หมดอายุแล้ว</p>
                  <p className="text-xs mt-0.5">กรุณากดเชื่อมต่อ Google Account ใหม่อีกครั้ง</p>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="clientId">Google OAuth Client ID *</Label>
              <Input id="clientId" placeholder="xxxx.apps.googleusercontent.com" value={settings.clientId}
                onChange={(e) => setSettings({ ...settings, clientId: e.target.value })} className="mt-1 text-xs" />
            </div>
            <div>
              <Label htmlFor="spreadsheetId">Google Spreadsheet ID *</Label>
              <Input id="spreadsheetId" placeholder="ค่า ID จาก URL ของ Google Sheet" value={settings.spreadsheetId}
                onChange={(e) => setSettings({ ...settings, spreadsheetId: e.target.value })} className="mt-1 text-xs" />
            </div>
            <div>
              <Label htmlFor="driveFolderId">Google Drive Folder ID</Label>
              <Input id="driveFolderId" placeholder="ค่า ID ของโฟลเดอร์ใน Google Drive" value={settings.driveFolderId}
                onChange={(e) => setSettings({ ...settings, driveFolderId: e.target.value })} className="mt-1 text-xs" />
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={handleSave} variant="outline" className="w-full">
                <Save className="h-4 w-4 mr-1" /> บันทึกการตั้งค่า
              </Button>
              {connected ? (
                <Button onClick={handleDisconnect} variant="destructive" className="w-full">
                  <Unlink className="h-4 w-4 mr-1" /> ยกเลิกการเชื่อมต่อ
                </Button>
              ) : (
                <Button onClick={handleConnect} className="w-full" disabled={!settings.clientId}>
                  <Link className="h-4 w-4 mr-1" /> เชื่อมต่อ Google Account
                </Button>
              )}
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Client ID และ Folder ID เก็บใน browser (localStorage) บนเครื่องนี้เท่านั้น</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
