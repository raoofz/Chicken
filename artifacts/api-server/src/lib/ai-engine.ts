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

interface LiveInsight {
  id: string;
  icon: string;
  title: string;
  value: string;
  unit: string;
  detail: string;
  status: "good" | "warning" | "critical" | "neutral";
  trend?: "up" | "down" | "stable";
  badge?: string;
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
  aiCapabilities: {
    title: string;
    description: string;
  }[];
  summary: string;
  timestamp: string;
  dataQuality: { score: number; label: string; issues: string[] };
  liveInsights: LiveInsight[];
}

type EngineLang = "ar" | "sv";

const SCIENCE = {
  incubation: {
    tempOptimal: { min: 37.5, max: 37.8 },
    tempAcceptable: { min: 37.2, max: 38.0 },
    tempDanger: { min: 36.5, max: 38.5 },
    humidityIncubation: { min: 50, max: 55, optimal: 52 },
    humidityLockdown: { min: 70, max: 75, optimal: 72 },
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

function detectLang(message: string): EngineLang {
  return /[åäöÅÄÖ]/.test(message) ? "sv" : "ar";
}

function tr(lang: EngineLang, ar: string, sv: string): string {
  return lang === "sv" ? sv : ar;
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

function futureRiskAnalysis(data: RawFarmData, lang: EngineLang = "ar"): FullAnalysis["futureRisk"] {
  const L = (ar: string, sv: string) => tr(lang, ar, sv);
  const activeCycles = data.hatchingCycles.filter(c => c.status === "incubating" || c.status === "hatching");
  const excludedOverdueTitles = ["فحص درجة حرارة الحاضنة", "وضع علف كل يوم"];
  const overdueTasks = data.tasks.filter(t => t.dueDate && t.dueDate < today() && !t.completed && !excludedOverdueTitles.includes(t.title.trim()));
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
  const horizon = riskScore >= 85 ? L("24-48 ساعة", "24-48 timmar") : riskScore >= 65 ? L("3-7 أيام", "3-7 dagar") : L("7-14 يوم", "7-14 dagar");

  const triggers = [
    ...(overdueTasks.length ? [L(`${overdueTasks.length} مهمة متأخرة`, `${overdueTasks.length} försenade uppgifter`)] : []),
    ...(cycleStress ? [L(`${cycleStress} دورة نشطة خارج النطاق المثالي`, `${cycleStress} aktiv(a) cykel/cykler utanför optimalt intervall`)] : []),
    ...(diseaseSignals ? [L(`وجود ${diseaseSignals} إشارة مرضية في الملاحظات`, `${diseaseSignals} sjukdomstecken i anteckningarna`)] : []),
    ...(envSignals ? [L("مؤشرات بيئية متكررة في الملاحظات اليومية", "Återkommande miljöindikatorer i dagliga anteckningar")] : []),
    ...(weakHistory ? [L(`سجل فقس ضعيف سابقاً (${weakHistory} دورة)`, `Historik med svag kläckning (${weakHistory} cykel/cykler)`)] : []),
  ];

  const actions = [
    L("راجع الحرارة والرطوبة في كل فقاسة الآن ثم كل 30 دقيقة", "Kontrollera temperatur och fuktighet i varje kläckmaskin nu och sedan var 30:e minut"),
    L("أغلق المهام المتأخرة قبل نهاية اليوم", "Slutför försenade uppgifter före dagens slut"),
    L("اعزل أي عنبر تظهر فيه أعراض تنفسية أو نفوق غير طبيعي", "Isolera vilket stall som helst med andningssymptom eller ovanlig dödlighet"),
    L("سجل ملاحظة يومية تفصيلية: حرارة، رطوبة، ماء، علف، نفوق، سلوك", "Registrera detaljerade dagliga anteckningar: temperatur, fuktighet, vatten, foder, dödlighet, beteende"),
    L("قارن هذه الدورة بأفضل دورة سابقة لتحديد مصدر الخلل", "Jämför denna cykel med den bästa tidigare cykeln för att identifiera problemkällan"),
  ];

  return {
    level,
    title: riskScore >= 85 ? L("خطر مستقبلي وشيك", "Överhängande framtida risk") : riskScore >= 65 ? L("خطر مرتفع قادم", "Hög kommande risk") : riskScore >= 40 ? L("خطر متوسط يحتاج متابعة", "Medelhög risk som kräver uppföljning") : L("الخطر المستقبلي منخفض", "Låg framtida risk"),
    summary: riskScore >= 65
      ? L("البيانات الحالية تشير إلى احتمال تراجع قريب إذا لم يتم التدخل السريع.", "Aktuell data tyder på risk för nedgång om ingen snabb åtgärd vidtas.")
      : L("لا توجد إشارات حرجة كبيرة حالياً، لكن يلزم الاستمرار في المراقبة اليومية.", "Inga stora kritiska tecken för tillfället, men fortsatt daglig övervakning krävs."),
    horizon,
    triggers,
    actions,
  };
}

function buildAiCapabilities(data: RawFarmData): FullAnalysis["aiCapabilities"] {
  const recentNotesCount = data.notes.length;
  const excludedOverdueTitles = ["فحص درجة حرارة الحاضنة", "وضع علف كل يوم"];
  const overdueTasksCount = data.tasks.filter(t => t.dueDate && t.dueDate < today() && !t.completed && !excludedOverdueTitles.includes(t.title.trim())).length;
  const activeCyclesCount = data.hatchingCycles.filter(c => c.status === "incubating" || c.status === "hatching").length;
  const morningTasks = data.tasks.filter(t => !t.completed && (
    /7|07|صباح|morning/i.test(t.title) ||
    /feed|علف|اطعام|إطعام/i.test(t.title) ||
    /water|ماء|سقي|شرب/i.test(t.title)
  )).slice(0, 4);
  return [
    {
      title: "مراقب التنبيهات الذكية",
      description: `يراقب الملاحظات والمهام والدورات ويحوّل التكرار إلى تنبيه فوري عندما يبدأ الخلل بالظهور.`,
    },
    {
      title: "مؤشر الأداء التنبؤي",
      description: `يتابع الاتجاهات عبر ${recentNotesCount} ملاحظة و${activeCyclesCount} دورة نشطة لتوقع الهبوط قبل وقوعه.`,
    },
    {
      title: "مدقق العمل والتأخير",
      description: overdueTasksCount > 0
        ? `يرصد ${overdueTasksCount} مهمة متأخرة ويقترح إعادة توزيع العمل لتقليل الاختناق التشغيلي.`
        : "يتأكد من أن المهام المتأخرة لا تبقى عالقة أو مكررة بعد الإغلاق اليدوي.",
    },
    {
      title: "محرك التعلم من المزرعة",
      description: `يتحسن من بيانات مزرعتك نفسها ويقوي قراراته مع كل دورة ونتيجة جديدة.`,
    },
    {
      title: "الخطة اليومية الذكية",
      description: morningTasks.length > 0
        ? `يحوّل المهام الحالية إلى برنامج يومي واضح: ${morningTasks.map(t => t.title).join("، ")}.`
        : "يبني برنامج اليوم من العلف والماء والمهام الحرجة بحسب بيانات المزرعة والملاحظات الأخيرة.",
    },
  ];
}


function analyzeEnvironment(cycles: HatchingCycle[], lang: EngineLang = "ar"): {
  alerts: Alert[];
  anomalies: Anomaly[];
  sectionItems: SectionItem[];
  score: number;
  recommendations: Recommendation[];
} {
  const L = (ar: string, sv: string) => tr(lang, ar, sv);
  const alerts: Alert[] = [];
  const anomalies: Anomaly[] = [];
  const recommendations: Recommendation[] = [];
  const items: SectionItem[] = [];
  const activeCycles = cycles.filter(c => c.status === "incubating" || c.status === "hatching");

  if (activeCycles.length === 0) {
    items.push({ label: L("الدورات النشطة", "Aktiva cykler"), value: "0", status: "neutral", detail: L("لا توجد فقاسات عاملة حالياً — الحاضنة في وضع راحة", "Inga aktiva kläckmaskiner — maskinen vilar") });
    return { alerts, anomalies, sectionItems: items, score: 95, recommendations };
  }

  items.push({ label: L("الدورات النشطة", "Aktiva cykler"), value: String(activeCycles.length), status: "good" });

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
          title: L(`🔴 حرارة خطيرة — ${c.batchName}`, `🔴 Farlig temperatur — ${c.batchName}`),
          description: L(`الحرارة ${temp}°م تتجاوز الحد الأقصى ${dangerRange.max}°م. خطر موت الأجنة خلال ساعات!`, `Temperaturen ${temp}°C överstiger maxgränsen ${dangerRange.max}°C. Risk för embryodöd inom timmar!`),
          severity: 10,
        });
        anomalies.push({
          title: L("حرارة مرتفعة بشكل خطير", "Farligt hög temperatur"),
          description: L(`الدفعة "${c.batchName}" عند ${temp}°م — تجاوزت حد الخطر`, `Batch "${c.batchName}" vid ${temp}°C — översteg farlighetsgränsen`),
          severity: "critical", metric: "temperature",
          currentValue: `${temp}°C`, expectedRange: `${optRange.min}-${optRange.max}°C`, category: "environment",
        });
        recommendations.push({
          priority: "urgent", category: "environment",
          title: L(`خفّض حرارة "${c.batchName}" فوراً`, `Sänk temperaturen i "${c.batchName}" omedelbart`),
          description: L(`افتح التهوية، أبعد مصدر الحرارة الزائد، وراقب كل 30 دقيقة حتى تصل ${optRange.max}°م`, `Öppna ventilationen, ta bort överskottsvärme, övervaka var 30:e minut tills ${optRange.max}°C uppnås`),
          reason: L(`الحرارة ${temp}°م تسبب موت الأجنة وتشوهات`, `Temperatur ${temp}°C orsakar embryodöd och missbildningar`),
          impact: L("إنقاذ الدورة بالكامل", "Rädda hela cykeln"), confidence: 95,
        });
      } else if (temp > optRange.max) {
        alerts.push({
          type: "warning", category: "environment",
          title: L(`⚠️ حرارة مرتفعة — ${c.batchName}`, `⚠️ Hög temperatur — ${c.batchName}`),
          description: L(`${temp}°م أعلى من المثالي (${optRange.max}°م)${isLockdown ? " في مرحلة الإقفال" : ` في اليوم ${dayNum}`}`, `${temp}°C är över optimalt (${optRange.max}°C)${isLockdown ? " i låsningsfasen" : ` dag ${dayNum}`}`),
          severity: 7,
        });
      } else if (temp < dangerRange.min) {
        alerts.push({
          type: "danger", category: "environment",
          title: L(`🔴 حرارة منخفضة جداً — ${c.batchName}`, `🔴 För låg temperatur — ${c.batchName}`),
          description: L("الأجنة ستتباطأ في النمو أو تموت.", "Embryona kommer att växa långsammare eller dö."),
          severity: 9,
        });
        anomalies.push({
          title: L("انخفاض حراري خطير", "Farligt låg temperatur"), severity: "critical", metric: "temperature",
          description: L(`"${c.batchName}" عند ${temp}°م`, `"${c.batchName}" vid ${temp}°C`), category: "environment",
          currentValue: `${temp}°C`, expectedRange: `${optRange.min}-${optRange.max}°C`,
        });
      } else if (temp < optRange.min) {
        alerts.push({
          type: "warning", category: "environment",
          title: L(`حرارة أقل من المثالي — ${c.batchName}`, `Temperatur under optimalt — ${c.batchName}`),
          description: L(`${temp}°م (المثالي ${optRange.min}-${optRange.max}°م)`, `${temp}°C (optimalt ${optRange.min}-${optRange.max}°C)`),
          severity: 5,
        });
      } else {
        items.push({ label: L(`حرارة ${c.batchName}`, `Temp ${c.batchName}`), value: `${temp}°C ✓`, status: "good" });
      }
    } else {
      alerts.push({
        type: "warning", category: "environment",
        title: L(`تسجيل الحرارة مطلوب — ${c.batchName}`, `Registrera temperatur — ${c.batchName}`),
        description: L(`لم تُسجَّل قراءة حرارة لـ"${c.batchName}". سجّلها الآن في صفحة التفقيس لضمان دقة التحليل.`, `Ingen temperaturavläsning för "${c.batchName}". Registrera nu för korrekt analys.`),
        severity: 3,
      });
    }

    if (hum !== null && Number.isFinite(hum)) {
      hums.push(hum);
      const optHum = isLockdown ? SCIENCE.incubation.humidityLockdown : SCIENCE.incubation.humidityIncubation;
      if (hum < optHum.min) {
        const severity = isLockdown && hum < 55 ? "high" : "medium";
        alerts.push({
          type: severity === "high" ? "danger" : "warning", category: "environment",
          title: L(`رطوبة منخفضة — ${c.batchName}`, `Låg luftfuktighet — ${c.batchName}`),
          description: L(`${hum}% (المطلوب ${optHum.min}-${optHum.max}%)${isLockdown ? " — خطر جفاف أغشية الفقس!" : ""}`, `${hum}% (krävs ${optHum.min}-${optHum.max}%)${isLockdown ? " — risk för torra kläckhinnor!" : ""}`),
          severity: isLockdown ? 8 : 5,
        });
        if (isLockdown) {
          recommendations.push({
            priority: "urgent", category: "environment",
            title: L(`ارفع رطوبة "${c.batchName}" فوراً`, `Öka luftfuktigheten i "${c.batchName}" omedelbart`),
            description: L(`أضف ماء دافئ في صينية الفقاسة أو قطعة إسفنج مبللة. الهدف: ${optHum.optimal}%`, `Tillsätt varmt vatten i kläckmaskinens bricka eller en fuktig svamp. Mål: ${optHum.optimal}%`),
            reason: L(`الرطوبة ${hum}% في الإقفال تسبب التصاق الجنين بالقشرة`, `Fuktighet ${hum}% under låsning orsakar att embryot fastnar i skalet`),
            impact: L("زيادة نسبة الفقس 10-20%", "Ökar kläckningsprocenten med 10-20%"), confidence: 90,
          });
        }
      } else if (hum > optHum.max) {
        alerts.push({
          type: "warning", category: "environment",
          title: L(`رطوبة عالية — ${c.batchName}`, `Hög luftfuktighet — ${c.batchName}`),
          description: L(`${hum}% أعلى من ${optHum.max}%${!isLockdown ? " — قد تسبب فطريات وبيض مبلل" : ""}`, `${hum}% är över ${optHum.max}%${!isLockdown ? " — kan orsaka mögel och blöta ägg" : ""}`),
          severity: 4,
        });
      }
    }

    if (isLockdown && c.lockdownTemperature) {
      const lt = Number(c.lockdownTemperature);
      const optLock = SCIENCE.incubation.lockdownTempOptimal;
      items.push({
        label: L(`حرارة الإقفال ${c.batchName}`, `Låsningstemperatur ${c.batchName}`), value: `${lt}°C`,
        status: lt >= optLock.min && lt <= optLock.max ? "good" : lt > 38 ? "danger" : "warning",
      });
    }

    const daysInCycle = daysBetween(c.startDate, today());
    if (daysInCycle > 23 && c.status === "incubating") {
      alerts.push({
        type: "danger", category: "environment",
        title: L(`دورة متأخرة — ${c.batchName}`, `Försenad cykel — ${c.batchName}`),
        description: L(`مرّ ${daysInCycle} يوماً والحالة لا تزال "تحضين". الطبيعي 21 يوماً. تحقق من الدفعة.`, `${daysInCycle} dagar har gått och status är fortfarande "inkubation". Normalt 21 dagar. Kontrollera batchen.`),
        severity: 8,
      });
    }

    if (c.status === "incubating" && daysInCycle >= 17 && daysInCycle <= 19 && !c.lockdownDate) {
      recommendations.push({
        priority: "high", category: "environment",
        title: L(`حان وقت الإقفال — ${c.batchName}`, `Dags för låsning — ${c.batchName}`),
        description: L(`اليوم ${daysInCycle} — يجب نقل البيض لوضع الإقفال: خفّض الحرارة لـ 37.0°م وارفع الرطوبة لـ 70%`, `Dag ${daysInCycle} — flytta äggen till låsningsposition: sänk temperaturen till 37,0°C och höj fuktigheten till 70%`),
        reason: L("الإقفال في اليوم 18 ضروري لنجاح الفقس", "Låsning dag 18 är nödvändig för lyckad kläckning"),
        impact: L("ارتفاع نسبة الفقس 15-25%", "Ökar kläckningsprocenten med 15-25%"), confidence: 95,
      });
    }
  }

  if (temps.length > 1) {
    const sd = stddev(temps);
    if (sd > 0.5) {
      anomalies.push({
        title: L("تذبذب حراري بين الفقاسات", "Temperaturvariation mellan kläckmaskiner"),
        description: L(`فارق كبير في الحرارة بين الدورات (انحراف ${sd.toFixed(2)}°م) — يدل على عدم معايرة`, `Stor temperaturskillnad mellan cykler (avvikelse ${sd.toFixed(2)}°C) — tyder på bristande kalibrering`),
        severity: "medium", metric: "temperature_variance",
        currentValue: `±${sd.toFixed(2)}°C`, expectedRange: L("< 0.3°م", "< 0.3°C"), category: "environment",
      });
    }
  }

  let envScore = 100;
  alerts.forEach(a => { envScore -= a.severity * 3; });
  anomalies.forEach(a => { envScore -= a.severity === "critical" ? 15 : a.severity === "high" ? 10 : 5; });

  return { alerts, anomalies, sectionItems: items, score: clamp(envScore, 0, 100), recommendations };
}

