/**
 * Tests for API route input validation rules.
 * These test the validation logic patterns used across routes
 * without requiring a running server or database.
 */
import { describe, it, expect } from "vitest";
import {
  validateCategoryDomainConsistency,
  categoryToDomain,
} from "../../lib/farmDomains.js";

describe("transaction API validation rules", () => {
  describe("required field checks", () => {
    function validateTransactionBody(body: Record<string, unknown>): string | null {
      const { date, type, category, description, amount } = body;
      if (!date || !type || !category || !description || !amount) {
        return "Missing required fields";
      }
      if (!["income", "expense"].includes(type as string)) {
        return "Invalid type: must be 'income' or 'expense'";
      }
      return null;
    }

    it("rejects missing date", () => {
      expect(
        validateTransactionBody({ type: "income", category: "egg_sale", description: "test", amount: 100 })
      ).toBe("Missing required fields");
    });

    it("rejects missing type", () => {
      expect(
        validateTransactionBody({ date: "2026-01-01", category: "egg_sale", description: "test", amount: 100 })
      ).toBe("Missing required fields");
    });

    it("rejects missing category", () => {
      expect(
        validateTransactionBody({ date: "2026-01-01", type: "income", description: "test", amount: 100 })
      ).toBe("Missing required fields");
    });

    it("rejects invalid type", () => {
      expect(
        validateTransactionBody({ date: "2026-01-01", type: "transfer", category: "feed", description: "x", amount: 10 })
      ).toBe("Invalid type: must be 'income' or 'expense'");
    });

    it("accepts valid income body", () => {
      expect(
        validateTransactionBody({ date: "2026-01-01", type: "income", category: "egg_sale", description: "eggs", amount: 100 })
      ).toBeNull();
    });

    it("accepts valid expense body", () => {
      expect(
        validateTransactionBody({ date: "2026-01-01", type: "expense", category: "feed", description: "feed", amount: 50 })
      ).toBeNull();
    });
  });

  describe("domain integrity via validateCategoryDomainConsistency", () => {
    it("allows egg_sale as income", () => {
      expect(validateCategoryDomainConsistency("income", "egg_sale")).toBeNull();
    });

    it("allows feed as expense", () => {
      expect(validateCategoryDomainConsistency("expense", "feed")).toBeNull();
    });

    it("rejects feed as income", () => {
      const err = validateCategoryDomainConsistency("income", "feed");
      expect(err).not.toBeNull();
    });

    it("rejects egg_sale as expense", () => {
      const err = validateCategoryDomainConsistency("expense", "egg_sale");
      expect(err).not.toBeNull();
    });
  });

  describe("domain derivation for transaction storage", () => {
    it("derives 'income' domain for income categories", () => {
      expect(categoryToDomain("egg_sale")).toBe("income");
      expect(categoryToDomain("chick_sale")).toBe("income");
    });

    it("derives 'feed' domain for feed categories", () => {
      expect(categoryToDomain("feed")).toBe("feed");
      expect(categoryToDomain("feed_purchase")).toBe("feed");
    });

    it("derives 'health' domain for health categories", () => {
      expect(categoryToDomain("medicine")).toBe("health");
      expect(categoryToDomain("vaccines")).toBe("health");
    });
  });
});

describe("invoice API validation rules", () => {
  function validateInvoiceBody(body: Record<string, unknown>): string | null {
    const { customerName, totalAmount, issueDate } = body;
    if (!customerName || totalAmount === undefined || !issueDate) {
      return "customerName, totalAmount, issueDate are required";
    }
    return null;
  }

  it("rejects missing customerName", () => {
    expect(validateInvoiceBody({ totalAmount: 100, issueDate: "2026-01-01" })).not.toBeNull();
  });

  it("rejects missing totalAmount", () => {
    expect(validateInvoiceBody({ customerName: "Test", issueDate: "2026-01-01" })).not.toBeNull();
  });

  it("rejects missing issueDate", () => {
    expect(validateInvoiceBody({ customerName: "Test", totalAmount: 100 })).not.toBeNull();
  });

  it("accepts valid invoice body", () => {
    expect(validateInvoiceBody({ customerName: "Test", totalAmount: 100, issueDate: "2026-01-01" })).toBeNull();
  });

  it("allows totalAmount of 0", () => {
    expect(validateInvoiceBody({ customerName: "Test", totalAmount: 0, issueDate: "2026-01-01" })).toBeNull();
  });
});

describe("payment API validation rules", () => {
  function validatePaymentBody(body: Record<string, unknown>): string | null {
    const { invoiceId, amount, date } = body;
    if (!invoiceId || amount === undefined || !date) {
      return "invoiceId, amount, date are required";
    }
    if (Number(amount) <= 0) {
      return "amount must be positive";
    }
    return null;
  }

  it("rejects missing invoiceId", () => {
    expect(validatePaymentBody({ amount: 100, date: "2026-01-01" })).not.toBeNull();
  });

  it("rejects missing amount", () => {
    expect(validatePaymentBody({ invoiceId: 1, date: "2026-01-01" })).not.toBeNull();
  });

  it("rejects zero amount", () => {
    expect(validatePaymentBody({ invoiceId: 1, amount: 0, date: "2026-01-01" })).toBe("amount must be positive");
  });

  it("rejects negative amount", () => {
    expect(validatePaymentBody({ invoiceId: 1, amount: -10, date: "2026-01-01" })).toBe("amount must be positive");
  });

  it("accepts valid payment", () => {
    expect(validatePaymentBody({ invoiceId: 1, amount: 50, date: "2026-01-01" })).toBeNull();
  });
});
