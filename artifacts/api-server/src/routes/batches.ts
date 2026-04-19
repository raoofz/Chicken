import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, batchesTable } from "@workspace/db";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

router.get("/batches", async (_req, res) => {
  try {
    const rows = await db.select().from(batchesTable).orderBy(desc(batchesTable.startDate));
    res.json(rows);
  } catch (e: any) {
    logger.error({ err: e }, "[batches] GET failed");
    res.status(500).json({ error: e.message });
  }
});

router.post("/batches", async (req, res) => {
  try {
    const { name, flockId, startDate, endDate, chickenCount, status, notes } = req.body;
    if (!name || !startDate || !chickenCount) {
      res.status(400).json({ error: "name, startDate, chickenCount are required" });
      return;
    }
    const [row] = await db.insert(batchesTable).values({
      name,
      flockId:      flockId ? Number(flockId) : null,
      startDate,
      endDate:      endDate || null,
      chickenCount: Number(chickenCount),
      status:       status || "active",
      notes:        notes || null,
    }).returning();
    logger.info({ id: row.id, name }, "[batches] created");
    res.status(201).json(row);
  } catch (e: any) {
    logger.error({ err: e }, "[batches] POST failed");
    res.status(500).json({ error: e.message });
  }
});

router.put("/batches/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, flockId, startDate, endDate, chickenCount, status, notes } = req.body;
    const [row] = await db.update(batchesTable).set({
      ...(name         !== undefined && { name }),
      ...(flockId      !== undefined && { flockId: flockId ? Number(flockId) : null }),
      ...(startDate    !== undefined && { startDate }),
      ...(endDate      !== undefined && { endDate: endDate || null }),
      ...(chickenCount !== undefined && { chickenCount: Number(chickenCount) }),
      ...(status       !== undefined && { status }),
      ...(notes        !== undefined && { notes }),
    }).where(eq(batchesTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (e: any) {
    logger.error({ err: e }, "[batches] PUT failed");
    res.status(500).json({ error: e.message });
  }
});

router.delete("/batches/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(batchesTable).where(eq(batchesTable.id, id));
    res.status(204).send();
  } catch (e: any) {
    logger.error({ err: e }, "[batches] DELETE failed");
    res.status(500).json({ error: e.message });
  }
});

export default router;
