import { describe, it, expect, beforeEach } from "vitest";
import { receiptToSheetRow, getTokenMinutesLeft, isTokenExpired, saveGoogleToken, clearGoogleToken } from "@/lib/google-api";
import type { Receipt } from "@/lib/receipt-store";

const makeReceipt = (overrides: Partial<Receipt> = {}): Receipt => ({
  id: "test-id",
  profile: "personal",
  title: "ค่าอาหาร",
  storeName: "ร้านข้าว",
  description: "",
  category: "อาหาร",
  tag: "ส่วนตัว",
  date: "2026-04-01",
  totalAmount: 100,
  vatEnabled: false,
  vatAmount: 0,
  grandTotal: 100,
  items: [{ name: "ข้าวผัด", quantity: 1, price: 100 }],
  project: "",
  reimbursementNote: "",
  createdAt: "2026-04-01T00:00:00.000Z",
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
});

describe("receiptToSheetRow", () => {
  it("คืน array 13 คอลัมน์", () => {
    const row = receiptToSheetRow(makeReceipt());
    expect(row).toHaveLength(13);
  });

  it("คอลัมน์แรกเป็นวันที่", () => {
    const row = receiptToSheetRow(makeReceipt());
    expect(row[0]).toBe("2026-04-01");
  });

  it("profile personal แสดงเป็น ส่วนตัว", () => {
    const row = receiptToSheetRow(makeReceipt({ profile: "personal" }));
    expect(row[1]).toBe("ส่วนตัว");
  });

  it("profile company แสดงเป็น บริษัท", () => {
    const row = receiptToSheetRow(makeReceipt({ profile: "company" }));
    expect(row[1]).toBe("บริษัท");
  });

  it("ใส่ imageUrl ในคอลัมน์ที่ 12", () => {
    const row = receiptToSheetRow(makeReceipt(), "https://drive.google.com/file/d/abc/view");
    expect(row[11]).toBe("https://drive.google.com/file/d/abc/view");
  });

  it("VAT 0 เมื่อ vatEnabled = false", () => {
    const row = receiptToSheetRow(makeReceipt({ vatEnabled: false, vatAmount: 7 }));
    expect(row[8]).toBe("0");
  });

  it("VAT แสดงค่าเมื่อ vatEnabled = true", () => {
    const row = receiptToSheetRow(makeReceipt({ vatEnabled: true, vatAmount: 7, grandTotal: 107 }));
    expect(row[8]).toBe("7.00");
  });
});

describe("token helpers", () => {
  it("getTokenMinutesLeft คืน null ถ้าไม่มี token", () => {
    expect(getTokenMinutesLeft()).toBeNull();
  });

  it("isTokenExpired คืน false ถ้าไม่มี token", () => {
    expect(isTokenExpired()).toBe(false);
  });

  it("getTokenMinutesLeft คืนจำนวนนาทีที่เหลือ", () => {
    saveGoogleToken({ accessToken: "test", expiresAt: Date.now() + 30 * 60 * 1000 });
    const mins = getTokenMinutesLeft();
    expect(mins).toBeGreaterThanOrEqual(29);
    expect(mins).toBeLessThanOrEqual(30);
  });

  it("isTokenExpired คืน true เมื่อ token หมดอายุ", () => {
    saveGoogleToken({ accessToken: "test", expiresAt: Date.now() - 1000 });
    expect(isTokenExpired()).toBe(true);
  });

  it("getTokenMinutesLeft คืน null เมื่อ token หมดอายุ", () => {
    saveGoogleToken({ accessToken: "test", expiresAt: Date.now() - 1000 });
    expect(getTokenMinutesLeft()).toBeNull();
  });

  it("clearGoogleToken ลบ token ออก", () => {
    saveGoogleToken({ accessToken: "test", expiresAt: Date.now() + 3600000 });
    clearGoogleToken();
    expect(getTokenMinutesLeft()).toBeNull();
  });
});
