/**
 * Finance — Cost Analysis + Daily Totals + Structured Insights
 * ────────────────────────────────────────────────────────────────────
 * Read-only analytics that derive metrics directly from the ledger,
 * batches, flocks, feed_records and medicine_records.
 *
 *   GET  /finance/cost-analysis        cost-per-chicken, per-batch, feed%, medicine/chicken
 *   GET  /finance/daily-totals?days=30 daily income/expense/profit series
 *   GET  /finance/insights             structured Issue / Cause / Impact / Recommendation
 */
import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

interface CostAnalysis {
  totalChickens: number;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  costPerChicken: number | null;
  feedCost: number;
  medicineCost: number;
  feedPctOfExpenses: number | null;
  feedCostPerChicken: number | null;
  medicineCostPerChicken: number | null;
  byBatch: Array<{
    batchId: number; name: string; chickenCount: number; status: string;
    income: number; expenses: number; netProfit: number;
    costPerChicken: number | null; profitPerChicken: number | null;
    profitable: boolean;
  }>;
  byCategory: Array<{ category: string; total: number; pct: number }>;
}

router.get("/finance/cost-analysis", async (_req, res) => {
  try {
    // Totals
    const totalsRow = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN type='income'  THEN amount::numeric END),0) AS income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount::numeric END),0) AS expense
      FROM transactions
    `);
    const totalIncome   = Number((totalsRow.rows[0] as any).income);
    const totalExpenses = Number((totalsRow.rows[0] as any).expense);
    const netProfit     = totalIncome - totalExpenses;

    // Total chickens (sum of flocks.count)
    const flocksRow = await db.execute(sql`SELECT COALESCE(SUM(count),0) AS c FROM flocks`);
    const totalChickens = Number((flocksRow.rows[0] as any).c);

    // Feed cost = sum of expenses where category='feed' OR domain='feed'
    const feedRow = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric),0) AS total
      FROM transactions
      WHERE type='expense' AND (category='feed' OR domain='feed')
    `);
    const feedCost = Number((feedRow.rows[0] as any).total);

    // Medicine cost — from medicine_records (authoritative) PLUS expense rows
    // categorized as 'medicine' that have NO matching record (avoid double count).
    const medRow = await db.execute(sql`
      SELECT
        COALESCE((SELECT SUM(cost::numeric) FROM medicine_records),0) +
        COALESCE((SELECT SUM(amount::numeric) FROM transactions
                  WHERE type='expense' AND category='medicine'
                  AND id NOT IN (SELECT transaction_id FROM medicine_records WHERE transaction_id IS NOT NULL)),0)
        AS total
    `);
    const medicineCost = Number((medRow.rows[0] as any).total);

    // By-category breakdown of expenses
    const catRows = await db.execute(sql`
      SELECT category, COALESCE(SUM(amount::numeric),0) AS total
      FROM transactions WHERE type='expense'
      GROUP BY category ORDER BY total DESC
    `);
    const byCategory = (catRows.rows as any[]).map(r => ({
      category: String(r.category),
      total:    Number(r.total),
      pct:      totalExpenses > 0 ? (Number(r.total) / totalExpenses) * 100 : 0,
    }));

    // By-batch
    const batchRows = await db.execute(sql`
      SELECT
        b.id, b.name, b.chicken_count, b.status,
        COALESCE(SUM(CASE WHEN t.type='income'  THEN t.amount::numeric END),0) AS income,
        COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount::numeric END),0) AS expense
      FROM batches b
      LEFT JOIN transactions t ON t.batch_id = b.id
      GROUP BY b.id, b.name, b.chicken_count, b.status
      ORDER BY b.start_date DESC
    `);
    const byBatch = (batchRows.rows as any[]).map(r => {
      const income   = Number(r.income);
      const expense  = Number(r.expense);
      const profit   = income - expense;
      const chickens = Number(r.chicken_count);
      return {
        batchId:        Number(r.id),
        name:           String(r.name),
        chickenCount:   chickens,
        status:         String(r.status),
        income, expenses: expense, netProfit: profit,
        costPerChicken:   chickens > 0 ? expense / chickens : null,
        profitPerChicken: chickens > 0 ? profit  / chickens : null,
        profitable:       profit > 0,
      };
    });

    const out: CostAnalysis = {
      totalChickens, totalIncome, totalExpenses, netProfit,
      costPerChicken:         totalChickens > 0 ? totalExpenses / totalChickens : null,
      feedCost, medicineCost,
      feedPctOfExpenses:      totalExpenses > 0 ? (feedCost     / totalExpenses) * 100 : null,
      feedCostPerChicken:     totalChickens  > 0 ? feedCost     / totalChickens : null,
      medicineCostPerChicken: totalChickens  > 0 ? medicineCost / totalChickens : null,
      byBatch, byCategory,
    };

    res.json(out);
  } catch (e: any) {
    logger.error({ err: e }, "[finance/cost-analysis] failed");
    res.status(500).json({ error: e.message });
  }
});

