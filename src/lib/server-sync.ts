import type { Receipt } from "./receipt-store";

/** true ถ้าไม่ได้รันบน localhost (= deploy บน Vercel) */
export function isServerSyncAvailable(): boolean {
  return typeof window !== "undefined" && !window.location.hostname.includes("localhost");
}

/** ตรวจสอบว่า Vercel ตั้งค่า env vars ไว้แล้วหรือยัง */
export async function checkServerSyncConfigured(): Promise<boolean> {
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _ping: true, receipt: null }),
    });
    const data = await res.json();
    return data.error !== "not_configured";
  } catch {
    return false;
  }
}

export async function syncReceiptToServer(receipt: Receipt): Promise<string | undefined> {
  let imageBase64: string | undefined;
  let imageExt: string | undefined;

  if (receipt.imageData) {
    const match = receipt.imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (match) {
      imageExt = match[1];
      imageBase64 = match[2];
    }
  }

  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receipt, imageBase64, imageExt }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Sync error: ${res.status}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);

  return data.imageUrl || undefined;
}
