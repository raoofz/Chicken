import { describe, it, expect } from "vitest";
import {
  classifyGrowthStage,
  getBreedProfile,
  getExpectedDailyFeedGrams,
  getExpectedFCR,
  getExpectedProductionPct,
  rateFCR,
  rateProductionEfficiency,
  BREED_PROFILES,
  AVAILABLE_BREEDS,
} from "../breed-benchmarks.js";

describe("breed-benchmarks — poultry breed intelligence", () => {
  // ── getBreedProfile ───────────────────────────────────────────────────────
  describe("getBreedProfile", () => {
    it("returns Baladi profile for Arabic name", () => {
      const p = getBreedProfile("بلدي");
      expect(p.id).toBe("baladi");
      expect(p.purpose).toBe("dual");
    });

    it("returns Hy-Line profile for Arabic name", () => {
      const p = getBreedProfile("هاي لاين");
      expect(p.id).toBe("hyline");
      expect(p.purpose).toBe("eggs");
    });

    it("returns Ross 308 for partial alias 'ross'", () => {
      const p = getBreedProfile("ross");
      expect(p.id).toBe("ross308");
      expect(p.purpose).toBe("meat");
    });

    it("returns Cobb 500 for 'cobb'", () => {
      const p = getBreedProfile("cobb");
      expect(p.id).toBe("cobb500");
    });

    it("returns Lohmann for 'lohmann'", () => {
      const p = getBreedProfile("lohmann");
      expect(p.id).toBe("lohmann");
    });

    it("returns default profile for empty string", () => {
      const p = getBreedProfile("");
      expect(p.id).toBe("default");
    });

    it("returns default profile for unknown breed", () => {
      const p = getBreedProfile("unknown_xyz");
      expect(p.id).toBe("default");
    });
  });

  // ── classifyGrowthStage ───────────────────────────────────────────────────
  describe("classifyGrowthStage", () => {
    it("returns 'chick' for birds under 7 days regardless of purpose", () => {
      expect(classifyGrowthStage(3, "eggs")).toBe("chick");
      expect(classifyGrowthStage(6, "meat")).toBe("chick");
      expect(classifyGrowthStage(0, "dual")).toBe("chick");
    });

    it("classifies meat birds correctly", () => {
      expect(classifyGrowthStage(10, "meat")).toBe("starter");
      expect(classifyGrowthStage(21, "meat")).toBe("grower");
      expect(classifyGrowthStage(35, "meat")).toBe("finisher");
    });

    it("classifies layer birds through growth stages", () => {
      expect(classifyGrowthStage(21, "eggs", "هاي لاين")).toBe("starter");
      expect(classifyGrowthStage(70, "eggs", "هاي لاين")).toBe("grower");
      expect(classifyGrowthStage(119, "eggs", "هاي لاين")).toBe("pre-layer");
    });

    it("classifies peak and post-peak for layers", () => {
      expect(classifyGrowthStage(182, "eggs", "هاي لاين")).toBe("peak");
      expect(classifyGrowthStage(300, "eggs", "هاي لاين")).toBe("post-peak");
    });
  });

  // ── getExpectedDailyFeedGrams ─────────────────────────────────────────────
  describe("getExpectedDailyFeedGrams", () => {
    it("returns correct feed for week 1 Hy-Line chick", () => {
      const feed = getExpectedDailyFeedGrams("هاي لاين", 7);
      expect(feed).toBe(10);
    });

    it("returns highest feed for mature Hy-Line", () => {
      const feed = getExpectedDailyFeedGrams("هاي لاين", 52 * 7);
      expect(feed).toBe(111);
    });

    it("interpolates feed for intermediate age", () => {
      const feed = getExpectedDailyFeedGrams("هاي لاين", 14);
      expect(feed).toBeGreaterThan(10);
      expect(feed).toBeLessThanOrEqual(18);
    });

    it("returns default feed for breed with no week data", () => {
      const p = BREED_PROFILES["_default"];
      const feed = getExpectedDailyFeedGrams("unknown", 100);
      expect(feed).toBe(p.dailyFeedIntakeGrams.default);
    });
  });

  // ── getExpectedFCR ────────────────────────────────────────────────────────
  describe("getExpectedFCR", () => {
    it("returns stage-specific FCR when available", () => {
      expect(getExpectedFCR("روس 308", "starter")).toBe(1.35);
      expect(getExpectedFCR("روس 308", "grower")).toBe(1.65);
      expect(getExpectedFCR("روس 308", "finisher")).toBe(1.82);
    });

    it("falls back to overall FCR for null stages", () => {
      expect(getExpectedFCR("روس 308", "chick")).toBe(1.75);
    });

    it("returns overall for unknown breed", () => {
      expect(getExpectedFCR("unknown", "grower")).toBe(2.8);
    });
  });

  // ── getExpectedProductionPct ──────────────────────────────────────────────
  describe("getExpectedProductionPct", () => {
    it("returns 0 before production starts", () => {
      expect(getExpectedProductionPct("هاي لاين", 7 * 10)).toBe(0);
    });

    it("returns peak production at peak week", () => {
      expect(getExpectedProductionPct("هاي لاين", 26 * 7)).toBe(96);
    });

    it("returns 0 for meat breeds with no production curve", () => {
      expect(getExpectedProductionPct("روس 308", 200)).toBe(0);
    });

    it("interpolates production between defined weeks", () => {
      const pct = getExpectedProductionPct("هاي لاين", 19 * 7);
      expect(pct).toBeGreaterThan(40);
      expect(pct).toBeLessThan(72);
    });
  });

  // ── rateFCR ───────────────────────────────────────────────────────────────
  describe("rateFCR", () => {
    it("rates excellent when actual is 10%+ below expected", () => {
      const result = rateFCR(1.5, 2.0);
      expect(result.efficiency).toBe("excellent");
      expect(result.deviation).toBeLessThan(-10);
    });

    it("rates good when within 5% above expected", () => {
      const result = rateFCR(2.0, 2.0);
      expect(result.efficiency).toBe("good");
    });

    it("rates acceptable when 5-20% above", () => {
      const result = rateFCR(2.3, 2.0);
      expect(result.efficiency).toBe("acceptable");
    });

    it("rates poor when 20-40% above", () => {
      const result = rateFCR(2.7, 2.0);
      expect(result.efficiency).toBe("poor");
    });

    it("rates critical when 40%+ above", () => {
      const result = rateFCR(3.0, 2.0);
      expect(result.efficiency).toBe("critical");
    });

    it("deviation is percentage from expected", () => {
      const result = rateFCR(2.0, 2.0);
      expect(result.deviation).toBe(0);
    });
  });

  // ── rateProductionEfficiency ──────────────────────────────────────────────
  describe("rateProductionEfficiency", () => {
    it("rates excellent when actual exceeds expected by 5+", () => {
      const result = rateProductionEfficiency(100, 90);
      expect(result.rating).toBe("excellent");
      expect(result.gap).toBeLessThan(0);
    });

    it("rates good when gap is within 5", () => {
      const result = rateProductionEfficiency(88, 90);
      expect(result.rating).toBe("good");
    });

    it("rates acceptable when gap is 5-15", () => {
      const result = rateProductionEfficiency(78, 90);
      expect(result.rating).toBe("acceptable");
    });

    it("rates low when gap is 15-30", () => {
      const result = rateProductionEfficiency(65, 90);
      expect(result.rating).toBe("low");
    });

    it("rates critical when gap exceeds 30", () => {
      const result = rateProductionEfficiency(50, 90);
      expect(result.rating).toBe("critical");
    });
  });

  // ── AVAILABLE_BREEDS ──────────────────────────────────────────────────────
  describe("AVAILABLE_BREEDS", () => {
    it("does not include _default", () => {
      expect(AVAILABLE_BREEDS).not.toContain("_default");
    });

    it("includes at least 5 breeds", () => {
      expect(AVAILABLE_BREEDS.length).toBeGreaterThanOrEqual(5);
    });
  });
});
