import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, flocksTable, flockProductionLogsTable, flockHealthLogsTable } from "@workspace/db";

const router: IRouter = Router();

// ── Serialization ─────────────────────────────────────────────────────────────

function serializeFlock(f: typeof flocksTable.$inferSelect) {
  return {
    ...f,
    feedConsumptionKg: f.feedConsumptionKg ? Number(f.feedConsumptionKg) : null,
    birthDate:  f.birthDate  ?? null,
    createdAt:  f.createdAt instanceof Date ? f.createdAt.toISOString() : f.createdAt,
  };
}

// ── GET /api/flocks — list all flocks with aggregated stats ───────────────────

router.get("/flocks", async (_req, res) => {
  const flocks = await db.select().from(flocksTable).orderBy(flocksTable.createdAt);

  // Aggregate last 7 days of production per flock in one query
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  const prodRows = await db
    .select({
      flockId:     flockProductionLogsTable.flockId,
      totalEggs7d: sql<number>`coalesce(sum(${flockProductionLogsTable.eggCount}),0)::int`,
      avgDaily7d:  sql<number>`coalesce(avg(${flockProductionLogsTable.eggCount}),0)::float`,
      latestDate:  sql<string>`max(${flockProductionLogsTable.date})`,
    })
    .from(flockProductionLogsTable)
    .where(sql`${flockProductionLogsTable.date} >= ${sevenDaysAgoStr}`)
    .groupBy(flockProductionLogsTable.flockId);

  const prodMap = new Map(prodRows.map(r => [r.flockId, r]));

  const result = flocks.map(f => {
    const prod = prodMap.get(f.id);
    return {
      ...serializeFlock(f),
      totalEggs7d:   prod?.totalEggs7d ?? 0,
      avgDaily7d:    prod ? Math.round(prod.avgDaily7d * 10) / 10 : 0,
      latestLogDate: prod?.latestDate  ?? null,
    };
  });

  res.json(result);
});

// ── POST /api/flocks ───────────────────────────────────────────────────────────

router.post("/flocks", async (req, res) => {
  const body = req.body as {
    name: string; breed: string; count: number; ageDays: number;
    birthDate?: string | null; purpose: string; healthStatus?: string;
    feedConsumptionKg?: number | null; dailyEggTarget?: number | null; notes?: string | null;
  };
  if (!body.name || !body.breed || !body.count || !body.purpose) {
    res.status(400).json({ error: "الحقول المطلوبة: name, breed, count, purpose" }); return;
  }
  const [flock] = await db.insert(flocksTable).values({
    name:               body.name,
    breed:              body.breed,
    count:              body.count,
    ageDays:            body.ageDays,
    birthDate:          body.birthDate ?? null,
    purpose:            body.purpose,
    healthStatus:       body.healthStatus ?? "healthy",
    feedConsumptionKg:  body.feedConsumptionKg != null ? String(body.feedConsumptionKg) : null,
    dailyEggTarget:     body.dailyEggTarget ?? null,
    notes:              body.notes ?? null,
  }).returning();
  res.status(201).json(serializeFlock(flock));
});

// ══ ANALYTICS (must be before /:id to avoid param conflict) ══════════════════

router.get("/flocks/analytics/summary", async (_req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  const [totals] = await db.select({
    flockCount:   sql<number>`count(*)::int`,
    totalBirds:   sql<number>`coalesce(sum(${flocksTable.count}), 0)::int`,
    healthyCount: sql<number>`count(*) filter (where ${flocksTable.healthStatus} = 'healthy')::int`,
    sickCount:    sql<number>`count(*) filter (where ${flocksTable.healthStatus} in ('sick','quarantine'))::int`,
  }).from(flocksTable);

  const prodByFlock = await db
    .select({
      flockId:   flockProductionLogsTable.flockId,
      totalEggs: sql<number>`coalesce(sum(${flockProductionLogsTable.eggCount}),0)::int`,
      avgDaily:  sql<number>`coalesce(avg(${flockProductionLogsTable.eggCount}),0)::float`,
    })
    .from(flockProductionLogsTable)
    .where(sql`${flockProductionLogsTable.date} >= ${sevenDaysAgoStr}`)
    .groupBy(flockProductionLogsTable.flockId)
    .orderBy(desc(sql`sum(${flockProductionLogsTable.eggCount})`));

  const topProducerId = prodByFlock[0]?.flockId ?? null;
  let topProducerName: string | null = null;
  if (topProducerId) {
    const [tp] = await db.select({ name: flocksTable.name }).from(flocksTable).where(eq(flocksTable.id, topProducerId));
    topProducerName = tp?.name ?? null;
  }

  const totalEggs7d = prodByFlock.reduce((s, r) => s + r.totalEggs, 0);
  const avgDailyAllFlocks = prodByFlock.length > 0
    ? Math.round(prodByFlock.reduce((s, r) => s + r.avgDaily, 0) / prodByFlock.length * 10) / 10
    : 0;

  res.json({
    flockCount:          totals?.flockCount       ?? 0,
    totalBirds:          totals?.totalBirds        ?? 0,
    healthyCount:        totals?.healthyCount      ?? 0,
    sickCount:           totals?.sickCount         ?? 0,
    totalEggs7d,
    avgDailyAllFlocks,
    topProducerId,
    topProducerName,
    topProducerAvgDaily: prodByFlock[0] ? Math.round(prodByFlock[0].avgDaily * 10) / 10 : 0,
    today,
  });
});

