/**
 * BREED BENCHMARKS — Global Poultry Standards Knowledge Base
 * ─────────────────────────────────────────────────────────────────────────────
 * Enterprise-grade reference data for:
 *   - FCR (Feed Conversion Ratio) by breed + stage
 *   - Layer production curves (% hen-day production by age week)
 *   - Daily feed intake by age + purpose
 *   - Growth weight targets by breed + age
 *   - Global industry benchmarks (Ross, Cobb, Hy-Line, Lohmann, Arabic local)
 *
 * Sources:
 *   - Ross 308 Broiler Nutrition Specifications 2022
 *   - Hy-Line W-36 Performance Standards 2023
 *   - Lohmann Brown Classic Management Guide 2022
 *   - FAO Poultry Production Manual 2020
 *   - Arabic Local Breed (Baladi) performance data — regional averages
 *
 * All FCR values: kg feed consumed / kg live weight gained (broilers)
 *                 OR kg feed consumed / 12 eggs (layers = standard dozen FCR)
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type GrowthStage = "chick" | "starter" | "grower" | "layer" | "finisher" | "pre-layer" | "peak" | "post-peak";
export type FlockPurpose = "eggs" | "meat" | "dual" | "breeding";

export interface BreedProfile {
  id: string;
  nameAr: string;
  nameSv: string;
  nameEn: string;
  purpose: FlockPurpose;
  country: string;
  fcr: {
    overall: number;
    byStage: Record<GrowthStage, number | null>;
  };
  dailyFeedIntakeGrams: {
    // by age in weeks → grams/bird/day
    byWeek: Record<number, number>;
    default: number;
  };
  production?: {
    // Layers: % hen-day production by week of age
    startWeek: number;         // week production begins
    peakWeek: number;          // week of peak production
    peakPct: number;           // peak production %
    crv: Record<number, number>; // week → expected production %
  };
  weight?: {
    // broilers: target weight (kg) by age in days
    byDay: Record<number, number>;
  };
  mortalityRate: number;       // expected % per cycle
  maturityAgeDays: number;     // days to sexual maturity / market weight
}

// ─────────────────────────────────────────────────────────────────────────────
// BREED DATABASE
// ─────────────────────────────────────────────────────────────────────────────

export const BREED_PROFILES: Record<string, BreedProfile> = {

  // ── Arabic Local (Baladi) ──────────────────────────────────────────────────
  "بلدي": {
    id: "baladi",
    nameAr: "بلدي",
    nameSv: "Arabisk lokal (Baladi)",
    nameEn: "Arabic Local (Baladi)",
    purpose: "dual",
    country: "AR",
    fcr: {
      overall: 3.5,
      byStage: {
        chick: null,
        starter: 2.1,
        grower: 3.2,
        layer: 4.1,
        finisher: 3.8,
        "pre-layer": 3.0,
        peak: 4.5,
        "post-peak": 5.0,
      },
    },
    dailyFeedIntakeGrams: {
      byWeek: {
        1: 12, 2: 22, 3: 32, 4: 44, 5: 55, 6: 66,
        7: 77, 8: 88, 9: 90, 10: 92, 11: 95, 12: 98,
        13: 100, 14: 102, 15: 104, 16: 106, 17: 108, 18: 110,
        19: 112, 20: 114, 21: 116, 22: 118, 23: 120, 24: 122,
        30: 125, 40: 130, 52: 135,
      },
      default: 110,
    },
    production: {
      startWeek: 22,
      peakWeek: 30,
      peakPct: 65,
      crv: {
        22: 20, 24: 35, 26: 50, 28: 60, 30: 65, 32: 63,
        34: 60, 36: 57, 40: 52, 44: 48, 48: 44, 52: 40,
        56: 36, 60: 32, 64: 28, 68: 25,
      },
    },
    mortalityRate: 5,
    maturityAgeDays: 154,   // ~22 weeks
  },

  // ── Hy-Line W-36 / Brown ──────────────────────────────────────────────────
  "هاي لاين": {
    id: "hyline",
    nameAr: "هاي لاين",
    nameSv: "Hy-Line",
    nameEn: "Hy-Line W-36 / Brown",
    purpose: "eggs",
    country: "US",
    fcr: {
      overall: 2.1,
      byStage: {
        chick: null,
        starter: 1.6,
        grower: 1.8,
        "pre-layer": 2.0,
        layer: 2.1,
        peak: 2.0,
        "post-peak": 2.3,
        finisher: null,
      },
    },
    dailyFeedIntakeGrams: {
      byWeek: {
        1: 10, 2: 18, 3: 27, 4: 36, 5: 44, 6: 52,
        7: 57, 8: 63, 9: 68, 10: 72, 11: 76, 12: 80,
        13: 83, 14: 86, 15: 89, 16: 91, 17: 93, 18: 96,
        19: 99, 20: 102, 22: 108, 24: 112, 28: 115, 32: 115,
        36: 114, 40: 113, 44: 112, 52: 111,
      },
      default: 112,
    },
    production: {
      startWeek: 18,
      peakWeek: 26,
      peakPct: 96,
      crv: {
        18: 40, 20: 72, 22: 88, 24: 94, 26: 96, 28: 96,
        30: 95, 32: 94, 34: 93, 36: 91, 40: 88, 44: 85,
        48: 82, 52: 79, 56: 76, 60: 73, 64: 70, 68: 67,
        72: 64,
      },
    },
    mortalityRate: 2,
    maturityAgeDays: 126,
  },

  // ── Lohmann Brown ──────────────────────────────────────────────────────────
  "لوهمان": {
    id: "lohmann",
    nameAr: "لوهمان",
    nameSv: "Lohmann Brown",
    nameEn: "Lohmann Brown Classic",
    purpose: "eggs",
    country: "DE",
    fcr: {
      overall: 2.05,
      byStage: {
        chick: null,
        starter: 1.55,
        grower: 1.75,
        "pre-layer": 1.95,
        layer: 2.05,
        peak: 2.0,
        "post-peak": 2.2,
        finisher: null,
      },
    },
    dailyFeedIntakeGrams: {
      byWeek: {
        1: 11, 2: 20, 3: 30, 4: 40, 5: 48, 6: 56,
        8: 67, 10: 74, 12: 80, 14: 86, 16: 90, 18: 95,
        20: 106, 22: 110, 24: 114, 28: 117, 32: 117, 40: 116,
        52: 114,
      },
      default: 115,
    },
    production: {
      startWeek: 19,
      peakWeek: 27,
      peakPct: 94,
      crv: {
        19: 35, 21: 70, 23: 86, 25: 92, 27: 94, 29: 93,
        31: 92, 33: 91, 35: 89, 39: 86, 43: 83, 47: 80,
        51: 77, 55: 74, 59: 71, 63: 68, 67: 65, 71: 62,
      },
    },
    mortalityRate: 2.5,
    maturityAgeDays: 133,
  },

  // ── Ross 308 (Broiler) ─────────────────────────────────────────────────────
  "روس 308": {
    id: "ross308",
    nameAr: "روس 308",
    nameSv: "Ross 308 (broiler)",
    nameEn: "Ross 308 Broiler",
    purpose: "meat",
    country: "UK",
    fcr: {
      overall: 1.75,
      byStage: {
        chick: null,
        starter: 1.35,
        grower: 1.65,
        finisher: 1.82,
        layer: null,
        "pre-layer": null,
        peak: null,
        "post-peak": null,
      },
    },
    dailyFeedIntakeGrams: {
      byWeek: {
        1: 15, 2: 35, 3: 65, 4: 105, 5: 145, 6: 175, 7: 190,
      },
      default: 160,
    },
    weight: {
      byDay: {
        7: 0.16, 14: 0.42, 21: 0.82, 28: 1.35, 35: 1.95, 42: 2.60, 49: 3.20,
      },
    },
    mortalityRate: 3,
    maturityAgeDays: 42,   // market weight at 6 weeks
  },

  // ── Cobb 500 (Broiler) ────────────────────────────────────────────────────
  "كوب 500": {
    id: "cobb500",
    nameAr: "كوب 500",
    nameSv: "Cobb 500 (broiler)",
    nameEn: "Cobb 500 Broiler",
    purpose: "meat",
    country: "US",
    fcr: {
      overall: 1.72,
      byStage: {
        chick: null,
        starter: 1.32,
        grower: 1.62,
        finisher: 1.79,
        layer: null,
        "pre-layer": null,
        peak: null,
        "post-peak": null,
      },
    },
    dailyFeedIntakeGrams: {
      byWeek: {
        1: 16, 2: 38, 3: 68, 4: 108, 5: 148, 6: 178, 7: 192,
      },
      default: 162,
    },
    weight: {
      byDay: {
        7: 0.17, 14: 0.44, 21: 0.85, 28: 1.38, 35: 2.0, 42: 2.65, 49: 3.25,
      },
    },
    mortalityRate: 3.5,
    maturityAgeDays: 42,
  },

  // ── Default fallback (unknown breed) ─────────────────────────────────────
  "_default": {
    id: "default",
    nameAr: "سلالة غير محددة",
    nameSv: "Okänd ras",
    nameEn: "Unknown Breed",
    purpose: "dual",
    country: "XX",
    fcr: {
      overall: 3.0,
      byStage: {
        chick: null,
        starter: 2.0,
        grower: 2.8,
        layer: 3.5,
        finisher: 3.2,
        "pre-layer": 2.8,
        peak: 4.0,
        "post-peak": 4.5,
      },
    },
    dailyFeedIntakeGrams: {
      byWeek: {},
      default: 115,
    },
    production: {
      startWeek: 20,
      peakWeek: 28,
      peakPct: 75,
      crv: {
        20: 30, 24: 60, 28: 75, 32: 72, 36: 68, 40: 63,
        44: 58, 48: 53, 52: 48, 60: 40,
      },
    },
    mortalityRate: 4,
    maturityAgeDays: 140,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// GROWTH STAGE CLASSIFIER
// ─────────────────────────────────────────────────────────────────────────────

export function classifyGrowthStage(ageDays: number, purpose: FlockPurpose, breed?: string): GrowthStage {
  const profile = getBreedProfile(breed ?? "");
  const maturity = profile.maturityAgeDays;

  if (ageDays < 7) return "chick";

  if (purpose === "meat") {
    if (ageDays < 14) return "starter";
    if (ageDays < 28) return "grower";
    return "finisher";
  }

  // Layer / dual
  const ageWeeks = ageDays / 7;
  if (ageWeeks < 6) return "starter";
  if (ageWeeks < (maturity / 7) - 3) return "grower";
  if (ageWeeks < maturity / 7) return "pre-layer";

  const prodProfile = profile.production;
  if (!prodProfile) return "layer";

  if (ageWeeks < prodProfile.peakWeek + 4) return "peak";
  if (ageWeeks < 72) return "post-peak";
  return "post-peak";
}

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUP HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Fuzzy match breed name to profile */
export function getBreedProfile(breedName: string): BreedProfile {
  if (!breedName) return BREED_PROFILES["_default"];
  const lower = breedName.toLowerCase().trim();

  // Exact match
  if (BREED_PROFILES[breedName]) return BREED_PROFILES[breedName];

  // Partial / alias match
  if (lower.includes("بلدي") || lower.includes("baladi") || lower.includes("arabic")) return BREED_PROFILES["بلدي"];
  if (lower.includes("هاي") || lower.includes("hy") || lower.includes("hyline") || lower.includes("هايلاين")) return BREED_PROFILES["هاي لاين"];
  if (lower.includes("لوهمان") || lower.includes("lohmann")) return BREED_PROFILES["لوهمان"];
  if (lower.includes("روس") || lower.includes("ross")) return BREED_PROFILES["روس 308"];
  if (lower.includes("كوب") || lower.includes("cobb")) return BREED_PROFILES["كوب 500"];

  return BREED_PROFILES["_default"];
}

