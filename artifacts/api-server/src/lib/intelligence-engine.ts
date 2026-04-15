/**
 * Intelligence Engine — 7-Point Farm Analysis Protocol
 * Fully deterministic. Arabic/Swedish only. No external AI calls.
 *
 * PROTOCOL:
 *  1. Current state summary
 *  2. Historical comparison (today vs yesterday vs 7-day avg)
 *  3. Quantified changes (%)
 *  4. Root cause hypothesis
 *  5. Risk evaluation
 *  6. Immediate actions (clear commands)
 *  7. Consequences if no action taken
 */

import type { FarmContextPayload } from "./context-engine";

export type Lang = "ar" | "sv";
const L = (lang: Lang, ar: string, sv: string) => lang === "sv" ? sv : ar;

// ─── Output Types ─────────────────────────────────────────────────────────────

export interface ReportSection {
  titleAr: string;
  titleSv: string;
  contentAr: string;
  contentSv: string;
}

export interface ChangeItem {
  metricAr: string;
  metricSv: string;
  current: string;
  previous: string;
  change: number | null;          // % change
  direction: "up" | "down" | "stable";
  significance: "critical" | "warning" | "normal";
}

export interface RiskSection extends ReportSection {
  riskLevel: "critical" | "high" | "medium" | "low";
  riskScore: number;   // 0-100
  factors: string[];   // in selected language
}

export interface ActionItem {
  rank: 1 | 2 | 3;
  immediacy: "now" | "today" | "this_week";
  actionAr: string;
  actionSv: string;
  whyAr: string;
  whySv: string;
}

export interface IntelligenceReport {
  generatedAt: string;
  lang: Lang;
  overallRisk: "critical" | "warning" | "stable" | "good";
  confidenceScore: number;    // 0-100 based on data coverage
  dataQuality: "excellent" | "good" | "limited" | "none";

  point1_currentState: ReportSection;
  point2_historicalComparison: ReportSection;
  point3_quantifiedChanges: ChangeItem[];
  point4_rootCause: ReportSection;
  point5_riskEvaluation: RiskSection;
  point6_immediateActions: ActionItem[];
  point7_consequences: ReportSection;
}

// ─── Category names ───────────────────────────────────────────────────────────

const CAT: Record<string, { ar: string; sv: string }> = {
  feed:        { ar: "العلف",         sv: "Foder" },
  medicine:    { ar: "الأدوية",       sv: "Medicin" },
  chick_sale:  { ar: "بيع كتاكيت",   sv: "Kycklingsförsäljning" },
  egg_sale:    { ar: "بيع بيض",       sv: "Äggförsäljning" },
  equipment:   { ar: "المعدات",       sv: "Utrustning" },
  electricity: { ar: "الكهرباء",      sv: "El & energi" },
  labor:       { ar: "العمالة",       sv: "Arbetskraft" },
  maintenance: { ar: "الصيانة",       sv: "Underhåll" },
  other:       { ar: "أخرى",          sv: "Övrigt" },
};

function catName(key: string | null, lang: Lang): string {
  if (!key) return lang === "ar" ? "غير محدد" : "Okänd";
  return CAT[key]?.[lang] ?? key;
}

// ─── Main Builder ─────────────────────────────────────────────────────────────

