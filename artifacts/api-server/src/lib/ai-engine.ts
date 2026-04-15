import type { Flock } from "@workspace/db";

interface HatchingCycle {
  id: number;
  batchName: string;
  eggsSet: number;
  eggsHatched: number | null;
  startDate: string;
  expectedHatchDate: string;
  actualHatchDate: string | null;
  lockdownDate: string | null;
  status: string;
  temperature: string | null;
  humidity: string | null;
  lockdownTemperature: string | null;
  lockdownHumidity: string | null;
  notes: string | null;
  createdAt: Date;
}

interface Task {
  id: number;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  completed: boolean;
  dueDate: string | null;
  createdAt: Date;
}

interface Goal {
  id: number;
  title: string;
  description: string | null;
  targetValue: string;
  currentValue: string;
  unit: string;
  category: string;
  deadline: string | null;
  completed: boolean;
  createdAt: Date;
}

interface DailyNote {
  id: number;
  content: string;
  date: string;
  authorName: string | null;
  category: string;
  createdAt: Date;
}

interface RawFarmData {
  flocks: Flock[];
  hatchingCycles: HatchingCycle[];
  tasks: Task[];
  goals: Goal[];
  notes: DailyNote[];
}

interface Alert {
  type: "danger" | "warning" | "info" | "success";
  title: string;
  description: string;
  category: string;
  severity: number;
}

interface Recommendation {
  priority: "urgent" | "high" | "medium" | "low";
  title: string;
  description: string;
  reason: string;
  impact: string;
  confidence: number;
  category: string;
}

interface Prediction {
  title: string;
  description: string;
  confidence: "high" | "medium" | "low";
  probability: number;
  timeframe: string;
  category: string;
}

interface Anomaly {
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  metric: string;
  currentValue: string;
  expectedRange: string;
  category: string;
}

interface SectionItem {
  label: string;
  value: string;
  status: "good" | "warning" | "danger" | "neutral";
  detail?: string;
}

interface Section {
  icon: string;
  title: string;
  category: string;
  items: SectionItem[];
  healthScore: number;
}

interface TrendPoint {
  label: string;
  value: number;
}

interface TrendData {
  hatchRates: TrendPoint[];
  taskCompletion: TrendPoint[];
  flockGrowth: TrendPoint[];
  documentationFreq: TrendPoint[];
}

interface FullAnalysis {
  score: number;
  scoreLabel: string;
  scoreBreakdown: { category: string; score: number; weight: number; label: string }[];
  alerts: Alert[];
  anomalies: Anomaly[];
  sections: Section[];
  recommendations: Recommendation[];
  predictions: Prediction[];
  errors: { title: string; description: string; solution: string }[];
  trends: TrendData;
  topPriority: string;
  futureRisk: {
    level: "critical" | "high" | "medium" | "low";
    title: string;
    summary: string;
    horizon: string;
    triggers: string[];
    actions: string[];
  };
  summary: string;
  timestamp: string;
  dataQuality: { score: number; label: string; issues: string[] };
}

const SCIENCE = {
  incubation: {
    tempOptimal: { min: 37.5, max: 37.8 },
    tempAcceptable: { min: 37.2, max: 38.0 },
    tempDanger: { min: 36.5, max: 38.5 },
    humidityIncubation: { min: 50, max: 60, optimal: 55 },
    humidityLockdown: { min: 65, max: 75, optimal: 70 },
    lockdownTempOptimal: { min: 36.8, max: 37.2 },
    durationDays: 21,
    lockdownDay: 18,
    hatchRate: { excellent: 85, good: 75, acceptable: 65, poor: 50 },
    fertilityRate: { excellent: 90, good: 80 },
  },
  flock: {
    maxAgeDaysLayers: 540,
    maxAgeDaysBroilers: 56,
    mortalityRateNormal: 3,
    mortalityRateWarning: 5,
    mortalityRateDanger: 8,
    minFlockSize: 10,
  },
  operations: {
    maxOverdueTasks: 0,
    taskCompletionGood: 80,
    goalProgressGood: 70,
    documentationFreqGood: 5,
    documentationFreqMin: 2,
  },
};

const KEYWORDS_DISEASE = [
  "نفوق", "مرض", "إسهال", "خمول", "عطس", "سيلان", "كحة", "تنفس",
  "كوكسيديا", "نيوكاسل", "جمبورو", "سالمونيلا", "كوليرا", "ماريك",
  "أعراض", "موت", "ضعف", "هزال", "فقدان شهية", "ريش منتوف",
  "انتفاخ", "صديد", "دم", "إفرازات", "تورم", "عرج",
];

const KEYWORDS_ENVIRONMENT = [
  "حرارة", "رطوبة", "تهوية", "أمونيا", "غاز", "رائحة",
  "برد", "حر", "تبريد", "تدفئة", "ماء", "شرب",
];

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function mean(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1));
}

