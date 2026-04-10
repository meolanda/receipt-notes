import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Save, Shield, Trash2 } from "lucide-react";
import { getClaudeSettings, saveClaudeSettings, type ClaudeModel } from "@/lib/claude-api";
import { compactImageStorage, getImageStorageInfo, removeDuplicateReceipts } from "@/lib/receipt-store";
import { toast } from "sonner";

export default function ClaudeSettings() {
  const [settings, setSettings] = useState(getClaudeSettings);
  const storageInfo = getImageStorageInfo();

  const handleSave = () => {
    saveClaudeSettings(settings);
    toast.success("บันทึกการตั้งค่า Gemini AI เรียบร้อย");
  };

  return (
    <Card className="receipt-shadow fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-primary" />
          ตั้งค่า Gemini AI Scanner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
          <span className="text-sm font-medium">สถานะ</span>
          <span className="text-sm font-medium text-green-700">✅ พร้อมใช้งาน</span>
        </div>

        <div>
          <Label htmlFor="modelPref">โมเดลที่ใช้สแกน</Label>
          <Select value={settings.modelPreference} onValueChange={(v) => setSettings({ ...settings, modelPreference: v as ClaudeModel })}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flash25">⚡ Gemini 2.5 Flash (แนะนำ - แม่นยำ)</SelectItem>
              <SelectItem value="flash20">🚀 Gemini 2.0 Flash (เร็วกว่า)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave} variant="outline" className="w-full">
          <Save className="h-4 w-4 mr-1" /> บันทึกการตั้งค่า
        </Button>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>AI สแกนใบเสร็จผ่าน Server — ไม่ต้องใส่ API Key ทุก device ใช้ได้เลย</span>
        </div>

        {/* Storage info & compact */}
        <div className="p-3 rounded-lg bg-muted space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">พื้นที่ใช้งาน</span>
            <span className="font-medium">{storageInfo.usedMB} / ~5 MB</span>
          </div>
          {storageInfo.withImageCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">รูปใน storage ({storageInfo.withImageCount} ใบ)</span>
              <span className="font-medium">{storageInfo.totalImageMB} MB</span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 gap-2"
            onClick={() => {
              const { count, savedMB } = compactImageStorage();
              if (count === 0) {
                toast.info("ไม่มีรูปที่ล้างได้ (เฉพาะรูปที่ sync แล้วเท่านั้น)");
              } else {
                toast.success(`ล้างรูปแล้ว ${count} ใบ ประหยัดได้ ${savedMB} MB`);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            ล้างรูปจาก storage (เพิ่มพื้นที่)
          </Button>
          <p className="text-xs text-muted-foreground">จะลบเฉพาะรูปที่ sync ขึ้น Google Drive แล้ว ข้อมูลยังอยู่ครบ</p>

          <Button
            variant="outline"
            size="sm"
            className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 gap-2"
            onClick={() => {
              const count = removeDuplicateReceipts();
              if (count === 0) toast.info("ไม่พบใบเสร็จซ้ำ");
              else toast.success(`ลบซ้ำแล้ว ${count} ใบ (เก็บอันเก่าสุดไว้)`);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            ตรวจและลบใบเสร็จซ้ำ
          </Button>
          <p className="text-xs text-muted-foreground">ตรวจจาก: ร้านค้า + วันที่ + ยอดรวม ตรงกัน → ลบอันใหม่ เก็บอันเก่า</p>
        </div>
      </CardContent>
    </Card>
  );
}
