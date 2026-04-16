/**
 * FEED COST INTELLIGENCE ENGINE v1.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Enterprise-grade feed cost analysis with multi-factor intelligence.
 *
 * Capabilities:
 *   1. Per-bird cost calculation (actual vs expected by breed + age)
 *   2. FCR computation with global benchmark comparison
 *   3. Feed efficiency scoring (0–100)
 *   4. Production efficiency vs breed curve
 *   5. Cost-per-egg and cost-per-kg computation
 *   6. Waste detection (over-feeding vs under-feeding signals)
 *   7. Trend analysis (7d / 30d cost trajectory)
 *   8. Multi-flock cost allocation (proportional by bird count + age weight)
 *   9. Decision-grade insights (observation + why + action + evidence)
 *
 * Data sources (no external APIs required):
 *   - transactions (category="feed") → total feed spend
 *   - flocks → bird count, age, breed, purpose
 *   - flock_production_logs → egg output
 *   - feed_records → precise per-purchase data (optional)
 *   - breed-benchmarks → global FCR and production curves
 */

import {
  getBreedProfile,
  getExpectedDailyFeedGrams,
  getExpectedFCR,
  getExpectedProductionPct,
  classifyGrowthStage,
  rateFCR,
  rateProductionEfficiency,
  GLOBAL_BENCHMARKS,
  type GrowthStage,
} from "./breed-benchmarks.js";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface FlockInput {
  id: number;
  name: string;
  breed: string;
  count: number;
  ageDays: number;
  purpose: "eggs" | "meat" | "dual" | "breeding";
  healthStatus: string;
}

export interface TransactionInput {
  id: number;
  date: string;
  type: string;
  category: string;
  domain?: string;
  amount: number;
  quantity?: number | null;
  unit?: string | null;
  description: string;
}

export interface ProductionLogInput {
  flockId: number;
  date: string;
  eggCount: number;
}

export interface FeedRecordInput {
  id: number;
  date: string;
  feedType: string;
  quantityKg: number;
  pricePerKg: number;
  totalCost: number;
  allocations: Array<{ flockId: number; quantityKg: number }>;
}

export interface FlockFeedAnalysis {
  flockId: number;
  flockName: string;
  breed: string;
  count: number;
  ageDays: number;
  ageWeeks: number;
  growthStage: GrowthStage;
  purpose: string;

  // Feed consumption (from feed records or estimated from transactions)
  feedData: {
    totalCostAllocated: number;      // SAR/currency allocated to this flock
    totalKgAllocated: number | null; // kg if known
    costPerBird: number;             // total cost / count
    dailyCostPerBird: number;        // cost per bird per day (over analysis period)
    dailyFeedKgPerBird: number | null; // kg/bird/day if known
  };

  // Benchmark comparison
  benchmark: {
    expectedDailyFeedGrams: number;
    expectedFCR: number;
    actualFCR: number | null;         // computable if kg data available
    fcrRating: ReturnType<typeof rateFCR> | null;
    expectedProductionPct: number;
    actualProductionPct: number;
    productionRating: ReturnType<typeof rateProductionEfficiency>;
  };

  // Cost per output
  costPerEgg: number | null;
  costPerDozen: number | null;

  // Efficiency score 0-100
  efficiencyScore: number;

  // Insights for this flock
  insights: FeedInsight[];
}

export interface FeedInsight {
  severity: "critical" | "high" | "medium" | "low" | "positive";
  observation: string;
  why: string;
  action: string;
  evidence: string;
  expectedOutcome: string;
}

export interface FarmFeedSummary {
  analysisDate: string;
  periodDays: number;

  // Farm totals
  totalFeedSpend: number;
  totalFeedKg: number | null;        // if precise records exist
  totalBirds: number;
  farmCostPerBird: number;

  // Efficiency
  farmEfficiencyScore: number;       // 0-100 weighted average
  feedCostPctOfExpenses: number;     // feed / total expenses * 100

  // Production correlation
  totalEggsProduced: number;
  farmCostPerEgg: number | null;
  farmCostPerDozen: number | null;

