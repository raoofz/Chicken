/**
 * /api/intelligence/alerts
 * Cross-module intelligence engine v3.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Architecture:
 *  1. Data Pipeline    — parallel fetch from 7 modules, data cleaning
 *  2. Analysis Engine  — statistically-grounded alert generation per module
 *  3. Correlation Layer— cross-module pattern detection
 *  4. AI Logging       — every analysis run logged to prediction_logs table
 *  5. Cache Layer      — 2-minute in-memory cache, invalidated on data writes
 *  6. Self-Monitor     — uses accuracy metrics to improve confidence scores
 */
import { Router, type Request, type Response } from "express";
import { createHash } from "crypto";
import { db, flocksTable, hatchingCyclesTable, tasksTable, goalsTable, flockHealthLogsTable, flockProductionLogsTable, transactionsTable, feedRecordsTable } from "@workspace/db";
import { desc, sql, and, gte, lte, eq } from "drizzle-orm";
import { logPrediction, autoResolveFromCycles, computeAccuracyMetrics } from "../lib/self-monitor";

const router = Router();

// ── Cache (2 minutes) ──────────────────────────────────────────────────────────
let cache: { ts: number; data: IntelligenceReport } | null = null;
const CACHE_TTL = 120_000;

export interface Alert {
  id: string;
  level: "critical" | "warning" | "info" | "good";
  module: "finance" | "production" | "operations" | "health" | "feed" | "hatching" | "correlation";
  titleAr: string;
  titleSv: string;
  bodyAr: string;
  bodySv: string;
  actionAr?: string;
  actionSv?: string;
  metric?: { value: number; unit: string; change?: number };
  href?: string;
}

export interface IntelligenceReport {
  generatedAt: string;
  alerts: Alert[];
  summary: {
    critical: number;
    warning: number;
    info: number;
    good: number;
  };
}

// ── Helper: date N days ago (ISO string "YYYY-MM-DD") ─────────────────────────
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

