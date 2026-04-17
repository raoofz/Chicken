/**
 * Context Injection Engine — buildFarmContext()
 * Aggregates last 7 days of farm data for temporal-aware AI analysis.
 * NO external AI calls — pure deterministic data engine.
 */

import { db, transactionsTable, dailyNotesTable, tasksTable, flocksTable, hatchingCyclesTable, flockProductionLogsTable, flockHealthLogsTable } from "@workspace/db";
import { sql, and, gte, lte, desc, eq } from "drizzle-orm";

// ─── Exported Types ───────────────────────────────────────────────────────────

export interface DaySnapshot {
  date: string;          // YYYY-MM-DD
  income: number;
  expense: number;
  profit: number;
  noteCount: number;
  noteSummaries: string[];
  tasksCompleted: number;
  tasksDue: number;
  taskCompletionRate: number; // 0-100
}

export interface ContextAlert {
  flag: string;
  severity: "critical" | "warning" | "info";
  titleAr: string;
  titleSv: string;
  detailAr: string;
  detailSv: string;
  pctChange?: number;
}

export interface FarmContextPayload {
  generatedAt: string;
  windowDays: number;
  // Newest-first daily snapshots
  snapshots: DaySnapshot[];
  today: DaySnapshot | null;
  yesterday: DaySnapshot | null;
  activeDays: number;       // days with any activity
  // 7-day averages
  avg7Day: {
    income: number;
    expense: number;
    profit: number;
    taskCompletionRate: number;
    noteCount: number;
  };
  // % changes: positive = increase, negative = decrease
  temporal: {
    incomeVsYesterday: number | null;
    incomeVs7Avg: number | null;
    expenseVsYesterday: number | null;
    expenseVs7Avg: number | null;
    profitVsYesterday: number | null;
    taskRateVsYesterday: number | null;
    noteCountVs7Avg: number | null;
  };
  // Change detection flags
  alerts: ContextAlert[];
  // Farm snapshot
  farm: {
    totalChickens: number;
    totalFlocks: number;
    activeHatchingCycles: number;
    overallHatchRate: number;
  };
  // Flock production (last windowDays)
  production: {
    totalEggs: number;
    avgDailyEggs: number;
    byFlock: Array<{
      flockId: number;
      flockName: string;
      totalEggs: number;
      avgDaily: number;
      trend: "up" | "down" | "stable";
      logCount: number;
    }>;
    trend: "up" | "down" | "stable";
  };
  // Flock health status
  flockHealth: {
    sickFlocks: number;
    flockStatuses: Array<{
      flockId: number;
      flockName: string;
      latestStatus: string;
      eventCount: number;
      lastDate: string | null;
    }>;
  };
  // Recent notes (last 20)
  recentNotes: {
    date: string;
    content: string;
    author: string | null;
    category: string;
  }[];
  // All-time financial totals
  financial: {
    totalIncome: number;
    totalExpense: number;
    profit: number;
    margin: number | null;
    topExpenseCategory: string | null;
    topExpensePct: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// ─── Main Builder ─────────────────────────────────────────────────────────────

export async function buildFarmContext(windowDays = 7): Promise<FarmContextPayload> {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const windowStart = new Date(now);
  windowStart.setDate(now.getDate() - (windowDays - 1));
  const windowStartStr = windowStart.toISOString().split("T")[0];

  // ── Parallel DB fetches ────────────────────────────────────────────────────
  const [txWindow, allTx, notesWindow, allTasks, flockRow, hatchActiveRow, completedCycles, recentNoteRows, prodLogsWindow, healthLogsAll, flocksList] =
    await Promise.all([
      // Transactions in window
      db.select().from(transactionsTable)
        .where(and(gte(transactionsTable.date, windowStartStr), lte(transactionsTable.date, todayStr)))
        .orderBy(desc(transactionsTable.date)),

      // All transactions (for totals)
      db.select().from(transactionsTable).orderBy(desc(transactionsTable.date)),

      // Notes in window
      db.select().from(dailyNotesTable)
        .where(and(gte(dailyNotesTable.date, windowStartStr), lte(dailyNotesTable.date, todayStr)))
        .orderBy(desc(dailyNotesTable.date)),

      // Tasks
      db.select().from(tasksTable),

      // Flock stats
      db.select({
        totalFlocks: sql<number>`count(*)::int`,
        totalChickens: sql<number>`coalesce(sum(${flocksTable.count}), 0)::int`,
      }).from(flocksTable),

      // Active hatching cycles
      db.select({ cnt: sql<number>`count(*)::int` }).from(hatchingCyclesTable)
        .where(sql`${hatchingCyclesTable.status} in ('incubating', 'hatching')`),

      // Completed cycles (for hatch rate)
      db.select().from(hatchingCyclesTable).where(
        and(
          eq(hatchingCyclesTable.status, "completed"),
          sql`${hatchingCyclesTable.eggsHatched} is not null`,
        ),
      ),

      // Recent 20 notes
      db.select().from(dailyNotesTable)
        .orderBy(desc(dailyNotesTable.date)).limit(20),

      // Production logs in window
      db.select().from(flockProductionLogsTable)
        .where(and(gte(flockProductionLogsTable.date, windowStartStr), lte(flockProductionLogsTable.date, todayStr)))
        .orderBy(desc(flockProductionLogsTable.date)),

      // Health logs — all recent (for latest status per flock)
      db.select().from(flockHealthLogsTable)
        .orderBy(desc(flockHealthLogsTable.date)).limit(200),

      // All flocks (for name lookup)
      db.select({ id: flocksTable.id, name: flocksTable.name }).from(flocksTable),
    ]);

  // ── Hatch rate ────────────────────────────────────────────────────────────
  let overallHatchRate = 0;
  if (completedCycles.length > 0) {
    const totalSet   = completedCycles.reduce((s, c) => s + c.eggsSet, 0);
    const totalHatch = completedCycles.reduce((s, c) => s + (c.eggsHatched ?? 0), 0);
    overallHatchRate = totalSet > 0 ? Math.round((totalHatch / totalSet) * 100) : 0;
  }

  // ── Build daily snapshots ──────────────────────────────────────────────────
  const dateMap: Record<string, DaySnapshot> = {};
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    dateMap[ds] = { date: ds, income: 0, expense: 0, profit: 0, noteCount: 0, noteSummaries: [], tasksCompleted: 0, tasksDue: 0, taskCompletionRate: 0 };
  }

  // Fill transactions
  for (const tx of txWindow) {
    const snap = dateMap[tx.date];
    if (!snap) continue;
    const amt = parseFloat(tx.amount as string) || 0;
    if (tx.type === "income") snap.income += amt;
    else snap.expense += amt;
  }
  for (const snap of Object.values(dateMap)) {
    snap.profit = snap.income - snap.expense;
  }

  // Fill notes
  for (const n of notesWindow) {
    const snap = dateMap[n.date];
    if (!snap) continue;
    snap.noteCount++;
    if (n.content) snap.noteSummaries.push(n.content.slice(0, 120));
  }

  // Fill tasks
  for (const task of allTasks) {
    if (!task.dueDate) continue;
    const snap = dateMap[task.dueDate];
    if (!snap) continue;
    snap.tasksDue++;
    if (task.completed) snap.tasksCompleted++;
  }
  for (const snap of Object.values(dateMap)) {
    snap.taskCompletionRate = snap.tasksDue > 0
      ? Math.round((snap.tasksCompleted / snap.tasksDue) * 100)
      : 0;
  }

  const snapshots = Object.values(dateMap).sort((a, b) => b.date.localeCompare(a.date));
  const todaySnap = dateMap[todayStr] ?? null;

  const yDate = new Date(now);
  yDate.setDate(now.getDate() - 1);
  const yesterdaySnap = dateMap[yDate.toISOString().split("T")[0]] ?? null;

  // ── 7-day averages ────────────────────────────────────────────────────────
  const activeDays = snapshots.filter(s => s.income > 0 || s.expense > 0 || s.noteCount > 0 || s.tasksDue > 0).length;
  const n = Math.max(activeDays, 1);
  const activeSnaps = snapshots.filter(s => s.income > 0 || s.expense > 0 || s.noteCount > 0 || s.tasksDue > 0);

  const avg7Day = {
    income: Math.round(activeSnaps.reduce((s, d) => s + d.income, 0) / n),
    expense: Math.round(activeSnaps.reduce((s, d) => s + d.expense, 0) / n),
    profit: Math.round(activeSnaps.reduce((s, d) => s + d.profit, 0) / n),
    taskCompletionRate: (() => {
      const tw = activeSnaps.filter(d => d.tasksDue > 0);
      return tw.length > 0 ? Math.round(tw.reduce((s, d) => s + d.taskCompletionRate, 0) / tw.length) : 0;
    })(),
    noteCount: Math.round(activeSnaps.reduce((s, d) => s + d.noteCount, 0) / n),
  };

  // ── Temporal comparisons ───────────────────────────────────────────────────
  const temporal = {
    incomeVsYesterday:    todaySnap && yesterdaySnap ? pctChange(todaySnap.income, yesterdaySnap.income) : null,
    incomeVs7Avg:         todaySnap ? pctChange(todaySnap.income, avg7Day.income) : null,
    expenseVsYesterday:   todaySnap && yesterdaySnap ? pctChange(todaySnap.expense, yesterdaySnap.expense) : null,
    expenseVs7Avg:        todaySnap ? pctChange(todaySnap.expense, avg7Day.expense) : null,
    profitVsYesterday:    todaySnap && yesterdaySnap ? pctChange(todaySnap.profit, yesterdaySnap.profit) : null,
    taskRateVsYesterday:  null as number | null,
    noteCountVs7Avg:      todaySnap ? pctChange(todaySnap.noteCount, avg7Day.noteCount) : null,
  };

  if (todaySnap && yesterdaySnap && todaySnap.tasksDue > 0 && yesterdaySnap.tasksDue > 0) {
    temporal.taskRateVsYesterday = pctChange(todaySnap.taskCompletionRate, yesterdaySnap.taskCompletionRate);
  }

  // ── Change detection ───────────────────────────────────────────────────────
  const alerts: ContextAlert[] = [];

  if (temporal.expenseVs7Avg !== null && temporal.expenseVs7Avg > 40) {
    alerts.push({
      flag: "expense_spike", severity: "critical",
      titleAr: "ارتفاع حاد في المصاريف", titleSv: "Kraftig utgiftsökning",
      detailAr: `مصاريف اليوم أعلى من المتوسط الأسبوعي بنسبة ${temporal.expenseVs7Avg}%`,
      detailSv: `Dagens utgifter är ${temporal.expenseVs7Avg}% över veckogenomsnitt`,
      pctChange: temporal.expenseVs7Avg,
    });
  } else if (temporal.expenseVs7Avg !== null && temporal.expenseVs7Avg > 20) {
    alerts.push({
      flag: "expense_high", severity: "warning",
      titleAr: "مصاريف أعلى من المعتاد", titleSv: "Utgifter över normalnivå",
      detailAr: `مصاريف اليوم أعلى بنسبة ${temporal.expenseVs7Avg}% من المتوسط الأسبوعي`,
      detailSv: `Dagens utgifter är ${temporal.expenseVs7Avg}% över veckogenomsnitt`,
      pctChange: temporal.expenseVs7Avg,
    });
  }

  if (temporal.incomeVs7Avg !== null && temporal.incomeVs7Avg < -20) {
    alerts.push({
      flag: "income_drop", severity: "warning",
      titleAr: "انخفاض ملحوظ في الدخل", titleSv: "Märkbar inkomstminskning",
      detailAr: `دخل اليوم أقل بنسبة ${Math.abs(temporal.incomeVs7Avg)}% من المتوسط الأسبوعي`,
      detailSv: `Dagens inkomst är ${Math.abs(temporal.incomeVs7Avg)}% under veckogenomsnitt`,
      pctChange: temporal.incomeVs7Avg,
    });
  }

  if (temporal.taskRateVsYesterday !== null && temporal.taskRateVsYesterday < -15) {
    alerts.push({
      flag: "task_drop", severity: "warning",
      titleAr: "انخفاض في إنجاز المهام", titleSv: "Minskad uppgiftsavslutning",
      detailAr: `إنجاز المهام انخفض بنسبة ${Math.abs(temporal.taskRateVsYesterday)}% عن الأمس`,
      detailSv: `Uppgiftsavslutning minskade med ${Math.abs(temporal.taskRateVsYesterday)}% jämfört med igår`,
      pctChange: temporal.taskRateVsYesterday,
    });
  }

  if (overallHatchRate > 0 && overallHatchRate < 70) {
    alerts.push({
      flag: "hatch_critical", severity: "critical",
      titleAr: "معدل تفقيس منخفض جداً", titleSv: "Mycket låg kläckningsgrad",
      detailAr: `معدل التفقيس ${overallHatchRate}% — أقل من الحد الأدنى المقبول 70%`,
      detailSv: `Kläckningsgrad ${overallHatchRate}% — under acceptabelt minimum 70%`,
    });
  } else if (overallHatchRate > 0 && overallHatchRate < 80) {
    alerts.push({
      flag: "hatch_warn", severity: "warning",
      titleAr: "معدل تفقيس دون المثالي", titleSv: "Kläckningsgrad under optimalt",
      detailAr: `معدل التفقيس ${overallHatchRate}% — أقل من المستوى المثالي 80%`,
      detailSv: `Kläckningsgrad ${overallHatchRate}% — under optimal nivå 80%`,
    });
  }

  // ── All-time financial ────────────────────────────────────────────────────
  let totalIncome = 0;
  let totalExpense = 0;
  const catTotals: Record<string, number> = {};

  for (const tx of allTx) {
    const amt = parseFloat(tx.amount as string) || 0;
    if (tx.type === "income") totalIncome += amt;
    else {
      totalExpense += amt;
      catTotals[tx.category] = (catTotals[tx.category] || 0) + amt;
    }
  }

  const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const topCat = sortedCats[0]?.[0] ?? null;
  const topPct = totalExpense > 0 && topCat
    ? Math.round((sortedCats[0][1] / totalExpense) * 100) : 0;

  const allProfit = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? Math.round((allProfit / totalIncome) * 100) : null;

  // ── Production analysis ───────────────────────────────────────────────────
  const flockNameMap: Record<number, string> = {};
  for (const f of flocksList) flockNameMap[f.id] = f.name;

  // Group production logs by flock
  const prodByFlock: Record<number, { date: string; count: number }[]> = {};
  for (const p of prodLogsWindow) {
    const fid = p.flockId;
    if (!prodByFlock[fid]) prodByFlock[fid] = [];
    prodByFlock[fid].push({ date: p.date, count: p.eggCount });
  }

  const totalEggs = prodLogsWindow.reduce((s, p) => s + p.eggCount, 0);
  const avgDailyEggs = windowDays > 0 ? Math.round((totalEggs / windowDays) * 10) / 10 : 0;

  const prodByFlockSummary = Object.entries(prodByFlock).map(([fidStr, logs]) => {
    const fid = Number(fidStr);
    const sorted = logs.slice().sort((a, b) => a.date.localeCompare(b.date));
    const total = sorted.reduce((s, l) => s + l.count, 0);
    const avg = sorted.length ? total / sorted.length : 0;
    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid).reduce((s, l) => s + l.count, 0) / (mid || 1);
    const secondHalf = sorted.slice(mid).reduce((s, l) => s + l.count, 0) / ((sorted.length - mid) || 1);
    const trend: "up" | "down" | "stable" =
      sorted.length < 2 ? "stable" :
      secondHalf > firstHalf * 1.05 ? "up" :
      secondHalf < firstHalf * 0.95 ? "down" : "stable";
    return { flockId: fid, flockName: flockNameMap[fid] ?? `قطيع #${fid}`, totalEggs: total, avgDaily: Math.round(avg * 10) / 10, trend, logCount: sorted.length };
  });

