import { useMemo, useEffect, useState } from "react";
import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { WeatherWidget } from "@/components/WeatherWidget";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import {
  Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2,
  AlertCircle, Info, Target, Bird, Egg, CheckSquare, Zap, ShieldAlert,
  ShieldCheck, Shield, ArrowUp, ArrowDown, Activity, Lightbulb,
  BarChart3, DollarSign, Percent, ArrowLeft, ArrowRight, Clock,
  Calendar, ChevronRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  id: number;
  date: string;
  type: "income" | "expense";
  category: string;
  description: string;
  amount: string;
  authorId: number;
  authorName: string;
}

interface MonthlyRow {
  type: string;
  category: string;
  month: string;
  total: string;
  count: string;
}

interface MonthSummary {
  month: string;       // "YYYY-MM"
  income: number;
  expense: number;
  profit: number;
}

interface Insight {
  level: "critical" | "warning" | "good" | "info";
  titleAr: string;
  titleSv: string;
  msgAr: string;
  msgSv: string;
  recAr?: string;
  recSv?: string;
}

interface Decision {
  rank: number;
  category: "financial" | "production" | "operations";
  actionAr: string;
  actionSv: string;
  reasonAr: string;
  reasonSv: string;
  impactAr: string;
  impactSv: string;
}

interface Prediction {
  nextMonthProfit: number;
  trend: "up" | "down" | "stable";
  riskLevel: "low" | "medium" | "high";
  confidence: number; // 0-100
}

interface FarmIntelligence {
  score: number;
  grade: "excellent" | "good" | "fair" | "poor";
  financialScore: number;
  productionScore: number;
  operationsScore: number;
  goalsScore: number;
  // KPI
  income: number;
  expense: number;
  profit: number;
  margin: number | null;
  efficiency: number | null;  // expense / income * 100
  // derived
  insights: Insight[];
  decisions: Decision[];
  prediction: Prediction;
  monthlyTrend: MonthSummary[];
  topExpenseCategory: string | null;
  topExpensePct: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function linReg(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0 };
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function buildMonthlyTrend(rows: MonthlyRow[]): MonthSummary[] {
  const map: Record<string, MonthSummary> = {};
  for (const r of rows) {
    if (!map[r.month]) map[r.month] = { month: r.month, income: 0, expense: 0, profit: 0 };
    const v = parseFloat(r.total) || 0;
    if (r.type === "income") map[r.month].income += v;
    else map[r.month].expense += v;
  }
  return Object.values(map)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(m => ({ ...m, profit: m.income - m.expense }));
}

function computePrediction(trend: MonthSummary[]): Prediction {
  if (trend.length === 0) {
    return { nextMonthProfit: 0, trend: "stable", riskLevel: "medium", confidence: 30 };
  }
  const last = trend[trend.length - 1];
  if (trend.length === 1) {
    const riskLevel = last.profit < 0 ? "high" : last.profit < last.income * 0.1 ? "medium" : "low";
    return { nextMonthProfit: Math.round(last.profit * 1.03), trend: "stable", riskLevel, confidence: 40 };
  }
  // Linear regression
  const profits = trend.map(m => m.profit);
  const xs = profits.map((_, i) => i);
  const { slope, intercept } = linReg(xs, profits);
  const nextProfit = Math.round(slope * profits.length + intercept);
  const trendDir: "up" | "down" | "stable" =
    slope > 500 ? "up" : slope < -500 ? "down" : "stable";

  // Risk: based on trend direction + current margin
  const marginRate = last.income > 0 ? last.profit / last.income : -1;
  let riskLevel: "low" | "medium" | "high" =
    trendDir === "up" && marginRate > 0.1 ? "low"
    : trendDir === "down" || marginRate < 0 ? "high"
    : "medium";

  const confidence = Math.min(85, 40 + trend.length * 8);
  return { nextMonthProfit: nextProfit, trend: trendDir, riskLevel, confidence };
}

function computeIntelligence(
  summary: {
    totalChickens: number; totalFlocks: number;
    overallHatchRate: number; activeHatchingCycles: number;
    tasksDueToday: number; tasksCompletedToday: number;
    goalsCompleted: number; totalGoals: number;
  },
  transactions: Transaction[],
  monthlyRows: MonthlyRow[],
): FarmIntelligence {
  // ── Financial ──────────────────────────────────────────────────────────────
  const income = transactions.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
  const expense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);
  const profit = income - expense;
  const margin = income > 0 ? (profit / income) * 100 : null;
  const efficiency = income > 0 ? (expense / income) * 100 : null;

