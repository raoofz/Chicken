import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, flocksTable, hatchingCyclesTable, tasksTable, goalsTable, dailyNotesTable, transactionsTable, flockProductionLogsTable, flockHealthLogsTable } from "@workspace/db";
import { sql, eq, desc } from "drizzle-orm";
import { parseNote } from "../lib/noteSmartParser";
import { validateActions } from "../lib/actionValidator";
import { categoryToDomain } from "../lib/farmDomains.js";
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
  const [flocks, hatchingCycles, tasks, goals, notes, productionLogs, healthLogs] = await Promise.all([
    db.select().from(flocksTable),
    db.select().from(hatchingCyclesTable),
    db.select().from(tasksTable),
    db.select().from(goalsTable),
    db.select().from(dailyNotesTable).orderBy(sql`${dailyNotesTable.date} DESC`).limit(60),
    db.select().from(flockProductionLogsTable).orderBy(desc(flockProductionLogsTable.date)).limit(180),
    db.select().from(flockHealthLogsTable).orderBy(desc(flockHealthLogsTable.date)).limit(120),
  ]);
  return {
    flocks,
    hatchingCycles: hatchingCycles as any[],
    tasks,
    goals: goals as any[],
    notes,
    productionLogs: productionLogs as any[],
    healthLogs: healthLogs as any[],
  };
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
      // Production log changes
      rawData.productionLogs.length,
      rawData.productionLogs.reduce((s: number, p: any) => s + (Number(p.eggCount) || 0), 0),
      // Health log changes
      rawData.healthLogs.length,
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
      let lockdownTemp = Number(c.lockdownTemperature) || null;
      let lockdownHumidity = Number(c.lockdownHumidity) || null;
      let tempStatus: "good" | "warn" | "bad" | null = null;
      let humidStatus: "good" | "warn" | "bad" | null = null;
      let lockdownTempStatus: "good" | "warn" | "bad" | null = null;
      let lockdownHumidStatus: "good" | "warn" | "bad" | null = null;
      if (temp != null) { tempStatus = temp >= 37.5 && temp <= 37.8 ? "good" : Math.abs(temp - 37.65) < 0.5 ? "warn" : "bad"; }
      if (humidity != null) { humidStatus = humidity >= 50 && humidity <= 55 ? "good" : humidity >= 45 && humidity <= 65 ? "warn" : "bad"; }
      if (lockdownTemp != null) { lockdownTempStatus = lockdownTemp >= 36.8 && lockdownTemp <= 37.2 ? "good" : Math.abs(lockdownTemp - 37.0) < 0.5 ? "warn" : "bad"; }
      if (lockdownHumidity != null) { lockdownHumidStatus = lockdownHumidity >= 70 && lockdownHumidity <= 75 ? "good" : lockdownHumidity >= 65 && lockdownHumidity <= 80 ? "warn" : "bad"; }
      const isLockdownPhase = daysRunning != null && daysRunning >= 18;
      return {
        id: c.id, name: c.batchName ?? c.name ?? `دورة #${c.id}`, status: c.status, statusLabel,
        eggsSet, eggsHatched: c.status === "completed" ? eggsHatched : null,
        hatchRate, hatchLabel, startDate, daysRunning,
        temperature: temp, humidity, tempStatus, humidStatus,
        lockdownTemperature: lockdownTemp, lockdownHumidity, lockdownTempStatus, lockdownHumidStatus,
        isLockdownPhase,
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

    // ── PRODUCTION & HEALTH ANALYSIS ────────────────────────────
    const prodLogs = raw.productionLogs as any[];
    const hlthLogs = raw.healthLogs as any[];

    // Group production logs by flock
    const prodByFlock: Record<number, any[]> = {};
    for (const p of prodLogs) {
      if (!prodByFlock[p.flockId]) prodByFlock[p.flockId] = [];
      prodByFlock[p.flockId].push(p);
    }

    // Group health logs by flock
    const healthByFlock: Record<number, any[]> = {};
    for (const h of hlthLogs) {
      if (!healthByFlock[h.flockId]) healthByFlock[h.flockId] = [];
      healthByFlock[h.flockId].push(h);
    }

    // Per-flock production summary
    const productionByFlock = Object.entries(prodByFlock).map(([flockId, logs]) => {
      const flock = raw.flocks.find((f: any) => f.id === Number(flockId));
      const sorted = logs.slice().sort((a: any, b: any) => a.date > b.date ? 1 : -1);
      const total = logs.reduce((s, l) => s + Number(l.eggCount), 0);
      const avg = logs.length > 0 ? total / logs.length : 0;
      // Trend: compare first half vs second half
      const mid = Math.floor(sorted.length / 2);
      const firstHalf = sorted.slice(0, mid).reduce((s: number, l: any) => s + Number(l.eggCount), 0) / (mid || 1);
      const secondHalf = sorted.slice(mid).reduce((s: number, l: any) => s + Number(l.eggCount), 0) / ((sorted.length - mid) || 1);
      const trend: "up" | "down" | "stable" = secondHalf > firstHalf * 1.05 ? "up" : secondHalf < firstHalf * 0.95 ? "down" : "stable";
      return {
        flockId: Number(flockId),
        flockName: flock?.name ?? `قطيع #${flockId}`,
        logCount: logs.length,
        totalEggs: total,
        avgDaily: Math.round(avg * 10) / 10,
        trend,
        latestLog: sorted[sorted.length - 1] ?? null,
      };
    });

    // Sick flocks (latest health status = sick/quarantine)
    const sickFlockIds = new Set<number>();
    for (const [flockId, logs] of Object.entries(healthByFlock)) {
      const sorted = logs.slice().sort((a: any, b: any) => a.date > b.date ? 1 : -1);
      const latest = sorted[sorted.length - 1];
      if (latest && ["sick", "quarantine"].includes(latest.status)) sickFlockIds.add(Number(flockId));
    }

    // Health-production correlation: for flocks with both logs, check if sick periods dip production
    const correlations: { flockName: string; finding: string }[] = [];
    for (const [flockId, hLogs] of Object.entries(healthByFlock)) {
      const pLogs = prodByFlock[Number(flockId)] ?? [];
      if (!pLogs.length) continue;
      const sickDates = new Set(hLogs.filter((h: any) => ["sick","quarantine"].includes(h.status)).map((h: any) => h.date));
      if (!sickDates.size) continue;
      const sickProd = pLogs.filter((p: any) => sickDates.has(p.date)).map((p: any) => Number(p.eggCount));
      const healthyProd = pLogs.filter((p: any) => !sickDates.has(p.date)).map((p: any) => Number(p.eggCount));
      if (sickProd.length > 0 && healthyProd.length > 0) {
        const sickAvg = sickProd.reduce((a, b) => a + b, 0) / sickProd.length;
        const healthyAvg = healthyProd.reduce((a, b) => a + b, 0) / healthyProd.length;
        const drop = healthyAvg > 0 ? ((healthyAvg - sickAvg) / healthyAvg) * 100 : 0;
        const flock = raw.flocks.find((f: any) => f.id === Number(flockId));
        if (drop > 10) correlations.push({
          flockName: flock?.name ?? `قطيع #${flockId}`,
          finding: `انخفاض الإنتاج ${Math.round(drop)}% خلال فترات المرض (${sickAvg.toFixed(0)} بيضة مقابل ${healthyAvg.toFixed(0)} بيضة في اليوم الطبيعي)`,
        });
      }
    }

    // ── ALERTS ──────────────────────────────────────────────────
    const alerts: { level: "critical" | "warning" | "info"; message: string; category: string }[] = [];
    if (overdueArr.length > 0) alerts.push({ level: "critical", message: `${overdueArr.length} مهمة متأخرة تحتاج إجراء فوري`, category: "tasks" });
    if (noteStreak === 0) alerts.push({ level: "warning", message: "لم تُسجَّل ملاحظة اليوم — التوثيق اليومي مهم", category: "notes" });
    for (const fid of sickFlockIds) {
      const flock = raw.flocks.find((f: any) => f.id === fid);
      alerts.push({ level: "critical", message: `قطيع ${flock?.name ?? `#${fid}`}: آخر سجل صحي يُشير إلى مرض أو حجر صحي`, category: "flocks" });
    }
    for (const prod of productionByFlock) {
      if (prod.trend === "down" && prod.logCount >= 3) alerts.push({ level: "warning", message: `${prod.flockName}: إنتاج البيض في انخفاض مستمر (متوسط ${prod.avgDaily}/يوم)`, category: "production" });
    }
    for (const c of cycleDetails) {
      if (c.tempStatus === "bad" && c.temperature != null) alerts.push({ level: "critical", message: `${c.name}: درجة حرارة خارج النطاق (${c.temperature}°C) — مثالي 37.5–37.8°C`, category: "environment" });
      else if (c.tempStatus === "warn" && c.temperature != null) alerts.push({ level: "warning", message: `${c.name}: درجة حرارة على حدود النطاق (${c.temperature}°C)`, category: "environment" });
      if (c.humidStatus === "bad" && c.humidity != null) alerts.push({ level: "warning", message: `${c.name}: رطوبة الحضانة خارج النطاق (${c.humidity}%) — المثالي 50–55%`, category: "environment" });
      if (c.lockdownTempStatus === "bad" && c.lockdownTemperature != null) alerts.push({ level: "critical", message: `${c.name}: حرارة مرحلة الفقس خارج النطاق (${c.lockdownTemperature}°C) — المثالي 36.8–37.2°C`, category: "environment" });
      if (c.lockdownHumidStatus === "bad" && c.lockdownHumidity != null) alerts.push({ level: "critical", message: `${c.name}: رطوبة مرحلة الفقس خارج النطاق (${c.lockdownHumidity}%) — المثالي 70–75%`, category: "environment" });
      if (c.status === "incubating" && c.daysRunning != null && c.daysRunning >= 17 && c.daysRunning <= 19) alerts.push({ level: "warning", message: `${c.name}: اليوم ${c.daysRunning} — حان وقت تحويل البيض لمرحلة الفقس (رفع الرطوبة لـ 70-75%)`, category: "cycles" });
      else if (c.status === "incubating" && c.daysRunning != null && c.daysRunning > 21) alerts.push({ level: "warning", message: `${c.name}: مرّ ${c.daysRunning} يوم على بداية الحضانة — تحقق من الفقس`, category: "cycles" });
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
    healthScore -= sickFlockIds.size * 8;
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
      production: {
        totalLogs: prodLogs.length,
        totalEggs: prodLogs.reduce((s, p) => s + Number(p.eggCount), 0),
        byFlock: productionByFlock,
        decliningFlocks: productionByFlock.filter(p => p.trend === "down"),
      },
      flockHealth: {
        totalEvents: hlthLogs.length,
        sickFlockCount: sickFlockIds.size,
        sickFlockIds: Array.from(sickFlockIds),
        correlations,
      },
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

// ─────────────────────────────────────────────────────────────────────────────
// SMART NOTE ANALYZER — parses Arabic notes and auto-creates structured records
// ─────────────────────────────────────────────────────────────────────────────
router.post("/ai/smart-analyze", async (req: Request, res: Response) => {
  try {
    const { text, date, lang } = req.body ?? {};
    if (!text || typeof text !== "string" || text.trim().length < 5) {
      res.status(400).json({ error: "النص مطلوب ويجب أن يكون 5 أحرف على الأقل" });
      return;
    }
    const noteDate = date ?? new Date().toISOString().split("T")[0];
    const noteLang: "ar" | "sv" = lang === "sv" ? "sv" : "ar";
    const authorId: number | undefined = req.session.userId as number | undefined;

    // Get author name
    let authorName: string | null = null;
    if (authorId) {
      const userRow = await db.execute(sql`SELECT username FROM users WHERE id = ${authorId} LIMIT 1`);
      authorName = (userRow.rows[0] as any)?.username ?? null;
    }

    // Parse the note with the current language
    const { actions, summary } = parseNote(text.trim(), noteDate, noteLang);

    // Save each extracted action
    const saved: Array<{ type: string; id: number; description: string }> = [];

    for (const action of actions) {
      try {
        if (action.type === "hatching_cycle") {
          const d = action.data;
          const [row] = await db.insert(hatchingCyclesTable).values({
            batchName: d.batchName,
            eggsSet: d.eggsSet,
            startDate: d.startDate,
            expectedHatchDate: d.expectedHatchDate,
            lockdownDate: d.lockdownDate,
            status: "incubating",
            temperature: String(d.temperature ?? 37.5),
            humidity: String(d.humidity ?? 55),
            notes: d.notes ?? null,
          }).returning();
          saved.push({ type: "hatching_cycle", id: row.id, description: action.description });

        } else if (action.type === "hatching_result") {
          // Try to update the most recent active cycle
          const activeCycles = await db.select()
            .from(hatchingCyclesTable)
            .where(eq(hatchingCyclesTable.status, "incubating"))
            .orderBy(desc(hatchingCyclesTable.id))
            .limit(1);

          if (activeCycles.length > 0) {
            const cycle = activeCycles[0];
            await db.update(hatchingCyclesTable).set({
              eggsHatched: action.data.eggsHatched,
              actualHatchDate: action.data.actualHatchDate ?? noteDate,
              status: "completed",
            }).where(eq(hatchingCyclesTable.id, cycle.id));
            saved.push({ type: "hatching_result", id: cycle.id, description: action.description });
          }

        } else if (action.type === "transaction") {
          const d = action.data;
          const [row] = await db.insert(transactionsTable).values({
            date: d.date ?? noteDate,
            type: d.type,
            category: d.category,
            description: d.description,
            amount: String(d.amount),
            quantity: d.quantity ? String(d.quantity) : null,
            unit: d.unit ?? null,
            notes: null,
            authorId: authorId ?? null,
            authorName,
          }).returning();
          saved.push({ type: "transaction", id: row.id, description: action.description });

        } else if (action.type === "flock") {
          const d = action.data;
          const [row] = await db.insert(flocksTable).values({
            name: d.name,
            breed: d.breed ?? "محلي",
            count: d.count,
            ageDays: d.ageDays ?? 1,
            purpose: d.purpose ?? "meat",
            notes: d.notes ?? null,
          }).returning();
          saved.push({ type: "flock", id: row.id, description: action.description });

        } else if (action.type === "task") {
          const d = action.data;
          const [row] = await db.insert(tasksTable).values({
            title: d.title,
            description: d.description ?? null,
            category: d.category ?? "other",
            priority: d.priority ?? "medium",
            completed: false,
            dueDate: d.dueDate ?? null,
          }).returning();
          saved.push({ type: "task", id: row.id, description: action.description });
        }
      } catch (actionErr: any) {
        // Skip failed actions but log them
        console.error("[smart-analyze] action failed:", action.type, actionErr?.message);
      }
    }

    res.json({
      summary,
      actions,
      saved,
      totalExtracted: actions.length,
      totalSaved: saved.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "فشل التحليل الذكي" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// REAL-TIME PIPELINE — Strict Parse → Validate → Review → Commit
// ─────────────────────────────────────────────────────────────────────────────
//
//  POST /api/ai/parse   — parse text + validate. NO database writes.
//                          Response: { actions, validation, summary }
//                          The frontend must show this to the user for review.
//
//  POST /api/ai/commit  — accepts a pre-reviewed actions array, re-validates
//                          on the server (zero trust), then atomically writes
//                          to the database. Returns saved IDs + a fingerprint
//                          so all clients can refresh their KPIs immediately.
// ─────────────────────────────────────────────────────────────────────────────

router.post("/ai/parse", async (req: Request, res: Response) => {
  try {
    const { text, date, lang } = req.body ?? {};
    if (!text || typeof text !== "string" || text.trim().length < 5) {
      res.status(400).json({ error: "النص مطلوب (≥ 5 أحرف)" });
      return;
    }
    const noteDate = date ?? new Date().toISOString().split("T")[0];
    const noteLang: "ar" | "sv" = lang === "sv" ? "sv" : "ar";
    const parsed = parseNote(text.trim(), noteDate, noteLang);
    const validation = await validateActions(parsed.actions);
    res.json({
      summary: parsed.summary,
      inputText: parsed.inputText,
      actions: parsed.actions,
      validation,
    });
  } catch (err: any) {
    console.error("[ai/parse]", err);
    res.status(500).json({ error: err?.message ?? "فشل التحليل" });
  }
});

router.post("/ai/commit", async (req: Request, res: Response) => {
  try {
    const { actions, date, lang, originalText } = req.body ?? {};
    if (!Array.isArray(actions) || actions.length === 0) {
      res.status(400).json({ error: "لا توجد إجراءات للحفظ" });
      return;
    }
    const noteDate = date ?? new Date().toISOString().split("T")[0];
    const noteLang: "ar" | "sv" = lang === "sv" ? "sv" : "ar";
    const authorId: number | undefined = req.session.userId as number | undefined;

    // Re-validate on the server (zero trust — never assume the client is honest)
    const validation = await validateActions(actions as any);
    if (!validation.canCommit) {
      res.status(422).json({
        error: noteLang === "ar"
          ? "البيانات لم تجتز التحقق — راجع الأخطاء"
          : "Data klarade inte valideringen — granska fel",
        validation,
      });
      return;
    }

    let authorName: string | null = null;
    if (authorId) {
      const userRow = await db.execute(sql`SELECT username FROM users WHERE id = ${authorId} LIMIT 1`);
      authorName = (userRow.rows[0] as any)?.username ?? null;
    }

    const saved: Array<{ type: string; id: number; description: string }> = [];
    const failed: Array<{ index: number; type: string; error: string }> = [];

    // Atomic transaction — either all rows commit together or nothing does.
    await db.transaction(async (tx) => {
    for (let i = 0; i < validation.actions.length; i++) {
      const v = validation.actions[i];
      const action = v.action;
      const d = v.normalized;
      try {
        if (action.type === "hatching_cycle") {
          const [row] = await tx.insert(hatchingCyclesTable).values({
            batchName: d.batchName,
            eggsSet: d.eggsSet,
            startDate: d.startDate,
            expectedHatchDate: d.expectedHatchDate,
            lockdownDate: d.lockdownDate,
            status: "incubating",
            temperature: String(d.temperature ?? 37.65),
            humidity: String(d.humidity ?? 52),
            notes: d.notes ?? null,
          }).returning();
          saved.push({ type: "hatching_cycle", id: row.id, description: action.description });
        } else if (action.type === "hatching_result") {
          const activeCycles = await tx.select()
            .from(hatchingCyclesTable)
            .where(eq(hatchingCyclesTable.status, "incubating"))
            .orderBy(desc(hatchingCyclesTable.id))
            .limit(1);
          if (activeCycles.length === 0) {
            failed.push({ index: i, type: action.type, error: "no_active_cycle" });
            continue;
          }
          const cycle = activeCycles[0];
          await tx.update(hatchingCyclesTable).set({
            eggsHatched: d.eggsHatched,
            actualHatchDate: d.actualHatchDate ?? noteDate,
            status: "completed",
          }).where(eq(hatchingCyclesTable.id, cycle.id));
          saved.push({ type: "hatching_result", id: cycle.id, description: action.description });
        } else if (action.type === "transaction") {
          const [row] = await tx.insert(transactionsTable).values({
            date:     d.date ?? noteDate,
            type:     d.type,
            category: d.category,
            domain:   categoryToDomain(d.category),  // SSOT — always server-derived
            description: d.description,
            amount:   String(d.amount),
            quantity: d.quantity ? String(d.quantity) : null,
            unit:     d.unit ?? null,
            notes:    d.notes ?? null,
            authorId:   authorId ?? null,
            authorName,
          }).returning();
          saved.push({ type: "transaction", id: row.id, description: action.description });
        } else if (action.type === "flock") {
          const [row] = await tx.insert(flocksTable).values({
            name: d.name,
            breed: d.breed ?? "محلي",
            count: d.count,
            ageDays: d.ageDays ?? 1,
            purpose: d.purpose ?? "meat",
            notes: d.notes ?? null,
          }).returning();
          saved.push({ type: "flock", id: row.id, description: action.description });
        } else if (action.type === "task") {
          const [row] = await tx.insert(tasksTable).values({
            title: d.title,
            description: d.description ?? null,
            category: d.category ?? "other",
            priority: d.priority ?? "medium",
            completed: false,
            dueDate: d.dueDate ?? null,
          }).returning();
          saved.push({ type: "task", id: row.id, description: action.description });
        }
      } catch (actionErr: any) {
        console.error("[ai/commit] action failed:", action.type, actionErr?.message);
        failed.push({ index: i, type: action.type, error: actionErr?.message ?? "unknown" });
        // Abort the whole transaction on any insert failure — atomicity guarantee
        throw actionErr;
      }
    }

    // Persist the source text as a daily note for full traceability (inside the same tx)
    if (originalText && typeof originalText === "string" && originalText.trim().length > 0) {
      try {
        await tx.insert(dailyNotesTable).values({
          date: noteDate,
          content: originalText.substring(0, 1000),
          authorName,
          category: "health",
        });
      } catch { /* non-fatal — note is auxiliary */ }
    }
    }); // end transaction

    // Compute a fresh fingerprint so the client can detect data changes
    const after = await getRawFarmData();
    const fpStr = [
      after.flocks.length,
      after.hatchingCycles.length,
      after.tasks.length,
      after.notes.length,
      after.hatchingCycles.reduce((s: number, c: any) => s + (Number(c.eggsSet) || 0), 0),
      Date.now(),
    ].join(":");
    let h = 5381;
    for (let i = 0; i < fpStr.length; i++) { h = ((h << 5) + h + fpStr.charCodeAt(i)) >>> 0; }

    res.json({
      success: true,
      saved,
      failed,
      counts: {
        transactions: saved.filter(s => s.type === "transaction").length,
        hatchingCycles: saved.filter(s => s.type === "hatching_cycle" || s.type === "hatching_result").length,
        flocks: saved.filter(s => s.type === "flock").length,
        tasks: saved.filter(s => s.type === "task").length,
      },
      fingerprint: h.toString(16),
      committedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[ai/commit]", err);
    res.status(500).json({ error: err?.message ?? "فشل الحفظ" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Intelligence Engine — Context-Aware 7-Point Analysis
// ─────────────────────────────────────────────────────────────────────────────

router.get("/ai/intelligence", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { buildFarmContext } = await import("../lib/context-engine.js");
    const { buildIntelligenceReport } = await import("../lib/intelligence-engine.js");
    const lang = (req.query.lang === "sv" ? "sv" : "ar") as "ar" | "sv";
    const window = parseInt(req.query.window as string) || 7;
    const ctx = await buildFarmContext(window);
    const report = buildIntelligenceReport(ctx, lang);
    res.json({ context: ctx, report });
  } catch (err: any) {
    console.error("[intelligence]", err);
    res.status(500).json({ error: err?.message ?? "فشل التحليل الذكي" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Feedback endpoint for intelligence reports
// ─────────────────────────────────────────────────────────────────────────────

router.post("/ai/intelligence/feedback", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { accepted, comment, reportDate } = req.body ?? {};
    // Store feedback as a note for traceability
    const { db, dailyNotesTable } = await import("@workspace/db");
    const content = `[تغذية راجعة للتقرير الذكي] ${accepted ? "✅ مقبول" : "❌ مرفوض"}${comment ? ` — ${comment}` : ""} (تاريخ التقرير: ${reportDate ?? "?"})`;
    await db.insert(dailyNotesTable).values({
      date: new Date().toISOString().split("T")[0],
      content,
      authorName: (req.session as any)?.username ?? "system",
      category: "health",
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "فشل حفظ التغذية الراجعة" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Decision Logic Layer — Operational Intelligence with Live Weather
// ─────────────────────────────────────────────────────────────────────────────

router.get("/ai/decision", async (req: Request, res: Response) => {
  try {
    const { buildDecisionReport } = await import("../lib/decision-logic.js");
    const report = await buildDecisionReport();
    // No-cache so every poll gets fresh data
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json(report);
  } catch (err: any) {
    console.error("[decision]", err);
    res.status(500).json({ error: err?.message ?? "فشل نظام القرار الذكي" });
  }
});

export default router;

