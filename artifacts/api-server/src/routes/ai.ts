import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, flocksTable, hatchingCyclesTable, tasksTable, goalsTable, dailyNotesTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "للمديرين فقط" });
    return;
  }
  next();
}

// =======================
// 🧠 Analytical Engine
// =======================

function calculateStability(values: number[]) {
  if (!values.length) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length;
  const std = Math.sqrt(variance);
  return Math.max(0, 1 - std / avg);
}

function calculateTrend(values: number[]) {
  if (values.length < 2) return 0;
  return values[values.length - 1] - values[0];
}

function getLastNDaysData(cycles: any[], days: number) {
  const now = new Date();
  return cycles.filter(c => {
    const d = new Date(c.createdAt);
    return (now.getTime() - d.getTime()) <= days * 24 * 60 * 60 * 1000;
  });
}

function calculateAverageHatch(cycles: any[]) {
  const valid = cycles.filter(c => c.eggsSet && c.eggsHatched != null);
  if (!valid.length) return 0;
  const total = valid.reduce((a, c) => a + (c.eggsHatched / c.eggsSet * 100), 0);
  return Math.round(total / valid.length);
}

function calculateRiskScore(data: any) {
  let risk = 0;

  if (data.hatchRate < 70) risk += 30;
  if (data.hatchRate < 50) risk += 50;

  if (data.stability < 0.7) risk += 25;
  if (data.overdueTasks > 3) risk += 20;

  return Math.min(risk, 100);
}

// =======================
// 📊 Data Fetch
// =======================

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

// =======================
// 🚀 AI ANALYSIS ENGINE
// =======================

router.post("/ai/analyze-farm", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rawData = await getRawFarmData();

    const today = new Date().toISOString().split("T")[0];

    const completedCycles = rawData.hatchingCycles.filter((c: any) => c.status === "completed");

    const hatchRates = completedCycles.map((c: any) =>
      (c.eggsHatched ?? 0) / c.eggsSet * 100
    );

    const avgHatchRate = hatchRates.length
      ? Math.round(hatchRates.reduce((a: number, b: number) => a + b, 0) / hatchRates.length)
      : 0;

    // =======================
    // 📊 Time Analysis
    // =======================

    const last7Days = getLastNDaysData(rawData.hatchingCycles, 7);
    const last30Days = getLastNDaysData(rawData.hatchingCycles, 30);

    const hatch7 = calculateAverageHatch(last7Days);
    const hatch30 = calculateAverageHatch(last30Days);

    let performanceTrend = "stable";

    if (hatch7 > hatch30) {
      performanceTrend = "improving";
    } else if (hatch7 < hatch30) {
      performanceTrend = "declining";
    }

    // =======================

    const temps = rawData.hatchingCycles
      .map((c: any) => Number(c.temperature))
      .filter((t: number) => !isNaN(t));

    const stability = calculateStability(temps);
    const tempTrend = calculateTrend(temps);

    const overdueTasks = rawData.tasks.filter((tk: any) =>
      tk.dueDate && tk.dueDate < today && !tk.completed
    ).length;

    const risk = calculateRiskScore({
      hatchRate: avgHatchRate,
      stability,
      overdueTasks,
    });

    // =======================
    // 🧠 Issues
    // =======================

    const issues = [
      avgHatchRate < 70 ? "انخفاض نسبة الفقس" : null,
      stability < 0.7 ? "عدم استقرار الحرارة" : null,
      overdueTasks > 3 ? "تأخر في المهام" : null,
      tempTrend > 1 ? "ارتفاع خطير في الحرارة" : null,
      tempTrend < -1 ? "انخفاض في الحرارة" : null,
    ].filter(Boolean);

    // =======================
    // ✅ Recommendations
    // =======================

    const recommendations = [
      avgHatchRate < 70 ? "تحسين جودة البيض + ضبط الحرارة" : null,
      stability < 0.7 ? "تثبيت الحرارة عند 37.5" : null,
      overdueTasks > 3 ? "تنفيذ المهام فوراً" : null,
      tempTrend > 1 ? "خفض الحرارة فوراً" : null,
      tempTrend < -1 ? "رفع الحرارة تدريجياً" : null,
    ].filter(Boolean);

    // =======================
    // 🔮 Prediction
    // =======================

    const prediction = (() => {
      if (performanceTrend === "declining" && risk > 60) {
        return "🚨 تدهور مستمر: خطر كبير قادم";
      }
      if (risk > 80) return "🚨 خطر شديد";
      if (risk > 60) return "⚠️ خطر مرتفع";
      if (performanceTrend === "improving") return "📈 تحسن واضح";
      return "✅ مستقر";
    })();

    // =======================
    // 🚨 Alerts
    // =======================

    const alerts = [];

    if (stability < 0.6) {
      alerts.push("🚨 حرارة غير مستقرة");
    }

    if (avgHatchRate < 60) {
      alerts.push("🚨 فقس ضعيف جداً");
    }

    if (performanceTrend === "declining") {
      alerts.push("📉 الأداء يتدهور");
    }

    if (hatch7 < 60) {
      alerts.push("⚠️ آخر 7 أيام ضعيفة");
    }

    // =======================
    // ❓ Questions
    // =======================

    const questions = [];

    if (temps.length === 0) {
      questions.push("هل تسجل الحرارة يومياً؟");
    }

    if (avgHatchRate < 70) {
      questions.push("ما مصدر البيض؟ وكم عمره؟");
    }

    // =======================
    // 🧠 Explanation
    // =======================

    const explanation = `
📊 تحليل المزرعة:

- الفقس: ${avgHatchRate}%
- الاستقرار: ${stability.toFixed(2)}
- الخطر: ${risk}%

🧠 المشاكل:
${issues.join("\n") || "لا يوجد"}

✅ الحلول:
${recommendations.join("\n") || "الوضع جيد"}

🔮 التوقع:
${prediction}

📊 الأداء:
7 أيام: ${hatch7}%
30 يوم: ${hatch30}%
الاتجاه: ${performanceTrend}

🎯 الثقة: ${Math.max(60, 100 - risk)}%
`;

    // =======================

    res.json({
      hatchRate: avgHatchRate,
      stability: Number(stability.toFixed(2)),
      risk,
      trend: performanceTrend,
      last7days: hatch7,
      last30days: hatch30,
      issues,
      recommendations,
      prediction,
      alerts,
      questions,
      confidence: Math.max(60, 100 - risk),
      explanation,
      timestamp: new Date().toISOString(),
    });

  } catch (err: any) {
    res.status(500).json({ error: "فشل التحليل" });
  }
});

router.post("/ai/clear", requireAdmin, (_req: Request, res: Response) => {
  res.json({ success: true });
});

export default router;