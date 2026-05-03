/**
 * FEED INTELLIGENCE API v1.0
 * ──────────────────────────
 * Routes:
 *   GET  /api/feed-intelligence/summary      - full farm feed analysis
 *   GET  /api/feed-intelligence/flocks       - per-flock breakdown
 *   GET  /api/feed-intelligence/benchmarks   - breed benchmark data
 *   POST /api/feed-intelligence/records      - add feed purchase record
 *   GET  /api/feed-intelligence/records      - list feed records
 */

import { Router, type Request, type Response } from "express";
import { db, flocksTable, transactionsTable, flockProductionLogsTable, feedRecordsTable, feedRecordAllocationsTable } from "@workspace/db";
import { desc, gte, lte, and, eq, inArray, sql } from "drizzle-orm";
import { runFeedCostEngine } from "../lib/feed-cost-engine.js";
import { BREED_PROFILES, getBreedProfile, getExpectedProductionPct, getExpectedDailyFeedGrams, classifyGrowthStage, GLOBAL_BENCHMARKS } from "../lib/breed-benchmarks.js";
const router = Router();

// ── /api/feed-intelligence/summary ────────────────────────────────────────────
router.get("/feed-intelligence/summary", async (req: Request, res: Response) => {
  try {
    const periodDays = Math.min(Number(req.query.days ?? 30), 365);

    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setDate(now.getDate() - periodDays);
    const windowStartStr = windowStart.toISOString().split("T")[0];
    const todayStr = now.toISOString().split("T")[0];

    const [flocks, feedTxAll, prodLogs, feedRecords, allExpenses] = await Promise.all([
      db.select().from(flocksTable),
      db.select().from(transactionsTable)
        .where(and(gte(transactionsTable.date, windowStartStr), lte(transactionsTable.date, todayStr)))
        .orderBy(desc(transactionsTable.date)),
      db.select().from(flockProductionLogsTable)
        .where(and(gte(flockProductionLogsTable.date, windowStartStr), lte(flockProductionLogsTable.date, todayStr))),
      db.select().from(feedRecordsTable)
        .where(and(gte(feedRecordsTable.date, windowStartStr), lte(feedRecordsTable.date, todayStr)))
        .orderBy(desc(feedRecordsTable.date)),
      db.select({ total: sql<number>`coalesce(sum(amount), 0)::float` })
        .from(transactionsTable)
        .where(and(
          eq(transactionsTable.type, "expense"),
          gte(transactionsTable.date, windowStartStr),
          lte(transactionsTable.date, todayStr),
        )),
    ]);

    // Load allocations for feed records
    const recordIds = feedRecords.map(r => r.id);
    const allocations = recordIds.length > 0
      ? await db.select().from(feedRecordAllocationsTable)
          .where(inArray(feedRecordAllocationsTable.feedRecordId, recordIds))
      : [];

    const allocationsByRecord: Record<number, Array<{ flockId: number; quantityKg: number }>> = {};
    for (const alloc of allocations) {
      if (!allocationsByRecord[alloc.feedRecordId]) allocationsByRecord[alloc.feedRecordId] = [];
      allocationsByRecord[alloc.feedRecordId].push({
        flockId: alloc.flockId,
        quantityKg: Number(alloc.quantityKg),
      });
    }

    const totalExpenses = Number((allExpenses[0] as any)?.total ?? 0);

    const result = runFeedCostEngine({
      flocks: flocks.map(f => ({
        id: f.id,
        name: f.name,
        breed: f.breed,
        count: f.count,
        ageDays: f.ageDays,
        purpose: (f.purpose as any) ?? "eggs",
        healthStatus: f.healthStatus,
      })),
      transactions: feedTxAll.map(t => ({
        id: t.id,
        date: t.date,
        type: t.type,
        category: t.category,
        domain: t.domain ?? undefined,
        amount: Number(t.amount),
        quantity: t.quantity ? Number(t.quantity) : null,
        unit: t.unit ?? undefined,
        description: t.description,
      })),
      productionLogs: prodLogs.map(p => ({
        flockId: p.flockId,
        date: p.date,
        eggCount: p.eggCount,
      })),
      feedRecords: feedRecords.map(r => ({
        id: r.id,
        date: r.date,
        feedType: r.feedType,
        quantityKg: Number(r.quantityKg),
        pricePerKg: Number(r.pricePerKg),
        totalCost: Number(r.totalCost),
        allocations: allocationsByRecord[r.id] ?? [],
      })),
      periodDays,
      totalExpenses,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Feed analysis failed" });
  }
});

// ── /api/feed-intelligence/flocks ─────────────────────────────────────────────
router.get("/feed-intelligence/flocks", async (req: Request, res: Response) => {
  try {
    const flocks = await db.select().from(flocksTable);

    const result = flocks.map(f => {
      const stage = classifyGrowthStage(f.ageDays, (f.purpose as any) ?? "eggs", f.breed);
      const expectedFeed = getExpectedDailyFeedGrams(f.breed, f.ageDays);
      const expectedProd = getExpectedProductionPct(f.breed, f.ageDays);
      const profile = getBreedProfile(f.breed);

      return {
        id: f.id,
        name: f.name,
        breed: f.breed,
        count: f.count,
        ageDays: f.ageDays,
        ageWeeks: Math.round(f.ageDays / 7 * 10) / 10,
        growthStage: stage,
        purpose: f.purpose,
        healthStatus: f.healthStatus,
        benchmark: {
          expectedDailyFeedGrams: Math.round(expectedFeed * 10) / 10,
          expectedProductionPct: Math.round(expectedProd * 10) / 10,
          totalDailyFeedKg: Math.round(expectedFeed * f.count / 1000 * 100) / 100,
          expectedFCR: profile.fcr.byStage[stage] ?? profile.fcr.overall,
          breedPeakPct: profile.production?.peakPct ?? null,
          breedPeakWeek: profile.production?.peakWeek ?? null,
        },
      };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── /api/feed-intelligence/benchmarks ──────────────────────────────────────────
router.get("/feed-intelligence/benchmarks", async (_req: Request, res: Response) => {
  res.json({
    breeds: Object.entries(BREED_PROFILES)
      .filter(([k]) => k !== "_default")
      .map(([, v]) => ({
        id: v.id,
        nameAr: v.nameAr,
        nameSv: v.nameSv,
        nameEn: v.nameEn,
        purpose: v.purpose,
        fcr: v.fcr,
        mortalityRate: v.mortalityRate,
        maturityAgeDays: v.maturityAgeDays,
        peakProductionPct: v.production?.peakPct ?? null,
        peakProductionWeek: v.production?.peakWeek ?? null,
        productionStartWeek: v.production?.startWeek ?? null,
      })),
    global: GLOBAL_BENCHMARKS,
  });
});

// ── POST /api/feed-intelligence/records ───────────────────────────────────────
router.post("/feed-intelligence/records", async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      date: string;
      feedType: string;
      brand?: string;
      quantityKg: number;
      pricePerKg: number;
      supplier?: string;
      transactionId?: number;
      notes?: string;
      allocations?: Array<{ flockId: number; quantityKg: number }>;
    };
    if (!body.date || !body.feedType || !body.quantityKg || !body.pricePerKg) {
      res.status(400).json({ error: "date, feedType, quantityKg, pricePerKg are required" });
      return;
    }
    const totalCost = Number(body.quantityKg) * Number(body.pricePerKg);

    const [record] = await db.insert(feedRecordsTable).values({
      date: body.date,
      feedType: body.feedType,
      brand: body.brand,
      quantityKg: String(body.quantityKg),
      pricePerKg: String(body.pricePerKg),
      totalCost: String(totalCost),
      supplier: body.supplier,
      transactionId: body.transactionId,
      notes: body.notes,
    }).returning();

    if (body.allocations && body.allocations.length > 0) {
      await db.insert(feedRecordAllocationsTable).values(
        body.allocations.map(a => ({
          feedRecordId: record.id,
          flockId: a.flockId,
          quantityKg: String(a.quantityKg),
        }))
      );
    }

    res.status(201).json(record);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/feed-intelligence/records ───────────────────────────────────────
router.get("/feed-intelligence/records", async (_req: Request, res: Response) => {
  try {
    const records = await db.select().from(feedRecordsTable).orderBy(desc(feedRecordsTable.date)).limit(100);
    res.json(records);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
