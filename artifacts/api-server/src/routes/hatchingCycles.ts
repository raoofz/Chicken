import { Router, type IRouter } from "express";
import { eq, ne, sql } from "drizzle-orm";
import { db, hatchingCyclesTable } from "@workspace/db";
import { autoResolveFromCycles } from "../lib/self-monitor.js";
import {
  CreateHatchingCycleBody,
  UpdateHatchingCycleBody,
  GetHatchingCycleParams,
  UpdateHatchingCycleParams,
  DeleteHatchingCycleParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const TERMINAL_STATUSES = new Set(["completed", "failed"]);

function formatCycle(c: typeof hatchingCyclesTable.$inferSelect) {
  return {
    ...c,
    temperature:         c.temperature         ? Number(c.temperature)         : null,
    humidity:            c.humidity            ? Number(c.humidity)            : null,
    lockdownTemperature: c.lockdownTemperature ? Number(c.lockdownTemperature) : null,
    lockdownHumidity:    c.lockdownHumidity    ? Number(c.lockdownHumidity)    : null,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/hatching-cycles", async (_req, res) => {
  const cycles = await db.select().from(hatchingCyclesTable).orderBy(hatchingCyclesTable.createdAt);
  res.json(cycles.map(formatCycle));
});

// Create a new cycle and atomically designate it as THE active batch
router.post("/hatching-cycles", async (req, res) => {
  const body = CreateHatchingCycleBody.parse(req.body);

  const cycle = await db.transaction(async (tx) => {
    // Deactivate all existing cycles
    await tx.update(hatchingCyclesTable)
      .set({ isActive: false })
      .where(eq(hatchingCyclesTable.isActive, true));

    // Insert the new cycle as active
    const [inserted] = await tx.insert(hatchingCyclesTable).values({
      ...body,
      isActive:            true,
      temperature:         body.temperature         != null ? String(body.temperature)         : null,
      humidity:            body.humidity            != null ? String(body.humidity)            : null,
      lockdownTemperature: body.lockdownTemperature != null ? String(body.lockdownTemperature) : null,
      lockdownHumidity:    body.lockdownHumidity    != null ? String(body.lockdownHumidity)    : null,
    }).returning();

    return inserted;
  });

  res.status(201).json(formatCycle(cycle));
});

router.get("/hatching-cycles/:id", async (req, res) => {
  const { id } = GetHatchingCycleParams.parse({ id: Number(req.params.id) });
  const [cycle] = await db.select().from(hatchingCyclesTable).where(eq(hatchingCyclesTable.id, id));
  if (!cycle) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatCycle(cycle));
});

// Update cycle — manage is_active flag when status changes
router.put("/hatching-cycles/:id", async (req, res) => {
  const { id } = UpdateHatchingCycleParams.parse({ id: Number(req.params.id) });
  const body = UpdateHatchingCycleBody.parse(req.body);

  const cycle = await db.transaction(async (tx) => {
    const goingTerminal = body.status != null && TERMINAL_STATUSES.has(body.status);

    // Determine isActive: if going terminal → false; else keep the flag if it was already set
    let isActive: boolean | undefined;
    if (goingTerminal) {
      isActive = false;
    } else if (body.isActive === true) {
      // Explicit activation: deactivate all others first
      await tx.update(hatchingCyclesTable)
        .set({ isActive: false })
        .where(ne(hatchingCyclesTable.id, id));
      isActive = true;
    }
    // Otherwise leave isActive unchanged

    const [updated] = await tx
      .update(hatchingCyclesTable)
      .set({
        ...body,
        ...(isActive !== undefined ? { isActive } : {}),
        temperature:         body.temperature         != null ? String(body.temperature)         : undefined,
        humidity:            body.humidity            != null ? String(body.humidity)            : undefined,
        lockdownTemperature: body.lockdownTemperature != null ? String(body.lockdownTemperature) : undefined,
        lockdownHumidity:    body.lockdownHumidity    != null ? String(body.lockdownHumidity)    : undefined,
      })
      .where(eq(hatchingCyclesTable.id, id))
      .returning();

    if (!updated) return null;
    return updated;
  });

  if (!cycle) { res.status(404).json({ error: "Not found" }); return; }

  // Feedback loop: when a cycle completes, auto-resolve matching AI predictions
  if (body.status === "completed" && cycle.eggsHatched != null && cycle.eggsSet > 0) {
    const allCompleted = await db.select().from(hatchingCyclesTable)
      .where(eq(hatchingCyclesTable.status, "completed"));
    autoResolveFromCycles(
      allCompleted.map(c => ({ startDate: c.startDate, eggsSet: c.eggsSet, eggsHatched: c.eggsHatched }))
    ).catch(() => { /* non-critical, never block the response */ });
  }

  res.json(formatCycle(cycle));
});

router.delete("/hatching-cycles/:id", async (req, res) => {
  const { id } = DeleteHatchingCycleParams.parse({ id: Number(req.params.id) });
  await db.delete(hatchingCyclesTable).where(eq(hatchingCyclesTable.id, id));
  res.status(204).send();
});

export default router;
