export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Receipt {
  id: string;
  title: string;
  description: string;
  category: string;
  date: string;
  totalAmount: number;
  items: ReceiptItem[];
  imageData?: string; // base64
  createdAt: string;
}

const STORAGE_KEY = "receipt-tracker-data";

export function getReceipts(): Receipt[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveReceipt(receipt: Omit<Receipt, "id" | "createdAt">): Receipt {
  const receipts = getReceipts();
  const newReceipt: Receipt = {
    ...receipt,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  receipts.unshift(newReceipt);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
  return newReceipt;
}

export function deleteReceipt(id: string): void {
  const receipts = getReceipts().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
}

export function exportToCSV(receipts: Receipt[]): string {
  const headers = ["วันที่", "หัวข้อ", "รายละเอียด", "หมวดหมู่", "ยอดรวม (บาท)", "รายการสินค้า"];
  const rows = receipts.map((r) => {
    const itemsStr = r.items.map((i) => `${i.name} x${i.quantity} = ${i.price}฿`).join("; ");
    return [
      r.date,
      `"${r.title}"`,
      `"${r.description}"`,
      r.category,
      r.totalAmount.toFixed(2),
      `"${itemsStr}"`,
    ].join(",");
  });
  // Add BOM for Excel Thai support
  return "\uFEFF" + [headers.join(","), ...rows].join("\n");
}

export function downloadCSV(receipts: Receipt[]) {
  const csv = exportToCSV(receipts);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ใบเสร็จ_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const CATEGORIES = [
  "อาหาร",
  "เดินทาง",
  "ช้อปปิ้ง",
  "สาธารณูปโภค",
  "สุขภาพ",
  "การศึกษา",
  "บันเทิง",
  "อื่นๆ",
];