function zScore(value: number, arr: number[]): number {
  const sd = stddev(arr);
  return sd > 0 ? Math.abs((value - mean(arr)) / sd) : 0;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function parseNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function daysOld(date: string | Date | null | undefined): number | null {
  if (!date) return null;
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

function futureRiskAnalysis(data: RawFarmData): FullAnalysis["futureRisk"] {
  const activeCycles = data.hatchingCycles.filter(c => c.status === "incubating" || c.status === "hatching");
  const overdueTasks = data.tasks.filter(t => t.dueDate && t.dueDate < today() && !t.completed);
  const recentNotes = data.notes.slice(0, 10).map(n => n.content).join(" ").toLowerCase();
  const diseaseSignals = KEYWORDS_DISEASE.filter(k => recentNotes.includes(k)).length;
  const envSignals = KEYWORDS_ENVIRONMENT.filter(k => recentNotes.includes(k)).length;

  const hatchHistory = data.hatchingCycles.filter(c => c.status === "completed" && c.eggsHatched != null && c.eggsSet > 0)
    .map(c => (c.eggsHatched ?? 0) / c.eggsSet * 100);
  const avgHatch = hatchHistory.length ? mean(hatchHistory) : 0;
  const weakHistory = hatchHistory.filter(r => r < SCIENCE.incubation.hatchRate.acceptable).length;

  const cycleStress = activeCycles.filter(c => {
    const temp = parseNum(c.temperature);
    const hum = parseNum(c.humidity);
    return (temp !== null && (temp > 38.0 || temp < 37.2)) || (hum !== null && (hum < 50 || hum > 65));
  }).length;

  const riskScore = clamp(
    20 +
      overdueTasks.length * 12 +
      diseaseSignals * 14 +
      envSignals * 6 +
      cycleStress * 18 +
      (weakHistory > 0 ? 15 : 0) +
      (avgHatch > 0 && avgHatch < 65 ? 20 : avgHatch >= 85 ? -10 : 0),
    0,
    100,
  );

  const level = riskScore >= 85 ? "critical" : riskScore >= 65 ? "high" : riskScore >= 40 ? "medium" : "low";
  const horizon = riskScore >= 85 ? "24-48 ساعة" : riskScore >= 65 ? "3-7 أيام" : "7-14 يوم";

  const triggers = [
    ...(overdueTasks.length ? [`${overdueTasks.length} مهمة متأخرة`] : []),
    ...(cycleStress ? [`${cycleStress} دورة نشطة خارج النطاق المثالي`] : []),
    ...(diseaseSignals ? [`وجود ${diseaseSignals} إشارة مرضية في الملاحظات`] : []),
    ...(envSignals ? [`مؤشرات بيئية متكررة في الملاحظات اليومية`] : []),
    ...(weakHistory ? [`سجل فقس ضعيف سابقاً (${weakHistory} دورة)`] : []),
  ];

  const actions = [
    "راجع الحرارة والرطوبة في كل فقاسة الآن ثم كل 30 دقيقة",
    "أغلق المهام المتأخرة قبل نهاية اليوم",
    "اعزل أي عنبر تظهر فيه أعراض تنفسية أو نفوق غير طبيعي",
    "سجل ملاحظة يومية تفصيلية: حرارة، رطوبة، ماء، علف، نفوق، سلوك",
    "قارن هذه الدورة بأفضل دورة سابقة لتحديد مصدر الخلل",
  ];

  return {
    level,
    title: riskScore >= 85 ? "خطر مستقبلي وشيك" : riskScore >= 65 ? "خطر مرتفع قادم" : riskScore >= 40 ? "خطر متوسط يحتاج متابعة" : "الخطر المستقبلي منخفض",
    summary: riskScore >= 65
      ? "البيانات الحالية تشير إلى احتمال تراجع قريب إذا لم يتم التدخل السريع."
      : "لا توجد إشارات حرجة كبيرة حالياً، لكن يلزم الاستمرار في المراقبة اليومية.",
    horizon,
    triggers,
    actions,
  };
}


function analyzeEnvironment(cycles: HatchingCycle[]): {
  alerts: Alert[];
  anomalies: Anomaly[];
  sectionItems: SectionItem[];
  score: number;
  recommendations: Recommendation[];
} {
  const alerts: Alert[] = [];
  const anomalies: Anomaly[] = [];
  const recommendations: Recommendation[] = [];
  const items: SectionItem[] = [];
  const activeCycles = cycles.filter(c => c.status === "incubating" || c.status === "hatching");

  if (activeCycles.length === 0) {
    items.push({ label: "الدورات النشطة", value: "0", status: "neutral", detail: "لا توجد فقاسات عاملة حالياً" });
    return { alerts, anomalies, sectionItems: items, score: 70, recommendations };
  }

  items.push({ label: "الدورات النشطة", value: String(activeCycles.length), status: "good" });

  const temps: number[] = [];
  const hums: number[] = [];

  for (const c of activeCycles) {
    const temp = c.temperature ? Number(c.temperature) : null;
    const hum = c.humidity ? Number(c.humidity) : null;
    const isLockdown = c.status === "hatching";
    const dayNum = daysBetween(c.startDate, today());

    if (temp !== null && Number.isFinite(temp)) {
      temps.push(temp);
      const optRange = isLockdown ? SCIENCE.incubation.lockdownTempOptimal : SCIENCE.incubation.tempOptimal;
      const dangerRange = SCIENCE.incubation.tempDanger;

      if (temp > dangerRange.max) {
        alerts.push({
          type: "danger", category: "environment",
          title: `🔴 حرارة خطيرة — ${c.batchName}`,
          description: `الحرارة ${temp}°م تتجاوز الحد الأقصى ${dangerRange.max}°م. خطر موت الأجنة خلال ساعات!`,
          severity: 10,
        });
        anomalies.push({
          title: `حرارة مرتفعة بشكل خطير`,
          description: `الدفعة "${c.batchName}" عند ${temp}°م — تجاوزت حد الخطر`,
          severity: "critical", metric: "temperature",
          currentValue: `${temp}°م`, expectedRange: `${optRange.min}-${optRange.max}°م`, category: "environment",
        });
        recommendations.push({
          priority: "urgent", category: "environment",
          title: `خفّض حرارة "${c.batchName}" فوراً`,
          description: `افتح التهوية، أبعد مصدر الحرارة الزائد، وراقب كل 30 دقيقة حتى تصل ${optRange.max}°م`,
          reason: `الحرارة ${temp}°م تسبب موت الأجنة وتشوهات`,
          impact: `إنقاذ الدورة بالكامل`, confidence: 95,
        });
      } else if (temp > optRange.max) {
        alerts.push({
          type: "warning", category: "environment",
          title: `⚠️ حرارة مرتفعة — ${c.batchName}`,
          description: `${temp}°م أعلى من المثالي (${optRange.max}°م)${isLockdown ? " في مرحلة الإقفال" : ` في اليوم ${dayNum}`}`,
          severity: 7,
        });
      } else if (temp < dangerRange.min) {
        alerts.push({
          type: "danger", category: "environment",
          title: `🔴 حرارة منخفضة جداً — ${c.batchName}`,
          description: `${temp}°م أقل من الحد الأدنى الآمن. الأجنة ستتباطأ في النمو أو تموت.`,
          severity: 9,
        });
        anomalies.push({
          title: `انخفاض حراري خطير`, severity: "critical", metric: "temperature",
          description: `"${c.batchName}" عند ${temp}°م`, category: "environment",
          currentValue: `${temp}°م`, expectedRange: `${optRange.min}-${optRange.max}°م`,
        });
      } else if (temp < optRange.min) {
        alerts.push({
          type: "warning", category: "environment",
          title: `حرارة أقل من المثالي — ${c.batchName}`,
          description: `${temp}°م (المثالي ${optRange.min}-${optRange.max}°م)`,
          severity: 5,
        });
      } else {
        items.push({ label: `حرارة ${c.batchName}`, value: `${temp}°م ✓`, status: "good" });
      }
    } else {
      alerts.push({
        type: "warning", category: "environment",
        title: `بيانات حرارة مفقودة — ${c.batchName}`,
        description: `لم تُسجّل قراءة حرارة لهذه الدفعة. التحليل محدود.`,
        severity: 6,
      });
    }

    if (hum !== null && Number.isFinite(hum)) {
      hums.push(hum);
      const optHum = isLockdown ? SCIENCE.incubation.humidityLockdown : SCIENCE.incubation.humidityIncubation;
      if (hum < optHum.min) {
        const severity = isLockdown && hum < 55 ? "high" : "medium";
        alerts.push({
          type: severity === "high" ? "danger" : "warning", category: "environment",
          title: `رطوبة منخفضة — ${c.batchName}`,
          description: `${hum}% (المطلوب ${optHum.min}-${optHum.max}%)${isLockdown ? " — خطر جفاف أغشية الفقس!" : ""}`,
          severity: isLockdown ? 8 : 5,
        });
        if (isLockdown) {
          recommendations.push({
            priority: "urgent", category: "environment",
            title: `ارفع رطوبة "${c.batchName}" فوراً`,
            description: `أضف ماء دافئ في صينية الفقاسة أو قطعة إسفنج مبللة. الهدف: ${optHum.optimal}%`,
            reason: `الرطوبة ${hum}% في الإقفال تسبب التصاق الجنين بالقشرة`,
            impact: `زيادة نسبة الفقس 10-20%`, confidence: 90,
          });
        }
      } else if (hum > optHum.max) {
        alerts.push({
          type: "warning", category: "environment",
          title: `رطوبة عالية — ${c.batchName}`,
          description: `${hum}% أعلى من ${optHum.max}%${!isLockdown ? " — قد تسبب فطريات وبيض مبلل" : ""}`,
          severity: 4,
        });
      }
    }

    if (isLockdown && c.lockdownTemperature) {
      const lt = Number(c.lockdownTemperature);
      const optLock = SCIENCE.incubation.lockdownTempOptimal;
      items.push({
        label: `حرارة الإقفال ${c.batchName}`, value: `${lt}°م`,
        status: lt >= optLock.min && lt <= optLock.max ? "good" : lt > 38 ? "danger" : "warning",
      });
    }

    const daysInCycle = daysBetween(c.startDate, today());
    if (daysInCycle > 23 && c.status === "incubating") {
      alerts.push({
        type: "danger", category: "environment",
        title: `دورة متأخرة — ${c.batchName}`,
        description: `مرّ ${daysInCycle} يوماً والحالة لا تزال "تحضين". الطبيعي 21 يوماً. تحقق من الدفعة.`,
        severity: 8,
      });
    }

    if (c.status === "incubating" && daysInCycle >= 17 && daysInCycle <= 19 && !c.lockdownDate) {
      recommendations.push({
        priority: "high", category: "environment",
        title: `حان وقت الإقفال — ${c.batchName}`,
        description: `اليوم ${daysInCycle} — يجب نقل البيض لوضع الإقفال: خفّض الحرارة لـ 37.0°م وارفع الرطوبة لـ 70%`,
        reason: `الإقفال في اليوم 18 ضروري لنجاح الفقس`,
        impact: `ارتفاع نسبة الفقس 15-25%`, confidence: 95,
      });
    }
  }

  if (temps.length > 1) {
    const sd = stddev(temps);
    if (sd > 0.5) {
      anomalies.push({
        title: "تذبذب حراري بين الفقاسات",
        description: `فارق كبير في الحرارة بين الدورات (انحراف ${sd.toFixed(2)}°م) — يدل على عدم معايرة`,
        severity: "medium", metric: "temperature_variance",
        currentValue: `±${sd.toFixed(2)}°م`, expectedRange: "< 0.3°م", category: "environment",
      });
    }
  }

  let envScore = 100;
  alerts.forEach(a => { envScore -= a.severity * 3; });
  anomalies.forEach(a => { envScore -= a.severity === "critical" ? 15 : a.severity === "high" ? 10 : 5; });

  return { alerts, anomalies, sectionItems: items, score: clamp(envScore, 0, 100), recommendations };
}

function analyzeBiological(flocks: Flock[], cycles: HatchingCycle[]): {
  alerts: Alert[];
  anomalies: Anomaly[];
  sectionItems: SectionItem[];
  score: number;
  predictions: Prediction[];
  recommendations: Recommendation[];
  trends: TrendPoint[];
} {
  const alerts: Alert[] = [];
  const anomalies: Anomaly[] = [];
  const predictions: Prediction[] = [];
  const recommendations: Recommendation[] = [];
  const items: SectionItem[] = [];
  const trendPoints: TrendPoint[] = [];

  const totalBirds = flocks.reduce((a, f) => a + f.count, 0);
  items.push({ label: "إجمالي الطيور", value: String(totalBirds), status: totalBirds > 0 ? "good" : "warning" });
  items.push({ label: "عدد القطعان", value: String(flocks.length), status: flocks.length > 0 ? "good" : "neutral" });

  for (const f of flocks) {
    if (f.count < SCIENCE.flock.minFlockSize) {
      alerts.push({
        type: "info", category: "biological",
        title: `قطيع صغير — ${f.name}`,
        description: `${f.count} طير فقط. القطعان الصغيرة أقل كفاءة اقتصادياً.`,
        severity: 2,
      });
    }
    const maxAge = f.purpose === "لحم" || f.purpose === "meat" ? SCIENCE.flock.maxAgeDaysBroilers : SCIENCE.flock.maxAgeDaysLayers;
    if (f.ageDays > maxAge) {
      alerts.push({
        type: "warning", category: "biological",
        title: `عمر متقدم — ${f.name}`,
        description: `${f.ageDays} يوم (الحد المعتاد ${maxAge} يوم لـ ${f.purpose}). راجع الجدوى الاقتصادية.`,
        severity: 4,
      });
    }
    if (f.ageDays <= 7) {
      recommendations.push({
        priority: "high", category: "biological",
        title: `مراقبة مكثفة — ${f.name}`,
        description: `القطيع في الأسبوع الأول (${f.ageDays} يوم). راقب: الحرارة 33-35°م، الشرب، النشاط.`,
        reason: `أول 7 أيام حرجة — 70% من مشاكل التربية تبدأ هنا`,
        impact: `تقليل النفوق المبكر بنسبة 40-60%`, confidence: 90,
      });
    }
  }

  const completedCycles = cycles.filter(c => c.status === "completed" && c.eggsHatched != null);
  if (completedCycles.length > 0) {
    const rates = completedCycles.map(c => ({
      name: c.batchName,
      rate: c.eggsSet > 0 ? (c.eggsHatched! / c.eggsSet) * 100 : 0,
      date: c.actualHatchDate || c.expectedHatchDate,
    }));

    const overallRate = rates.reduce((a, r) => a + r.rate, 0) / rates.length;
    const rateValues = rates.map(r => r.rate);

    items.push({
      label: "معدل الفقس الإجمالي", value: `${overallRate.toFixed(1)}%`,
      status: overallRate >= SCIENCE.incubation.hatchRate.excellent ? "good" :
        overallRate >= SCIENCE.incubation.hatchRate.acceptable ? "warning" : "danger",
      detail: overallRate >= 85 ? "ممتاز" : overallRate >= 75 ? "جيد" : overallRate >= 65 ? "مقبول" : "ضعيف",
    });

    rates.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    for (const r of rates) {
      trendPoints.push({ label: r.name, value: Math.round(r.rate) });
    }

    if (rates.length >= 3) {
      const last3 = rates.slice(-3).map(r => r.rate);
      const first3 = rates.slice(0, 3).map(r => r.rate);
      const recentAvg = mean(last3);
      const earlyAvg = mean(first3);

      if (recentAvg > earlyAvg + 5) {
        predictions.push({
          title: "تحسن مستمر في الفقس",
          description: `الأداء تحسّن من ${earlyAvg.toFixed(0)}% إلى ${recentAvg.toFixed(0)}%. التوقع: استمرار التحسن إذا حافظت على نفس الممارسات.`,
          confidence: "high", probability: 75, timeframe: "الدورة القادمة", category: "biological",
        });
      } else if (recentAvg < earlyAvg - 5) {
        predictions.push({
          title: "⚠️ تراجع في أداء الفقس",
          description: `انخفض من ${earlyAvg.toFixed(0)}% إلى ${recentAvg.toFixed(0)}%. يجب مراجعة الحرارة والرطوبة وجودة البيض.`,
          confidence: "high", probability: 70, timeframe: "فوري", category: "biological",
        });
        alerts.push({
          type: "warning", category: "biological",
          title: "اتجاه سلبي في نسبة الفقس",
          description: `انخفاض مستمر في آخر 3 دورات. يحتاج تحقيق فوري.`,
          severity: 6,
        });
      }
    }

    for (const r of rates) {
      if (r.rate < SCIENCE.incubation.hatchRate.poor) {
        alerts.push({
          type: "danger", category: "biological",
          title: `فقس ضعيف جداً — ${r.name}`,
          description: `${r.rate.toFixed(0)}% فقط. الحد الأدنى المقبول ${SCIENCE.incubation.hatchRate.acceptable}%.`,
          severity: 7,
        });
      }
    }

    if (rateValues.length > 2) {
      const sd = stddev(rateValues);
      if (sd > 15) {
        anomalies.push({
          title: "تذبذب كبير في نسب الفقس",
          description: `انحراف معياري ${sd.toFixed(1)}% بين الدورات — يدل على عدم ثبات في الإدارة أو جودة البيض`,
          severity: "medium", metric: "hatch_rate_variance",
          currentValue: `±${sd.toFixed(1)}%`, expectedRange: "< 10%", category: "biological",
        });
      }
    }

    const best = rates.reduce((a, b) => a.rate > b.rate ? a : b);
    const worst = rates.reduce((a, b) => a.rate < b.rate ? a : b);
    if (best.rate - worst.rate > 20) {
      recommendations.push({
        priority: "high", category: "biological",
        title: "ادرس الفارق بين أفضل وأسوأ دورة",
        description: `أفضل: ${best.name} (${best.rate.toFixed(0)}%) vs أسوأ: ${worst.name} (${worst.rate.toFixed(0)}%). قارن: مصدر البيض، الحرارة، الرطوبة، عمر البيض.`,
        reason: "فارق 20%+ يعني وجود متغير رئيسي يمكن تحسينه",
        impact: "رفع المعدل العام 10-15%", confidence: 85,
      });
    }
  } else {
    items.push({ label: "معدل الفقس", value: "لا توجد بيانات", status: "neutral" });
  }

  const activeCycles = cycles.filter(c => c.status === "incubating" || c.status === "hatching");
  for (const c of activeCycles) {
    const daysIn = daysBetween(c.startDate, today());
    const daysLeft = daysBetween(today(), c.expectedHatchDate);

    if (daysLeft > 0 && daysLeft <= 5) {
      const predictedRate = completedCycles.length > 0
        ? mean(completedCycles.map(cc => cc.eggsSet > 0 ? ((cc.eggsHatched ?? 0) / cc.eggsSet) * 100 : 0))
        : 70;
      predictions.push({
        title: `توقع فقس "${c.batchName}"`,
        description: `متبقي ${daysLeft} أيام. بناءً على المعدل التاريخي، المتوقع فقس ~${Math.round(c.eggsSet * predictedRate / 100)} صوص من ${c.eggsSet} بيضة (${predictedRate.toFixed(0)}%).`,
        confidence: completedCycles.length >= 3 ? "high" : "medium",
        probability: Math.round(predictedRate),
        timeframe: `${daysLeft} أيام`, category: "biological",
      });
    }
  }

  let bioScore = 85;
  if (totalBirds === 0) bioScore -= 20;
  if (completedCycles.length > 0) {
    const avgRate = mean(completedCycles.map(c => c.eggsSet > 0 ? ((c.eggsHatched ?? 0) / c.eggsSet) * 100 : 0));
    if (avgRate < 50) bioScore -= 25;
    else if (avgRate < 65) bioScore -= 15;
    else if (avgRate < 75) bioScore -= 8;
    else if (avgRate >= 85) bioScore += 5;
  }
  alerts.forEach(a => { bioScore -= a.severity * 2; });

  return { alerts, anomalies, sectionItems: items, score: clamp(bioScore, 0, 100), predictions, recommendations, trends: trendPoints };
}

function analyzeOperational(tasks: Task[], goals: Goal[], notes: DailyNote[]): {
  alerts: Alert[];
  sectionItems: SectionItem[];
  score: number;
  recommendations: Recommendation[];
  predictions: Prediction[];
  taskTrend: TrendPoint[];
  docTrend: TrendPoint[];
} {
  const alerts: Alert[] = [];
  const recommendations: Recommendation[] = [];
  const predictions: Prediction[] = [];
  const items: SectionItem[] = [];
  const t = today();

  const completedTasks = tasks.filter(tk => tk.completed);
  const pendingTasks = tasks.filter(tk => !tk.completed);
  const overdueTasks = tasks.filter(tk => tk.dueDate && tk.dueDate < t && !tk.completed);
  const todayTasks = tasks.filter(tk => tk.dueDate === t);
  const completionRate = tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;

  items.push({ label: "إجمالي المهام", value: String(tasks.length), status: tasks.length > 0 ? "good" : "neutral" });
  items.push({
    label: "نسبة الإنجاز", value: `${completionRate.toFixed(0)}%`,
    status: completionRate >= SCIENCE.operations.taskCompletionGood ? "good" : completionRate >= 50 ? "warning" : "danger",
  });
  items.push({
    label: "المتأخرة", value: String(overdueTasks.length),
    status: overdueTasks.length === 0 ? "good" : overdueTasks.length <= 2 ? "warning" : "danger",
  });
  items.push({ label: "مهام اليوم", value: String(todayTasks.length), status: todayTasks.length > 0 ? "warning" : "good" });

  if (overdueTasks.length > 0) {
    alerts.push({
      type: "danger", category: "operational",
      title: `${overdueTasks.length} مهمة متأخرة`,
      description: overdueTasks.slice(0, 3).map(tk => `"${tk.title}" (مستحقة ${tk.dueDate})`).join("، "),
      severity: Math.min(10, 5 + overdueTasks.length * 2),
    });
    recommendations.push({
      priority: "urgent", category: "operational",
      title: "أغلق المهام المتأخرة اليوم",
      description: `ابدأ بالأعلى أولوية: ${overdueTasks.sort((a, b) => {
        const pMap: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
        return (pMap[b.priority] || 0) - (pMap[a.priority] || 0);
      }).slice(0, 2).map(tk => `"${tk.title}"`).join("، ")}`,
      reason: "المهام المتأخرة تتراكم وتسبب خسائر تشغيلية",
      impact: "تقليل المخاطر التشغيلية", confidence: 95,
    });
  }

  const urgentPending = pendingTasks.filter(tk => tk.priority === "urgent" || tk.priority === "high");
  if (urgentPending.length > 3) {
    alerts.push({
      type: "warning", category: "operational",
      title: `${urgentPending.length} مهمة عالية الأولوية معلّقة`,
      description: "تراكم المهام العاجلة يشير إلى ضغط تشغيلي أو نقص في العمالة.",
      severity: 5,
    });
  }

  const completedGoals = goals.filter(g => g.completed);
  const activeGoals = goals.filter(g => !g.completed);
  items.push({ label: "الأهداف المحققة", value: `${completedGoals.length}/${goals.length}`, status: completedGoals.length > 0 ? "good" : "neutral" });

  for (const g of activeGoals) {
    const target = Number(g.targetValue);
    const current = Number(g.currentValue);
    const progress = target > 0 ? (current / target) * 100 : 0;

    if (g.deadline && g.deadline < t && progress < 100) {
      alerts.push({
        type: "warning", category: "operational",
        title: `هدف متأخر — ${g.title}`,
        description: `التقدم ${progress.toFixed(0)}% فقط والموعد النهائي انتهى (${g.deadline}).`,
        severity: 5,
      });
    }

    if (g.deadline) {
      const daysLeft = daysBetween(t, g.deadline);
      if (daysLeft > 0 && daysLeft <= 7 && progress < 80) {
        recommendations.push({
          priority: "high", category: "operational",
          title: `تسريع هدف "${g.title}"`,
          description: `متبقي ${daysLeft} أيام والتقدم ${progress.toFixed(0)}% فقط. تحتاج ${(target - current).toFixed(1)} ${g.unit} إضافية.`,
          reason: "الموعد النهائي قريب جداً",
          impact: "تحقيق الهدف في الوقت", confidence: 80,
        });
      }
    }
  }

  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 29 + i);
    return d.toISOString().split("T")[0];
  });

  const last7 = last30Days.slice(-7);
  const notesLast7 = notes.filter(n => last7.includes(n.date));
  const uniqueNoteDays = new Set(notesLast7.map(n => n.date)).size;

  items.push({
    label: "التوثيق (آخر 7 أيام)", value: `${uniqueNoteDays}/7 أيام`,
    status: uniqueNoteDays >= SCIENCE.operations.documentationFreqGood ? "good" :
      uniqueNoteDays >= SCIENCE.operations.documentationFreqMin ? "warning" : "danger",
  });

  if (uniqueNoteDays < SCIENCE.operations.documentationFreqMin) {
    alerts.push({
      type: "warning", category: "operational",
      title: "توثيق ضعيف",
      description: `${uniqueNoteDays} ملاحظة فقط في آخر أسبوع. التحليل الذكي يحتاج بيانات يومية ليكون دقيقاً.`,
      severity: 5,
    });
    recommendations.push({
      priority: "medium", category: "operational",
      title: "سجّل ملاحظة يومية",
      description: "اكتب: الحرارة، الرطوبة، استهلاك العلف/الماء، أي أعراض، النفوق، سلوك القطيع.",
      reason: "البيانات المنتظمة أساس التوقعات والإنذارات المبكرة",
      impact: "تحسين دقة التحليل 50%+", confidence: 90,
    });
  }

  const weeks = [last30Days.slice(0, 7), last30Days.slice(7, 14), last30Days.slice(14, 21), last30Days.slice(21, 28)];
  const docTrend: TrendPoint[] = weeks.map((w, i) => ({
    label: `أسبوع ${i + 1}`,
    value: new Set(notes.filter(n => w.includes(n.date)).map(n => n.date)).size,
  }));

  const diseaseNotes = notes.filter(n => KEYWORDS_DISEASE.some(k => n.content.includes(k)));
  if (diseaseNotes.length > 0) {
    const recent = diseaseNotes.filter(n => last7.includes(n.date));
    if (recent.length > 0) {
      alerts.push({
        type: "danger", category: "operational",
        title: `إشارات مرضية في الملاحظات الأخيرة`,
        description: `${recent.length} ملاحظة تحتوي كلمات مرضية: ${recent.slice(0, 2).map(n => `"${n.content.substring(0, 50)}..."`).join("، ")}`,
        severity: 8,
      });
      predictions.push({
        title: "احتمال تفشي مرضي",
        description: "الملاحظات الأخيرة تشير إلى أعراض مرضية. يجب فحص القطيع خلال 24 ساعة.",
        confidence: "medium", probability: 60, timeframe: "24-48 ساعة", category: "biological",
      });
    }
  }

  const envNotes = notes.filter(n => KEYWORDS_ENVIRONMENT.some(k => n.content.includes(k)));
  if (envNotes.length > 2) {
    const recentEnv = envNotes.filter(n => last7.includes(n.date));
    if (recentEnv.length >= 3) {
      alerts.push({
        type: "info", category: "operational",
        title: "ملاحظات بيئية متكررة",
        description: `${recentEnv.length} ملاحظات عن البيئة في آخر أسبوع. قد يشير لمشكلة بيئية مستمرة.`,
        severity: 3,
      });
    }
  }

  const taskTrend: TrendPoint[] = weeks.map((w, i) => {
    const weekTasks = tasks.filter(tk => tk.createdAt && w.includes(new Date(tk.createdAt).toISOString().split("T")[0]));
    const weekCompleted = weekTasks.filter(tk => tk.completed).length;
    return { label: `أسبوع ${i + 1}`, value: weekTasks.length > 0 ? Math.round((weekCompleted / weekTasks.length) * 100) : 0 };
  });

  let opsScore = 80;
  opsScore -= overdueTasks.length * 8;
  opsScore -= (completionRate < 50 ? 15 : completionRate < 70 ? 8 : 0);
  opsScore -= (uniqueNoteDays < 2 ? 10 : uniqueNoteDays < 4 ? 5 : 0);
  opsScore += completedGoals.length * 3;
  alerts.forEach(a => { opsScore -= a.severity; });

  return { alerts, sectionItems: items, score: clamp(opsScore, 0, 100), recommendations, predictions, taskTrend, docTrend };
}