  // Top expense category
  const catTotals: Record<string, number> = {};
  transactions.filter(t => t.type === "expense").forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + parseFloat(t.amount);
  });
  const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const topExpenseCategory = sortedCats[0]?.[0] ?? null;
  const topExpensePct = expense > 0 && topExpenseCategory
    ? Math.round((sortedCats[0][1] / expense) * 100) : 0;

  // Financial Score
  let financialScore = 50;
  if (income === 0 && expense === 0) financialScore = 50;
  else if (margin !== null) {
    if (margin >= 30) financialScore = 100;
    else if (margin >= 20) financialScore = 88;
    else if (margin >= 10) financialScore = 72;
    else if (margin >= 3) financialScore = 55;
    else if (margin >= 0) financialScore = 42;
    else if (margin >= -20) financialScore = 25;
    else financialScore = 10;
  }

  // ── Production ─────────────────────────────────────────────────────────────
  const hatchRate = summary.overallHatchRate;
  let productionScore = 55;
  if (hatchRate === 0 && summary.activeHatchingCycles === 0) productionScore = 55;
  else if (hatchRate >= 88) productionScore = 100;
  else if (hatchRate >= 78) productionScore = 82;
  else if (hatchRate >= 65) productionScore = 65;
  else if (hatchRate >= 50) productionScore = 45;
  else if (hatchRate > 0) productionScore = 28;
  if (summary.totalChickens > 500) productionScore = Math.min(100, productionScore + 8);
  if (summary.activeHatchingCycles > 0) productionScore = Math.min(100, productionScore + 5);

  // ── Operations ─────────────────────────────────────────────────────────────
  let operationsScore = 65;
  if (summary.tasksDueToday > 0) {
    const rate = (summary.tasksCompletedToday / summary.tasksDueToday) * 100;
    if (rate >= 95) operationsScore = 100;
    else if (rate >= 75) operationsScore = 80;
    else if (rate >= 50) operationsScore = 60;
    else operationsScore = 35;
  }

  // ── Goals ──────────────────────────────────────────────────────────────────
  let goalsScore = 50;
  if (summary.totalGoals > 0) {
    const goalPct = (summary.goalsCompleted / summary.totalGoals) * 100;
    if (goalPct >= 80) goalsScore = 100;
    else if (goalPct >= 60) goalsScore = 75;
    else if (goalPct >= 40) goalsScore = 55;
    else goalsScore = 32;
  }

  // ── Overall Score ──────────────────────────────────────────────────────────
  const score = Math.round(
    financialScore * 0.40 +
    productionScore * 0.30 +
    operationsScore * 0.20 +
    goalsScore * 0.10
  );
  const grade: "excellent" | "good" | "fair" | "poor" =
    score >= 80 ? "excellent" : score >= 65 ? "good" : score >= 45 ? "fair" : "poor";

  // ── Insights ───────────────────────────────────────────────────────────────
  const insights: Insight[] = [];

  // Financial insight
  if (income === 0 && expense === 0) {
    insights.push({
      level: "info",
      titleAr: "لا توجد بيانات مالية بعد", titleSv: "Ingen finansiell data ännu",
      msgAr: "أضف معاملاتك المالية لتفعيل التحليل الذكي الكامل.",
      msgSv: "Lägg till finansiella transaktioner för att aktivera fullständig analys.",
    });
  } else if (profit < 0) {
    const lossPct = income > 0 ? Math.abs(Math.round((profit / income) * 100)) : 100;
    insights.push({
      level: "critical",
      titleAr: "أنت تعمل بخسارة", titleSv: "Du arbetar med förlust",
      msgAr: `المصاريف تتجاوز الدخل بنسبة ${lossPct}%. مشكلة عاجلة تحتاج معالجة.`,
      msgSv: `Utgifterna överstiger inkomsten med ${lossPct}%. Akut problem som kräver åtgärd.`,
      recAr: "خفّض المصاريف فوراً أو ابحث عن مصادر دخل إضافية.",
      recSv: "Minska kostnaderna omedelbart eller hitta ytterligare inkomstkällor.",
    });
  } else if (margin !== null && margin < 10) {
    insights.push({
      level: "warning",
      titleAr: "هامش الربح منخفض جداً", titleSv: "Vinstmarginalen är mycket låg",
      msgAr: `هامش ربحك حالياً ${Math.round(margin)}% فقط. المستوى المثالي هو 20% أو أكثر.`,
      msgSv: `Din vinstmarginal är för närvarande bara ${Math.round(margin)}%. Optimalt mål är 20% eller mer.`,
      recAr: "ابحث عن تقليل التكاليف الثابتة بنسبة 15%.",
      recSv: "Sök att minska fasta kostnader med 15%.",
    });
  } else if (margin !== null && margin >= 20) {
    insights.push({
      level: "good",
      titleAr: "أداء مالي ممتاز", titleSv: "Utmärkt finansiell prestanda",
      msgAr: `هامش ربحك ${Math.round(margin)}% — أعلى من المعدل الصناعي (15%). استمر هكذا.`,
      msgSv: `Din vinstmarginal är ${Math.round(margin)}% — över branschgenomsnittet (15%). Fortsätt så.`,
    });
  }

  // Top expense insight
  if (topExpenseCategory && expense > 0) {
    const catNames: Record<string, { ar: string; sv: string }> = {
      feed: { ar: "العلف", sv: "foderkostnader" },
      medicine: { ar: "الأدوية", sv: "medicinering" },
      equipment: { ar: "المعدات", sv: "utrustning" },
      labor: { ar: "العمالة", sv: "arbetskraft" },
      electricity: { ar: "الكهرباء", sv: "el & energi" },
      maintenance: { ar: "الصيانة", sv: "underhåll" },
      other: { ar: "أخرى", sv: "övrigt" },
    };
    const catName = catNames[topExpenseCategory] ?? { ar: topExpenseCategory, sv: topExpenseCategory };
    if (topExpensePct > 55) {
      insights.push({
        level: "warning",
        titleAr: `تكلفة ${catName.ar} مرتفعة`, titleSv: `Höga ${catName.sv}kostnader`,
        msgAr: `${catName.ar} يمثل ${topExpensePct}% من إجمالي مصاريفك — نسبة مرتفعة جداً.`,
        msgSv: `${catName.sv} utgör ${topExpensePct}% av dina totala utgifter — mycket hög andel.`,
        recAr: `ابحث عن موردين بديلين أو قلل الاستهلاك من ${catName.ar}.`,
        recSv: `Sök alternativa leverantörer eller minska förbrukningen av ${catName.sv}.`,
      });
    } else {
      insights.push({
        level: "info",
        titleAr: `أكبر بند مصاريف: ${catName.ar}`, titleSv: `Största utgiftspost: ${catName.sv}`,
        msgAr: `${catName.ar} يمثل ${topExpensePct}% من إجمالي المصاريف. نسبة طبيعية.`,
        msgSv: `${catName.sv} utgör ${topExpensePct}% av totala utgifter. Normal andel.`,
      });
    }
  }

  // Production insight
  if (summary.overallHatchRate > 0 || summary.activeHatchingCycles > 0) {
    if (hatchRate >= 82) {
      insights.push({
        level: "good",
        titleAr: "معدل تفقيس ممتاز", titleSv: "Utmärkt kläckningsfrekvens",
        msgAr: `معدل التفقيس ${Math.round(hatchRate)}% — أعلى من المعيار القياسي (80%).`,
        msgSv: `Kläckningsfrekvensen ${Math.round(hatchRate)}% — över branschstandard (80%).`,
      });
    } else if (hatchRate > 0 && hatchRate < 70) {
      insights.push({
        level: "warning",
        titleAr: "معدل تفقيس منخفض", titleSv: "Låg kläckningsfrekvens",
        msgAr: `معدل التفقيس ${Math.round(hatchRate)}% — أقل من المستوى المثالي (80%). تحقق من الحرارة والرطوبة.`,
        msgSv: `Kläckningsfrekvensen ${Math.round(hatchRate)}% — under optimal nivå (80%). Kontrollera temperatur och luftfuktighet.`,
        recAr: "تأكد من ثبات درجة الحرارة بين 37.5°–38° وتقليب البيض بانتظام.",
        recSv: "Säkerställ stabil temperatur 37.5°–38° och regelbunden äggvändning.",
      });
    }
  }

  // Operations insight
  if (summary.tasksDueToday > 0) {
    const rate = Math.round((summary.tasksCompletedToday / summary.tasksDueToday) * 100);
    if (rate < 50) {
      insights.push({
        level: "warning",
        titleAr: "مهام اليوم متأخرة", titleSv: "Dagens uppgifter försenade",
        msgAr: `أُنجز ${rate}% فقط من مهام اليوم (${summary.tasksCompletedToday} من ${summary.tasksDueToday}).`,
        msgSv: `Bara ${rate}% av dagens uppgifter slutförda (${summary.tasksCompletedToday} av ${summary.tasksDueToday}).`,
        recAr: "أنجز المهام المتبقية في أقرب وقت لتحسين درجة الأداء.",
        recSv: "Slutför återstående uppgifter så snart som möjligt för att förbättra prestanda.",
      });
    } else if (rate === 100) {
      insights.push({
        level: "good",
        titleAr: "كل مهام اليوم منجزة", titleSv: "Alla dagens uppgifter slutförda",
        msgAr: `أتممت ${summary.tasksCompletedToday} من ${summary.tasksDueToday} مهمة اليوم. أداء ممتاز!`,
        msgSv: `Du avslutade ${summary.tasksCompletedToday} av ${summary.tasksDueToday} uppgifter idag. Utmärkt prestanda!`,
      });
    }
  }

  // ── Decisions ─────────────────────────────────────────────────────────────
  const decisions: Decision[] = [];
  const areas = [
    { cat: "financial" as const, score: financialScore },
    { cat: "production" as const, score: productionScore },
    { cat: "operations" as const, score: operationsScore },
    { cat: "goals" as const, score: goalsScore },
  ].sort((a, b) => a.score - b.score);

  for (const area of areas.slice(0, 3)) {
    if (area.cat === "financial") {
      if (profit < 0) {
        decisions.push({
          rank: decisions.length + 1, category: "financial",
          actionAr: "تقليل المصاريف التشغيلية فوراً",
          actionSv: "Minska driftskostnaderna omedelbart",
          reasonAr: `مصاريفك تتجاوز دخلك بمقدار ${Math.abs(profit).toLocaleString()} د.ع`,
          reasonSv: `Dina utgifter överstiger inkomsten med ${Math.abs(profit).toLocaleString()} IQD`,
          impactAr: "يُوقف النزيف المالي ويستعيد الربحية خلال 30 يوماً",
          impactSv: "Stoppar finansiellt blödande och återställer lönsamhet inom 30 dagar",
        });
      } else if (topExpenseCategory === "feed" && topExpensePct > 50) {
        decisions.push({
          rank: decisions.length + 1, category: "financial",
          actionAr: "التفاوض مع موردي العلف للحصول على أسعار أفضل",
          actionSv: "Förhandla med foderlevererntörer för bättre priser",
          reasonAr: `العلف يمثل ${topExpensePct}% من تكاليفك — أعلى من المثالي`,
          reasonSv: `Foder utgör ${topExpensePct}% av dina kostnader — över optimalt`,
          impactAr: "تخفيض 10% في تكلفة العلف يزيد هامش الربح بشكل كبير",
          impactSv: "10% minskning i foderkostnad ökar vinstmarginalen avsevärt",
        });
      } else {
        decisions.push({
          rank: decisions.length + 1, category: "financial",
          actionAr: "زيادة مصادر الدخل (بيع كتاكيت، بيض)",
          actionSv: "Öka inkomstkällor (kycklingsförsäljning, ägg)",
          reasonAr: "تنويع الدخل يحسن الاستقرار المالي للمزرعة",
          reasonSv: "Diversifiering av inkomst förbättrar gårdens finansiella stabilitet",
          impactAr: "دخل إضافي يُحسّن هامش الربح ويقلل المخاطر",
          impactSv: "Ytterligare inkomst förbättrar vinstmarginalen och minskar risker",
        });
      }
    } else if (area.cat === "production") {
      if (hatchRate < 75 && hatchRate > 0) {
        decisions.push({
          rank: decisions.length + 1, category: "production",
          actionAr: "مراجعة إعدادات الفقاسة (حرارة، رطوبة، تقليب)",
          actionSv: "Granska kläckarens inställningar (temp, luftfuktighet, vändning)",
          reasonAr: `معدل التفقيس ${Math.round(hatchRate)}% — أقل من الهدف المثالي 80%`,
          reasonSv: `Kläckningsfrekvens ${Math.round(hatchRate)}% — under optimalt mål 80%`,
          impactAr: "رفع معدل التفقيس 10% يزيد إنتاج الكتاكيت بشكل ملحوظ",
          impactSv: "Höjning av kläckningsfrekvens med 10% ökar kycklingproduktionen markant",
        });
      } else {
        decisions.push({
          rank: decisions.length + 1, category: "production",
          actionAr: "زيادة عدد دورات التفقيس لرفع الإنتاج",
          actionSv: "Öka antalet kläckningscykler för att öka produktionen",
          reasonAr: "المزرعة قادرة على استيعاب دورات إضافية لزيادة الإيرادات",
          reasonSv: "Gården kan hantera ytterligare cykler för att öka intäkterna",
          impactAr: "كل دورة إضافية تولّد دخلاً مباشراً من بيع الكتاكيت",
          impactSv: "Varje extra cykel genererar direkt inkomst från kycklingsförsäljning",
        });
      }
    } else if (area.cat === "operations") {
      decisions.push({
        rank: decisions.length + 1, category: "operations",
        actionAr: "وضع خطة يومية واضحة لإنجاز كل المهام",
        actionSv: "Upprätta en tydlig daglig plan för att slutföra alla uppgifter",
        reasonAr: `معدل إنجاز المهام ${summary.tasksDueToday > 0 ? Math.round((summary.tasksCompletedToday / summary.tasksDueToday) * 100) : 0}% — يحتاج تحسين`,
        reasonSv: `Uppgiftsavslutningsgrad ${summary.tasksDueToday > 0 ? Math.round((summary.tasksCompletedToday / summary.tasksDueToday) * 100) : 0}% — behöver förbättras`,
        impactAr: "الالتزام اليومي بالمهام يرفع درجة أداء المزرعة بشكل مستمر",
        impactSv: "Dagligt engagemang för uppgifter höjer kontinuerligt gårdens prestandapoäng",
      });
    } else {
      decisions.push({
        rank: decisions.length + 1, category: "operations",
        actionAr: "مراجعة وتحديث أهداف المزرعة ربع السنوية",
        actionSv: "Granska och uppdatera gårdens kvartalsvisa mål",
        reasonAr: "الأهداف الواضحة توجّه الفريق وتحسن الأداء العام",
        reasonSv: "Tydliga mål vägleder teamet och förbättrar den övergripande prestandan",
        impactAr: "وجود أهداف محددة يزيد الإنتاجية بنسبة 20-30%",
        impactSv: "Specifika mål ökar produktiviteten med 20-30%",
      });
    }
  }

  // ── Monthly trend & Prediction ─────────────────────────────────────────────
  const monthlyTrend = buildMonthlyTrend(monthlyRows);
  const prediction = computePrediction(monthlyTrend);

  return {
    score, grade, financialScore, productionScore, operationsScore, goalsScore,
    income, expense, profit, margin, efficiency,
    insights, decisions, prediction, monthlyTrend,
    topExpenseCategory, topExpensePct,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const GRADE_COLORS = {
  excellent: "#10b981",
  good: "#3b82f6",
  fair: "#f59e0b",
  poor: "#ef4444",
};

function IntelGauge({ score, grade }: { score: number; grade: string }) {
  const r = 80;
  const cx = 110;
  const cy = 110;
  const startAngle = 210;
  const endAngle = -30;
  const sweep = startAngle - endAngle; // 240deg
  const pct = score / 100;
  const activeAngle = sweep * pct;

  function polar(angleDeg: number, radius: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy - radius * Math.sin(rad) };
  }
  function arcPath(from: number, to: number, radius: number) {
    const s = polar(from, radius);
    const e = polar(to, radius);
    const large = from - to > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const activeColor = GRADE_COLORS[grade as keyof typeof GRADE_COLORS] ?? "#6366f1";
  const activeEnd = startAngle - activeAngle;

  return (
    <svg viewBox="0 0 220 160" className="w-full max-w-[220px]">
      {/* Track */}
      <path d={arcPath(startAngle, endAngle, r)} fill="none" stroke="currentColor"
        strokeWidth={14} strokeLinecap="round" className="text-muted/20" />
      {/* Active arc */}
      <path d={arcPath(startAngle, activeEnd, r)} fill="none" stroke={activeColor}
        strokeWidth={14} strokeLinecap="round" />
      {/* Score text */}
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize={38}
        fontWeight="bold" fill={activeColor}>{score}</text>
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize={12} fill="#94a3b8">/100</text>
    </svg>
  );
}

function PillarBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="font-bold" style={{ color }}>{score}</span>
      </div>
      <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
}

