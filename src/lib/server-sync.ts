import type { Receipt } from "./receipt-store";
import { getReceipts, saveReceipt, updateReceipt, getDeletedIds } from "./receipt-store";

/** true ถ้าไม่ได้รันบน localhost (= deploy บน Vercel) */
export function isServerSyncAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const { hostname, protocol } = window.location;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
  return !isLocal && protocol === "https:";
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

/** ดึงข้อมูลจาก Sheets แล้ว merge เข้า localStorage (ไม่ลบของเดิม) */
export async function restoreFromServer(): Promise<{ added: number; skipped: number }> {
  const res = await fetch("/api/restore");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Restore error: ${res.status}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);

  const rows: any[] = data.receipts || [];
  const existing = getReceipts();
  const deletedIds = getDeletedIds();

  console.log("[restoreFromServer] rows from server:", rows.length, "existing local:", existing.length, "deletedIds:", deletedIds);

  let added = 0;
  let skipped = 0;

  for (const row of rows) {
    // ข้าม id ที่เคยลบไปแล้วในเครื่องนี้
    if (row.id && deletedIds.includes(row.id)) {
      skipped++;
      continue;
    }

    // ถ้ามี id ตรงกันในเครื่อง → mark synced: true เพื่อป้องกัน sync ซ้ำ
    if (row.id) {
      const localMatch = existing.find((r) => r.id === row.id);
      if (localMatch) {
        if (!localMatch.synced) updateReceipt(localMatch.id, { synced: true });
        skipped++;
        continue;
      }
    }

    const isDuplicate = existing.some(
      (r) =>
        r.title === row.title &&
        r.date === row.date &&
        r.profile === row.profile &&
        Math.abs(r.grandTotal - (Number(row.grandTotal) || 0)) < 0.01
    );

    if (isDuplicate) {
      skipped++;
      continue;
    }

    saveReceipt({
      profile: row.profile === "personal" ? "personal" : "company",
      title: row.title || "",
      storeName: row.storeName || "",
      description: row.description || "",
      category: row.category || "อื่นๆ",
      tag: row.tag || "ส่วนตัว",
      date: row.date || new Date().toISOString().slice(0, 10),
      totalAmount: Number(row.totalAmount) || 0,
      vatEnabled: Number(row.vatAmount) > 0,
      vatAmount: Number(row.vatAmount) || 0,
      grandTotal: Number(row.grandTotal) || 0,
      items: Array.isArray(row.items)
        ? row.items.map((i: any) => ({ name: i.name || "", quantity: Number(i.qty ?? i.quantity) || 1, price: Number(i.price) || 0 }))
        : [],
      project: row.project || "",
      reimbursementNote: row.reimbursementNote || "",
      imageUrl: row.imageUrl || undefined,
      synced: true,
    });
    added++;
  }

  return { added, skipped };
}

function extractImage(receipt: Receipt) {
  let imageBase64: string | undefined;
  let imageExt: string | undefined;
  if (receipt.imageData) {
    const match = receipt.imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (match) { imageExt = match[1]; imageBase64 = match[2]; }
  }
  const { imageData: _stripped, ...receiptWithoutImage } = receipt;
  return { receiptWithoutImage, imageBase64, imageExt };
}

async function callSync(body: object): Promise<any> {
  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Sync error: ${res.status}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function syncReceiptToServer(receipt: Receipt): Promise<string | undefined> {
  const { receiptWithoutImage, imageBase64, imageExt } = extractImage(receipt);
  const data = await callSync({ receipt: receiptWithoutImage, imageBase64, imageExt });
  return data.imageUrl || undefined;
}

export async function updateReceiptOnServer(receipt: Receipt): Promise<void> {
  const { receiptWithoutImage, imageBase64, imageExt } = extractImage(receipt);
  await callSync({ action: "update", receipt: receiptWithoutImage, imageBase64, imageExt });
}

export async function deleteReceiptFromServer(id: string): Promise<void> {
  await callSync({ action: "delete", id });
}