function assessDataQuality(data: RawFarmData): { score: number; label: string; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  if (data.flocks.length === 0) { issues.push("لا توجد قطعان مسجلة"); score -= 20; }
  if (data.hatchingCycles.length === 0) { issues.push("لا توجد دورات تفقيس"); score -= 15; }
  if (data.tasks.length === 0) { issues.push("لا توجد مهام"); score -= 10; }
  if (data.notes.length === 0) { issues.push("لا توجد ملاحظات يومية — البيانات غير كافية للتحليل العميق"); score -= 20; }
  if (data.goals.length === 0) { issues.push("لا توجد أهداف محددة"); score -= 5; }

  const activeCycles = data.hatchingCycles.filter(c => c.status === "incubating" || c.status === "hatching");
  const missingTemp = activeCycles.filter(c => !c.temperature).length;
  if (missingTemp > 0) { issues.push(`${missingTemp} دورة نشطة بدون قراءة حرارة`); score -= missingTemp * 5; }
  const missingHum = activeCycles.filter(c => !c.humidity).length;
  if (missingHum > 0) { issues.push(`${missingHum} دورة نشطة بدون قراءة رطوبة`); score -= missingHum * 5; }

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    return d.toISOString().split("T")[0];
  });
  const recentNotes = data.notes.filter(n => last7.includes(n.date));
  if (recentNotes.length < 3) { issues.push("ملاحظات قليلة في آخر 7 أيام"); score -= 10; }

  score = clamp(score, 0, 100);
  const label = score >= 80 ? "ممتازة" : score >= 60 ? "جيدة" : score >= 40 ? "مقبولة" : "ضعيفة";
  return { score, label, issues };
}

