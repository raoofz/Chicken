/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  نظام التحليل الفوري المستقل — Real-Time Analytics Engine
 *  جميع الحسابات تتم على الخادم بـ SQL مُحسَّن لأعلى أداء
 * ══════════════════════════════════════════════════════════════════════════════
 */
import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router: IRouter = Router();

// ─── GET /api/analytics/live ─────────────────────────────────────────────────
// يعيد جميع المقاييس المحسوبة من قاعدة البيانات دفعة واحدة
router.get("/analytics/live", async (req, res) => {
  try {
    // ── KPIs كلية ──────────────────────────────────────────────────────────
    const kpis = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN type='income'  THEN amount::numeric ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount::numeric ELSE 0 END), 0) AS total_expense,
        COALESCE(SUM(CASE WHEN type='income'  THEN amount::numeric ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN type='expense' THEN amount::numeric ELSE 0 END), 0) AS net_profit,
        COUNT(*) AS tx_count,
        MAX(created_at) AS last_tx_at
      FROM transactions
    `);

    // ── الشهر الحالي ───────────────────────────────────────────────────────
    const thisMonth = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN type='income'  THEN amount::numeric ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount::numeric ELSE 0 END), 0) AS expense,
        COUNT(*) AS tx_count
      FROM transactions
      WHERE date >= date_trunc('month', CURRENT_DATE)
    `);

    // ── الشهر الماضي ───────────────────────────────────────────────────────
    const lastMonth = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN type='income'  THEN amount::numeric ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount::numeric ELSE 0 END), 0) AS expense
      FROM transactions
      WHERE date >= date_trunc('month', CURRENT_DATE - interval '1 month')
        AND date < date_trunc('month', CURRENT_DATE)
    `);

    // ── هذا الأسبوع ────────────────────────────────────────────────────────
    const thisWeek = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN type='income'  THEN amount::numeric ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount::numeric ELSE 0 END), 0) AS expense
      FROM transactions
      WHERE date >= date_trunc('week', CURRENT_DATE)
    `);

    // ── اليوم ──────────────────────────────────────────────────────────────
    const today = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN type='income'  THEN amount::numeric ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount::numeric ELSE 0 END), 0) AS expense,
        COUNT(*) AS tx_count
      FROM transactions
      WHERE date = CURRENT_DATE
    `);

    // ── توزيع حسب الفئة ────────────────────────────────────────────────────
    const byCategory = await db.execute(sql`
      SELECT
        type,
        category,
        COALESCE(SUM(amount::numeric), 0) AS total,
        COUNT(*) AS count,
        MAX(date) AS last_date
      FROM transactions
      GROUP BY type, category
      ORDER BY type, total DESC
    `);

    // ── الاتجاه الشهري (آخر 12 شهراً) ────────────────────────────────────
    const monthly = await db.execute(sql`
      SELECT
        TO_CHAR(date::date, 'YYYY-MM') AS month,
        COALESCE(SUM(CASE WHEN type='income'  THEN amount::numeric ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount::numeric ELSE 0 END), 0) AS expense,
        COALESCE(SUM(CASE WHEN type='income'  THEN amount::numeric ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN type='expense' THEN amount::numeric ELSE 0 END), 0) AS profit,
        COUNT(*) AS tx_count
      FROM transactions
      GROUP BY month
      ORDER BY month ASC
      LIMIT 24
    `);

    // ── تحليل العلف (آخر 6 أشهر) ──────────────────────────────────────────
    const feedAnalysis = await db.execute(sql`
      SELECT
        COALESCE(SUM(amount::numeric), 0)   AS total_cost,
        COALESCE(SUM(CASE WHEN unit IN ('كيلو','كغ','kg','kilogram','كيلوغرام','كيلوجرام','كلو','كلغ')
                         THEN quantity::numeric
                         WHEN unit IN ('طن','تن','ton','t','tonne')
                         THEN quantity::numeric * 1000
                         WHEN unit IN ('غرام','جرام','gram','g','غ','جـ')
                         THEN quantity::numeric / 1000
                         ELSE 0 END), 0)    AS total_kg,
        COUNT(*) AS entry_count,
        AVG(amount::numeric)                AS avg_cost_per_entry
      FROM transactions
      WHERE type = 'expense'
        AND category = 'feed'
        AND date >= CURRENT_DATE - interval '180 days'
    `);

    // ── آخر 10 معاملات ─────────────────────────────────────────────────────
    const recent = await db.execute(sql`
      SELECT id, date, type, category, description, amount::numeric AS amount, unit, quantity, author_name
      FROM transactions
      ORDER BY created_at DESC
      LIMIT 10
    `);

    // ── إحصاء الفئات النشطة ────────────────────────────────────────────────
    const categoryCount = await db.execute(sql`
      SELECT COUNT(DISTINCT category) AS distinct_categories
      FROM transactions
    `);

    // ── أعلى مصروف وأعلى دخل ───────────────────────────────────────────────
    const topExpense = await db.execute(sql`
      SELECT description, amount::numeric AS amount, date, category
      FROM transactions
      WHERE type = 'expense'
      ORDER BY amount::numeric DESC
      LIMIT 1
    `);

    const topIncome = await db.execute(sql`
      SELECT description, amount::numeric AS amount, date, category
      FROM transactions
      WHERE type = 'income'
      ORDER BY amount::numeric DESC
      LIMIT 1
    `);

    // ── توزيع العلف كنسبة من المصاريف الكلية ──────────────────────────────
    const feedRatioData = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN category='feed' THEN amount::numeric ELSE 0 END), 0) AS feed_total,
        COALESCE(SUM(amount::numeric), 0) AS all_expenses
      FROM transactions
      WHERE type = 'expense'
    `);

    // ── بيانات الأيام السبعة الأخيرة ─────────────────────────────────────
    const last7days = await db.execute(sql`
      SELECT
        date::text AS day,
        COALESCE(SUM(CASE WHEN type='income'  THEN amount::numeric ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount::numeric ELSE 0 END), 0) AS expense
      FROM transactions
      WHERE date >= CURRENT_DATE - interval '6 days'
      GROUP BY day
      ORDER BY day ASC
    `);

    res.json({
      timestamp:       new Date().toISOString(),
      kpis:            kpis.rows[0] ?? {},
      thisMonth:       thisMonth.rows[0] ?? {},
      lastMonth:       lastMonth.rows[0] ?? {},
      thisWeek:        thisWeek.rows[0] ?? {},
      today:           today.rows[0] ?? {},
      byCategory:      byCategory.rows,
      monthly:         monthly.rows,
      feedAnalysis:    feedAnalysis.rows[0] ?? {},
      recent:          recent.rows,
      categoryCount:   Number((categoryCount.rows[0] as any)?.distinct_categories ?? 0),
      topExpense:      topExpense.rows[0] ?? null,
      topIncome:       topIncome.rows[0] ?? null,
      feedRatio:       feedRatioData.rows[0] ?? {},
      last7days:       last7days.rows,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/analytics/summary ──────────────────────────────────────────────
// ملخص سريع للداشبورد
router.get("/analytics/summary", async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        TO_CHAR(CURRENT_DATE, 'YYYY-MM') AS current_month,
        COALESCE(SUM(CASE WHEN type='income'  AND TO_CHAR(date::date,'YYYY-MM')=TO_CHAR(CURRENT_DATE,'YYYY-MM') THEN amount::numeric ELSE 0 END), 0) AS month_income,
        COALESCE(SUM(CASE WHEN type='expense' AND TO_CHAR(date::date,'YYYY-MM')=TO_CHAR(CURRENT_DATE,'YYYY-MM') THEN amount::numeric ELSE 0 END), 0) AS month_expense,
        COUNT(*) FILTER (WHERE date >= date_trunc('month', CURRENT_DATE)) AS month_tx_count,
        COALESCE(SUM(CASE WHEN type='income'  THEN amount::numeric ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount::numeric ELSE 0 END), 0) AS total_expense
      FROM transactions
    `);
    res.json(result.rows[0] ?? {});
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