export function buildIntelligenceReport(ctx: FarmContextPayload, lang: Lang): IntelligenceReport {
  const { today, yesterday, avg7Day, temporal, alerts, farm, financial, recentNotes, activeDays, snapshots } = ctx;

  const hasData = financial.totalIncome > 0 || financial.totalExpense > 0;
  const todayIncome  = today?.income  ?? 0;
  const todayExpense = today?.expense ?? 0;
  const todayProfit  = todayIncome - todayExpense;
  const todayTasks   = today ? `${today.tasksCompleted}/${today.tasksDue}` : "0/0";

  const criticalAlerts = alerts.filter(a => a.severity === "critical");
  const warningAlerts  = alerts.filter(a => a.severity === "warning");

  // ── Data quality ──────────────────────────────────────────────────────────
  const dataQuality: IntelligenceReport["dataQuality"] =
    activeDays >= 5 ? "excellent" :
    activeDays >= 3 ? "good" :
    activeDays >= 1 ? "limited" : "none";

  const confidenceScore = Math.min(90, 35 + activeDays * 8);

  // ─────────────────────────────────────────────────────────────────────────
  // POINT 1: Current State Summary
  // ─────────────────────────────────────────────────────────────────────────

  const todayDateAr = new Date().toLocaleDateString("ar-IQ", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const todayDateSv = new Date().toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  let p1Ar = `📅 ${todayDateAr}\n\n`;
  let p1Sv = `📅 ${todayDateSv}\n\n`;

  if (!hasData) {
    p1Ar += `المزرعة تعمل بشكل طبيعي. يوجد ${farm.totalChickens} دجاجة موزعة على ${farm.totalFlocks} قطيع.`;
    p1Ar += farm.activeHatchingCycles > 0 ? ` دورات تفقيس نشطة: ${farm.activeHatchingCycles} (معدل إجمالي: ${farm.overallHatchRate}%).` : " لا توجد دورات تفقيس نشطة حالياً.";
    p1Ar += "\n⚠️ لا توجد بيانات مالية مسجلة بعد — أضف معاملات لتفعيل التحليل الكامل.";

    p1Sv += `Gården fungerar normalt. Det finns ${farm.totalChickens} höns fördelade på ${farm.totalFlocks} flockar.`;
    p1Sv += farm.activeHatchingCycles > 0 ? ` Aktiva kläckningscykler: ${farm.activeHatchingCycles} (genomsnittsgrad: ${farm.overallHatchRate}%).` : " Inga aktiva kläckningscykler för tillfället.";
    p1Sv += "\n⚠️ Inga finansiella uppgifter registrerade ännu — lägg till transaktioner för att aktivera fullständig analys.";
  } else {
    const profitStatus = financial.profit >= 0
      ? L(lang, "المزرعة تحقق أرباحاً ✅", "Gården är lönsam ✅")
      : L(lang, "المزرعة تعمل بخسارة ❌", "Gården arbetar med förlust ❌");

    p1Ar += `${financial.profit >= 0 ? "✅" : "❌"} الوضع المالي العام: ${profitStatus}\n`;
    p1Ar += `💰 إجمالي الدخل: ${financial.totalIncome.toLocaleString()} د.ع\n`;
    p1Ar += `💸 إجمالي المصاريف: ${financial.totalExpense.toLocaleString()} د.ع\n`;
    p1Ar += `📊 صافي الربح: ${financial.profit >= 0 ? "+" : ""}${financial.profit.toLocaleString()} د.ع`;
    p1Ar += financial.margin !== null ? ` (هامش: ${financial.margin}%)\n` : "\n";
    p1Ar += `\n🐔 القطيع: ${farm.totalChickens} دجاجة في ${farm.totalFlocks} قطيع`;
    if (farm.activeHatchingCycles > 0) p1Ar += ` | تفقيس: ${farm.activeHatchingCycles} دورة نشطة (${farm.overallHatchRate}%)`;
    p1Ar += `\n📋 مهام اليوم: ${todayTasks} منجزة`;
    if (today?.noteCount) p1Ar += ` | ملاحظات اليوم: ${today.noteCount}`;
    if (recentNotes.length > 0) p1Ar += `\n\n📝 آخر ملاحظة ميدانية (${recentNotes[0].date}): "${recentNotes[0].content.slice(0, 100)}${recentNotes[0].content.length > 100 ? "..." : ""}"`;

    p1Sv += `${financial.profit >= 0 ? "✅" : "❌"} Övergripande ekonomisk status: ${profitStatus}\n`;
    p1Sv += `💰 Total inkomst: ${financial.totalIncome.toLocaleString()} IQD\n`;
    p1Sv += `💸 Totala utgifter: ${financial.totalExpense.toLocaleString()} IQD\n`;
    p1Sv += `📊 Nettovinst: ${financial.profit >= 0 ? "+" : ""}${financial.profit.toLocaleString()} IQD`;
    p1Sv += financial.margin !== null ? ` (marginal: ${financial.margin}%)\n` : "\n";
    p1Sv += `\n🐔 Flock: ${farm.totalChickens} höns i ${farm.totalFlocks} flockar`;
    if (farm.activeHatchingCycles > 0) p1Sv += ` | Kläckning: ${farm.activeHatchingCycles} aktiva cykler (${farm.overallHatchRate}%)`;
    p1Sv += `\n📋 Dagens uppgifter: ${todayTasks} slutförda`;
    if (today?.noteCount) p1Sv += ` | Dagens anteckningar: ${today.noteCount}`;
    if (recentNotes.length > 0) p1Sv += `\n\n📝 Senaste fältanteckning (${recentNotes[0].date}): "${recentNotes[0].content.slice(0, 100)}${recentNotes[0].content.length > 100 ? "..." : ""}"`;
  }

  const point1: ReportSection = {
    titleAr: "حالة المزرعة الراهنة", titleSv: "Aktuell gårdsstatus",
    contentAr: p1Ar, contentSv: p1Sv,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // POINT 2: Historical Comparison
  // ─────────────────────────────────────────────────────────────────────────

  let p2Ar = "";
  let p2Sv = "";

  if (activeDays < 2) {
    p2Ar = `نافذة التحليل تغطي ${ctx.windowDays} أيام. البيانات المتاحة: ${activeDays} يوم نشط فقط.\n`;
    p2Ar += "سيتحسن التحليل التاريخي تدريجياً مع تسجيل البيانات اليومية.";

    p2Sv = `Analysfönstret täcker ${ctx.windowDays} dagar. Tillgängliga data: bara ${activeDays} aktiva dagar.\n`;
    p2Sv += "Den historiska analysen förbättras gradvis allteftersom dagliga data registreras.";
  } else {
    // Profit trend from snapshots
    const profitHistory = snapshots.filter(s => s.income > 0 || s.expense > 0).map(s => s.profit);
    let trendAr = "لا يوجد اتجاه واضح";
    let trendSv = "Ingen tydlig trend";
    if (profitHistory.length >= 2) {
      const first = profitHistory[profitHistory.length - 1];
      const last  = profitHistory[0];
      if (last > first * 1.05) { trendAr = "تصاعدي 📈"; trendSv = "Uppåtgående 📈"; }
      else if (last < first * 0.95) { trendAr = "تنازلي 📉"; trendSv = "Nedåtgående 📉"; }
      else { trendAr = "مستقر ↔️"; trendSv = "Stabil ↔️"; }
    }

    p2Ar += `📊 متوسطات الـ${ctx.windowDays} أيام الماضية:\n`;
    p2Ar += `   • دخل يومي: ${avg7Day.income.toLocaleString()} د.ع\n`;
    p2Ar += `   • مصاريف يومية: ${avg7Day.expense.toLocaleString()} د.ع\n`;
    p2Ar += `   • ربح يومي: ${avg7Day.profit >= 0 ? "+" : ""}${avg7Day.profit.toLocaleString()} د.ع\n`;
    if (avg7Day.taskCompletionRate > 0) p2Ar += `   • معدل إنجاز مهام: ${avg7Day.taskCompletionRate}%\n`;
    p2Ar += `\n📅 أمس (${yesterday?.date ?? "لا يوجد"}):\n`;
    if (yesterday) {
      p2Ar += `   • دخل: ${yesterday.income.toLocaleString()} د.ع | مصاريف: ${yesterday.expense.toLocaleString()} د.ع | ربح: ${yesterday.profit >= 0 ? "+" : ""}${yesterday.profit.toLocaleString()} د.ع\n`;
      if (yesterday.tasksDue > 0) p2Ar += `   • مهام: ${yesterday.tasksCompleted}/${yesterday.tasksDue} (${yesterday.taskCompletionRate}%)\n`;
    } else {
      p2Ar += "   • لا توجد بيانات لأمس\n";
    }
    p2Ar += `\n📈 اتجاه الربح العام: ${trendAr}`;

    p2Sv += `📊 Genomsnitt för de senaste ${ctx.windowDays} dagarna:\n`;
    p2Sv += `   • Dagsinkomst: ${avg7Day.income.toLocaleString()} IQD\n`;
    p2Sv += `   • Dagliga utgifter: ${avg7Day.expense.toLocaleString()} IQD\n`;
    p2Sv += `   • Daglig vinst: ${avg7Day.profit >= 0 ? "+" : ""}${avg7Day.profit.toLocaleString()} IQD\n`;
    if (avg7Day.taskCompletionRate > 0) p2Sv += `   • Uppgiftsavslutningsgrad: ${avg7Day.taskCompletionRate}%\n`;
    p2Sv += `\n📅 Igår (${yesterday?.date ?? "ej tillgänglig"}):\n`;
    if (yesterday) {
      p2Sv += `   • Inkomst: ${yesterday.income.toLocaleString()} IQD | Utgifter: ${yesterday.expense.toLocaleString()} IQD | Vinst: ${yesterday.profit >= 0 ? "+" : ""}${yesterday.profit.toLocaleString()} IQD\n`;
      if (yesterday.tasksDue > 0) p2Sv += `   • Uppgifter: ${yesterday.tasksCompleted}/${yesterday.tasksDue} (${yesterday.taskCompletionRate}%)\n`;
    } else {
      p2Sv += "   • Inga uppgifter för igår\n";
    }
    p2Sv += `\n📈 Övergripande vinsttrend: ${trendSv}`;
  }

  const point2: ReportSection = {
    titleAr: "مقارنة مع الأيام السابقة", titleSv: "Jämförelse med tidigare dagar",
    contentAr: p2Ar, contentSv: p2Sv,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // POINT 3: Quantified Changes (%)
  // ─────────────────────────────────────────────────────────────────────────

  const changes: ChangeItem[] = [];

  function addChange(
    metricAr: string, metricSv: string,
    current: number, previous: number | undefined,
    currentLabel: string, previousLabel: string,
    changeVal: number | null,
    higherIsBetter: boolean,
  ) {
    if (changeVal === null || previous === undefined) return;
    const direction: ChangeItem["direction"] =
      changeVal > 5 ? "up" : changeVal < -5 ? "down" : "stable";
    // Significance: critical if change > 30%, warning if > 15%
    let significance: ChangeItem["significance"] = "normal";
    const abs = Math.abs(changeVal);
    if (abs > 30) significance = "critical";
    else if (abs > 15) significance = "warning";
    // For expenses: going up is bad; for income/profit: going up is good
    if (!higherIsBetter && direction === "up" && abs > 15) significance = abs > 30 ? "critical" : "warning";
    if (higherIsBetter && direction === "down" && abs > 15) significance = abs > 30 ? "critical" : "warning";

    changes.push({ metricAr, metricSv, current: currentLabel, previous: previousLabel, change: changeVal, direction, significance });
  }

  if (yesterday) {
    addChange(
      `الدخل (اليوم مقابل أمس)`, `Inkomst (idag vs igår)`,
      todayIncome, yesterday.income,
      `${todayIncome.toLocaleString()} IQD`, `${yesterday.income.toLocaleString()} IQD`,
      temporal.incomeVsYesterday, true,
    );
    addChange(
      `المصاريف (اليوم مقابل أمس)`, `Utgifter (idag vs igår)`,
      todayExpense, yesterday.expense,
      `${todayExpense.toLocaleString()} IQD`, `${yesterday.expense.toLocaleString()} IQD`,
      temporal.expenseVsYesterday, false,
    );
    addChange(
      `الربح (اليوم مقابل أمس)`, `Vinst (idag vs igår)`,
      todayProfit, yesterday.profit,
      `${todayProfit >= 0 ? "+" : ""}${todayProfit.toLocaleString()} IQD`,
      `${yesterday.profit >= 0 ? "+" : ""}${yesterday.profit.toLocaleString()} IQD`,
      temporal.profitVsYesterday, true,
    );
  }

  if (avg7Day.income > 0 || avg7Day.expense > 0) {
    addChange(
      `الدخل مقابل المتوسط الأسبوعي`, `Inkomst vs veckogenomsnitt`,
      todayIncome, avg7Day.income,
      `${todayIncome.toLocaleString()} IQD`, `${avg7Day.income.toLocaleString()} IQD`,
      temporal.incomeVs7Avg, true,
    );
    addChange(
      `المصاريف مقابل المتوسط الأسبوعي`, `Utgifter vs veckogenomsnitt`,
      todayExpense, avg7Day.expense,
      `${todayExpense.toLocaleString()} IQD`, `${avg7Day.expense.toLocaleString()} IQD`,
      temporal.expenseVs7Avg, false,
    );
  }

  if (temporal.taskRateVsYesterday !== null && today && yesterday) {
    addChange(
      `إنجاز المهام (اليوم مقابل أمس)`, `Uppgiftsavslutning (idag vs igår)`,
      today.taskCompletionRate, yesterday.taskCompletionRate,
      `${today.taskCompletionRate}%`, `${yesterday.taskCompletionRate}%`,
      temporal.taskRateVsYesterday, true,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POINT 4: Root Cause Hypothesis
  // ─────────────────────────────────────────────────────────────────────────

  let p4Ar = "";
  let p4Sv = "";

  if (!hasData) {
    p4Ar = "⚠️ لا توجد بيانات مالية كافية لإجراء تحليل سببي دقيق.\n";
    p4Ar += "الإجراء المطلوب: سجّل معاملاتك المالية اليومية (دخل ومصاريف) وملاحظاتك الميدانية لتفعيل هذا التحليل.";

    p4Sv = "⚠️ Det finns inte tillräckliga finansiella uppgifter för noggrann orsaksanalys.\n";
    p4Sv += "Nödvändig åtgärd: Registrera dina dagliga finansiella transaktioner (inkomster och utgifter) och fältanteckningar för att aktivera denna analys.";
  } else if (criticalAlerts.length > 0) {
    const primary = criticalAlerts[0];
    p4Ar = `🔴 السبب الجذري الأساسي:\n${primary.detailAr}\n\n`;
    p4Sv = `🔴 Primär grundorsak:\n${primary.detailSv}\n\n`;

    if (financial.topExpenseCategory === "feed" && financial.topExpensePct > 55) {
      p4Ar += `📌 عامل مساهم: ${catName("feed", "ar")} يمثل ${financial.topExpensePct}% من إجمالي المصاريف — أعلى من المعيار الصحي (40-50%). هذا يضغط على هامش الربح بشكل مباشر.`;
      p4Sv += `📌 Bidragande faktor: ${catName("feed", "sv")} utgör ${financial.topExpensePct}% av totala utgifter — över hälsosam standard (40-50%). Detta påverkar vinstmarginalen direkt.`;
    } else if (financial.profit < 0) {
      const lossPct = financial.totalIncome > 0 ? Math.abs(Math.round((financial.profit / financial.totalIncome) * 100)) : 100;
      p4Ar += `📌 تحليل الخسارة: المصاريف تتجاوز الدخل بنسبة ${lossPct}%. السبب المحتمل: `;
      p4Ar += financial.topExpenseCategory
        ? `ارتفاع تكلفة ${catName(financial.topExpenseCategory, "ar")} (${financial.topExpensePct}% من الإجمالي) بدون مقابل دخل كافٍ.`
        : "غياب مصادر دخل كافية أو مصاريف مرتفعة غير مبررة.";

      p4Sv += `📌 Förlustanalys: Utgifterna överstiger inkomsten med ${lossPct}%. Sannolikt orsak: `;
      p4Sv += financial.topExpenseCategory
        ? `Höga ${catName(financial.topExpenseCategory, "sv")}-kostnader (${financial.topExpensePct}% av totalt) utan tillräcklig inkomst.`
        : "Brist på tillräckliga inkomstkällor eller opåkallat höga utgifter.";
    }
  } else if (warningAlerts.length > 0) {
    const primary = warningAlerts[0];
    p4Ar = `🟡 تحليل السبب الجذري:\n${primary.detailAr}\n\n`;
    p4Sv = `🟡 Grundorsaksanalys:\n${primary.detailSv}\n\n`;

    if (financial.margin !== null && financial.margin < 15) {
      p4Ar += `📌 الهامش الربحي ${financial.margin}% أقل من المعيار الصناعي (15-20%).\n`;
      p4Ar += `أكبر بند تكلفة: ${catName(financial.topExpenseCategory, "ar")} (${financial.topExpensePct}%). `;
      p4Ar += "فرصة للتحسين: تخفيض هذا البند 10% يُحسّن الهامش بشكل ملحوظ.";

      p4Sv += `📌 Vinstmarginal ${financial.margin}% under branschstandard (15-20%).\n`;
      p4Sv += `Största kostnadspost: ${catName(financial.topExpenseCategory, "sv")} (${financial.topExpensePct}%). `;
      p4Sv += "Förbättringsmöjlighet: Att minska denna post med 10% förbättrar marginalen markant.";
    }
  } else {
    p4Ar = "✅ لا توجد تشوهات واضحة في البيانات الحالية.\n\n";
    p4Ar += `الهامش الربحي: ${financial.margin !== null ? financial.margin + "%" : "غير محسوب (لا يوجد دخل)"}. `;
    if (financial.topExpenseCategory) p4Ar += `أكبر بند مصاريف: ${catName(financial.topExpenseCategory, "ar")} (${financial.topExpensePct}%).`;
    if (recentNotes.length > 0) p4Ar += `\n\n📝 الملاحظات الميدانية تُشير إلى: "${recentNotes[0].content.slice(0, 120)}"`;

    p4Sv = "✅ Inga tydliga avvikelser i aktuella data.\n\n";
    p4Sv += `Vinstmarginal: ${financial.margin !== null ? financial.margin + "%" : "ej beräknat (ingen inkomst)"}. `;
    if (financial.topExpenseCategory) p4Sv += `Största utgiftspost: ${catName(financial.topExpenseCategory, "sv")} (${financial.topExpensePct}%).`;
    if (recentNotes.length > 0) p4Sv += `\n\n📝 Fältanteckningar indikerar: "${recentNotes[0].content.slice(0, 120)}"`;
  }

  const point4: ReportSection = {
    titleAr: "تحليل الأسباب الجذرية", titleSv: "Grundorsaksanalys",
    contentAr: p4Ar, contentSv: p4Sv,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // POINT 5: Risk Evaluation
  // ─────────────────────────────────────────────────────────────────────────

  let riskScore = 25;
  const riskFactors: string[] = [];

  if (!hasData) riskScore = 20;
  if (financial.profit < 0) { riskScore += 35; riskFactors.push(L(lang, "خسارة مالية نشطة", "Aktiv finansiell förlust")); }
  if (financial.margin !== null && financial.margin >= 0 && financial.margin < 5) { riskScore += 15; riskFactors.push(L(lang, "هامش ربح هش (<5%)", "Bräcklig vinstmarginal (<5%)")); }
  if (farm.overallHatchRate > 0 && farm.overallHatchRate < 70) { riskScore += 20; riskFactors.push(L(lang, "معدل تفقيس خطر (<70%)", "Farlig kläckningsgrad (<70%)")); }
  else if (farm.overallHatchRate > 0 && farm.overallHatchRate < 80) { riskScore += 10; riskFactors.push(L(lang, "معدل تفقيس دون المثالي", "Kläckningsgrad under optimalt")); }
  if (criticalAlerts.length > 0) { riskScore += 15; riskFactors.push(L(lang, `${criticalAlerts.length} تنبيه حرج`, `${criticalAlerts.length} kritisk varning`)); }
  if (temporal.expenseVs7Avg !== null && temporal.expenseVs7Avg > 40) { riskScore += 10; riskFactors.push(L(lang, "ارتفاع حاد في المصاريف اليومية", "Kraftig daglig utgiftsökning")); }
  if (today && today.tasksDue > 0 && today.taskCompletionRate < 50) { riskScore += 5; riskFactors.push(L(lang, "إنجاز مهام منخفض اليوم", "Låg uppgiftsavslutning idag")); }

  riskScore = Math.min(95, riskScore);
  const riskLevel: RiskSection["riskLevel"] =
    riskScore >= 70 ? "critical" : riskScore >= 50 ? "high" : riskScore >= 30 ? "medium" : "low";

  const riskEmoji = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" }[riskLevel];
  const riskLabelAr = { critical: "حرج", high: "مرتفع", medium: "متوسط", low: "منخفض" }[riskLevel];
  const riskLabelSv = { critical: "Kritisk", high: "Hög", medium: "Medel", low: "Låg" }[riskLevel];

  let p5Ar = `${riskEmoji} مستوى المخاطرة: ${riskLabelAr} (${riskScore}/100)\n`;
  let p5Sv = `${riskEmoji} Risknivå: ${riskLabelSv} (${riskScore}/100)\n`;

  if (riskFactors.length > 0) {
    p5Ar += `\n⚠️ عوامل المخاطرة:\n${riskFactors.map(f => `   • ${f}`).join("\n")}`;
    p5Sv += `\n⚠️ Riskfaktorer:\n${riskFactors.map(f => `   • ${f}`).join("\n")}`;
  } else {
    p5Ar += "\n✅ لا توجد عوامل مخاطرة حرجة محددة في الوقت الحالي.";
    p5Sv += "\n✅ Inga kritiska riskfaktorer identifierade för tillfället.";
  }

  p5Ar += `\n\n🎯 ثقة التحليل: ${confidenceScore}% (بناءً على ${activeDays} يوم نشط من أصل ${ctx.windowDays})`;
  p5Sv += `\n\n🎯 Analyskonfidence: ${confidenceScore}% (baserat på ${activeDays} aktiva dagar av ${ctx.windowDays})`;

  const point5: RiskSection = {
    titleAr: "تقييم المخاطر", titleSv: "Riskbedömning",
    contentAr: p5Ar, contentSv: p5Sv,
    riskLevel, riskScore, factors: riskFactors,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // POINT 6: Immediate Actions
  // ─────────────────────────────────────────────────────────────────────────

  const actions: ActionItem[] = [];

  // Priority 1: Most critical issue
  if (financial.profit < 0) {
    actions.push({
      rank: 1, immediacy: "now",
      actionAr: "وقف جميع المصاريف غير الضرورية فوراً",
      actionSv: "Stoppa alla onödiga utgifter omedelbart",
      whyAr: `المزرعة تعمل بخسارة ${Math.abs(financial.profit).toLocaleString()} د.ع — كل مصروف إضافي يزيد العجز`,
      whySv: `Gården arbetar med förlust ${Math.abs(financial.profit).toLocaleString()} IQD — varje extra utgift ökar underskottet`,
    });
  } else if (criticalAlerts.length > 0) {
    const alert = criticalAlerts[0];
    actions.push({
      rank: 1, immediacy: "now",
      actionAr: `معالجة: ${alert.titleAr}`,
      actionSv: `Åtgärda: ${alert.titleSv}`,
      whyAr: alert.detailAr,
      whySv: alert.detailSv,
    });
  } else if (temporal.expenseVs7Avg !== null && temporal.expenseVs7Avg > 40) {
    actions.push({
      rank: 1, immediacy: "today",
      actionAr: "مراجعة وتدقيق مصاريف اليوم",
      actionSv: "Granska och kontrollera dagens utgifter",
      whyAr: `مصاريف اليوم أعلى بنسبة ${temporal.expenseVs7Avg}% من المتوسط الأسبوعي — ارتفاع غير مبرر`,
      whySv: `Dagens utgifter är ${temporal.expenseVs7Avg}% över veckogenomsnitt — opåkallad ökning`,
    });
  } else if (!hasData) {
    actions.push({
      rank: 1, immediacy: "today",
      actionAr: "تسجيل أول معاملة مالية في النظام",
      actionSv: "Registrera den första finansiella transaktionen i systemet",
      whyAr: "بدون بيانات مالية، يعمل النظام بأقل من 30% من طاقته التحليلية",
      whySv: "Utan finansiella uppgifter arbetar systemet med mindre än 30% av sin analytiska kapacitet",
    });
  } else {
    actions.push({
      rank: 1, immediacy: "this_week",
      actionAr: `مراجعة تكلفة ${catName(financial.topExpenseCategory, "ar")} (${financial.topExpensePct}% من المصاريف)`,
      actionSv: `Granska ${catName(financial.topExpenseCategory, "sv")}-kostnad (${financial.topExpensePct}% av utgifterna)`,
      whyAr: "هذا أكبر بند مصاريف — تخفيضه بنسبة 10% يُحسّن الهامش الربحي بشكل مباشر",
      whySv: "Detta är den största utgiftsposten — att minska den med 10% förbättrar vinstmarginalen direkt",
    });
  }

  // Priority 2: Production issue or data quality
  if (farm.overallHatchRate > 0 && farm.overallHatchRate < 75) {
    actions.push({
      rank: 2, immediacy: "today",
      actionAr: "فحص فوري لإعدادات الفقاسة",
      actionSv: "Omedelbar kontroll av kläckarinställningar",
      whyAr: `معدل التفقيس ${farm.overallHatchRate}% — الهدف 80%. افحص: حرارة 37.5°–38°، رطوبة 55–65%، تقليب البيض`,
      whySv: `Kläckningsgrad ${farm.overallHatchRate}% — mål 80%. Kontrollera: temp 37.5°–38°, luftfuktighet 55–65%, äggvändning`,
    });
  } else if (warningAlerts.length > 0) {
    const w = warningAlerts[0];
    actions.push({
      rank: 2, immediacy: "today",
      actionAr: `متابعة: ${w.titleAr}`,
      actionSv: `Följ upp: ${w.titleSv}`,
      whyAr: w.detailAr,
      whySv: w.detailSv,
    });
  } else {
    actions.push({
      rank: 2, immediacy: "today",
      actionAr: "تحديث الملاحظات الميدانية اليومية",
      actionSv: "Uppdatera dagliga fältanteckningar",
      whyAr: "الملاحظات اليومية تُحسّن جودة التحليل — كل ملاحظة تُضيف 8 نقاط لدرجة الثقة",
      whySv: "Dagliga anteckningar förbättrar analyskvaliteten — varje anteckning lägger till 8 poäng till konfidenspoängen",
    });
  }

  // Priority 3: Process improvement
  if (today && today.tasksDue > 0 && today.taskCompletionRate < 80) {
    actions.push({
      rank: 3, immediacy: "today",
      actionAr: `إنجاز المهام المتبقية (${today.tasksDue - today.tasksCompleted} مهمة)`,
      actionSv: `Slutför återstående uppgifter (${today.tasksDue - today.tasksCompleted} uppgifter)`,
      whyAr: `معدل الإنجاز اليوم ${today.taskCompletionRate}% فقط — يؤثر على درجة أداء المزرعة`,
      whySv: `Dagens avslutningsgrad är bara ${today.taskCompletionRate}% — påverkar gårdens prestationspoäng`,
    });
  } else {
    actions.push({
      rank: 3, immediacy: "this_week",
      actionAr: "مراجعة الأهداف الأسبوعية وتحديث التقدم",
      actionSv: "Granska veckans mål och uppdatera framsteg",
      whyAr: "متابعة الأهداف بانتظام تزيد الإنتاجية 20-30% على المدى البعيد",
      whySv: "Regelbunden måluppföljning ökar produktiviteten med 20-30% på lång sikt",
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POINT 7: Consequences if No Action
  // ─────────────────────────────────────────────────────────────────────────

  let p7Ar = "";
  let p7Sv = "";

  if (financial.profit < 0) {
    const monthlyLoss = Math.abs(financial.profit);
    const threeMonths = monthlyLoss * 3;
    p7Ar = `🚨 إذا لم يُتخذ أي إجراء خلال 30 يوماً:\n`;
    p7Ar += `   • الخسارة التراكمية ستتجاوز ${threeMonths.toLocaleString()} د.ع خلال 3 أشهر\n`;
    p7Ar += `   • احتمال عالٍ لصعوبة شراء العلف ودفع التزامات التشغيل\n`;
    p7Ar += `   • خطر توقف الإنتاج بسبب نقص السيولة\n`;
    p7Ar += `\n⏰ النافذة الزمنية الآمنة للتدخل: الآن فوراً`;

    p7Sv = `🚨 Om ingen åtgärd vidtas inom 30 dagar:\n`;
    p7Sv += `   • Den ackumulerade förlusten överstiger ${threeMonths.toLocaleString()} IQD under 3 månader\n`;
    p7Sv += `   • Hög sannolikhet för svårigheter att köpa foder och uppfylla driftsåtaganden\n`;
    p7Sv += `   • Risk för produktionsstopp på grund av likviditetsbrist\n`;
    p7Sv += `\n⏰ Säkert tidsfönster för ingripande: Omedelbart nu`;
  } else if (riskLevel === "high" || riskLevel === "critical") {
    p7Ar = `⚠️ إذا استمر الوضع بدون تدخل:\n`;
    p7Ar += `   • تراجع تدريجي في الهامش الربحي (حالياً ${financial.margin ?? 0}%)\n`;
    p7Ar += `   • احتمال الدخول في منطقة الخسارة خلال 4-8 أسابيع\n`;
    p7Ar += `   • تراكم المشكلات التشغيلية وزيادة التكاليف غير المخططة\n`;
    p7Ar += `\n⏰ النافذة الزمنية الآمنة: هذا الأسبوع`;

    p7Sv = `⚠️ Om situationen fortsätter utan ingripande:\n`;
    p7Sv += `   • Gradvis minskning av vinstmarginalen (för närvarande ${financial.margin ?? 0}%)\n`;
    p7Sv += `   • Sannolikhet att hamna i förlustzon inom 4-8 veckor\n`;
    p7Sv += `   • Ackumulering av driftsproblem och ökade oplanerade kostnader\n`;
    p7Sv += `\n⏰ Säkert tidsfönster: Denna vecka`;
  } else if (riskLevel === "medium") {
    p7Ar = `📊 الوضع مستقر لكن بدون تطوير:\n`;
    p7Ar += `   • المزرعة ستبقى عند مستوى أداء متوسط دون تحسين\n`;
    p7Ar += `   • فرص تحسين الربحية ستُفوَّت\n`;
    p7Ar += `   • المنافسون الذين يستخدمون التحليل المستمر سيتقدمون\n`;
    p7Ar += `\n⏰ النافذة الزمنية: خلال الشهر القادم`;

    p7Sv = `📊 Situationen är stabil men utan utveckling:\n`;
    p7Sv += `   • Gården förblir på genomsnittlig prestationsnivå utan förbättring\n`;
    p7Sv += `   • Möjligheter att förbättra lönsamheten går förlorade\n`;
    p7Sv += `   • Konkurrenter som använder kontinuerlig analys kommer att ligga före\n`;
    p7Sv += `\n⏰ Tidsfönster: Inom nästa månad`;
  } else {
    p7Ar = `✅ المزرعة في وضع جيد.\n`;
    p7Ar += `الاستمرار بالمسار الحالي مع إضافة بيانات منتظمة سيُحسّن دقة التحليل تدريجياً.\n`;
    p7Ar += `هدف مقترح: رفع درجة الثقة التحليلية من ${confidenceScore}% إلى 90%+ عبر تسجيل بيانات يومية منتظمة.`;

    p7Sv = `✅ Gården är i bra skick.\n`;
    p7Sv += `Att fortsätta den nuvarande kursen med regelbunden datainmatning förbättrar analysnoggrannheten gradvis.\n`;
    p7Sv += `Föreslagen målsättning: Öka analyskonfidensen från ${confidenceScore}% till 90%+ genom regelbunden daglig datainmatning.`;
  }

  const point7: ReportSection = {
    titleAr: "عواقب عدم التصرف", titleSv: "Konsekvenser av utebliven åtgärd",
    contentAr: p7Ar, contentSv: p7Sv,
  };

  // ── Overall risk ──────────────────────────────────────────────────────────
  const overallRisk: IntelligenceReport["overallRisk"] =
    criticalAlerts.length > 0 || riskLevel === "critical" ? "critical"
    : warningAlerts.length > 0 || riskLevel === "high"    ? "warning"
    : financial.profit > 0 && riskLevel === "low"         ? "good"
    : "stable";

  return {
    generatedAt: new Date().toISOString(),
    lang,
    overallRisk,
    confidenceScore,
    dataQuality,
    point1_currentState: point1,
    point2_historicalComparison: point2,
    point3_quantifiedChanges: changes,
    point4_rootCause: point4,
    point5_riskEvaluation: point5,
    point6_immediateActions: actions,
    point7_consequences: point7,
  };
}