export function runFullAnalysis(data: RawFarmData): FullAnalysis {
  const env = analyzeEnvironment(data.hatchingCycles);
  const bio = analyzeBiological(data.flocks, data.hatchingCycles);
  const ops = analyzeOperational(data.tasks, data.goals, data.notes);
  const dq = assessDataQuality(data);

  const allAlerts = [...env.alerts, ...bio.alerts, ...ops.alerts].sort((a, b) => b.severity - a.severity);
  const allAnomalies = [...env.anomalies, ...bio.anomalies];
  const allRecs = [...env.recommendations, ...bio.recommendations, ...ops.recommendations];
  const allPredictions = [...bio.predictions, ...ops.predictions];

  const priorityOrder: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
  allRecs.sort((a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));

  const errors: { title: string; description: string; solution: string }[] = [];

  if (dq.score < 50) {
    errors.push({
      title: "بيانات غير كافية",
      description: "النظام يحتاج بيانات أكثر ليعمل بدقة عالية.",
      solution: dq.issues.slice(0, 3).join("، ") + ".",
    });
  }

  const completedCycles = data.hatchingCycles.filter(c => c.status === "completed" && c.eggsHatched != null);
  if (completedCycles.length > 0) {
    const avgRate = mean(completedCycles.map(c => c.eggsSet > 0 ? ((c.eggsHatched ?? 0) / c.eggsSet) * 100 : 0));
    if (avgRate < SCIENCE.incubation.hatchRate.acceptable) {
      errors.push({
        title: "معدل فقس ضعيف",
        description: `المعدل العام ${avgRate.toFixed(0)}% — أقل من الحد المقبول ${SCIENCE.incubation.hatchRate.acceptable}%.`,
        solution: "راجع: جودة البيض، عمره قبل التحضين، ثبات الحرارة والرطوبة، التقليب، وبروتوكول الإقفال.",
      });
    }
  }

  const overdueTasks = data.tasks.filter(t => t.dueDate && t.dueDate < today() && !t.completed);
  if (overdueTasks.length > 3) {
    errors.push({
      title: "تراكم تشغيلي خطير",
      description: `${overdueTasks.length} مهمة متأخرة — يدل على ضعف في المتابعة أو نقص الموارد.`,
      solution: "صنّف المهام حسب الأولوية، فوّض ما يمكن، وأغلق الأقدم أولاً.",
    });
  }

  const scoreBreakdown = [
    { category: "البيئة", score: env.score, weight: 35, label: env.score >= 80 ? "جيد" : env.score >= 60 ? "مقبول" : "ضعيف" },
    { category: "الأحياء", score: bio.score, weight: 35, label: bio.score >= 80 ? "جيد" : bio.score >= 60 ? "مقبول" : "ضعيف" },
    { category: "العمليات", score: ops.score, weight: 20, label: ops.score >= 80 ? "جيد" : ops.score >= 60 ? "مقبول" : "ضعيف" },
    { category: "جودة البيانات", score: dq.score, weight: 10, label: dq.label },
  ];

  const weightedScore = Math.round(
    scoreBreakdown.reduce((sum, s) => sum + s.score * (s.weight / 100), 0)
  );

  const scoreLabel = weightedScore >= 85 ? "ممتاز" :
    weightedScore >= 70 ? "جيد جداً" :
    weightedScore >= 55 ? "جيد" :
    weightedScore >= 40 ? "مقبول" : "حرج";

  const sections: Section[] = [
    { icon: "🌡️", title: "البيئة والحرارة", category: "environment", items: env.sectionItems, healthScore: env.score },
    { icon: "🧬", title: "المؤشرات الحيوية", category: "biological", items: bio.sectionItems, healthScore: bio.score },
    { icon: "⚙️", title: "العمليات والإدارة", category: "operational", items: ops.sectionItems, healthScore: ops.score },
  ];

  let topPriority = "لا توجد مشاكل عاجلة حالياً — حافظ على نفس الأداء.";
  if (allRecs.length > 0) {
    topPriority = allRecs[0].title;
    if (allRecs.length > 1) topPriority += ` → ثم: ${allRecs[1].title}`;
  }

  const summaryParts: string[] = [];
  if (allAlerts.filter(a => a.type === "danger").length > 0)
    summaryParts.push(`🔴 ${allAlerts.filter(a => a.type === "danger").length} تنبيه خطير`);
  if (allAnomalies.length > 0)
    summaryParts.push(`🔍 ${allAnomalies.length} شذوذ مكتشف`);
  summaryParts.push(`📊 النتيجة: ${weightedScore}/100 (${scoreLabel})`);
  if (allPredictions.length > 0)
    summaryParts.push(`🔮 ${allPredictions.length} توقع`);

  return {
    score: weightedScore,
    scoreLabel,
    scoreBreakdown,
    alerts: allAlerts,
    anomalies: allAnomalies,
    sections,
    recommendations: allRecs,
    predictions: allPredictions,
    errors,
    trends: {
      hatchRates: bio.trends,
      taskCompletion: ops.taskTrend,
      flockGrowth: [],
      documentationFreq: ops.docTrend,
    },
    topPriority,
    summary: summaryParts.join(" | "),
    timestamp: new Date().toISOString(),
    dataQuality: dq,
  };
}

