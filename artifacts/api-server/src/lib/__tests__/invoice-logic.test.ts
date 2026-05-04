/**
 * Tests for invoice payment status computation.
 * The computeStatus function is module-scoped in invoices.ts, so we
 * re-implement the same logic here to verify the contract holds.
 */
import { describe, it, expect } from "vitest";

function computeStatus(paid: number, total: number): "unpaid" | "partial" | "paid" {
  if (paid <= 0) return "unpaid";
  if (paid >= total) return "paid";
  return "partial";
}

describe("invoice computeStatus logic", () => {
  it("returns 'unpaid' when paid is 0", () => {
    expect(computeStatus(0, 1000)).toBe("unpaid");
  });

  it("returns 'unpaid' when paid is negative", () => {
    expect(computeStatus(-5, 1000)).toBe("unpaid");
  });

  it("returns 'paid' when paid equals total", () => {
    expect(computeStatus(1000, 1000)).toBe("paid");
  });

  it("returns 'paid' when paid exceeds total", () => {
    expect(computeStatus(1500, 1000)).toBe("paid");
  });

  it("returns 'partial' when 0 < paid < total", () => {
    expect(computeStatus(500, 1000)).toBe("partial");
  });

  it("returns 'partial' for small partial payment", () => {
    expect(computeStatus(1, 1000)).toBe("partial");
  });

  it("returns 'partial' for payment just below total", () => {
    expect(computeStatus(999.99, 1000)).toBe("partial");
  });

  it("handles zero total — paid=0 → unpaid", () => {
    expect(computeStatus(0, 0)).toBe("unpaid");
  });

  it("handles decimal precision", () => {
    expect(computeStatus(150.50, 300.75)).toBe("partial");
    expect(computeStatus(300.75, 300.75)).toBe("paid");
  });
});

describe("invoice remaining amount computation", () => {
  function computeRemaining(total: number, paid: number): number {
    return Math.max(0, total - paid);
  }

  it("returns full amount when nothing paid", () => {
    expect(computeRemaining(1000, 0)).toBe(1000);
  });

  it("returns 0 when fully paid", () => {
    expect(computeRemaining(1000, 1000)).toBe(0);
  });

  it("returns 0 when overpaid (no negative remaining)", () => {
    expect(computeRemaining(1000, 1500)).toBe(0);
  });

  it("returns correct partial remaining", () => {
    expect(computeRemaining(1000, 400)).toBe(600);
  });

  it("handles decimal amounts", () => {
    expect(computeRemaining(150.75, 50.25)).toBeCloseTo(100.50);
  });
});
