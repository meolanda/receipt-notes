export type Profile = "personal" | "company";
export type ReceiptTag = "ส่วนตัว" | "บริษัท" | "เบิกได้" | "เบิกแล้ว";

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

export type DocumentTypeValue = "receipt" | "quotation" | "tax_invoice" | "invoice" | "bank_slip" | "market_bill" | "other";

export interface Receipt {
  id: string;
  profile: Profile;
  title: string;
  storeName: string;
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
  imageUrl?: string;
  documentType?: DocumentTypeValue;
  createdAt: string;
  synced?: boolean;
}

const STORAGE_KEY = "receipt-tracker-data";
const CUSTOM_CATEGORIES_KEY = "receipt-custom-categories";

export const DEFAULT_PERSONAL_CATEGORIES = [
  "อาหาร", "ช้อปปิ้ง", "ท่องเที่ยว", "สุขภาพ", "ค่าน้ำ/ไฟ", "ขนส่ง", "บันเทิง", "อื่นๆ",
];

export const DEFAULT_COMPANY_CATEGORIES = [
  "อะไหล่", "น้ำยาแอร์", "ค่าเดินทาง", "เครื่องมือ", "ค่าแรง", "ค่าน้ำ/ไฟ", "อื่นๆ",
];

// Legacy combined list (kept for backward compat)
export const CATEGORIES = [...new Set([...DEFAULT_COMPANY_CATEGORIES, ...DEFAULT_PERSONAL_CATEGORIES])];

export function getCustomCategories(): { personal: string[]; company: string[] } {
  try {
    const data = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    if (data) return JSON.parse(data);
  } catch {}
  return { personal: [], company: [] };
}

export function saveCustomCategories(custom: { personal: string[]; company: string[] }): void {
  localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(custom));
}

export function getCategoriesForProfile(profile: Profile): string[] {
  const defaults = profile === "personal" ? DEFAULT_PERSONAL_CATEGORIES : DEFAULT_COMPANY_CATEGORIES;
  const custom = getCustomCategories();
  const customList = profile === "personal" ? custom.personal : custom.company;
  return [...new Set([...defaults, ...customList])];
}

export function addCustomCategory(profile: Profile, category: string): void {
  const custom = getCustomCategories();
  const key = profile === "personal" ? "personal" : "company";
  if (!custom[key].includes(category)) {
    custom[key].push(category);
    saveCustomCategories(custom);
  }
}

export function removeCustomCategory(profile: Profile, category: string): void {
  const custom = getCustomCategories();
  const key = profile === "personal" ? "personal" : "company";
  custom[key] = custom[key].filter((c) => c !== category);
  saveCustomCategories(custom);
}

export function isCategoryUsed(category: string, profile: Profile): boolean {
  return getReceipts().some((r) => r.profile === profile && r.category === category);
}

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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
  } catch (e) {
    // localStorage เต็ม — ลองบันทึกโดยไม่มีรูป
    const withoutImage = receipts.map((r) => ({ ...r, imageData: undefined }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(withoutImage));
      console.warn("localStorage เต็ม: บันทึกข้อมูลโดยไม่มีรูปภาพ");
    } catch {
      throw new Error("พื้นที่จัดเก็บเต็ม กรุณาลบใบเสร็จเก่าออกก่อน");
    }
  }
  return newReceipt;
}

export function updateReceipt(id: string, data: Partial<Omit<Receipt, "id" | "createdAt">>): Receipt | null {
  const receipts = getReceipts();
  const idx = receipts.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  receipts[idx] = { ...receipts[idx], ...data };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
  return receipts[idx];
}

const DELETED_IDS_KEY = "receipt-deleted-ids";

export function getDeletedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DELETED_IDS_KEY) || "[]");
  } catch { return []; }
}

const DELETED_IDS_TTL_DAYS = 90;

export function deleteReceipt(id: string): void {
  const receipts = getReceipts().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
  // จำไว้ว่า id นี้ถูกลบแล้ว เพื่อป้องกัน restore กลับมา
  const deleted = getDeletedIds();
  if (!deleted.includes(id)) {
    deleted.push(id);
    // trim id ที่เก่ากว่า 90 วัน (เก็บแค่ 500 รายการล่าสุด)
    const trimmed = deleted.slice(-500);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(trimmed));
  }
}

// ลบออกจาก localStorage เฉยๆ โดยไม่บล็อก restore (ใช้สำหรับล้างข้อมูลเสียหาย)
export function removeReceiptLocal(id: string): void {
  const receipts = getReceipts().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
}

export function clearDeletedIds(): void {
  localStorage.removeItem(DELETED_IDS_KEY);
}

export function exportToCSV(receipts: Receipt[]): string {
  const headers = [
    "วันที่", "หัวข้อ", "ร้านค้า/ผู้รับเงิน", "รายละเอียด", "หมวดหมู่", "แท็ก", "โปรไฟล์",
    "โครงการ/ลูกค้า", "รายการสินค้า", "ยอดรวม (บาท)", "VAT 7%", "ยอดรวมสุทธิ",
    "หมายเหตุการเบิก"
  ];
  const rows = receipts.map((r) => {
    const itemsStr = r.items.map((i) => `${i.name} x${i.quantity} = ${i.price}฿`).join("; ");
    return [
      r.date,
      `"${r.title}"`,
      `"${r.storeName || ""}"`,
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
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5).replace(":", "-");
  a.download = `ใบเสร็จ${suffix}_${dateStr}_${timeStr}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

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
  "ช้อปปิ้ง": "bg-pink-100 text-pink-700 border-pink-200",
  "ท่องเที่ยว": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "สุขภาพ": "bg-rose-100 text-rose-700 border-rose-200",
  "ขนส่ง": "bg-indigo-100 text-indigo-700 border-indigo-200",
  "บันเทิง": "bg-violet-100 text-violet-700 border-violet-200",
  "อื่นๆ": "bg-gray-100 text-gray-700 border-gray-200",
};

export function getActiveProfile(): Profile {
  return (localStorage.getItem("receipt-active-profile") as Profile) || "personal";
}

export function setActiveProfile(profile: Profile): void {
  localStorage.setItem("receipt-active-profile", profile);
}