export function buildExpertChatReply(message: string, data: RawFarmData): string {
  const analysis = runFullAnalysis(data);
  const lower = message.toLowerCase();

  if (lower.includes("تحليل") || lower.includes("المزرعة") || lower.includes("تقرير") || lower.includes("حالة")) {
    const dangerAlerts = analysis.alerts.filter(a => a.type === "danger");
    const warningAlerts = analysis.alerts.filter(a => a.type === "warning");
    let reply = `📊 **تقرير تحليل المزرعة الشامل**\n\n`;
    reply += `**النتيجة العامة: ${analysis.score}/100 — ${analysis.scoreLabel}**\n\n`;

    reply += `📈 **تفصيل النتيجة:**\n`;
    for (const s of analysis.scoreBreakdown) {
      const bar = s.score >= 80 ? "🟢" : s.score >= 60 ? "🟡" : "🔴";
      reply += `${bar} ${s.category}: ${s.score}/100 (${s.label}) — وزن ${s.weight}%\n`;
    }
    reply += `\n`;

    if (dangerAlerts.length > 0) {
      reply += `🚨 **تنبيهات خطيرة (${dangerAlerts.length}):**\n`;
      dangerAlerts.forEach(a => { reply += `- ${a.title}: ${a.description}\n`; });
      reply += `\n`;
    }
    if (warningAlerts.length > 0) {
      reply += `⚠️ **تحذيرات (${warningAlerts.length}):**\n`;
      warningAlerts.slice(0, 5).forEach(a => { reply += `- ${a.title}: ${a.description}\n`; });
      reply += `\n`;
    }
    if (analysis.anomalies.length > 0) {
      reply += `🔍 **شذوذ مكتشف (${analysis.anomalies.length}):**\n`;
      analysis.anomalies.forEach(a => { reply += `- ${a.title}: ${a.description} (القيمة: ${a.currentValue}، المتوقع: ${a.expectedRange})\n`; });
      reply += `\n`;
    }

    reply += `📋 **الواجبات بالأولوية:**\n`;
    analysis.recommendations.slice(0, 5).forEach((r, i) => {
      const badge = r.priority === "urgent" ? "🔴" : r.priority === "high" ? "🟠" : "🟡";
      reply += `${i + 1}. ${badge} **${r.title}**\n   ${r.description}\n   السبب: ${r.reason} | الأثر: ${r.impact}\n`;
    });
    reply += `\n`;

    if (analysis.predictions.length > 0) {
      reply += `🔮 **التوقعات:**\n`;
      analysis.predictions.forEach(p => {
        reply += `- **${p.title}** (ثقة: ${p.confidence === "high" ? "عالية" : p.confidence === "medium" ? "متوسطة" : "تقدير"}): ${p.description}\n`;
      });
      reply += `\n`;
    }

    reply += `\n⚡ **أهم إجراء الآن:** ${analysis.topPriority}`;
    return reply;
  }

  if (lower.includes("حرارة") || lower.includes("رطوبة") || lower.includes("بيئة") || lower.includes("فقاسة")) {
    const envSection = analysis.sections.find(s => s.category === "environment");
    const envAlerts = analysis.alerts.filter(a => a.category === "environment");
    const envRecs = analysis.recommendations.filter(r => r.category === "environment");

    let reply = `🌡️ **تحليل البيئة والفقاسات**\n\n`;
    reply += `النتيجة البيئية: ${envSection?.healthScore ?? "—"}/100\n\n`;

    if (envSection) {
      envSection.items.forEach(item => {
        const dot = item.status === "good" ? "✅" : item.status === "danger" ? "🔴" : item.status === "warning" ? "⚠️" : "⚪";
        reply += `${dot} ${item.label}: ${item.value}\n`;
      });
    }

    if (envAlerts.length > 0) {
      reply += `\n**المشاكل المكتشفة:**\n`;
      envAlerts.forEach(a => { reply += `- ${a.title}: ${a.description}\n`; });
    }

    reply += `\n**📖 المعايير العلمية:**\n`;
    reply += `- حرارة التحضين المثالية: ${SCIENCE.incubation.tempOptimal.min}-${SCIENCE.incubation.tempOptimal.max}°م\n`;
    reply += `- رطوبة التحضين: ${SCIENCE.incubation.humidityIncubation.min}-${SCIENCE.incubation.humidityIncubation.max}%\n`;
    reply += `- حرارة الإقفال: ${SCIENCE.incubation.lockdownTempOptimal.min}-${SCIENCE.incubation.lockdownTempOptimal.max}°م\n`;
    reply += `- رطوبة الإقفال: ${SCIENCE.incubation.humidityLockdown.min}-${SCIENCE.incubation.humidityLockdown.max}%\n`;

    if (envRecs.length > 0) {
      reply += `\n**التوصيات:**\n`;
      envRecs.forEach(r => { reply += `- ${r.title}: ${r.description}\n`; });
    }
    return reply;
  }

  if (lower.includes("فقس") || lower.includes("بيض") || lower.includes("تفقيس") || lower.includes("صوص")) {
    const completedCycles = data.hatchingCycles.filter(c => c.status === "completed" && c.eggsHatched != null);
    const activeCycles = data.hatchingCycles.filter(c => c.status === "incubating" || c.status === "hatching");

    let reply = `🥚 **تحليل التفقيس والدورات**\n\n`;
    reply += `إجمالي الدورات: ${data.hatchingCycles.length} (${activeCycles.length} نشطة، ${completedCycles.length} مكتملة)\n\n`;

    if (activeCycles.length > 0) {
      reply += `**الدورات النشطة:**\n`;
      activeCycles.forEach(c => {
        const daysIn = daysBetween(c.startDate, today());
        const daysLeft = daysBetween(today(), c.expectedHatchDate);
        reply += `- **${c.batchName}**: ${c.eggsSet} بيضة، يوم ${daysIn}/21، متبقي ${daysLeft} يوم\n`;
        reply += `  الحرارة: ${c.temperature ?? "—"}°م، الرطوبة: ${c.humidity ?? "—"}%\n`;
      });
    }

    if (completedCycles.length > 0) {
      const rates = completedCycles.map(c => ({ name: c.batchName, rate: c.eggsSet > 0 ? ((c.eggsHatched!) / c.eggsSet) * 100 : 0 }));
      const avgRate = mean(rates.map(r => r.rate));
      reply += `\n**نتائج الدورات السابقة:**\n`;
      reply += `المعدل العام: ${avgRate.toFixed(1)}% ${avgRate >= 85 ? "✅ ممتاز" : avgRate >= 75 ? "✓ جيد" : avgRate >= 65 ? "⚠️ مقبول" : "🔴 ضعيف"}\n`;
      rates.forEach(r => { reply += `- ${r.name}: ${r.rate.toFixed(0)}%\n`; });
    }

    reply += `\n**📖 معايير علمية:**\n`;
    reply += `- ممتاز: ≥${SCIENCE.incubation.hatchRate.excellent}% | جيد: ≥${SCIENCE.incubation.hatchRate.good}% | مقبول: ≥${SCIENCE.incubation.hatchRate.acceptable}%\n`;
    return reply;
  }

  if (lower.includes("مهام") || lower.includes("عمل") || lower.includes("واجب") || lower.includes("أولوية")) {
    const overdue = data.tasks.filter(t => t.dueDate && t.dueDate < today() && !t.completed);
    const pending = data.tasks.filter(t => !t.completed);
    const rate = data.tasks.length > 0 ? ((data.tasks.filter(t => t.completed).length / data.tasks.length) * 100).toFixed(0) : "0";

    let reply = `⚙️ **تحليل المهام والعمليات**\n\n`;
    reply += `إجمالي: ${data.tasks.length} | مكتملة: ${rate}% | معلقة: ${pending.length} | متأخرة: ${overdue.length}\n\n`;

    if (overdue.length > 0) {
      reply += `🔴 **المتأخرة:**\n`;
      overdue.forEach(t => { reply += `- "${t.title}" (مستحقة ${t.dueDate}) — أولوية: ${t.priority}\n`; });
    }
    if (pending.length > 0) {
      reply += `\n📋 **المعلقة:**\n`;
      pending.slice(0, 5).forEach(t => { reply += `- "${t.title}" ${t.dueDate ? `(${t.dueDate})` : ""}\n`; });
    }
    return reply;
  }

  if (lower.includes("مشكلة") || lower.includes("مرض") || lower.includes("علاج") || lower.includes("أعراض") ||
      KEYWORDS_DISEASE.some(k => lower.includes(k))) {
    const diseaseNotes = data.notes.filter(n => KEYWORDS_DISEASE.some(k => n.content.includes(k)));
    const recentDisease = diseaseNotes.slice(0, 5);

    let reply = `🩺 **تحليل صحي**\n\n`;
    if (recentDisease.length > 0) {
      reply += `**ملاحظات صحية مسجلة:**\n`;
      recentDisease.forEach(n => { reply += `- [${n.date}] ${n.content}\n`; });
      reply += `\n`;
    }
    reply += `**خطة فحص فوري:**\n`;
    reply += `1. اعزل الطيور المصابة فوراً\n`;
    reply += `2. راقب: الأكل، الشرب، التنفس، لون الزرق\n`;
    reply += `3. سجّل الأعراض بدقة في الملاحظات\n`;
    reply += `4. قس الحرارة والرطوبة في العنبر\n`;
    reply += `5. افحص العلف والماء (نظافة، صلاحية)\n\n`;
    reply += `**الأمراض الشائعة وعلاماتها:**\n`;
    reply += `- نيوكاسل: خمول، إسهال أخضر، التواء الرقبة\n`;
    reply += `- كوكسيديا: إسهال دموي، خمول، فقدان شهية\n`;
    reply += `- CRD: عطس، سيلان أنفي، صعوبة تنفس\n`;
    reply += `- سالمونيلا: إسهال أبيض، نفوق مفاجئ في الصيصان\n\n`;
    reply += `⚠️ هذا تحليل أولي — استشر طبيباً بيطرياً للتشخيص النهائي.`;
    return reply;
  }

  const urgentRecs = analysis.recommendations.filter(r => r.priority === "urgent" || r.priority === "high");
  let reply = `📌 **ملخص سريع لمزرعتك**\n\n`;
  reply += `النتيجة: ${analysis.score}/100 (${analysis.scoreLabel})\n\n`;
  if (urgentRecs.length > 0) {
    reply += `**أهم الواجبات الآن:**\n`;
    urgentRecs.slice(0, 3).forEach(r => {
      reply += `- **${r.title}**: ${r.description}\n`;
    });
    reply += `\n`;
  }
  if (analysis.predictions.length > 0) {
    reply += `**توقعات:**\n`;
    analysis.predictions.slice(0, 2).forEach(p => {
      reply += `- ${p.title}: ${p.description}\n`;
    });
    reply += `\n`;
  }
  reply += `💡 للتحليل الكامل، استخدم تبويب "تحليل المزرعة" أو اكتب "حلل مزرعتي".`;
  return reply;
}
