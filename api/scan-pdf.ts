const MULTI_RECEIPT_PROMPT = `วิเคราะห์เอกสาร PDF นี้ที่อาจมีหลายใบเสร็จหรือหลายหน้า
ให้ดึงข้อมูลใบเสร็จ/ใบแจ้งหนี้ทุกใบ โดยแยกแต่ละใบออกเป็น element ต่างหาก

ประเภทเอกสารที่รองรับ:
- "receipt" = ใบเสร็จร้านค้าทั่วไป, POS, ใบเสร็จรับเงิน
- "quotation" = ใบเสนอราคา
- "tax_invoice" = ใบกำกับภาษี, Tax Invoice
- "invoice" = ใบแจ้งหนี้
- "bank_slip" = สลิปโอนเงิน, PromptPay
- "market_bill" = บิลเงินสดตลาด, บิลมือ
- "other" = อื่นๆ

สำหรับแต่ละใบเสร็จให้ดึงข้อมูล:
- document_type: ประเภทเอกสาร
- confidence: "high" / "medium" / "low"
- store_name: ชื่อร้านค้า/บริษัท
- date: วันที่ (YYYY-MM-DD) — ถ้าเป็น พ.ศ. ให้ลบ 543 (เช่น 2569 → 2026)
- time: เวลา (HH:mm) ถ้ามี
- recipient_name: ชื่อผู้รับเงิน (กรณีสลิป)
- doc_number: เลขที่เอกสาร
- tax_id: เลขผู้เสียภาษี
- reference_id: เลขอ้างอิง (กรณีสลิป)
- bank: ชื่อธนาคาร (กรณีสลิป)
- amount: จำนวนเงินโอน (กรณีสลิป)
- items: รายการสินค้า [{name, quantity, unit_price, total}]
- subtotal: ยอดก่อน VAT
- vat: VAT (ถ้ามี)
- total: ยอดรวมสุทธิ
- notes: หมายเหตุ

ตอบเฉพาะ JSON เท่านั้น ไม่มีข้อความอื่น:
{
  "receipts": [
    {
      "document_type": "receipt",
      "confidence": "high",
      "store_name": null,
      "date": null,
      "time": null,
      "recipient_name": null,
      "doc_number": null,
      "tax_id": null,
      "reference_id": null,
      "bank": null,
      "amount": null,
      "items": [],
      "subtotal": null,
      "vat": null,
      "total": null,
      "notes": null
    }
  ]
}

ถ้า field ไหนไม่มีข้อมูลให้ใส่ null
ถ้าเอกสารมีใบเสร็จเดียวให้ส่ง receipts ที่มีแค่ 1 element`;

function extractOutermostJson(text: string): string | null {
  const start = text.indexOf("{");
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
    if (ch === "{") depth++;
    if (ch === "}") { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

async function callGemini(apiKey: string, model: string, mimeType: string, data: string): Promise<any> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data } },
            { text: MULTI_RECEIPT_PROMPT },
          ],
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 8192 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini API error (${res.status}): ${err.error?.message || res.statusText}`);
  }

  const result = await res.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const jsonStr = extractOutermostJson(text);
  if (!jsonStr) throw new Error("ไม่สามารถอ่าน JSON จากคำตอบ AI ได้");
  return JSON.parse(jsonStr);
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { GEMINI_API_KEY } = process.env;
  if (!GEMINI_API_KEY) {
    return res.status(503).json({ error: "not_configured" });
  }

  const { mimeType, imageData } = req.body || {};
  if (!mimeType || !imageData) {
    return res.status(400).json({ error: "Missing mimeType or imageData" });
  }

  try {
    const model = "gemini-2.5-flash";
    const data = await callGemini(GEMINI_API_KEY, model, mimeType, imageData);
    const receipts = Array.isArray(data.receipts) ? data.receipts : [data];
    res.json({ receipts, modelUsed: "Gemini 2.5 Flash" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
