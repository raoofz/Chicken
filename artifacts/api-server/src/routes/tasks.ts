import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, tasksTable } from "@workspace/db";
import {
  CreateTaskBody,
  UpdateTaskBody,
  UpdateTaskParams,
  DeleteTaskParams,
  ListTasksQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatTask(t: typeof tasksTable.$inferSelect) {
  return {
    ...t,
    createdAt: t.createdAt.toISOString(),
  };
}

router.get("/tasks/today", async (_req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const tasks = await db.select().from(tasksTable)
    .where(eq(tasksTable.dueDate, today))
    .orderBy(tasksTable.createdAt);
  res.json(tasks.map(formatTask));
});

router.get("/tasks", async (req, res) => {
  const query = ListTasksQueryParams.parse(req.query);
  let tasks;
  if (query.date) {
    tasks = await db.select().from(tasksTable)
      .where(eq(tasksTable.dueDate, query.date))
      .orderBy(tasksTable.createdAt);
  } else {
    tasks = await db.select().from(tasksTable).orderBy(tasksTable.createdAt);
  }
  res.json(tasks.map(formatTask));
});

router.post("/tasks", async (req, res) => {
  const body = CreateTaskBody.parse(req.body);
  const [task] = await db.insert(tasksTable).values(body).returning();
  res.status(201).json(formatTask(task));
});

router.put("/tasks/:id", async (req, res) => {
  const { id } = UpdateTaskParams.parse({ id: Number(req.params.id) });
  const body = UpdateTaskBody.parse(req.body);
  const [task] = await db.update(tasksTable).set(body).where(eq(tasksTable.id, id)).returning();
  if (!task) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatTask(task));
});

router.delete("/tasks/:id", async (req, res) => {
  const { id } = DeleteTaskParams.parse({ id: Number(req.params.id) });
  await db.delete(tasksTable).where(eq(tasksTable.id, id));
  res.status(204).send();
});

export default router;
