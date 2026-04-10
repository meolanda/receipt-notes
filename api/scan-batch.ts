/**
 * POST /api/scan-batch
 * ส่งรูปหลายรูปใน 1 request → Gemini วิเคราะห์ทีเดียว → คืน array ผลลัพธ์
 * ลด N API calls เหลือ 1 call ป้องกัน rate limit
 */

export const config = { maxDuration: 60 }; // Vercel Pro: 60s

const MAX_IMAGES_PER_REQUEST = 5;  // จำกัด 5 รูป ให้ทำงานได้ใน Vercel Hobby 10s timeout

function buildBatchPrompt(n: number): string {
  return `คุณได้รับรูปภาพทั้งหมด ${n} รูป โดยแต่ละรูปเป็นเอกสาร/ใบเสร็จแยกกัน (รูปที่ 1 ถึง ${n})

วิเคราะห์แต่ละรูปแยกกัน โดยสำหรับแต่ละรูป:

ขั้นที่ 1: ระบุประเภทเอกสาร (document_type):
- "receipt" = ใบเสร็จร้านค้าทั่วไป, POS, ใบเสร็จรับเงิน
- "quotation" = ใบเสนอราคา
- "tax_invoice" = ใบกำกับภาษี
- "invoice" = ใบแจ้งหนี้
- "bank_slip" = สลิปโอนเงิน, PromptPay
- "market_bill" = บิลเงินสดตลาด, บิลมือเขียน
- "other" = อื่นๆ หรืออ่านไม่ได้

ขั้นที่ 2: ดึงข้อมูล:
- store_name: ชื่อร้าน/บริษัท
- date: วันที่ (YYYY-MM-DD) — ถ้าเป็นปีพ.ศ.ให้แปลงเป็นค.ศ.โดยลบ 543
- doc_number: เลขที่เอกสาร (ถ้ามี)
- tax_id: เลขผู้เสียภาษี (ถ้ามี)
- items: [{name, quantity, unit_price, total}] — รายการสินค้า/บริการ
- subtotal: ยอดก่อน VAT
- vat: ภาษีมูลค่าเพิ่ม (ถ้ามี)
- total: ยอดรวมสุทธิ (ตัวเลขสุดท้าย)
- bank: ชื่อธนาคาร (สำหรับ bank_slip)
- time: เวลา (สำหรับ bank_slip)
- recipient_name: ชื่อผู้รับเงิน (สำหรับ bank_slip)
- reference_id: เลขอ้างอิง (สำหรับ bank_slip)
- amount: จำนวนเงินโอน (สำหรับ bank_slip)
- notes: หมายเหตุ

ขั้นที่ 3: ระบุ confidence:
- "high" = อ่านได้ชัดเจนทุก field
- "medium" = อ่านได้ส่วนใหญ่
- "low" = ภาพไม่ชัด, ลายมือยาก, หรืออ่านไม่ได้เลย (ใช้ "low" เสมอสำหรับ market_bill)

ส่งกลับเป็น JSON array ที่มี ${n} elements ตามลำดับรูป ไม่มีข้อความอื่นนอกจาก JSON:
[
  { "document_type": "...", "confidence": "...", "store_name": "...", "date": "...", "time": null, "recipient_name": null, "doc_number": null, "tax_id": null, "reference_id": null, "bank": null, "amount": null, "items": [], "subtotal": null, "vat": null, "total": 0, "notes": null },
  ...
]

หากรูปใดอ่านไม่ได้ ให้ใส่: { "document_type": "other", "confidence": "low", "store_name": null, "date": null, "time": null, "recipient_name": null, "doc_number": null, "tax_id": null, "reference_id": null, "bank": null, "amount": null, "items": [], "subtotal": null, "vat": null, "total": null, "notes": null }`;
}

function extractJsonArray(text: string): any[] | null {
  const start = text.indexOf("[");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "[" || ch === "{") depth++;
    if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0 && ch === "]") {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

async function callGeminiBatch(
  apiKey: string,
  model: string,
  images: Array<{ mimeType: string; imageData: string }>
): Promise<any[]> {
  const prompt = buildBatchPrompt(images.length);

  // สร้าง parts: รูปทั้งหมด + prompt ท้ายสุด
  const parts: any[] = images.map((img) => ({
    inline_data: { mime_type: img.mimeType, data: img.imageData },
  }));
  parts.push({ text: prompt });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0, maxOutputTokens: 8192 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini API error (${res.status}): ${err.error?.message || res.statusText}`);
  }

  const result = await res.json();
  const text: string = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const arr = extractJsonArray(text);
  if (!arr) throw new Error("ไม่สามารถอ่าน JSON array จากคำตอบ AI ได้");
  return arr;
}

const ERROR_RESULT = {
  document_type: "other",
  confidence: "low",
  store_name: null,
  date: null,
  time: null,
  recipient_name: null,
  doc_number: null,
  tax_id: null,
  reference_id: null,
  bank: null,
  amount: null,
  items: [],
  subtotal: null,
  vat: null,
  total: null,
  notes: null,
};

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { GEMINI_API_KEY } = process.env;
  if (!GEMINI_API_KEY) return res.status(503).json({ error: "not_configured" });

  const { images, modelPreference } = req.body || {};
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: "Missing images array" });
  }
  if (images.length > MAX_IMAGES_PER_REQUEST) {
    return res.status(400).json({ error: `ส่งได้สูงสุด ${MAX_IMAGES_PER_REQUEST} รูปต่อครั้ง` });
  }

  const model = modelPreference === "flash20" ? "gemini-2.0-flash" : "gemini-2.5-flash";
  const modelLabel = modelPreference === "flash20" ? "Gemini 2.0 Flash" : "Gemini 2.5 Flash";

  try {
    // Retry สูงสุด 2 ครั้ง ถ้าโดน rate limit
    let results: any[] | null = null;
    let lastErr: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        results = await callGeminiBatch(GEMINI_API_KEY, model, images);
        break;
      } catch (err: any) {
        lastErr = err;
        const isRateLimit =
          err.message?.includes("429") ||
          err.message?.includes("RESOURCE_EXHAUSTED") ||
          err.message?.includes("quota");
        if (attempt < 2 && isRateLimit) {
          await new Promise((r) => setTimeout(r, (attempt + 1) * 6000));
          continue;
        }
        throw err;
      }
    }

    if (!results) throw lastErr;

    // ทำให้ผลลัพธ์ตรงกับจำนวนรูปที่ส่ง
    while (results.length < images.length) results.push({ ...ERROR_RESULT });
    const trimmed = results.slice(0, images.length);

    return res.json({
      results: trimmed,
      modelUsed: modelLabel,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
