import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, flocksTable, hatchingCyclesTable, tasksTable, goalsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res) => {
  const today = new Date().toISOString().split("T")[0];

  const [flockStats] = await db.select({
    totalFlocks: sql<number>`count(*)::int`,
    totalChickens: sql<number>`coalesce(sum(${flocksTable.count}), 0)::int`,
  }).from(flocksTable);

  const [hatchStats] = await db.select({
    activeHatchingCycles: sql<number>`count(*)::int`,
    totalEggsIncubating: sql<number>`coalesce(sum(${hatchingCyclesTable.eggsSet}), 0)::int`,
  }).from(hatchingCyclesTable).where(
    sql`${hatchingCyclesTable.status} in ('incubating', 'hatching')`
  );

  const [taskStats] = await db.select({
    tasksDueToday: sql<number>`count(*)::int`,
  }).from(tasksTable).where(eq(tasksTable.dueDate, today));

  const [completedTodayStats] = await db.select({
    tasksCompletedToday: sql<number>`count(*)::int`,
  }).from(tasksTable).where(
    and(eq(tasksTable.dueDate, today), eq(tasksTable.completed, true))
  );

  const [goalStats] = await db.select({
    goalsCompleted: sql<number>`count(*) filter (where ${goalsTable.completed} = true)::int`,
    totalGoals: sql<number>`count(*)::int`,
  }).from(goalsTable);

  const completedCycles = await db.select().from(hatchingCyclesTable).where(
    and(
      eq(hatchingCyclesTable.status, "completed"),
      sql`${hatchingCyclesTable.eggsHatched} is not null`
    )
  );

  let overallHatchRate = 0;
  if (completedCycles.length > 0) {
    const totalSet = completedCycles.reduce((a, c) => a + c.eggsSet, 0);
    const totalHatched = completedCycles.reduce((a, c) => a + (c.eggsHatched ?? 0), 0);
    overallHatchRate = totalSet > 0 ? Math.round((totalHatched / totalSet) * 100) : 0;
  }

  res.json({
    totalFlocks: flockStats?.totalFlocks ?? 0,
    totalChickens: flockStats?.totalChickens ?? 0,
    activeHatchingCycles: hatchStats?.activeHatchingCycles ?? 0,
    totalEggsIncubating: hatchStats?.totalEggsIncubating ?? 0,
    tasksDueToday: taskStats?.tasksDueToday ?? 0,
    tasksCompletedToday: completedTodayStats?.tasksCompletedToday ?? 0,
    goalsCompleted: goalStats?.goalsCompleted ?? 0,
    totalGoals: goalStats?.totalGoals ?? 0,
    overallHatchRate,
  });
});

router.get("/dashboard/hatch-stats", async (_req, res) => {
  const allCycles = await db.select().from(hatchingCyclesTable).orderBy(hatchingCyclesTable.createdAt);
  const completedCycles = allCycles.filter(c => c.status === "completed" && c.eggsHatched != null);

  const totalEggsSet = allCycles.reduce((a, c) => a + c.eggsSet, 0);
  const totalEggsHatched = completedCycles.reduce((a, c) => a + (c.eggsHatched ?? 0), 0);

  const hatchRates = completedCycles.map(c => (c.eggsHatched ?? 0) / c.eggsSet * 100);
  const averageHatchRate = hatchRates.length > 0
    ? Math.round(hatchRates.reduce((a, b) => a + b, 0) / hatchRates.length)
    : 0;
  const bestHatchRate = hatchRates.length > 0 ? Math.round(Math.max(...hatchRates)) : 0;

  const recentCycles = allCycles.slice(-5).map(c => ({
    ...c,
    temperature: c.temperature ? Number(c.temperature) : null,
    humidity: c.humidity ? Number(c.humidity) : null,
    createdAt: c.createdAt.toISOString(),
  }));

  res.json({
    totalCycles: allCycles.length,
    completedCycles: completedCycles.length,
    totalEggsSet,
    totalEggsHatched,
    averageHatchRate,
    bestHatchRate,
    recentCycles,
  });
});

export default router;
