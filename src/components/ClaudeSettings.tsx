import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Save } from "lucide-react";
import { getClaudeSettings, saveClaudeSettings, type ClaudeModel } from "@/lib/claude-api";
import { toast } from "sonner";

export default function ClaudeSettings() {
  const [settings, setSettings] = useState(getClaudeSettings);

  const handleSave = () => {
    saveClaudeSettings(settings);
    toast.success("บันทึกการตั้งค่า Claude AI เรียบร้อย");
  };

  return (
    <Card className="receipt-shadow fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-primary" />
          ตั้งค่า Claude AI Scanner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="claudeApiKey">Claude API Key *</Label>
          <Input
            id="claudeApiKey"
            type="password"
            placeholder="sk-ant-api..."
            value={settings.apiKey}
            onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
            className="mt-1 text-xs"
          />
          <p className="text-xs text-muted-foreground mt-1">
            สร้างได้ที่{" "}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              Anthropic Console
            </a>
          </p>
        </div>

        <div>
          <Label htmlFor="modelPref">โมเดลที่ใช้สแกน</Label>
          <Select value={settings.modelPreference} onValueChange={(v) => setSettings({ ...settings, modelPreference: v as ClaudeModel })}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">🔄 Auto Hybrid (Haiku → Sonnet)</SelectItem>
              <SelectItem value="haiku">⚡ Haiku เท่านั้น (เร็ว, ถูก)</SelectItem>
              <SelectItem value="sonnet">🎯 Sonnet เท่านั้น (แม่นยำ)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Auto Hybrid: ใช้ Haiku ก่อน ถ้าอ่านไม่ครบจะสลับไปใช้ Sonnet อัตโนมัติ
          </p>
        </div>

        <Button onClick={handleSave} variant="outline" className="w-full">
          <Save className="h-4 w-4 mr-1" /> บันทึกการตั้งค่า
        </Button>
      </CardContent>
    </Card>
  );
}