  const decliningCount = prodByFlockSummary.filter(p => p.trend === "down").length;
  const globalProdTrend: "up" | "down" | "stable" =
    decliningCount > prodByFlockSummary.length / 2 ? "down" :
    prodByFlockSummary.filter(p => p.trend === "up").length > prodByFlockSummary.length / 2 ? "up" : "stable";

  // Add production alerts
  for (const p of prodByFlockSummary) {
    if (p.trend === "down" && p.logCount >= 3) {
      alerts.push({
        flag: "production_drop",
        severity: "warning",
        titleAr: `انخفاض إنتاج قطيع ${p.flockName}`,
        titleSv: `Produktionsminskning för ${p.flockName}`,
        detailAr: `متوسط ${p.avgDaily} بيضة/يوم — الاتجاه هابط`,
        detailSv: `Genomsnitt ${p.avgDaily} ägg/dag — fallande trend`,
      });
    }
  }

  // ── Health analysis ────────────────────────────────────────────────────────
  // Latest status per flock
  const latestHealthByFlock: Record<number, { status: string; date: string }> = {};
  const healthEventCount: Record<number, number> = {};
  for (const h of healthLogsAll) {
    const fid = h.flockId;
    healthEventCount[fid] = (healthEventCount[fid] ?? 0) + 1;
    if (!latestHealthByFlock[fid]) {
      latestHealthByFlock[fid] = { status: h.status, date: h.date };
    }
  }

