/**
 * BRAIN ORCHESTRATOR v1.0
 * ────────────────────────────────────────────────────────────────────────────
 * The single entry point for ALL AI analysis in the farm system.
 *
 * Architecture:
 *   getRawFarmData() → UnifiedContext → [precision, ai-engine, advanced-ai] → BrainOutput
 *
 * Design principles:
 *   1. ONE data fetch — no duplicate DB queries across engines
 *   2. ALL outputs are actionable: observation + WHY + action + urgency + evidence
 *   3. Engines run in parallel where dependencies allow
 *   4. Self-monitor logs every analysis for accuracy feedback
 *   5. No placeholder text — every insight is derived from real data
 *
 * Engines coordinated:
 *   - precision-engine.ts   → statistical hatching risk, OLS, CUSUM, Bayesian
 *   - ai-engine.ts          → farm-level narrative analysis
 *   - advanced-ai-engine.ts → predictive scenarios, causal analysis
 *   - self-monitor.ts       → accuracy tracking, feedback loop
 *   - context-engine.ts     → 7-day temporal context
 */

import { runPrecisionAnalysis } from "./precision-engine.js";
import {
  runPredictiveAnalysis,
  runCausalAnalysis,
} from "./advanced-ai-engine.js";
import { getSelfMonitorReport, logPrediction, computeAccuracyMetrics } from "./self-monitor.js";
import { buildFarmContext } from "./context-engine.js";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface BrainInsight {
  id: string;
  category: "production" | "health" | "hatching" | "finance" | "task" | "feed" | "system" | "goals";
  severity: "critical" | "high" | "medium" | "low" | "positive";
  observation: string;     // What was detected (fact)
  why: string;             // Root cause / mechanism (explanation)
  action: string;          // Specific action to take (imperative)
  urgency: "immediate" | "today" | "this_week" | "monitor";
  evidence: string;        // Data that supports this finding
  expectedOutcome: string; // What happens if action is taken
  confidence: number;      // 0-100
}

