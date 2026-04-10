import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, hatchingCyclesTable } from "@workspace/db";
import {
  CreateHatchingCycleBody,
  UpdateHatchingCycleBody,
  GetHatchingCycleParams,
  UpdateHatchingCycleParams,
  DeleteHatchingCycleParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatCycle(c: typeof hatchingCyclesTable.$inferSelect) {
  return {
    ...c,
    temperature: c.temperature ? Number(c.temperature) : null,
    humidity: c.humidity ? Number(c.humidity) : null,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/hatching-cycles", async (_req, res) => {
  const cycles = await db.select().from(hatchingCyclesTable).orderBy(hatchingCyclesTable.createdAt);
  res.json(cycles.map(formatCycle));
});

router.post("/hatching-cycles", async (req, res) => {
  const body = CreateHatchingCycleBody.parse(req.body);
  const [cycle] = await db.insert(hatchingCyclesTable).values({
    ...body,
    temperature: body.temperature != null ? String(body.temperature) : null,
    humidity: body.humidity != null ? String(body.humidity) : null,
  }).returning();
  res.status(201).json(formatCycle(cycle));
});

router.get("/hatching-cycles/:id", async (req, res) => {
  const { id } = GetHatchingCycleParams.parse({ id: Number(req.params.id) });
  const [cycle] = await db.select().from(hatchingCyclesTable).where(eq(hatchingCyclesTable.id, id));
  if (!cycle) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatCycle(cycle));
});

router.put("/hatching-cycles/:id", async (req, res) => {
  const { id } = UpdateHatchingCycleParams.parse({ id: Number(req.params.id) });
  const body = UpdateHatchingCycleBody.parse(req.body);
  const [cycle] = await db.update(hatchingCyclesTable).set({
    ...body,
    temperature: body.temperature != null ? String(body.temperature) : null,
    humidity: body.humidity != null ? String(body.humidity) : null,
  }).where(eq(hatchingCyclesTable.id, id)).returning();
  if (!cycle) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatCycle(cycle));
});

router.delete("/hatching-cycles/:id", async (req, res) => {
  const { id } = DeleteHatchingCycleParams.parse({ id: Number(req.params.id) });
  await db.delete(hatchingCyclesTable).where(eq(hatchingCyclesTable.id, id));
  res.status(204).send();
});

export default router;
