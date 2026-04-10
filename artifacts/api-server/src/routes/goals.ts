import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, goalsTable } from "@workspace/db";
import {
  CreateGoalBody,
  UpdateGoalBody,
  UpdateGoalParams,
  DeleteGoalParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatGoal(g: typeof goalsTable.$inferSelect) {
  return {
    ...g,
    targetValue: Number(g.targetValue),
    currentValue: Number(g.currentValue),
    createdAt: g.createdAt.toISOString(),
  };
}

router.get("/goals", async (_req, res) => {
  const goals = await db.select().from(goalsTable).orderBy(goalsTable.createdAt);
  res.json(goals.map(formatGoal));
});

router.post("/goals", async (req, res) => {
  const body = CreateGoalBody.parse(req.body);
  const [goal] = await db.insert(goalsTable).values({
    ...body,
    targetValue: String(body.targetValue),
    currentValue: String(body.currentValue ?? 0),
  }).returning();
  res.status(201).json(formatGoal(goal));
});

router.put("/goals/:id", async (req, res) => {
  const { id } = UpdateGoalParams.parse({ id: Number(req.params.id) });
  const body = UpdateGoalBody.parse(req.body);
  const updateData: Record<string, unknown> = { ...body };
  if (body.targetValue != null) updateData.targetValue = String(body.targetValue);
  if (body.currentValue != null) updateData.currentValue = String(body.currentValue);
  const [goal] = await db.update(goalsTable).set(updateData).where(eq(goalsTable.id, id)).returning();
  if (!goal) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatGoal(goal));
});

router.delete("/goals/:id", async (req, res) => {
  const { id } = DeleteGoalParams.parse({ id: Number(req.params.id) });
  await db.delete(goalsTable).where(eq(goalsTable.id, id));
  res.status(204).send();
});

export default router;