export interface BrainOutput {
  generatedAt: string;
  farmStatus: "critical" | "warning" | "good" | "excellent";
  healthScore: number;
  dataQuality: number;
  confidence: number;
  summary: string;
  insights: BrainInsight[];
  predictions: {
    hatchRate: {
      value: number | null;
      ci95: [number, number] | null;
      trend: "improving" | "declining" | "stable";
      confidence: number;
    };
    production: {
      trend: "up" | "down" | "stable";
      forecastNextWeek: number | null;
      byFlock: Array<{ name: string; trend: string; avgDaily: number }>;
    };
    risk: {
      score: number;
      level: string;
      primaryFactor: string;
      failureProbability48h: number;
    };
  };
  selfMonitor: {
    systemHealth: "healthy" | "degraded" | "unknown";
    accuracy: {
      mae: number | null;
      accuracyRate: number | null;
      resolvedCount: number;
    };
    recommendation: string;
  };
  stats: {
    totalBirds: number;
    totalFlocks: number;
    eggsLast7d: number;
    activeHatchingCycles: number;
    sickFlocks: number;
    avgHatchRate: number | null;
    overdueTaskCount: number;
    documentationStreak: number;
  };
  rawEngineOutputs: {
    precisionAvailable: boolean;
    predictiveAvailable: boolean;
    causalAvailable: boolean;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function insightId(category: string, suffix: string): string {
  return `${category}_${suffix}_${Date.now().toString(36)}`;
}

function severityRank(s: string): number {
  return ({ critical: 0, high: 1, medium: 2, low: 3, positive: 4 }[s] ?? 5);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function runBrainOrchestrator(
  rawData: {
    flocks: any[];
    hatchingCycles: any[];
    tasks: any[];
    goals: any[];
    notes: any[];
    productionLogs: any[];
    healthLogs: any[];
  },
  lang: "ar" | "sv" = "ar"
): Promise<BrainOutput> {

  const today = new Date().toISOString().split("T")[0];
  const insights: BrainInsight[] = [];

  // ── Step 1: Build unified context (7-day temporal window) ─────────────────
  const context = await buildFarmContext(7);

  // ── Step 2: Run all engines in parallel ──────────────────────────────────
  const completedCycles = rawData.hatchingCycles.filter(
    (c: any) => c.status === "completed" && c.eggsHatched != null && c.eggsSet > 0
  );
  const activeCycles = rawData.hatchingCycles.filter(
    (c: any) => ["incubating", "hatching", "lockdown"].includes(c.status)
  );
  const overdueTasks = rawData.tasks.filter(
    (t: any) => t.dueDate && t.dueDate < today && !t.completed
  );

  // Input hash for self-monitor
  const inputHash = (() => {
    const raw = [
      rawData.flocks.length,
      rawData.hatchingCycles.length,
      completedCycles.length,
      rawData.productionLogs.length,
      rawData.productionLogs.reduce((s: number, p: any) => s + (Number(p.eggCount) || 0), 0),
      rawData.healthLogs.length,
      rawData.tasks.length,
      rawData.notes.length,
    ].join(":");
    return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
  })();

  const [predictiveResult, causalResult, selfMonitorReport, accuracyMetrics] = await Promise.all([
    (async () => {
      try { return runPredictiveAnalysis(rawData as any, lang); } catch { return null; }
    })(),
    (async () => {
      try { return runCausalAnalysis(rawData as any, lang); } catch { return null; }
    })(),
    getSelfMonitorReport(completedCycles.map((c: any) => ({
      startDate: c.startDate,
      eggsSet: c.eggsSet,
      eggsHatched: c.eggsHatched,
    }))),
    computeAccuracyMetrics(),
  ]);

  // Precision engine (synchronous — pure math, fast)
  let precisionResult: any = null;
  try {
    precisionResult = runPrecisionAnalysis({
      completedCycles: completedCycles.map((c: any) => ({
        batchName: c.batchName,
        startDate: c.startDate,
        eggsSet: c.eggsSet,
        eggsHatched: c.eggsHatched,
        temperature: c.temperature,
        humidity: c.humidity,
      })),
      activeCycles: activeCycles.map((c: any) => ({
        batchName: c.batchName,
        temperature: c.temperature,
        humidity: c.humidity,
        startDate: c.startDate,
        eggsSet: c.eggsSet,
      })),
      overdueTaskCount: overdueTasks.length,
      recentNotes: rawData.notes.length,
      historicalAccuracy: accuracyMetrics?.confidenceAdjustment ?? null,
    });
  } catch { /* precision engine requires data; fail silently */ }

  // ── Step 3: Build insights from all data sources ──────────────────────────

  // 3a. HATCHING INSIGHTS ────────────────────────────────────────────────────
  if (precisionResult?.dataQuality?.sufficient) {
    const risk = precisionResult.riskModel;
    const pred = precisionResult.prediction;

    if (risk.riskLevel === "critical") {
      insights.push({
        id: insightId("hatching", "critical_risk"),
        category: "hatching",
        severity: "critical",
        observation: `خطر تفقيس حرج: احتمال الفشل ${Math.round(risk.failureProbability * 100)}%`,
        why: `${precisionResult.causal.primaryCause} — نسبة تفسير التباين: ${Math.round(precisionResult.causal.totalExplainedVariance * 100)}%`,
        action: `راجع درجة الحرارة والرطوبة فوراً — النطاق المثالي: ${precisionResult.adaptiveThresholds.temperature.optimal_lo}–${precisionResult.adaptiveThresholds.temperature.optimal_hi}°C`,
        urgency: "immediate",
        evidence: `درجة الخطر ${risk.riskScore}/100 | ${risk.factors.slice(0, 2).map((f: any) => f.nameAr + ": " + f.rawValue.toFixed(1)).join(" | ")}`,
        expectedOutcome: `تصحيح البيئة الآن يرفع احتمال الفقس الناجح بنسبة تصل لـ 30%`,
        confidence: precisionResult.confidence.score,
      });
    } else if (risk.riskLevel === "high") {
      insights.push({
        id: insightId("hatching", "high_risk"),
        category: "hatching",
        severity: "high",
        observation: `خطر تفقيس مرتفع: نقاط المخاطر ${risk.riskScore}/100`,
        why: precisionResult.causal.primaryCause,
        action: "تحقق من الحرارة والرطوبة وأكمل المهام المتأخرة المتعلقة بالتفقيس",
        urgency: "today",
        evidence: risk.factors.slice(0, 3).map((f: any) => `${f.nameAr}: ${f.rawValue.toFixed(1)}`).join(" | "),
        expectedOutcome: `رفع معدل الإنجاز يُخفض الخطر بـ ${Math.round(risk.riskScore * 0.3)} نقطة تقديراً`,
        confidence: precisionResult.confidence.score,
      });
    } else if (risk.riskLevel === "low" && pred?.nextCycleHatchRate && pred.nextCycleHatchRate > 80) {
      insights.push({
        id: insightId("hatching", "excellent"),
        category: "hatching",
        severity: "positive",
        observation: `التفقيس في وضع ممتاز — معدل متوقع ${pred.nextCycleHatchRate}%`,
        why: "ظروف الحاضنة ضمن النطاق المثالي، المهام منجزة، لا شذوذات مكتشفة",
        action: "حافظ على الإعدادات الحالية ووثّق قراءات الحرارة والرطوبة يومياً",
        urgency: "monitor",
        evidence: `درجة الخطر ${risk.riskScore}/100 | ثقة ${precisionResult.confidence.score}%`,
        expectedOutcome: `استمرار هذا الوضع يُحسّن دقة تنبؤات التعلم الذاتي`,
        confidence: precisionResult.confidence.score,
      });
    }

    // Anomaly insights from precision engine
    for (const anomaly of (precisionResult.anomalyTimeline ?? []).slice(0, 2)) {
      insights.push({
        id: insightId("hatching", `anomaly_${anomaly.index}`),
        category: "hatching",
        severity: anomaly.severity === "critical" ? "critical" : anomaly.severity === "high" ? "high" : "medium",
        observation: `شذوذ مكتشف في ${anomaly.date}: ${anomaly.type === "spike" ? "ارتفاع مفاجئ" : "انخفاض مفاجئ"}`,
        why: `القيمة ${anomaly.value.toFixed(1)} — انحراف معياري z = ${anomaly.zScore.toFixed(2)} عن المتوسط`,
        action: "راجع ملاحظات ذلك اليوم وتحقق من أي حدث غير عادي في البيئة",
        urgency: "this_week",
        evidence: `z-score = ${anomaly.zScore.toFixed(2)} | النوع: ${anomaly.type}`,
        expectedOutcome: "فهم أسباب الشذوذات يمنع تكرارها في الدورات القادمة",
        confidence: 75,
      });
    }
  } else if (activeCycles.length > 0 && completedCycles.length < 3) {
    insights.push({
      id: insightId("hatching", "need_data"),
      category: "hatching",
      severity: "medium",
      observation: `لديك ${activeCycles.length} دورة تفقيس نشطة — البيانات غير كافية للتحليل الدقيق`,
      why: "التحليل الإحصائي يحتاج 3 دورات مكتملة كحد أدنى لحساب المعدلات الأساسية",
      action: "أكمل تسجيل دورات التفقيس ووثّق قراءات الحرارة والرطوبة يومياً",
      urgency: "this_week",
      evidence: `${completedCycles.length} دورة مكتملة من أصل ${rawData.hatchingCycles.length} إجمالي`,
      expectedOutcome: "بعد 3 دورات مكتملة، يُفعّل النظام التحليل الإحصائي الكامل تلقائياً",
      confidence: 90,
    });
  }

  // Overdue hatching cycles
  const overdueHatching = activeCycles.filter(
    (c: any) => c.expectedHatchDate && c.expectedHatchDate < today
  );
  if (overdueHatching.length > 0) {
    insights.push({
      id: insightId("hatching", "overdue"),
      category: "hatching",
      severity: "critical",
      observation: `${overdueHatching.length} دورة تجاوزت موعد الفقس ولم تُحدَّث`,
      why: "الدورة لا تزال في حالة 'نشطة' بعد تاريخ الفقس المتوقع — احتمال بيانات مفقودة",
      action: `سجّل نتيجة الدورة فوراً: ${overdueHatching.map((c: any) => c.batchName ?? `دورة #${c.id}`).join("، ")}`,
      urgency: "immediate",
      evidence: `الدورات المتأخرة: ${overdueHatching.map((c: any) => c.batchName ?? c.id).join("، ")}`,
      expectedOutcome: "تحديث الدورات يُغلق حلقة التعلم الذاتي ويُحسّن التنبؤات القادمة",
      confidence: 100,
    });
  }

  // 3b. PRODUCTION INSIGHTS ──────────────────────────────────────────────────
  const prodSummary = context.production;
  if (prodSummary.byFlock.length > 0) {
    const declining = prodSummary.byFlock.filter(p => p.trend === "down");
    const improving = prodSummary.byFlock.filter(p => p.trend === "up");

    for (const p of declining) {
      insights.push({
        id: insightId("production", `decline_${p.flockId}`),
        category: "production",
        severity: "high",
        observation: `إنتاج قطيع "${p.flockName}" في انخفاض مستمر — متوسط ${p.avgDaily} بيضة/يوم`,
        why: "انخفاض ملحوظ بين النصف الأول والثاني من فترة الرصد — قد يرتبط بعمر القطيع أو التغذية أو الصحة",
        action: "تحقق من الحالة الصحية للقطيع وراجع جدول التغذية — سجّل ملاحظة صحية إذا لم تفعل",
        urgency: "today",
        evidence: `${p.logCount} سجلات في آخر 7 أيام | متوسط ${p.avgDaily} بيضة/يوم`,
        expectedOutcome: "التدخل المبكر يمنع تحول الانخفاض لخسارة دائمة في الإنتاج",
        confidence: p.logCount >= 5 ? 85 : 65,
      });
    }

    for (const p of improving) {
      insights.push({
        id: insightId("production", `up_${p.flockId}`),
        category: "production",
        severity: "positive",
        observation: `إنتاج قطيع "${p.flockName}" في ارتفاع — متوسط ${p.avgDaily} بيضة/يوم`,
        why: "الاتجاه التصاعدي مستمر عبر نصف الرصد الأخير",
        action: "استمر في نفس نظام التغذية والرعاية ووثّق ما تفعله لاستخدامه مرجعاً",
        urgency: "monitor",
        evidence: `${p.logCount} سجلات | اتجاه: صاعد`,
        expectedOutcome: "الحفاظ على هذا الأداء يزيد الإنتاج الكلي في الأسابيع القادمة",
        confidence: p.logCount >= 5 ? 80 : 60,
      });
    }

    if (prodSummary.totalEggs === 0) {
      insights.push({
        id: insightId("production", "no_logs"),
        category: "production",
        severity: "medium",
        observation: "لا توجد سجلات إنتاج بيض في الأسبوع الماضي",
        why: "إما لم يتم تسجيل الإنتاج، أو القطعان ليست في مرحلة الإنتاج",
        action: "سجّل إنتاج البيض يومياً من قسم القطعان → سجل الإنتاج",
        urgency: "today",
        evidence: `${rawData.flocks.length} قطيع مسجل بدون بيانات إنتاج`,
        expectedOutcome: "التسجيل اليومي يُمكّن النظام من تتبع الأداء وتنبيهك بالانخفاضات",
        confidence: 95,
      });
    }

    // Health-production correlation
    const prodByFlockMap: Record<number, { avgDaily: number }> = {};
    for (const p of prodSummary.byFlock) prodByFlockMap[p.flockId] = { avgDaily: p.avgDaily };

    const sickWithData = context.flockHealth.flockStatuses.filter(
      f => ["sick", "quarantine"].includes(f.latestStatus) && prodByFlockMap[f.flockId]
    );
    for (const sf of sickWithData) {
      const prod = prodByFlockMap[sf.flockId];
      insights.push({
        id: insightId("health", `sick_prod_${sf.flockId}`),
        category: "health",
        severity: "critical",
        observation: `قطيع "${sf.flockName}" مريض ويُنتج ${prod.avgDaily} بيضة/يوم فقط`,
        why: `المرض (${sf.latestStatus}) يُثبّط إنتاج البيض — الدجاج المريض يحول طاقته للمقاومة`,
        action: "ابدأ علاجاً فورياً وأبلغ الطبيب البيطري — افصل القطيع إذا لم يتم بعد",
        urgency: "immediate",
        evidence: `الحالة الصحية: ${sf.latestStatus} (${sf.lastDate}) | إنتاج: ${prod.avgDaily} بيضة/يوم`,
        expectedOutcome: "العلاج الناجح يُعيد الإنتاج لمستوياته الطبيعية خلال 7-14 يوم",
        confidence: 88,
      });
    }
  } else {
    insights.push({
      id: insightId("production", "no_flocks"),
      category: "production",
      severity: "medium",
      observation: rawData.flocks.length === 0 ? "لا يوجد قطعان مسجّلة" : "لا توجد سجلات إنتاج لهذا الأسبوع",
      why: rawData.flocks.length === 0 ? "لم تُضَف أي قطعان للنظام بعد" : "سجلات الإنتاج اليومية مفقودة",
      action: rawData.flocks.length === 0 ? "أضف قطيعك الأول من قسم القطعان" : "سجّل الإنتاج اليومي لكل قطيع",
      urgency: rawData.flocks.length === 0 ? "today" : "today",
      evidence: `${rawData.flocks.length} قطعان | ${rawData.productionLogs.length} سجل إنتاج إجمالي`,
      expectedOutcome: "إضافة البيانات تُفعّل التحليل التلقائي والتنبيهات",
      confidence: 95,
    });
  }

  // 3c. HEALTH INSIGHTS ──────────────────────────────────────────────────────
  for (const fh of context.flockHealth.flockStatuses) {
    if (fh.latestStatus === "quarantine") {
      insights.push({
        id: insightId("health", `quarantine_${fh.flockId}`),
        category: "health",
        severity: "critical",
        observation: `قطيع "${fh.flockName}" في الحجر الصحي منذ ${fh.lastDate}`,
        why: "الحجر الصحي يعني احتمال وجود مرض معدٍ — يجب العزل الكامل",
        action: "تأكد من العزل التام، لا تدخل دجاج من هذا القطيع لأماكن أخرى، استشر بيطرياً",
        urgency: "immediate",
        evidence: `حالة صحية: quarantine | ${fh.eventCount} أحداث صحية مسجلة`,
        expectedOutcome: "العزل السليم يمنع انتشار المرض لبقية القطعان",
        confidence: 95,
      });
    } else if (fh.latestStatus === "recovering") {
      insights.push({
        id: insightId("health", `recovering_${fh.flockId}`),
        category: "health",
        severity: "medium",
        observation: `قطيع "${fh.flockName}" في مرحلة التعافي`,
        why: "القطيع خرج من مرحلة المرض لكنه لم يعد لـ 'healthy' بعد",
        action: "تابع الحالة يومياً وسجّل أي عودة للأعراض — حافظ على نظافة المكان",
        urgency: "this_week",
        evidence: `حالة صحية: recovering | آخر تحديث: ${fh.lastDate}`,
        expectedOutcome: "المتابعة الدقيقة تضمن التعافي الكامل وعودة الإنتاج",
        confidence: 80,
      });
    }
  }

  // 3d. FINANCE INSIGHTS ─────────────────────────────────────────────────────
  for (const alert of context.alerts) {
    if (alert.flag === "expense_spike") {
      insights.push({
        id: insightId("finance", "expense_spike"),
        category: "finance",
        severity: "critical",
        observation: alert.detailAr,
        why: `ارتفاع حاد بنسبة ${alert.pctChange}% عن المتوسط — قد يكون شراء طارئ أو خطأ تسجيل`,
        action: "راجع معاملات اليوم وتحقق أن كل إدخال صحيح ومبرر",
        urgency: "today",
        evidence: `المصاريف اليوم مقابل متوسط 7 أيام: +${alert.pctChange}%`,
        expectedOutcome: "التحقق المبكر يمنع استمرار الإنفاق الزائد ويُحسّن الهامش",
        confidence: 85,
      });
    } else if (alert.flag === "expense_high") {
      insights.push({
        id: insightId("finance", "expense_high"),
        category: "finance",
        severity: "high",
        observation: alert.detailAr,
        why: "المصاريف أعلى من المعتاد — قد تكون مقبولة إذا كانت مشتريات مخططة",
        action: "تحقق من تصنيف المصاريف وتأكد أنها ضمن الميزانية المخططة",
        urgency: "today",
        evidence: `+${alert.pctChange}% عن متوسط الأسبوع`,
        expectedOutcome: "التحكم في المصاريف يُحسّن هامش الربح في نهاية الشهر",
        confidence: 80,
      });
    } else if (alert.flag === "income_drop") {
      insights.push({
        id: insightId("finance", "income_drop"),
        category: "finance",
        severity: "high",
        observation: alert.detailAr,
        why: "انخفاض غير متوقع في الدخل — قد يكون بسبب ضعف المبيعات أو عدم التسجيل",
        action: "تحقق من سجلات المبيعات لهذا اليوم وتأكد أن كل إيراد مُسجَّل",
        urgency: "today",
        evidence: `${alert.pctChange}% عن متوسط الأسبوع`,
        expectedOutcome: "الرصد اليومي للإيرادات يمنع الخسائر غير المكتشفة",
        confidence: 80,
      });
    }

    if (alert.flag === "hatch_critical") {
      insights.push({
        id: insightId("hatching", "hatch_rate_low"),
        category: "hatching",
        severity: "critical",
        observation: alert.detailAr,
        why: "معدل تفقيس أقل من 70% يعني أكثر من ثلث البيض لم يفقس — خسارة مباشرة",
        action: "حلل أسباب الفشل في الدورات السابقة: درجة حرارة، رطوبة، جودة البيض، التقليب",
        urgency: "this_week",
        evidence: `معدل الفقس الكلي: ${context.farm.overallHatchRate}% | المقبول: >70% | المثالي: >80%`,
        expectedOutcome: "تحسين 5% في معدل الفقس يعني مزيداً من الطيور في كل دورة",
        confidence: 90,
      });
    }
  }

  // Financial health from context
  if (context.financial.profit < 0) {
    insights.push({
      id: insightId("finance", "loss"),
      category: "finance",
      severity: "critical",
      observation: `المزرعة في وضع خسارة — إجمالي ${Math.abs(context.financial.profit).toLocaleString()} خسارة`,
      why: "المصاريف الكلية تتجاوز الإيرادات — يجب مراجعة هيكل التكاليف",
      action: "ابدأ بمراجعة فئة المصاريف الأكبر وابحث عن فرص تخفيض دون التأثير على الإنتاج",
      urgency: "this_week",
      evidence: `دخل: ${context.financial.totalIncome.toLocaleString()} | مصاريف: ${context.financial.totalExpense.toLocaleString()} | أكبر فئة: ${context.financial.topExpenseCategory ?? "غير محدد"} (${context.financial.topExpensePct}%)`,
      expectedOutcome: "تخفيض المصاريف بـ 10% يُحسّن الهامش ويُوقف الخسائر",
      confidence: 98,
    });
  } else if (context.financial.margin !== null && context.financial.margin < 10 && context.financial.totalIncome > 0) {
    insights.push({
      id: insightId("finance", "low_margin"),
      category: "finance",
      severity: "high",
      observation: `هامش الربح ضعيف: ${context.financial.margin}% — أقل من الحد الصحي 15%`,
      why: `أكبر فئة مصاريف هي "${context.financial.topExpenseCategory ?? "غير محدد"}" بنسبة ${context.financial.topExpensePct}% من إجمالي المصاريف`,
      action: `راجع تكاليف "${context.financial.topExpenseCategory ?? "العلف"}" — هل يمكن تحسين الكفاءة أو تفاوض أسعار أفضل؟`,
      urgency: "this_week",
      evidence: `هامش: ${context.financial.margin}% | الإيراد: ${context.financial.totalIncome.toLocaleString()}`,
      expectedOutcome: "رفع الهامش لـ 15% يضمن استدامة المزرعة على المدى البعيد",
      confidence: 88,
    });
  } else if (context.financial.margin !== null && context.financial.margin >= 20) {
    insights.push({
      id: insightId("finance", "good_margin"),
      category: "finance",
      severity: "positive",
      observation: `هامش ربح ممتاز: ${context.financial.margin}% — فوق معيار الصناعة`,
      why: "الإيرادات تتجاوز المصاريف بفارق صحي مما يعني كفاءة تشغيلية عالية",
      action: "فكر في إعادة استثمار جزء من الأرباح في توسعة القطعان أو تحديث المعدات",
      urgency: "monitor",
      evidence: `هامش: ${context.financial.margin}% | المعيار الصناعي: 12-18%`,
      expectedOutcome: "التوسع المدروس يزيد الإيرادات مع الحفاظ على الكفاءة",
      confidence: 95,
    });
  }

  // 3e. TASK INSIGHTS ────────────────────────────────────────────────────────
  if (overdueTasks.length >= 5) {
    insights.push({
      id: insightId("task", "many_overdue"),
      category: "task",
      severity: "critical",
      observation: `${overdueTasks.length} مهمة متأخرة تراكمت بدون إنجاز`,
      why: "تراكم المهام يزيد خطر إغفال إجراءات حرجة كالتغذية والمراقبة والعلاج",
      action: "خصص الساعة القادمة لمراجعة وإنجاز أهم المهام المتأخرة",
      urgency: "immediate",
      evidence: `${overdueTasks.length} مهمة متأخرة | ${overdueTasks.filter((t: any) => t.priority === "high").length} منها عالية الأولوية`,
      expectedOutcome: "إنجاز المهام يُخفض نقاط الخطر في تحليل الذكاء ويُحسّن صحة المزرعة",
      confidence: 95,
    });
  } else if (overdueTasks.length > 0) {
    insights.push({
      id: insightId("task", "overdue"),
      category: "task",
      severity: "high",
      observation: `${overdueTasks.length} مهمة متأخرة تحتاج انتباهاً`,
      why: "المهام المتأخرة تشمل غالباً فحوصات وإجراءات وقائية مهمة",
      action: `أنجز هذه المهام اليوم: ${overdueTasks.slice(0, 3).map((t: any) => t.title).join("، ")}`,
      urgency: "today",
      evidence: `مهام متأخرة: ${overdueTasks.map((t: any) => t.title).slice(0, 3).join("، ")}`,
      expectedOutcome: "إنجاز المهام يمنع مشاكل أكبر ويُحافظ على نظام العمل",
      confidence: 90,
    });
  } else if (rawData.tasks.filter((t: any) => !t.completed).length > 0) {
    const todayTasks = rawData.tasks.filter((t: any) => t.dueDate === today && !t.completed);
    if (todayTasks.length > 0) {
      insights.push({
        id: insightId("task", "today"),
        category: "task",
        severity: "medium",
        observation: `${todayTasks.length} مهمة مجدولة لليوم في انتظار الإنجاز`,
        why: "المهام اليومية تُشكّل العمود الفقري للرعاية المنتظمة",
        action: `أنجز مهام اليوم: ${todayTasks.slice(0, 3).map((t: any) => t.title).join("، ")}`,
        urgency: "today",
        evidence: `${todayTasks.length} مهمة اليوم`,
        expectedOutcome: "الإنجاز المنتظم يبني نمطاً صحياً ويمنع تراكم المهام",
        confidence: 95,
      });
    }
  }

  // 3f. PREDICTIVE INSIGHTS (from advanced-ai-engine) ────────────────────────
  if (predictiveResult?.actionPlan?.length > 0) {
    for (const action of predictiveResult.actionPlan.slice(0, 2)) {
      const urg: "immediate" | "today" | "this_week" | "monitor" =
        action.urgency === "immediate" ? "immediate" :
        action.urgency === "today" ? "today" :
        action.urgency === "this_week" ? "this_week" : "monitor";
      insights.push({
        id: insightId("system", `predict_${action.priority}`),
        category: "system",
        severity: action.urgency === "immediate" ? "critical" : action.urgency === "today" ? "high" : "medium",
        observation: predictiveResult.observations?.[0] ?? "تحليل تنبؤي",
        why: predictiveResult.rootCause?.mechanism ?? "",
        action: action.action,
        urgency: urg,
        evidence: predictiveResult.evidence?.slice(0, 2).map((e: any) => `${e.metric}: ${e.value}`).join(" | ") ?? "",
        expectedOutcome: action.expectedOutcome,
        confidence: predictiveResult.confidenceScore ?? 70,
      });
    }
  }

  // 3g. DOCUMENTATION INSIGHT ────────────────────────────────────────────────
  const docStreak = context.activeDays;
  if (docStreak === 0) {
    insights.push({
      id: insightId("system", "no_activity"),
      category: "system",
      severity: "high",
      observation: "لا يوجد أي نشاط مسجل في آخر 7 أيام",
      why: "غياب التوثيق يعني أن الذكاء الاصطناعي يعمل بدون بيانات — تحليله غير موثوق",
      action: "سجّل أي نشاط: معاملة، ملاحظة، أو قراءة حرارة ورطوبة",
      urgency: "today",
      evidence: "0 أيام نشطة في آخر 7 أيام",
      expectedOutcome: "التوثيق اليومي يُفعّل التحليل الكامل والتنبيهات الدقيقة",
      confidence: 100,
    });
  }

  // ── Step 4: Sort insights by severity + urgency ───────────────────────────
  const urgencyRank: Record<string, number> = { immediate: 0, today: 1, this_week: 2, monitor: 3 };
  insights.sort((a, b) => {
    const sr = severityRank(a.severity) - severityRank(b.severity);
    if (sr !== 0) return sr;
    return (urgencyRank[a.urgency] ?? 9) - (urgencyRank[b.urgency] ?? 9);
  });

  // ── Step 5: Compute farm status & health score ────────────────────────────
  const criticalCount = insights.filter(i => i.severity === "critical").length;
  const highCount = insights.filter(i => i.severity === "high").length;
  const positiveCount = insights.filter(i => i.severity === "positive").length;

  const farmStatus: "critical" | "warning" | "good" | "excellent" =
    criticalCount >= 2 ? "critical" :
    criticalCount >= 1 ? "warning" :
    highCount >= 2 ? "warning" :
    positiveCount >= 2 && highCount === 0 ? "excellent" : "good";

  let healthScore = 80;
  healthScore -= criticalCount * 15;
  healthScore -= highCount * 8;
  healthScore -= insights.filter(i => i.severity === "medium").length * 3;
  healthScore += positiveCount * 5;
  if (context.flockHealth.sickFlocks > 0) healthScore -= context.flockHealth.sickFlocks * 10;
  healthScore = clamp(healthScore, 0, 100);

  // ── Step 6: Build predictions summary ─────────────────────────────────────
  const predictions: BrainOutput["predictions"] = {
    hatchRate: {
      value: precisionResult?.prediction?.nextCycleHatchRate ?? null,
      ci95: precisionResult?.prediction?.ci95 ?? null,
      trend: precisionResult?.prediction?.trend ?? "stable",
      confidence: precisionResult?.confidence?.score ?? 0,
    },
    production: {
      trend: context.production.trend,
      forecastNextWeek: context.production.totalEggs > 0
        ? Math.round(context.production.avgDailyEggs * 7)
        : null,
      byFlock: context.production.byFlock.map(p => ({
        name: p.flockName,
        trend: p.trend,
        avgDaily: p.avgDaily,
      })),
    },
    risk: {
      score: precisionResult?.riskModel?.riskScore ?? 0,
      level: precisionResult?.riskModel?.riskLevel ?? "unknown",
      primaryFactor: precisionResult?.causal?.primaryCause ?? causalResult?.rootCause?.primary ?? "غير كافٍ من البيانات",
      failureProbability48h: precisionResult?.prediction?.failureProbability48h ?? 0,
    },
  };

  // ── Step 7: Self-monitor summary ──────────────────────────────────────────
  const selfMonitor: BrainOutput["selfMonitor"] = {
    systemHealth: selfMonitorReport.systemHealth,
    accuracy: {
      mae: selfMonitorReport.accuracy?.mae ?? null,
      accuracyRate: selfMonitorReport.accuracy?.accuracyRate ?? null,
      resolvedCount: selfMonitorReport.accuracy?.resolvedCount ?? 0,
    },
    recommendation: selfMonitorReport.recommendation,
  };

  // ── Step 8: Stats ─────────────────────────────────────────────────────────
  const avgHatchRate = completedCycles.length > 0
    ? Math.round(completedCycles.reduce((s: number, c: any) => {
        const e = Number(c.eggsSet) || 0;
        const h = Number(c.eggsHatched) || 0;
        return s + (e > 0 ? (h / e) * 100 : 0);
      }, 0) / completedCycles.length)
    : null;

  const stats: BrainOutput["stats"] = {
    totalBirds: context.farm.totalChickens,
    totalFlocks: context.farm.totalFlocks,
    eggsLast7d: context.production.totalEggs,
    activeHatchingCycles: activeCycles.length,
    sickFlocks: context.flockHealth.sickFlocks,
    avgHatchRate,
    overdueTaskCount: overdueTasks.length,
    documentationStreak: context.activeDays,
  };

  // ── Step 9: Executive summary ─────────────────────────────────────────────
  const topInsight = insights.find(i => i.severity === "critical")
    ?? insights.find(i => i.severity === "high")
    ?? insights[0];

  let summary = "";
  if (farmStatus === "excellent") {
    summary = `المزرعة في وضع ممتاز — ${stats.totalBirds} طير نشط, إنتاج ${stats.eggsLast7d} بيضة في الأسبوع, لا مشاكل حرجة.`;
  } else if (farmStatus === "critical") {
    summary = `تحتاج انتباهاً فورياً: ${criticalCount} مشاكل حرجة. ${topInsight ? topInsight.observation + " — " + topInsight.action : ""}`;
  } else if (farmStatus === "warning") {
    summary = `وضع المزرعة يستدعي المتابعة: ${highCount + criticalCount} نقاط تحتاج معالجة. ${topInsight ? topInsight.observation + "." : ""}`;
  } else {
    summary = `المزرعة تعمل بشكل جيد مع بعض النقاط للتحسين. ${stats.totalBirds} طير, ${stats.eggsLast7d} بيضة هذا الأسبوع.`;
  }

  // ── Step 10: Log prediction for self-learning ────────────────────────────
  if (precisionResult?.dataQuality?.sufficient && precisionResult?.prediction?.nextCycleHatchRate) {
    logPrediction({
      engineVersion: "brain-orchestrator-1.0",
      analysisType: "full_orchestration",
      inputHash,
      predictedHatchRate: precisionResult.prediction.nextCycleHatchRate,
      predictedRiskScore: precisionResult.riskModel.riskScore,
      confidenceScore: precisionResult.confidence.score,
      featuresSnapshot: {
        completedCycles: completedCycles.length,
        activeCycles: activeCycles.length,
        totalBirds: stats.totalBirds,
        avgHatchRate: stats.avgHatchRate,
        sickFlocks: stats.sickFlocks,
        overdueTasks: overdueTasks.length,
      },
      modelMetrics: precisionResult.meta.modelMetrics ?? {},
      dataQualityScore: precisionResult.dataQuality.score,
      anomaliesDetected: precisionResult.anomalyTimeline ?? [],
    }).catch(() => { /* non-critical, don't throw */ });
  }

  return {
    generatedAt: new Date().toISOString(),
    farmStatus,
    healthScore,
    dataQuality: precisionResult?.dataQuality?.score ?? (rawData.hatchingCycles.length > 0 ? 40 : 20),
    confidence: precisionResult?.confidence?.score ?? 50,
    summary,
    insights,
    predictions,
    selfMonitor,
    stats,
    rawEngineOutputs: {
      precisionAvailable: precisionResult?.dataQuality?.sufficient ?? false,
      predictiveAvailable: predictiveResult !== null,
      causalAvailable: causalResult !== null,
    },
  };
}
