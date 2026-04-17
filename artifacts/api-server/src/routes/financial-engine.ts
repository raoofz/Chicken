/**
 * ════════════════════════════════════════════════════════════════════════════
 *  المحرك المالي المركزي — Central Financial Engine (Single Source of Truth)
 *
 *  جميع حسابات الربح والخسارة الشهرية تتم هنا فقط
 *  netProfit = totalIncome - totalExpenses   (لا تقريبات، لا مقاييس نشاط)
 *  bestMonth = الشهر الأعلى ربحاً > 0  (لا يُسمى أي شهر خاسر "الأفضل" مطلقاً)
 *  worstMonth = الشهر الأدنى ربحاً
 * ════════════════════════════════════════════════════════════════════════════
 */
import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const AR_MONTHS = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

// ─── GET /api/finance/monthly-analysis ───────────────────────────────────────
// المصدر الوحيد للحقيقة في تقييم الأشهر المالية
router.get("/finance/monthly-analysis", async (req, res) => {
  try {
    // ── 1. الأرقام الشهرية الأساسية ────────────────────────────────────────
    const monthlyRows = await db.execute(sql`
      SELECT
        TO_CHAR(date::date, 'YYYY-MM') AS month,
        COALESCE(SUM(CASE WHEN type='income'  THEN amount::numeric ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount::numeric ELSE 0 END), 0) AS total_expense,
        COALESCE(SUM(CASE WHEN type='income'  THEN amount::numeric ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN type='expense' THEN amount::numeric ELSE 0 END), 0)
          AS net_profit,
        COUNT(*) AS tx_count
      FROM transactions
      GROUP BY month
      ORDER BY month ASC
    `);

    // ── 2. التفاصيل التصنيفية لكل شهر (للنوافذ التوضيحية) ──────────────────
    const categoryRows = await db.execute(sql`
      SELECT
        TO_CHAR(date::date, 'YYYY-MM') AS month,
        type,
        category,
        COALESCE(SUM(amount::numeric), 0) AS total
      FROM transactions
      GROUP BY month, type, category
      ORDER BY month ASC, type ASC, total DESC
    `);

    // ── 3. بناء هيكل الأشهر ──────────────────────────────────────────────
    interface MonthData {
      month: string;
      monthAr: string;
      totalIncome: number;
      totalExpense: number;
      netProfit: number;
      txCount: number;
      isProfit: boolean;
      isLoss: boolean;
      isBreakEven: boolean;
      profitMargin: number | null;
      incomeByCategory: Record<string, number>;
      expenseByCategory: Record<string, number>;
    }

    const months: MonthData[] = (monthlyRows.rows as any[]).map((r) => {
      const income  = Number(r.total_income);
      const expense = Number(r.total_expense);
      const profit  = Number(r.net_profit);
      const monthStr = String(r.month);
      const mo = parseInt(monthStr.slice(5), 10);
      return {
        month:      monthStr,
        monthAr:    AR_MONTHS[mo - 1] ?? monthStr,
        totalIncome:  income,
        totalExpense: expense,
        netProfit:    profit,
        txCount:      Number(r.tx_count),
        isProfit:     profit > 0,
        isLoss:       profit < 0,
        isBreakEven:  profit === 0,
        profitMargin: income > 0 ? (profit / income) * 100 : null,
        incomeByCategory:  {},
        expenseByCategory: {},
      };
    });

    // ── 4. إضافة التفاصيل التصنيفية ─────────────────────────────────────
    const monthMap = new Map<string, MonthData>(months.map(m => [m.month, m]));
    for (const r of categoryRows.rows as any[]) {
      const m = monthMap.get(String(r.month));
      if (!m) continue;
      if (r.type === "income") m.incomeByCategory[r.category]  = Number(r.total);
      else                     m.expenseByCategory[r.category] = Number(r.total);
    }

    // ── 5. حساب أفضل / أسوأ شهر (القاعدة الأساسية) ─────────────────────
    //
    //  ❌ STRICT RULE: لا يمكن أبداً أن يكون الشهر الخاسر هو "أفضل شهر"
    //  bestMonth  = الشهر الأعلى netProfit بشرط أن يكون > 0
    //  worstMonth = الشهر الأدنى netProfit (يشمل الشهور الخاسرة)
    //
    const profitableMonths = months.filter(m => m.isProfit);
    const allMonthsInLoss  = months.length > 0 && profitableMonths.length === 0;
    const noDataYet        = months.length === 0;

    const bestMonth = profitableMonths.length > 0
      ? profitableMonths.reduce((a, b) => b.netProfit > a.netProfit ? b : a)
      : null;

    const worstMonth = months.length > 0
      ? months.reduce((a, b) => b.netProfit < a.netProfit ? b : a)
      : null;

    // ── 6. ملخص إجمالي ───────────────────────────────────────────────────
    const totalIncome  = months.reduce((s, m) => s + m.totalIncome,  0);
    const totalExpense = months.reduce((s, m) => s + m.totalExpense, 0);
    const netProfit    = totalIncome - totalExpense;

    // ── 7. تحليل التسلسلات (Streak) ─────────────────────────────────────
    let profitableStreak = 0, lossStreak = 0;
    for (let i = months.length - 1; i >= 0; i--) {
      if (months[i].isProfit) {
        if (lossStreak === 0) profitableStreak++;
        else break;
      } else {
        if (profitableStreak === 0) lossStreak++;
        else break;
      }
    }

    // ── 8. شرح سبب اختيار أفضل/أسوأ شهر ───────────────────────────────
    function buildExplanation(m: MonthData, type: "best" | "worst"): string[] {
      const others = months.filter(x => x.month !== m.month);
      if (others.length === 0) return [];
      const avgInc  = others.reduce((s, x) => s + x.totalIncome,  0) / others.length;
      const avgExp  = others.reduce((s, x) => s + x.totalExpense, 0) / others.length;
      const reasons: string[] = [];

      if (type === "best") {
        if (m.totalIncome > avgInc * 1.1)
          reasons.push(`📈 الإيرادات أعلى من متوسط الأشهر الأخرى بنسبة ${((m.totalIncome / avgInc - 1) * 100).toFixed(0)}%`);
        if (m.totalExpense < avgExp * 0.92)
          reasons.push(`💰 المصاريف أقل من المتوسط بنسبة ${((1 - m.totalExpense / avgExp) * 100).toFixed(0)}%`);
        if (m.profitMargin !== null)
          reasons.push(`✅ هامش الربح: ${m.profitMargin.toFixed(1)}%`);
        if (reasons.length === 0)
          reasons.push("📊 أفضل توازن بين الإيرادات والمصاريف");
      } else {
        if (m.isLoss)
          reasons.push(`⛔ خسارة صافية: ${Math.abs(m.netProfit).toLocaleString("ar-IQ")} د.ع`);
        if (m.totalIncome < avgInc * 0.9 && avgInc > 0)
          reasons.push(`📉 الإيرادات أقل من المتوسط بنسبة ${((1 - m.totalIncome / avgInc) * 100).toFixed(0)}%`);
        if (m.totalExpense > avgExp * 1.1)
          reasons.push(`🔺 المصاريف أعلى من المتوسط بنسبة ${((m.totalExpense / avgExp - 1) * 100).toFixed(0)}%`);
        if (reasons.length === 0)
          reasons.push("📊 أدنى أداء مالي مقارنةً بالأشهر الأخرى");
        reasons.push("💡 راجع أكبر بند مصاريف وابحث عن فرص تخفيض التكاليف");
      }
      return reasons;
    }

    const response = {
      timestamp: new Date().toISOString(),
      months,
      bestMonth:         bestMonth ? { ...bestMonth, explanation: buildExplanation(bestMonth,  "best")  } : null,
      worstMonth:        worstMonth ? { ...worstMonth, explanation: buildExplanation(worstMonth, "worst") } : null,
      allMonthsInLoss,
      noDataYet,
      profitableStreak,
      lossStreak,
      summary: {
        totalIncome,
        totalExpense,
        netProfit,
        profitableMonthsCount: profitableMonths.length,
        lossMonthsCount:       months.filter(m => m.isLoss).length,
        breakEvenMonthsCount:  months.filter(m => m.isBreakEven).length,
        totalMonths:           months.length,
      },
    };

    logger.info(
      { bestMonth: bestMonth?.month ?? "none", worstMonth: worstMonth?.month ?? "none", allMonthsInLoss },
      "[financial-engine] monthly-analysis computed"
    );

    res.json(response);
  } catch (e: any) {
    logger.error({ err: e }, "[financial-engine] monthly-analysis failed");
    res.status(500).json({ error: e.message });
  }
});

export default router;