/** Expected daily feed per bird in grams for given age */
export function getExpectedDailyFeedGrams(breed: string, ageDays: number): number {
  const profile = getBreedProfile(breed);
  const ageWeeks = Math.round(ageDays / 7);
  const byWeek = profile.dailyFeedIntakeGrams.byWeek;

  // Find closest week entry
  const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b);
  if (weeks.length === 0) return profile.dailyFeedIntakeGrams.default;

  if (ageWeeks <= weeks[0]) return byWeek[weeks[0]];
  if (ageWeeks >= weeks[weeks.length - 1]) return byWeek[weeks[weeks.length - 1]];

  // Linear interpolation between two nearest weeks
  let lo = weeks[0], hi = weeks[1];
  for (let i = 0; i < weeks.length - 1; i++) {
    if (weeks[i] <= ageWeeks && weeks[i + 1] >= ageWeeks) {
      lo = weeks[i];
      hi = weeks[i + 1];
      break;
    }
  }
  const t = (ageWeeks - lo) / (hi - lo);
  return byWeek[lo] + t * (byWeek[hi] - byWeek[lo]);
}

/** Expected FCR for given breed + growth stage */
export function getExpectedFCR(breed: string, stage: GrowthStage): number {
  const profile = getBreedProfile(breed);
  return profile.fcr.byStage[stage] ?? profile.fcr.overall;
}

