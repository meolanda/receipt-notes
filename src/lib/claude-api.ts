const CLAUDE_SETTINGS_KEY = "receipt-claude-settings";

export type ClaudeModel = "flash25" | "flash20";

export type DocumentType = "receipt" | "quotation" | "tax_invoice" | "invoice" | "bank_slip" | "market_bill" | "other";
export type Confidence = "high" | "medium" | "low";

export interface ClaudeSettings {
  apiKey: string;
  modelPreference: ClaudeModel;
}

export interface ScanResult {
  document_type: DocumentType;
  confidence: Confidence;
  store_name: string | null;
  date: string | null;
  time: string | null;
  recipient_name: string | null;
  doc_number: string | null;
  tax_id: string | null;
  reference_id: string | null;
  bank: string | null;
  items: { name: string; quantity: number; unit_price: number; total: number }[];
  subtotal: number | null;
  vat: number | null;
  total: number | null;
  notes: string | null;
  modelUsed: string;
}

export function getClaudeSettings(): ClaudeSettings {
  try {
    const data = localStorage.getItem(CLAUDE_SETTINGS_KEY);
    return data ? JSON.parse(data) : { apiKey: "", modelPreference: "flash25" };
  } catch {
    return { apiKey: "", modelPreference: "flash25" };
  }
}

export function saveClaudeSettings(settings: ClaudeSettings): void {
  localStorage.setItem(CLAUDE_SETTINGS_KEY, JSON.stringify(settings));
}

const PROMPT = `วิเคราะห์เอกสารนี้และทำตามขั้นตอนดังนี้:

ขั้นที่ 1: ระบุประเภทเอกสาร (document_type) จากรายการนี้:
- "receipt" = ใบเสร็จร้านค้าทั่วไป, POS, ใบเสร็จรับเงิน
- "quotation" = ใบเสนอราคา, Quotation
- "tax_invoice" = ใบกำกับภาษี, Tax Invoice
- "invoice" = ใบแจ้งหนี้, Invoice
- "bank_slip" = สลิปโอนเงิน, สลิปธนาคาร, PromptPay
- "market_bill" = บิลเงินสดตลาด, บิลมือ, กระดาษจดราคา
- "other" = อื่นๆ

ขั้นที่ 2: ดึงข้อมูลตาม pattern ของแต่ละประเภท:

[receipt / tax_invoice]
- store_name: ชื่อร้าน/บริษัท (บรรทัดบนสุด หรือตัวใหญ่สุด)
- date: วันที่ในเอกสาร (YYYY-MM-DD)
- items: รายการสินค้าทุกรายการ [{name, quantity, unit_price, total}]
- subtotal: ยอดก่อน VAT
- vat: ภาษีมูลค่าเพิ่ม (ถ้ามี)
- total: ยอดรวมสุทธิ (ตัวเลขสุดท้าย ไม่ใช่เงินสดหรือเงินทอน)
- tax_id: เลขผู้เสียภาษี (ถ้ามี)

[quotation / invoice]
- store_name: ชื่อบริษัทผู้เสนอราคา/ออกใบแจ้งหนี้
- date: วันที่ในเอกสาร (YYYY-MM-DD) — ถ้าเป็นปี พ.ศ. ให้แปลงเป็น ค.ศ. โดยลบ 543 (เช่น 4/3/2569 → 2026-03-04)
- doc_number: เลขที่ใบเสนอราคา/ใบแจ้งหนี้
- items: ดึงเฉพาะรายการจากตารางข้อมูลหลัก [{name, quantity, unit_price, total}]
  * ห้ามนำ footnotes, เงื่อนไข, ข้อมูลพนักงานขาย มาเป็น item
  * ถ้ารายการมีรายละเอียดย่อย (เช่น รุ่น, สเปค, หมายเหตุใต้รายการ) ให้รวมเป็นชื่อรายการเดียว
- subtotal: ยอดก่อน VAT
- vat: VAT 7% (ถ้ามี)
- total: ยอดรวมสุทธิ
- notes: รวมข้อมูลเหล่านี้ไว้ใน notes (ถ้ามี): เงื่อนไขการชำระ, ชื่อพนักงานขาย/ผู้ติดต่อ, เงื่อนไขส่วนลด

[bank_slip]
- bank: ชื่อธนาคารหรือช่องทาง (เช่น กสิกรไทย, SCB, PromptPay)
- date: วันที่โอน (YYYY-MM-DD)
- time: เวลาโอน (HH:mm)
- recipient_name: ชื่อผู้รับเงิน
- amount: จำนวนเงินที่โอน (ตัวเลขหลัก ไม่ใช่ค่าธรรมเนียม)
- reference_id: เลขอ้างอิง/Transaction ID
- notes: หมายเหตุ (ถ้ามี)

[market_bill]
- store_name: ชื่อร้านหรือตลาด (ถ้าไม่มีให้ใส่ "ร้านค้า/ตลาด")
- date: วันที่ (ถ้าไม่มีให้ใส่วันที่วันนี้)
- items: แปลงรายการที่อ่านได้ เช่น "ผัก 20" → {name:"ผัก", quantity:1, unit_price:20, total:20}
- total: ยอดรวมทั้งหมด (ถ้าไม่มีให้รวมจาก items)
- confidence: "low" เสมอสำหรับบิลมือเขียน

ขั้นที่ 3: ระบุค่า confidence โดยรวม:
- "high" = อ่านได้ชัดเจนทุก field
- "medium" = อ่านได้ส่วนใหญ่ บางส่วนอาจไม่แน่ใจ
- "low" = ภาพไม่ชัด ลายมือยาก หรือข้อมูลไม่ครบ

ตอบในรูปแบบ JSON เท่านั้น ไม่มีข้อความอื่น:
{
  "document_type": string,
  "confidence": string,
  "store_name": string,
  "date": string,
  "time": string,
  "recipient_name": string,
  "doc_number": string,
  "tax_id": string,
  "reference_id": string,
  "bank": string,
  "amount": number,
  "items": [{name, quantity, unit_price, total}],
  "subtotal": number,
  "vat": number,
  "total": number,
  "notes": string
}

ถ้า field ไหนไม่มีข้อมูลให้ใส่ null`;