function analyzeBiological(flocks: Flock[], cycles: HatchingCycle[], lang: EngineLang = "ar"): {
  alerts: Alert[];
  anomalies: Anomaly[];
  sectionItems: SectionItem[];
  score: number;
  predictions: Prediction[];
  recommendations: Recommendation[];
  trends: TrendPoint[];
} {
  const L = (ar: string, sv: string) => tr(lang, ar, sv);
  const alerts: Alert[] = [];
  const anomalies: Anomaly[] = [];
  const predictions: Prediction[] = [];
  const recommendations: Recommendation[] = [];
  const items: SectionItem[] = [];
  const trendPoints: TrendPoint[] = [];

  const totalBirds = flocks.reduce((a, f) => a + f.count, 0);
  items.push({ label: L("إجمالي الطيور", "Totalt antal fåglar"), value: String(totalBirds), status: totalBirds > 0 ? "good" : "warning" });
  items.push({ label: L("عدد القطعان", "Antal flockar"), value: String(flocks.length), status: flocks.length > 0 ? "good" : "neutral" });

  for (const f of flocks) {
    if (f.count < SCIENCE.flock.minFlockSize) {
      alerts.push({
        type: "info", category: "biological",
        title: L(`قطيع صغير — ${f.name}`, `Liten flock — ${f.name}`),
        description: L(`${f.count} طير فقط. القطعان الصغيرة أقل كفاءة اقتصادياً.`, `Bara ${f.count} fåglar. Små flockar är mindre ekonomiskt effektiva.`),
        severity: 2,
      });
    }
    const maxAge = f.purpose === "لحم" || f.purpose === "meat" ? SCIENCE.flock.maxAgeDaysBroilers : SCIENCE.flock.maxAgeDaysLayers;
    if (f.ageDays > maxAge) {
      alerts.push({
        type: "warning", category: "biological",
        title: L(`عمر متقدم — ${f.name}`, `Hög ålder — ${f.name}`),
        description: L(`${f.ageDays} يوم (الحد المعتاد ${maxAge} يوم لـ ${f.purpose}). راجع الجدوى الاقتصادية.`, `${f.ageDays} dagar (vanlig gräns ${maxAge} dagar). Granska den ekonomiska lönsamheten.`),
        severity: 4,
      });
    }
    if (f.ageDays <= 7) {
      recommendations.push({
        priority: "high", category: "biological",
        title: L(`مراقبة مكثفة — ${f.name}`, `Intensiv övervakning — ${f.name}`),
        description: L(`القطيع في الأسبوع الأول (${f.ageDays} يوم). راقب: الحرارة 33-35°م، الشرب، النشاط.`, `Flocken är i sin första vecka (${f.ageDays} dagar). Övervaka: temperatur 33-35°C, vattenintag, aktivitet.`),
        reason: L("أول 7 أيام حرجة — 70% من مشاكل التربية تبدأ هنا", "De första 7 dagarna är kritiska — 70% av uppfödningsproblem börjar här"),
        impact: L("تقليل النفوق المبكر بنسبة 40-60%", "Minskar tidig dödlighet med 40-60%"), confidence: 90,
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
      label: L("معدل الفقس الإجمالي", "Total kläckningsprocent"), value: `${overallRate.toFixed(1)}%`,
      status: overallRate >= SCIENCE.incubation.hatchRate.excellent ? "good" :
        overallRate >= SCIENCE.incubation.hatchRate.acceptable ? "warning" : "danger",
      detail: overallRate >= 85 ? L("ممتاز", "Utmärkt") : overallRate >= 75 ? L("جيد", "Bra") : overallRate >= 65 ? L("مقبول", "Acceptabelt") : L("ضعيف", "Svagt"),
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
          title: L("تحسن مستمر في الفقس", "Fortsatt förbättring av kläckning"),
          description: L(`الأداء تحسّن من ${earlyAvg.toFixed(0)}% إلى ${recentAvg.toFixed(0)}%. التوقع: استمرار التحسن إذا حافظت على نفس الممارسات.`, `Prestandan förbättrades från ${earlyAvg.toFixed(0)}% till ${recentAvg.toFixed(0)}%. Prognos: fortsatt förbättring om samma rutiner behålls.`),
          confidence: "high", probability: 75, timeframe: L("الدورة القادمة", "Nästa cykel"), category: "biological",
        });
      } else if (recentAvg < earlyAvg - 5) {
        predictions.push({
          title: L("⚠️ تراجع في أداء الفقس", "⚠️ Försämrad kläckningsprestanda"),
          description: L(`انخفض من ${earlyAvg.toFixed(0)}% إلى ${recentAvg.toFixed(0)}%. يجب مراجعة الحرارة والرطوبة وجودة البيض.`, `Minskade från ${earlyAvg.toFixed(0)}% till ${recentAvg.toFixed(0)}%. Granska temperatur, fuktighet och äggkvalitet.`),
          confidence: "high", probability: 70, timeframe: L("فوري", "Omedelbart"), category: "biological",
        });
        alerts.push({
          type: "warning", category: "biological",
          title: L("اتجاه سلبي في نسبة الفقس", "Negativ trend i kläckningsprocent"),
          description: L("انخفاض مستمر في آخر 3 دورات. يحتاج تحقيق فوري.", "Kontinuerlig minskning under de senaste 3 cyklerna. Kräver omedelbar undersökning."),
          severity: 6,
        });
      }
    }

    for (const r of rates) {
      if (r.rate < SCIENCE.incubation.hatchRate.poor) {
        alerts.push({
          type: "danger", category: "biological",
          title: L(`فقس ضعيف جداً — ${r.name}`, `Mycket svag kläckning — ${r.name}`),
          description: L(`${r.rate.toFixed(0)}% فقط. الحد الأدنى المقبول ${SCIENCE.incubation.hatchRate.acceptable}%.`, `Bara ${r.rate.toFixed(0)}%. Acceptabel minimigräns är ${SCIENCE.incubation.hatchRate.acceptable}%.`),
          severity: 7,
        });
      }
    }

    if (rateValues.length > 2) {
      const sd = stddev(rateValues);
      if (sd > 15) {
        anomalies.push({
          title: L("تذبذب كبير في نسب الفقس", "Stor variation i kläckningsprocent"),
          description: L(`انحراف معياري ${sd.toFixed(1)}% بين الدورات — يدل على عدم ثبات في الإدارة أو جودة البيض`, `Standardavvikelse ${sd.toFixed(1)}% mellan cykler — tyder på instabil hantering eller äggkvalitet`),
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
        title: L("ادرس الفارق بين أفضل وأسوأ دورة", "Analysera skillnaden mellan bästa och sämsta cykel"),
        description: L(`أفضل: ${best.name} (${best.rate.toFixed(0)}%) vs أسوأ: ${worst.name} (${worst.rate.toFixed(0)}%). قارن: مصدر البيض، الحرارة، الرطوبة، عمر البيض.`, `Bäst: ${best.name} (${best.rate.toFixed(0)}%) vs Sämst: ${worst.name} (${worst.rate.toFixed(0)}%). Jämför: äggkälla, temperatur, fuktighet, äggålder.`),
        reason: L("فارق 20%+ يعني وجود متغير رئيسي يمكن تحسينه", "En skillnad på 20%+ innebär att det finns en viktig variabel att förbättra"),
        impact: L("رفع المعدل العام 10-15%", "Höjer den totala kläckningsprocenten med 10-15%"), confidence: 85,
      });
    }
  } else {
    items.push({ label: L("معدل الفقس", "Kläckningsprocent"), value: L("لا توجد بيانات", "Inga data"), status: "neutral" });
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
        title: L(`توقع فقس "${c.batchName}"`, `Kläckningsprognos "${c.batchName}"`),
        description: L(`متبقي ${daysLeft} أيام. بناءً على المعدل التاريخي، المتوقع فقس ~${Math.round(c.eggsSet * predictedRate / 100)} صوص من ${c.eggsSet} بيضة (${predictedRate.toFixed(0)}%).`, `${daysLeft} dagar kvar. Baserat på historisk kläckningsgrad förväntas ~${Math.round(c.eggsSet * predictedRate / 100)} kycklingar av ${c.eggsSet} ägg (${predictedRate.toFixed(0)}%).`),
        confidence: completedCycles.length >= 3 ? "high" : "medium",
        probability: Math.round(predictedRate),
        timeframe: L(`${daysLeft} أيام`, `${daysLeft} dagar`), category: "biological",
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

function analyzeOperational(tasks: Task[], goals: Goal[], notes: DailyNote[], lang: EngineLang = "ar"): {
  alerts: Alert[];
  sectionItems: SectionItem[];
  score: number;
  recommendations: Recommendation[];
  predictions: Prediction[];
  taskTrend: TrendPoint[];
  docTrend: TrendPoint[];
} {
  const L = (ar: string, sv: string) => tr(lang, ar, sv);
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

  items.push({ label: L("إجمالي المهام", "Totalt antal uppgifter"), value: String(tasks.length), status: tasks.length > 0 ? "good" : "neutral" });
  items.push({
    label: L("نسبة الإنجاز", "Slutförandeprocent"), value: `${completionRate.toFixed(0)}%`,
    status: completionRate >= SCIENCE.operations.taskCompletionGood ? "good" : completionRate >= 50 ? "warning" : "danger",
  });
  items.push({
    label: L("المتأخرة", "Försenade"), value: String(overdueTasks.length),
    status: overdueTasks.length === 0 ? "good" : overdueTasks.length <= 2 ? "warning" : "danger",
  });
  items.push({ label: L("مهام اليوم", "Dagens uppgifter"), value: String(todayTasks.length), status: todayTasks.length > 0 ? "warning" : "good" });

  if (overdueTasks.length > 0) {
    alerts.push({
      type: "danger", category: "operational",
      title: L(`${overdueTasks.length} مهمة متأخرة`, `${overdueTasks.length} försenade uppgifter`),
      description: overdueTasks.slice(0, 3).map(tk => `"${tk.title}" (${L("مستحقة", "förfallen")} ${tk.dueDate})`).join("، "),
      severity: Math.min(10, 5 + overdueTasks.length * 2),
    });
    recommendations.push({
      priority: "urgent", category: "operational",
      title: L("أغلق المهام المتأخرة اليوم", "Slutför försenade uppgifter idag"),
      description: L(`ابدأ بالأعلى أولوية: ${overdueTasks.sort((a, b) => {
        const pMap: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
        return (pMap[b.priority] || 0) - (pMap[a.priority] || 0);
      }).slice(0, 2).map(tk => `"${tk.title}"`).join("، ")}`, `Börja med högsta prioritet: ${overdueTasks.sort((a, b) => {
        const pMap: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
        return (pMap[b.priority] || 0) - (pMap[a.priority] || 0);
      }).slice(0, 2).map(tk => `"${tk.title}"`).join(", ")}`),
      reason: L("المهام المتأخرة تتراكم وتسبب خسائر تشغيلية", "Försenade uppgifter ackumuleras och orsakar driftförluster"),
      impact: L("تقليل المخاطر التشغيلية", "Minskar driftsrisker"), confidence: 95,
    });
  }

  const urgentPending = pendingTasks.filter(tk => tk.priority === "urgent" || tk.priority === "high");
  if (urgentPending.length > 3) {
    alerts.push({
      type: "warning", category: "operational",
      title: L(`${urgentPending.length} مهمة عالية الأولوية معلّقة`, `${urgentPending.length} högt prioriterade uppgifter väntar`),
      description: L("تراكم المهام العاجلة يشير إلى ضغط تشغيلي أو نقص في العمالة.", "Uppbyggnad av brådskande uppgifter tyder på driftstryck eller personalbrist."),
      severity: 5,
    });
  }

  const completedGoals = goals.filter(g => g.completed);
  const activeGoals = goals.filter(g => !g.completed);
  items.push({ label: L("الأهداف المحققة", "Uppnådda mål"), value: `${completedGoals.length}/${goals.length}`, status: completedGoals.length > 0 ? "good" : "neutral" });

  for (const g of activeGoals) {
    const target = Number(g.targetValue);
    const current = Number(g.currentValue);
    const progress = target > 0 ? (current / target) * 100 : 0;

    if (g.deadline && g.deadline < t && progress < 100) {
      alerts.push({
        type: "warning", category: "operational",
        title: L(`هدف متأخر — ${g.title}`, `Försenat mål — ${g.title}`),
        description: L(`التقدم ${progress.toFixed(0)}% فقط والموعد النهائي انتهى (${g.deadline}).`, `Bara ${progress.toFixed(0)}% framsteg och deadline har passerat (${g.deadline}).`),
        severity: 5,
      });
    }

    if (g.deadline) {
      const daysLeft = daysBetween(t, g.deadline);
      if (daysLeft > 0 && daysLeft <= 7 && progress < 80) {
        recommendations.push({
          priority: "high", category: "operational",
          title: L(`تسريع هدف "${g.title}"`, `Påskynda mål "${g.title}"`),
          description: L(`متبقي ${daysLeft} أيام والتقدم ${progress.toFixed(0)}% فقط. تحتاج ${(target - current).toFixed(1)} ${g.unit} إضافية.`, `${daysLeft} dagar kvar och bara ${progress.toFixed(0)}% framsteg. Du behöver ${(target - current).toFixed(1)} ${g.unit} till.`),
          reason: L("الموعد النهائي قريب جداً", "Deadline är mycket nära"),
          impact: L("تحقيق الهدف في الوقت", "Uppnå målet i tid"), confidence: 80,
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
    label: L("التوثيق (آخر 7 أيام)", "Dokumentation (senaste 7 dagar)"), value: `${uniqueNoteDays}/7 ${L("أيام", "dagar")}`,
    status: uniqueNoteDays >= SCIENCE.operations.documentationFreqGood ? "good" :
      uniqueNoteDays >= SCIENCE.operations.documentationFreqMin ? "warning" : "danger",
  });

  if (uniqueNoteDays < SCIENCE.operations.documentationFreqMin) {
    alerts.push({
      type: "warning", category: "operational",
      title: L("توثيق ضعيف", "Svag dokumentation"),
      description: L(`${uniqueNoteDays} ملاحظة فقط في آخر أسبوع. التحليل الذكي يحتاج بيانات يومية ليكون دقيقاً.`, `Bara ${uniqueNoteDays} anteckningar den senaste veckan. AI-analysen behöver dagliga data för att vara noggrann.`),
      severity: 5,
    });
    recommendations.push({
      priority: "medium", category: "operational",
      title: L("سجّل ملاحظة يومية", "Registrera dagliga anteckningar"),
      description: L("اكتب: الحرارة، الرطوبة، استهلاك العلف/الماء، أي أعراض، النفوق، سلوك القطيع.", "Skriv: temperatur, fuktighet, foder/vattenförbrukning, symptom, dödlighet, flockbeteende."),
      reason: L("البيانات المنتظمة أساس التوقعات والإنذارات المبكرة", "Regelbunden data är grunden för prognoser och tidig varning"),
      impact: L("تحسين دقة التحليل 50%+", "Förbättrar analysens noggrannhet med 50%+"), confidence: 90,
    });
  }

  const weeks = [last30Days.slice(0, 7), last30Days.slice(7, 14), last30Days.slice(14, 21), last30Days.slice(21, 28)];
  const docTrend: TrendPoint[] = weeks.map((w, i) => ({
    label: L(`أسبوع ${i + 1}`, `Vecka ${i + 1}`),
    value: new Set(notes.filter(n => w.includes(n.date)).map(n => n.date)).size,
  }));

  const diseaseNotes = notes.filter(n => KEYWORDS_DISEASE.some(k => n.content.includes(k)));
  if (diseaseNotes.length > 0) {
    const recent = diseaseNotes.filter(n => last7.includes(n.date));
    if (recent.length > 0) {
      alerts.push({
        type: "danger", category: "operational",
        title: L("إشارات مرضية في الملاحظات الأخيرة", "Sjukdomstecken i senaste anteckningar"),
        description: L(`${recent.length} ملاحظة تحتوي كلمات مرضية: ${recent.slice(0, 2).map(n => `"${n.content.substring(0, 50)}..."`).join("، ")}`, `${recent.length} anteckning(ar) innehåller sjukdomsrelaterade ord: ${recent.slice(0, 2).map(n => `"${n.content.substring(0, 50)}..."`).join(", ")}`),
        severity: 8,
      });
      predictions.push({
        title: L("احتمال تفشي مرضي", "Risk för sjukdomsutbrott"),
        description: L("الملاحظات الأخيرة تشير إلى أعراض مرضية. يجب فحص القطيع خلال 24 ساعة.", "Senaste anteckningar tyder på sjukdomssymptom. Flocken bör inspekteras inom 24 timmar."),
        confidence: "medium", probability: 60, timeframe: L("24-48 ساعة", "24-48 timmar"), category: "biological",
      });
    }
  }

  const envNotes = notes.filter(n => KEYWORDS_ENVIRONMENT.some(k => n.content.includes(k)));
  if (envNotes.length > 2) {
    const recentEnv = envNotes.filter(n => last7.includes(n.date));
    if (recentEnv.length >= 3) {
      alerts.push({
        type: "info", category: "operational",
        title: L("ملاحظات بيئية متكررة", "Återkommande miljöanteckningar"),
        description: L(`${recentEnv.length} ملاحظات عن البيئة في آخر أسبوع. قد يشير لمشكلة بيئية مستمرة.`, `${recentEnv.length} miljörelaterade anteckningar den senaste veckan. Kan tyda på ett pågående miljöproblem.`),
        severity: 3,
      });
    }
  }

  const taskTrend: TrendPoint[] = weeks.map((w, i) => {
    const weekTasks = tasks.filter(tk => tk.createdAt && w.includes(new Date(tk.createdAt).toISOString().split("T")[0]));
    const weekCompleted = weekTasks.filter(tk => tk.completed).length;
    return { label: L(`أسبوع ${i + 1}`, `Vecka ${i + 1}`), value: weekTasks.length > 0 ? Math.round((weekCompleted / weekTasks.length) * 100) : 0 };
  });

  let opsScore = 80;
  opsScore -= overdueTasks.length * 8;
  opsScore -= (completionRate < 50 ? 15 : completionRate < 70 ? 8 : 0);
  opsScore -= (uniqueNoteDays < 2 ? 10 : uniqueNoteDays < 4 ? 5 : 0);
  opsScore += completedGoals.length * 3;
  alerts.forEach(a => { opsScore -= a.severity; });

  return { alerts, sectionItems: items, score: clamp(opsScore, 0, 100), recommendations, predictions, taskTrend, docTrend };
}

function assessDataQuality(data: RawFarmData, lang: EngineLang = "ar"): { score: number; label: string; issues: string[] } {
  const L = (ar: string, sv: string) => tr(lang, ar, sv);
  const issues: string[] = [];
  let score = 100;

  if (data.flocks.length === 0) { issues.push(L("لا توجد قطعان مسجلة", "Inga registrerade flockar")); score -= 20; }
  if (data.hatchingCycles.length === 0) { issues.push(L("لا توجد دورات تفقيس", "Inga kläckcykler")); score -= 15; }
  if (data.tasks.length === 0) { issues.push(L("لا توجد مهام", "Inga uppgifter")); score -= 10; }
  if (data.notes.length === 0) { issues.push(L("لا توجد ملاحظات يومية — البيانات غير كافية للتحليل العميق", "Inga dagliga anteckningar — otillräcklig data för djupanalys")); score -= 20; }
  if (data.goals.length === 0) { issues.push(L("لا توجد أهداف محددة", "Inga definierade mål")); score -= 5; }

  const activeCycles = data.hatchingCycles.filter(c => c.status === "incubating" || c.status === "hatching");
  const missingTemp = activeCycles.filter(c => !c.temperature).length;
  if (missingTemp > 0) { issues.push(L(`${missingTemp} دورة نشطة بدون قراءة حرارة`, `${missingTemp} aktiv(a) cykel/cykler utan temperaturavläsning`)); score -= missingTemp * 5; }
  const missingHum = activeCycles.filter(c => !c.humidity).length;
  if (missingHum > 0) { issues.push(L(`${missingHum} دورة نشطة بدون قراءة رطوبة`, `${missingHum} aktiv(a) cykel/cykler utan fuktighetsavläsning`)); score -= missingHum * 5; }

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    return d.toISOString().split("T")[0];
  });
  const recentNotes = data.notes.filter(n => last7.includes(n.date));
  if (recentNotes.length < 3) { issues.push(L("ملاحظات قليلة في آخر 7 أيام", "Få anteckningar de senaste 7 dagarna")); score -= 10; }

  score = clamp(score, 0, 100);
  const label = score >= 80 ? L("ممتازة", "Utmärkt") : score >= 60 ? L("جيدة", "Bra") : score >= 40 ? L("مقبولة", "Acceptabel") : L("ضعيفة", "Svag");
  return { score, label, issues };
}

function buildLiveInsights(data: RawFarmData, lang: EngineLang): LiveInsight[] {
  const L = (ar: string, sv: string) => tr(lang, ar, sv);
  const t = today();
  const insights: LiveInsight[] = [];

  // 1. Total birds on farm
  const totalBirds = data.flocks.reduce((a, f) => a + f.count, 0);
  const flockCount = data.flocks.length;
  insights.push({
    id: "birds",
    icon: "🐓",
    title: L("الطيور النشطة", "Aktiva fåglar"),
    value: String(totalBirds),
    unit: L("طير", "fåglar"),
    detail: flockCount === 0
      ? L("لا توجد قطعان مسجلة حالياً", "Inga flockar registrerade")
      : L(`موزعة على ${flockCount} قطيع — ${data.flocks.map(f => `${f.name} (${f.count})`).slice(0, 3).join("، ")}`, `Fördelat på ${flockCount} flock — ${data.flocks.map(f => `${f.name} (${f.count})`).slice(0, 3).join(", ")}`),
    status: totalBirds > 0 ? "good" : "warning",
    badge: flockCount > 0 ? L(`${flockCount} قطيع`, `${flockCount} flockar`) : undefined,
  });

  // 2. Active hatching cycles + closest hatch countdown
  const activeCycles = data.hatchingCycles.filter(c => c.status === "incubating" || c.status === "hatching");
  const totalEggsIncubating = activeCycles.reduce((a, c) => a + c.eggsSet, 0);
  let closestDaysLeft: number | null = null;
  let closestBatch = "";
  for (const c of activeCycles) {
    const daysLeft = Math.ceil((new Date(c.expectedHatchDate).getTime() - new Date(t).getTime()) / 86400000);
    if (closestDaysLeft === null || daysLeft < closestDaysLeft) {
      closestDaysLeft = daysLeft;
      closestBatch = c.batchName;
    }
  }
  const hatchStatus: LiveInsight["status"] = activeCycles.length === 0 ? "neutral" : closestDaysLeft !== null && closestDaysLeft <= 3 ? "warning" : "good";
  insights.push({
    id: "hatching",
    icon: "🥚",
    title: L("دورات التفقيس", "Kläckningscykler"),
    value: String(totalEggsIncubating),
    unit: L("بيضة", "ägg"),
    detail: activeCycles.length === 0
      ? L("لا توجد دورات نشطة حالياً", "Inga aktiva cykler just nu")
      : closestDaysLeft !== null && closestDaysLeft <= 0
        ? L(`🔔 ${closestBatch} — موعد الفقس اليوم أو تجاوز!`, `🔔 ${closestBatch} — kläckningsdatum idag eller passerat!`)
        : closestDaysLeft !== null && closestDaysLeft <= 3
          ? L(`⚠️ ${closestBatch} — فقس خلال ${closestDaysLeft} يوم`, `⚠️ ${closestBatch} — kläcks om ${closestDaysLeft} dagar`)
          : L(`أقرب دفعة: ${closestBatch} بعد ${closestDaysLeft} يوم`, `Nästa batch: ${closestBatch} om ${closestDaysLeft} dagar`),
    status: hatchStatus,
    badge: activeCycles.length > 0 ? L(`${activeCycles.length} دورة`, `${activeCycles.length} cykel`) : undefined,
  });

  // 3. Average hatch rate (last 3 completed cycles)
  const completedCycles = data.hatchingCycles.filter(c => c.status === "completed" && c.eggsHatched != null);
  const last3 = completedCycles.slice(-3);
  let hatchRateStr = "—";
  let hatchRateStatus: LiveInsight["status"] = "neutral";
  let hatchRateDetail = L("لا توجد دورات مكتملة بعد", "Inga avslutade cykler ännu");
  if (last3.length > 0) {
    const avg = last3.reduce((a, c) => a + (c.eggsSet > 0 ? ((c.eggsHatched! / c.eggsSet) * 100) : 0), 0) / last3.length;
    hatchRateStr = avg.toFixed(1);
    hatchRateStatus = avg >= SCIENCE.incubation.hatchRate.good ? "good" : avg >= SCIENCE.incubation.hatchRate.acceptable ? "warning" : "critical";
    const trend: LiveInsight["trend"] = last3.length >= 2
      ? (((last3[last3.length - 1].eggsHatched! / last3[last3.length - 1].eggsSet) * 100) >
         ((last3[last3.length - 2].eggsHatched! / last3[last3.length - 2].eggsSet) * 100) ? "up" : "down")
      : "stable";
    hatchRateDetail = avg >= SCIENCE.incubation.hatchRate.excellent
      ? L(`ممتاز — آخر ${last3.length} دورات: معدل ${avg.toFixed(0)}%`, `Utmärkt — Senaste ${last3.length} cykler: snitt ${avg.toFixed(0)}%`)
      : avg >= SCIENCE.incubation.hatchRate.good
        ? L(`جيد — حافظ على الحرارة والرطوبة لرفعه`, `Bra — Håll temp och fukt för att förbättra`)
        : avg >= SCIENCE.incubation.hatchRate.acceptable
          ? L(`مقبول — مجال للتحسين في ضبط الحرارة والتقليب`, `Acceptabelt — Förbättringsmöjligheter i temperatur och vändning`)
          : L(`ضعيف — راجع: جودة البيض، الحرارة، الرطوبة، التقليب`, `Svagt — Granska: äggkvalitet, temperatur, fuktighet, vändning`);
    insights.push({ id: "hatchrate", icon: "📊", title: L("معدل الفقس (آخر 3)", "Kläckningsgrad (senaste 3)"), value: hatchRateStr, unit: "%", detail: hatchRateDetail, status: hatchRateStatus, trend });
  } else {
    insights.push({ id: "hatchrate", icon: "📊", title: L("معدل الفقس", "Kläckningsgrad"), value: "—", unit: "%", detail: hatchRateDetail, status: "neutral" });
  }

  // 4. Tasks status (pending / overdue)
  const pendingTasks = data.tasks.filter(t2 => !t2.completed);
  const overdueTasks = pendingTasks.filter(t2 => t2.dueDate && t2.dueDate < t);
  const completedToday = data.tasks.filter(t2 => t2.completed && t2.dueDate === t).length;
  const taskStatus: LiveInsight["status"] = overdueTasks.length > 3 ? "critical" : overdueTasks.length > 0 ? "warning" : "good";
  insights.push({
    id: "tasks",
    icon: "📋",
    title: L("المهام المعلقة", "Pågående uppgifter"),
    value: String(pendingTasks.length),
    unit: L("مهمة", "uppgifter"),
    detail: overdueTasks.length > 0
      ? L(`⚠️ ${overdueTasks.length} مهمة متأخرة — معالجتها أولى`, `⚠️ ${overdueTasks.length} försenade — hantera dessa först`)
      : pendingTasks.length === 0
        ? L("✓ جميع المهام مكتملة — عمل ممتاز", "✓ Alla uppgifter klara — utmärkt arbete")
        : L(`${completedToday} مكتملة اليوم — ${pendingTasks.length} متبقية`, `${completedToday} klara idag — ${pendingTasks.length} återstår`),
    status: taskStatus,
    badge: overdueTasks.length > 0 ? L(`${overdueTasks.length} متأخرة`, `${overdueTasks.length} försenade`) : undefined,
  });

  // 5. Goals progress
  const activeGoals = data.goals.filter(g => !g.completed);
  const completedGoals = data.goals.filter(g => g.completed);
  let avgProgress = 0;
  let goalStatus: LiveInsight["status"] = "neutral";
  let goalDetail = L("لا توجد أهداف مسجلة بعد", "Inga mål registrerade ännu");
  if (data.goals.length > 0) {
    const progresses = data.goals.map(g => {
      const cur = parseFloat(g.currentValue) || 0;
      const tgt = parseFloat(g.targetValue) || 1;
      return Math.min((cur / tgt) * 100, 100);
    });
    avgProgress = progresses.reduce((a, b) => a + b, 0) / progresses.length;
    goalStatus = avgProgress >= 80 ? "good" : avgProgress >= 50 ? "warning" : "critical";
    goalDetail = L(
      `${completedGoals.length} هدف محقق — ${activeGoals.length} جارٍ — تقدم وسطي ${avgProgress.toFixed(0)}%`,
      `${completedGoals.length} uppnådda — ${activeGoals.length} pågående — snittframsteg ${avgProgress.toFixed(0)}%`
    );
  }
  insights.push({
    id: "goals",
    icon: "🎯",
    title: L("تقدم الأهداف", "Målframsteg"),
    value: String(data.goals.length > 0 ? avgProgress.toFixed(0) : "—"),
    unit: data.goals.length > 0 ? "%" : "",
    detail: goalDetail,
    status: goalStatus,
    badge: completedGoals.length > 0 ? L(`${completedGoals.length} منجز`, `${completedGoals.length} uppnådda`) : undefined,
  });

  // 6. Overall task completion rate (practical operational indicator)
  const allTasks = data.tasks;
  const completedTasks = allTasks.filter(t2 => t2.completed);
  const completionRate = allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0;
  const completionStatus: LiveInsight["status"] = completionRate >= 80 ? "good" : completionRate >= 50 ? "warning" : "critical";
  const sevenDaysAgo = new Date(new Date(t).getTime() - 7 * 86400000).toISOString().split("T")[0];
  const recentNotes = data.notes.filter(n => n.date >= sevenDaysAgo);
  const notesStatus: LiveInsight["status"] = recentNotes.length >= 5 ? "good" : recentNotes.length >= 2 ? "warning" : "critical";
  insights.push({
    id: "completion",
    icon: "✅",
    title: L("إنجاز المهام الكلي", "Total uppgiftskomplettering"),
    value: allTasks.length > 0 ? String(completionRate) : "—",
    unit: allTasks.length > 0 ? "%" : "",
    detail: allTasks.length === 0
      ? L("لا توجد مهام مسجلة بعد", "Inga uppgifter registrerade")
      : L(`${completedTasks.length} منجزة من ${allTasks.length} إجمالاً — ${overdueTasks.length} متأخرة`, `${completedTasks.length} klara av ${allTasks.length} totalt — ${overdueTasks.length} försenade`),
    status: completionStatus,
    trend: completionRate >= 80 ? "up" : completionRate >= 50 ? "stable" : "down",
    badge: overdueTasks.length > 0 ? L(`${overdueTasks.length} متأخرة`, `${overdueTasks.length} försenade`) : completedTasks.length > 0 ? L(`${completedTasks.length} منجزة`, `${completedTasks.length} klara`) : undefined,
  });

  return insights;
}

/* ─────────────────────────────────────────────────────────
   buildQuickSolve — Fast AI solution engine for a specific
   issue, using real farm data to produce actionable steps
───────────────────────────────────────────────────────── */
export interface QuickSolveStep {
  icon: string; title: string; detail: string;
  urgency: "critical" | "high" | "medium";
}
export interface QuickSolveResult {
  steps: QuickSolveStep[]; summary: string;
  timeframe: string; relatedFacts: string[];
}

export function buildQuickSolve(
  issue: { title: string; description: string; category?: string },
  data: RawFarmData,
  lang: EngineLang = "ar"
): QuickSolveResult {
  const L = (ar: string, sv: string) => tr(lang, ar, sv);
  const t = today();

  /* Smart keyword detection — checks both title and description */
  const combined = (issue.title + " " + issue.description).toLowerCase();
  const has = (...words: string[]) => words.some(w => combined.includes(w));

  const activeCycles = data.hatchingCycles.filter(c => c.status === "incubating" || c.status === "hatching");
  const completedCycles = data.hatchingCycles.filter(c => c.status === "completed" && c.eggsHatched != null);
  const pendingTasks = data.tasks.filter(t2 => !t2.completed);
  const overdueTasks = pendingTasks.filter(t2 => t2.dueDate && t2.dueDate < t);
  const totalBirds = data.flocks.reduce((a, f) => a + f.count, 0);
  const totalEggs = activeCycles.reduce((a, c) => a + c.eggsSet, 0);

  const steps: QuickSolveStep[] = [];
  const relatedFacts: string[] = [];
  let summary = "";
  let timeframe = L("24 ساعة", "24 timmar");

  /* ── 1. POOR HATCH RATE (فقس ضعيف) ── */
  if (has("فقس ضعيف", "نسبة الفقس", "kläckningsgrad", "låg kläck", "hatching rate")) {
    const lastCompleted = completedCycles.slice(-5);
    lastCompleted.forEach(c => {
      const rate = c.eggsSet > 0 ? ((c.eggsHatched! / c.eggsSet) * 100).toFixed(1) : "0";
      relatedFacts.push(L(`${c.batchName}: فقس ${rate}% (${c.eggsHatched}/${c.eggsSet} بيضة)`, `${c.batchName}: ${rate}% kläckning (${c.eggsHatched}/${c.eggsSet} ägg)`));
    });
    activeCycles.forEach(c => {
      const daysIn = Math.floor((new Date(t).getTime() - new Date(c.startDate).getTime()) / 86400000);
      relatedFacts.push(L(`جارية — ${c.batchName}: اليوم ${daysIn}/${c.incubationDays}`, `Pågående — ${c.batchName}: Dag ${daysIn}/${c.incubationDays}`));
    });
    const avgRate = lastCompleted.length > 0 ? lastCompleted.reduce((a, c) => a + (c.eggsSet > 0 ? (c.eggsHatched! / c.eggsSet * 100) : 0), 0) / lastCompleted.length : 0;

    steps.push(
      { icon: "🌡️", title: L("افحص ثبات الحرارة أولاً — السبب #1 لضعف الفقس", "Kontrollera temperaturstabilitet — orsak #1 till svag kläckning"), detail: L(`المثالي: 37.5-37.8°م. كل ارتفاع 0.3°م يقلل الفقس 5-10%. ثبات الحرارة أهم من مجرد الرقم الصحيح. لديك ${activeCycles.length} دورة نشطة`, `Optimal: 37,5-37,8°C. Varje 0,3°C-höjning minskar kläckning med 5-10%. Stabilitet viktigare än exakt värde. Du har ${activeCycles.length} aktiva cykler`), urgency: "critical" },
      { icon: "💧", title: L("اضبط الرطوبة بدقة — السبب #2", "Justera fuktigheten noggrant — orsak #2"), detail: L("الحضانة: 50-55%. الإقفال (يوم 18-21): 70-75%. انخفاض الرطوبة → جفاف الأجنة. ارتفاعها → اختناقها. قِسها بميزان رطوبة معايَر", "Inkubation: 50-55%. Lockdown (dag 18-21): 70-75%. Låg fuktighet → uttorkning. Hög → kvävning. Mät med kalibrerad hygrometer"), urgency: "critical" },
      { icon: "🔄", title: L("راجع التقليب — السبب #3", "Granska vändningsrutinen — orsak #3"), detail: L("المطلوب: 3-5 مرات يومياً حتى اليوم 17. التقليب غير المنتظم يلصق الجنين بالقشرة ويقتله. التوقف يوم 18 إلزامي", "Krävs: 3-5 gånger/dag till och med dag 17. Ojämn vändning klistrar embryot till skalet. Stopp dag 18 är obligatoriskt"), urgency: "high" },
      { icon: "🥚", title: L("تحقق من جودة البيض المُحضَّن — السبب #4", "Kontrollera kvaliteten på inkuberade ägg — orsak #4"), detail: L("البيض الأكثر من 7 أيام: الفقس ينخفض 1-2% يومياً. البيض المكسور أو الملوث يجب إزالته قبل التحضين. حرارة التخزين: 15-18°م", "Ägg äldre än 7 dagar: kläckning minskar 1-2% per dag. Spruckna/smutsiga ägg måste avlägsnas. Förvaringstemperatur: 15-18°C"), urgency: "high" },
      { icon: "🔬", title: L("افحص البيض غير المفقوس بالضوء لتحديد سبب الفشل", "Undersök ej kläckta ägg med ljus för att hitta felorsaken"), detail: L("موت اليوم 1-5: تلوث أو سوء بيض. اليوم 6-14: مشكلة تهوية أو رطوبة. اليوم 15-21: مشكلة إقفال أو إفراط حرارة. معرفة السبب تمنع التكرار", "Död dag 1-5: kontamination/äggkvalitet. Dag 6-14: ventilation/fuktighet. Dag 15-21: lockdown/överhettning"), urgency: "medium" },
      { icon: "📊", title: L("سجّل كل نتائج دوراتك لمقارنة التحسن", "Registrera alla dina cykelresultat för att mäta förbättring"), detail: L(`معدلك الحالي: ${avgRate > 0 ? avgRate.toFixed(0) + "%" : "غير محدد"}. الهدف: 75%+ للبيض المحلي، 85%+ للمخصَّب تجارياً. التسجيل المستمر يكشف النمط`, `Din nuvarande kläckprocent: ${avgRate > 0 ? avgRate.toFixed(0) + "%" : "okänd"}. Mål: 75%+ för lokala ägg, 85%+ för kommersiellt befruktade`), urgency: "medium" },
    );
    summary = L(`فقس ضعيف له أسباب علمية واضحة. ${avgRate > 0 ? `معدلك الحالي ${avgRate.toFixed(0)}%.` : ""} عالج الأسباب الأربعة بالترتيب: حرارة → رطوبة → تقليب → بيض. التحسن واضح خلال دورة واحدة.`, `Svag kläckning har tydliga vetenskapliga orsaker. ${avgRate > 0 ? `Din nuv. kläckprocent: ${avgRate.toFixed(0)}%.` : ""} Behandla fyra orsaker i ordning: temperatur → fuktighet → vändning → ägg.`);
    timeframe = L("دورة واحدة (21 يوم)", "En cykel (21 dagar)");

  /* ── 2. TEMPERATURE CRISIS (حرارة خطيرة/مرتفعة/منخفضة) ── */
  } else if (has("حرارة خطيرة", "حرارة مرتفعة", "حرارة منخفضة", "حرارة أقل", "انخفاض حراري", "تسجيل الحرارة", "farlig temperatur", "hög temperatur", "låg temperatur", "temperatur")) {
    activeCycles.forEach(c => {
      const temp = c.temperature ? `${Number(c.temperature)}°م` : L("غير مسجلة", "ej registrerad");
      const daysIn = Math.floor((new Date(t).getTime() - new Date(c.startDate).getTime()) / 86400000);
      relatedFacts.push(L(`${c.batchName}: حرارة ${temp} — اليوم ${daysIn}/${c.incubationDays}`, `${c.batchName}: Temp ${temp} — dag ${daysIn}/${c.incubationDays}`));
    });
    const isHigh = has("مرتفعة", "خطيرة", "تتجاوز", "hög", "farlig", "överstiger");
    const isMissing = has("تسجيل الحرارة", "مفقودة", "saknad");

    steps.push(
      { icon: "🌡️", title: L(isMissing ? "سجّل الحرارة الآن في صفحة التفقيس" : isHigh ? "اخفض الحرارة فوراً — كل دقيقة مهمة" : "ارفع الحرارة بتدريج آمن", isMissing ? "Registrera temperaturen nu i kläckningssidan" : isHigh ? "Sänk temperaturen omedelbart — varje minut räknas" : "Höj temperaturen gradvis och säkert"), detail: L(isMissing ? `افتح صفحة التفقيس وسجّل قراءة الحرارة لكل دفعة نشطة (${activeCycles.length} دفعة). التحليل الدقيق يعتمد على هذه البيانات` : isHigh ? "افتح باب الحاضنة 30 ثانية. أبعد مصدر الحرارة. لا تضع ثلجاً أو ماء بارداً مباشرة — الصدمة الحرارية تقتل الأجنة" : "افحص الترموستات أولاً. تحقق من إغلاق الباب محكماً. أضف مصدر حرارة تدريجياً. الهدف: 37.5°م", isMissing ? `Öppna kläckningssidan och registrera temperaturavläsning för varje aktiv sats (${activeCycles.length} satser)` : isHigh ? "Öppna luckan 30 sekunder. Ta bort värmekällan. Häll inte is eller kallt vatten direkt" : "Kontrollera termostaten. Se till att luckan är tätslutande. Tillsätt värme gradvis"), urgency: "critical" },
      { icon: "⏱️", title: L("راقب الحرارة كل 30 دقيقة حتى الاستقرار التام", "Övervaka temperaturen var 30:e minut tills helt stabil"), detail: L("سجّل كل قراءة في الملاحظات مع الوقت. إذا لم تستقر خلال ساعتين → يحتمل عطل في الترموستات", "Registrera varje avläsning med tidpunkt. Om ej stabil efter 2 timmar → möjligt termostatfel"), urgency: "critical" },
      { icon: "🔧", title: L("اختبر دقة حساس الحرارة بميزان مرجعي", "Testa temperatursensorns noggrannhet med referenstermometer"), detail: L("ضع ميزاناً حرارياً طبياً أو مرجعياً داخل الحاضنة. فرق ±0.5°م → الحاضنة تحتاج معايرة عاجلة", "Placera en medicinsk eller referenstermometer inuti maskinen. ±0,5°C-skillnad → maskinen behöver kalibrering"), urgency: "high" },
      { icon: "💧", title: L("افحص الرطوبة فوراً — الحرارة تؤثر عليها مباشرة", "Kontrollera fuktigheten direkt — temperaturen påverkar den"), detail: L("ارتفاع الحرارة يخفض الرطوبة. انخفاضها يرفعها. المثالي: 50-55% (الحضانة) / 70-75% (الإقفال)", "Höjd temperatur sänker fuktigheten. Sänkt temp höjer den. Optimal: 50-55% (inkubation) / 70-75% (lockdown)"), urgency: "high" },
    );
    summary = L(`${isMissing ? "تسجيل الحرارة ضروري لدقة التحليل وسلامة الأجنة." : isHigh ? "أزمة حرارية مرتفعة تهدد الأجنة — كل ساعة تأخير ترفع الخسائر." : "انخفاض الحرارة يبطئ نمو الأجنة ويزيد تشوهات الفقس."} لديك ${totalEggs} بيضة في ${activeCycles.length} دورة نشطة.`, `${isMissing ? "Temperaturregistrering krävs för korrekt analys." : isHigh ? "Temperaturkris hotar embryon — varje timmes fördröjning ökar förlusterna." : "Låg temperatur bromsar embryonas tillväxt."} Du har ${totalEggs} ägg i ${activeCycles.length} aktiva cykler.`);
    timeframe = L(isMissing ? "الآن" : "أقل من ساعة", isMissing ? "Nu" : "Under 1 timme");

  /* ── 3. DOCUMENTATION QUALITY (توثيق ضعيف) ── */
  } else if (has("توثيق ضعيف", "توثيق", "تسجيل ضعيف", "مذكرات", "dokumentation", "registrering", "anteckning")) {
    const sevenDaysAgo = new Date(new Date(t).getTime() - 7 * 86400000).toISOString().split("T")[0];
    const recentNotes = data.notes.filter(n => n.date >= sevenDaysAgo).length;
    relatedFacts.push(L(`المذكرات في آخر 7 أيام: ${recentNotes} (الهدف: 5+)`, `Anteckningar senaste 7 dagarna: ${recentNotes} (mål: 5+)`));
    relatedFacts.push(L(`دورات التفقيس المسجلة: ${data.hatchingCycles.length}`, `Kläckningscykler registrerade: ${data.hatchingCycles.length}`));
    relatedFacts.push(L(`الطيور المسجلة: ${totalBirds} في ${data.flocks.length} قطعان`, `Registrerade fåglar: ${totalBirds} i ${data.flocks.length} flockar`));

    steps.push(
      { icon: "📝", title: L("سجّل ملاحظة يومية الآن — أقل من دقيقتين", "Registrera en daganteckning nu — under 2 minuter"), detail: L("اكتب ثلاثة أشياء فقط: 1️⃣ حرارة الحاضنة 2️⃣ حالة الطيور (طبيعية/مشبوهة) 3️⃣ أي ملاحظة غريبة. البساطة أهم من الكمال", "Skriv tre saker: 1️⃣ Kläckmaskinens temperatur 2️⃣ Fåglarnas tillstånd 3️⃣ Något ovanligt. Enkelhet slår perfektion"), urgency: "critical" },
      { icon: "🌡️", title: L("أكمل بيانات الحرارة في صفحة التفقيس", "Fyll i temperaturdata på kläckningssidan"), detail: L(`${activeCycles.length > 0 ? `${activeCycles.length} دفعة نشطة تنتظر قراءات حرارة ورطوبة — سجّلها الآن` : "ابدأ بتسجيل الحرارة عند كل دورة جديدة منذ أول يوم"}`, `${activeCycles.length > 0 ? `${activeCycles.length} aktiva satser väntar på temperatur- och fuktighetsavläsningar` : "Börja registrera temperatur från dag 1 av varje ny cykel"}`), urgency: "high" },
      { icon: "🥚", title: L("سجّل نتائج كل دورة تفقيس عند انتهائها", "Registrera resultaten av varje kläckningscykel vid avslut"), detail: L("بيانات الفقس (خرج/وضع) ضرورية لحساب معدل الفقس وتحسين الأداء. بدونها التحليل أعمى", "Kläckdata (kläckta/lagda) krävs för att beräkna kläckprocent. Utan dem är analysen blind"), urgency: "high" },
      { icon: "📊", title: L("أضف ملاحظة أسبوعية شاملة كل أحد", "Lägg till en heltäckande veckoanteckning varje söndag"), detail: L("5 دقائق كل أسبوع تكفي: الإنتاج + المشاكل + القرارات المتخذة + الخطط. هذا يبني تاريخاً للمزرعة", "5 minuter per vecka räcker: produktion + problem + beslut + planer. Detta bygger gårdens historia"), urgency: "medium" },
    );
    summary = L(`التوثيق الضعيف يخفي المشاكل ويجعل الأخطاء تتكرر. ${recentNotes} ملاحظة هذا الأسبوع — الهدف 5+. التحليل الدقيق يعتمد على سجلاتك.`, `Svag dokumentation döljer problem och låter misstag upprepas. ${recentNotes} anteckningar denna vecka — mål: 5+. Exakt analys beror på dina register.`);
    timeframe = L("هذا الأسبوع (ابدأ الآن)", "Den här veckan (börja nu)");

  /* ── 4. OVERDUE HATCHING CYCLE (دورة متأخرة) ── */
  } else if (has("دورة متأخرة", "متأخرة", "مرّ", "يوم 23", "يوم 24", "försenad cykel", "dagar har gått", "dag 23")) {
    const overdueCycles = activeCycles.filter(c => {
      const daysIn = Math.floor((new Date(t).getTime() - new Date(c.startDate).getTime()) / 86400000);
      return c.status === "incubating" && daysIn > 22;
    });
    overdueCycles.forEach(c => {
      const daysIn = Math.floor((new Date(t).getTime() - new Date(c.startDate).getTime()) / 86400000);
      relatedFacts.push(L(`${c.batchName}: اليوم ${daysIn} (متجاوز الـ21) — ${c.eggsSet} بيضة`, `${c.batchName}: Dag ${daysIn} (passerat 21) — ${c.eggsSet} ägg`));
    });

    steps.push(
      { icon: "🔦", title: L("افحص البيض بالضوء (candling) الآن", "Kontrollera äggen med ljus (candling) nu"), detail: L("ابحث عن: حركة الجنين (حي)، تشقق القشرة (يفقس الآن)، أو بيضة داكنة كاملة (ميتة). الفحص بالضوء يجيب في 5 دقائق", "Sök efter: embryorörelse (levande), sprickbildning (håller på att kläckas), eller helt mörkt ägg (dött)"), urgency: "critical" },
      { icon: "🌡️", title: L("تحقق من سجل الحرارة — الانخفاض يؤخر الفقس", "Granska temperaturloggen — låg temp fördröjer kläckning"), detail: L("كل 0.3°م انخفاض عن 37.5°م يؤخر الفقس يوماً إضافياً. الحاضنة بدون حرارة مسجلة تعني عدم اليقين", "Varje 0,3°C under 37,5°C fördröjer kläckning med ~1 extra dag"), urgency: "high" },
      { icon: "🚫", title: L("لا تفتح الحاضنة إلا للضرورة القصوى", "Öppna bara maskinen om absolut nödvändigt"), detail: L("فتح الحاضنة يفقدها 10-20% رطوبة و1-2°م حرارة. الصيصان الجاهزة للخروج تتضرر من التغيير المفاجئ", "Att öppna maskinen förlorar 10-20% fuktighet och 1-2°C. Kycklingar redo att kläckas skadas av plötsliga förändringar"), urgency: "critical" },
      { icon: "📋", title: L("بعد اليوم 25: حدّث حالة الدفعة", "Efter dag 25: uppdatera satsens status"), detail: L("إذا لم يحدث أي فقس بعد اليوم 25 → سجّل الدفعة كـ'مكتملة' مع الملاحظات. هذا يحسن دقة التحليل", "Om ingen kläckning skett efter dag 25 → registrera satsen som 'avslutad' med anteckningar"), urgency: "medium" },
    );
    summary = L(`دورة متجاوزة الموعد الطبيعي (21 يوماً). السبب الأكثر شيوعاً: انخفاض الحرارة أو تأخر الإقفال. الفحص بالضوء يعطيك الإجابة.`, `Cykel som passerat normalt datum (21 dagar). Vanligaste orsak: låg temperatur eller försenad lockdown.`);
    timeframe = L("ساعات", "Timmar");

  /* ── 5. LOCKDOWN (إقفال) ── */
  } else if (has("إقفال", "لوك داون", "يوم 17", "يوم 18", "يوم 19", "lockdown", "dag 18")) {
    const lockdownCycles = activeCycles.filter(c => {
      const daysIn = Math.floor((new Date(t).getTime() - new Date(c.startDate).getTime()) / 86400000);
      return daysIn >= 17 && daysIn <= 19;
    });
    lockdownCycles.forEach(c => {
      const daysIn = Math.floor((new Date(t).getTime() - new Date(c.startDate).getTime()) / 86400000);
      relatedFacts.push(L(`${c.batchName}: اليوم ${daysIn} — وقت الإقفال`, `${c.batchName}: Dag ${daysIn} — lockdown-dags`));
    });

    steps.push(
      { icon: "🔒", title: L("نفّذ بروتوكول الإقفال الكامل الآن", "Utför det fullständiga lockdown-protokollet nu"), detail: L("1️⃣ أوقف التقليب التلقائي نهائياً 2️⃣ ضع البيض بوضع أفقي 3️⃣ ارفع الرطوبة لـ 68-75% 4️⃣ خفّف تدريجياً الحرارة لـ 37.0°م", "1️⃣ Stoppa automatisk vändning 2️⃣ Lägg äggen horisontellt 3️⃣ Höj fuktigheten till 68-75% 4️⃣ Sänk gradvis temperaturen till 37,0°C"), urgency: "critical" },
      { icon: "🚫", title: L("لا تفتح الحاضنة من اليوم 18 حتى ينتهي الفقس", "Öppna ALDRIG maskinen från dag 18 till kläckning"), detail: L("فتح الحاضنة في مرحلة الإقفال قد يقتل الصيصان الجاهزة. انتظر حتى تجف 90%+ من الصيصان قبل الفتح", "Att öppna maskinen under lockdown kan döda kycklingar som är redo. Vänta tills 90%+ av kycklingarna är torra"), urgency: "critical" },
      { icon: "💧", title: L("أضف ماء دافئاً (37°م) في صواني الرطوبة", "Tillsätt varmt vatten (37°C) i fuktighetsbrickorna"), detail: L("الماء الدافئ لا يصدم الحاضنة. استخدم صواني كبيرة أو إسفنج مبلل. الرطوبة 68-75% تمنع التصاق الجنين", "Varmt vatten chockar inte maskinen. Använd stora brickor eller fuktig svamp"), urgency: "high" },
      { icon: "📊", title: L("استعدّ لاستقبال الصيصان بعد 24-72 ساعة", "Förbered dig för att ta emot kycklingar om 24-72 timmar"), detail: L("جهّز حاضنة الصيصان (الفقّاسة): 35°م أول أسبوع، علف صيصان ناعم، ماء نظيف دافئ، تهوية كافية", "Förbered kycklingsinkubatorn: 35°C vecka 1, finmalet kycklingfoder, rent ljummet vatten, tillräcklig ventilation"), urgency: "medium" },
    );
    summary = L(`حان وقت الإقفال — الـ 3 أيام الأكثر حساسية في التفقيس. الإجراءات الصحيحة الآن ترفع نسبة الفقس 15-25%.`, `Lockdown-dags — de 3 känsligaste dagarna i kläckning. Korrekta åtgärder nu ökar kläckprocenten med 15-25%.`);
    timeframe = L("الآن — بدون تأجيل", "Nu — ingen fördröjning");

  /* ── 6. CHICK HEALTH / BIOLOGICAL (صيصان، أعراض) ── */
  } else if (has("صيصان", "كتاكيت", "طيور", "خمول", "أعراض", "مرض", "kyckling", "fågel", "symptom", "sjuk") || issue.category === "biological") {
    data.flocks.slice(0, 3).forEach(f => relatedFacts.push(L(`${f.name}: ${f.count} طير — ${f.type ?? "دجاج"}`, `${f.name}: ${f.count} fåglar — ${f.type ?? "höns"}`)));
    if (totalBirds === 0) relatedFacts.push(L("لا توجد قطعان مسجلة في النظام", "Inga flockar registrerade i systemet"));

    steps.push(
      { icon: "🔍", title: L("فحص بصري شامل لجميع القطعان الآن", "Fullständig visuell inspektion av alla flockar nu"), detail: L(`راقب في ${data.flocks.length > 0 ? data.flocks.map(f=>f.name).slice(0,3).join(" و") : "القطعان"}: الحركة، الشهية، البراز، الريش، الموضع (الطيور المريضة تنعزل في الزوايا)`, `Observera i ${data.flocks.length > 0 ? data.flocks.map(f=>f.name).slice(0,3).join(", ") : "flockarna"}: rörelse, aptit, avföring, fjädrar, position (sjuka fåglar isolerar sig i hörn)`), urgency: "critical" },
      { icon: "🌡️", title: L("قِس حرارة أي طائر يبدو مريضاً", "Mät temperaturen hos fåglar som verkar sjuka"), detail: L("الطبيعي: 41.0-41.5°م. فوق 42.5°م → حمى شديدة. دون 40°م → صدمة أو إجهاد حراري. قِس 3-5 طيور من مناطق مختلفة", "Normalt: 41,0-41,5°C. Över 42,5°C → hög feber. Under 40°C → chock. Mät 3-5 fåglar från olika delar"), urgency: "critical" },
      { icon: "🚧", title: L("عزل أي طائر مشتبه به فوراً في قفص منفصل", "Isolera misstänkta fåglar omedelbart"), detail: L(`الطائر المريض ينقل العدوى للـ${totalBirds} طير في ساعات. العزل يحمي القطيع. الحجر: علف وماء منفصل، دافئ، هادئ`, `Sjuk fågel sprider infektion till ${totalBirds} fåglar på timmar. Karantän: separat mat och vatten, varmt och lugnt`), urgency: "critical" },
      { icon: "💊", title: L("راجع بروتوكول التحصين — هل كل الجرعات أُعطيت؟", "Granska vaccinationsprotokoll — gavs alla doser?"), detail: L("المطلوب: نيوكاسل (يوم 1+14+28)، جمبورو (يوم 14+21)، كوكسيديا (حسب النوع). الطائر المحصَّن يُقاوم المرض أضعاف المرة", "Nödvändigt: Newcastle (dag 1+14+28), Gumboro (14+21), Koccidios. Vaccinerade fåglar motstår sjukdom mycket bättre"), urgency: "high" },
      { icon: "📞", title: L("إذا استمرت الأعراض 6+ ساعات → اتصل بطبيب بيطري", "Om symptom kvarstår 6+ timmar → kontakta veterinär"), detail: L("صِف بدقة: عدد المتضررين، الأعراض، متى بدأ، ما آخر شيء تغيّر. التشخيص المبكر ينقذ القطيع", "Beskriv exakt: antal drabbade, symptom, när det började, vad som senast ändrades"), urgency: "medium" },
    );
    summary = L(`تدخل صحي عاجل في قطيع بـ${totalBirds} طير. الفحص + العزل + التحصين = 80% من الحل. إذا انتشرت الأعراض → طبيب بيطري.`, `Akut hälsoingripande i flock med ${totalBirds} fåglar. Inspektion + isolering + vaccination = 80% av lösningen.`);
    timeframe = L("1-6 ساعات", "1-6 timmar");

  /* ── 7. TASKS / OPERATIONAL ── */
  } else if (has("مهام", "متأخرة", "تراكم", "مهمة", "uppgifter", "försenade", "anhopning") || issue.category === "operational") {
    if (overdueTasks.length > 0) relatedFacts.push(L(`المتأخرة (${overdueTasks.length}): ${overdueTasks.slice(0,3).map(t2=>t2.title).join("، ")}`, `Försenade (${overdueTasks.length}): ${overdueTasks.slice(0,3).map(t2=>t2.title).join(", ")}`));
    relatedFacts.push(L(`${data.tasks.filter(t2=>t2.completed).length} منجزة / ${data.tasks.length} إجمالاً`, `${data.tasks.filter(t2=>t2.completed).length} klara / ${data.tasks.length} totalt`));

    steps.push(
      { icon: "⚡", title: L("الأولوية: حاضنة > صحة الطيور > علف > نظافة > توثيق", "Prioritet: kläckning > fågelhälsa > foder > städning > dokumentation"), detail: overdueTasks.length > 0 ? L(`ابدأ فوراً بـ: "${overdueTasks[0].title}"${overdueTasks[1] ? ` ثم "${overdueTasks[1].title}"` : ""}`, `Börja med: "${overdueTasks[0].title}"${overdueTasks[1] ? ` sedan "${overdueTasks[1].title}"` : ""}`) : L("كل المهام في وقتها — حافظ على هذا الإيقاع", "Alla uppgifter i tid — behåll denna rytm"), urgency: "critical" },
      { icon: "👥", title: L("وزّع المهام المتراكمة على الفريق بوضوح", "Fördela ackumulerade uppgifter i teamet tydligt"), detail: L(`${pendingTasks.length} مهمة معلقة — من المسؤول عن ماذا؟ التوزيع الواضح يقطع حلقة التأخير`, `${pendingTasks.length} väntande uppgifter — vem ansvarar för vad? Tydlig fördelning bryter fördröjningscykeln`), urgency: "high" },
      { icon: "⏰", title: L("خصّص 15 دقيقة صباحية يومياً لمراجعة المهام", "Avsätt 15 morgonminuter dagligen för uppgiftsgranskning"), detail: L("المراجعة الصباحية تقلل المهام المتأخرة بـ60% وتحسن التنسيق بين الفريق", "Morgongranskning minskar försenade uppgifter med 60% och förbättrar teamkoordinering"), urgency: "medium" },
    );
    summary = L(`${pendingTasks.length} مهمة معلقة (${overdueTasks.length} متأخرة). التنظيم الفوري يمنع تضاعف الضغط ويرفع كفاءة المزرعة.`, `${pendingTasks.length} väntande (${overdueTasks.length} försenade). Omedelbar organisation förhindrar eskalerande press.`);
    timeframe = L("اليوم", "Idag");

  /* ── 8. GOALS ── */
  } else if (has("أهداف", "هدف", "mål") || issue.category === "goals") {
    const activeGoals = data.goals.filter(g => !g.completed);
    activeGoals.slice(0,3).forEach(g => {
      const pct = Math.min(((parseFloat(g.currentValue)||0)/(parseFloat(g.targetValue)||1)*100),100).toFixed(0);
      relatedFacts.push(L(`${g.title}: ${pct}%`, `${g.title}: ${pct}%`));
    });

    steps.push(
      { icon: "📊", title: L("حدّث القيم الحالية لكل هدف نشط الآن", "Uppdatera aktuella värden för varje aktivt mål nu"), detail: L(`${activeGoals.length} هدف نشط — التحديث يُمكّن التحليل الدقيق ويوضح الفجوة الحقيقية`, `${activeGoals.length} aktiva mål — uppdatering möjliggör exakt analys`), urgency: "high" },
      { icon: "🎯", title: L("اختر هدفاً واحداً فقط هذا الأسبوع", "Välj bara ett mål den här veckan"), detail: L("التركيز على هدف واحد يرفع نسبة الإنجاز من 20% إلى 70%+. ما الهدف الأكثر تأثيراً على المزرعة الآن؟", "Fokus på ett mål höjer avslutningsgraden från 20% till 70%+"), urgency: "high" },
      { icon: "📅", title: L("اضبط جلسة أسبوعية ثابتة لمراجعة الأهداف (15 دقيقة)", "Sätt en fast veckolig målgranskning (15 minuter)"), detail: L("الأحد مساءً أو الاثنين صباحاً. المراجعة المنتظمة هي الفرق بين مزرعة تتطور ومزرعة راكدة", "Söndagkväll eller måndag morgon. Regelbunden granskning är skillnaden mellan en framstegsgård och en stillastående"), urgency: "medium" },
    );
    summary = L(`${activeGoals.length} هدف نشط يحتاج متابعة منتظمة. التقدم في الأهداف = نمو حقيقي في المزرعة.`, `${activeGoals.length} aktiva mål behöver regelbunden uppföljning. Målframsteg = verklig gårdsutveckling.`);
    timeframe = L("هذا الأسبوع", "Den här veckan");

  /* ── DEFAULT FALLBACK ── */
  } else {
    if (activeCycles.length > 0) relatedFacts.push(L(`${activeCycles.length} دورة تفقيس نشطة — ${totalEggs} بيضة`, `${activeCycles.length} aktiva kläckningscykler — ${totalEggs} ägg`));
    if (totalBirds > 0) relatedFacts.push(L(`${totalBirds} طير في ${data.flocks.length} قطعان`, `${totalBirds} fåglar i ${data.flocks.length} flockar`));
    if (overdueTasks.length > 0) relatedFacts.push(L(`${overdueTasks.length} مهمة متأخرة`, `${overdueTasks.length} försenade uppgifter`));

    steps.push(
      { icon: "🔍", title: L("افحص الوضع مباشرة وبشكل شخصي", "Inspektera situationen direkt och personligen"), detail: issue.description, urgency: "high" },
      { icon: "📋", title: L("وثّق الحالة في المذكرات بأكبر قدر من التفاصيل", "Dokumentera situationen med så mycket detaljer som möjligt"), detail: L("الوقت + الظروف + ما لاحظته + ما فعلته. التوثيق الدقيق يمنع تكرار المشكلة", "Tidpunkt + omständigheter + vad du observerade + vad du gjorde"), urgency: "high" },
      { icon: "🔄", title: L("تابع التطور كل ساعتين وقرّر استمرار أو تصعيد", "Följ upp var 2:e timme och besluta om fortsättning eller eskalering"), detail: L("إذا تحسّن الوضع → تابع. إذا استمر → اطلب مساعدة خبير. إذا تدهور → تصرف فوراً", "Förbättring → fortsätt. Oförändrat → rådfråga expert. Försämring → agera omedelbart"), urgency: "medium" },
    );
    summary = L(`الفحص المباشر والتوثيق الدقيق هما أولى خطوات حل أي مشكلة في المزرعة.`, `Direkt inspektion och noggrann dokumentation är de första stegen för att lösa alla gårdsproblem.`);
    timeframe = L("اليوم", "Idag");
  }

  return { steps, summary, timeframe, relatedFacts };
}

export function runFullAnalysis(data: RawFarmData, lang: EngineLang = "ar"): FullAnalysis {
  const L = (ar: string, sv: string) => tr(lang, ar, sv);
  const env = analyzeEnvironment(data.hatchingCycles, lang);
  const bio = analyzeBiological(data.flocks, data.hatchingCycles, lang);
  const ops = analyzeOperational(data.tasks, data.goals, data.notes, lang);
  const dq = assessDataQuality(data, lang);

  const allAlerts = [...env.alerts, ...bio.alerts, ...ops.alerts].sort((a, b) => b.severity - a.severity);
  const allAnomalies = [...env.anomalies, ...bio.anomalies];
  const allRecs = [...env.recommendations, ...bio.recommendations, ...ops.recommendations];
  const allPredictions = [...bio.predictions, ...ops.predictions];

  const priorityOrder: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
  allRecs.sort((a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));

  const errors: { title: string; description: string; solution: string }[] = [];

  if (dq.score < 50) {
    errors.push({
      title: L("بيانات غير كافية", "Otillräcklig data"),
      description: L("النظام يحتاج بيانات أكثر ليعمل بدقة عالية.", "Systemet behöver mer data för att fungera med hög noggrannhet."),
      solution: dq.issues.slice(0, 3).join("، ") + ".",
    });
  }

  const completedCycles = data.hatchingCycles.filter(c => c.status === "completed" && c.eggsHatched != null);
  if (completedCycles.length > 0) {
    const avgRate = mean(completedCycles.map(c => c.eggsSet > 0 ? ((c.eggsHatched ?? 0) / c.eggsSet) * 100 : 0));
    if (avgRate < SCIENCE.incubation.hatchRate.acceptable) {
      errors.push({
        title: L("معدل فقس ضعيف", "Svag kläckningsprocent"),
        description: L(`المعدل العام ${avgRate.toFixed(0)}% — أقل من الحد المقبول ${SCIENCE.incubation.hatchRate.acceptable}%.`, `Total kläckningsprocent ${avgRate.toFixed(0)}% — under acceptabel gräns ${SCIENCE.incubation.hatchRate.acceptable}%.`),
        solution: L("راجع: جودة البيض، عمره قبل التحضين، ثبات الحرارة والرطوبة، التقليب، وبروتوكول الإقفال.", "Granska: äggkvalitet, äggålder före inkubation, stabil temperatur och fuktighet, vändning och låsningsprotokoll."),
      });
    }
  }

  const overdueTasks = data.tasks.filter(t => t.dueDate && t.dueDate < today() && !t.completed);
  if (overdueTasks.length > 3) {
    errors.push({
      title: L("تراكم تشغيلي خطير", "Farlig driftsanhopning"),
      description: L(`${overdueTasks.length} مهمة متأخرة — يدل على ضعف في المتابعة أو نقص الموارد.`, `${overdueTasks.length} försenade uppgifter — tyder på svag uppföljning eller resursbrist.`),
      solution: L("صنّف المهام حسب الأولوية، فوّض ما يمكن، وأغلق الأقدم أولاً.", "Prioritera uppgifter, delegera vid möjlighet och slutför de äldsta först."),
    });
  }

  const scoreBreakdown = [
    { category: L("حرارة الحاضنة", "Kläcktemperatur"), score: env.score, weight: 35, label: env.score >= 80 ? L("جيد", "Bra") : env.score >= 60 ? L("مقبول", "Acceptabelt") : L("ضعيف", "Svagt") },
    { category: L("الإنتاج والتفقيس", "Produktion"), score: bio.score, weight: 35, label: bio.score >= 80 ? L("جيد", "Bra") : bio.score >= 60 ? L("مقبول", "Acceptabelt") : L("ضعيف", "Svagt") },
    { category: L("إنجاز المهام", "Uppgifter"), score: ops.score, weight: 20, label: ops.score >= 80 ? L("جيد", "Bra") : ops.score >= 60 ? L("مقبول", "Acceptabelt") : L("ضعيف", "Svagt") },
    { category: L("التوثيق والمتابعة", "Dokumentation"), score: dq.score, weight: 10, label: dq.label },
  ];

  const weightedScore = Math.round(
    scoreBreakdown.reduce((sum, s) => sum + s.score * (s.weight / 100), 0)
  );

  const scoreLabel = weightedScore >= 85 ? L("ممتاز", "Utmärkt") :
    weightedScore >= 70 ? L("جيد جداً", "Mycket bra") :
    weightedScore >= 55 ? L("جيد", "Bra") :
    weightedScore >= 40 ? L("مقبول", "Acceptabelt") : L("حرج", "Kritiskt");

  const sections: Section[] = [
    { icon: "🌡️", title: L("حرارة الحاضنة والبيئة", "Kläcktemperatur & Miljö"), category: "environment", items: env.sectionItems, healthScore: env.score },
    { icon: "🥚", title: L("الإنتاج والتفقيس", "Produktion & Kläckning"), category: "biological", items: bio.sectionItems, healthScore: bio.score },
    { icon: "✅", title: L("إنجاز المهام والأهداف", "Uppgifter & Mål"), category: "operational", items: ops.sectionItems, healthScore: ops.score },
  ];

  let topPriority = L("لا توجد مشاكل عاجلة حالياً — حافظ على نفس الأداء.", "Inga akuta problem just nu — håll samma prestanda.");
  if (allRecs.length > 0) {
    topPriority = allRecs[0].title;
    if (allRecs.length > 1) topPriority += L(` → ثم: ${allRecs[1].title}`, ` → Sedan: ${allRecs[1].title}`);
  }

  const summaryParts: string[] = [];
  if (allAlerts.filter(a => a.type === "danger").length > 0)
    summaryParts.push(L(`🔴 ${allAlerts.filter(a => a.type === "danger").length} تنبيه خطير`, `🔴 ${allAlerts.filter(a => a.type === "danger").length} kritisk varning`));
  if (allAnomalies.length > 0)
    summaryParts.push(L(`🔍 ${allAnomalies.length} شذوذ مكتشف`, `🔍 ${allAnomalies.length} avvikelse upptäckt`));
  summaryParts.push(L(`📊 النتيجة: ${weightedScore}/100 (${scoreLabel})`, `📊 Resultat: ${weightedScore}/100 (${scoreLabel})`));
  if (allPredictions.length > 0)
    summaryParts.push(L(`🔮 ${allPredictions.length} توقع`, `🔮 ${allPredictions.length} prognos`));

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
    futureRisk: futureRiskAnalysis(data, lang),
    aiCapabilities: buildAiCapabilities(data),
    summary: summaryParts.join(" | "),
    timestamp: new Date().toISOString(),
    dataQuality: dq,
    liveInsights: buildLiveInsights(data, lang),
  };
}

function buildNarrativeReply(analysis: FullAnalysis, lang: EngineLang): string {
  const lines = [
    tr(lang, `النتيجة العامة: ${analysis.score}/100 — ${analysis.scoreLabel}`, `Totalpoäng: ${analysis.score}/100 — ${analysis.scoreLabel}`),
    "",
    tr(lang, `أهم إجراء الآن: ${analysis.topPriority}`, `Huvudåtgärd nu: ${analysis.topPriority}`),
    "",
    tr(lang, "أقوى المخاطر الحالية:", "Starkaste aktuella risker:"),
    ...analysis.alerts.slice(0, 3).map(a => `- ${a.title}: ${a.description}`),
    "",
    tr(lang, "أدق التوصيات:", "Tydligaste rekommendationer:"),
    ...analysis.recommendations.slice(0, 4).map(r => `- ${r.title}: ${r.reason} | ${r.impact}`),
    "",
    tr(lang, "إذا تريد، أقدر أكمل كحوار خطوة بخطوة حتى أوصل معك لقرار عملي.", "Om du vill kan jag fortsätta som en steg-för-steg-dialog tills vi landar i en praktisk plan."),
  ];
  return lines.filter(Boolean).join("\n");
}

export interface DailyPlanSlot {
  time: string;
  icon: string;
  title: string;
  description: string;
  priority: "critical" | "high" | "normal";
  source: "system" | "task" | "cycle" | "note";
}

export interface DailyPlanResult {
  date: string;
  greeting: string;
  slots: DailyPlanSlot[];
  riskLevel: "critical" | "high" | "medium" | "low";
  riskSummary: string;
  tip: string;
}

export function buildDailyPlan(data: RawFarmData, lang: EngineLang = "ar"): DailyPlanResult {
  const t = today();
  const slots: DailyPlanSlot[] = [];
  const L = (ar: string, sv: string) => tr(lang, ar, sv);

  const activeCycles = data.hatchingCycles.filter(c => c.status === "incubating" || c.status === "hatching");
  const overdueTasks = data.tasks.filter(tk => tk.dueDate && tk.dueDate <= t && !tk.completed);
  const todayTasks = data.tasks.filter(tk => tk.dueDate === t && !tk.completed);
  const pendingTasks = data.tasks.filter(tk => !tk.completed);
  const totalBirds = data.flocks.reduce((s, f) => s + (f.count ?? 0), 0);

  slots.push({
    time: "05:30",
    icon: "🌅",
    title: L("جولة الصباح الأولى", "Morgonrunda"),
    description: totalBirds > 0
      ? L(
          `تفقّد ${totalBirds} طير: سلوك، حركة، أصوات غير طبيعية. افحص أي نفوق ليلي وسجّله فوراً.`,
          `Inspektera ${totalBirds} fåglar: beteende, rörelse, ovanliga ljud. Kontrollera nattlig dödlighet och registrera direkt.`,
        )
      : L("تفقّد العنابر: سلوك الطيور، نفوق ليلي، أي أعراض غير طبيعية.", "Inspektera stallar: fåglarnas beteende, nattlig dödlighet, ovanliga symptom."),
    priority: "critical",
    source: "system",
  });

  slots.push({
    time: "06:00",
    icon: "🌡️",
    title: L("فحص الحرارة والرطوبة", "Temperatur- och fuktkontroll"),
    description: activeCycles.length > 0
      ? L(
          `لديك ${activeCycles.length} فقاسة نشطة — تأكد من الحرارة (37.5-37.8°م) والرطوبة (55-60%). ${activeCycles.map(c => {
            const daysLeft = daysBetween(t, c.expectedHatchDate);
            return `"${c.batchName}": ${daysLeft > 0 ? `متبقي ${daysLeft} يوم` : "موعد الفقس اليوم!"}`;
          }).join(" | ")}`,
          `Du har ${activeCycles.length} aktiv(a) kläckmaskin(er) — kontrollera temp (37,5-37,8°C) och fukt (55-60%). ${activeCycles.map(c => {
            const daysLeft = daysBetween(t, c.expectedHatchDate);
            return `"${c.batchName}": ${daysLeft > 0 ? `${daysLeft} dagar kvar` : "Kläckning idag!"}`;
          }).join(" | ")}`,
        )
      : L("افحص حرارة العنابر والتأكد من التهوية. سجّل القراءات.", "Kontrollera stalltemperaturen och ventilationen. Registrera avläsningarna."),
    priority: activeCycles.length > 0 ? "critical" : "normal",
    source: "cycle",
  });

  slots.push({
    time: "06:30",
    icon: "🥣",
    title: L("تقديم العلف الصباحي", "Morgonmatning"),
    description: totalBirds > 0
      ? L(
          `وزّع العلف على ${data.flocks.length} قطيع. تأكد من توزيع متساوي ونظافة المعالف.`,
          `Fördela foder till ${data.flocks.length} flock(ar). Se till att fördelningen är jämn och matarna är rena.`,
        )
      : L("جهّز العلف ووزّعه بالتساوي. نظّف المعالف قبل التعبئة.", "Förbered och fördela fodret jämnt. Rengör matarna före påfyllning."),
    priority: "high",
    source: "system",
  });

  slots.push({
    time: "07:00",
    icon: "💧",
    title: L("فحص الماء والمساقي", "Vatten- och drickarkontroll"),
    description: L(
      "تأكد من تدفق الماء في كل المساقي. نظّف أي مساقي متسخة. راقب استهلاك الماء — انخفاضه إشارة مرضية.",
      "Kontrollera vattenflödet i alla drickare. Rengör smutsiga drickare. Övervaka vattenförbrukningen — minskning är ett sjukdomstecken.",
    ),
    priority: "high",
    source: "system",
  });

  if (overdueTasks.length > 0) {
    const top3 = overdueTasks.slice(0, 3);
    slots.push({
      time: "07:30",
      icon: "⚠️",
      title: L(`${overdueTasks.length} مهمة متأخرة — أنجزها اليوم`, `${overdueTasks.length} försenade uppgifter — klara dem idag`),
      description: top3.map(tk => `• ${tk.title}`).join("\n"),
      priority: "critical",
      source: "task",
    });
  }

  if (todayTasks.length > 0) {
    slots.push({
      time: "08:00",
      icon: "📋",
      title: L(`مهام اليوم (${todayTasks.length})`, `Dagens uppgifter (${todayTasks.length})`),
      description: todayTasks.slice(0, 5).map(tk => `• ${tk.title}`).join("\n"),
      priority: "high",
      source: "task",
    });
  }

  const needsVaccine = pendingTasks.filter(tk =>
    /تحصين|تطعيم|لقاح|vaccine/i.test(tk.title)
  );
  if (needsVaccine.length > 0) {
    slots.push({
      time: "08:30",
      icon: "💉",
      title: L("تحصينات مطلوبة", "Vaccinationer krävs"),
      description: needsVaccine.map(tk => `• ${tk.title}`).join("\n"),
      priority: "critical",
      source: "task",
    });
  }

  const cyclesNearHatch = activeCycles.filter(c => {
    const daysLeft = daysBetween(t, c.expectedHatchDate);
    return daysLeft >= 0 && daysLeft <= 3;
  });
  if (cyclesNearHatch.length > 0) {
    slots.push({
      time: "09:00",
      icon: "🐣",
      title: L("دورات قريبة من الفقس!", "Kläckning nära!"),
      description: cyclesNearHatch.map(c => {
        const daysLeft = daysBetween(t, c.expectedHatchDate);
        return `• "${c.batchName}" (${c.eggsSet} ${L("بيضة", "ägg")}) — ${daysLeft === 0 ? L("الفقس اليوم!", "Kläckning idag!") : L(`متبقي ${daysLeft} يوم`, `${daysLeft} dagar kvar`)}`;
      }).join("\n"),
      priority: "critical",
      source: "cycle",
    });
  }

  slots.push({
    time: "10:00",
    icon: "🧹",
    title: L("تنظيف العنابر", "Stallstädning"),
    description: L(
      "أزل الفرشة المبللة. نظّف حول المعالف والمساقي. تأكد من جفاف الأرضية.",
      "Ta bort blöt strö. Rengör runt matare och drickare. Se till att golvet är torrt.",
    ),
    priority: "normal",
    source: "system",
  });

  if (activeCycles.length > 0) {
    slots.push({
      time: "11:00",
      icon: "🔄",
      title: L("فحص التقليب والفقاسات", "Kontrollera vändning och kläckmaskin"),
      description: L(
        "تأكد من عمل التقليب التلقائي. افحص مستوى الماء في صواني الرطوبة. سجّل القراءات.",
        "Kontrollera att automatisk vändning fungerar. Kontrollera vattennivån i fuktighetsbrickorna. Registrera avläsningarna.",
      ),
      priority: "high",
      source: "cycle",
    });
  }

  slots.push({
    time: "12:00",
    icon: "🥣",
    title: L("العلف الظهري", "Lunchmatning"),
    description: L(
      "قدّم الوجبة الثانية. راقب شهية الطيور — ضعف الأكل إشارة مبكرة للمرض.",
      "Ge den andra måltiden. Övervaka fåglarnas aptit — dålig aptit är ett tidigt sjukdomstecken.",
    ),
    priority: "high",
    source: "system",
  });

  slots.push({
    time: "14:00",
    icon: "🔍",
    title: L("جولة فحص منتصف اليوم", "Middagsrunda"),
    description: L(
      "تفقّد صحة الطيور: أعراض تنفسية، إسهال، خمول. افحص التهوية خصوصاً في الحر.",
      "Kontrollera fåglarnas hälsa: andningssymptom, diarré, slöhet. Kontrollera ventilationen, särskilt vid värme.",
    ),
    priority: "high",
    source: "system",
  });

  slots.push({
    time: "16:00",
    icon: "⚙️",
    title: L("صيانة المعدات", "Utrustningsunderhåll"),
    description: L(
      "افحص المراوح، المدفئات، نظام الإضاءة. تأكد من عمل كل شيء قبل الليل.",
      "Kontrollera fläktar, värmare och belysningssystem. Se till att allt fungerar innan natten.",
    ),
    priority: "normal",
    source: "system",
  });

  slots.push({
    time: "17:00",
    icon: "🥣",
    title: L("العلف المسائي", "Kvällsmatning"),
    description: L(
      "الوجبة الأخيرة في اليوم. تأكد من كفاية العلف للّيل.",
      "Dagens sista måltid. Se till att det finns tillräckligt med foder för natten.",
    ),
    priority: "high",
    source: "system",
  });

  if (activeCycles.length > 0) {
    slots.push({
      time: "18:00",
      icon: "🌡️",
      title: L("فحص الفقاسات المسائي", "Kvällskontroll av kläckmaskiner"),
      description: L(
        "قراءة الحرارة والرطوبة. مقارنة مع قراءات الصباح. تسجيل أي فرق.",
        "Avläs temperatur och fuktighet. Jämför med morgonens avläsningar. Registrera eventuella skillnader.",
      ),
      priority: "critical",
      source: "cycle",
    });
  }

  slots.push({
    time: "19:00",
    icon: "📝",
    title: L("تسجيل الملاحظات اليومية", "Dagliga anteckningar"),
    description: L(
      "سجّل كل ما لاحظته اليوم: نفوق، أعراض، استهلاك علف وماء، سلوك غير طبيعي.",
      "Registrera allt du observerat idag: dödlighet, symptom, foder- och vattenförbrukning, ovanligt beteende.",
    ),
    priority: "high",
    source: "system",
  });

  slots.push({
    time: "20:00",
    icon: "🔒",
    title: L("إغلاق العنابر", "Stäng stallar"),
    description: L(
      "تأكد من إغلاق الأبواب والنوافذ. اضبط التدفئة/التبريد الليلي. فحص أخير للماء.",
      "Se till att dörrar och fönster är stängda. Ställ in nattuppvärmning/kylning. Sista vattenkontroll.",
    ),
    priority: "normal",
    source: "system",
  });

  const risk = futureRiskAnalysis(data);
  const riskLevel = risk?.level ?? "low";

  const recentNotes = data.notes.slice(0, 5);
  const diseaseKeywordsFound = recentNotes.some(n =>
    KEYWORDS_DISEASE.some(k => n.content.toLowerCase().includes(k))
  );

  const tipsAr = [
    "الملاحظة اليومية الدقيقة هي أقوى أداة وقائية — لا تهملها.",
    "التحصينات في وقتها أهم من العلاج بعد المرض.",
    "الحرارة المستقرة أهم من الحرارة المثالية — التقلبات هي العدو.",
    "استهلاك الماء أهم مؤشر مبكر للمرض — راقبه يومياً.",
    "النظافة 80% من الوقاية — نظّف قبل أن تعالج.",
    "سجّل كل شيء — الذاكرة تخون لكن السجل لا يكذب.",
  ];
  const tipsSv = [
    "Noggranna dagliga observationer är det starkaste förebyggande verktyget — försumma det inte.",
    "Vaccination i tid är viktigare än behandling efter sjukdom.",
    "Stabil temperatur är viktigare än idealisk temperatur — variationer är fienden.",
    "Vattenförbrukning är den viktigaste tidiga sjukdomsindikator — övervaka den dagligen.",
    "Renlighet är 80% av förebyggande — rengör innan du behandlar.",
    "Registrera allt — minnet sviker men journalen ljuger inte.",
  ];
  if (diseaseKeywordsFound) {
    tipsAr.unshift("تنبيه: ملاحظاتك الأخيرة تحتوي إشارات مرضية — ركّز على العزل والمراقبة اليوم.");
    tipsSv.unshift("Varning: Dina senaste anteckningar innehåller sjukdomstecken — fokusera på isolering och övervakning idag.");
  }
  const tipIdx = Math.floor(Math.random() * Math.min(tipsAr.length, 3));
  const tip = lang === "sv" ? tipsSv[tipIdx] : tipsAr[tipIdx];

  const hour = new Date().getHours();
  const greeting = lang === "sv"
    ? (hour < 12 ? "God morgon" : hour < 17 ? "God dag" : "God kväll")
    : (hour < 12 ? "صباح الخير" : hour < 17 ? "مرحباً" : "مساء الخير");

  const riskSummaryAr = risk?.summary ?? "لا توجد مخاطر كبيرة حالياً.";
  const riskSummary = lang === "sv"
    ? (riskLevel === "low"
        ? "Inga stora risker för tillfället, men fortsätt med daglig övervakning."
        : riskLevel === "medium"
        ? "Inga kritiska tecken för tillfället, men fortsatt daglig övervakning krävs."
        : "Aktuell data tyder på risk för nedgång om ingen snabb åtgärd vidtas.")
    : riskSummaryAr;

  return {
    date: t,
    greeting: L(`${greeting} — هذه خطتك لليوم`, `${greeting} — Din plan för dagen`),
    slots,
    riskLevel,
    riskSummary,
    tip,
  };
}

export function buildExpertChatReply(message: string, data: RawFarmData): string {
  const lang = detectLang(message);
  const analysis = runFullAnalysis(data, lang);
  const lower = message.toLowerCase();
  const wantsRisk = /خطر|مخاطر|مستقبل|تحذير|توقع|what will|predict|future/i.test(message);
  const wantsDetail = /اشرح|فصل|عمق|تفصيل|why|how|لماذا|كيف|حلل/i.test(message);
  const wantsCompare = /قارن|مقارنة|أفضل|أسوأ|فرق|compare/i.test(message);
  const wantsDialogue = /ناقش|رأي|ماذا لو|تتوقع|هل تعتقد|لو سمحت|discuss|opinion/i.test(message);

  if (wantsRisk) {
    const risk = analysis.futureRisk;
    return [
      tr(lang, `**${risk.title}** — أفق الخطر: ${risk.horizon}`, `**${risk.title}** — horisont: ${risk.horizon}`),
      risk.summary,
      "",
      tr(lang, `**المحفزات:** ${risk.triggers.length ? risk.triggers.join("، ") : "لا توجد محفزات قوية حالياً"}`, `**Utlösare:** ${risk.triggers.length ? risk.triggers.join("، ") : "Inga starka utlösare just nu"}`),
      "",
      tr(lang, "**الإجراءات العملية:**", "**Praktiska åtgärder:**"),
      ...risk.actions.map(a => `- ${a}`),
      "",
      tr(lang, `**أقوى توصية الآن:** ${analysis.topPriority}`, `**Bästa åtgärd nu:** ${analysis.topPriority}`),
    ].join("\n");
  }

  if (wantsCompare) {
    const best = analysis.scoreBreakdown.slice().sort((a, b) => b.score - a.score)[0];
    const weakest = analysis.scoreBreakdown.slice().sort((a, b) => a.score - b.score)[0];
    return [
      tr(lang, "هذه مقارنة سريعة:", "Här är en snabb jämförelse:"),
      tr(lang, `الأفضل: ${best.category} (${best.score}/100)`, `Starkast: ${best.category} (${best.score}/100)`),
      tr(lang, `الأضعف: ${weakest.category} (${weakest.score}/100)`, `Svagast: ${weakest.category} (${weakest.score}/100)`),
      tr(lang, `الفرق العملي: ركّز على ${weakest.category} أولاً لأنه الأكثر تأثيراً على النتيجة النهائية.`, `Praktisk skillnad: fokusera först på ${weakest.category} eftersom det påverkar slutresultatet mest.`),
    ].join("\n");
  }

  if (wantsDetail || wantsDialogue || lower.includes("تحليل") || lower.includes("المزرعة") || lower.includes("تقرير") || lower.includes("حالة")) {
    return buildNarrativeReply(analysis, lang);
  }

  if (lower.includes("حرارة") || lower.includes("رطوبة") || lower.includes("بيئة") || lower.includes("فقاسة")) {
    const env = analysis.sections.find(s => s.category === "environment");
    return buildNarrativeReply(analysis, lang) + "\n\n" + tr(lang, "اسألني عن كل فقاسة وسأعطيك تشخيصاً مفصلاً.", "Fråga om varje maskin så ger jag en detaljerad diagnos.");
  }

  if (wantsDialogue) {
    return [
      tr(lang, "نعم، وخلينا نمشيها كنقاش عملي:", "Ja, låt oss köra det som en praktisk dialog:"),
      tr(lang, "1) ما الهدف الآن؟ تحسين الفقس، تقليل النفوق، أم رفع الإنتاج؟", "1) Vad är målet nu? Bättre kläckning, lägre dödlighet eller högre produktion?"),
      tr(lang, "2) أين المشكلة الأوضح عندك؟ الحرارة، الرطوبة، الصحة، أو إدارة المهام؟", "2) Vad är tydligaste problemet? Temperatur, fukt, hälsa eller uppgifter?"),
      tr(lang, "3) أعطني سؤالاً محدداً جداً وسأبني عليه خطة تنفيذ.", "3) Ge mig en väldigt specifik fråga så bygger jag en handlingsplan."),
    ].join("\n");
  }

  return buildNarrativeReply(analysis, lang);
}
