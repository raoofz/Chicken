import { Router, type IRouter } from "express";
import { db, activityLogsTable } from "@workspace/db";
import { CreateActivityLogBody } from "@workspace/api-zod";

const router: IRouter = Router();

function formatLog(l: typeof activityLogsTable.$inferSelect) {
  return {
    ...l,
    createdAt: l.createdAt.toISOString(),
  };
}

router.get("/activity-logs", async (_req, res) => {
  const logs = await db.select().from(activityLogsTable).orderBy(activityLogsTable.date);
  res.json(logs.map(formatLog));
});

router.post("/activity-logs", async (req, res) => {
  const body = CreateActivityLogBody.parse(req.body);
  const [log] = await db.insert(activityLogsTable).values(body).returning();
  res.status(201).json(formatLog(log));
});

export default router;
