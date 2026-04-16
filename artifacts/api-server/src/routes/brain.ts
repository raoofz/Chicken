import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

// ─── In-Memory Cache ──────────────────────────────────────────────────────────
const STATE_TTL   = 5_000;   // 5 seconds — very fresh
const AUDIT_TTL   = 3_600_000; // 1 hour
let stateCache: { ts: number; data: any } | null = null;
let auditCache:  { ts: number; data: any } | null = null;

export function invalidateBrainCache() {
  stateCache = null;
}

// ─── /api/brain/state  ────────────────────────────────────────────────────────
// Full farm snapshot: finance, feed, flocks, hatching, tasks, goals, notes
router.get("/brain/state", async (req, res) => {
  const now = Date.now();
  if (stateCache && now - stateCache.ts < STATE_TTL) {
    res.setHeader("X-Cache", "HIT");
    res.json(stateCache.data);
    return;
  }

  try {
    const [
      financial,
      monthlyTrend,
      byCategory,
      feedSummary,
      feedHistory,
      flocksRows,
      hatchingStats,
      hatchingCycles,
      tasksRows,
      goalsRows,
      notesRows,
      dailyStreak,
      topRecords,
      feedDailyAvg,
      weekRows,
      productionRows,
      healthRows,
    ] = await Promise.all([

      // ── 1. Full financial summary ─────────────────────────────────────────
      db.execute(sql`
        SELECT
          COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END), 0)         AS total_income,
          COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0)         AS total_expense,
          COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE -amount END), 0)   AS net_profit,
          COUNT(*)                                                                   AS tx_count,
          COUNT(CASE WHEN type='income'  THEN 1 END)                                AS income_count,
          COUNT(CASE WHEN type='expense' THEN 1 END)                                AS expense_count,
          -- this month
          COALESCE(SUM(CASE WHEN type='income'  AND date_trunc('month', date::date) = date_trunc('month', CURRENT_DATE) THEN amount ELSE 0 END), 0) AS month_income,
          COALESCE(SUM(CASE WHEN type='expense' AND date_trunc('month', date::date) = date_trunc('month', CURRENT_DATE) THEN amount ELSE 0 END), 0) AS month_expense,
          -- last month
          COALESCE(SUM(CASE WHEN type='income'  AND date_trunc('month', date::date) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month') THEN amount ELSE 0 END), 0) AS last_month_income,
          COALESCE(SUM(CASE WHEN type='expense' AND date_trunc('month', date::date) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month') THEN amount ELSE 0 END), 0) AS last_month_expense,
          -- today
          COALESCE(SUM(CASE WHEN type='income'  AND date::date = CURRENT_DATE THEN amount ELSE 0 END), 0) AS today_income,
          COALESCE(SUM(CASE WHEN type='expense' AND date::date = CURRENT_DATE THEN amount ELSE 0 END), 0) AS today_expense,
          -- last 7 days
          COALESCE(SUM(CASE WHEN type='income'  AND date::date >= CURRENT_DATE - 6 THEN amount ELSE 0 END), 0) AS week_income,
          COALESCE(SUM(CASE WHEN type='expense' AND date::date >= CURRENT_DATE - 6 THEN amount ELSE 0 END), 0) AS week_expense,
          -- last 30 days
          COALESCE(SUM(CASE WHEN type='income'  AND date::date >= CURRENT_DATE - 29 THEN amount ELSE 0 END), 0) AS last30_income,
          COALESCE(SUM(CASE WHEN type='expense' AND date::date >= CURRENT_DATE - 29 THEN amount ELSE 0 END), 0) AS last30_expense,
          MAX(date::date)  AS last_tx_date,
          MIN(date::date)  AS first_tx_date,
          MAX(created_at)  AS last_updated
        FROM transactions
      `),

      // ── 2. Monthly trend — last 13 months ───────────────────────────────
      db.execute(sql`
        SELECT
          TO_CHAR(date::date, 'YYYY-MM')                                            AS month,
          COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END), 0)         AS income,
          COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0)         AS expense,
          COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE -amount END), 0)   AS profit,
          COUNT(*)                                                                   AS tx_count
        FROM transactions
        WHERE date::date >= CURRENT_DATE - INTERVAL '13 months'
        GROUP BY TO_CHAR(date::date, 'YYYY-MM')
        ORDER BY month DESC
      `),

      // ── 3. Category breakdown (all time) ────────────────────────────────
      db.execute(sql`
        SELECT
          type, category,
          COUNT(*)         AS tx_count,
          SUM(amount)      AS total,
          AVG(amount)      AS avg_amount,
          MAX(amount)      AS max_amount,
          MIN(date::date)  AS first_date,
          MAX(date::date)  AS last_date
        FROM transactions
        GROUP BY type, category
        ORDER BY total DESC
      `),

      // ── 4. Feed summary ──────────────────────────────────────────────────
      db.execute(sql`
        SELECT
          COUNT(*)                                                   AS entry_count,
          COALESCE(SUM(amount), 0)                                   AS total_cost,
          COALESCE(SUM(
            CASE
              WHEN unit IN ('كيلو','كغ','kg','KG') THEN quantity
              WHEN unit IN ('طن','ton','TON')       THEN quantity * 1000
              WHEN unit IN ('غرام','gram','g','G')  THEN quantity / 1000.0
              WHEN unit = 'كيس'                     THEN quantity * 50
              ELSE quantity
            END
          ), 0)                                                      AS total_kg,
          COALESCE(AVG(amount), 0)                                   AS avg_cost_per_entry,
          MAX(date::date)                                            AS last_feed_date,
          MIN(date::date)                                            AS first_feed_date,
          COALESCE(SUM(CASE WHEN date::date >= CURRENT_DATE - 29 THEN amount ELSE 0 END), 0) AS last30_cost,
          COALESCE(SUM(CASE WHEN date::date >= CURRENT_DATE - 6  THEN amount ELSE 0 END), 0) AS week_cost,
          COALESCE(SUM(CASE WHEN date::date = CURRENT_DATE        THEN amount ELSE 0 END), 0) AS today_cost,
          COUNT(CASE WHEN quantity IS NULL OR quantity = 0 THEN 1 END)                       AS missing_qty_count
        FROM transactions
      `),

      // ── 5. Feed history (last 15 entries) ───────────────────────────────
      db.execute(sql`
        SELECT date, amount, description, quantity, unit, author_name
        FROM transactions
        ORDER BY date DESC, created_at DESC
        LIMIT 15
      `),

      // ── 6. Flocks ────────────────────────────────────────────────────────
      db.execute(sql`
        SELECT
          id, name, breed, count, age_days, purpose, notes, birth_date,
          created_at,
          CASE
            WHEN birth_date IS NOT NULL
            THEN CURRENT_DATE - birth_date::date
            ELSE age_days
          END AS actual_age_days
        FROM flocks
        ORDER BY created_at DESC
      `),

      // ── 7. Hatching stats ────────────────────────────────────────────────
      db.execute(sql`
        SELECT
          COUNT(*)                                                              AS total_cycles,
          COUNT(CASE WHEN status IN ('active','incubating','lockdown') THEN 1 END) AS active_count,
          COUNT(CASE WHEN status = 'completed' THEN 1 END)                    AS completed_count,
          COALESCE(SUM(eggs_set), 0)                                           AS total_eggs_set,
          COALESCE(SUM(eggs_hatched), 0)                                       AS total_eggs_hatched,
          COALESCE(ROUND(
            AVG(CASE WHEN status='completed' AND eggs_set > 0
              THEN (eggs_hatched::numeric / eggs_set) * 100 END), 1
          ), 0)                                                                AS avg_hatch_rate,
          COUNT(CASE WHEN status IN ('active','incubating','lockdown')
                      AND expected_hatch_date::date < CURRENT_DATE THEN 1 END) AS overdue_count
        FROM hatching_cycles
      `),

      // ── 8. Hatching cycles (active first, then recent) ──────────────────
      db.execute(sql`
        SELECT
          id, batch_name, eggs_set, eggs_hatched, start_date, expected_hatch_date,
          actual_hatch_date, lockdown_date, status, temperature, humidity,
          lockdown_temperature, lockdown_humidity, notes,
          CURRENT_DATE - start_date::date                             AS days_in,
          expected_hatch_date::date - CURRENT_DATE                   AS days_remaining
        FROM hatching_cycles
        ORDER BY
          CASE WHEN status IN ('active','incubating','lockdown') THEN 0 ELSE 1 END,
          created_at DESC
        LIMIT 20
      `),

      // ── 9. Tasks ─────────────────────────────────────────────────────────
      db.execute(sql`
        SELECT
          id, title, description, category, priority, completed,
          due_date, created_at,
          CASE
            WHEN completed = true THEN 'done'
            WHEN due_date IS NULL THEN 'pending'
            WHEN due_date::date < CURRENT_DATE THEN 'overdue'
            WHEN due_date::date = CURRENT_DATE THEN 'today'
            ELSE 'upcoming'
          END AS status_computed
        FROM tasks
        ORDER BY
          CASE
            WHEN completed = false AND due_date::date < CURRENT_DATE  THEN 0
            WHEN completed = false AND due_date::date = CURRENT_DATE  THEN 1
            WHEN completed = false                                    THEN 2
            ELSE 3
          END,
          due_date ASC NULLS LAST
        LIMIT 60
      `),

      // ── 10. Goals ────────────────────────────────────────────────────────
      db.execute(sql`
        SELECT
          id, title, description, target_value, current_value, unit,
          category, deadline, completed, created_at,
          CASE
            WHEN target_value > 0
            THEN ROUND((current_value::numeric / target_value::numeric) * 100, 1)
            ELSE 0
          END AS progress_pct,
          CASE
            WHEN completed = true THEN 'done'
            WHEN deadline IS NOT NULL AND deadline::date < CURRENT_DATE THEN 'overdue'
            WHEN deadline IS NOT NULL AND deadline::date <= CURRENT_DATE + 7 THEN 'due_soon'
            ELSE 'active'
          END AS status_computed
        FROM goals
        ORDER BY
          CASE WHEN completed = false THEN 0 ELSE 1 END,
          deadline ASC NULLS LAST
        LIMIT 30
      `),

      // ── 11. Recent notes (last 15) ───────────────────────────────────────
      db.execute(sql`
        SELECT id, date, category, content, author_name, created_at
        FROM daily_notes
        ORDER BY date DESC, created_at DESC
        LIMIT 15
      `),

      // ── 12. Documentation streak ─────────────────────────────────────────
      db.execute(sql`
        WITH combined AS (
          SELECT DISTINCT date::date AS d FROM transactions
          UNION
          SELECT DISTINCT date::date AS d FROM daily_notes
        ),
        latest AS (
          SELECT MAX(d) AS last_day FROM combined WHERE d <= CURRENT_DATE
        ),
        streak_calc AS (
          SELECT c.d,
                 (SELECT last_day FROM latest) - c.d AS days_ago,
                 ROW_NUMBER() OVER (ORDER BY c.d DESC) AS rn
          FROM combined c
          WHERE c.d <= CURRENT_DATE
        )
        SELECT COUNT(*) AS streak_days
        FROM streak_calc
        WHERE days_ago = rn - 1
      `),

      // ── 13. Top records ──────────────────────────────────────────────────
      db.execute(sql`
        SELECT
          (SELECT description FROM transactions WHERE type='expense' ORDER BY amount DESC LIMIT 1) AS top_expense_desc,
          (SELECT amount       FROM transactions WHERE type='expense' ORDER BY amount DESC LIMIT 1) AS top_expense_amt,
          (SELECT description  FROM transactions WHERE type='income'  ORDER BY amount DESC LIMIT 1) AS top_income_desc,
          (SELECT amount       FROM transactions WHERE type='income'  ORDER BY amount DESC LIMIT 1) AS top_income_amt,
          (SELECT COUNT(*)     FROM transactions WHERE date::date = CURRENT_DATE)                   AS today_tx_count,
          (SELECT COUNT(*)     FROM transactions)                                                   AS all_time_count
      `),

      // ── 14. Feed daily average (last 30 days) ────────────────────────────
      db.execute(sql`
        SELECT
          COALESCE(ROUND(AVG(daily_cost), 0), 0) AS avg_daily_feed_cost,
          COUNT(DISTINCT d)                       AS feed_days_count
        FROM (
          SELECT date::date AS d, SUM(amount) AS daily_cost
          FROM transactions
          WHERE date::date >= CURRENT_DATE - 29
          GROUP BY date::date
        ) t
      `),

      // ── 15. Last 7 days daily breakdown ─────────────────────────────────
      db.execute(sql`
        SELECT
          gs.d                                                               AS day,
          COALESCE(SUM(CASE WHEN t.type='income'  THEN t.amount ELSE 0 END), 0) AS income,
          COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0) AS expense
        FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') AS gs(d)
        LEFT JOIN transactions t
          ON t.date::date = gs.d
        GROUP BY gs.d
        ORDER BY gs.d ASC
      `),

      // ── 16. Flock production summary (last 30 days) ───────────────────────
      db.execute(sql`
        SELECT
          fp.flock_id,
          f.name                                            AS flock_name,
          COUNT(fp.id)                                      AS log_count,
          COALESCE(SUM(fp.egg_count), 0)                   AS total_eggs_30d,
          COALESCE(ROUND(AVG(fp.egg_count)::numeric, 1), 0) AS avg_daily_eggs,
          MAX(fp.egg_count)                                 AS max_daily_eggs,
          MIN(fp.egg_count)                                 AS min_daily_eggs,
          MAX(fp.date)                                      AS last_log_date
        FROM flock_production_logs fp
        JOIN flocks f ON f.id = fp.flock_id
        WHERE fp.date >= CURRENT_DATE - 29
        GROUP BY fp.flock_id, f.name
        ORDER BY total_eggs_30d DESC
      `),

      // ── 17. Flock health events (last 30 days) ────────────────────────────
      db.execute(sql`
        SELECT
          fh.flock_id,
          f.name                                                                AS flock_name,
          COUNT(fh.id)                                                          AS event_count,
          COUNT(CASE WHEN fh.status IN ('sick','quarantine') THEN 1 END)       AS sick_events,
          COUNT(CASE WHEN fh.status = 'healthy' THEN 1 END)                   AS healthy_events,
          COUNT(CASE WHEN fh.status = 'recovering' THEN 1 END)                AS recovering_events,
          MAX(fh.date)                                                          AS last_health_date,
          (SELECT fh2.status FROM flock_health_logs fh2
           WHERE fh2.flock_id = fh.flock_id ORDER BY fh2.date DESC LIMIT 1)  AS latest_status
        FROM flock_health_logs fh
        JOIN flocks f ON f.id = fh.flock_id
        WHERE fh.date >= CURRENT_DATE - 29
        GROUP BY fh.flock_id, f.name
        ORDER BY sick_events DESC
      `),
    ]);

    const fin = (financial.rows[0] ?? {}) as any;
    const feedS = (feedSummary.rows[0] ?? {}) as any;
    const hStats = (hatchingStats.rows[0] ?? {}) as any;
    const top = (topRecords.rows[0] ?? {}) as any;
    const fdAvg = (feedDailyAvg.rows[0] ?? {}) as any;
    const streak = Number((dailyStreak.rows[0] as any)?.streak_days ?? 0);
    const prodList = productionRows.rows as any[];
    const healthList = healthRows.rows as any[];
    const sickFlocks = healthList.filter(r => r.latest_status && ["sick", "quarantine"].includes(r.latest_status)).length;
    const totalEggs30d = prodList.reduce((s, r) => s + Number(r.total_eggs_30d ?? 0), 0);

    // Compute derived metrics
    const totalIncome  = Number(fin.total_income);
    const totalExpense = Number(fin.total_expense);
    const netProfit    = Number(fin.net_profit);
    const margin       = totalIncome > 0 ? (netProfit / totalIncome) * 100 : null;
    const totalKg      = Number(feedS.total_kg ?? 0);
    const feedCost     = Number(feedS.total_cost ?? 0);
    const costPerKg    = totalKg > 0 ? feedCost / totalKg : null;

    // Health score
    let score = 60;
    if (margin !== null) {
      if (margin >= 25) score = 95;
      else if (margin >= 15) score = 82;
      else if (margin >= 5)  score = 68;
      else if (margin >= 0)  score = 52;
      else score = 30;
    }
    if (streak >= 7)  score = Math.min(100, score + 5);
    if (streak >= 30) score = Math.min(100, score + 5);
    const overdueCount = (tasksRows.rows as any[]).filter(t => t.status_computed === "overdue").length;
    if (overdueCount > 3) score = Math.max(0, score - 10);
    if (sickFlocks > 0)   score = Math.max(0, score - (sickFlocks * 8));

    const state = {
      timestamp: new Date().toISOString(),
      health: { score, streak },
      financial: {
        ...fin,
        margin: margin !== null ? Math.round(margin * 10) / 10 : null,
        net_profit: netProfit,
        total_income: totalIncome,
        total_expense: totalExpense,
        monthly: monthlyTrend.rows,
        categories: byCategory.rows,
        top_expense_desc: top.top_expense_desc,
        top_expense_amt:  top.top_expense_amt,
        top_income_desc:  top.top_income_desc,
        top_income_amt:   top.top_income_amt,
        today_tx_count:   top.today_tx_count,
        all_time_count:   top.all_time_count,
        week_days: weekRows.rows,
      },
      feed: {
        ...feedS,
        total_kg: totalKg,
        total_cost: feedCost,
        cost_per_kg: costPerKg !== null ? Math.round(costPerKg) : null,
        avg_daily_cost: fdAvg.avg_daily_feed_cost,
        feed_days: fdAvg.feed_days_count,
        history: feedHistory.rows,
      },
      flocks: {
        list: flocksRows.rows,
        total_birds: (flocksRows.rows as any[]).reduce((s, f) => s + Number(f.count ?? 0), 0),
        count: flocksRows.rows.length,
      },
      hatching: {
        ...hStats,
        cycles: hatchingCycles.rows,
      },
      tasks: {
        all: tasksRows.rows,
        overdue:   (tasksRows.rows as any[]).filter(t => t.status_computed === "overdue"),
        today:     (tasksRows.rows as any[]).filter(t => t.status_computed === "today"),
        upcoming:  (tasksRows.rows as any[]).filter(t => t.status_computed === "upcoming"),
        done:      (tasksRows.rows as any[]).filter(t => t.status_computed === "done"),
      },
      goals: {
        all: goalsRows.rows,
        active:  (goalsRows.rows as any[]).filter(g => g.status_computed !== "done"),
        overdue: (goalsRows.rows as any[]).filter(g => g.status_computed === "overdue"),
        done:    (goalsRows.rows as any[]).filter(g => g.status_computed === "done"),
      },
      notes: notesRows.rows,
      production: {
        summary: prodList,
        total_eggs_30d: totalEggs30d,
        flock_count: prodList.length,
        top_producer: prodList[0] ?? null,
      },
      flockHealth: {
        events: healthList,
        sick_flocks: sickFlocks,
        flock_count: healthList.length,
        critical_flocks: healthList.filter(r => r.latest_status === "quarantine"),
        recovering_flocks: healthList.filter(r => r.latest_status === "recovering"),
      },
    };

    stateCache = { ts: Date.now(), data: state };
    res.setHeader("X-Cache", "MISS");
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── /api/brain/stream  ───────────────────────────────────────────────────────
// Server-Sent Events: pushes brain state diffs every 8 seconds
// Client detects when data changed via lightweight hash comparison
router.get("/brain/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let lastHash = "";
  let closed = false;

  const sendPing = () => {
    if (closed) return;
    res.write(": ping\n\n");
  };

  const sendState = async () => {
    if (closed) return;
    try {
      // Lightweight hash: fetch counts + latest timestamps only
      const snap = await db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM transactions)            AS tx_count,
          (SELECT MAX(created_at) FROM transactions)    AS tx_last,
          (SELECT COUNT(*) FROM flocks)                 AS flock_count,
          (SELECT COUNT(*) FROM hatching_cycles)        AS cycle_count,
          (SELECT COUNT(*) FROM tasks)                  AS task_count,
          (SELECT COUNT(*) FROM daily_notes)            AS note_count,
          (SELECT COUNT(*) FROM flock_production_logs)  AS prod_count,
          (SELECT COUNT(*) FROM flock_health_logs)      AS health_count
      `);
      const row = snap.rows[0] as any;
      const hash = [
        row.tx_count, row.tx_last,
        row.flock_count, row.cycle_count,
        row.task_count, row.note_count,
        row.prod_count, row.health_count,
      ].join(":");

      if (hash !== lastHash) {
        lastHash = hash;
        stateCache = null; // invalidate so next /brain/state fetch is fresh
        res.write(`event: change\ndata: ${JSON.stringify({ hash, ts: Date.now() })}\n\n`);
      } else {
        res.write(`event: tick\ndata: ${JSON.stringify({ hash, ts: Date.now() })}\n\n`);
      }
    } catch {
      // silently continue on transient DB errors
    }
  };

  // Send initial state immediately
  sendState();

  const interval = setInterval(sendState, 8_000);
  const pingInterval = setInterval(sendPing, 25_000);

  req.on("close", () => {
    closed = true;
    clearInterval(interval);
    clearInterval(pingInterval);
  });
});

// ─── /api/brain/audit  ────────────────────────────────────────────────────────
// Full data-integrity audit: detects gaps, inconsistencies, anomalies
router.get("/brain/audit", async (req, res) => {
  const now = Date.now();
  if (auditCache && now - auditCache.ts < AUDIT_TTL && req.query.force !== "1") {
    res.setHeader("X-Cache", "HIT");
    res.json(auditCache.data);
    return;
  }

  try {
    const [
      missingDays,
      catCheck,
      feedQtyCheck,
      duplicateCheck,
      hatchingOverdue,
      goalsOverdue,
      financialBalance,
      dayGaps,
      txPerDay,
      feedFreq,
      noteFreq,
    ] = await Promise.all([

      // Missing-day count in last 30 days
      db.execute(sql`
        WITH series AS (
          SELECT generate_series(CURRENT_DATE - 29, CURRENT_DATE - 1, '1 day')::date AS d
        ),
        active AS (
          SELECT DISTINCT date::date AS d FROM transactions
          UNION
          SELECT DISTINCT date::date AS d FROM daily_notes
        )
        SELECT
          COUNT(s.d) FILTER (WHERE a.d IS NULL)             AS missing_count,
          COUNT(s.d) FILTER (WHERE a.d IS NOT NULL)         AS recorded_count
        FROM series s
        LEFT JOIN active a ON s.d = a.d
      `),

      // Categorisation quality
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE category IS NULL OR category = '')           AS uncategorized,
          COUNT(*) FILTER (WHERE length(trim(description)) < 3)               AS short_desc,
          COUNT(*) FILTER (WHERE amount <= 0)                                  AS zero_amount,
          COUNT(*)                                                             AS total
        FROM transactions
      `),

      // Feed without quantity
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE quantity IS NULL OR quantity = 0)            AS no_qty,
          COUNT(*) FILTER (WHERE unit IS NULL OR unit = '')                   AS no_unit,
          COUNT(*)                                                             AS total_feed
        FROM transactions
        WHERE category = 'feed' OR category = 'علف'
      `),

      // Potential duplicate transactions (same date+type+amount)
      db.execute(sql`
        SELECT COUNT(*) AS dup_groups
        FROM (
          SELECT date::date, type, ROUND(amount::numeric, 0)
          FROM transactions
          GROUP BY date::date, type, ROUND(amount::numeric, 0)
          HAVING COUNT(*) > 1
        ) t
      `),

      // Hatching cycles overdue (active past expected date)
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('active','incubating','lockdown')
                             AND expected_hatch_date::date < CURRENT_DATE)    AS overdue_count,
          array_agg(batch_name)
            FILTER (WHERE status IN ('active','incubating','lockdown')
                      AND expected_hatch_date::date < CURRENT_DATE)           AS overdue_names
        FROM hatching_cycles
      `),

      // Goals past deadline but not done
      db.execute(sql`
        SELECT COUNT(*) AS overdue_goals
        FROM goals
        WHERE completed = false
          AND deadline IS NOT NULL
          AND deadline::date < CURRENT_DATE
      `),

      // Financial balance
      db.execute(sql`
        SELECT
          COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END), 0)     AS total_income,
          COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0)     AS total_expense,
          COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE -amount END),0) AS net,
          CASE WHEN SUM(CASE WHEN type='income' THEN amount ELSE 0 END) > 0
            THEN ROUND(
              SUM(CASE WHEN type='income' THEN amount ELSE -amount END)::numeric /
              SUM(CASE WHEN type='income' THEN amount ELSE 0 END)::numeric * 100, 1)
            ELSE 0 END                                                          AS margin_pct
        FROM transactions
      `),

      // Day-gaps (more than 3 consecutive missing days in last 60)
      db.execute(sql`
        WITH series AS (
          SELECT generate_series(CURRENT_DATE - 59, CURRENT_DATE - 1, '1 day')::date AS d
        ),
        active AS (
          SELECT DISTINCT date::date AS d FROM transactions
          UNION SELECT DISTINCT date::date AS d FROM daily_notes
        ),
        missing AS (
          SELECT s.d FROM series s LEFT JOIN active a ON s.d = a.d WHERE a.d IS NULL
        )
        SELECT COUNT(*) AS long_gap_days
        FROM missing
      `),

      // Transaction frequency (days with ≥1 tx in last 30)
      db.execute(sql`
        SELECT
          COUNT(DISTINCT date::date) AS active_days,
          MAX(date::date)            AS last_date
        FROM transactions
        WHERE date::date >= CURRENT_DATE - 29
      `),

      // Feed frequency (days with feed entry in last 30)
      db.execute(sql`
        SELECT COUNT(DISTINCT date::date) AS feed_days
        FROM transactions
        WHERE date::date >= CURRENT_DATE - 29
          AND (category = 'feed' OR category = 'علف')
      `),

      // Note frequency (last 30)
      db.execute(sql`
        SELECT COUNT(DISTINCT date::date) AS note_days
        FROM daily_notes WHERE date::date >= CURRENT_DATE - 29
      `),
    ]);

    const mc  = (missingDays.rows[0] as any) ?? {};
    const cc  = (catCheck.rows[0]    as any) ?? {};
    const fq  = (feedQtyCheck.rows[0] as any) ?? {};
    const dup = (duplicateCheck.rows[0] as any) ?? {};
    const ho  = (hatchingOverdue.rows[0] as any) ?? {};
    const go  = (goalsOverdue.rows[0] as any) ?? {};
    const fb  = (financialBalance.rows[0] as any) ?? {};
    const dg  = (dayGaps.rows[0] as any) ?? {};
    const tf  = (txPerDay.rows[0] as any) ?? {};
    const ff  = (feedFreq.rows[0] as any) ?? {};
    const nf  = (noteFreq.rows[0] as any) ?? {};

    const issues: { severity: "critical"|"high"|"medium"|"low"; code: string; ar: string; sv: string }[] = [];
    const insights: { type: "positive"|"info"; ar: string; sv: string }[] = [];

    // ── Evaluate issues ──────────────────────────────────────────────────
    const missingCnt = Number(mc.missing_count ?? 0);
    if (missingCnt > 10) {
      issues.push({ severity: "critical", code: "MISSING_MANY_DAYS",
        ar: `${missingCnt} يوم بدون أي تسجيل في آخر 30 يوم — بيانات ناقصة جداً`,
        sv: `${missingCnt} dagar utan registrering — data saknas kritiskt` });
    } else if (missingCnt > 4) {
      issues.push({ severity: "high", code: "MISSING_DAYS",
        ar: `${missingCnt} أيام بدون تسجيل في آخر 30 يوم`,
        sv: `${missingCnt} dagar utan data de senaste 30 dagarna` });
    } else if (missingCnt > 0) {
      issues.push({ severity: "medium", code: "MISSING_FEW_DAYS",
        ar: `${missingCnt} أيام بدون إدخال بيانات`,
        sv: `${missingCnt} dagar utan datainmatning` });
    }

    if (Number(cc.uncategorized) > 0) {
      issues.push({ severity: "high", code: "UNCATEGORIZED",
        ar: `${cc.uncategorized} معاملة بدون تصنيف — يُضعف دقة التحليل`,
        sv: `${cc.uncategorized} transaktioner utan kategori` });
    }
    if (Number(cc.short_desc) > 0) {
      issues.push({ severity: "low", code: "SHORT_DESC",
        ar: `${cc.short_desc} معاملة بوصف قصير جداً (أقل من 3 أحرف)`,
        sv: `${cc.short_desc} transaktioner med för kort beskrivning` });
    }
    if (Number(cc.zero_amount) > 0) {
      issues.push({ severity: "medium", code: "ZERO_AMOUNT",
        ar: `${cc.zero_amount} معاملة بمبلغ صفر أو سالب`,
        sv: `${cc.zero_amount} transaktioner med noll eller negativt belopp` });
    }

    if (Number(fq.no_qty) > 0) {
      issues.push({ severity: "medium", code: "FEED_NO_QTY",
        ar: `${fq.no_qty} إدخال علف بدون كمية — لا يمكن حساب تكلفة الكيلو`,
        sv: `${fq.no_qty} foderinmatningar utan mängd — kostnad per kg kan inte beräknas` });
    }
    if (Number(fq.no_unit) > 0) {
      issues.push({ severity: "low", code: "FEED_NO_UNIT",
        ar: `${fq.no_unit} إدخال علف بدون وحدة قياس`,
        sv: `${fq.no_unit} foderinmatningar utan måttenhet` });
    }

    if (Number(dup.dup_groups) > 0) {
      issues.push({ severity: "high", code: "POTENTIAL_DUPS",
        ar: `${dup.dup_groups} مجموعة معاملات مشبوهة (نفس التاريخ والمبلغ والنوع) — تحقق من التكرار`,
        sv: `${dup.dup_groups} misstänkta dubbletter (samma datum, belopp, typ)` });
    }

    if (Number(ho.overdue_count) > 0) {
      issues.push({ severity: "critical", code: "HATCHING_OVERDUE",
        ar: `${ho.overdue_count} دورة تفقيس تجاوزت موعد الفقس ولم تُحدَّث — تحقق فوراً`,
        sv: `${ho.overdue_count} kläckningscykler har passerat förfallodatum utan uppdatering` });
    }

    if (Number(go.overdue_goals) > 0) {
      issues.push({ severity: "medium", code: "GOALS_OVERDUE",
        ar: `${go.overdue_goals} هدف تجاوز الموعد النهائي بدون إكمال`,
        sv: `${go.overdue_goals} mål har passerat deadline utan att slutföras` });
    }

    if (Number(fb.net) < 0) {
      issues.push({ severity: "critical", code: "LOSS",
        ar: `المزرعة في وضع خسارة — المصاريف تتجاوز الدخل بمقدار ${Math.abs(Number(fb.net)).toLocaleString()} د.ع`,
        sv: `Gården är i förlust — utgifterna överstiger inkomsten` });
    } else if (Number(fb.margin_pct) < 10 && Number(fb.total_income) > 0) {
      issues.push({ severity: "high", code: "LOW_MARGIN",
        ar: `هامش الربح منخفض جداً: ${fb.margin_pct}% (المثالي فوق 15%)`,
        sv: `Låg vinstmarginal: ${fb.margin_pct}% (optimalt > 15%)` });
    }

    // ── Positive insights ────────────────────────────────────────────────
    if (missingCnt === 0) {
      insights.push({ type: "positive",
        ar: "ممتاز! تسجيل يومي متواصل في آخر 30 يوم بدون انقطاع",
        sv: "Utmärkt! Daglig registrering de senaste 30 dagarna utan avbrott" });
    }
    if (Number(cc.uncategorized) === 0 && Number(cc.total) > 0) {
      insights.push({ type: "positive",
        ar: "كل المعاملات مُصنَّفة بشكل صحيح — جودة بيانات ممتازة",
        sv: "Alla transaktioner korrekt kategoriserade — utmärkt datakvalitet" });
    }
    if (Number(fb.margin_pct) >= 20) {
      insights.push({ type: "positive",
        ar: `هامش الربح ${fb.margin_pct}% — أداء مالي ممتاز فوق المعيار الصناعي`,
        sv: `Vinstmarginal ${fb.margin_pct}% — utmärkt finansiell prestanda` });
    }
    if (Number(tf.active_days) >= 25) {
      insights.push({ type: "positive",
        ar: `${tf.active_days} يوم نشط من أصل 30 — انتظام عالٍ في التوثيق`,
        sv: `${tf.active_days} aktiva dagar av 30 — hög dokumentationskonsistens` });
    }

    const auditData = {
      timestamp: new Date().toISOString(),
      score: Math.max(0, 100 - issues.filter(i => i.severity === "critical").length * 25
                             - issues.filter(i => i.severity === "high").length * 12
                             - issues.filter(i => i.severity === "medium").length * 6
                             - issues.filter(i => i.severity === "low").length * 2),
      issues,
      insights,
      stats: {
        missing_days:   missingCnt,
        recorded_days:  Number(mc.recorded_count ?? 0),
        total_tx:       Number(cc.total ?? 0),
        active_days_30: Number(tf.active_days ?? 0),
        feed_days_30:   Number(ff.feed_days ?? 0),
        note_days_30:   Number(nf.note_days ?? 0),
        dup_groups:     Number(dup.dup_groups ?? 0),
        margin_pct:     Number(fb.margin_pct ?? 0),
        net:            Number(fb.net ?? 0),
      },
    };

    auditCache = { ts: Date.now(), data: auditData };
    res.setHeader("X-Cache", "MISS");
    res.json(auditData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
