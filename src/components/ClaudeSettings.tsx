import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Save, Shield } from "lucide-react";
import { getClaudeSettings, saveClaudeSettings, type ClaudeModel } from "@/lib/claude-api";
import { toast } from "sonner";

export default function ClaudeSettings() {
  const [settings, setSettings] = useState(getClaudeSettings);

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
          <Select
            value={settings.modelPreference}
            onValueChange={(v) => setSettings({ ...settings, modelPreference: v as ClaudeModel })}
          >
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
          <span>AI สแกนใบเสร็จผ่าน Vercel Server — ไม่ต้องใส่ API Key ทุก device ใช้ได้เลย</span>
        </div>
      </CardContent>
    </Card>
  );
}