  const flockStatuses = Object.entries(latestHealthByFlock).map(([fidStr, { status, date }]) => {
    const fid = Number(fidStr);
    return { flockId: fid, flockName: flockNameMap[fid] ?? `قطيع #${fid}`, latestStatus: status, eventCount: healthEventCount[fid] ?? 0, lastDate: date };
  });

  const sickFlocks = flockStatuses.filter(f => ["sick", "quarantine"].includes(f.latestStatus)).length;

  // Add health alerts
  for (const f of flockStatuses) {
    if (f.latestStatus === "quarantine") {
      alerts.push({ flag: "flock_quarantine", severity: "critical", titleAr: `قطيع ${f.flockName} في الحجر الصحي`, titleSv: `${f.flockName} i karantän`, detailAr: `تحتاج إجراء فوري — مراقبة وعزل`, detailSv: `Kräver omedelbar åtgärd — övervaka och isolera` });
    } else if (f.latestStatus === "sick") {
      alerts.push({ flag: "flock_sick", severity: "high", titleAr: `قطيع ${f.flockName} مريض`, titleSv: `${f.flockName} är sjuk`, detailAr: `آخر حالة صحية: مريض (${f.lastDate})`, detailSv: `Senaste hälsostatus: sjuk (${f.lastDate})` });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    snapshots,
    today: todaySnap,
    yesterday: yesterdaySnap,
    activeDays,
    avg7Day,
    temporal,
    alerts,
    farm: {
      totalChickens: (flockRow[0] as any)?.totalChickens ?? 0,
      totalFlocks:   (flockRow[0] as any)?.totalFlocks ?? 0,
      activeHatchingCycles: (hatchActiveRow[0] as any)?.cnt ?? 0,
      overallHatchRate,
    },
    production: {
      totalEggs,
      avgDailyEggs,
      byFlock: prodByFlockSummary,
      trend: globalProdTrend,
    },
    flockHealth: {
      sickFlocks,
      flockStatuses,
    },
    recentNotes: recentNoteRows.map(n => ({
      date: n.date,
      content: n.content,
      author: n.authorName,
      category: n.category,
    })),
    financial: {
      totalIncome, totalExpense,
      profit: allProfit, margin,
      topExpenseCategory: topCat,
      topExpensePct: topPct,
    },
  };
}
