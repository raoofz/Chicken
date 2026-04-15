import { Router, type Request, type Response } from "express";
import { db, productionLogsTable, feedLogsTable, waterLogsTable, environmentLogsTable, mortalityLogsTable, flocksTable, hatchingCyclesTable, transactionsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { generateIntelligenceReport, type FarmData } from "../lib/farmIntelligence";

const router = Router();

function requireAuth(req: Request, res: Response, next: any) {
  if (!req.session.userId) { res.status(401).json({ error: "unauthorized" }); return; }
  next();
}

router.get("/intelligence/report", requireAuth, async (req: Request, res: Response) => {
  try {
    const lang = (req.query.lang === "sv" ? "sv" : "ar") as "ar" | "sv";

    const [flocks, production, feed, water, environment, mortality, hatching, transactions] = await Promise.all([
      db.select().from(flocksTable),
      db.select().from(productionLogsTable).orderBy(desc(productionLogsTable.date)).limit(90),
      db.select().from(feedLogsTable).orderBy(desc(feedLogsTable.date)).limit(90),
      db.select().from(waterLogsTable).orderBy(desc(waterLogsTable.date)).limit(90),
      db.select().from(environmentLogsTable).orderBy(desc(environmentLogsTable.date)).limit(90),
      db.select().from(mortalityLogsTable).orderBy(desc(mortalityLogsTable.date)).limit(90),
      db.select().from(hatchingCyclesTable),
      db.select().from(transactionsTable),
    ]);

    const farmData: FarmData = {
      flocks: flocks.map(f => ({ id: f.id, name: f.name, count: f.count, ageDays: f.ageDays, purpose: f.purpose })),
      production: production.reverse().map(p => ({
        date: p.date, eggsCollected: p.eggsCollected, eggsBroken: p.eggsBroken ?? 0,
        eggsWeight: p.eggsWeight ? Number(p.eggsWeight) : null, flockId: p.flockId,
      })),
      feed: feed.reverse().map(f => ({
        date: f.date, quantityKg: Number(f.quantityKg), totalCost: f.totalCost ? Number(f.totalCost) : null,
        feedType: f.feedType, flockId: f.flockId,
      })),
      water: water.reverse().map(w => ({
        date: w.date, quantityLiters: Number(w.quantityLiters), flockId: w.flockId,
      })),
      environment: environment.reverse().map(e => ({
        date: e.date, temperatureC: Number(e.temperatureC), humidityPct: e.humidityPct ? Number(e.humidityPct) : null,
      })),
      mortality: mortality.reverse().map(m => ({
        date: m.date, count: m.count, cause: m.cause, flockId: m.flockId,
      })),
      hatching: hatching.map(h => ({
        eggsSet: h.eggsSet, eggsHatched: h.eggsHatched, status: h.status,
      })),
      transactions: transactions.map(t => ({
        type: t.type, amount: Number(t.amount), category: t.category,
      })),
    };

    const report = generateIntelligenceReport(farmData, lang);
    res.json(report);
  } catch (err: any) {
    console.error("[Intelligence] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Production Logs CRUD ──────────────────────────────────────
router.get("/production", requireAuth, async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(productionLogsTable).orderBy(desc(productionLogsTable.date)).limit(200);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/production", requireAuth, async (req: Request, res: Response) => {
  try {
    const { flockId, date, eggsCollected, eggsBroken, eggsWeight, notes } = req.body ?? {};
    if (!date || eggsCollected == null) { res.status(400).json({ error: "date, eggsCollected required" }); return; }
    const [row] = await db.insert(productionLogsTable).values({
      flockId: flockId ?? null, date, eggsCollected: Number(eggsCollected), eggsBroken: Number(eggsBroken ?? 0),
      eggsWeight: eggsWeight ?? null, notes: notes ?? null,
      authorId: req.session.userId ?? null, authorName: req.session.name ?? null,
    }).returning();
    res.json(row);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/production/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await db.delete(productionLogsTable).where(eq(productionLogsTable.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Feed Logs CRUD ────────────────────────────────────────────
router.get("/feed", requireAuth, async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(feedLogsTable).orderBy(desc(feedLogsTable.date)).limit(200);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/feed", requireAuth, async (req: Request, res: Response) => {
  try {
    const { flockId, date, feedType, quantityKg, costPerKg, totalCost, notes } = req.body ?? {};
    if (!date || !feedType || !quantityKg) { res.status(400).json({ error: "date, feedType, quantityKg required" }); return; }
    const [row] = await db.insert(feedLogsTable).values({
      flockId: flockId ?? null, date, feedType, quantityKg,
      costPerKg: costPerKg ?? null, totalCost: totalCost ?? null, notes: notes ?? null,
      authorId: req.session.userId ?? null, authorName: req.session.name ?? null,
    }).returning();
    res.json(row);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/feed/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await db.delete(feedLogsTable).where(eq(feedLogsTable.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Environment Logs CRUD ─────────────────────────────────────
router.get("/environment", requireAuth, async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(environmentLogsTable).orderBy(desc(environmentLogsTable.date)).limit(200);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/environment", requireAuth, async (req: Request, res: Response) => {
  try {
    const { flockId, date, temperatureC, humidityPct, ventilation, lightHours, ammoniaLevel, notes } = req.body ?? {};
    if (!date || temperatureC == null) { res.status(400).json({ error: "date, temperatureC required" }); return; }
    const [row] = await db.insert(environmentLogsTable).values({
      flockId: flockId ?? null, date, temperatureC, humidityPct: humidityPct ?? null,
      ventilation: ventilation ?? null, lightHours: lightHours ?? null,
      ammoniaLevel: ammoniaLevel ?? null, notes: notes ?? null,
      authorId: req.session.userId ?? null, authorName: req.session.name ?? null,
    }).returning();
    res.json(row);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/environment/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await db.delete(environmentLogsTable).where(eq(environmentLogsTable.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Water Logs CRUD ───────────────────────────────────────────
router.get("/water", requireAuth, async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(waterLogsTable).orderBy(desc(waterLogsTable.date)).limit(200);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/water", requireAuth, async (req: Request, res: Response) => {
  try {
    const { flockId, date, quantityLiters, waterTemp, addedSupplements, notes } = req.body ?? {};
    if (!date || !quantityLiters) { res.status(400).json({ error: "date, quantityLiters required" }); return; }
    const [row] = await db.insert(waterLogsTable).values({
      flockId: flockId ?? null, date, quantityLiters, waterTemp: waterTemp ?? null,
      addedSupplements: addedSupplements ?? null, notes: notes ?? null,
      authorId: req.session.userId ?? null, authorName: req.session.name ?? null,
    }).returning();
    res.json(row);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/water/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await db.delete(waterLogsTable).where(eq(waterLogsTable.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Mortality Logs CRUD ───────────────────────────────────────
router.get("/mortality", requireAuth, async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(mortalityLogsTable).orderBy(desc(mortalityLogsTable.date)).limit(200);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/mortality", requireAuth, async (req: Request, res: Response) => {
  try {
    const { flockId, date, count, cause, symptoms, actionTaken, notes } = req.body ?? {};
    if (!date || !count) { res.status(400).json({ error: "date, count required" }); return; }
    const [row] = await db.insert(mortalityLogsTable).values({
      flockId: flockId ?? null, date, count: Number(count), cause: cause ?? null,
      symptoms: symptoms ?? null, actionTaken: actionTaken ?? null, notes: notes ?? null,
      authorId: req.session.userId ?? null, authorName: req.session.name ?? null,
    }).returning();
    res.json(row);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/mortality/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await db.delete(mortalityLogsTable).where(eq(mortalityLogsTable.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