/** Expected production % (hen-day) for given breed + age in days */
export function getExpectedProductionPct(breed: string, ageDays: number): number {
  const profile = getBreedProfile(breed);
  if (!profile.production) return 0;

  const ageWeeks = ageDays / 7;
  if (ageWeeks < profile.production.startWeek) return 0;

  const crv = profile.production.crv;
  const weeks = Object.keys(crv).map(Number).sort((a, b) => a - b);
  if (weeks.length === 0) return 0;

  if (ageWeeks <= weeks[0]) return crv[weeks[0]];
  if (ageWeeks >= weeks[weeks.length - 1]) return crv[weeks[weeks.length - 1]];

  let lo = weeks[0], hi = weeks[1];
  for (let i = 0; i < weeks.length - 1; i++) {
    if (weeks[i] <= ageWeeks && weeks[i + 1] >= ageWeeks) {
      lo = weeks[i];
      hi = weeks[i + 1];
      break;
    }
  }
  const t = (ageWeeks - lo) / (hi - lo);
  return crv[lo] + t * (crv[hi] - crv[lo]);
}

/** FCR rating vs benchmark */
export function rateFCR(actualFCR: number, expectedFCR: number): {
  efficiency: "excellent" | "good" | "acceptable" | "poor" | "critical";
  deviation: number;  // % deviation from expected
  label: string;
} {
  const deviation = ((actualFCR - expectedFCR) / expectedFCR) * 100;

  if (deviation <= -10) return { efficiency: "excellent", deviation, label: "كفاءة استثنائية — أفضل من المعيار" };
  if (deviation <= 5)   return { efficiency: "good",      deviation, label: "ضمن النطاق الجيد" };
  if (deviation <= 20)  return { efficiency: "acceptable", deviation, label: "مقبول — يمكن تحسينه" };
  if (deviation <= 40)  return { efficiency: "poor",      deviation, label: "ضعيف — يحتاج مراجعة" };
  return { efficiency: "critical", deviation, label: "حرج — هدر واضح في العلف" };
}

