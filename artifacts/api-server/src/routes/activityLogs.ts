import { Router, type IRouter } from "express";
import { db, activityLogsTable, tasksTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

function formatLog(l: typeof activityLogsTable.$inferSelect) {
  return { ...l, createdAt: l.createdAt.toISOString() };
}

router.get("/activity-logs", async (_req, res) => {
  try {
    const logs = await db.select()
      .from(activityLogsTable)
      .orderBy(desc(activityLogsTable.date));
    res.json(logs.map(formatLog));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/activity-logs", async (req, res) => {
  try {
    const { title, description, category, date, taskId } = req.body as {
      title: string;
      description?: string | null;
      category?: string;
      date: string;
      taskId?: number | null;
    };

    if (!title || !date) {
      res.status(400).json({ error: "title and date are required" });
      return;
    }

    const [log] = await db.insert(activityLogsTable).values({
      title,
      description: description ?? null,
      category:    category ?? "other",
      date,
      taskId:      taskId ?? null,
    }).returning();

    // If this activity fulfills a linked task, mark the task complete atomically.
    if (taskId) {
      await db.update(tasksTable)
        .set({ completed: true })
        .where(eq(tasksTable.id, taskId));
    }

    res.status(201).json(formatLog(log));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/activity-logs/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(activityLogsTable).where(eq(activityLogsTable.id, id));
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