function InsightCard({ insight, lang }: { insight: Insight; lang: string }) {
  const cfg = {
    critical: { bg: "bg-red-50 dark:bg-red-950/20", border: "border-red-300 dark:border-red-800", icon: <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />, badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
    warning:  { bg: "bg-amber-50 dark:bg-amber-950/20", border: "border-amber-300 dark:border-amber-800", icon: <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />, badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
    good:     { bg: "bg-emerald-50 dark:bg-emerald-950/20", border: "border-emerald-300 dark:border-emerald-800", icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />, badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    info:     { bg: "bg-blue-50 dark:bg-blue-950/20", border: "border-blue-300 dark:border-blue-800", icon: <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />, badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  };
  const c = cfg[insight.level];
  const title = lang === "ar" ? insight.titleAr : insight.titleSv;
  const msg   = lang === "ar" ? insight.msgAr   : insight.msgSv;
  const rec   = lang === "ar" ? insight.recAr   : insight.recSv;

  return (
    <div className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
      <div className="flex items-start gap-3">
        {c.icon}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground mb-1">{title}</div>
          <p className="text-xs text-muted-foreground leading-relaxed">{msg}</p>
          {rec && (
            <div className="mt-2 flex items-start gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">{rec}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DecisionCard({ decision, lang, isRtl }: { decision: Decision; lang: string; isRtl: boolean }) {
  const catColors: Record<string, string> = {
    financial: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30",
    production: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
    operations: "text-purple-600 bg-purple-100 dark:bg-purple-900/30",
  };
  const color = catColors[decision.category] ?? "text-gray-600 bg-gray-100";
  const rankColors = ["bg-red-500", "bg-amber-500", "bg-blue-500"];

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 hover:shadow-md transition-shadow">
      <div className={`flex items-start gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${rankColors[decision.rank - 1] ?? "bg-gray-500"}`}>
          {decision.rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="font-bold text-sm text-foreground">
              {lang === "ar" ? decision.actionAr : decision.actionSv}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${color}`}>
              {lang === "ar"
                ? (decision.category === "financial" ? "مالي" : decision.category === "production" ? "إنتاج" : "تشغيل")
                : (decision.category === "financial" ? "Ekonomi" : decision.category === "production" ? "Produktion" : "Drift")}
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-start gap-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex-shrink-0 mt-0.5">
                {lang === "ar" ? "السبب:" : "Orsak:"}
              </span>
              <p className="text-xs text-muted-foreground">{lang === "ar" ? decision.reasonAr : decision.reasonSv}</p>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide flex-shrink-0 mt-0.5">
                {lang === "ar" ? "التأثير:" : "Påverkan:"}
              </span>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">{lang === "ar" ? decision.impactAr : decision.impactSv}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL;

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() },
  });
  const { t, lang } = useLanguage();
  const isRtl = lang === "ar";
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    async function fetchFinancial() {
      try {
        const [txRes, sumRes] = await Promise.all([
          fetch(`${BASE}api/transactions?limit=500`),
          fetch(`${BASE}api/transactions/summary`),
        ]);
        if (txRes.ok) setTransactions(await txRes.json());
        if (sumRes.ok) setMonthlyRows(await sumRes.json());
      } catch (_) { /* silent */ }
      setDataLoading(false);
    }
    fetchFinancial();
  }, []);

  const intelligence = useMemo<FarmIntelligence | null>(() => {
    if (!summary || dataLoading) return null;
    return computeIntelligence(summary, transactions, monthlyRows);
  }, [summary, transactions, monthlyRows, dataLoading]);

  // Chart data: last 6 months + prediction
  const chartData = useMemo(() => {
    if (!intelligence) return [];
    const trend = intelligence.monthlyTrend.slice(-6);
    const data = trend.map(m => {
      const [yr, mo] = m.month.split("-");
      const label = lang === "ar"
        ? `${["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"][parseInt(mo) - 1]} ${yr}`
        : `${["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"][parseInt(mo) - 1]} ${yr}`;
      return { label, income: Math.round(m.income), expense: Math.round(m.expense), profit: Math.round(m.profit), isPrediction: false };
    });
    // Add prediction for next month
    if (intelligence.prediction.nextMonthProfit !== 0) {
      data.push({
        label: lang === "ar" ? "توقع" : "Prognos",
        income: 0, expense: 0,
        profit: intelligence.prediction.nextMonthProfit,
        isPrediction: true,
      });
    }
    return data;
  }, [intelligence, lang]);

  const isLoading = summaryLoading || dataLoading;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading || !intelligence) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-primary animate-pulse" />
          <div>
            <Skeleton className="h-7 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-24 w-full" /></CardContent></Card>)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1,2].map(i => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-40 w-full" /></CardContent></Card>)}
        </div>
      </div>
    );
  }

  const {
    score, grade, financialScore, productionScore, operationsScore, goalsScore,
    income, expense, profit, margin, efficiency,
    insights, decisions, prediction,
  } = intelligence;

  const gradeLabels = {
    ar: { excellent: "ممتاز", good: "جيد", fair: "مقبول", poor: "ضعيف" },
    sv: { excellent: "Utmärkt", good: "Bra", fair: "Godkänt", poor: "Svagt" },
  };
  const gradeLabel = gradeLabels[lang as "ar" | "sv"]?.[grade] ?? grade;
  const activeColor = GRADE_COLORS[grade];

  const riskLabels = {
    ar: { low: "منخفض", medium: "متوسط", high: "مرتفع" },
    sv: { low: "Låg", medium: "Medel", high: "Hög" },
  };
  const riskLabel = riskLabels[lang as "ar" | "sv"]?.[prediction.riskLevel] ?? prediction.riskLevel;
  const riskColor = { low: "text-emerald-600", medium: "text-amber-600", high: "text-red-600" }[prediction.riskLevel];
  const riskBg    = { low: "bg-emerald-100 dark:bg-emerald-900/30", medium: "bg-amber-100 dark:bg-amber-900/30", high: "bg-red-100 dark:bg-red-900/30" }[prediction.riskLevel];
  const RiskIcon  = { low: ShieldCheck, medium: Shield, high: ShieldAlert }[prediction.riskLevel];

  const TrendIcon = prediction.trend === "up" ? TrendingUp : prediction.trend === "down" ? TrendingDown : Minus;
  const trendColor = prediction.trend === "up" ? "text-emerald-500" : prediction.trend === "down" ? "text-red-500" : "text-amber-500";
  const trendLabel = lang === "ar"
    ? { up: "تصاعدي", down: "تنازلي", stable: "مستقر" }[prediction.trend]
    : { up: "Uppåt", down: "Nedåt", stable: "Stabil" }[prediction.trend];

  const today = new Date().toLocaleDateString(lang === "ar" ? "ar-IQ" : "sv-SE", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={`flex items-start justify-between gap-4 flex-wrap ${isRtl ? "flex-row-reverse" : ""}`}>
        <div className={isRtl ? "text-right" : "text-left"}>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">
              {lang === "ar" ? "نظام ذكاء المزرعة" : "Gårdens Intelligenssystem"}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            {today}
          </p>
        </div>
        <Badge className="text-xs px-3 py-1.5 bg-primary/10 text-primary border-primary/20 font-semibold">
          {lang === "ar" ? "يحلل · يقرر · يتنبأ" : "Analyserar · Beslutar · Förutsäger"}
        </Badge>
      </div>

      {/* ── Intelligence Score + Pillars ────────────────────────────────────── */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: activeColor }} />
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Gauge */}
            <div className="flex flex-col items-center">
              <p className="text-sm font-semibold text-muted-foreground mb-2">
                {lang === "ar" ? "درجة الذكاء الزراعي" : "Jordbruksintelligenspoäng"}
              </p>
              <IntelGauge score={score} grade={grade} />
              <Badge className="mt-1 text-sm px-4 py-1 font-bold" style={{ background: activeColor + "22", color: activeColor, border: `1px solid ${activeColor}55` }}>
                {gradeLabel}
              </Badge>
            </div>
            {/* Pillars */}
            <div className="space-y-4">
              <PillarBar label={lang === "ar" ? "المالية (40%)" : "Ekonomi (40%)"} score={financialScore} color="#10b981" />
              <PillarBar label={lang === "ar" ? "الإنتاج (30%)" : "Produktion (30%)"} score={productionScore} color="#3b82f6" />
              <PillarBar label={lang === "ar" ? "العمليات (20%)" : "Drift (20%)"} score={operationsScore} color="#8b5cf6" />
              <PillarBar label={lang === "ar" ? "الأهداف (10%)" : "Mål (10%)"} score={goalsScore} color="#f59e0b" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Strip ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Profit Margin */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Percent className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground font-medium">
                {lang === "ar" ? "هامش الربح" : "Vinstmarginal"}
              </span>
            </div>
            <div className="text-2xl font-bold" style={{ color: margin === null ? "#94a3b8" : margin < 0 ? "#ef4444" : margin < 10 ? "#f59e0b" : "#10b981" }}>
              {margin === null ? "—" : `${Math.round(margin)}%`}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lang === "ar" ? "المثالي: 20%+" : "Optimalt: 20%+"}
            </p>
          </CardContent>
        </Card>
        {/* Cost Efficiency */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground font-medium">
                {lang === "ar" ? "كفاءة التكلفة" : "Kostnadseffektivitet"}
              </span>
            </div>
            <div className="text-2xl font-bold" style={{ color: efficiency === null ? "#94a3b8" : efficiency > 90 ? "#ef4444" : efficiency > 75 ? "#f59e0b" : "#10b981" }}>
              {efficiency === null ? "—" : `${Math.round(efficiency)}%`}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lang === "ar" ? "نسبة المصاريف/الدخل" : "Kostnader/inkomstkvot"}
            </p>
          </CardContent>
        </Card>
        {/* Profit (current period) */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-muted-foreground font-medium">
                {lang === "ar" ? "صافي الربح" : "Nettovinst"}
              </span>
            </div>
            <div className="text-2xl font-bold" style={{ color: profit < 0 ? "#ef4444" : profit === 0 ? "#94a3b8" : "#10b981" }}>
              {profit < 0 ? "-" : "+"}{Math.abs(profit).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lang === "ar" ? "د.ع — كل المعاملات" : "IQD — alla transaktioner"}
            </p>
          </CardContent>
        </Card>
        {/* Risk Level */}
        <Card className={`border-border/50 shadow-sm ${riskBg}`}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <RiskIcon className={`w-4 h-4 ${riskColor}`} />
              <span className="text-xs text-muted-foreground font-medium">
                {lang === "ar" ? "مستوى المخاطرة" : "Risknivå"}
              </span>
            </div>
            <div className={`text-2xl font-bold ${riskColor}`}>{riskLabel}</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lang === "ar" ? `ثقة التنبؤ: ${prediction.confidence}%` : `Prognossäkerhet: ${prediction.confidence}%`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Insights + Decisions ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Insights */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              {lang === "ar" ? "تقرير الذكاء الزراعي" : "Jordbruksintelligensrapport"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {lang === "ar" ? "لا توجد تنبيهات حالياً" : "Inga aktuella varningar"}
              </p>
            ) : (
              insights.map((ins, i) => <InsightCard key={i} insight={ins} lang={lang} />)
            )}
          </CardContent>
        </Card>

        {/* Decisions */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              {lang === "ar" ? "قرارات ذكية — أولوية عالية" : "Smarta beslut — Hög prioritet"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {decisions.map((dec, i) => (
              <DecisionCard key={i} decision={dec} lang={lang} isRtl={isRtl} />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Prediction Panel ────────────────────────────────────────────────── */}
      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            {lang === "ar" ? "التنبؤ المستقبلي — الشهر القادم" : "Framtidsprognos — Nästa månad"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Next month profit */}
            <div className="rounded-xl bg-background border border-border/60 p-4 text-center">
              <p className="text-xs text-muted-foreground mb-2">
                {lang === "ar" ? "توقع الربح الشهر القادم" : "Beräknad vinst nästa månad"}
              </p>
              <div className="text-3xl font-bold" style={{ color: prediction.nextMonthProfit < 0 ? "#ef4444" : "#10b981" }}>
                {prediction.nextMonthProfit < 0 ? "-" : "+"}{Math.abs(prediction.nextMonthProfit).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{lang === "ar" ? "دينار عراقي" : "Irakisk dinar"}</p>
            </div>
            {/* Trend */}
            <div className="rounded-xl bg-background border border-border/60 p-4 text-center">
              <p className="text-xs text-muted-foreground mb-2">
                {lang === "ar" ? "اتجاه الأداء" : "Prestandatrend"}
              </p>
              <div className={`flex items-center justify-center gap-2 text-2xl font-bold ${trendColor}`}>
                <TrendIcon className="w-8 h-8" />
                {trendLabel}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {lang === "ar" ? "بناءً على بيانات الأشهر السابقة" : "Baserat på tidigare månadsdata"}
              </p>
            </div>
            {/* Risk */}
            <div className={`rounded-xl border p-4 text-center ${riskBg} border-border/60`}>
              <p className="text-xs text-muted-foreground mb-2">
                {lang === "ar" ? "مستوى المخاطرة" : "Risknivå"}
              </p>
              <div className={`flex items-center justify-center gap-2 text-2xl font-bold ${riskColor}`}>
                <RiskIcon className="w-7 h-7" />
                {riskLabel}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {lang === "ar" ? `ثقة التنبؤ: ${prediction.confidence}%` : `Prognossäkerhet: ${prediction.confidence}%`}
              </p>
            </div>
          </div>

          {/* Trend Chart */}
          {chartData.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" />
                {lang === "ar" ? "منحنى الربح — آخر 6 أشهر + توقع" : "Vinstutveckling — Senaste 6 månader + prognos"}
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={55}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toString()} />
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      `${v.toLocaleString()} ${lang === "ar" ? "د.ع" : "IQD"}`,
                      name === "income" ? (lang === "ar" ? "دخل" : "Inkomst") :
                      name === "expense" ? (lang === "ar" ? "مصاريف" : "Kostnader") :
                      (lang === "ar" ? "ربح" : "Vinst"),
                    ]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                  <Bar dataKey="income" fill="#10b981" opacity={0.8} radius={[4,4,0,0]} name="income" />
                  <Bar dataKey="expense" fill="#ef4444" opacity={0.7} radius={[4,4,0,0]} name="expense" />
                  <Bar dataKey="profit"
                    fill={prediction.nextMonthProfit >= 0 ? "#6366f1" : "#f97316"}
                    opacity={0.9} radius={[4,4,0,0]} name="profit" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Farm Operations Quick View ──────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          {lang === "ar" ? "العمليات اليومية" : "Dagliga operationer"}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { href: "/flocks", icon: Bird, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/20",
              label: lang === "ar" ? "إجمالي الدجاج" : "Totalt höns",
              val: summary!.totalChickens,
              sub: `${summary!.totalFlocks} ${lang === "ar" ? "قطيع" : "flockar"}` },
            { href: "/hatching", icon: Egg, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/20",
              label: lang === "ar" ? "بيض في التفقيس" : "Ägg i kläckning",
              val: summary!.totalEggsIncubating,
              sub: `${summary!.activeHatchingCycles} ${lang === "ar" ? "دورة نشطة" : "aktiva cykler"}` },
            { href: "/tasks", icon: CheckSquare, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/20",
              label: lang === "ar" ? "مهام اليوم" : "Dagens uppgifter",
              val: `${summary!.tasksCompletedToday}/${summary!.tasksDueToday}`,
              sub: lang === "ar" ? "أُنجزت اليوم" : "slutförda idag" },
            { href: "/goals", icon: Target, color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/20",
              label: lang === "ar" ? "الأهداف" : "Mål",
              val: `${summary!.goalsCompleted}/${summary!.totalGoals}`,
              sub: lang === "ar" ? "أهداف منجزة" : "mål uppnådda" },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <Link key={i} href={s.href}>
                <Card className="border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 cursor-pointer group">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
                      <div className={`p-1.5 rounded-full ${s.bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${s.color}`} />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-foreground">{s.val}</div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground">{s.sub}</p>
                      <Arrow className="w-3 h-3 text-primary/0 group-hover:text-primary/60 transition-all duration-200" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Weather */}
      <WeatherWidget />
    </div>
  );
}