router.get("/finance/daily-totals", async (req, res) => {
  try {
    const days = Math.min(365, Math.max(1, Number(req.query.days ?? 30)));
    const rows = await db.execute(sql`
      SELECT
        date::date AS day,
        COALESCE(SUM(CASE WHEN type='income'  THEN amount::numeric END),0) AS income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount::numeric END),0) AS expense
      FROM transactions
      WHERE date::date >= CURRENT_DATE - (${days}::int - 1)
      GROUP BY day ORDER BY day ASC
    `);
    const series = (rows.rows as any[]).map(r => {
      const income  = Number(r.income);
      const expense = Number(r.expense);
      return {
        date: String(r.day).slice(0, 10),
        income, expense, netProfit: income - expense,
      };
    });
    res.json({ days, series });
  } catch (e: any) {
    logger.error({ err: e }, "[finance/daily-totals] failed");
    res.status(500).json({ error: e.message });
  }
});

// ─── Structured Insights ─────────────────────────────────────────────────────
interface Insight {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  issue: string;
  cause: string;
  impact: string;
  recommendation: string;
  data?: Record<string, unknown>;
}

router.get("/finance/insights", async (_req, res) => {
  try {
    const insights: Insight[] = [];

    // ── 1. Pull totals + breakdowns reused below ─────────────────────────────
    const totalsRow = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN type='income'  THEN amount::numeric END),0) AS income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount::numeric END),0) AS expense
      FROM transactions
    `);
    const totalIncome   = Number((totalsRow.rows[0] as any).income);
    const totalExpenses = Number((totalsRow.rows[0] as any).expense);
    const netProfit     = totalIncome - totalExpenses;

    const feedRow = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric),0) AS total FROM transactions
      WHERE type='expense' AND (category='feed' OR domain='feed')
    `);
    const feedCost = Number((feedRow.rows[0] as any).total);
    const feedPct  = totalExpenses > 0 ? (feedCost / totalExpenses) * 100 : 0;

    // ── A. High feed-cost ratio ──────────────────────────────────────────────
    if (totalExpenses > 0 && feedPct >= 60) {
      insights.push({
        id: "high-feed-share",
        severity: feedPct >= 75 ? "critical" : "high",
        issue: `تكلفة العلف تمثل ${feedPct.toFixed(1)}% من إجمالي المصاريف`,
        cause: "حصة العلف من المصاريف تجاوزت العتبة الصحية (60%)",
        impact: `كل دينار يُصرف على العلف يقلّص هامش الربح الصافي مباشرة`,
        recommendation: "راجع كميات العلف اليومية، قارن الأسعار بين المورّدين، أو تفاوض على عقد كميات أكبر بسعر أقل",
        data: { feedCost, totalExpenses, feedPct },
      });
    }

    // ── B. Net loss overall ──────────────────────────────────────────────────
    if (totalIncome > 0 && netProfit < 0) {
      insights.push({
        id: "net-loss",
        severity: "critical",
        issue: "صافي الربح التراكمي سالب",
        cause: `المصاريف (${totalExpenses.toFixed(0)}) تجاوزت الإيرادات (${totalIncome.toFixed(0)})`,
        impact: `خسارة تراكمية قدرها ${Math.abs(netProfit).toFixed(0)}`,
        recommendation: "حدد أكبر بنود المصاريف وضع خطة تخفيض فورية، أو ارفع أسعار المنتج",
        data: { totalIncome, totalExpenses, netProfit },
      });
    }

    // ── C. Loss-making batches ───────────────────────────────────────────────
    const batchLossRows = await db.execute(sql`
      SELECT b.id, b.name, b.chicken_count,
        COALESCE(SUM(CASE WHEN t.type='income'  THEN t.amount::numeric END),0) AS income,
        COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount::numeric END),0) AS expense
      FROM batches b
      LEFT JOIN transactions t ON t.batch_id = b.id
      GROUP BY b.id, b.name, b.chicken_count
      HAVING COALESCE(SUM(CASE WHEN t.type='income'  THEN t.amount::numeric END),0)
           - COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount::numeric END),0) < 0
      ORDER BY (COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount::numeric END),0)
              - COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount::numeric END),0)) ASC
      LIMIT 3
    `);
    for (const r of batchLossRows.rows as any[]) {
      const income  = Number(r.income);
      const expense = Number(r.expense);
      const loss    = expense - income;
      insights.push({
        id: `batch-loss-${r.id}`,
        severity: loss > 1000 ? "high" : "medium",
        issue: `الدفعة "${r.name}" تعمل بخسارة قدرها ${loss.toFixed(0)}`,
        cause: `مصاريف الدفعة (${expense.toFixed(0)}) أعلى من إيراداتها (${income.toFixed(0)})`,
        impact: "هذه الدفعة تستهلك السيولة بدل أن تنتجها",
        recommendation: "افحص أكبر مصروف بهذه الدفعة، وحدد ما إذا كان السبب علفاً، دواءاً، أو نفوقاً",
        data: { batchId: r.id, income, expense, loss },
      });
    }

    // ── D. Top expense category dominance ───────────────────────────────────
    const topCatRow = await db.execute(sql`
      SELECT category, COALESCE(SUM(amount::numeric),0) AS total
      FROM transactions WHERE type='expense'
      GROUP BY category ORDER BY total DESC LIMIT 1
    `);
    const top = topCatRow.rows[0] as any;
    if (top && totalExpenses > 0) {
      const total = Number(top.total);
      const pct   = (total / totalExpenses) * 100;
      if (pct >= 50 && top.category !== "feed") {
        insights.push({
          id: "category-dominance",
          severity: "medium",
          issue: `بند "${top.category}" يستحوذ على ${pct.toFixed(1)}% من المصاريف`,
          cause: "تركّز كبير في فئة واحدة من المصاريف",
          impact: "أي ارتفاع في هذا البند سيضرب الربحية بقوة",
          recommendation: "وزّع المصاريف ضمن خطة ميزانية واضحة، وابحث عن بدائل لهذا البند",
          data: { category: top.category, total, pct },
        });
      }
    }

    // ── E. Overdue / unpaid invoices ────────────────────────────────────────
    const idleInvRow = await db.execute(sql`
      SELECT id, customer_name, remaining_amount, due_date
      FROM invoices
      WHERE status IN ('unpaid','partial')
        AND (due_date IS NULL OR due_date < CURRENT_DATE)
      ORDER BY remaining_amount::numeric DESC
      LIMIT 3
    `);
    const totalOutstanding = (idleInvRow.rows as any[]).reduce((s, r) => s + Number(r.remaining_amount), 0);
    if (totalOutstanding > 0) {
      insights.push({
        id: "overdue-receivables",
        severity: totalOutstanding > 5000 ? "high" : "medium",
        issue: `ذمم قيد التحصيل بقيمة ${totalOutstanding.toFixed(0)}`,
        cause: `${(idleInvRow.rows as any[]).length} فاتورة غير مسددة أو متأخرة`,
        impact: "نقص سيولة فعلي رغم أن المبيعات مسجّلة",
        recommendation: "تواصل مع العملاء المتأخرين الآن، أو ضع سياسة دفع مسبق على الطلبات الجديدة",
        data: { count: idleInvRow.rows.length, totalOutstanding },
      });
    }

    // ── F. Healthy state ─────────────────────────────────────────────────────
    if (insights.length === 0 && totalIncome > 0) {
      insights.push({
        id: "healthy",
        severity: "low",
        issue: "الأرقام المالية ضمن النطاق الصحي",
        cause: "لا توجد تجاوزات في حصص المصاريف ولا دفعات خاسرة ولا ذمم متأخرة",
        impact: `صافي ربح موجب: ${netProfit.toFixed(0)}`,
        recommendation: "حافظ على نفس النمط، وابدأ التخطيط للتوسع التدريجي",
      });
    }

    res.json({
      generatedAt:  new Date().toISOString(),
      summary:      { totalIncome, totalExpenses, netProfit, feedPct },
      insightCount: insights.length,
      insights,
    });
  } catch (e: any) {
    logger.error({ err: e }, "[finance/insights] failed");
    res.status(500).json({ error: e.message });
  }
});

export default router;
