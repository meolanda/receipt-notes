const CLAUDE_SETTINGS_KEY = "receipt-claude-settings";

export type ClaudeModel = "flash25" | "flash20";

export type DocumentType = "receipt" | "quotation" | "tax_invoice" | "invoice" | "bank_slip" | "market_bill" | "other";
export type Confidence = "high" | "medium" | "low";

export interface ClaudeSettings {
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
    if (data) {
      const parsed = JSON.parse(data);
      return { modelPreference: parsed.modelPreference || "flash25" };
    }
  } catch {}
  return { modelPreference: "flash25" };
}

export function saveClaudeSettings(settings: ClaudeSettings): void {
  localStorage.setItem(CLAUDE_SETTINGS_KEY, JSON.stringify(settings));
}

function mapToScanResult(data: any, modelUsed = "Gemini"): ScanResult {
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

export async function scanPDF(pdfBase64: string): Promise<ScanResult[]> {
  const match = pdfBase64.match(/^data:(application\/pdf);base64,(.+)$/);
  if (!match) throw new Error("Invalid PDF data");

  const res = await fetch("/api/scan-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mimeType: match[1],
      imageData: match[2],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err.error === "not_configured") throw new Error("ยังไม่ได้ตั้งค่า GEMINI_API_KEY บน Vercel");
    throw new Error(`PDF scan error (${res.status}): ${err.error || res.statusText}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);

  const receipts = Array.isArray(data.receipts) ? data.receipts : [data];
  return receipts.map((r: any) => mapToScanResult(r, data.modelUsed || "Gemini"));
}

export async function scanReceipt(imageBase64: string): Promise<ScanResult> {
  const settings = getClaudeSettings();

  const match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data");

  const res = await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mimeType: match[1],
      imageData: match[2],
      modelPreference: settings.modelPreference,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err.error === "not_configured") throw new Error("ยังไม่ได้ตั้งค่า GEMINI_API_KEY บน Vercel");
    throw new Error(`Scan error (${res.status}): ${err.error || res.statusText}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);

  return mapToScanResult(data, data.modelUsed || "Gemini");
}
