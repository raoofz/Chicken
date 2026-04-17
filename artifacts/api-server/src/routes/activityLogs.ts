import { Router, type IRouter } from "express";
import { db, activityLogsTable, tasksTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger.js";

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
    logger.error({ err: e }, "[activity-logs] GET failed");
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

    // ── ATOMIC: insert activity log + complete linked task in one transaction ──
    // If either operation fails the entire transaction rolls back — no partial writes.
    let log: typeof activityLogsTable.$inferSelect;

    await db.transaction(async (tx) => {
      const [inserted] = await tx.insert(activityLogsTable).values({
        title,
        description: description ?? null,
        category:    category ?? "other",
        date,
        taskId:      taskId ?? null,
      }).returning();
      log = inserted;

      if (taskId) {
        const [updated] = await tx
          .update(tasksTable)
          .set({ completed: true })
          .where(eq(tasksTable.id, taskId))
          .returning();
        if (!updated) {
          // Task not found — roll back the activity log insert too
          throw new Error(`Task ${taskId} not found; rolling back activity insert`);
        }
        logger.info(
          { activityId: inserted.id, taskId },
          "[activity-logs] activity created + task auto-completed (atomic)",
        );
      } else {
        logger.info({ activityId: inserted.id }, "[activity-logs] activity created");
      }
    });

    res.status(201).json(formatLog(log!));
  } catch (e: any) {
    logger.error({ err: e }, "[activity-logs] POST failed — full rollback applied");
    res.status(500).json({ error: e.message });
  }
});

router.delete("/activity-logs/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(activityLogsTable).where(eq(activityLogsTable.id, id));
    logger.info({ activityId: id }, "[activity-logs] deleted");
    res.status(204).send();
  } catch (e: any) {
    logger.error({ err: e }, "[activity-logs] DELETE failed");
    res.status(500).json({ error: e.message });
  }
});

export default router;
