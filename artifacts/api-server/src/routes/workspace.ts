/**
 * Workspace router — unifies activity logs + daily notes + goals into a single
 * operational feed. Reads only; writes go through the existing per-resource routes.
 *
 * Endpoints:
 *   GET /workspace/feed?days=14&goalId=&type=&limit=200
 *     → merged chronological list of activity logs + daily notes,
 *       each tagged with its `kind` and shared timeline shape.
 *
 *   GET /workspace/goal-activity/:id
 *     → all activity logs and notes whose `goalId` matches, plus the goal itself.
 *
 *   GET /workspace/summary
 *     → quick counters: activity logs (today, this week), notes (today, week),
 *       active/achieved goals, and goals at risk (deadline < 7 days, not done).
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, activityLogsTable, dailyNotesTable, goalsTable } from "@workspace/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

/**
 * Workspace data aggregates daily_notes — those are admin-only in the per-resource
 * /notes routes. Apply the same guard here so workers can't read notes via the feed.
 */
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) { res.status(401).json({ error: "غير مسجل الدخول" }); return; }
  if (req.session.role !== "admin") { res.status(403).json({ error: "هذه الميزة للمديرين فقط" }); return; }
  next();
}
router.use("/workspace", requireAdmin);

interface FeedEntry {
  kind: "log" | "note";
  id: number;
  date: string;
  category: string;
  title: string;        // for notes, derived from first line / truncated content
  content: string | null;
  goalId: number | null;
  authorName: string | null;
  createdAt: string;
}

router.get("/workspace/feed", async (req, res) => {
  try {
    const days   = Math.max(1, Math.min(365, Number(req.query.days ?? 30)));
    const limit  = Math.max(1, Math.min(500, Number(req.query.limit ?? 200)));
    const goalId = req.query.goalId ? Number(req.query.goalId) : null;
    const type   = (req.query.type as string | undefined) ?? "all";   // all | log | note

    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

    const wantLogs  = type === "all" || type === "log";
    const wantNotes = type === "all" || type === "note";

    const logsQ = wantLogs
      ? db.select().from(activityLogsTable)
          .where(
            goalId
              ? and(gte(activityLogsTable.date, since), eq(activityLogsTable.goalId, goalId))
              : gte(activityLogsTable.date, since)
          )
          .orderBy(desc(activityLogsTable.date), desc(activityLogsTable.createdAt))
      : Promise.resolve([] as Array<typeof activityLogsTable.$inferSelect>);

    const notesQ = wantNotes
      ? db.select().from(dailyNotesTable)
          .where(
            goalId
              ? and(gte(dailyNotesTable.date, since), eq(dailyNotesTable.goalId, goalId))
              : gte(dailyNotesTable.date, since)
          )
          .orderBy(desc(dailyNotesTable.date), desc(dailyNotesTable.createdAt))
      : Promise.resolve([] as Array<typeof dailyNotesTable.$inferSelect>);

    const [logs, notes] = await Promise.all([logsQ, notesQ]);

    const merged: FeedEntry[] = [
      ...logs.map(l => ({
        kind:       "log" as const,
        id:         l.id,
        date:       l.date,
        category:   l.category,
        title:      l.title,
        content:    l.description ?? null,
        goalId:     l.goalId ?? null,
        authorName: null,
        createdAt:  l.createdAt.toISOString(),
      })),
      ...notes.map(n => {
        const firstLine = n.content.split("\n")[0]?.trim() ?? "";
        return {
          kind:       "note" as const,
          id:         n.id,
          date:       n.date,
          category:   n.category,
          title:      firstLine.length > 80 ? firstLine.slice(0, 77) + "…" : firstLine || "(ملاحظة)",
          content:    n.content,
          goalId:     n.goalId ?? null,
          authorName: n.authorName ?? null,
          createdAt:  n.createdAt.toISOString(),
        };
      }),
    ];

    // Sort by date desc, then createdAt desc
    merged.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });

    res.json(merged.slice(0, limit));
  } catch (e: any) {
    logger.error({ err: e }, "[workspace] /feed failed");
    res.status(500).json({ error: e.message });
  }
});

router.get("/workspace/goal-activity/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [goal] = await db.select().from(goalsTable).where(eq(goalsTable.id, id));
    if (!goal) { res.status(404).json({ error: "Goal not found" }); return; }

    const [logs, notes] = await Promise.all([
      db.select().from(activityLogsTable)
        .where(eq(activityLogsTable.goalId, id))
        .orderBy(desc(activityLogsTable.date), desc(activityLogsTable.createdAt)),
      db.select().from(dailyNotesTable)
        .where(eq(dailyNotesTable.goalId, id))
        .orderBy(desc(dailyNotesTable.date), desc(dailyNotesTable.createdAt)),
    ]);

    res.json({
      goal: {
        ...goal,
        targetValue:  Number(goal.targetValue),
        currentValue: Number(goal.currentValue),
        createdAt:    goal.createdAt.toISOString(),
      },
      logs:  logs.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })),
      notes: notes.map(n => ({ ...n, createdAt: n.createdAt.toISOString() })),
    });
  } catch (e: any) {
    logger.error({ err: e }, "[workspace] /goal-activity failed");
    res.status(500).json({ error: e.message });
  }
});

router.get("/workspace/summary", async (_req, res) => {
  try {
    const today    = new Date().toISOString().slice(0, 10);
    const weekAgo  = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const in7days  = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

    const [
      logsToday, logsWeek,
      notesToday, notesWeek,
      goalsAll,
    ] = await Promise.all([
      db.select({ c: sql<number>`count(*)::int` }).from(activityLogsTable).where(eq(activityLogsTable.date, today)),
      db.select({ c: sql<number>`count(*)::int` }).from(activityLogsTable).where(gte(activityLogsTable.date, weekAgo)),
      db.select({ c: sql<number>`count(*)::int` }).from(dailyNotesTable).where(eq(dailyNotesTable.date, today)),
      db.select({ c: sql<number>`count(*)::int` }).from(dailyNotesTable).where(gte(dailyNotesTable.date, weekAgo)),
      db.select().from(goalsTable),
    ]);

    const active   = goalsAll.filter(g => !g.completed);
    const achieved = goalsAll.filter(g => g.completed);
    const atRisk   = active.filter(g => g.deadline && g.deadline <= in7days);

    res.json({
      logs:  { today: logsToday[0]?.c ?? 0,  week: logsWeek[0]?.c ?? 0  },
      notes: { today: notesToday[0]?.c ?? 0, week: notesWeek[0]?.c ?? 0 },
      goals: {
        active:   active.length,
        achieved: achieved.length,
        atRisk:   atRisk.length,
        total:    goalsAll.length,
      },
    });
  } catch (e: any) {
    logger.error({ err: e }, "[workspace] /summary failed");
    res.status(500).json({ error: e.message });
  }
});

export default router;
