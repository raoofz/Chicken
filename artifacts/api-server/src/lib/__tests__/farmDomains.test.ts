import { describe, it, expect } from "vitest";
import {
  categoryToDomain,
  validateCategoryDomainConsistency,
  classifyExpenseCategory,
  classifyIncomeCategory,
  isValidExpenseCategory,
  isValidIncomeCategory,
  getCategoryLabel,
  getCategoryIcon,
  DOMAINS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  CATEGORY_DOMAIN_MAP,
} from "../farmDomains.js";

describe("farmDomains — SSOT transaction domain logic", () => {
  // ── categoryToDomain ──────────────────────────────────────────────────────
  describe("categoryToDomain", () => {
    it("maps feed categories to FEED domain", () => {
      expect(categoryToDomain("feed")).toBe("feed");
      expect(categoryToDomain("feed_purchase")).toBe("feed");
    });

    it("maps egg categories to EGG domain", () => {
      expect(categoryToDomain("eggs_purchase")).toBe("egg");
      expect(categoryToDomain("incubation_supplies")).toBe("egg");
    });

    it("maps health categories to HEALTH domain", () => {
      expect(categoryToDomain("medicine")).toBe("health");
      expect(categoryToDomain("vaccines")).toBe("health");
      expect(categoryToDomain("disinfection")).toBe("health");
    });

    it("maps operational categories correctly", () => {
      expect(categoryToDomain("electricity")).toBe("operational");
      expect(categoryToDomain("water")).toBe("operational");
      expect(categoryToDomain("fuel")).toBe("operational");
      expect(categoryToDomain("labor")).toBe("operational");
      expect(categoryToDomain("equipment")).toBe("operational");
      expect(categoryToDomain("maintenance")).toBe("operational");
      expect(categoryToDomain("transport")).toBe("operational");
      expect(categoryToDomain("rent")).toBe("operational");
    });

    it("maps income categories to INCOME domain", () => {
      expect(categoryToDomain("egg_sale")).toBe("income");
      expect(categoryToDomain("chick_sale")).toBe("income");
      expect(categoryToDomain("chicken_sale")).toBe("income");
      expect(categoryToDomain("manure_sale")).toBe("income");
    });

    it("falls back to GENERAL for unknown categories", () => {
      expect(categoryToDomain("nonexistent")).toBe("general");
      expect(categoryToDomain("")).toBe("general");
    });

    it("maps 'other' to GENERAL", () => {
      expect(categoryToDomain("other")).toBe("general");
    });
  });

  // ── validateCategoryDomainConsistency ─────────────────────────────────────
  describe("validateCategoryDomainConsistency", () => {
    it("returns null for valid expense categories", () => {
      for (const cat of Object.values(EXPENSE_CATEGORIES)) {
        expect(validateCategoryDomainConsistency("expense", cat)).toBeNull();
      }
    });

    it("returns null for valid income categories", () => {
      for (const cat of Object.values(INCOME_CATEGORIES)) {
        expect(validateCategoryDomainConsistency("income", cat)).toBeNull();
      }
    });

    it("rejects income categories used as expense", () => {
      const result = validateCategoryDomainConsistency("expense", "egg_sale");
      expect(result).toContain("Invalid expense category");
    });

    it("rejects expense categories used as income", () => {
      const result = validateCategoryDomainConsistency("income", "feed");
      expect(result).toContain("Invalid income category");
    });

    it("rejects completely unknown categories", () => {
      expect(validateCategoryDomainConsistency("expense", "fake_cat")).toContain("Invalid");
      expect(validateCategoryDomainConsistency("income", "fake_cat")).toContain("Invalid");
    });
  });

  // ── classifyExpenseCategory ───────────────────────────────────────────────
  describe("classifyExpenseCategory", () => {
    it("classifies Arabic feed-related text", () => {
      expect(classifyExpenseCategory("شراء علف للدجاج")).toBe("feed");
    });

    it("classifies Swedish feed text", () => {
      expect(classifyExpenseCategory("foder till hönsen")).toBe("feed");
    });

    it("classifies medicine", () => {
      expect(classifyExpenseCategory("شراء دواء")).toBe("medicine");
    });

    it("classifies electricity", () => {
      expect(classifyExpenseCategory("فاتورة كهرباء")).toBe("electricity");
    });

    it("classifies vaccine", () => {
      expect(classifyExpenseCategory("لقاح نيوكاسل")).toBe("vaccines");
    });

    it("gives priority to egg purchase over feed for egg-related text", () => {
      expect(classifyExpenseCategory("شراء بيض تفقيس")).toBe("eggs_purchase");
    });

    it("returns 'other' for unrecognized text", () => {
      expect(classifyExpenseCategory("something random xyz")).toBe("other");
    });
  });

  // ── classifyIncomeCategory ────────────────────────────────────────────────
  describe("classifyIncomeCategory", () => {
    it("classifies egg sale in Arabic", () => {
      expect(classifyIncomeCategory("بيع بيض")).toBe("egg_sale");
    });

    it("classifies chick sale in Arabic", () => {
      expect(classifyIncomeCategory("بيع كتكوت")).toBe("chick_sale");
    });

    it("classifies chicken sale in Arabic", () => {
      expect(classifyIncomeCategory("بيع دجاج")).toBe("chicken_sale");
    });

    it("classifies manure sale in Arabic", () => {
      expect(classifyIncomeCategory("بيع سماد")).toBe("manure_sale");
    });

    it("classifies egg sale in Swedish", () => {
      expect(classifyIncomeCategory("eggs sold")).toBe("egg_sale");
    });

    it("returns 'other' for unrecognized income text", () => {
      expect(classifyIncomeCategory("random text here")).toBe("other");
    });
  });

  // ── isValidExpenseCategory / isValidIncomeCategory ────────────────────────
  describe("isValidExpenseCategory / isValidIncomeCategory", () => {
    it("validates all defined expense categories", () => {
      for (const cat of Object.values(EXPENSE_CATEGORIES)) {
        expect(isValidExpenseCategory(cat)).toBe(true);
      }
    });

    it("validates all defined income categories", () => {
      for (const cat of Object.values(INCOME_CATEGORIES)) {
        expect(isValidIncomeCategory(cat)).toBe(true);
      }
    });

    it("rejects unknown strings", () => {
      expect(isValidExpenseCategory("xyz")).toBe(false);
      expect(isValidIncomeCategory("xyz")).toBe(false);
    });

    it("income categories are not valid expense categories", () => {
      expect(isValidExpenseCategory("egg_sale")).toBe(false);
    });

    it("expense categories are not valid income categories", () => {
      expect(isValidIncomeCategory("feed")).toBe(false);
    });
  });

  // ── getCategoryLabel / getCategoryIcon ────────────────────────────────────
  describe("getCategoryLabel / getCategoryIcon", () => {
    it("returns Arabic label for feed", () => {
      expect(getCategoryLabel("feed", "ar")).toBe("علف");
    });

    it("returns Swedish label for feed", () => {
      expect(getCategoryLabel("feed", "sv")).toBe("Foder");
    });

    it("returns fallback for unknown category", () => {
      expect(getCategoryLabel("nonexistent", "ar")).toBe("أخرى");
      expect(getCategoryLabel("nonexistent", "sv")).toBe("Övrigt");
    });

    it("returns icon for known category", () => {
      expect(getCategoryIcon("feed")).toBe("🌾");
      expect(getCategoryIcon("egg_sale")).toBe("🥚");
    });

    it("returns default icon for unknown category", () => {
      expect(getCategoryIcon("nonexistent")).toBe("📦");
    });
  });

  // ── CATEGORY_DOMAIN_MAP completeness ──────────────────────────────────────
  describe("CATEGORY_DOMAIN_MAP completeness", () => {
    it("covers all EXPENSE_CATEGORIES", () => {
      for (const cat of Object.values(EXPENSE_CATEGORIES)) {
        expect(CATEGORY_DOMAIN_MAP).toHaveProperty(cat);
      }
    });

    it("covers all INCOME_CATEGORIES", () => {
      for (const cat of Object.values(INCOME_CATEGORIES)) {
        expect(CATEGORY_DOMAIN_MAP).toHaveProperty(cat);
      }
    });

    it("all mapped values are valid domain strings", () => {
      const validDomains = new Set(Object.values(DOMAINS));
      for (const domain of Object.values(CATEGORY_DOMAIN_MAP)) {
        expect(validDomains.has(domain)).toBe(true);
      }
    });
  });
});
