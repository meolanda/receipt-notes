import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Link, Unlink, Save } from "lucide-react";
import {
  getGoogleSettings,
  saveGoogleSettings,
  isGoogleConnected,
  startGoogleOAuth,
  clearGoogleToken,
  type GoogleSettings as GoogleSettingsType,
} from "@/lib/google-api";
import { toast } from "sonner";

export default function GoogleSettings() {
  const [settings, setSettings] = useState<GoogleSettingsType>(getGoogleSettings);
  const [connected, setConnected] = useState(isGoogleConnected);

  useEffect(() => {
    setConnected(isGoogleConnected());
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
        {/* Connection Status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
          <span className="text-sm font-medium">สถานะการเชื่อมต่อ</span>
          {connected ? (
            <Badge className="bg-green-100 text-green-700 border-green-200">
              ✅ เชื่อมต่อแล้ว
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              ❌ ยังไม่เชื่อมต่อ
            </Badge>
          )}
        </div>

        {/* Client ID */}
        <div>
          <Label htmlFor="clientId">Google OAuth Client ID *</Label>
          <Input
            id="clientId"
            placeholder="xxxx.apps.googleusercontent.com"
            value={settings.clientId}
            onChange={(e) => setSettings({ ...settings, clientId: e.target.value })}
            className="mt-1 text-xs"
          />
          <p className="text-xs text-muted-foreground mt-1">
            สร้างได้ที่{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Google Cloud Console
            </a>
          </p>
        </div>

        {/* Spreadsheet ID */}
        <div>
          <Label htmlFor="spreadsheetId">Google Spreadsheet ID *</Label>
          <Input
            id="spreadsheetId"
            placeholder="ค่า ID จาก URL ของ Google Sheet"
            value={settings.spreadsheetId}
            onChange={(e) => setSettings({ ...settings, spreadsheetId: e.target.value })}
            className="mt-1 text-xs"
          />
          <p className="text-xs text-muted-foreground mt-1">
            ดูจาก URL: docs.google.com/spreadsheets/d/<strong>[ID นี้]</strong>/edit
          </p>
        </div>

        {/* Drive Folder ID */}
        <div>
          <Label htmlFor="driveFolderId">Google Drive Folder ID</Label>
          <Input
            id="driveFolderId"
            placeholder="ค่า ID ของโฟลเดอร์ใน Google Drive"
            value={settings.driveFolderId}
            onChange={(e) => setSettings({ ...settings, driveFolderId: e.target.value })}
            className="mt-1 text-xs"
          />
          <p className="text-xs text-muted-foreground mt-1">
            ดูจาก URL: drive.google.com/drive/folders/<strong>[ID นี้]</strong>
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={handleSave} variant="outline" className="w-full">
            <Save className="h-4 w-4 mr-1" /> บันทึกการตั้งค่า
          </Button>

          {connected ? (
            <Button onClick={handleDisconnect} variant="destructive" className="w-full">
              <Unlink className="h-4 w-4 mr-1" /> ยกเลิกการเชื่อมต่อ
            </Button>
          ) : (
            <Button
              onClick={handleConnect}
              className="w-full"
              disabled={!settings.clientId}
            >
              <Link className="h-4 w-4 mr-1" /> เชื่อมต่อ Google Account
            </Button>
          )}
        </div>

        {/* Instructions */}
        <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">📋 วิธีตั้งค่า:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>ไปที่ Google Cloud Console สร้าง OAuth Client ID (Web application)</li>
            <li>เพิ่ม Authorized redirect URI: <code className="text-primary">{window.location.origin}</code></li>
            <li>เปิดใช้ Google Sheets API และ Google Drive API</li>
            <li>สร้าง Google Sheet ใหม่ แล้วคัดลอก Spreadsheet ID</li>
            <li>สร้างโฟลเดอร์ใน Google Drive แล้วคัดลอก Folder ID</li>
            <li>กดปุ่ม "เชื่อมต่อ Google Account"</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
