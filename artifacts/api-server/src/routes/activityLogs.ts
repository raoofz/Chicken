import { Router, type IRouter } from "express";
import { db, activityLogsTable, tasksTable, goalsTable } from "@workspace/db";
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
    const { title, description, category, date, taskId, goalId, progressDelta } = req.body as {
      title: string;
      description?: string | null;
      category?: string;
      date: string;
      taskId?: number | null;
      goalId?: number | null;
      progressDelta?: number | null;   // optional: amount to add to linked goal's currentValue
    };

    if (!title || !date) {
      res.status(400).json({ error: "title and date are required" });
      return;
    }

    // ── ATOMIC: insert activity log + complete linked task + bump linked goal ──
    // If any step fails the entire transaction rolls back — no partial writes.
    let log: typeof activityLogsTable.$inferSelect;

    await db.transaction(async (tx) => {
      const [inserted] = await tx.insert(activityLogsTable).values({
        title,
        description: description ?? null,
        category:    category ?? "other",
        date,
        taskId:      taskId ?? null,
        goalId:      goalId ?? null,
      }).returning();
      log = inserted;

      if (taskId) {
        const [updated] = await tx
          .update(tasksTable)
          .set({ completed: true })
          .where(eq(tasksTable.id, taskId))
          .returning();
        if (!updated) {
          throw new Error(`Task ${taskId} not found; rolling back activity insert`);
        }
      }

      // If activity is tied to a goal AND has a progress delta, advance the goal.
      // Auto-mark complete when current_value crosses target_value.
      if (goalId && progressDelta && Number(progressDelta) !== 0) {
        const [goal] = await tx.select().from(goalsTable).where(eq(goalsTable.id, goalId));
        if (!goal) throw new Error(`Goal ${goalId} not found; rolling back`);

        const newCurrent = Number(goal.currentValue) + Number(progressDelta);
        const completed  = newCurrent >= Number(goal.targetValue);
        await tx.update(goalsTable)
          .set({ currentValue: String(newCurrent), completed })
          .where(eq(goalsTable.id, goalId));

        logger.info(
          { activityId: inserted.id, goalId, progressDelta, newCurrent, completed },
          "[activity-logs] activity created + goal progress advanced (atomic)",
        );
      } else {
        logger.info(
          { activityId: inserted.id, taskId: taskId ?? null, goalId: goalId ?? null },
          "[activity-logs] activity created",
        );
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
