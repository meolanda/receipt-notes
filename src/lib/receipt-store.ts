export type Profile = "personal" | "company";
export type ReceiptTag = "ส่วนตัว" | "บริษัท" | "เบิกได้" | "เบิกแล้ว";

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Receipt {
  id: string;
  profile: Profile;
  title: string;
  description: string;
  category: string;
  tag: ReceiptTag;
  date: string;
  totalAmount: number;
  vatEnabled: boolean;
  vatAmount: number;
  grandTotal: number;
  items: ReceiptItem[];
  project: string;
  reimbursementNote: string;
  imageData?: string;
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

export function getReceiptsByProfile(profile: Profile): Receipt[] {
  return getReceipts().filter((r) => r.profile === profile);
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
  const headers = [
    "วันที่", "หัวข้อ", "รายละเอียด", "หมวดหมู่", "แท็ก", "โปรไฟล์",
    "โครงการ/ลูกค้า", "รายการสินค้า", "ยอดรวม (บาท)", "VAT 7%", "ยอดรวมสุทธิ",
    "หมายเหตุการเบิก"
  ];
  const rows = receipts.map((r) => {
    const itemsStr = r.items.map((i) => `${i.name} x${i.quantity} = ${i.price}฿`).join("; ");
    return [
      r.date,
      `"${r.title}"`,
      `"${r.description}"`,
      r.category,
      r.tag,
      r.profile === "personal" ? "ส่วนตัว" : "บริษัท",
      `"${r.project || ""}"`,
      `"${itemsStr}"`,
      r.totalAmount.toFixed(2),
      r.vatEnabled ? r.vatAmount.toFixed(2) : "0",
      r.grandTotal.toFixed(2),
      `"${r.reimbursementNote || ""}"`,
    ].join(",");
  });
  return "\uFEFF" + [headers.join(","), ...rows].join("\n");
}

export function downloadCSV(receipts: Receipt[], profileLabel?: string) {
  const csv = exportToCSV(receipts);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const suffix = profileLabel ? `_${profileLabel}` : "";
  a.download = `ใบเสร็จ${suffix}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const CATEGORIES = [
  "อะไหล่",
  "น้ำยาแอร์",
  "ค่าเดินทาง",
  "เครื่องมือ",
  "ค่าแรง",
  "ค่าน้ำ/ไฟ",
  "อาหาร",
  "อื่นๆ",
];

export const TAGS: ReceiptTag[] = ["ส่วนตัว", "บริษัท", "เบิกได้", "เบิกแล้ว"];

export const TAG_COLORS: Record<ReceiptTag, string> = {
  "ส่วนตัว": "bg-orange-100 text-orange-700 border-orange-200",
  "บริษัท": "bg-blue-100 text-blue-700 border-blue-200",
  "เบิกได้": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "เบิกแล้ว": "bg-green-100 text-green-700 border-green-200",
};

export const CATEGORY_COLORS: Record<string, string> = {
  "อะไหล่": "bg-red-100 text-red-700 border-red-200",
  "น้ำยาแอร์": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "ค่าเดินทาง": "bg-blue-100 text-blue-700 border-blue-200",
  "เครื่องมือ": "bg-amber-100 text-amber-700 border-amber-200",
  "ค่าแรง": "bg-purple-100 text-purple-700 border-purple-200",
  "ค่าน้ำ/ไฟ": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "อาหาร": "bg-orange-100 text-orange-700 border-orange-200",
  "อื่นๆ": "bg-gray-100 text-gray-700 border-gray-200",
};

export function getActiveProfile(): Profile {
  return (localStorage.getItem("receipt-active-profile") as Profile) || "personal";
}

export function setActiveProfile(profile: Profile): void {
  localStorage.setItem("receipt-active-profile", profile);
}
