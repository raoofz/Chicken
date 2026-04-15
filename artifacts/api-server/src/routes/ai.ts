import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, flocksTable, hatchingCyclesTable, tasksTable, goalsTable, dailyNotesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { runFullAnalysis, buildQuickSolve } from "../lib/ai-engine";

const router: IRouter = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "للمديرين فقط" });
    return;
  }
  next();
}

async function getRawFarmData() {
  const [flocks, hatchingCycles, tasks, goals, notes] = await Promise.all([
    db.select().from(flocksTable),
    db.select().from(hatchingCyclesTable),
    db.select().from(tasksTable),
    db.select().from(goalsTable),
    db.select().from(dailyNotesTable).orderBy(sql`${dailyNotesTable.date} DESC`).limit(60),
  ]);
  return { flocks, hatchingCycles: hatchingCycles as any[], tasks, goals: goals as any[], notes };
}

router.post("/ai/analyze-farm", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rawData = await getRawFarmData();
    const lang = req.body?.lang === "sv" ? "sv" : "ar";
    const analysis = runFullAnalysis(rawData as any, lang);
    res.json({ analysis });
  } catch (err: any) {
    res.status(500).json({ error: "فشل التحليل" });
  }
});

router.post("/ai/quick-solve", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, description, category, lang: reqLang } = req.body ?? {};
    if (!title || !description) {
      res.status(400).json({ error: "title و description مطلوبان" });
      return;
    }
    const rawData = await getRawFarmData();
    const lang = reqLang === "sv" ? "sv" : "ar";
    const result = buildQuickSolve({ title, description, category }, rawData as any, lang);
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: "فشل الحل السريع" });
  }
});

router.post("/ai/clear", requireAdmin, (_req: Request, res: Response) => {
  res.json({ success: true });
});

export default router;
