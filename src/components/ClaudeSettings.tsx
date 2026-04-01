import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
        <div>
          <Label htmlFor="geminiApiKey">Gemini API Key *</Label>
          <Input
            id="geminiApiKey"
            type="password"
            placeholder="AIzaSy..."
            value={settings.apiKey}
            onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
            className="mt-1 text-xs"
          />
          <p className="text-xs text-muted-foreground mt-1">
            สร้างได้ที่{" "}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              Google AI Studio
            </a>
            {" "}— ฟรี ไม่ต้องใส่บัตรเครดิต
          </p>
        </div>

        <div>
          <Label htmlFor="modelPref">โมเดลที่ใช้สแกน</Label>
          <Select value={settings.modelPreference} onValueChange={(v) => setSettings({ ...settings, modelPreference: v as ClaudeModel })}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flash25">⚡ Gemini 2.5 Flash (แนะนำ - ฟรี, แม่นยำ)</SelectItem>
              <SelectItem value="flash20">🚀 Gemini 2.0 Flash (เร็วกว่า, ฟรี)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            ทั้งสองโมเดลใช้ฟรีได้ถึง ~1,500 req/วัน
          </p>
        </div>

        <Button onClick={handleSave} variant="outline" className="w-full">
          <Save className="h-4 w-4 mr-1" /> บันทึกการตั้งค่า
        </Button>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>API Key เก็บใน browser (localStorage) บนเครื่องนี้เท่านั้น ไม่มีการส่งข้อมูลไปที่อื่น นอกจาก Google AI Studio ตอนสแกน</span>
        </div>
      </CardContent>
    </Card>
  );
}