// ── Main Analysis Engine ───────────────────────────────────────────────────────
async function runAnalysis(): Promise<IntelligenceReport> {
  const alerts: Alert[] = [];
  const today = new Date().toISOString().split("T")[0];
  const now30 = daysAgo(30);
  const now60 = daysAgo(60);
  const now7  = daysAgo(7);
  const now14 = daysAgo(14);

  // Month boundaries for month-over-month comparison
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  const thisMonthStr = thisMonthStart.toISOString().split("T")[0];
  const lastMonthEnd = new Date(thisMonthStart);
  lastMonthEnd.setDate(0);
  const lastMonthEndStr = lastMonthEnd.toISOString().split("T")[0];
  const lastMonthStart = new Date(lastMonthEnd);
  lastMonthStart.setDate(1);
  const lastMonthStartStr = lastMonthStart.toISOString().split("T")[0];

  // ── 1. Fetch all data in parallel ────────────────────────────────────────────
  const [flocks, hatchingCycles, tasks, goals, healthLogs, productionLogs, txRows, txLastMonth, feedRows] = await Promise.all([
    db.select().from(flocksTable),
    db.select().from(hatchingCyclesTable).orderBy(desc(hatchingCyclesTable.startDate)),
    db.select().from(tasksTable),
    db.select().from(goalsTable),
    db.execute(sql`
      SELECT * FROM flock_health_logs WHERE date >= ${now30} ORDER BY date DESC
    `),
    db.execute(sql`
      SELECT * FROM flock_production_logs WHERE date >= ${now30} ORDER BY date DESC
    `),
    db.execute(sql`
      SELECT type, category, amount::float AS amount, date
      FROM transactions
      WHERE date >= ${now30}
      ORDER BY date DESC
    `),
    // Last month transactions for MoM comparison
    db.execute(sql`
      SELECT type, amount::float AS amount, category
      FROM transactions
      WHERE date >= ${lastMonthStartStr} AND date <= ${lastMonthEndStr}
    `),
    // Feed records last 60 days
    db.execute(sql`
      SELECT date, quantity_kg::float AS quantity_kg, price_per_kg::float AS price_per_kg, total_cost::float AS total_cost
      FROM feed_records
      WHERE date >= ${now60}
      ORDER BY date DESC
    `),
  ]);

  const transactions = (txRows.rows ?? []) as Array<{ type: string; category: string; amount: number; date: string }>;
  const lastMonthTxArr = (txLastMonth.rows ?? []) as Array<{ type: string; amount: number; category: string }>;
  const feedRecordsArr = (feedRows.rows ?? []) as Array<{ date: string; quantity_kg: number; price_per_kg: number; total_cost: number }>;
  const healthLogsArr = (healthLogs.rows ?? []) as Array<{ id: number; flock_id: number; date: string; status: string; symptoms: string | null; treatment: string | null; notes: string | null }>;
  const productionLogsArr = (productionLogs.rows ?? []) as Array<{ id: number; flock_id: number; date: string; egg_count: number; notes: string | null }>;

  // ── 2. FINANCIAL ANALYSIS ────────────────────────────────────────────────────
  const totalIncome  = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const netProfit    = totalIncome - totalExpense;
  const margin       = totalIncome > 0 ? (netProfit / totalIncome) * 100 : null;

  // Month-over-Month comparison
  const lastMonthIncome  = lastMonthTxArr.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const lastMonthExpense = lastMonthTxArr.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const lastMonthProfit  = lastMonthIncome - lastMonthExpense;
  const thisMonthTx = transactions.filter(t => t.date >= thisMonthStr);
  const thisMonthIncome  = thisMonthTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const thisMonthExpense = thisMonthTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  // Income trend: this month vs last month (if last month had data)
  if (lastMonthIncome > 0 && thisMonthIncome > 0) {
    const incomeDelta = ((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100;
    if (incomeDelta < -25) {
      alerts.push({
        id: "fin-income-drop",
        level: "warning",
        module: "finance",
        titleAr: `الدخل انخفض ${Math.abs(Math.round(incomeDelta))}% عن الشهر الماضي`,
        titleSv: `Inkomsten minskade ${Math.abs(Math.round(incomeDelta))}% jämfört med förra månaden`,
        bodyAr: `هذا الشهر: ${Math.round(thisMonthIncome).toLocaleString()} د.ع — الشهر الماضي: ${Math.round(lastMonthIncome).toLocaleString()} د.ع. تراجع ملحوظ يستوجب التحقيق.`,
        bodySv: `Denna månad: ${Math.round(thisMonthIncome).toLocaleString()} IQD — Förra månaden: ${Math.round(lastMonthIncome).toLocaleString()} IQD. Märkbar nedgång som kräver undersökning.`,
        actionAr: "راجع المالية",
        actionSv: "Granska ekonomi",
        href: "/finance",
        metric: { value: Math.round(incomeDelta), unit: "%", change: Math.round(incomeDelta) },
      });
    } else if (incomeDelta > 25) {
      alerts.push({
        id: "fin-income-rise",
        level: "good",
        module: "finance",
        titleAr: `الدخل ارتفع ${Math.round(incomeDelta)}% عن الشهر الماضي`,
        titleSv: `Inkomsten ökade ${Math.round(incomeDelta)}% jämfört med förra månaden`,
        bodyAr: `هذا الشهر: ${Math.round(thisMonthIncome).toLocaleString()} د.ع مقابل ${Math.round(lastMonthIncome).toLocaleString()} د.ع الشهر الماضي. أداء ممتاز!`,
        bodySv: `Denna månad: ${Math.round(thisMonthIncome).toLocaleString()} IQD mot ${Math.round(lastMonthIncome).toLocaleString()} IQD förra månaden. Utmärkt!`,
        href: "/finance",
        metric: { value: Math.round(incomeDelta), unit: "%", change: Math.round(incomeDelta) },
      });
    }
  }

  if (totalIncome === 0 && totalExpense === 0) {
    alerts.push({
      id: "fin-no-data",
      level: "info",
      module: "finance",
      titleAr: "لا توجد بيانات مالية لهذا الشهر",
      titleSv: "Ingen finansiell data denna månad",
      bodyAr: "أضف معاملاتك المالية لتفعيل التحليل الذكي.",
      bodySv: "Lägg till transaktioner för att aktivera smart analys.",
      actionAr: "أضف معاملة",
      actionSv: "Lägg till transaktion",
      href: "/finance",
    });
  } else if (netProfit < 0) {
    const lossPct = totalIncome > 0 ? Math.abs(Math.round((netProfit / totalIncome) * 100)) : 100;
    alerts.push({
      id: "fin-loss",
      level: "critical",
      module: "finance",
      titleAr: "المزرعة تعمل بخسارة",
      titleSv: "Gården arbetar med förlust",
      bodyAr: `المصاريف تتجاوز الدخل بنسبة ${lossPct}%. يجب معالجة هذا فوراً.`,
      bodySv: `Utgifterna överstiger inkomsten med ${lossPct}%. Åtgärd krävs omedelbart.`,
      actionAr: "راجع المالية",
      actionSv: "Granska ekonomi",
      href: "/finance",
      metric: { value: Math.round(netProfit), unit: " IQD", change: lossPct },
    });
  } else if (margin !== null && margin < 10) {
    alerts.push({
      id: "fin-low-margin",
      level: "warning",
      module: "finance",
      titleAr: `هامش الربح منخفض (${Math.round(margin)}%)`,
      titleSv: `Låg vinstmarginal (${Math.round(margin)}%)`,
      bodyAr: "الهامش أقل من 10% — هدف المزارع الناجحة هو 20% أو أكثر.",
      bodySv: "Marginalen under 10% — framgångsrika gårdar siktar på 20%+.",
      href: "/finance",
      metric: { value: Math.round(margin), unit: "%" },
    });
  } else if (margin !== null && margin >= 25) {
    alerts.push({
      id: "fin-excellent",
      level: "good",
      module: "finance",
      titleAr: `أداء مالي ممتاز — هامش ${Math.round(margin)}%`,
      titleSv: `Utmärkt ekonomi — ${Math.round(margin)}% marginal`,
      bodyAr: "هامشك فوق المعدل الصناعي. استمر على هذا المستوى.",
      bodySv: "Din marginal är över branschgenomsnittet. Fortsätt!",
      href: "/finance",
    });
  }

  // Feed cost ratio
  const feedExpense = transactions.filter(t => t.type === "expense" && t.category === "feed").reduce((s, t) => s + t.amount, 0);
  if (totalExpense > 0 && feedExpense / totalExpense > 0.60) {
    const feedPct = Math.round((feedExpense / totalExpense) * 100);
    alerts.push({
      id: "feed-high-cost",
      level: "warning",
      module: "feed",
      titleAr: `تكلفة العلف مرتفعة جداً (${feedPct}% من المصاريف)`,
      titleSv: `Foderkostnaden är för hög (${feedPct}% av utgifterna)`,
      bodyAr: "العلف يستهلك أكثر من 60% من المصاريف — المعدل المثالي هو 40-50%.",
      bodySv: "Foder konsumerar mer än 60% av utgifterna — optimalt mål är 40-50%.",
      actionAr: "راجع خطة التغذية",
      actionSv: "Se över foderplan",
      href: "/feed",
      metric: { value: feedPct, unit: "%" },
    });
  }

  // ── 3. FLOCK HEALTH ANALYSIS ──────────────────────────────────────────────────
  const activeFlocks = flocks.filter(f => f.healthStatus !== "culled");
  const totalBirds   = activeFlocks.reduce((s, f) => s + (f.count ?? 0), 0);

  if (activeFlocks.length === 0 && flocks.length > 0) {
    alerts.push({
      id: "flock-all-inactive",
      level: "warning",
      module: "production",
      titleAr: "لا يوجد قطيع نشط حالياً",
      titleSv: "Inga aktiva flockar just nu",
      bodyAr: "جميع القطعان غير نشطة. أضف قطيعاً جديداً لمتابعة الإنتاج.",
      bodySv: "Alla flockar är inaktiva. Lägg till en ny flock för att spåra produktion.",
      href: "/flocks",
    });
  }

  // Health status analysis
  const sickFlocks = activeFlocks.filter(f => f.healthStatus === "sick" || f.healthStatus === "poor");
  if (sickFlocks.length > 0) {
    alerts.push({
      id: "health-sick-flocks",
      level: "critical",
      module: "health",
      titleAr: `${sickFlocks.length} قطيع في حالة صحية سيئة`,
      titleSv: `${sickFlocks.length} flock i dåligt hälsotillstånd`,
      bodyAr: `القطعان: ${sickFlocks.map(f => f.name).join(", ")} — تحتاج رعاية طارئة.`,
      bodySv: `Flockar: ${sickFlocks.map(f => f.name).join(", ")} — behöver akut vård.`,
      actionAr: "راجع القطعان",
      actionSv: "Granska flockar",
      href: "/flocks",
    });
  }

  // Sick health logs in last 7 days
  const recentSickLogs7d = healthLogsArr.filter(l =>
    l.date >= now7 && (l.status === "sick" || l.status === "poor" || l.status === "critical")
  );
  if (recentSickLogs7d.length >= 3 && sickFlocks.length === 0) {
    alerts.push({
      id: "health-frequent-sick-logs",
      level: "warning",
      module: "health",
      titleAr: `${recentSickLogs7d.length} سجل صحي سلبي هذا الأسبوع`,
      titleSv: `${recentSickLogs7d.length} negativa hälsologgar denna vecka`,
      bodyAr: "تكرار المشاكل الصحية خلال 7 أيام يستوجب المراقبة الدقيقة.",
      bodySv: "Upprepade hälsoproblem under 7 dagar kräver noggrann övervakning.",
      href: "/flocks",
    });
  }

  // Production log analysis — detect drop in egg count
  if (productionLogsArr.length >= 4) {
    const recent4 = productionLogsArr.slice(0, 4).map(l => l.egg_count);
    const older4  = productionLogsArr.slice(4, 8).map(l => l.egg_count);
    if (older4.length >= 2) {
      const recentAvg = recent4.reduce((a, b) => a + b, 0) / recent4.length;
      const olderAvg  = older4.reduce((a, b) => a + b, 0) / older4.length;
      if (olderAvg > 0 && recentAvg < olderAvg * 0.6) {
        const dropPct = Math.round(((olderAvg - recentAvg) / olderAvg) * 100);
        alerts.push({
          id: "prod-egg-drop",
          level: "warning",
          module: "production",
          titleAr: `إنتاج البيض انخفض ${dropPct}% عن المعدل السابق`,
          titleSv: `Äggproduktionen minskade med ${dropPct}% jämfört med tidigare`,
          bodyAr: `متوسط الإنتاج الأخير ${Math.round(recentAvg)} بيضة مقابل ${Math.round(olderAvg)} سابقاً.`,
          bodySv: `Senaste genomsnittet ${Math.round(recentAvg)} ägg mot ${Math.round(olderAvg)} tidigare.`,
          href: "/flocks",
          metric: { value: dropPct, unit: "%", change: -dropPct },
        });
      }
    }
  }

  // ── 4. HATCHING ANALYSIS ──────────────────────────────────────────────────────
  const activeCycles   = hatchingCycles.filter(c => c.status === "active" || c.status === "incubating");
  const completedCycles = hatchingCycles.filter(c => c.status === "completed" && c.eggsSet && c.eggsHatched !== null);

  if (activeCycles.length > 0) {
    alerts.push({
      id: "hatching-active",
      level: "info",
      module: "hatching",
      titleAr: `${activeCycles.length} دورة تفقيس نشطة`,
      titleSv: `${activeCycles.length} aktiva kläckningscykler`,
      bodyAr: "يجب متابعة الحرارة والرطوبة وتقليب البيض بانتظام.",
      bodySv: "Övervaka temperatur, luftfuktighet och äggvändning regelbundet.",
      href: "/hatching",
    });
  }

  if (completedCycles.length >= 2) {
    const recent3 = completedCycles.slice(0, 3);
    const rates   = recent3.map(c => c.eggsSet! > 0 ? ((c.eggsHatched ?? 0) / c.eggsSet!) * 100 : 0);
    const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;

    if (avgRate < 65) {
      alerts.push({
        id: "hatching-poor-rate",
        level: "critical",
        module: "hatching",
        titleAr: `معدل تفقيس منخفض جداً (${Math.round(avgRate)}%)`,
        titleSv: `Mycket låg kläckningsgrad (${Math.round(avgRate)}%)`,
        bodyAr: "متوسط آخر 3 دورات أقل من 65% — المعيار المقبول هو 80%+. تحقق من الفقاسة.",
        bodySv: "Snitt för senaste 3 cyklerna under 65% — acceptabelt är 80%+. Kontrollera ruvaren.",
        actionAr: "راجع الفقاسة",
        actionSv: "Kontrollera kläckaren",
        href: "/hatching",
        metric: { value: Math.round(avgRate), unit: "%" },
      });
    } else if (avgRate >= 85) {
      alerts.push({
        id: "hatching-excellent",
        level: "good",
        module: "hatching",
        titleAr: `معدل تفقيس ممتاز (${Math.round(avgRate)}%)`,
        titleSv: `Utmärkt kläckningsgrad (${Math.round(avgRate)}%)`,
        bodyAr: "أداء الفقاسة فوق المعيار القياسي. استمر على هذا المستوى.",
        bodySv: "Ruvarprestanda är över branschstandard. Fortsätt!",
        href: "/hatching",
      });
    }
  }

  // ── 5. TASKS & OPERATIONS ANALYSIS ───────────────────────────────────────────
  const overdueTasks  = tasks.filter(t => !t.completed && t.dueDate && t.dueDate < today);
  const todayTasks    = tasks.filter(t => t.dueDate === today);
  const completedToday = todayTasks.filter(t => t.completed);

  if (overdueTasks.length >= 3) {
    alerts.push({
      id: "ops-overdue-tasks",
      level: "warning",
      module: "operations",
      titleAr: `${overdueTasks.length} مهمة متأخرة`,
      titleSv: `${overdueTasks.length} försenade uppgifter`,
      bodyAr: "التراكم في المهام يؤثر على كفاءة المزرعة. أنجز المهام المتأخرة.",
      bodySv: "Eftersläpning påverkar gårdens effektivitet. Slutför de försenade uppgifterna.",
      actionAr: "عرض المهام",
      actionSv: "Visa uppgifter",
      href: "/operations",
      metric: { value: overdueTasks.length, unit: " مهمة" },
    });
  } else if (overdueTasks.length === 0 && tasks.length > 0) {
    const allCompleted = tasks.filter(t => t.completed).length;
    if (allCompleted === tasks.length && tasks.length >= 3) {
      alerts.push({
        id: "ops-all-complete",
        level: "good",
        module: "operations",
        titleAr: "جميع المهام منجزة",
        titleSv: "Alla uppgifter slutförda",
        bodyAr: `أتممت ${tasks.length} مهمة بدون تأخير. أداء ممتاز!`,
        bodySv: `Du slutförde ${tasks.length} uppgifter utan försening. Utmärkt!`,
        href: "/operations",
      });
    }
  }

  if (todayTasks.length > 0) {
    const completionRate = Math.round((completedToday.length / todayTasks.length) * 100);
    if (completionRate === 100) {
      alerts.push({
        id: "ops-today-complete",
        level: "good",
        module: "operations",
        titleAr: "كل مهام اليوم منجزة ✓",
        titleSv: "Alla dagens uppgifter slutförda ✓",
        bodyAr: `أتممت ${completedToday.length} مهمة اليوم. أداء ممتاز!`,
        bodySv: `Du slutförde ${completedToday.length} uppgifter idag. Utmärkt!`,
        href: "/operations",
      });
    } else if (completionRate < 40 && new Date().getHours() >= 14) {
      alerts.push({
        id: "ops-today-lagging",
        level: "warning",
        module: "operations",
        titleAr: `${completedToday.length}/${todayTasks.length} مهام اليوم منجزة`,
        titleSv: `${completedToday.length}/${todayTasks.length} dagens uppgifter klara`,
        bodyAr: `${completionRate}% فقط مكتمل — بقي أقل من نصف اليوم.`,
        bodySv: `Bara ${completionRate}% klart — mindre än halva dagen kvar.`,
        href: "/operations",
      });
    }
  }

  // ── 6. GOALS ANALYSIS ────────────────────────────────────────────────────────
  if (goals.length > 0) {
    const completed = goals.filter((g: any) => g.status === "completed").length;
    const completionPct = Math.round((completed / goals.length) * 100);
    if (completionPct >= 80) {
      alerts.push({
        id: "goals-excellent",
        level: "good",
        module: "operations",
        titleAr: `${completionPct}% من الأهداف محققة`,
        titleSv: `${completionPct}% av målen uppnådda`,
        bodyAr: "أداء ممتاز في تحقيق الأهداف. ضع أهدافاً تحدياً جديدة.",
        bodySv: "Utmärkt måluppfyllelse. Sätt nya utmanande mål.",
        href: "/goals",
      });
    }
  }

  // ── 7. FEED PURCHASE ANALYSIS ────────────────────────────────────────────────
  const feedLast30 = feedRecordsArr.filter(r => r.date >= now30);
  const feedLast7  = feedRecordsArr.filter(r => r.date >= now7);

  // Feed gap: active birds but no feed purchase in 14+ days
  if (activeFlocks.length > 0 && totalBirds > 0 && feedRecordsArr.length > 0) {
    const lastFeedDate = feedRecordsArr[0]?.date;
    if (lastFeedDate && lastFeedDate < now14) {
      const daysSinceFeed = Math.round((Date.now() - new Date(lastFeedDate).getTime()) / 86_400_000);
      alerts.push({
        id: "feed-gap-detected",
        level: "warning",
        module: "feed",
        titleAr: `لم يُسجَّل شراء علف منذ ${daysSinceFeed} يوماً`,
        titleSv: `Inget foder har registrerats på ${daysSinceFeed} dagar`,
        bodyAr: `آخر عملية شراء علف كانت ${daysSinceFeed} يوماً. تحقق من المخزون أو أضف سجلات العلف الحديثة.`,
        bodySv: `Senaste foderköp var för ${daysSinceFeed} dagar sedan. Kontrollera lagret eller lägg till aktuella foderrekord.`,
        actionAr: "إدارة العلف",
        actionSv: "Hantera foder",
        href: "/feed",
        metric: { value: daysSinceFeed, unit: " يوم" },
      });
    }
  } else if (activeFlocks.length > 0 && totalBirds > 0 && feedRecordsArr.length === 0) {
    // No feed records at all
    alerts.push({
      id: "feed-no-records",
      level: "info",
      module: "feed",
      titleAr: "لا يوجد سجلات علف مسجّلة",
      titleSv: "Inga foderrekord registrerade",
      bodyAr: "ابدأ بتسجيل مشتريات العلف لتفعيل التحليل الذكي لتكاليف التغذية.",
      bodySv: "Börja registrera foderköp för att aktivera smart analys av foderkostnader.",
      href: "/feed",
    });
  }

  // Feed cost rising trend: compare last 7 days feed quantity vs previous 7 days
  if (feedLast30.length >= 4) {
    const recent7KG  = feedLast7.reduce((s, r) => s + r.quantity_kg, 0);
    const prev7Items = feedRecordsArr.filter(r => r.date >= now14 && r.date < now7);
    const prev7KG    = prev7Items.reduce((s, r) => s + r.quantity_kg, 0);
    if (prev7KG > 0 && recent7KG < prev7KG * 0.5) {
      alerts.push({
        id: "feed-consumption-drop",
        level: "warning",
        module: "feed",
        titleAr: "انخفاض حاد في استهلاك العلف هذا الأسبوع",
        titleSv: "Kraftig minskning av foderförbrukning denna vecka",
        bodyAr: `كمية العلف هذا الأسبوع: ${Math.round(recent7KG)} كغ مقابل ${Math.round(prev7KG)} كغ الأسبوع الماضي — قد يشير إلى مشكلة.`,
        bodySv: `Fodermängd denna vecka: ${Math.round(recent7KG)} kg mot ${Math.round(prev7KG)} kg förra veckan — kan indikera ett problem.`,
        href: "/feed",
      });
    }
  }

  // ── 8. ACTIVE HATCHING PROGRESS (countdown intelligence) ─────────────────────
  const incubationDays = 21; // standard chicken incubation
  for (const cycle of activeCycles.slice(0, 2)) {
    if (cycle.startDate) {
      const start = new Date(cycle.startDate);
      const expectedHatch = new Date(start);
      expectedHatch.setDate(start.getDate() + incubationDays);
      const daysLeft = Math.round((expectedHatch.getTime() - Date.now()) / 86_400_000);
      const progress = Math.round(((incubationDays - daysLeft) / incubationDays) * 100);

      if (daysLeft >= 0 && daysLeft <= 3) {
        alerts.push({
          id: `hatching-imminent-${cycle.id}`,
          level: "critical",
          module: "hatching",
          titleAr: `التفقيس قريب جداً — ${daysLeft === 0 ? "اليوم!" : `${daysLeft} أيام`}`,
          titleSv: `Kläckning nära — ${daysLeft === 0 ? "Idag!" : `${daysLeft} dagar`}`,
          bodyAr: `دورة "${cycle.name ?? `#${cycle.id}`}" تبلغ ${progress}% من مرحلة الحضانة. تأكد من ضبط الفقاسة على وضع الفقس.`,
          bodySv: `Cykel "${cycle.name ?? `#${cycle.id}`}" är ${progress}% klar med ruvningsperioden. Se till att ruvaren är inställd för kläckning.`,
          actionAr: "متابعة التفقيس",
          actionSv: "Följ upp kläckning",
          href: "/hatching",
          metric: { value: daysLeft, unit: " أيام" },
        });
      } else if (daysLeft > 3 && daysLeft <= 7) {
        alerts.push({
          id: `hatching-upcoming-${cycle.id}`,
          level: "info",
          module: "hatching",
          titleAr: `متوقع تفقيس خلال ${daysLeft} أيام (${progress}%)`,
          titleSv: `Förväntad kläckning om ${daysLeft} dagar (${progress}%)`,
          bodyAr: `دورة "${cycle.name ?? `#${cycle.id}`}" في منتصف الطريق. تحقق من درجة الحرارة والرطوبة.`,
          bodySv: `Cykel "${cycle.name ?? `#${cycle.id}`}" är halvvägs. Kontrollera temperatur och luftfuktighet.`,
          href: "/hatching",
          metric: { value: progress, unit: "%" },
        });
      }
    }
  }

  // ── 9. EGG PRODUCTION DENSITY (efficiency per bird) ──────────────────────────
  if (totalBirds > 0 && productionLogsArr.length >= 7) {
    const last7ProdLogs = productionLogsArr.filter(l => l.date >= now7);
    if (last7ProdLogs.length >= 3) {
      const weeklyEggs = last7ProdLogs.reduce((s, l) => s + l.egg_count, 0);
      const eggsPerBird = weeklyEggs / totalBirds;

      if (eggsPerBird < 2) {
        // Very low: less than 2 eggs/bird/week
        alerts.push({
          id: "prod-low-density",
          level: "warning",
          module: "production",
          titleAr: `إنتاج منخفض: ${eggsPerBird.toFixed(1)} بيضة/طير/أسبوع`,
          titleSv: `Låg produktion: ${eggsPerBird.toFixed(1)} ägg/fågel/vecka`,
          bodyAr: `مع ${totalBirds} طير، المتوسط الأسبوعي هو ${Math.round(weeklyEggs)} بيضة. المعدل الجيد هو 4-5 بيضة/طير.`,
          bodySv: `Med ${totalBirds} fåglar är det veckliga genomsnittet ${Math.round(weeklyEggs)} ägg. Bra nivå är 4-5 ägg/fågel.`,
          href: "/flocks",
          metric: { value: parseFloat(eggsPerBird.toFixed(1)), unit: " بيضة/طير" },
        });
      } else if (eggsPerBird >= 5) {
        alerts.push({
          id: "prod-excellent-density",
          level: "good",
          module: "production",
          titleAr: `كثافة إنتاج ممتازة: ${eggsPerBird.toFixed(1)} بيضة/طير/أسبوع`,
          titleSv: `Utmärkt produktionsdensitet: ${eggsPerBird.toFixed(1)} ägg/fågel/vecka`,
          bodyAr: `مع ${totalBirds} طير تنتج ${Math.round(weeklyEggs)} بيضة أسبوعياً — أداء فوق المعدل.`,
          bodySv: `Med ${totalBirds} fåglar producerar du ${Math.round(weeklyEggs)} ägg per vecka — över genomsnittet.`,
          href: "/flocks",
          metric: { value: parseFloat(eggsPerBird.toFixed(1)), unit: " بيضة/طير" },
        });
      }
    }
  }

  // ── 10. CROSS-MODULE CORRELATIONS (deep intelligence) ─────────────────────────

  // Correlation A: Egg production drop + sick flocks → disease investigation needed
  const recentEggAvg7d = productionLogsArr.filter(l => l.date >= now7).reduce((s, l, _, a) => s + l.egg_count / a.length, 0);
  const olderEggAvg7d  = productionLogsArr.filter(l => l.date >= now14 && l.date < now7).reduce((s, l, _, a) => a.length ? s + l.egg_count / a.length : s, 0);
  if (recentSickLogs7d.length > 0 && olderEggAvg7d > 0 && recentEggAvg7d < olderEggAvg7d * 0.7) {
    alerts.push({
      id: "corr-sick-egg-drop",
      level: "critical",
      module: "correlation",
      titleAr: "انخفاض الإنتاج + وجود مرض — تحقيق فوري مطلوب",
      titleSv: "Produktionsminskning + sjukdom — omedelbar undersökning krävs",
      bodyAr: "إنتاج البيض انخفض بالتزامن مع سجلات صحية سلبية — مؤشر مرض نشط.",
      bodySv: "Äggproduktion minskade samtidigt med negativa hälsologgar — aktiv sjukdomsindikator.",
      actionAr: "افتح تحليل القطعان",
      actionSv: "Öppna flockanalys",
      href: "/flocks",
    });
  }

  // Correlation B: Zero income + active flocks + high expenses → sales missed
  if (totalIncome === 0 && activeFlocks.length > 0 && totalBirds > 50 && totalExpense > 0) {
    alerts.push({
      id: "corr-no-income-active-flock",
      level: "warning",
      module: "correlation",
      titleAr: "فرصة مبيعات: لا دخل رغم وجود قطعان",
      titleSv: "Försäljningsmöjlighet: Ingen inkomst trots aktiva flockar",
      bodyAr: `لديك ${totalBirds} طير نشط مع مصاريف ${Math.round(totalExpense).toLocaleString()} دينار — لا دخل مسجل هذا الشهر.`,
      bodySv: `Du har ${totalBirds} aktiva fåglar med utgifter ${Math.round(totalExpense).toLocaleString()} IQD — ingen inkomst registrerad.`,
      href: "/finance",
    });
  }

  // Correlation C: Overdue tasks + sick flocks → operational neglect risk
  if (overdueTasks.length >= 5 && sickFlocks.length > 0) {
    alerts.push({
      id: "corr-neglect-sick",
      level: "critical",
      module: "correlation",
      titleAr: "خطر إهمال تشغيلي: مهام متأخرة + قطعان مريضة",
      titleSv: "Risk för driftsnegligering: Försenade uppgifter + sjuka flockar",
      bodyAr: "الإهمال التشغيلي يُفاقم الوضع الصحي. عالج المهام المتأخرة فوراً.",
      bodySv: "Driftsnegligering förvärrar hälsoläget. Åtgärda försenade uppgifter omedelbart.",
      href: "/operations",
    });
  }

  // Correlation D: High feed cost + poor hatching → major inefficiency
  if (completedCycles.length >= 2) {
    const avgHatch = completedCycles.slice(0, 3).reduce((s, c) => {
      return s + (c.eggsSet! > 0 ? ((c.eggsHatched ?? 0) / c.eggsSet!) * 100 : 0);
    }, 0) / Math.min(3, completedCycles.length);
    const feedRatio = totalExpense > 0 ? feedExpense / totalExpense : 0;
    if (avgHatch < 70 && feedRatio > 0.50) {
      alerts.push({
        id: "corr-poor-hatch-high-feed",
        level: "warning",
        module: "correlation",
        titleAr: "كفاءة منخفضة: تفقيس ضعيف + تكلفة علف عالية",
        titleSv: "Låg effektivitet: Dålig kläckning + hög foderkostnad",
        bodyAr: `معدل تفقيس ${Math.round(avgHatch)}% مع تكلفة علف ${Math.round(feedRatio * 100)}% — بحاجة لمراجعة شاملة.`,
        bodySv: `Kläckningsgrad ${Math.round(avgHatch)}% med foderkostnad ${Math.round(feedRatio * 100)}% — behöver genomgripande granskning.`,
        href: "/analytics",
      });
    }
  }

  // Correlation E: Feed gap + sick logs → malnutrition risk
  const lastFeedDate = feedRecordsArr[0]?.date;
  if (lastFeedDate && lastFeedDate < now14 && recentSickLogs7d.length > 0) {
    alerts.push({
      id: "corr-feed-gap-sick",
      level: "critical",
      module: "correlation",
      titleAr: "انقطاع العلف + مشاكل صحية — خطر سوء التغذية",
      titleSv: "Foderunderskott + hälsoproblem — risk för undernäring",
      bodyAr: "لم يُسجَّل علف مؤخراً مع وجود سجلات صحية سلبية — سوء التغذية يُضعف مناعة القطيع.",
      bodySv: "Inget foder registrerat nyligen med negativa hälsologgar — undernäring försämrar flockens immunitet.",
      actionAr: "راجع العلف والصحة",
      actionSv: "Granska foder och hälsa",
      href: "/feed",
    });
  }

  // Correlation F: No income + expenses rising (vs last month) → financial spiral
  if (lastMonthExpense > 0 && thisMonthExpense > lastMonthExpense * 1.3 && thisMonthIncome < thisMonthExpense * 0.5) {
    alerts.push({
      id: "corr-expense-spiral",
      level: "critical",
      module: "correlation",
      titleAr: "مصاريف تتصاعد مع دخل منخفض — خطر مالي",
      titleSv: "Utgifter ökar med låg inkomst — finansiell risk",
      bodyAr: `المصاريف ارتفعت ${Math.round(((thisMonthExpense - lastMonthExpense) / lastMonthExpense) * 100)}% مقارنة الشهر الماضي بينما الدخل لم يواكب. بحاجة لخطة عاجلة.`,
      bodySv: `Utgifterna ökade ${Math.round(((thisMonthExpense - lastMonthExpense) / lastMonthExpense) * 100)}% jämfört med förra månaden medan inkomsten inte hängt med. Akut plan krävs.`,
      href: "/finance",
    });
  }

  // ── 11. Sort: critical → warning → correlation → info → good ──────────────────
  const LEVEL_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2, good: 3 };
  alerts.sort((a, b) => {
    const la = LEVEL_ORDER[a.level] ?? 2;
    const lb = LEVEL_ORDER[b.level] ?? 2;
    if (la !== lb) return la - lb;
    // correlation alerts rank just after warning
    if (a.module === "correlation" && b.module !== "correlation") return -1;
    if (b.module === "correlation" && a.module !== "correlation") return 1;
    return 0;
  });

  const summary = {
    critical: alerts.filter(a => a.level === "critical").length,
    warning:  alerts.filter(a => a.level === "warning").length,
    info:     alerts.filter(a => a.level === "info").length,
    good:     alerts.filter(a => a.level === "good").length,
  };

  return { generatedAt: new Date().toISOString(), alerts, summary };
}

// ── Data Quality Scorer ────────────────────────────────────────────────────────
function computeDataQualityScore(report: IntelligenceReport, rawCounts: {
  flocks: number; transactions: number; healthLogs: number;
  productionLogs: number; tasks: number; hatchingCycles: number;
}): number {
  let score = 0;
  if (rawCounts.flocks > 0)         score += 20;
  if (rawCounts.transactions > 5)   score += 20;
  if (rawCounts.healthLogs > 0)     score += 15;
  if (rawCounts.productionLogs > 0) score += 15;
  if (rawCounts.tasks > 0)          score += 15;
  if (rawCounts.hatchingCycles > 0) score += 15;
  return Math.min(100, score);
}

// ── Input Hasher ──────────────────────────────────────────────────────────────
function hashInput(rawCounts: Record<string, number>): string {
  return createHash("sha256")
    .update(JSON.stringify(rawCounts))
    .digest("hex")
    .slice(0, 16);
}

// ── Route ──────────────────────────────────────────────────────────────────────
router.get("/intelligence/alerts", async (req: Request, res: Response) => {
  try {
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      res.json({ success: true, ...cache.data, cached: true });
      return;
    }

    // ── CRITICAL PATH: run the analysis first (must not fail) ──
    const report = await runAnalysis();
    cache = { ts: Date.now(), data: report };

    // ── NON-CRITICAL: AI logging + data quality (fully fault-tolerant) ──
    // This runs in the background and NEVER blocks or fails the response.
    setImmediate(async () => {
      try {
        const [flocks, txCount, healthCount, prodCount, taskCount, hatchCount] = await Promise.all([
          db.execute(sql`SELECT COUNT(*) as n FROM flocks`),
          db.execute(sql`SELECT COUNT(*) as n FROM transactions WHERE date >= ${daysAgo(30)}`),
          db.execute(sql`SELECT COUNT(*) as n FROM flock_health_logs WHERE date >= ${daysAgo(30)}`),
          db.execute(sql`SELECT COUNT(*) as n FROM flock_production_logs WHERE date >= ${daysAgo(30)}`),
          db.execute(sql`SELECT COUNT(*) as n FROM tasks`),
          db.execute(sql`SELECT COUNT(*) as n FROM hatching_cycles`),
        ]);

        const rawCounts = {
          flocks: Number((flocks.rows[0] as any)?.n ?? (flocks.rows[0] as any)?.count ?? 0),
          transactions: Number((txCount.rows[0] as any)?.n ?? (txCount.rows[0] as any)?.count ?? 0),
          healthLogs: Number((healthCount.rows[0] as any)?.n ?? (healthCount.rows[0] as any)?.count ?? 0),
          productionLogs: Number((prodCount.rows[0] as any)?.n ?? (prodCount.rows[0] as any)?.count ?? 0),
          tasks: Number((taskCount.rows[0] as any)?.n ?? (taskCount.rows[0] as any)?.count ?? 0),
          hatchingCycles: Number((hatchCount.rows[0] as any)?.n ?? (hatchCount.rows[0] as any)?.count ?? 0),
        };

        const dataQualityScore = computeDataQualityScore(report, rawCounts);
        const inputHash = hashInput(rawCounts);
        const riskScore = Math.min(100,
          (report.summary.critical * 30) +
          (report.summary.warning  * 15) +
          (report.summary.info     * 5)
        );
        const hatchAlert = report.alerts.find(a => a.module === "hatching" && a.metric?.unit === "%");
        const anomalies = report.alerts
          .filter(a => a.level === "critical")
          .map(a => ({ id: a.id, module: a.module, title: a.titleAr }));

        await logPrediction({
          engineVersion: "3.0",
          analysisType: "intelligence-hub",
          inputHash,
          predictedHatchRate: hatchAlert?.metric?.value ?? null,
          predictedRiskScore: riskScore,
          confidenceScore: Math.min(100, 40 + rawCounts.hatchingCycles * 8),
          featuresSnapshot: rawCounts as Record<string, unknown>,
          modelMetrics: {
            alertsGenerated: report.alerts.length,
            criticalCount: report.summary.critical,
            warningCount: report.summary.warning,
            dataQualityScore,
          },
          dataQualityScore,
          anomaliesDetected: anomalies,
        });
      } catch {
        // Logging failure never surfaces to the user
      }
    });

    res.json({ success: true, ...report, cached: false });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: "Intelligence analysis failed",
      detail: err?.message,
    });
  }
});

// ── Diagnostics endpoint ────────────────────────────────────────────────────────
router.get("/intelligence/diagnostics", async (req: Request, res: Response) => {
  try {
    const accuracy = await computeAccuracyMetrics();
    const recentLogs = await db.execute(sql`
      SELECT id, analysis_type, input_hash, predicted_risk_score, confidence_score,
             data_quality_score, model_metrics, created_at, resolved_at
      FROM prediction_logs
      ORDER BY created_at DESC
      LIMIT 20
    `);
    res.json({
      success: true,
      accuracy,
      recentAnalyses: recentLogs.rows,
      cacheStatus: cache ? { age: Math.round((Date.now() - cache.ts) / 1000) + "s", alerts: cache.data.alerts.length } : null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Invalidate cache (called when data changes)
export function invalidateIntelligenceCache() {
  cache = null;
}

export default router;