// ── GET /api/flocks/:id ────────────────────────────────────────────────────────

router.get("/flocks/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرف غير صحيح" }); return; }
  const [flock] = await db.select().from(flocksTable).where(eq(flocksTable.id, id));
  if (!flock) { res.status(404).json({ error: "المجموعة غير موجودة" }); return; }
  res.json(serializeFlock(flock));
});

// ── PUT /api/flocks/:id ────────────────────────────────────────────────────────

router.put("/flocks/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرف غير صحيح" }); return; }
  const body = req.body as Record<string, unknown>;
  const updateData: Record<string, unknown> = { ...body };
  if (body.feedConsumptionKg != null) {
    updateData.feedConsumptionKg = String(body.feedConsumptionKg);
  }
  const [flock] = await db.update(flocksTable)
    .set(updateData)
    .where(eq(flocksTable.id, id))
    .returning();
  if (!flock) { res.status(404).json({ error: "المجموعة غير موجودة" }); return; }
  res.json(serializeFlock(flock));
});

// ── DELETE /api/flocks/:id ─────────────────────────────────────────────────────

router.delete("/flocks/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرف غير صحيح" }); return; }
  await db.delete(flocksTable).where(eq(flocksTable.id, id));
  res.status(204).send();
});

// ══ PRODUCTION LOGS ═══════════════════════════════════════════════════════════

// GET /api/flocks/:id/production-logs
router.get("/flocks/:id/production-logs", async (req, res) => {
  const flockId = Number(req.params.id);
  if (isNaN(flockId)) { res.status(400).json({ error: "معرف غير صحيح" }); return; }
  const logs = await db
    .select()
    .from(flockProductionLogsTable)
    .where(eq(flockProductionLogsTable.flockId, flockId))
    .orderBy(desc(flockProductionLogsTable.date));
  res.json(logs.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })));
});

// POST /api/flocks/:id/production-logs
router.post("/flocks/:id/production-logs", async (req, res) => {
  const flockId = Number(req.params.id);
  if (isNaN(flockId)) { res.status(400).json({ error: "معرف غير صحيح" }); return; }
  const body = req.body as { date: string; eggCount: number; notes?: string | null };
  if (!body.date || body.eggCount == null) {
    res.status(400).json({ error: "الحقول المطلوبة: date, eggCount" }); return;
  }
  const [log] = await db.insert(flockProductionLogsTable).values({
    flockId, date: body.date, eggCount: body.eggCount, notes: body.notes ?? null,
  }).returning();
  res.status(201).json({ ...log, createdAt: log.createdAt.toISOString() });
});

// DELETE /api/flock-production-logs/:id
router.delete("/flock-production-logs/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرف غير صحيح" }); return; }
  await db.delete(flockProductionLogsTable).where(eq(flockProductionLogsTable.id, id));
  res.status(204).send();
});

// ══ HEALTH LOGS ═══════════════════════════════════════════════════════════════

// GET /api/flocks/:id/health-logs
router.get("/flocks/:id/health-logs", async (req, res) => {
  const flockId = Number(req.params.id);
  if (isNaN(flockId)) { res.status(400).json({ error: "معرف غير صحيح" }); return; }
  const logs = await db
    .select()
    .from(flockHealthLogsTable)
    .where(eq(flockHealthLogsTable.flockId, flockId))
    .orderBy(desc(flockHealthLogsTable.date));
  res.json(logs.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })));
});

// POST /api/flocks/:id/health-logs
router.post("/flocks/:id/health-logs", async (req, res) => {
  const flockId = Number(req.params.id);
  if (isNaN(flockId)) { res.status(400).json({ error: "معرف غير صحيح" }); return; }
  const body = req.body as { date: string; status: string; symptoms?: string | null; treatment?: string | null; notes?: string | null };
  if (!body.date || !body.status) {
    res.status(400).json({ error: "الحقول المطلوبة: date, status" }); return;
  }

  // Update flock's current health status
  await db.update(flocksTable).set({ healthStatus: body.status }).where(eq(flocksTable.id, flockId));

  const [log] = await db.insert(flockHealthLogsTable).values({
    flockId, date: body.date, status: body.status,
    symptoms:  body.symptoms  ?? null,
    treatment: body.treatment ?? null,
    notes:     body.notes     ?? null,
  }).returning();
  res.status(201).json({ ...log, createdAt: log.createdAt.toISOString() });
});

// DELETE /api/flock-health-logs/:id
router.delete("/flock-health-logs/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرف غير صحيح" }); return; }
  await db.delete(flockHealthLogsTable).where(eq(flockHealthLogsTable.id, id));
  res.status(204).send();
});

export default router;
