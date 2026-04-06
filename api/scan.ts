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

async function callGemini(apiKey: string, model: string, mimeType: string, imageData: string): Promise<any> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: imageData } },
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
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  const jsonMatch = codeBlockMatch ? codeBlockMatch[1] : text.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonMatch) throw new Error("ไม่สามารถอ่าน JSON จากคำตอบ AI ได้");
  return JSON.parse(jsonMatch);
}

function isIncomplete(data: any): boolean {
  if (data.document_type === "bank_slip") {
    return !data.recipient_name || !data.date || (!data.amount && data.amount !== 0);
  }
  return !data.store_name || !data.date || (!data.total && data.total !== 0);
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

  const { mimeType, imageData, modelPreference } = req.body || {};
  if (!mimeType || !imageData) {
    return res.status(400).json({ error: "Missing mimeType or imageData" });
  }

  try {
    const flash25 = "gemini-2.5-flash";
    const flash20 = "gemini-2.0-flash";

    let data: any;
    let modelUsed: string;

    if (modelPreference === "flash20") {
      data = await callGemini(GEMINI_API_KEY, flash20, mimeType, imageData);
      modelUsed = "Gemini 2.0 Flash";
    } else {
      data = await callGemini(GEMINI_API_KEY, flash25, mimeType, imageData);
      modelUsed = "Gemini 2.5 Flash";
      if (isIncomplete(data)) {
        data = await callGemini(GEMINI_API_KEY, flash20, mimeType, imageData);
        modelUsed = "Gemini 2.0 Flash";
      }
    }

    res.json({ ...data, modelUsed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