  // vs global benchmarks
  benchmarkComparison: {
    feedCostPct: { actual: number; benchmark: number; status: "good" | "warning" | "critical" };
    avgFCR: { actual: number | null; benchmark: number | null; status: string };
  };

  // Trend analysis
  trend: {
    direction: "increasing" | "decreasing" | "stable";
    pctChange: number;   // % change in feed cost this week vs last week
    alert: boolean;
  };

  // Per-flock breakdowns
  flockAnalyses: FlockFeedAnalysis[];

  // Top-level insights
  topInsights: FeedInsight[];

  // Data quality
  dataQuality: {
    hasPreciseFeedRecords: boolean;
    hasProductionData: boolean;
    completenessScore: number;   // 0-100
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function roundN(v: number, n = 2) { return Math.round(v * Math.pow(10, n)) / Math.pow(10, n); }

/** Allocate total feed cost/kg across flocks proportionally by (count × ageWeight) */
function allocateFeedProportion(flocks: FlockInput[]): Record<number, number> {
  // Age weight: younger chicks eat less; older layers eat more
  const weights: Record<number, number> = {};
  let totalWeight = 0;
  for (const f of flocks) {
    const expectedGrams = getExpectedDailyFeedGrams(f.breed, f.ageDays);
    const w = f.count * expectedGrams;
    weights[f.id] = w;
    totalWeight += w;
  }
  const proportions: Record<number, number> = {};
  for (const f of flocks) {
    proportions[f.id] = totalWeight > 0 ? weights[f.id] / totalWeight : 1 / flocks.length;
  }
  return proportions;
}

/** Parse date string to Date object */
function parseDate(d: string) { return new Date(d); }

/** Days between two dates */
function daysBetween(a: Date, b: Date) {
  return Math.abs((b.getTime() - a.getTime()) / 86_400_000);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export function runFeedCostEngine(input: {
  flocks: FlockInput[];
  transactions: TransactionInput[];
  productionLogs: ProductionLogInput[];
  feedRecords: FeedRecordInput[];
  periodDays?: number;  // default 30
  totalExpenses?: number;  // for feed-cost% calculation
}): FarmFeedSummary {

  const { flocks, transactions, productionLogs, feedRecords } = input;
  const periodDays = input.periodDays ?? 30;

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(now.getDate() - periodDays);

  const windowStartStr = windowStart.toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  // ── Step 1: Collect feed spend from transactions ──────────────────────────
  const feedTx = transactions.filter(
    t => t.type === "expense" &&
      (t.category === "feed" || t.domain === "feed") &&
      t.date >= windowStartStr && t.date <= todayStr
  );

  const totalFeedSpend = feedTx.reduce((s, t) => s + Number(t.amount), 0);

  // Total feed kg from transactions (quantity field)
  const totalFeedKgFromTx = feedTx.reduce((s, t) => {
    if (t.quantity && (t.unit === "kg" || t.unit === "كجم" || !t.unit)) {
      return s + Number(t.quantity);
    }
    return s;
  }, 0);

  // ── Step 2: Collect precise feed records (if available) ───────────────────
  const preciseRecords = feedRecords.filter(
    r => r.date >= windowStartStr && r.date <= todayStr
  );
  const hasPreciseFeedRecords = preciseRecords.length > 0;

  // Precise kg from feed records
  const totalFeedKgFromRecords = preciseRecords.reduce((s, r) => s + r.quantityKg, 0);
  const totalFeedKg = hasPreciseFeedRecords
    ? totalFeedKgFromRecords
    : (totalFeedKgFromTx > 0 ? totalFeedKgFromTx : null);

  // ── Step 3: Production data ───────────────────────────────────────────────
  const prodWindow = productionLogs.filter(
    p => p.date >= windowStartStr && p.date <= todayStr
  );
  const totalEggsProduced = prodWindow.reduce((s, p) => s + p.eggCount, 0);
  const hasProductionData = totalEggsProduced > 0;

  // Eggs by flock
  const eggsByFlock: Record<number, number> = {};
  for (const p of prodWindow) {
    eggsByFlock[p.flockId] = (eggsByFlock[p.flockId] ?? 0) + p.eggCount;
  }

  // ── Step 4: Allocate feed per flock ──────────────────────────────────────
  const activeFlocksForCalc = flocks.filter(f => f.count > 0);

  // Per-flock cost from precise records
  const flockCostFromRecords: Record<number, number> = {};
  const flockKgFromRecords: Record<number, number> = {};

  if (hasPreciseFeedRecords) {
    for (const rec of preciseRecords) {
      const totalRecKg = rec.quantityKg;
      const recCost = rec.totalCost;

      if (rec.allocations.length > 0) {
        // Explicit allocation
        for (const alloc of rec.allocations) {
          const allocCost = (alloc.quantityKg / totalRecKg) * recCost;
          flockCostFromRecords[alloc.flockId] = (flockCostFromRecords[alloc.flockId] ?? 0) + allocCost;
          flockKgFromRecords[alloc.flockId] = (flockKgFromRecords[alloc.flockId] ?? 0) + alloc.quantityKg;
        }
      } else {
        // No explicit allocation → distribute proportionally
        const props = allocateFeedProportion(activeFlocksForCalc);
        for (const f of activeFlocksForCalc) {
          flockCostFromRecords[f.id] = (flockCostFromRecords[f.id] ?? 0) + recCost * props[f.id];
          flockKgFromRecords[f.id] = (flockKgFromRecords[f.id] ?? 0) + totalRecKg * props[f.id];
        }
      }
    }
  }

  // Proportional allocation from transaction data (fallback)
  const proportions = allocateFeedProportion(activeFlocksForCalc);
  const flockCostFromTx: Record<number, number> = {};
  for (const f of activeFlocksForCalc) {
    flockCostFromTx[f.id] = totalFeedSpend * (proportions[f.id] ?? 0);
  }

  // ── Step 5: Per-flock analysis ────────────────────────────────────────────
  const totalBirds = activeFlocksForCalc.reduce((s, f) => s + f.count, 0);

  const flockAnalyses: FlockFeedAnalysis[] = activeFlocksForCalc.map(flock => {
    const cost = hasPreciseFeedRecords
      ? (flockCostFromRecords[flock.id] ?? flockCostFromTx[flock.id] ?? 0)
      : (flockCostFromTx[flock.id] ?? 0);

    const kgAllocated = hasPreciseFeedRecords
      ? (flockKgFromRecords[flock.id] ?? null)
      : (totalFeedKg != null ? totalFeedKg * (proportions[flock.id] ?? 0) : null);

    const costPerBird = flock.count > 0 ? cost / flock.count : 0;
    const dailyCostPerBird = periodDays > 0 ? costPerBird / periodDays : 0;
    const dailyFeedKgPerBird = kgAllocated != null && flock.count > 0 && periodDays > 0
      ? kgAllocated / (flock.count * periodDays)
      : null;

    const growthStage = classifyGrowthStage(flock.ageDays, flock.purpose as any, flock.breed);
    const expectedDailyFeedGrams = getExpectedDailyFeedGrams(flock.breed, flock.ageDays);
    const expectedFCR = getExpectedFCR(flock.breed, growthStage);

    // Actual FCR (kg feed / kg gain — for broilers only if we have kg data)
    // For layers: simplified FCR = kg feed / (eggs * avg egg weight 0.06kg)
    let actualFCR: number | null = null;
    if (kgAllocated != null) {
      const eggs = eggsByFlock[flock.id] ?? 0;
      if (flock.purpose === "eggs" || flock.purpose === "dual") {
        if (eggs > 0) {
          const outputKg = eggs * 0.06; // ~60g per egg
          actualFCR = roundN(kgAllocated / outputKg, 2);
        }
      } else {
        // broiler: can't compute without slaughter weights
        actualFCR = null;
      }
    }

    const fcrRating = actualFCR != null ? rateFCR(actualFCR, expectedFCR) : null;

    // Production efficiency
    const expectedProdPct = getExpectedProductionPct(flock.breed, flock.ageDays);
    const eggs = eggsByFlock[flock.id] ?? 0;
    const prodDays = Math.min(periodDays, 7); // approximate active laying days in window
    const layingBirds = flock.count * 0.95; // assume 5% not laying (mortality buffer)
    const actualProdPct = (expectedProdPct > 0 && prodDays > 0)
      ? (eggs / (layingBirds * prodDays)) * 100
      : 0;

    const productionRating = rateProductionEfficiency(actualProdPct, expectedProdPct);

    // Cost per egg / dozen
    const costPerEgg = eggs > 0 ? roundN(cost / eggs, 2) : null;
    const costPerDozen = costPerEgg != null ? roundN(costPerEgg * 12, 2) : null;

    // Efficiency score 0-100
    let score = 70; // base
    if (fcrRating) {
      const fcrScore = { excellent: 30, good: 20, acceptable: 5, poor: -15, critical: -30 }[fcrRating.efficiency] ?? 0;
      score += fcrScore;
    }
    const prodScore = { excellent: 20, good: 10, acceptable: 0, low: -10, critical: -20 }[productionRating.rating] ?? 0;
    score += prodScore;

    // Health penalty
    if (flock.healthStatus === "sick") score -= 15;
    if (flock.healthStatus === "quarantine") score -= 25;
    if (flock.healthStatus === "recovering") score -= 8;

    // Data quality bonus
    if (kgAllocated != null) score += 5;
    if (eggs > 0) score += 5;

    score = clamp(score, 0, 100);

    // Per-flock insights
    const insights: FeedInsight[] = [];

    if (dailyFeedKgPerBird != null) {
      const expectedKgPerBird = expectedDailyFeedGrams / 1000;
      const overFeedPct = ((dailyFeedKgPerBird - expectedKgPerBird) / expectedKgPerBird) * 100;

      if (overFeedPct > 20) {
        insights.push({
          severity: "high",
          observation: `إفراط في التغذية — ${roundN(dailyFeedKgPerBird * 1000, 0)} جم/طائر/يوم مقابل ${roundN(expectedDailyFeedGrams, 0)} جم متوقع`,
          why: `هدر ${roundN(overFeedPct, 1)}% فوق المعيار — قد يكون بسبب إهدار في المعالف أو حساب خاطئ للكميات`,
          action: "اضبط كميات التغذية وتحقق من تصميم المعالف لتقليل الهدر",
          evidence: `فعلي: ${roundN(dailyFeedKgPerBird * 1000, 0)}g | معيار: ${roundN(expectedDailyFeedGrams, 0)}g | زيادة: +${roundN(overFeedPct, 1)}%`,
          expectedOutcome: `تخفيض الهدر بـ 15% يوفر ${roundN(cost * 0.15, 0)} في هذه الدورة`,
        });
      } else if (overFeedPct < -15) {
        insights.push({
          severity: "high",
          observation: `نقص في التغذية — ${roundN(dailyFeedKgPerBird * 1000, 0)} جم/طائر/يوم مقابل ${roundN(expectedDailyFeedGrams, 0)} جم متوقع`,
          why: `الطائر يأخذ ${roundN(Math.abs(overFeedPct), 1)}% أقل من حاجته — قد يؤثر على الإنتاج والنمو`,
          action: "زد كمية العلف تدريجياً إلى المستوى الموصى به للسلالة والعمر",
          evidence: `فعلي: ${roundN(dailyFeedKgPerBird * 1000, 0)}g | معيار: ${roundN(expectedDailyFeedGrams, 0)}g | نقص: ${roundN(overFeedPct, 1)}%`,
          expectedOutcome: "رفع التغذية للمستوى الصحيح يحسن الإنتاج خلال 7-10 أيام",
        });
      }
    }

    if (fcrRating?.efficiency === "poor" || fcrRating?.efficiency === "critical") {
      insights.push({
        severity: fcrRating.efficiency === "critical" ? "critical" : "high",
        observation: `نسبة تحويل العلف (FCR) = ${actualFCR} — المعيار للسلالة: ${expectedFCR}`,
        why: `FCR مرتفع يعني ${flock.breed} تستهلك علفاً أكثر مما تنتج — ${fcrRating.label}`,
        action: "راجع جودة العلف وبرنامج التغذية — قد تحتاج صيغة علف أفضل لهذه المرحلة",
        evidence: `FCR فعلي: ${actualFCR} | FCR معيار: ${expectedFCR} | انحراف: +${roundN(fcrRating.deviation, 1)}%`,
        expectedOutcome: `تحسين FCR بـ 0.3 يقلل تكلفة العلف بنسبة ~15%`,
      });
    } else if (fcrRating?.efficiency === "excellent") {
      insights.push({
        severity: "positive",
        observation: `كفاءة علف استثنائية — FCR = ${actualFCR} (أفضل من معيار ${expectedFCR})`,
        why: "القطيع يحول العلف لإنتاج بكفاءة عالية جداً — أداء فوق المتوسط",
        action: "وثّق برنامج التغذية الحالي كمرجع للقطعان الأخرى",
        evidence: `FCR فعلي: ${actualFCR} | FCR معيار: ${expectedFCR} | تحسن: ${roundN(Math.abs(fcrRating.deviation), 1)}%`,
        expectedOutcome: "نشر هذه الممارسات على باقي القطعان يوفر تكاليف العلف الكلية",
      });
    }

    if (productionRating.rating === "low" || productionRating.rating === "critical") {
      if (expectedProdPct > 10 && flock.ageDays > 126) {
        insights.push({
          severity: productionRating.rating === "critical" ? "critical" : "high",
          observation: `إنتاج "${flock.name}" أقل من المتوقع بـ ${roundN(productionRating.gap, 1)} نقطة مئوية`,
          why: `${flock.breed} بعمر ${Math.round(flock.ageDays / 7)} أسبوع يجب أن تنتج ~${roundN(expectedProdPct, 1)}% يومياً`,
          action: "تحقق من التغذية والإضاءة والصحة — الإنتاج المنخفض مع تكلفة علف مرتفعة = خسارة مضاعفة",
          evidence: `متوقع: ${roundN(expectedProdPct, 1)}% | فعلي: ~${roundN(actualProdPct, 1)}% | فجوة: ${roundN(productionRating.gap, 1)}%`,
          expectedOutcome: "معالجة سبب الانخفاض تسترجع الإنتاج خلال 7-14 يوم",
        });
      }
    }

    return {
      flockId: flock.id,
      flockName: flock.name,
      breed: flock.breed,
      count: flock.count,
      ageDays: flock.ageDays,
      ageWeeks: roundN(flock.ageDays / 7, 1),
      growthStage,
      purpose: flock.purpose,
      feedData: {
        totalCostAllocated: roundN(cost, 0),
        totalKgAllocated: kgAllocated != null ? roundN(kgAllocated, 1) : null,
        costPerBird: roundN(costPerBird, 1),
        dailyCostPerBird: roundN(dailyCostPerBird, 2),
        dailyFeedKgPerBird: dailyFeedKgPerBird != null ? roundN(dailyFeedKgPerBird, 4) : null,
      },
      benchmark: {
        expectedDailyFeedGrams: roundN(expectedDailyFeedGrams, 1),
        expectedFCR,
        actualFCR,
        fcrRating,
        expectedProductionPct: roundN(expectedProdPct, 1),
        actualProductionPct: roundN(actualProdPct, 1),
        productionRating,
      },
      costPerEgg,
      costPerDozen,
      efficiencyScore: score,
      insights,
    };
  });

  // ── Step 6: Farm-level aggregation ───────────────────────────────────────
  const farmEfficiencyScore = flockAnalyses.length > 0
    ? roundN(
        flockAnalyses.reduce((s, f) => s + f.efficiencyScore * f.count, 0) /
        Math.max(1, flockAnalyses.reduce((s, f) => s + f.count, 0)),
        0
      )
    : 0;

  const totalExpenses = input.totalExpenses ?? totalFeedSpend;
  const feedCostPctOfExpenses = totalExpenses > 0
    ? roundN((totalFeedSpend / totalExpenses) * 100, 1)
    : 0;

  const farmCostPerBird = totalBirds > 0 ? roundN(totalFeedSpend / totalBirds, 1) : 0;
  const farmCostPerEgg = totalEggsProduced > 0 ? roundN(totalFeedSpend / totalEggsProduced, 2) : null;
  const farmCostPerDozen = farmCostPerEgg != null ? roundN(farmCostPerEgg * 12, 2) : null;

  // Weighted average FCR
  const fcrValues = flockAnalyses.filter(f => f.benchmark.actualFCR != null);
  const avgFCR = fcrValues.length > 0
    ? roundN(
        fcrValues.reduce((s, f) => s + f.benchmark.actualFCR! * f.count, 0) /
        fcrValues.reduce((s, f) => s + f.count, 0),
        2
      )
    : null;

  // Expected FCR benchmark for farm mix
  const avgExpectedFCR = flockAnalyses.length > 0
    ? roundN(
        flockAnalyses.reduce((s, f) => s + f.benchmark.expectedFCR * f.count, 0) /
        Math.max(1, totalBirds),
        2
      )
    : null;

  // Feed cost % benchmark comparison
  const feedCostPctStatus: "good" | "warning" | "critical" =
    feedCostPctOfExpenses <= 60 ? "good" :
    feedCostPctOfExpenses <= 75 ? "warning" : "critical";

  // Trend: compare this week vs previous week
  const thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate() - 7);
  const lastWeekStart = new Date(now); lastWeekStart.setDate(now.getDate() - 14);
  const thisWeekStartStr = thisWeekStart.toISOString().split("T")[0];
  const lastWeekStartStr = lastWeekStart.toISOString().split("T")[0];

  const thisWeekFeed = feedTx.filter(t => t.date >= thisWeekStartStr).reduce((s, t) => s + Number(t.amount), 0);
  const lastWeekFeed = feedTx.filter(t => t.date >= lastWeekStartStr && t.date < thisWeekStartStr).reduce((s, t) => s + Number(t.amount), 0);
  const weekPctChange = lastWeekFeed > 0 ? roundN(((thisWeekFeed - lastWeekFeed) / lastWeekFeed) * 100, 1) : 0;
  const trendDirection: "increasing" | "decreasing" | "stable" =
    weekPctChange > 10 ? "increasing" :
    weekPctChange < -10 ? "decreasing" : "stable";

  // ── Step 7: Farm-level insights ───────────────────────────────────────────
  const topInsights: FeedInsight[] = [];

  if (totalFeedSpend === 0) {
    topInsights.push({
      severity: "medium",
      observation: "لا توجد مصاريف علف مسجلة في الفترة المحددة",
      why: "لم يتم تسجيل أي مشتريات علف في قاعدة البيانات",
      action: "سجّل مشتريات العلف في قسم المعاملات المالية مع تصنيف 'علف'",
      evidence: `${transactions.filter(t => t.category === "feed").length} معاملات علف إجمالية في النظام`,
      expectedOutcome: "تسجيل العلف يُفعّل محرك تحليل التكلفة ويُنتج توصيات دقيقة",
    });
  }

  if (feedCostPctStatus === "critical") {
    topInsights.push({
      severity: "critical",
      observation: `العلف يستهلك ${feedCostPctOfExpenses}% من إجمالي المصاريف — أعلى من الحد الصحي 75%`,
      why: "نسبة العلف الزائدة تعني عدم كفاءة التحويل أو ارتفاع أسعار العلف أو أعداد طيور غير اقتصادية",
      action: "راجع FCR لكل قطيع وابحث عن علف بديل أو مورد أفضل سعراً",
      evidence: `مصاريف العلف: ${totalFeedSpend.toLocaleString()} | الإجمالي: ${totalExpenses.toLocaleString()} | نسبة: ${feedCostPctOfExpenses}%`,
      expectedOutcome: "تخفيض نسبة العلف لـ 60-65% يحسن هامش الربح بشكل جوهري",
    });
  } else if (feedCostPctStatus === "warning") {
    topInsights.push({
      severity: "high",
      observation: `نسبة تكلفة العلف ${feedCostPctOfExpenses}% — قريبة من الحد الأقصى`,
      why: "المعيار العالمي: العلف 60-70% من التكلفة الإجمالية — أنت عند الحد الأعلى",
      action: "راجع كفاءة الاستهلاك وتحقق من الهدر في المعالف",
      evidence: `معيار عالمي: 60-70% | فعلي: ${feedCostPctOfExpenses}%`,
      expectedOutcome: "ضبط الكميات يخفض النسبة لـ 65% ويوفر على الأقل 7% من التكلفة الكلية",
    });
  }

  if (farmCostPerEgg != null && farmCostPerEgg > 5) {
    topInsights.push({
      severity: "high",
      observation: `تكلفة العلف للبيضة الواحدة: ${farmCostPerEgg} — مرتفعة`,
      why: "التكلفة المرتفعة للبيضة تعني انخفاض هامش الربح من المبيعات",
      action: "ارفع إنتاجية البيض أو اخفض تكلفة العلف عبر مورد أفضل",
      evidence: `${farmCostPerEgg} لكل بيضة | ${farmCostPerDozen} لكل كرتونة`,
      expectedOutcome: "خفض التكلفة للبيضة بـ 20% يزيد الهامش الصافي بشكل ملحوظ",
    });
  }

  if (trendDirection === "increasing" && weekPctChange > 20) {
    topInsights.push({
      severity: "high",
      observation: `مصاريف العلف ارتفعت ${weekPctChange}% هذا الأسبوع مقارنة بالأسبوع الماضي`,
      why: "ارتفاع حاد في الإنفاق على العلف قد يشير لشراء إضافي طارئ أو تغيير في النمط",
      action: "تحقق من سبب الارتفاع — هل هو شراء موسمي مخطط أم إنفاق غير متوقع؟",
      evidence: `هذا الأسبوع: ${thisWeekFeed.toLocaleString()} | الأسبوع الماضي: ${lastWeekFeed.toLocaleString()} | +${weekPctChange}%`,
      expectedOutcome: "فهم أسباب الارتفاع يمنع تكراره ويحسن التخطيط المالي",
    });
  }

  // Add per-flock critical insights at farm level
  for (const fa of flockAnalyses) {
    for (const ins of fa.insights.filter(i => i.severity === "critical")) {
      topInsights.push({ ...ins, observation: `[${fa.flockName}] ${ins.observation}` });
    }
  }

  // Data quality assessment
  const completenessScore = clamp(
    (hasPreciseFeedRecords ? 40 : 0) +
    (hasProductionData ? 30 : 0) +
    (totalFeedSpend > 0 ? 20 : 0) +
    (flocks.length > 0 ? 10 : 0),
    0, 100
  );

  return {
    analysisDate: todayStr,
    periodDays,
    totalFeedSpend: roundN(totalFeedSpend, 0),
    totalFeedKg,
    totalBirds,
    farmCostPerBird,
    farmEfficiencyScore,
    feedCostPctOfExpenses,
    totalEggsProduced,
    farmCostPerEgg,
    farmCostPerDozen,
    benchmarkComparison: {
      feedCostPct: {
        actual: feedCostPctOfExpenses,
        benchmark: GLOBAL_BENCHMARKS.general.feedCostPct,
        status: feedCostPctStatus,
      },
      avgFCR: {
        actual: avgFCR,
        benchmark: avgExpectedFCR,
        status: avgFCR == null ? "no_data" : avgFCR <= (avgExpectedFCR ?? 99) ? "good" : "poor",
      },
    },
    trend: {
      direction: trendDirection,
      pctChange: weekPctChange,
      alert: trendDirection === "increasing" && weekPctChange > 20,
    },
    flockAnalyses,
    topInsights,
    dataQuality: {
      hasPreciseFeedRecords,
      hasProductionData,
      completenessScore,
    },
  };
}
