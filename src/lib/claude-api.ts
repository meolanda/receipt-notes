const CLAUDE_SETTINGS_KEY = "receipt-claude-settings";

export type ClaudeModel = "auto" | "haiku" | "sonnet";

export interface ClaudeSettings {
  apiKey: string;
  modelPreference: ClaudeModel;
}

export interface ReceiptScanResult {
  type: "receipt";
  store_name: string;
  date: string;
  category: string;
  items: { name: string; quantity: number; unit_price: number; total: number }[];
  subtotal: number;
  vat: number;
  total: number;
  notes: string;
  modelUsed: "Haiku" | "Sonnet";
}

export interface BankSlipScanResult {
  type: "bank_slip";
  bank: string;
  date: string;
  time: string;
  recipient_name: string;
  amount: number;
  reference_id: string;
  notes: string;
  modelUsed: "Haiku" | "Sonnet";
}

export type ScanResult = ReceiptScanResult | BankSlipScanResult;

export function getClaudeSettings(): ClaudeSettings {
  try {
    const data = localStorage.getItem(CLAUDE_SETTINGS_KEY);
    return data ? JSON.parse(data) : { apiKey: "", modelPreference: "auto" };
  } catch {
    return { apiKey: "", modelPreference: "auto" };
  }
}

export function saveClaudeSettings(settings: ClaudeSettings): void {
  localStorage.setItem(CLAUDE_SETTINGS_KEY, JSON.stringify(settings));
}

const PROMPT = `อ่านรูปนี้และระบุว่าเป็น "ใบเสร็จ/ใบเสนอราคา" หรือ "สลิปโอนเงิน" แล้วดึงข้อมูลออกมาในรูปแบบ JSON เท่านั้น ไม่ต้องมีข้อความอื่น:

ถ้าเป็นใบเสร็จ/ใบเสนอราคา:
{
  "type": "receipt",
  "store_name": "string",
  "date": "string (YYYY-MM-DD)",
  "category": "string",
  "items": [{"name": "string", "quantity": "number", "unit_price": "number", "total": "number"}],
  "subtotal": "number",
  "vat": "number",
  "total": "number",
  "notes": "string"
}

ถ้าเป็นสลิปโอนเงิน/สลิปธนาคาร:
{
  "type": "bank_slip",
  "bank": "string (ชื่อธนาคาร)",
  "date": "string (YYYY-MM-DD)",
  "time": "string (HH:mm)",
  "recipient_name": "string",
  "amount": "number",
  "reference_id": "string",
  "notes": "string"
}`;

async function callClaude(
  apiKey: string,
  model: string,
  imageBase64: string
): Promise<any> {
  // Extract mime type and base64 data
  const match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data");
  
  const mediaType = match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  const data = match[2];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Claude API error (${res.status}): ${err.error?.message || res.statusText}`);
  }

  const result = await res.json();
  const text = result.content?.[0]?.text || "";
  
  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("ไม่สามารถอ่าน JSON จากคำตอบ AI ได้");
  
  return JSON.parse(jsonMatch[0]);
}

function isIncomplete(data: any): boolean {
  if (data.type === "bank_slip") {
    return !data.recipient_name || !data.date || (!data.amount && data.amount !== 0);
  }
  return !data.store_name || !data.date || (!data.total && data.total !== 0);
}

export async function scanReceipt(imageBase64: string): Promise<ScanResult> {
  const settings = getClaudeSettings();
  if (!settings.apiKey) throw new Error("กรุณากรอก Claude API Key ก่อน (ไปที่แท็บตั้งค่า)");

  const haikuModel = "claude-haiku-4-5-20251001";
  const sonnetModel = "claude-sonnet-4-20250514";

  let modelUsed: "Haiku" | "Sonnet";
  let data: any;

  if (settings.modelPreference === "sonnet") {
    data = await callClaude(settings.apiKey, sonnetModel, imageBase64);
    modelUsed = "Sonnet";
  } else if (settings.modelPreference === "haiku") {
    data = await callClaude(settings.apiKey, haikuModel, imageBase64);
    modelUsed = "Haiku";
  } else {
    data = await callClaude(settings.apiKey, haikuModel, imageBase64);
    modelUsed = "Haiku";

    if (isIncomplete(data)) {
      data = await callClaude(settings.apiKey, sonnetModel, imageBase64);
      modelUsed = "Sonnet";
    }
  }

  if (data.type === "bank_slip") {
    return {
      type: "bank_slip",
      bank: data.bank || "",
      date: data.date || "",
      time: data.time || "",
      recipient_name: data.recipient_name || "",
      amount: Number(data.amount) || 0,
      reference_id: data.reference_id || "",
      notes: data.notes || "",
      modelUsed,
    };
  }

  return {
    type: "receipt",
    store_name: data.store_name || "",
    date: data.date || "",
    category: data.category || "",
    items: Array.isArray(data.items)
      ? data.items.map((i: any) => ({
          name: i.name || "",
          quantity: Number(i.quantity) || 1,
          unit_price: Number(i.unit_price) || 0,
          total: Number(i.total) || 0,
        }))
      : [],
    subtotal: Number(data.subtotal) || 0,
    vat: Number(data.vat) || 0,
    total: Number(data.total) || 0,
    notes: data.notes || "",
    modelUsed,
  };
}
