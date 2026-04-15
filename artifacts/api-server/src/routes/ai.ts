import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, flocksTable, hatchingCyclesTable, tasksTable, goalsTable, dailyNotesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { runFullAnalysis, buildQuickSolve } from "../lib/ai-engine";
import {
  runPredictiveAnalysis,
  runCausalAnalysis,
  runMonteCarloSimulation,
  runDecisionEngine,
} from "../lib/advanced-ai-engine";

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

function getLang(req: Request): "ar" | "sv" {
  return req.body?.lang === "sv" ? "sv" : "ar";
}

// ─────────────────────────────────────────────
// Standard farm analysis (existing)
// ─────────────────────────────────────────────

router.post("/ai/analyze-farm", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rawData = await getRawFarmData();
    const lang = getLang(req);
    const analysis = runFullAnalysis(rawData as any, lang);
    res.json({ analysis });
  } catch {
    res.status(500).json({ error: "فشل التحليل" });
  }
});

router.post("/ai/quick-solve", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, description, category } = req.body ?? {};
    if (!title || !description) {
      res.status(400).json({ error: "title و description مطلوبان" });
      return;
    }
    const rawData = await getRawFarmData();
    const lang = getLang(req);
    const result = buildQuickSolve({ title, description, category }, rawData as any, lang);
    res.json({ result });
  } catch {
    res.status(500).json({ error: "فشل الحل السريع" });
  }
});

// ─────────────────────────────────────────────
// Advanced AI — Predictive Analysis
// ─────────────────────────────────────────────

router.post("/ai/predict", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rawData = await getRawFarmData();
    const lang = getLang(req);
    const result = runPredictiveAnalysis(rawData as any, lang);
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "فشل التحليل التنبؤي" });
  }
});

// ─────────────────────────────────────────────
// Advanced AI — Causal Analysis
// ─────────────────────────────────────────────

router.post("/ai/causal", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rawData = await getRawFarmData();
    const lang = getLang(req);
    const result = runCausalAnalysis(rawData as any, lang);
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "فشل التحليل السببي" });
  }
});

// ─────────────────────────────────────────────
// Advanced AI — Monte Carlo Simulation
// ─────────────────────────────────────────────

router.post("/ai/simulate", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rawData = await getRawFarmData();
    const lang = getLang(req);
    const { temperature = 37.65, humidity = 55, taskCompletionRate = 100, eggsSet } = req.body ?? {};
    const result = runMonteCarloSimulation(
      rawData as any,
      { temperature: Number(temperature), humidity: Number(humidity), taskCompletionRate: Number(taskCompletionRate), eggsSet: eggsSet ? Number(eggsSet) : undefined },
      lang,
      2000
    );
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "فشل المحاكاة" });
  }
});

// ─────────────────────────────────────────────
// Advanced AI — Decision Engine (combines all)
// ─────────────────────────────────────────────

router.post("/ai/decision", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rawData = await getRawFarmData();
    const lang = getLang(req);
    const result = runDecisionEngine(rawData as any, lang);
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "فشل محرك القرار" });
  }
});

router.post("/ai/clear", requireAdmin, (_req: Request, res: Response) => {
  res.json({ success: true });
});

export default router;
