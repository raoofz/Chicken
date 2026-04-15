/**
 * Context Injection Engine — buildFarmContext()
 * Aggregates last 7 days of farm data for temporal-aware AI analysis.
 * NO external AI calls — pure deterministic data engine.
 */

import { db, transactionsTable, dailyNotesTable, tasksTable, flocksTable, hatchingCyclesTable } from "@workspace/db";
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
  const [txWindow, allTx, notesWindow, allTasks, flockRow, hatchActiveRow, completedCycles, recentNoteRows] =
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
