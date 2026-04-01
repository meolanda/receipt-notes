import { describe, it, expect, beforeEach } from "vitest";
import {
  getReceipts,
  saveReceipt,
  updateReceipt,
  deleteReceipt,
  getCategoriesForProfile,
  DEFAULT_PERSONAL_CATEGORIES,
  DEFAULT_COMPANY_CATEGORIES,
} from "@/lib/receipt-store";

const makeReceipt = (overrides = {}) => ({
  profile: "personal" as const,
  title: "ข้าวผัด",
  storeName: "ร้านอาหาร",
  description: "",
  category: "อาหาร",
  tag: "ส่วนตัว" as const,
  date: "2026-04-01",
  totalAmount: 100,
  vatEnabled: false,
  vatAmount: 0,
  grandTotal: 100,
  items: [{ name: "ข้าวผัด", quantity: 1, price: 100 }],
  project: "",
  reimbursementNote: "",
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
});

describe("receipt-store", () => {
  describe("getReceipts", () => {
    it("คืน array ว่างเมื่อไม่มีข้อมูล", () => {
      expect(getReceipts()).toEqual([]);
    });

    it("คืน array ว่างเมื่อ localStorage เสียหาย", () => {
      localStorage.setItem("receipt-tracker-data", "invalid json");
      expect(getReceipts()).toEqual([]);
    });
  });

  describe("saveReceipt", () => {
    it("บันทึกใบเสร็จและคืน object ที่มี id กับ createdAt", () => {
      const saved = saveReceipt(makeReceipt());
      expect(saved.id).toBeDefined();
      expect(saved.createdAt).toBeDefined();
      expect(saved.title).toBe("ข้าวผัด");
    });

    it("บันทึกหลายรายการได้และเรียงใหม่สุดก่อน", () => {
      saveReceipt(makeReceipt({ title: "รายการแรก" }));
      saveReceipt(makeReceipt({ title: "รายการสอง" }));
      const all = getReceipts();
      expect(all).toHaveLength(2);
      expect(all[0].title).toBe("รายการสอง");
    });
  });

  describe("updateReceipt", () => {
    it("อัปเดตข้อมูลที่ระบุ", () => {
      const saved = saveReceipt(makeReceipt());
      updateReceipt(saved.id, { title: "ข้าวผัดปู" });
      const updated = getReceipts().find((r) => r.id === saved.id);
      expect(updated?.title).toBe("ข้าวผัดปู");
    });

    it("คืน null ถ้าไม่เจอ id", () => {
      const result = updateReceipt("ไม่มีอยู่จริง", { title: "test" });
      expect(result).toBeNull();
    });
  });

  describe("deleteReceipt", () => {
    it("ลบใบเสร็จตาม id", () => {
      const saved = saveReceipt(makeReceipt());
      expect(getReceipts()).toHaveLength(1);
      deleteReceipt(saved.id);
      expect(getReceipts()).toHaveLength(0);
    });

    it("ไม่ error ถ้าลบ id ที่ไม่มีอยู่", () => {
      expect(() => deleteReceipt("ไม่มีอยู่จริง")).not.toThrow();
    });
  });

  describe("getCategoriesForProfile", () => {
    it("คืน default categories ของ personal", () => {
      const cats = getCategoriesForProfile("personal");
      for (const c of DEFAULT_PERSONAL_CATEGORIES) {
        expect(cats).toContain(c);
      }
    });

    it("คืน default categories ของ company", () => {
      const cats = getCategoriesForProfile("company");
      for (const c of DEFAULT_COMPANY_CATEGORIES) {
        expect(cats).toContain(c);
      }
    });
  });
});