async function callGemini(apiKey: string, model: string, imageBase64: string): Promise<any> {
  const match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data");

  const mimeType = match[1];
  const data = match[2];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data } },
            { text: PROMPT },
          ],
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 2048 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini API error (${res.status}): ${err.error?.message || res.statusText}`);
  }

  const result = await res.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("ไม่สามารถอ่าน JSON จากคำตอบ AI ได้");

  return JSON.parse(jsonMatch[0]);
}

function isIncomplete(data: any): boolean {
  if (data.document_type === "bank_slip") {
    return !data.recipient_name || !data.date || (!data.amount && data.amount !== 0);
  }
  return !data.store_name || !data.date || (!data.total && data.total !== 0);
}

export async function scanReceipt(imageBase64: string): Promise<ScanResult> {
  const settings = getClaudeSettings();
  if (!settings.apiKey) throw new Error("กรุณากรอก Gemini API Key ก่อน (ไปที่แท็บตั้งค่า)");

  const flash25 = "gemini-2.5-flash";
  const flash20 = "gemini-2.0-flash";

  let modelUsed: string;
  let data: any;

  if (settings.modelPreference === "flash20") {
    data = await callGemini(settings.apiKey, flash20, imageBase64);
    modelUsed = "Gemini 2.0 Flash";
  } else {
    // Default: 2.5 Flash
    data = await callGemini(settings.apiKey, flash25, imageBase64);
    modelUsed = "Gemini 2.5 Flash";

    // Retry with 2.0 if incomplete (fallback)
    if (isIncomplete(data)) {
      data = await callGemini(settings.apiKey, flash20, imageBase64);
      modelUsed = "Gemini 2.0 Flash";
    }
  }

  const totalValue = data.document_type === "bank_slip"
    ? Number(data.amount) || Number(data.total) || 0
    : Number(data.total) || 0;

  const confidence: Confidence = data.document_type === "market_bill"
    ? "low"
    : (data.confidence || "medium");

  return {
    document_type: data.document_type || "other",
    confidence,
    store_name: data.store_name || null,
    date: data.date || null,
    time: data.time || null,
    recipient_name: data.recipient_name || null,
    doc_number: data.doc_number || null,
    tax_id: data.tax_id || null,
    reference_id: data.reference_id || null,
    bank: data.bank || null,
    items: Array.isArray(data.items)
      ? data.items.map((i: any) => ({
          name: i.name || "",
          quantity: Number(i.quantity) || 1,
          unit_price: Number(i.unit_price) || 0,
          total: Number(i.total) || 0,
        }))
      : [],
    subtotal: data.subtotal != null ? Number(data.subtotal) : null,
    vat: data.vat != null ? Number(data.vat) : null,
    total: totalValue,
    notes: data.notes || null,
    modelUsed,
  };
}
