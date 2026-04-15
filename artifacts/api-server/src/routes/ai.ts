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
// DATA FINGERPRINT — lightweight change detector
// Returns a fast hash so the frontend can detect when data has changed
// ─────────────────────────────────────────────
router.get("/ai/fingerprint", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rawData = await getRawFarmData();
    const completed = rawData.hatchingCycles.filter((c: any) => c.status === "completed");
    const active = rawData.hatchingCycles.filter((c: any) => c.status === "incubating" || c.status === "hatching");
    const today = new Date().toISOString().split("T")[0];
    const excludedTitles = ["فحص درجة حرارة الحاضنة", "وضع علف كل يوم"];
    const overdueTasks = (rawData.tasks as any[]).filter(
      (t: any) => t.dueDate && t.dueDate < today && !t.completed && !excludedTitles.includes((t.title ?? "").trim())
    );

    // Fast integer fingerprint — any data change changes this value
    const fp = [
      rawData.flocks.length,
      rawData.hatchingCycles.length,
      completed.length,
      active.length,
      rawData.tasks.length,
      rawData.notes.length,
      overdueTasks.length,
      // Sum of eggsHatched to catch result changes
      completed.reduce((s: number, c: any) => s + (Number(c.eggsHatched) || 0), 0),
      // Sum of eggsSet
      rawData.hatchingCycles.reduce((s: number, c: any) => s + (Number(c.eggsSet) || 0), 0),
    ].join(":");

    // djb2 hash
    let h = 5381;
    for (let i = 0; i < fp.length; i++) { h = ((h << 5) + h + fp.charCodeAt(i)) >>> 0; }

    res.json({ fingerprint: h.toString(16), timestamp: Date.now() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// ─────────────────────────────────────────────
// FARM SCAN — Comprehensive scan of ALL farm data in one call
// ─────────────────────────────────────────────
router.get("/ai/farm-scan", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const raw = await getRawFarmData();
    const today = new Date().toISOString().split("T")[0];
    const nowTs = Date.now();
    const EXCLUDED = ["فحص درجة حرارة الحاضنة", "وضع علف كل يوم"];

    // ── FLOCKS ──────────────────────────────────────────────────
    const flockList = raw.flocks.map((f: any) => ({
      id: f.id, name: f.name, breed: f.breed,
      count: f.count ?? 0, age: f.age ?? null,
      purpose: f.purpose ?? null,
    }));

    // ── HATCHING CYCLES ─────────────────────────────────────────
    const activeCycles = raw.hatchingCycles.filter((c: any) => c.status === "incubating" || c.status === "hatching");
    const completedCycles = raw.hatchingCycles.filter((c: any) => c.status === "completed");

    const cycleDetails = raw.hatchingCycles.map((c: any) => {
      const eggsSet = Number(c.eggsSet) || 0;
      const eggsHatched = Number(c.eggsHatched) || 0;
      const hatchRate = eggsSet > 0 ? Math.round((eggsHatched / eggsSet) * 100) : null;
      const startDate = c.startDate ?? null;
      const daysRunning = startDate
        ? Math.floor((nowTs - new Date(startDate).getTime()) / 86400000)
        : null;
      let statusLabel = "غير محدد";
      if (c.status === "incubating") statusLabel = "في الحضانة";
      else if (c.status === "hatching") statusLabel = "مرحلة الفقس";
      else if (c.status === "completed") statusLabel = "مكتملة";
      let hatchLabel = hatchRate == null ? null : hatchRate >= 75 ? "ممتاز" : hatchRate >= 65 ? "مقبول" : "ضعيف";
      let temp = Number(c.temperature) || null;
      let humidity = Number(c.humidity) || null;
      let tempStatus: "good" | "warn" | "bad" | null = null;
      let humidStatus: "good" | "warn" | "bad" | null = null;
      if (temp != null) { tempStatus = temp >= 37.5 && temp <= 37.8 ? "good" : Math.abs(temp - 37.65) < 0.5 ? "warn" : "bad"; }
      if (humidity != null) { humidStatus = humidity >= 50 && humidity <= 60 ? "good" : humidity >= 45 && humidity <= 70 ? "warn" : "bad"; }
      return {
        id: c.id, name: c.batchName ?? c.name ?? `دورة #${c.id}`, status: c.status, statusLabel,
        eggsSet, eggsHatched: c.status === "completed" ? eggsHatched : null,
        hatchRate, hatchLabel, startDate, daysRunning,
        temperature: temp, humidity, tempStatus, humidStatus,
        breed: c.breed ?? null, notes: c.notes ?? null,
      };
    });

    // ── TASKS ────────────────────────────────────────────────────
    const allTasks = raw.tasks as any[];
    const overdueArr = allTasks.filter(t =>
      t.dueDate && t.dueDate < today && !t.completed && !EXCLUDED.includes((t.title ?? "").trim())
    );
    const todayArr = allTasks.filter(t => t.dueDate === today);
    const completedArr = allTasks.filter(t => t.completed);
    const pendingArr = allTasks.filter(t => !t.completed && (!t.dueDate || t.dueDate >= today));

    const taskDetails = allTasks.map((t: any) => {
      const isOverdue = t.dueDate && t.dueDate < today && !t.completed && !EXCLUDED.includes((t.title ?? "").trim());
      const isToday = t.dueDate === today;
      const daysOverdue = isOverdue ? Math.floor((nowTs - new Date(t.dueDate).getTime()) / 86400000) : 0;
      return {
        id: t.id, title: t.title, completed: t.completed, dueDate: t.dueDate ?? null,
        priority: t.priority ?? "medium", category: t.category ?? null,
        isOverdue, isToday, daysOverdue,
        statusLabel: t.completed ? "مكتملة" : isOverdue ? `متأخرة ${daysOverdue} يوم` : isToday ? "اليوم" : "قادمة",
        statusType: t.completed ? "done" : isOverdue ? "overdue" : isToday ? "today" : "upcoming",
      };
    }).sort((a: any, b: any) => {
      const order = { overdue: 0, today: 1, upcoming: 2, done: 3 };
      return (order[a.statusType as keyof typeof order] ?? 9) - (order[b.statusType as keyof typeof order] ?? 9);
    });

    // ── GOALS ────────────────────────────────────────────────────
    const goalDetails = (raw.goals as any[]).map((g: any) => ({
      id: g.id, title: g.title, completed: g.completed,
      targetValue: g.targetValue ?? null, currentValue: g.currentValue ?? null,
      unit: g.unit ?? null, dueDate: g.dueDate ?? null,
      progress: g.targetValue > 0 ? Math.min(100, Math.round((g.currentValue / g.targetValue) * 100)) : null,
    }));

    // ── NOTES ────────────────────────────────────────────────────
    const recentNotes = raw.notes.slice(0, 8).map((n: any) => ({
      id: n.id, date: n.date, content: n.content ?? n.text ?? n.note ?? "",
      author: n.authorName ?? n.author ?? null,
    }));
    const notesByDay: Record<string, number> = {};
    for (const n of raw.notes as any[]) { if (n.date) notesByDay[n.date] = (notesByDay[n.date] ?? 0) + 1; }
    const noteCount = raw.notes.length;
    const noteStreak = (() => {
      let streak = 0; let d = new Date();
      for (let i = 0; i < 30; i++) {
        const key = d.toISOString().split("T")[0];
        if (notesByDay[key]) streak++; else break;
        d.setDate(d.getDate() - 1);
      }
      return streak;
    })();

    // ── ALERTS ──────────────────────────────────────────────────
    const alerts: { level: "critical" | "warning" | "info"; message: string; category: string }[] = [];
    if (overdueArr.length > 0) alerts.push({ level: "critical", message: `${overdueArr.length} مهمة متأخرة تحتاج إجراء فوري`, category: "tasks" });
    if (noteStreak === 0) alerts.push({ level: "warning", message: "لم تُسجَّل ملاحظة اليوم — التوثيق اليومي مهم", category: "notes" });
    for (const c of cycleDetails) {
      if (c.tempStatus === "bad" && c.temperature != null) alerts.push({ level: "critical", message: `${c.name}: درجة حرارة خارج النطاق (${c.temperature}°C) — مثالي 37.5–37.8°C`, category: "environment" });
      else if (c.tempStatus === "warn" && c.temperature != null) alerts.push({ level: "warning", message: `${c.name}: درجة حرارة على حدود النطاق (${c.temperature}°C)`, category: "environment" });
      if (c.humidStatus === "bad" && c.humidity != null) alerts.push({ level: "warning", message: `${c.name}: رطوبة خارج النطاق (${c.humidity}%) — مثالي 50–60%`, category: "environment" });
      if (c.status === "incubating" && c.daysRunning != null && c.daysRunning > 18) alerts.push({ level: "warning", message: `${c.name}: مرّ ${c.daysRunning} يوم على بداية الحضانة — تحقق من الفقس`, category: "cycles" });
    }
    if (flockList.length === 0) alerts.push({ level: "info", message: "لا يوجد قطعان مسجّلة في النظام", category: "flocks" });
    if (completedCycles.length === 0 && activeCycles.length === 0) alerts.push({ level: "info", message: "لا توجد دورات تفقيس — ابدأ دورة جديدة", category: "cycles" });

    // ── PRECISION SUMMARY (lightweight) ──────────────────────────
    let precisionSummary: any = null;
    try {
      const precInput = {
        completedCycles: completedCycles.map((c: any) => ({
          batchName: c.batchName ?? c.name, startDate: c.startDate,
          eggsSet: c.eggsSet, eggsHatched: c.eggsHatched,
          temperature: c.temperature, humidity: c.humidity,
        })),
        activeCycles: activeCycles.map((c: any) => ({
          batchName: c.batchName ?? c.name, temperature: c.temperature,
          humidity: c.humidity, startDate: c.startDate, eggsSet: c.eggsSet,
        })),
        overdueTaskCount: overdueArr.length,
        recentNotes: raw.notes.length,
        historicalAccuracy: null,
      };
      const p = runPrecisionAnalysis(precInput);
      precisionSummary = {
        riskLevel: p.riskModel.riskLevel,
        riskScore: p.riskModel.riskScore,
        failureProbability: p.prediction.failureProbability48h,
        nextHatchRate: p.prediction.nextCycleHatchRate,
        trend: p.prediction.trend,
        confidence: p.confidence.score,
        primaryCause: p.causal.primaryCause,
        dataQualityScore: p.dataQuality.score,
      };
    } catch (precErr: any) { console.error("[farm-scan] precision failed:", precErr?.message ?? precErr); }

    // ── HEALTH SCORE ─────────────────────────────────────────────
    let healthScore = 100;
    healthScore -= overdueArr.length * 5;
    healthScore -= alerts.filter(a => a.level === "critical").length * 10;
    healthScore -= alerts.filter(a => a.level === "warning").length * 5;
    if (noteStreak === 0) healthScore -= 5;
    if (precisionSummary?.riskScore > 60) healthScore -= 10;
    healthScore = Math.max(0, Math.min(100, healthScore));

    res.json({
      scannedAt: new Date().toISOString(),
      healthScore,
      flocks: { total: flockList.length, list: flockList },
      cycles: {
        total: raw.hatchingCycles.length,
        active: activeCycles.length,
        completed: completedCycles.length,
        avgHatchRate: completedCycles.length > 0
          ? Math.round(completedCycles.reduce((s: number, c: any) => {
              const e = Number(c.eggsSet) || 0; const h = Number(c.eggsHatched) || 0;
              return s + (e > 0 ? (h / e) * 100 : 0);
            }, 0) / completedCycles.length)
          : null,
        list: cycleDetails,
      },
      tasks: {
        total: allTasks.length,
        overdue: overdueArr.length,
        today: todayArr.length,
        completed: completedArr.length,
        pending: pendingArr.length,
        list: taskDetails,
      },
      notes: { total: noteCount, streak: noteStreak, recent: recentNotes },
      goals: { total: goalDetails.length, completed: goalDetails.filter((g: any) => g.completed).length, list: goalDetails },
      alerts,
      precision: precisionSummary,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "فشل المسح الشامل" });
  }
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
