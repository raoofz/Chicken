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
import { runPrecisionAnalysis } from "../lib/precision-engine";
import { logPrediction, getSelfMonitorReport, computeAccuracyMetrics, resolvePrediction } from "../lib/self-monitor";

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

// ─────────────────────────────────────────────
// PRECISION ENGINE v2 — Full Mathematical Analysis
// ─────────────────────────────────────────────

router.post("/ai/precision", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rawData = await getRawFarmData();
    const excludedTitles = ["فحص درجة حرارة الحاضنة", "وضع علف كل يوم"];
    const today = new Date().toISOString().split("T")[0];

    const completed = rawData.hatchingCycles.filter(
      (c: any) => c.status === "completed" && c.eggsHatched != null && c.eggsSet > 0
    );
    const active = rawData.hatchingCycles.filter(
      (c: any) => c.status === "incubating" || c.status === "hatching"
    );
    const overdueTasks = (rawData.tasks as any[]).filter(
      (t: any) => t.dueDate && t.dueDate < today && !t.completed && !excludedTitles.includes((t.title ?? "").trim())
    );

    // Get historical accuracy for Bayesian confidence update
    const accuracy = await computeAccuracyMetrics();

    const result = runPrecisionAnalysis({
      completedCycles: completed.map((c: any) => ({
        batchName: c.batchName,
        startDate: c.startDate,
        eggsSet: c.eggsSet,
        eggsHatched: c.eggsHatched,
        temperature: c.temperature,
        humidity: c.humidity,
      })),
      activeCycles: active.map((c: any) => ({
        batchName: c.batchName,
        temperature: c.temperature,
        humidity: c.humidity,
        startDate: c.startDate,
        eggsSet: c.eggsSet,
      })),
      overdueTaskCount: overdueTasks.length,
      recentNotes: rawData.notes.length,
      historicalAccuracy: accuracy?.accuracyRate ?? null,
    });

    // Log prediction for self-monitoring (async, don't block response)
    if (result.dataQuality.sufficient) {
      logPrediction({
        engineVersion: result.meta.engineVersion,
        analysisType: "precision_full",
        inputHash: result.meta.inputHash,
        predictedHatchRate: result.prediction.nextCycleHatchRate,
        predictedRiskScore: result.riskModel.riskScore,
        confidenceScore: result.confidence.score,
        featuresSnapshot: {
          ewmaSlope: result.features.ewmaSlope,
          autocorr: result.features.autocorrelationLag1,
          globalMean: result.features.globalMean,
          globalStd: result.features.globalStd,
          sampleSize: result.features.sampleSize,
        },
        modelMetrics: result.meta.modelMetrics,
        dataQualityScore: result.dataQuality.score,
        anomaliesDetected: result.anomalyTimeline,
      }).catch(() => {}); // don't fail response if logging fails
    }

    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "فشل المحرك الدقيق" });
  }
});

// ─────────────────────────────────────────────
// SELF-MONITOR — System health and accuracy tracking
// ─────────────────────────────────────────────

router.get("/ai/monitor", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rawData = await getRawFarmData();
    const completed = rawData.hatchingCycles
      .filter((c: any) => c.status === "completed")
      .map((c: any) => ({ startDate: c.startDate, eggsSet: c.eggsSet, eggsHatched: c.eggsHatched }));

    const report = await getSelfMonitorReport(completed);
    res.json({ report });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "فشل تقرير المراقبة" });
  }
});

// ─────────────────────────────────────────────
// RESOLVE PREDICTION — called when actual result is known
// ─────────────────────────────────────────────

router.post("/ai/resolve", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { predictionId, actualHatchRate, actualRiskMaterialized } = req.body ?? {};
    if (!predictionId || actualHatchRate == null) {
      res.status(400).json({ error: "predictionId و actualHatchRate مطلوبان" });
      return;
    }
    await resolvePrediction(
      Number(predictionId),
      Number(actualHatchRate),
      actualRiskMaterialized ?? "none"
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "فشل التحديث" });
  }
});

export default router;
