/**
 * validation.ts — System Health & Data Integrity
 * ═══════════════════════════════════════════════════════════════════════════
 * GET  /api/server-time             — public clock-sync endpoint
 * GET  /api/validate/integrity      — full data-integrity audit (auth required)
 * POST /api/dev/seed-transactions   — stress-test seed (dev only, auth required)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Router, type IRouter } from "express";
import { db, transactionsTable, activityLogsTable, tasksTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import {
  categoryToDomain,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  validateCategoryDomainConsistency,
} from "../lib/farmDomains.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// ─── Server Time ─────────────────────────────────────────────────────────────
// Public — no auth. Used by HatchingLiveTracker to synchronise device clock.
router.get("/server-time", (_req, res) => {
  const now = new Date();
  res.json({
    serverTime: now.toISOString(),
    timestamp:  now.getTime(),
  });
});

// ─── Data Integrity Audit (admin only) ────────────────────────────────────────
router.get("/validate/integrity", async (req, res) => {
  if ((req as any).session?.role !== "admin") {
    res.status(403).json({ success: false, error: "هذه العملية مقتصرة على المديرين" });
    return;
  }
  const startMs = Date.now();
  const issues: Array<{ severity: "critical" | "warning"; check: string; detail: string }> = [];

  try {
    // ── 1. Transactions: domain correctness ───────────────────────────────
    const allTx = await db.select({
      id:       transactionsTable.id,
      type:     transactionsTable.type,
      category: transactionsTable.category,
      domain:   transactionsTable.domain,
      amount:   transactionsTable.amount,
    }).from(transactionsTable);

    let nullDomainCount = 0;
    let domainMismatchCount = 0;
    let categoryViolationCount = 0;
    let eggClassifiedAsFeedCount = 0;

    for (const tx of allTx) {
      // Check 1a: domain is not null
      if (!tx.domain) {
        nullDomainCount++;
        issues.push({
          severity: "critical",
          check: "null_domain",
          detail: `Transaction #${tx.id} (${tx.category}) has null domain`,
        });
        continue;
      }

      // Check 1b: domain matches SSOT derivation
      const expectedDomain = categoryToDomain(tx.category ?? "other");
      if (tx.domain !== expectedDomain) {
        domainMismatchCount++;
        issues.push({
          severity: "critical",
          check: "domain_mismatch",
          detail: `Transaction #${tx.id}: domain="${tx.domain}" but categoryToDomain("${tx.category}")="${expectedDomain}"`,
        });
      }

      // Check 1c: category is valid for its type
      const catError = validateCategoryDomainConsistency(
        tx.type as "income" | "expense",
        tx.category ?? "other",
      );
      if (catError) {
        categoryViolationCount++;
        issues.push({
          severity: "critical",
          check: "category_type_violation",
          detail: `Transaction #${tx.id}: ${catError}`,
        });
      }

      // Check 1d: egg categories are NEVER in feed domain (the original bug)
      const eggExpenseCategories = [EXPENSE_CATEGORIES.EGGS_PURCHASE, EXPENSE_CATEGORIES.INCUBATION_SUPPLIES];
      if (eggExpenseCategories.includes(tx.category as any) && tx.domain === "feed") {
        eggClassifiedAsFeedCount++;
        issues.push({
          severity: "critical",
          check: "egg_classified_as_feed",
          detail: `Transaction #${tx.id}: category="${tx.category}" is in egg domain but domain is set to "feed" — critical classification bug`,
        });
      }
    }

    // ── 2. Activity logs: orphaned task_id references ─────────────────────
    const orphanResult = await db.execute(sql`
      SELECT al.id, al.task_id
      FROM activity_logs al
      LEFT JOIN tasks t ON al.task_id = t.id
      WHERE al.task_id IS NOT NULL AND t.id IS NULL
    `);
    const orphanCount = orphanResult.rows.length;
    for (const row of orphanResult.rows as any[]) {
      issues.push({
        severity: "warning",
        check: "orphan_task_id",
        detail: `ActivityLog #${row.id} references non-existent task #${row.task_id}`,
      });
    }

    // ── 3. Transactions with null amount ─────────────────────────────────
    const nullAmountResult = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM transactions
      WHERE amount IS NULL OR amount::numeric = 0
    `);
    const nullAmountCount = Number((nullAmountResult.rows[0] as any).cnt ?? 0);
    if (nullAmountCount > 0) {
      issues.push({
        severity: "warning",
        check: "null_amount",
        detail: `${nullAmountCount} transaction(s) have empty/null amount`,
      });
    }

    // ── 4. Domain distribution sanity ────────────────────────────────────
    const domainDistResult = await db.execute(sql`
      SELECT domain, COUNT(*) as cnt
      FROM transactions
      WHERE domain IS NOT NULL
      GROUP BY domain
      ORDER BY cnt DESC
    `);
    const domainDist: Record<string, number> = {};
    for (const row of domainDistResult.rows as any[]) {
      domainDist[row.domain] = Number(row.cnt);
    }

    // ── 5. Category coverage (any unknown category strings?) ─────────────
    const allKnownCategories = new Set([
      ...Object.values(EXPENSE_CATEGORIES),
      ...Object.values(INCOME_CATEGORIES),
    ]);
    const unknownCatResult = await db.execute(sql`
      SELECT DISTINCT category FROM transactions
      WHERE category IS NOT NULL
    `);
    const unknownCategories: string[] = [];
    for (const row of unknownCatResult.rows as any[]) {
      if (!allKnownCategories.has(row.category)) {
        unknownCategories.push(row.category);
        issues.push({
          severity: "warning",
          check: "unknown_category",
          detail: `Category "${row.category}" is not in SSOT farmDomains.ts`,
        });
      }
    }

    const durationMs = Date.now() - startMs;
    const criticalIssues = issues.filter(i => i.severity === "critical");
    const status = criticalIssues.length === 0 ? "ok" : "issues";

    logger.info(
      { status, criticalCount: criticalIssues.length, totalIssues: issues.length, durationMs },
      "[integrity] audit completed",
    );

    res.json({
      status,
      durationMs,
      checkedAt: new Date().toISOString(),
      summary: {
        totalTransactions:      allTx.length,
        nullDomainCount,
        domainMismatchCount,
        categoryViolationCount,
        eggClassifiedAsFeedCount,
        orphanActivityLogs:     orphanCount,
        nullAmountCount,
        unknownCategories,
        domainDistribution:     domainDist,
      },
      issues,
      passed: [
        ...(nullDomainCount        === 0 ? ["All transactions have a domain set"] : []),
        ...(domainMismatchCount    === 0 ? ["All domains match SSOT categoryToDomain()"] : []),
        ...(categoryViolationCount === 0 ? ["All categories are valid for their transaction type"] : []),
        ...(eggClassifiedAsFeedCount === 0 ? ["No egg categories mis-classified as feed domain"] : []),
        ...(orphanCount            === 0 ? ["No orphaned task_id references in activity_logs"] : []),
        ...(nullAmountCount        === 0 ? ["All transactions have an amount"] : []),
        ...(unknownCategories.length === 0 ? ["All categories are in SSOT farmDomains.ts"] : []),
      ],
    });
  } catch (e: any) {
    logger.error({ err: e }, "[integrity] audit failed");
    res.status(500).json({ error: e.message });
  }
});

// ─── Dev-only Stress Test (DRY-RUN — always auto-rollback) ───────────────────
// ⚠️  SANDBOX MODE: The transaction is ALWAYS rolled back at the end.
//     No data is ever persisted to the database, even on "success".
//     This measures real DB performance (wire + index overhead) without
//     polluting production data.
// Guarded by NODE_ENV !== "production" — never available in production.
const STRESS_ROLLBACK = Symbol("STRESS_TEST_DRY_RUN_ROLLBACK");

router.post("/dev/seed-transactions", async (req, res) => {
  if ((req as any).session?.role !== "admin") {
    res.status(403).json({ success: false, error: "هذه العملية مقتصرة على المديرين" });
    return;
  }
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "Not available in production" });
    return;
  }

  const count = Math.min(Number(req.body?.count ?? 200), 2000);
  const expenseCategories = Object.values(EXPENSE_CATEGORIES);
  const incomeCategories  = Object.values(INCOME_CATEGORIES);
  const BATCH_SIZE = 100;

  let simulated = 0;
  const domainCounts: Record<string, number> = {};

  const startMs = Date.now();

  try {
    await db.transaction(async (tx) => {
      const rows: Array<typeof transactionsTable.$inferInsert> = [];

      for (let i = 0; i < count; i++) {
        const isExpense = i % 3 !== 0;
        const category = isExpense
          ? expenseCategories[i % expenseCategories.length]
          : incomeCategories[i % incomeCategories.length];
        const domain = categoryToDomain(category);
        const amount = (50 + (i % 500)).toFixed(2);
        const daysAgo = i % 90;
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        const date = d.toISOString().split("T")[0];

        rows.push({
          date,
          type:        isExpense ? "expense" : "income",
          category,
          domain,
          description: `[DRY-RUN] Stress transaction #${i + 1} — ${category}`,
          amount,
          notes:       "stress-test-dry-run",
        });

        domainCounts[domain] = (domainCounts[domain] ?? 0) + 1;

        if (rows.length >= BATCH_SIZE) {
          await tx.insert(transactionsTable).values([...rows]);
          simulated += rows.length;
          rows.length = 0;
        }
      }

      if (rows.length > 0) {
        await tx.insert(transactionsTable).values([...rows]);
        simulated += rows.length;
      }

      // ── ALWAYS ROLLBACK — this is a sandbox / dry-run ──
      // Throwing here forces Drizzle to issue ROLLBACK, so no rows are committed.
      throw STRESS_ROLLBACK;
    });
  } catch (e) {
    if (e !== STRESS_ROLLBACK) {
      // A real error occurred — report it
      logger.error({ err: e }, "[dev/seed] stress-test error");
      res.status(500).json({ error: (e as any)?.message ?? "stress test failed" });
      return;
    }
    // STRESS_ROLLBACK is expected — swallow it, all rows were rolled back
  }

  const durationMs = Date.now() - startMs;
  const throughput  = Math.round(simulated / Math.max(durationMs / 1000, 0.001));

  logger.info(
    { simulated, durationMs, throughput, rolledBack: true },
    "[dev/seed] dry-run stress test complete — 0 rows persisted (auto-rollback)",
  );

  res.json({
    simulated,
    persisted:       0,           // always zero — sandbox mode
    durationMs,
    throughputPerSec: throughput,
    domainBreakdown:  domainCounts,
    mode: "dry-run",
    note: "SANDBOX MODE — transaction was auto-rolled back. Zero rows written to DB. Performance metrics are real.",
  });
});

// ─── Auto-Repair: fix null domains ────────────────────────────────────────────
router.post("/validate/repair", async (req, res) => {
  if ((req as any).session?.role !== "admin") {
    res.status(403).json({ success: false, error: "هذه العملية مقتصرة على المديرين" });
    return;
  }
  try {
    const nullDomainTx = await db.select({
      id:       transactionsTable.id,
      category: transactionsTable.category,
    }).from(transactionsTable).where(sql`domain IS NULL`);

    let fixed = 0;
    for (const tx of nullDomainTx) {
      const correctDomain = categoryToDomain(tx.category);
      await db.update(transactionsTable)
        .set({ domain: correctDomain })
        .where(eq(transactionsTable.id, tx.id));
      fixed++;
    }

    logger.info({ fixed }, "[validate/repair] null domains patched");
    res.json({ success: true, fixed, message: fixed === 0 ? "No repairs needed" : `Fixed ${fixed} transaction(s)` });
  } catch (e: any) {
    logger.error({ err: e }, "[validate/repair] failed");
    res.status(500).json({ success: false, error: e.message });
  }
});

// Purge any legacy seed data written before the dry-run mode was introduced
router.delete("/dev/seed-transactions", async (req, res) => {
  if ((req as any).session?.role !== "admin") {
    res.status(403).json({ success: false, error: "هذه العملية مقتصرة على المديرين" });
    return;
  }
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "Not available in production" });
    return;
  }
  try {
    const result = await db.execute(sql`
      DELETE FROM transactions
      WHERE notes = 'stress-test seed data' OR notes = 'stress-test-dry-run'
    `);
    const deleted = (result as any).rowCount ?? 0;
    logger.info({ deleted }, "[dev/seed] legacy stress-test data purged");
    res.json({ deleted, message: deleted === 0 ? "No seed data found — database is already clean" : `Deleted ${deleted} seed rows` });
  } catch (e: any) {
    logger.error({ err: e }, "[dev/seed] purge failed");
    res.status(500).json({ error: e.message });
  }
});

export default router;