/** Production efficiency rating vs breed standard */
export function rateProductionEfficiency(actualPct: number, expectedPct: number): {
  rating: "excellent" | "good" | "acceptable" | "low" | "critical";
  gap: number;   // percentage points below expected
} {
  const gap = expectedPct - actualPct;
  if (gap <= -5)  return { rating: "excellent", gap };
  if (gap <= 5)   return { rating: "good",      gap };
  if (gap <= 15)  return { rating: "acceptable", gap };
  if (gap <= 30)  return { rating: "low",       gap };
  return { rating: "critical", gap };
}

/** All available breed IDs */
export const AVAILABLE_BREEDS = Object.keys(BREED_PROFILES).filter(k => k !== "_default");

/** Global industry benchmarks summary */
export const GLOBAL_BENCHMARKS = {
  layers: {
    fcr: { excellent: 2.0, good: 2.2, acceptable: 2.5, poor: 3.0 },
    peakProduction: { excellent: 90, good: 80, acceptable: 70, poor: 60 },
    mortalityRate: { excellent: 2, good: 3, acceptable: 5, poor: 8 },
  },
  broilers: {
    fcr: { excellent: 1.65, good: 1.75, acceptable: 1.85, poor: 2.0 },
    marketWeightDays: { excellent: 35, good: 42, acceptable: 49, poor: 56 },
    mortalityRate: { excellent: 2, good: 3.5, acceptable: 5, poor: 8 },
  },
  general: {
    feedCostPct: 60,     // feed typically 60-70% of total production cost
    profitMarginMin: 12, // minimum healthy profit margin %
    documentationDays: 90, // % days with logs (target)
  },
};
