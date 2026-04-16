/**
 * ══════════════════════════════════════════════════════════════════════════════
 *   نظام الإدارة المالية الذكي المتكامل — مدير مزرعة الدواجن
 *   Advanced Poultry Farm Finance & Intelligence System
 *
 *   Algorithms: EMA · Z-Score Anomaly · HHI Concentration · Profit Velocity
 *               Cash Runway · Linear Regression · Break-Even Sensitivity
 *   UX:         Interactive Tooltips · Drill-Down Modals · What-If Simulator
 *               Expense Heatmap · Clickable Charts · Live 30s Polling
 *   Bilingual AR/SV · University-Grade Analytics
 * ══════════════════════════════════════════════════════════════════════════════
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ComposedChart,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp, TrendingDown, Plus, Trash2, Loader2,
  ArrowUpCircle, ArrowDownCircle, Search, Target, Activity,
  RefreshCw, Receipt, Calendar, Award, FileText, Info, Zap,
  Bird, Egg, Scale, BarChart3, CircleDollarSign, Layers,
  AlertTriangle, CheckCircle, Wheat, Syringe, Bolt, Droplets,
  Flame, Truck, Home, Package, ShieldPlus, Wrench, Factory,
  BarChart2, Star, ChevronDown, ChevronUp, Sliders, FlaskConical,
  Brain, Sigma, GitBranch, Cpu, ArrowRight, X, Eye,
  TrendingUp as Trend, PieChart as PieIcon, Microscope,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── API ──────────────────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include", ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Error");
  return r.status === 204 ? null : r.json();
}

// ─── Category Master Table ─────────────────────────────────────────────────────
const EXPENSE_CATS = [
  { id: "feed",                ar: "علف",                sv: "Foder",           icon: "🌾", fixed: false, Icon: Wheat    },
  { id: "medicine",            ar: "أدوية وعلاج",         sv: "Medicin",         icon: "💊", fixed: false, Icon: Syringe  },
  { id: "vaccines",            ar: "لقاحات",              sv: "Vacciner",        icon: "💉", fixed: false, Icon: ShieldPlus},
  { id: "electricity",         ar: "كهرباء",              sv: "El",              icon: "⚡", fixed: true,  Icon: Bolt     },
  { id: "water",               ar: "ماء",                 sv: "Vatten",          icon: "💧", fixed: false, Icon: Droplets },
  { id: "fuel",                ar: "وقود ومولد",           sv: "Bränsle",         icon: "⛽", fixed: false, Icon: Flame    },
  { id: "labor",               ar: "عمالة وأجور",          sv: "Arbetskraft",     icon: "👷", fixed: true,  Icon: Award    },
  { id: "equipment",           ar: "معدات وأجهزة",         sv: "Utrustning",      icon: "🔧", fixed: true,  Icon: Wrench   },
  { id: "maintenance",         ar: "صيانة",               sv: "Underhåll",       icon: "🛠️", fixed: true,  Icon: Factory  },
  { id: "disinfection",        ar: "مطهرات ومعقمات",       sv: "Desinfektion",    icon: "🧴", fixed: false, Icon: Package  },
  { id: "transport",           ar: "نقل وشحن",             sv: "Transport",       icon: "🚛", fixed: false, Icon: Truck    },
  { id: "rent",                ar: "إيجار",               sv: "Hyra",            icon: "🏠", fixed: true,  Icon: Home     },
  { id: "incubation_supplies", ar: "مستلزمات تفقيس",       sv: "Kläckningsförnöd",icon: "🥚", fixed: false, Icon: Egg     },
  { id: "eggs_purchase",       ar: "شراء بيض تفقيس",       sv: "Inköp av ägg",    icon: "🐣", fixed: false, Icon: Egg     },
  { id: "other",               ar: "أخرى",               sv: "Övrigt",          icon: "📦", fixed: false, Icon: Package  },
];
const INCOME_CATS = [
  { id: "chick_sale",   ar: "بيع كتاكيت",      sv: "Kycklingförsäljning",      icon: "🐥", Icon: Bird       },
  { id: "egg_sale",     ar: "بيع بيض",          sv: "Äggförsäljning",           icon: "🥚", Icon: Egg        },
  { id: "chicken_sale", ar: "بيع دجاج (لحم)",   sv: "Slaktkycklingförsäljning", icon: "🍗", Icon: Bird       },
  { id: "manure_sale",  ar: "بيع سماد",         sv: "Gödselförsäljning",        icon: "♻️", Icon: Layers     },
  { id: "other",        ar: "دخل أخرى",         sv: "Övriga intäkter",          icon: "📈", Icon: TrendingUp },
];
const ALL_CATS = [...EXPENSE_CATS, ...INCOME_CATS];
const catMeta = (id: string) =>
  ALL_CATS.find(c => c.id === id) ?? { id, ar: id, sv: id, icon: "📦", fixed: false, Icon: Package };

const PIE_COLORS = ["#ef4444","#f97316","#f59e0b","#84cc16","#06b6d4","#8b5cf6",
                    "#ec4899","#14b8a6","#fb923c","#a78bfa","#34d399","#60a5fa",
                    "#f472b6","#38bdf8","#4ade80"];
const INC_COLORS = ["#10b981","#3b82f6","#6366f1","#f59e0b","#14b8a6"];

// ─── Metric Glossary — فسّر كل مقياس بالعربية والسويدية والمعادلة ────────────
interface GlossaryEntry {
  nameAr: string; nameSv: string;
  formulaAr: string;
  descAr: string; descSv: string;
  benchmarkAr: string; benchmarkSv: string;
  colorClass: string;
}
const GLOSSARY: Record<string, GlossaryEntry> = {
  roi: {
    nameAr: "العائد على الاستثمار (ROI)", nameSv: "Avkastning på investering (ROI)",
    formulaAr: "ROI = ((الإيراد − المصاريف) ÷ المصاريف) × 100",
    descAr: "يقيس كمية الربح المحقق مقابل كل دينار مُستثمر في المزرعة. كلما ارتفعت النسبة كلما كان الاستثمار أكفأ.",
    descSv: "Mäter vinsten för varje investerad krona. Ju högre desto effektivare investering.",
    benchmarkAr: "المعيار الصناعي الدواجن: 10–25% / سنة · ممتاز > 30%",
    benchmarkSv: "Branschstandard fjäderfä: 10–25% / år · Utmärkt > 30%",
    colorClass: "text-purple-600",
  },
  profit_margin: {
    nameAr: "هامش الربح الصافي", nameSv: "Nettovinstmarginal",
    formulaAr: "هامش الربح = (صافي الربح ÷ إجمالي الإيراد) × 100",
    descAr: "نسبة ما يتبقى من كل دينار إيراد بعد خصم جميع المصاريف. يعكس الكفاءة التشغيلية الإجمالية.",
    descSv: "Andel av varje intäktskrona som är kvar efter alla kostnader.",
    benchmarkAr: "ضعيف < 10% · مقبول 10–20% · جيد 20–30% · ممتاز > 30%",
    benchmarkSv: "Svag < 10% · Acceptabelt 10–20% · Bra 20–30% · Utmärkt > 30%",
    colorClass: "text-blue-600",
  },
  oer: {
    nameAr: "نسبة المصاريف التشغيلية (OER)", nameSv: "Driftkostnadskvot (OER)",
    formulaAr: "OER = (إجمالي المصاريف ÷ إجمالي الإيراد) × 100",
    descAr: "تقيس ما تستهلكه المصاريف من الإيراد. الرقم الأقل أفضل — يعني مزرعة أكثر كفاءة.",
    descSv: "Mäter hur stor andel av intäkterna som går till kostnader. Lägre är bättre.",
    benchmarkAr: "ممتاز < 65% · جيد 65–80% · مقبول 80–90% · ضعيف > 90%",
    benchmarkSv: "Utmärkt < 65% · Bra 65–80% · Acceptabelt 80–90% · Svag > 90%",
    colorClass: "text-orange-600",
  },
  feed_ratio: {
    nameAr: "نسبة تكلفة العلف", nameSv: "Foderandel av kostnader",
    formulaAr: "نسبة العلف = (تكلفة العلف ÷ إجمالي المصاريف) × 100",
    descAr: "العلف هو المصروف الأكبر في الدواجن. النسبة الطبيعية 55–65%. ما فوق ذلك يشير لهدر أو غلاء العلف.",
    descSv: "Foder är den största kostnaden i fjäderfäproduktion. Normal andel 55–65%.",
    benchmarkAr: "ممتاز 50–55% · طبيعي 55–65% · مرتفع 65–75% · خطر > 75%",
    benchmarkSv: "Utmärkt 50–55% · Normalt 55–65% · Högt 65–75% · Fara > 75%",
    colorClass: "text-amber-600",
  },
  cost_per_bird: {
    nameAr: "تكلفة الطير الواحد", nameSv: "Kostnad per fågel",
    formulaAr: "تكلفة/طير = إجمالي المصاريف ÷ إجمالي عدد الطيور",
    descAr: "المؤشر الأساسي لقياس كفاءة الإنتاج. يستخدم لتسعير البيع وتحديد نقطة التعادل الدقيقة.",
    descSv: "Grundläggande produktionseffektivitetsmått. Används för prissättning och break-even.",
    benchmarkAr: "يختلف حسب السوق المحلي. استخدمه لمقارنة دوراتك مع بعضها عبر الزمن.",
    benchmarkSv: "Varierar beroende på lokal marknad. Jämför egna cykler över tid.",
    colorClass: "text-red-600",
  },
  gross_margin: {
    nameAr: "هامش الربح الإجمالي", nameSv: "Bruttomarginal",
    formulaAr: "الإيراد − التكاليف المتغيرة (علف + دواء + وقود + ...)",
    descAr: "الربح قبل خصم التكاليف الثابتة (إيجار + عمالة + معدات). يقيس ربحية الإنتاج الجوهرية.",
    descSv: "Vinst innan fasta kostnader. Mäter kärnproduktivitetens lönsamhet.",
    benchmarkAr: "يجب أن يكون موجباً دائماً. إذا كان سالباً فالمشكلة في التكاليف المتغيرة.",
    benchmarkSv: "Måste alltid vara positiv. Negativ = problem med rörliga kostnader.",
    colorClass: "text-teal-600",
  },
  ema_trend: {
    nameAr: "المتوسط المتحرك الأسي (EMA)", nameSv: "Exponentiellt rörligt medelvärde (EMA)",
    formulaAr: "EMA = α × القيمة_الحالية + (1−α) × EMA_السابقة  (α=0.35)",
    descAr: "خوارزمية تعطي وزناً أكبر للبيانات الحديثة عند التنبؤ. أدق من المتوسط البسيط لأنها تتكيف مع التغيرات السريعة.",
    descSv: "Algoritm som ger nyare data mer vikt vid prognos. Mer exakt än enkelt medelvärde.",
    benchmarkAr: "يُستخدم في تحليل الأسهم والأسواق المالية. مناسب للمزارع ذات دورات غير منتظمة.",
    benchmarkSv: "Används i aktie- och finansmarknadsanalys. Lämplig för oregerliga gårdscykler.",
    colorClass: "text-indigo-600",
  },
  z_score: {
    nameAr: "الانحراف المعياري Z-Score", nameSv: "Standardavvikelse Z-Score",
    formulaAr: "Z = (القيمة − المتوسط) ÷ الانحراف_المعياري",
    descAr: "يحدد الشهور غير الطبيعية إحصائياً. Z > 2 أو < −2 يعني حدثاً استثنائياً يستحق التحقيق.",
    descSv: "Identifierar statistiskt onormala månader. Z > 2 eller < −2 = exceptionell händelse.",
    benchmarkAr: "|Z| < 1 = طبيعي · 1–2 = ملحوظ · > 2 = استثنائي يستحق تحقيقاً",
    benchmarkSv: "|Z| < 1 = Normalt · 1–2 = Anmärkningsvärt · > 2 = Exceptionellt",
    colorClass: "text-rose-600",
  },
  hhi: {
    nameAr: "مؤشر هرفيندال-هيرشمان (HHI)", nameSv: "Herfindahl-Hirschman Index (HHI)",
    formulaAr: "HHI = Σ(نسبة_الفئة²) × 10,000",
    descAr: "يقيس تركّز المصاريف. HHI المرتفع يعني اعتماداً خطيراً على بند واحد (كالعلف مثلاً). يُستخدم في تحليل السوق والمنافسة.",
    descSv: "Mäter kostnadskoncentration. Högt HHI = farligt beroende av en post.",
    benchmarkAr: "HHI < 1500 = توزيع متنوع · 1500–2500 = تركز معتدل · > 2500 = تركز خطير",
    benchmarkSv: "HHI < 1500 = Diversifierat · 1500–2500 = Måttlig koncentration · > 2500 = Farlig",
    colorClass: "text-violet-600",
  },
  cash_runway: {
    nameAr: "مدة الاستمرارية النقدية (Cash Runway)", nameSv: "Kassabanan (Cash Runway)",
    formulaAr: "مدة الاستمرار = متوسط_الإيراد_الشهري ÷ معدل_الإنفاق_اليومي",
    descAr: "كم يوماً تستطيع المزرعة الاستمرار بالإيراد الحالي إذا لم تتغير المصاريف. مؤشر حيوي للتخطيط.",
    descSv: "Hur länge gården kan fortsätta med nuvarande intäkter. Kritiskt planeringsinstrument.",
    benchmarkAr: "خطر < 30 يوم · مقبول 30–90 · جيد 90–180 · ممتاز > 180 يوم",
    benchmarkSv: "Fara < 30 dagar · Acceptabelt 30–90 · Bra 90–180 · Utmärkt > 180",
    colorClass: "text-cyan-600",
  },
  profit_velocity: {
    nameAr: "سرعة الربح (Profit Velocity)", nameSv: "Vinstacceleration",
    formulaAr: "الزخم = ((ربح_الشهر_الأخير − ربح_ما_قبله) ÷ |ربح_ما_قبله|) × 100",
    descAr: "يقيس معدل تسارع أو تباطؤ نمو الربح. موجب = تحسن · سالب = تراجع. أشبه بمفهوم التسارع في الفيزياء.",
    descSv: "Mäter hur snabbt vinsten ökar/minskar. Positiv = förbättring · Negativ = nedgång.",
    benchmarkAr: "ممتاز > +20% · جيد +5 إلى +20% · محايد −5 إلى +5% · تراجع < −5%",
    benchmarkSv: "Utmärkt > +20% · Bra +5 till +20% · Neutral −5 till +5% · Nedgång < −5%",
    colorClass: "text-emerald-600",
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Period  = "week" | "month" | "quarter" | "year" | "all";
type FinTab  = "dashboard" | "add" | "analysis" | "simulator" | "transactions" | "statement";

interface Tx {
  id: number; date: string; type: "income"|"expense"; category: string;
  description: string; amount: string; quantity: string|null;
  unit: string|null; notes: string|null; authorName: string|null; createdAt: string;
}
interface Flock { id: number; name: string; count: number; breed: string; purpose: string; }

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmtAmount(n: number, lang: "ar"|"sv" = "ar"): string {
  const abs = Math.abs(Math.round(n));
  const fmt = new Intl.NumberFormat(lang === "ar" ? "ar-IQ" : "sv-SE").format(abs);
  return lang === "ar" ? `${fmt} د.ع` : `${fmt} IQD`;
}
function fmtPct(n: number | null, dec = 1): string {
  if (n === null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(dec)}%`;
}
function getPeriodRange(p: Period): { start: string; end: string } | null {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (p === "all") return null;
  const offsets: Record<Period, number> = { week: 7, month: 30, quarter: 90, year: 365, all: 0 };
  const s = new Date(today); s.setDate(today.getDate() - offsets[p]);
  return { start: fmt(s), end: fmt(today) };
}
function getPeriodDays(p: Period): number {
  return { week: 7, month: 30, quarter: 90, year: 365, all: 180 }[p];
}
function parseFeedKg(qty: string | null, unit: string | null): number | null {
  if (!qty || Number(qty) <= 0) return null;
  const q = Number(qty);
  const u = (unit ?? "").trim().toLowerCase();
  if (/^(كيلو|كغ|كيلوغرام|كيلوجرام|كلو|كلغ|kg|kilogram)$/.test(u)) return q;
  if (/^(طن|تن|ton|t|tonne)$/.test(u)) return q * 1000;
  if (/^(غرام|جرام|gram|g|غ|جـ)$/.test(u)) return q / 1000;
  if (u === "نصف طن") return q * 500;
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ALGORITHM ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Core Financial Metrics ───────────────────────────────────────────────────
interface FinMetrics {
  totalIncome: number; totalExpense: number; netProfit: number;
  profitMargin: number | null; roi: number | null;
  grossProfit: number; operatingExpense: number;
  fixedCosts: number; variableCosts: number;
  costPerBird: number | null; revenuePerBird: number | null;
  profitPerBird: number | null; breakEvenPricePerBird: number | null;
  dailyBurnRate: number; dailyRevRate: number;
  feedRatio: number | null; laborRatio: number | null;
  oer: number | null;
  expByCat: { id: string; value: number; pct: number }[];
  incByCat: { id: string; value: number; pct: number }[];
  healthScore: number; healthGrade: "excellent"|"good"|"fair"|"poor";
  feedCostRaw: number; laborCostRaw: number;
}

function computeMetrics(txs: Tx[], flocks: Flock[], period: Period): FinMetrics {
  const periodDays = getPeriodDays(period);
  const totalIncome  = txs.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = txs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const netProfit    = totalIncome - totalExpense;
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : null;
  const roi          = totalExpense > 0 ? (netProfit / totalExpense) * 100 : null;

  const expMap: Record<string, number> = {};
  txs.filter(t => t.type === "expense").forEach(t => { expMap[t.category] = (expMap[t.category] || 0) + Number(t.amount); });
  const incMap: Record<string, number> = {};
  txs.filter(t => t.type === "income").forEach(t => { incMap[t.category] = (incMap[t.category] || 0) + Number(t.amount); });

  const expByCat = Object.entries(expMap).sort((a, b) => b[1]-a[1]).map(([id, value]) => ({ id, value, pct: totalExpense > 0 ? (value/totalExpense)*100 : 0 }));
  const incByCat = Object.entries(incMap).sort((a, b) => b[1]-a[1]).map(([id, value]) => ({ id, value, pct: totalIncome > 0 ? (value/totalIncome)*100 : 0 }));

  const fixedCatIds  = EXPENSE_CATS.filter(c => c.fixed).map(c => c.id);
  const fixedCosts   = expByCat.filter(e => fixedCatIds.includes(e.id)).reduce((s, e) => s + e.value, 0);
  const variableCosts = totalExpense - fixedCosts;

  const totalBirds           = flocks.reduce((s, f) => s + f.count, 0);
  const costPerBird          = totalBirds > 0 ? totalExpense / totalBirds : null;
  const revenuePerBird       = totalBirds > 0 ? totalIncome  / totalBirds : null;
  const profitPerBird        = totalBirds > 0 ? netProfit    / totalBirds : null;
  const breakEvenPricePerBird = totalBirds > 0 ? totalExpense / totalBirds : null;

  const feedCostRaw  = expMap["feed"]  ?? 0;
  const laborCostRaw = expMap["labor"] ?? 0;
  const feedRatio    = totalExpense > 0 ? (feedCostRaw  / totalExpense) * 100 : null;
  const laborRatio   = totalExpense > 0 ? (laborCostRaw / totalExpense) * 100 : null;
  const oer          = totalIncome  > 0 ? (totalExpense / totalIncome)  * 100 : null;

  const grossProfit      = totalIncome - variableCosts;
  const operatingExpense = fixedCosts;

  const dailyBurnRate = periodDays > 0 ? totalExpense / periodDays : 0;
  const dailyRevRate  = periodDays > 0 ? totalIncome  / periodDays : 0;

  let healthScore = 50;
  if (totalIncome > 0) healthScore = Math.max(0, Math.min(100, 50 + (profitMargin ?? 0)));
  const healthGrade: FinMetrics["healthGrade"] =
    healthScore >= 70 ? "excellent" : healthScore >= 55 ? "good" : healthScore >= 40 ? "fair" : "poor";

  return { totalIncome, totalExpense, netProfit, profitMargin, roi,
    grossProfit, operatingExpense, fixedCosts, variableCosts,
    costPerBird, revenuePerBird, profitPerBird, breakEvenPricePerBird,
    dailyBurnRate, dailyRevRate, feedRatio, laborRatio, oer,
    expByCat, incByCat, healthScore, healthGrade, feedCostRaw, laborCostRaw };
}

// ─── Monthly Data ─────────────────────────────────────────────────────────────
interface MonthRow { month: string; monthAr: string; income: number; expense: number; profit: number; }
const AR_M = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function computeMonthly(txs: Tx[]): MonthRow[] {
  const map: Record<string, { income: number; expense: number }> = {};
  txs.forEach(t => {
    const m = t.date.slice(0, 7);
    if (!map[m]) map[m] = { income: 0, expense: 0 };
    if (t.type === "income") map[m].income += Number(t.amount);
    else                     map[m].expense += Number(t.amount);
  });
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([m, d]) => {
    const [, mo] = m.split("-");
    return { month: m.slice(5), monthAr: AR_M[parseInt(mo)-1] ?? m, income: d.income, expense: d.expense, profit: d.income - d.expense };
  });
}

// ─── Advanced Algorithm Suite ─────────────────────────────────────────────────
interface AdvMetrics {
  // EMA — Exponential Moving Average (α=0.35)
  emaIncome: number; emaExpense: number; emaProfit: number;
  // Z-Score monthly anomaly detection
  monthZScores: { month: string; monthAr: string; profit: number; z: number; anomaly: boolean }[];
  // HHI — Herfindahl–Hirschman concentration index (0–10,000)
  hhi: number; hhiGrade: "diverse" | "moderate" | "concentrated";
  // Cash Runway (days at current income rate)
  cashRunway: number | null;
  // Profit Velocity (momentum, %)
  profitVelocity: number | null;
  // Coefficient of Variation for income stability (lower = more stable)
  incomeCV: number | null;
  // Linear regression prediction
  pred: { income: number; expense: number; profit: number } | null;
  // Expense heatmap data: category × month
  heatmap: { cat: string; months: Record<string, number> }[];
  // Moving avg (3-month simple) for chart
  movingAvg: { month: string; monthAr: string; ma: number }[];
}

function linReg(vals: number[]): number {
  const n = vals.length;
  if (n < 2) return vals[0] ?? 0;
  const xm = (n-1)/2;
  const ym = vals.reduce((s,v) => s+v, 0) / n;
  let num = 0, den = 0;
  vals.forEach((v, i) => { num += (i-xm)*(v-ym); den += (i-xm)**2; });
  const slope = den !== 0 ? num/den : 0;
  return Math.max(0, Math.round(ym - slope*xm + slope*n));
}

function computeAdvanced(allTxs: Tx[], monthly: MonthRow[]): AdvMetrics {
  // ── EMA (α=0.35) on last 12 months
  const ALPHA = 0.35;
  const recent12 = monthly.slice(-12);
  let emaInc = recent12[0]?.income ?? 0;
  let emaExp = recent12[0]?.expense ?? 0;
  recent12.forEach(m => {
    emaInc = ALPHA * m.income  + (1-ALPHA) * emaInc;
    emaExp = ALPHA * m.expense + (1-ALPHA) * emaExp;
  });
  const emaProfit = emaInc - emaExp;

  // ── Z-Score anomaly on profits
  const profits = monthly.map(m => m.profit);
  const mean  = profits.length > 0 ? profits.reduce((s,v) => s+v, 0) / profits.length : 0;
  const variance = profits.length > 1 ? profits.map(p => (p-mean)**2).reduce((s,v) => s+v, 0) / profits.length : 0;
  const std   = Math.sqrt(variance);
  const monthZScores = monthly.map(m => ({
    month: m.month, monthAr: m.monthAr, profit: m.profit,
    z: std > 0 ? (m.profit - mean) / std : 0,
    anomaly: std > 0 && Math.abs((m.profit - mean) / std) > 1.8,
  }));

  // ── HHI — expense concentration
  const totalExp = allTxs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const expMap: Record<string, number> = {};
  allTxs.filter(t => t.type === "expense").forEach(t => { expMap[t.category] = (expMap[t.category]||0) + Number(t.amount); });
  const hhi = totalExp > 0
    ? Object.values(expMap).reduce((s, v) => s + ((v/totalExp)*100)**2, 0)
    : 0;
  const hhiGrade: AdvMetrics["hhiGrade"] = hhi < 1500 ? "diverse" : hhi < 2500 ? "moderate" : "concentrated";

  // ── Cash Runway: avgMonthlyIncome / dailyBurnRate
  const avgMonthlyIncome = monthly.length > 0 ? monthly.slice(-3).reduce((s,m) => s+m.income, 0) / Math.min(3, monthly.length) : 0;
  const avgDailyExpense  = monthly.length > 0 ? monthly.slice(-3).reduce((s,m) => s+m.expense, 0) / (Math.min(3, monthly.length) * 30) : 0;
  const cashRunway = avgDailyExpense > 0 ? avgMonthlyIncome / avgDailyExpense : null;

  // ── Profit Velocity (last 2 months)
  let profitVelocity: number | null = null;
  if (monthly.length >= 2) {
    const prev = monthly[monthly.length-2].profit;
    const last = monthly[monthly.length-1].profit;
    profitVelocity = prev !== 0 ? ((last - prev) / Math.abs(prev)) * 100 : null;
  }

  // ── Coefficient of Variation (income stability)
  const incomes = monthly.map(m => m.income);
  const iMean  = incomes.length > 0 ? incomes.reduce((s,v) => s+v, 0) / incomes.length : 0;
  const iStd   = incomes.length > 1 ? Math.sqrt(incomes.map(v => (v-iMean)**2).reduce((s,v) => s+v, 0) / incomes.length) : 0;
  const incomeCV = iMean > 0 ? (iStd / iMean) * 100 : null;

  // ── Prediction (linear regression on last 6 months)
  let pred: AdvMetrics["pred"] = null;
  if (monthly.length >= 2) {
    const r = monthly.slice(-Math.min(6, monthly.length));
    pred = { income: linReg(r.map(m => m.income)), expense: linReg(r.map(m => m.expense)), profit: linReg(r.map(m => m.profit)) };
  }

  // ── Expense Heatmap (category × month, last 6 months)
  const last6months = monthly.slice(-6).map(m => m.month);
  const heatCats = [...new Set(allTxs.filter(t => t.type === "expense").map(t => t.category))];
  const heatmap = heatCats.map(cat => {
    const months: Record<string, number> = {};
    last6months.forEach(mo => {
      months[mo] = allTxs.filter(t => t.type === "expense" && t.category === cat && t.date.slice(5,7) === mo).reduce((s,t) => s + Number(t.amount), 0);
    });
    return { cat, months };
  });

  // ── 3-Month Simple Moving Average
  const movingAvg: AdvMetrics["movingAvg"] = monthly.slice(2).map((m, i) => ({
    month: m.month, monthAr: m.monthAr,
    ma: (monthly[i].profit + monthly[i+1].profit + m.profit) / 3,
  }));

  return { emaIncome: emaInc, emaExpense: emaExp, emaProfit, monthZScores,
    hhi, hhiGrade, cashRunway, profitVelocity, incomeCV, pred, heatmap, movingAvg };
}

// ─── Alert Engine (13 rules) ──────────────────────────────────────────────────
interface Alert { id: string; severity: "critical"|"warning"|"info"; ar: string; sv: string; }
function detectAlerts(m: FinMetrics, txCount: number): Alert[] {
  const a: Alert[] = [];
  if (txCount === 0) return a;
  if (m.netProfit < 0 && m.totalIncome > 0)
    a.push({ id:"loss", severity:"critical", ar:`⛔ خسارة صافية: ${fmtAmount(Math.abs(m.netProfit))} — راجع التكاليف فوراً`, sv:`⛔ Nettoförlust: ${fmtAmount(Math.abs(m.netProfit),"sv")} — granska kostnader` });
  if (m.profitMargin !== null && m.profitMargin >= 0 && m.profitMargin < 10)
    a.push({ id:"low_margin", severity:"critical", ar:`⚠️ هامش ربح ${m.profitMargin.toFixed(1)}% — الحد الأمان 20%`, sv:`⚠️ Vinstmarginal ${m.profitMargin.toFixed(1)}% — Säkerhetsgräns 20%` });
  if (m.feedRatio !== null && m.feedRatio > 65)
    a.push({ id:"feed_heavy", severity:"warning", ar:`🌾 العلف ${m.feedRatio.toFixed(0)}% من المصاريف — المعيار 55–65%`, sv:`🌾 Foder ${m.feedRatio.toFixed(0)}% av kostnader — Standard 55–65%` });
  if (m.oer !== null && m.oer > 90 && m.netProfit >= 0)
    a.push({ id:"oer_high", severity:"warning", ar:`📊 OER=${m.oer.toFixed(0)}% — مرتفع جداً (المعيار < 80%)`, sv:`📊 OER=${m.oer.toFixed(0)}% — Mycket högt (Standard < 80%)` });
  if (m.laborRatio !== null && m.laborRatio > 30)
    a.push({ id:"labor_high", severity:"warning", ar:`👷 العمالة ${m.laborRatio.toFixed(0)}% — أعلى من المعيار 20–25%`, sv:`👷 Arbetskostnad ${m.laborRatio.toFixed(0)}% — Över standarden 20–25%` });
  if (m.totalIncome === 0 && txCount > 3)
    a.push({ id:"no_income", severity:"warning", ar:"لا دخل مسجل — أضف مبيعاتك لتحليل الربحية", sv:"Ingen inkomst registrerad — Lägg till försäljning" });
  if (m.variableCosts > m.totalIncome * 0.95 && m.totalIncome > 0)
    a.push({ id:"var_high", severity:"warning", ar:"التكاليف المتغيرة > 95% من الدخل — إعادة هيكلة ضرورية", sv:"Rörliga kostnader > 95% av intäkter — Omstrukturering nödvändig" });
  if (m.profitMargin !== null && m.profitMargin >= 25)
    a.push({ id:"excellent", severity:"info", ar:`✅ هامش ربح ${m.profitMargin.toFixed(1)}% — أداء ممتاز يتجاوز المعيار الصناعي`, sv:`✅ Vinstmarginal ${m.profitMargin.toFixed(1)}% — Utmärkt, överstiger branschstandarden` });
  if (m.costPerBird !== null)
    a.push({ id:"cpb", severity:"info", ar:`🐔 تكلفة الطير: ${fmtAmount(m.costPerBird)} | سعر التعادل: ${fmtAmount(m.breakEvenPricePerBird??0)}`, sv:`🐔 Kostnad/fågel: ${fmtAmount(m.costPerBird,"sv")} | Break-even: ${fmtAmount(m.breakEvenPricePerBird??0,"sv")}` });
  return a;
}

// ─── Feed Metrics ─────────────────────────────────────────────────────────────
interface FeedMetrics {
  totalFeedKg: number; totalFeedCost: number; dailyFeedKg: number;
  feedPerBirdKg: number|null; feedCostPerKg: number|null; feedCostPerBird: number|null;
  trackedEntries: number; untrackedEntries: number;
  monthlyFeed: { month: string; monthAr: string; kg: number; cost: number }[];
  fcrGrade: "excellent"|"good"|"fair"|"high";
}
function computeFeedMetrics(allTxs: Tx[], flocks: Flock[], periodTxs: Tx[], periodDays: number): FeedMetrics {
  const feedTxs     = periodTxs.filter(t => t.type === "expense" && t.category === "feed");
  const totalFeedCost = feedTxs.reduce((s,t) => s + Number(t.amount), 0);
  let totalFeedKg = 0, tracked = 0, untracked = 0;
  feedTxs.forEach(t => { const kg = parseFeedKg(t.quantity, t.unit); kg !== null ? (totalFeedKg += kg, tracked++) : untracked++; });
  const totalBirds     = flocks.reduce((s,f) => s + f.count, 0);
  const feedPerBirdKg  = totalFeedKg > 0 && totalBirds > 0 ? totalFeedKg / totalBirds : null;
  const feedCostPerKg  = totalFeedKg > 0 ? totalFeedCost / totalFeedKg : null;
  const feedCostPerBird = totalBirds > 0 && totalFeedCost > 0 ? totalFeedCost / totalBirds : null;
  const dailyFeedKg    = periodDays > 0 && totalFeedKg > 0 ? totalFeedKg / periodDays : 0;
  const mMap: Record<string, { kg: number; cost: number }> = {};
  allTxs.filter(t => t.type === "expense" && t.category === "feed").forEach(t => {
    const m = t.date.slice(0,7);
    if (!mMap[m]) mMap[m] = { kg: 0, cost: 0 };
    mMap[m].cost += Number(t.amount);
    const kg = parseFeedKg(t.quantity, t.unit);
    if (kg !== null) mMap[m].kg += kg;
  });
  const monthlyFeed = Object.entries(mMap).sort(([a],[b]) => a.localeCompare(b)).map(([m,d]) => ({ month: m.slice(5), monthAr: AR_M[parseInt(m.slice(5))-1]??m, ...d }));
  const fcrGrade: FeedMetrics["fcrGrade"] = feedPerBirdKg === null ? "good" : feedPerBirdKg < 3 ? "excellent" : feedPerBirdKg <= 5 ? "good" : feedPerBirdKg <= 7 ? "fair" : "high";
  return { totalFeedKg, totalFeedCost, dailyFeedKg, feedPerBirdKg, feedCostPerKg, feedCostPerBird, trackedEntries: tracked, untrackedEntries: untracked, monthlyFeed, fcrGrade };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── InfoTip — اضغط ⓘ لشرح المقياس ─────────────────────────────────────────
function InfoTip({ metricKey, ar }: { metricKey: string; ar: boolean }) {
  const [open, setOpen] = useState(false);
  const info = GLOSSARY[metricKey];
  if (!info) return null;
  return (
    <div className="relative inline-block">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-all text-[9px] font-bold text-muted-foreground shrink-0"
        title={ar ? "اضغط لمعرفة المزيد" : "Klicka för mer info"}>
        ⓘ
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={cn(
            "absolute z-50 w-72 bg-background border border-border/60 rounded-2xl shadow-xl p-4",
            ar ? "right-0" : "left-0", "top-6"
          )}>
            <div className="flex items-start justify-between mb-2">
              <p className={cn("text-xs font-black", info.colorClass)}>{ar ? info.nameAr : info.nameSv}</p>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
            </div>
            <div className="bg-muted/40 rounded-xl px-3 py-2 mb-2.5 font-mono text-[10px] text-muted-foreground leading-relaxed">
              {info.formulaAr}
            </div>
            <p className="text-[10px] text-foreground leading-relaxed mb-2">{ar ? info.descAr : info.descSv}</p>
            <div className="border-t border-border/40 pt-2">
              <p className="text-[9px] text-muted-foreground leading-relaxed">{ar ? info.benchmarkAr : info.benchmarkSv}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Drill Modal ──────────────────────────────────────────────────────────────
function DrillModal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-black">{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

// ─── Live Badge ───────────────────────────────────────────────────────────────
function LiveBadge({ fetching }: { fetching: boolean }) {
  const [sec, setSec] = useState(0);
  useEffect(() => { const id = setInterval(() => setSec(s => s+1), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { setSec(0); }, [fetching]);
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
      {fetching ? <RefreshCw className="w-3 h-3 animate-spin text-blue-500" /> : <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
      <span className="hidden sm:inline">Live · {sec < 60 ? `${sec}s` : `${Math.floor(sec/60)}m`}</span>
    </div>
  );
}

// ─── KPI Tile (clickable + info) ──────────────────────────────────────────────
function KpiTile({ label, value, sub, icon: Icon, color, trend, infoKey, ar, onClick }: {
  label: string; value: string; sub?: string; icon: any; color: string;
  trend?: "up"|"down"|null; infoKey?: string; ar: boolean; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className={cn(
      "w-full text-left rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden",
      "hover:shadow-md hover:border-border transition-all duration-200 active:scale-[0.98]",
      onClick && "cursor-pointer"
    )}>
      <div className={cn("h-0.5 w-full", color)} />
      <div className="p-3.5">
        <div className="flex items-start justify-between mb-1.5">
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0")}>
            <Icon className={cn("w-4.5 h-4.5", color.includes("emerald") ? "text-emerald-500" : color.includes("red") ? "text-red-500" : color.includes("blue") ? "text-blue-500" : color.includes("purple") ? "text-purple-500" : color.includes("amber") ? "text-amber-500" : "text-slate-500")} />
          </div>
          <div className="flex items-center gap-1">
            {trend === "up"   && <TrendingUp   className="w-3.5 h-3.5 text-emerald-500" />}
            {trend === "down" && <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
            {infoKey && <InfoTip metricKey={infoKey} ar={ar} />}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground leading-none mb-1">{label}</p>
        <p className="text-sm font-black truncate leading-snug">{value}</p>
        {sub && <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
        {onClick && (
          <p className="text-[8px] text-muted-foreground/60 mt-1 flex items-center gap-0.5">
            <Eye className="w-2 h-2" />{ar ? "اضغط للتفاصيل" : "Tryck för detaljer"}
          </p>
        )}
      </div>
    </button>
  );
}

// ─── Alert Strip ──────────────────────────────────────────────────────────────
function AlertBanner({ alerts, ar }: { alerts: Alert[]; ar: boolean }) {
  const [dismissed, setDismissed] = useState(new Set<string>());
  const visible = alerts.filter(a => !dismissed.has(a.id));
  if (!visible.length) return null;
  const cfg = {
    critical: "bg-red-50 dark:bg-red-950/30 border-red-200 text-red-700 dark:text-red-300",
    warning:  "bg-amber-50 dark:bg-amber-950/30 border-amber-200 text-amber-700 dark:text-amber-300",
    info:     "bg-blue-50 dark:bg-blue-950/30 border-blue-200 text-blue-700 dark:text-blue-300",
  };
  return (
    <div className="space-y-2">
      {visible.slice(0,4).map(a => (
        <div key={a.id} className={cn("rounded-xl border px-3.5 py-2.5 flex items-start gap-2.5", cfg[a.severity])}>
          {a.severity === "info" ? <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
          <p className="text-[11px] font-medium flex-1 leading-relaxed">{ar ? a.ar : a.sv}</p>
          <button onClick={() => setDismissed(s => new Set([...s, a.id]))} className="text-xs opacity-60 hover:opacity-100">×</button>
        </div>
      ))}
    </div>
  );
}

// ─── Health Gauge ─────────────────────────────────────────────────────────────
function HealthGauge({ score, grade }: { score: number; grade: string }) {
  const R = 52; const cx = 65; const cy = 65;
  const circ = Math.PI * R;
  const dash = (Math.min(score,100)/100) * circ;
  const GC = { excellent: { stroke:"#10b981", text:"#059669" }, good: { stroke:"#3b82f6", text:"#2563eb" }, fair: { stroke:"#f59e0b", text:"#d97706" }, poor: { stroke:"#ef4444", text:"#dc2626" } };
  const gc = GC[grade as keyof typeof GC] ?? GC.poor;
  return (
    <div className="flex flex-col items-center">
      <svg width="130" height="82" viewBox="0 0 130 82">
        <path d={`M ${cx-R} ${cy} A ${R} ${R} 0 0 1 ${cx+R} ${cy}`} fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
        <path d={`M ${cx-R} ${cy} A ${R} ${R} 0 0 1 ${cx+R} ${cy}`} fill="none" stroke={gc.stroke} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`} style={{ transition:"stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }} />
        <text x={cx} y={cy-8} textAnchor="middle" fontSize="22" fontWeight="900" fill={gc.text}>{score}</text>
        <text x={cx} y={cy+8} textAnchor="middle" fontSize="9" fill="#94a3b8">/100</text>
      </svg>
    </div>
  );
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────
function ChartTip({ active, payload, label, ar }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/95 border border-border/60 rounded-xl p-2.5 shadow-lg text-[11px] backdrop-blur">
      <p className="font-bold mb-1.5 text-muted-foreground">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold">{typeof p.value === "number" && p.value > 1000 ? fmtAmount(p.value, ar ? "ar" : "sv") : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Add Transaction Form ─────────────────────────────────────────────────────
function AddTransactionForm({ ar, onSuccess }: { ar: boolean; onSuccess: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ type: "expense" as "income"|"expense", date: new Date().toISOString().split("T")[0], category:"", description:"", amount:"", qty:"", unitPrice:"", unit:"", notes:"", useCalc: false });
  const [saving, setSaving] = useState(false);
  const cats = form.type === "expense" ? EXPENSE_CATS : INCOME_CATS;
  const set = (k: string, v: string|boolean) => setForm(f => ({ ...f, [k]: v }));
  const calcAmount = useMemo(() => form.useCalc && form.qty && form.unitPrice ? (Number(form.qty)*Number(form.unitPrice)).toFixed(0) : form.amount, [form]);
  const selectedCat = cats.find(c => c.id === form.category);
  const finalAmt = form.useCalc ? calcAmount : form.amount;

  const handleSave = async () => {
    if (!form.date || !form.category || !form.description || !finalAmt) { toast({ variant:"destructive", title: ar ? "أكمل الحقول المطلوبة" : "Fyll i alla fält" }); return; }
    setSaving(true);
    try {
      await apiFetch("/api/transactions", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ date: form.date, type: form.type, category: form.category, description: form.description, amount: Number(finalAmt), quantity: form.qty ? Number(form.qty) : null, unit: form.unit || null, notes: form.notes || null }) });
      toast({ title: ar ? "✅ تمت إضافة المعاملة" : "✅ Transaktion tillagd" });
      setForm(f => ({ ...f, category:"", description:"", amount:"", qty:"", unitPrice:"", unit:"", notes:"" }));
      onSuccess();
    } catch (e: any) { toast({ variant:"destructive", title: e.message }); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      {/* Type toggle */}
      <div className="flex rounded-xl overflow-hidden border border-border/60 p-0.5 bg-muted/30">
        {(["expense","income"] as const).map(t => (
          <button key={t} onClick={() => set("type", t)} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all",
            form.type === t ? (t === "expense" ? "bg-red-500 text-white shadow-sm" : "bg-emerald-500 text-white shadow-sm") : "text-muted-foreground")}>
            {t === "expense" ? <><ArrowDownCircle className="w-4 h-4" />{ar ? "مصروف" : "Kostnad"}</> : <><ArrowUpCircle className="w-4 h-4" />{ar ? "دخل" : "Inkomst"}</>}
          </button>
        ))}
      </div>
      {/* Date */}
      <div>
        <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5 text-muted-foreground"><Calendar className="w-3.5 h-3.5" />{ar ? "التاريخ" : "Datum"} *</Label>
        <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} className="h-10" />
      </div>
      {/* Category grid */}
      <div>
        <Label className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-muted-foreground"><Layers className="w-3.5 h-3.5" />{ar ? "الفئة" : "Kategori"} *</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {cats.map(c => (
            <button key={c.id} onClick={() => set("category", c.id)} className={cn("flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all",
              form.category === c.id ? (form.type === "expense" ? "border-red-400 bg-red-50 dark:bg-red-950/20" : "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20") : "border-border/40 hover:border-border hover:bg-muted/40")}>
              <span className="text-base">{c.icon}</span>
              <span className="text-[9px] font-medium">{ar ? c.ar : c.sv}</span>
            </button>
          ))}
        </div>
        {selectedCat && form.category === "feed" && (
          <div className="mt-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 px-3 py-2.5">
            <p className="text-[10px] font-bold text-amber-700 flex items-center gap-1.5 mb-1"><Wheat className="w-3 h-3" />{ar ? "لتفعيل تحليل الاستهلاك — أدخل الوزن" : "För förbrukningsanalys — ange vikt"}</p>
            <div className="flex gap-1 flex-wrap">
              {["كيلو","كغ","طن"].map(u => (
                <button key={u} onClick={() => { set("unit", u); if (!form.useCalc) set("useCalc", true); }} className={cn("text-[9px] px-2 py-0.5 rounded-md border font-bold transition-all", form.unit === u ? "bg-amber-500 text-white border-amber-500" : "bg-white dark:bg-transparent border-amber-300 text-amber-700")}>{u}</button>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Description */}
      <div>
        <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5 text-muted-foreground"><FileText className="w-3.5 h-3.5" />{ar ? "الوصف" : "Beskrivning"} *</Label>
        <Input value={form.description} onChange={e => set("description", e.target.value)} placeholder={ar ? "وصف المعاملة..." : "Transaktionsbeskrivning..."} className="h-10" />
      </div>
      {/* Amount / qty×price */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground"><CircleDollarSign className="w-3.5 h-3.5" />{ar ? "المبلغ" : "Belopp"} *</Label>
          <button onClick={() => set("useCalc", !form.useCalc)} className={cn("text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-all", form.useCalc ? "bg-blue-50 border-blue-200 text-blue-600" : "border-border/60 text-muted-foreground")}>
            {ar ? (form.useCalc ? "كمية×سعر ✓" : "كمية×سعر") : (form.useCalc ? "Antal×Pris ✓" : "Antal×Pris")}
          </button>
        </div>
        {form.useCalc ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-[10px] text-muted-foreground mb-1 block">{ar ? "الكمية" : "Antal"}</Label><Input type="number" value={form.qty} onChange={e => set("qty", e.target.value)} placeholder="0" className="h-9 text-sm" /></div>
              <div><Label className="text-[10px] text-muted-foreground mb-1 block">{ar ? "الوحدة" : "Enhet"}</Label><Input value={form.unit} onChange={e => set("unit", e.target.value)} placeholder={ar?"كغ/طن":"kg"} className="h-9 text-sm" /></div>
              <div><Label className="text-[10px] text-muted-foreground mb-1 block">{ar ? "سعر الوحدة" : "Styckpris"}</Label><Input type="number" value={form.unitPrice} onChange={e => set("unitPrice", e.target.value)} placeholder="0" className="h-9 text-sm" /></div>
            </div>
            <div className={cn("rounded-xl p-3 flex justify-between", form.type === "expense" ? "bg-red-50 dark:bg-red-950/20" : "bg-emerald-50 dark:bg-emerald-950/20")}>
              <span className="text-xs text-muted-foreground">{ar ? "الإجمالي:" : "Totalt:"}</span>
              <span className={cn("text-sm font-black", form.type === "expense" ? "text-red-600" : "text-emerald-600")}>{calcAmount ? fmtAmount(Number(calcAmount)) : "—"}</span>
            </div>
          </div>
        ) : (
          <Input type="number" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder={ar?"المبلغ بالدينار العراقي":"Belopp i IQD"} className="h-10" />
        )}
      </div>
      {/* Notes */}
      <div>
        <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5 text-muted-foreground"><Info className="w-3.5 h-3.5" />{ar ? "ملاحظات" : "Anteckningar"}</Label>
        <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder={ar ? "تفاصيل إضافية..." : "Ytterligare detaljer..."} className="h-16 text-sm resize-none" />
      </div>
      {/* Preview */}
      {form.category && form.description && Number(finalAmt) > 0 && (
        <div className={cn("rounded-xl border-2 p-3.5", form.type === "expense" ? "border-red-200 bg-red-50/50 dark:border-red-800/40 dark:bg-red-950/10" : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/10")}>
          <p className="text-[10px] text-muted-foreground mb-1">{ar ? "معاينة" : "Förhandsgranskning"}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{selectedCat?.icon ?? "📦"}</span>
              <div><p className="text-xs font-bold">{form.description}</p><p className="text-[10px] text-muted-foreground">{form.date}</p></div>
            </div>
            <span className={cn("text-base font-black", form.type === "expense" ? "text-red-600" : "text-emerald-600")}>
              {form.type === "expense" ? "−" : "+"}{fmtAmount(Number(finalAmt))}
            </span>
          </div>
        </div>
      )}
      <Button onClick={handleSave} disabled={saving || !form.category || !form.description || !(Number(finalAmt)>0)}
        className={cn("w-full h-12 text-sm font-bold shadow-md border-none", form.type === "expense" ? "bg-gradient-to-r from-red-500 to-rose-600 text-white" : "bg-gradient-to-r from-emerald-500 to-teal-600 text-white")}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 me-2" />{ar ? "حفظ المعاملة" : "Spara transaktion"}</>}
      </Button>
    </div>
  );
}

// ─── What-If Simulator Tab ─────────────────────────────────────────────────────
function SimulatorTab({ m, flocks, ar, lang }: { m: FinMetrics; flocks: Flock[]; ar: boolean; lang: string }) {
  const [feedΔ,  setFeedΔ]  = useState(0);   // % change in feed cost
  const [salesΔ, setSalesΔ] = useState(0);   // % change in revenue
  const [birdsΔ, setBirdsΔ] = useState(0);   // % change in bird count
  const [laborΔ, setLaborΔ] = useState(0);   // % change in labor cost

  const sim = useMemo(() => {
    const newFeedCost   = m.feedCostRaw  * (1 + feedΔ/100);
    const newLaborCost  = m.laborCostRaw * (1 + laborΔ/100);
    const costDelta     = (newFeedCost - m.feedCostRaw) + (newLaborCost - m.laborCostRaw);
    const newExpense    = Math.max(0, m.totalExpense + costDelta);
    const newIncome     = Math.max(0, m.totalIncome * (1 + salesΔ/100));
    const newProfit     = newIncome - newExpense;
    const newMargin     = newIncome > 0 ? (newProfit / newIncome) * 100 : null;
    const newROI        = newExpense > 0 ? (newProfit / newExpense) * 100 : null;
    const totalBirds    = flocks.reduce((s,f) => s + f.count, 0);
    const newBirds      = Math.round(totalBirds * (1 + birdsΔ/100));
    const newCPB        = newBirds > 0 ? newExpense / newBirds : null;
    return { newIncome, newExpense, newProfit, newMargin, newROI, newBirds, newCPB };
  }, [m, feedΔ, salesΔ, birdsΔ, laborΔ, flocks]);

  const SliderRow = ({ label, value, onChange, color, infoText }: {
    label: string; value: number; onChange: (v: number) => void; color: string; infoText: string;
  }) => (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <p className="text-xs font-semibold">{label}</p>
          <p className="text-[9px] text-muted-foreground">{infoText}</p>
        </div>
        <span className={cn("text-sm font-black", value > 0 ? "text-emerald-600" : value < 0 ? "text-red-600" : "text-muted-foreground")}>
          {value > 0 ? "+" : ""}{value}%
        </span>
      </div>
      <input type="range" min="-50" max="100" step="5" value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={cn("w-full h-2 rounded-full appearance-none cursor-pointer", color)} />
      <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5">
        <span>−50%</span><span>0</span><span>+100%</span>
      </div>
    </div>
  );

  const CompRow = ({ label, current, simulated, isGoodUp, ar }: { label: string; current: number|null; simulated: number|null; isGoodUp: boolean; ar: boolean }) => {
    const delta = (current !== null && simulated !== null) ? simulated - current : null;
    const better = delta !== null && (isGoodUp ? delta > 0 : delta < 0);
    const worse  = delta !== null && (isGoodUp ? delta < 0 : delta > 0);
    return (
      <div className="flex items-center justify-between py-2 border-b border-border/30 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{current !== null ? (current > 1000 ? fmtAmount(current, lang as any) : `${current.toFixed(1)}%`) : "—"}</span>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <span className={cn("font-bold", better ? "text-emerald-600" : worse ? "text-red-600" : "")}>
            {simulated !== null ? (simulated > 1000 ? fmtAmount(simulated, lang as any) : `${simulated.toFixed(1)}%`) : "—"}
          </span>
          {delta !== null && (
            <span className={cn("text-[9px] font-bold", better ? "text-emerald-500" : worse ? "text-red-500" : "text-muted-foreground")}>
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "─"}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 p-5 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <FlaskConical className="w-5 h-5 text-indigo-200" />
          <h2 className="text-sm font-black">{ar ? "محاكاة السيناريوهات المالية" : "Finansiell scenariosimulering"}</h2>
        </div>
        <p className="text-[10px] text-indigo-200">
          {ar ? "حرّك الأشرطة لمحاكاة تغيير أسعار العلف والمبيعات وعدد الطيور — وشاهد التأثير الفوري على كل المؤشرات" : "Dra reglagen för att simulera förändringar och se omedelbar påverkan"}
        </p>
      </div>

      {/* Sliders */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2"><Sliders className="w-4 h-4 text-purple-500" />{ar ? "متغيرات المحاكاة" : "Simuleringsvariabler"}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <SliderRow
            label={ar ? "تغيير في أسعار المبيعات" : "Förändring i försäljningspriser"}
            value={salesΔ} onChange={setSalesΔ} color="accent-emerald-500"
            infoText={ar ? "ماذا لو ارتفع / انخفض الدخل بهذه النسبة؟" : "Vad händer om inkomst ökar/minskar?"}
          />
          <SliderRow
            label={ar ? "تغيير في سعر العلف" : "Förändring i foderpris"}
            value={feedΔ} onChange={setFeedΔ} color="accent-amber-500"
            infoText={ar ? "ماذا لو ارتفع / انخفض سعر العلف؟" : "Vad händer om foderpriset ökar/minskar?"}
          />
          <SliderRow
            label={ar ? "تغيير في تكاليف العمالة" : "Förändring i arbetskostnader"}
            value={laborΔ} onChange={setLaborΔ} color="accent-blue-500"
            infoText={ar ? "ماذا لو تغيرت رواتب العمال؟" : "Vad händer om lönerna förändras?"}
          />
          <SliderRow
            label={ar ? "تغيير في عدد الطيور" : "Förändring i antal fåglar"}
            value={birdsΔ} onChange={setBirdsΔ} color="accent-rose-500"
            infoText={ar ? "ماذا لو زدنا / قللنا عدد القطيع؟" : "Vad händer om flockstorleken förändras?"}
          />
          <Button variant="outline" onClick={() => { setFeedΔ(0); setSalesΔ(0); setBirdsΔ(0); setLaborΔ(0); }} className="w-full h-8 text-xs">
            {ar ? "إعادة تعيين" : "Återställ"}
          </Button>
        </CardContent>
      </Card>

      {/* Results comparison */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-indigo-500" />
            {ar ? "المقارنة: الحالي ← المحاكاة" : "Jämförelse: Nuvarande ← Simulering"}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <CompRow label={ar ? "إجمالي الدخل" : "Total intäkt"} current={m.totalIncome} simulated={sim.newIncome} isGoodUp ar={ar} />
          <CompRow label={ar ? "إجمالي المصاريف" : "Totala kostnader"} current={m.totalExpense} simulated={sim.newExpense} isGoodUp={false} ar={ar} />
          <CompRow label={ar ? "صافي الربح" : "Nettovinst"} current={m.netProfit} simulated={sim.newProfit} isGoodUp ar={ar} />
          <CompRow label={ar ? "هامش الربح %" : "Vinstmarginal %"} current={m.profitMargin} simulated={sim.newMargin} isGoodUp ar={ar} />
          <CompRow label={ar ? "العائد ROI %" : "ROI %"} current={m.roi} simulated={sim.newROI} isGoodUp ar={ar} />
          <CompRow label={ar ? "تكلفة/طير" : "Kostnad/fågel"} current={m.costPerBird} simulated={sim.newCPB} isGoodUp={false} ar={ar} />
        </CardContent>
      </Card>

      {/* Sensitivity Matrix */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sigma className="w-4 h-4 text-rose-500" />
            {ar ? "مصفوفة الحساسية — تأثير كل متغير على الربح" : "Känslighetsmatris — påverkan på vinst"}
            <InfoTip metricKey="profit_margin" ar={ar} />
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-start py-2 px-2 text-muted-foreground">{ar ? "التغيير" : "Förändring"}</th>
                  {[-20,-10,0,+10,+20].map(p => (
                    <th key={p} className={cn("text-center py-2 px-1 font-bold", p > 0 ? "text-emerald-600" : p < 0 ? "text-red-600" : "text-muted-foreground")}>{p > 0 ? `+${p}` : p}%</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: ar ? "المبيعات" : "Försäljning",  fn: (p: number) => (m.totalIncome*(1+p/100)) - m.totalExpense },
                  { label: ar ? "سعر العلف" : "Foderpris",   fn: (p: number) => m.totalIncome - (m.totalExpense + m.feedCostRaw*p/100) },
                  { label: ar ? "العمالة"   : "Arbetskraft", fn: (p: number) => m.totalIncome - (m.totalExpense + m.laborCostRaw*p/100) },
                ].map(row => (
                  <tr key={row.label} className="border-b border-border/20 hover:bg-muted/20">
                    <td className="py-2 px-2 font-semibold">{row.label}</td>
                    {[-20,-10,0,+10,+20].map(p => {
                      const profit = row.fn(p);
                      const bg = profit > m.netProfit*1.05 ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700" :
                                 profit < m.netProfit*0.95 ? "bg-red-50 dark:bg-red-950/20 text-red-700"     :
                                 "bg-muted/30 text-muted-foreground";
                      return <td key={p} className={cn("text-center py-2 px-1 rounded font-bold", bg)}>{fmtAmount(Math.abs(profit), "ar").replace(/ د\.ع/,"")}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[9px] text-muted-foreground mt-2">{ar ? "* القيم بالدينار العراقي · الأخضر = أفضل من الحالي · الأحمر = أسوأ" : "* Värden i IQD · Grön = bättre · Röd = sämre"}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN FINANCE PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function Finance() {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const ar = lang === "ar";
  const isAdmin = user?.role === "admin";
  const qc = useQueryClient();

  const [period,     setPeriod]     = useState<Period>("month");
  const [tab,        setTab]        = useState<FinTab>("dashboard");
  const [search,     setSearch]     = useState("");
  const [txFilter,   setTxFilter]   = useState<"all"|"income"|"expense">("all");
  const [deletingId, setDeletingId] = useState<number|null>(null);
  const [drillKey,   setDrillKey]   = useState<string|null>(null);
  const [catFilter,  setCatFilter]  = useState<string|null>(null); // click chart to filter
  const { toast } = useToast();

  // ─── Data ─────────────────────────────────────────────────────────────────
  const OPTS = { refetchInterval: 30_000, staleTime: 20_000 };
  const { data: allTxs = [], isFetching } = useQuery<Tx[]>({ queryKey:["transactions"], queryFn:() => apiFetch("/api/transactions"), ...OPTS });
  const { data: flocks = [] }             = useQuery<Flock[]>({ queryKey:["flocks"],       queryFn:() => apiFetch("/api/flocks"),       ...OPTS });
  const refetch = () => { qc.invalidateQueries({ queryKey:["transactions"] }); qc.invalidateQueries({ queryKey:["flocks"] }); };

  // ─── Period filter ─────────────────────────────────────────────────────────
  const periodTxs = useMemo(() => {
    const range = getPeriodRange(period);
    if (!range) return allTxs;
    return allTxs.filter(t => t.date >= range.start && t.date <= range.end);
  }, [allTxs, period]);

  // ─── Core computations ────────────────────────────────────────────────────
  const m       = useMemo(() => computeMetrics(periodTxs, flocks, period), [periodTxs, flocks, period]);
  const monthly = useMemo(() => computeMonthly(allTxs), [allTxs]);
  const adv     = useMemo(() => computeAdvanced(allTxs, monthly), [allTxs, monthly]);
  const feed    = useMemo(() => computeFeedMetrics(allTxs, flocks, periodTxs, getPeriodDays(period)), [allTxs, flocks, periodTxs, period]);
  const alerts  = useMemo(() => detectAlerts(m, periodTxs.length), [m, periodTxs.length]);

  // ─── Filtered transactions ─────────────────────────────────────────────────
  const filteredTxs = useMemo(() => {
    let txs = periodTxs;
    if (txFilter !== "all") txs = txs.filter(t => t.type === txFilter);
    if (catFilter)          txs = txs.filter(t => t.category === catFilter);
    if (search) { const q = search.toLowerCase(); txs = txs.filter(t => t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.amount.includes(q)); }
    return txs;
  }, [periodTxs, txFilter, catFilter, search]);

  // ─── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    if (!confirm(ar ? "هل تريد حذف هذه المعاملة؟" : "Vill du ta bort?")) return;
    setDeletingId(id);
    try { await apiFetch(`/api/transactions/${id}`, { method:"DELETE" }); toast({ title: ar ? "تم الحذف" : "Borttagen" }); refetch(); }
    catch (e: any) { toast({ variant:"destructive", title: e.message }); }
    finally { setDeletingId(null); }
  };

  // ─── Tabs / periods config ─────────────────────────────────────────────────
  const PERIODS: { id: Period; ar: string; sv: string }[] = [
    { id:"week",    ar:"أسبوع",  sv:"Vecka"   }, { id:"month",   ar:"شهر",    sv:"Månad"   },
    { id:"quarter", ar:"ربع سنة",sv:"Kvartal" }, { id:"year",    ar:"سنة",    sv:"År"      },
    { id:"all",     ar:"الكل",   sv:"Allt"    },
  ];
  const TABS: { id: FinTab; ar: string; sv: string; icon: any }[] = [
    { id:"dashboard",    ar:"القيادة",   sv:"Dashboard",  icon:BarChart2        },
    { id:"add",          ar:"إضافة",     sv:"Lägg till",  icon:Plus             },
    { id:"analysis",     ar:"التحليل",   sv:"Analys",     icon:Zap              },
    { id:"simulator",    ar:"محاكاة",    sv:"Simulator",  icon:FlaskConical     },
    { id:"transactions", ar:"المعاملات", sv:"Transakter", icon:Receipt          },
    { id:"statement",    ar:"التقارير",  sv:"Rapporter",  icon:FileText         },
  ];

  // ─── Drill-down content per metric ────────────────────────────────────────
  const drillContent = useMemo(() => {
    if (!drillKey) return null;
    const info = GLOSSARY[drillKey];
    if (!info) return null;
    return (
      <div className="space-y-4 pt-1">
        <div className={cn("rounded-xl p-3 font-mono text-[11px]", "bg-muted/40 text-muted-foreground leading-relaxed")}>
          📐 {info.formulaAr}
        </div>
        <p className="text-xs text-foreground leading-relaxed">{ar ? info.descAr : info.descSv}</p>
        <div className="rounded-xl border border-border/40 p-3.5 space-y-1.5">
          <p className="text-[10px] font-bold text-muted-foreground">{ar ? "المعايير الصناعية" : "Branschnormer"}</p>
          <p className="text-[10px] text-foreground">{ar ? info.benchmarkAr : info.benchmarkSv}</p>
        </div>
        {/* Actual value */}
        {drillKey === "roi"           && m.roi !== null           && <div className="text-center py-2"><p className="text-[10px] text-muted-foreground">{ar?"القيمة الحالية":"Nuvarande värde"}</p><p className={cn("text-3xl font-black", info.colorClass)}>{m.roi.toFixed(1)}%</p></div>}
        {drillKey === "profit_margin" && m.profitMargin !== null   && <div className="text-center py-2"><p className="text-[10px] text-muted-foreground">{ar?"القيمة الحالية":"Nuvarande värde"}</p><p className={cn("text-3xl font-black", info.colorClass)}>{m.profitMargin.toFixed(1)}%</p></div>}
        {drillKey === "oer"           && m.oer !== null             && <div className="text-center py-2"><p className="text-[10px] text-muted-foreground">{ar?"القيمة الحالية":"Nuvarande värde"}</p><p className={cn("text-3xl font-black", info.colorClass)}>{m.oer.toFixed(1)}%</p></div>}
        {drillKey === "hhi" && (
          <div className="text-center py-2">
            <p className="text-[10px] text-muted-foreground">{ar?"مؤشر HHI الحالي":"Nuvarande HHI"}</p>
            <p className={cn("text-3xl font-black", info.colorClass)}>{Math.round(adv.hhi).toLocaleString()}</p>
            <Badge className="mt-1">{adv.hhiGrade === "diverse" ? (ar?"متنوع✅":"Diversifierat✅") : adv.hhiGrade === "moderate" ? (ar?"متوسط⚠️":"Måttligt⚠️") : (ar?"مركز❌":"Koncentrerat❌")}</Badge>
          </div>
        )}
        {drillKey === "z_score" && adv.monthZScores.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground">{ar?"أشهر استثنائية":"Exceptionella månader"}</p>
            {adv.monthZScores.filter(m => m.anomaly).map(m => (
              <div key={m.month} className="flex items-center justify-between text-xs rounded-lg bg-rose-50 dark:bg-rose-950/20 px-3 py-1.5">
                <span>{ar ? m.monthAr : m.month}</span>
                <span className="font-bold text-rose-600">Z = {m.z.toFixed(2)}</span>
              </div>
            ))}
            {!adv.monthZScores.some(m => m.anomaly) && <p className="text-[11px] text-muted-foreground">{ar?"لا توجد أشهر استثنائية — أداء مستقر":"Inga exceptionella månader — stabil prestanda"}</p>}
          </div>
        )}
        {drillKey === "ema_trend" && (
          <div className="grid grid-cols-3 gap-2 text-center">
            {[{ l: ar?"دخل EMA":"Intäkt EMA", v: adv.emaIncome, c:"text-emerald-600" }, { l: ar?"مصاريف EMA":"Kostnad EMA", v: adv.emaExpense, c:"text-red-600" }, { l: ar?"ربح EMA":"Vinst EMA", v: adv.emaProfit, c:"text-blue-600" }].map(x => (
              <div key={x.l} className="rounded-xl bg-muted/40 p-2.5">
                <p className="text-[9px] text-muted-foreground">{x.l}</p>
                <p className={cn("text-xs font-black", x.c)}>{fmtAmount(x.v, lang as any)}</p>
              </div>
            ))}
          </div>
        )}
        {drillKey === "cash_runway" && adv.cashRunway !== null && (
          <div className="text-center py-2">
            <p className="text-[10px] text-muted-foreground">{ar?"مدة الاستمرارية":"Kassabana"}</p>
            <p className={cn("text-3xl font-black", info.colorClass)}>{Math.round(adv.cashRunway)} {ar?"يوم":"dagar"}</p>
            <p className="text-[9px] text-muted-foreground mt-1">{ar?"بناءً على معدل الإيراد والإنفاق الشهري الأخير":"Baserat på senaste månads inkomst- och utgiftstakt"}</p>
          </div>
        )}
      </div>
    );
  }, [drillKey, m, adv, ar, lang]);

  const totalBirds = flocks.reduce((s,f) => s+f.count, 0);
  const gradeColor = { excellent:"text-emerald-600", good:"text-blue-600", fair:"text-amber-600", poor:"text-red-600" }[m.healthGrade];

  // ── fmtKg helper ──────────────────────────────────────────────────────────
  const fmtKg = (kg: number) => kg >= 1000 ? `${(kg/1000).toFixed(2)} ${ar?"طن":"ton"}` : `${kg.toFixed(1)} ${ar?"كغ":"kg"}`;

  return (
    <div className="min-h-screen bg-background pb-24" dir={ar ? "rtl" : "ltr"}>

      {/* ══ Sticky Header ═════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/40">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-base font-black flex items-center gap-2">
                <Brain className="w-4.5 h-4.5 text-purple-500" />
                {ar ? "المالية والإنتاج — الذكاء المتكامل" : "Ekonomi & Produktion — Integrerad intelligens"}
              </h1>
              <p className="text-[10px] text-muted-foreground">EMA · Z-Score · HHI · Simulation · اضغط أي رقم لفهمه</p>
            </div>
            <LiveBadge fetching={isFetching} />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-hide">
            {PERIODS.map(p => (
              <button key={p.id} onClick={() => setPeriod(p.id)} className={cn("shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all", period === p.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted")}>
                {ar ? p.ar : p.sv}
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-border/40">
          <div className="max-w-2xl mx-auto flex overflow-x-auto scrollbar-hide">
            {TABS.map(t => { const Icon = t.icon; return (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex-1 shrink-0 flex flex-col items-center gap-0.5 py-2.5 px-2 text-[10px] font-semibold transition-all",
                tab === t.id ? "text-primary border-b-2 border-primary" : "text-muted-foreground border-b-2 border-transparent")}>
                <Icon className="w-3.5 h-3.5" />{ar ? t.ar : t.sv}
              </button>
            ); })}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">

        {/* ══ KPI Strip ═════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <KpiTile label={ar?"إجمالي الدخل":"Total intäkt"} value={fmtAmount(m.totalIncome, lang as any)}
            sub={`${m.incByCat.length} ${ar?"مصدر":"källor"}`} icon={ArrowUpCircle} color="bg-emerald-500"
            trend={m.totalIncome > 0 ? "up" : null} ar={ar} onClick={() => setTab("transactions")} />
          <KpiTile label={ar?"إجمالي المصاريف":"Totala kostnader"} value={fmtAmount(m.totalExpense, lang as any)}
            sub={`${m.expByCat.length} ${ar?"بند":"poster"}`} icon={ArrowDownCircle} color="bg-red-500"
            trend={m.totalExpense > m.totalIncome ? "down" : null} ar={ar} onClick={() => setTab("transactions")} />
          <KpiTile label={ar?"صافي الربح":"Nettovinst"} value={(m.netProfit>=0?"+":"")+fmtAmount(Math.abs(m.netProfit), lang as any)}
            sub={m.profitMargin !== null ? `${m.profitMargin.toFixed(1)}% ${ar?"هامش":"marginal"}` : undefined}
            icon={m.netProfit >= 0 ? TrendingUp : TrendingDown} color={m.netProfit >= 0 ? "bg-blue-500" : "bg-orange-500"}
            trend={m.netProfit >= 0 ? "up" : "down"} infoKey="profit_margin" ar={ar}
            onClick={() => setDrillKey("profit_margin")} />
          <KpiTile label={ar?"العائد ROI":"ROI"} value={m.roi !== null ? `${m.roi.toFixed(1)}%` : "—"}
            sub={m.costPerBird !== null ? `${fmtAmount(m.costPerBird, lang as any)}/${ar?"طير":"fågel"}` : undefined}
            icon={Target} color="bg-purple-500"
            trend={m.roi !== null && m.roi > 0 ? "up" : m.roi !== null ? "down" : null}
            infoKey="roi" ar={ar} onClick={() => setDrillKey("roi")} />
        </div>

        {/* ── Alerts ── */}
        <AlertBanner alerts={alerts.filter(a => a.severity !== "info")} ar={ar} />

        {/* ══════════════════════════════════════════════════════════════════
            TAB: DASHBOARD
           ══════════════════════════════════════════════════════════════════ */}
        {tab === "dashboard" && (
          <div className="space-y-5">

            {/* Advanced KPI strip */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: ar?"معدل البيانات EMA":"EMA-inkomst", val: adv.emaIncome > 0 ? fmtAmount(adv.emaIncome, lang as any) : "—", sub: ar?"متوسط أسي للدخل":"Exp. rörligt medel", key:"ema_trend", color:"text-indigo-600", bg:"bg-indigo-50 dark:bg-indigo-950/20" },
                { label: ar?"مدة الاستمرارية":"Kassabana", val: adv.cashRunway !== null ? `${Math.round(adv.cashRunway)} ${ar?"يوم":"d"}` : "—", sub: ar?"بالمعدل الحالي":"Vid nuv. takt", key:"cash_runway", color:"text-cyan-600", bg:"bg-cyan-50 dark:bg-cyan-950/20" },
                { label: ar?"زخم الربح":"Vinstmomentum", val: adv.profitVelocity !== null ? fmtPct(adv.profitVelocity) : "—", sub: ar?"vs الشهر السابق":"vs förra månaden", key:"profit_velocity", color: adv.profitVelocity !== null && adv.profitVelocity > 0 ? "text-emerald-600" : "text-red-600", bg: adv.profitVelocity !== null && adv.profitVelocity > 0 ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-red-50 dark:bg-red-950/20" },
              ].map(k => (
                <button key={k.key} onClick={() => setDrillKey(k.key)}
                  className={cn("rounded-2xl border border-border/40 p-3 text-start hover:shadow-md transition-all active:scale-[0.97]", k.bg)}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[9px] text-muted-foreground leading-tight">{k.label}</p>
                    <InfoTip metricKey={k.key} ar={ar} />
                  </div>
                  <p className={cn("text-sm font-black", k.color)}>{k.val}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{k.sub}</p>
                  <p className="text-[8px] text-muted-foreground/50 mt-0.5 flex items-center gap-0.5"><Eye className="w-2 h-2" />{ar?"اضغط للشرح":"Tryck för info"}</p>
                </button>
              ))}
            </div>

            {/* Monthly chart — click bar to filter transactions */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  {ar ? "المقارنة الشهرية" : "Månadsöversikt"}
                  <span className="text-[9px] text-muted-foreground ms-auto">{ar?"اضغط على الشريط للتصفية":"Klicka stapeln för att filtrera"}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                {monthly.length < 1 ? (
                  <div className="h-40 flex items-center justify-center"><p className="text-xs text-muted-foreground">{ar?"لا توجد بيانات":"Otillräckliga data"}</p></div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={monthly} margin={{ top:5, right:5, bottom:0, left:-15 }}
                      onClick={e => { if (e?.activeLabel) { setTab("transactions"); } }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey={ar?"monthAr":"month"} tick={{ fontSize:9 }} />
                      <YAxis tick={{ fontSize:9 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTip ar={ar} />} />
                      <Bar dataKey="income"  name={ar?"دخل":"Inkomst"}    fill="#10b981" radius={[3,3,0,0]} opacity={0.85} />
                      <Bar dataKey="expense" name={ar?"مصاريف":"Kostnader"} fill="#ef4444" radius={[3,3,0,0]} opacity={0.85} />
                      <Line dataKey="profit" name={ar?"ربح":"Vinst"} stroke="#3b82f6" strokeWidth={2} dot={{ r:3, fill:"#3b82f6" }} type="monotone" />
                      {adv.movingAvg.length > 0 && (
                        <Line data={[...Array(monthly.length - adv.movingAvg.length).fill(null), ...adv.movingAvg]}
                          dataKey="ma" name={ar?"متوسط 3أشهر":"3mån MA"} stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="4 2" dot={false} type="monotone" />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Z-Score chart */}
            {adv.monthZScores.length >= 2 && (
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sigma className="w-4 h-4 text-rose-500" />
                    {ar ? "كشف الشذوذات (Z-Score)" : "Avvikelsedetektering (Z-Score)"}
                    <InfoTip metricKey="z_score" ar={ar} />
                    <button onClick={() => setDrillKey("z_score")} className="ms-auto text-[9px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                      <Eye className="w-2.5 h-2.5" />{ar?"تفاصيل":"Detaljer"}
                    </button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-4">
                  <ResponsiveContainer width="100%" height={110}>
                    <BarChart data={adv.monthZScores} margin={{ top:5, right:5, bottom:0, left:-28 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey={ar?"monthAr":"month"} tick={{ fontSize:8 }} />
                      <YAxis tick={{ fontSize:8 }} />
                      <Tooltip formatter={(v: any) => [Number(v).toFixed(2), "Z"]} />
                      <ReferenceLine y={1.8}  stroke="#f59e0b" strokeDasharray="3 3" label={{ value:"+1.8", fontSize:8, fill:"#f59e0b" }} />
                      <ReferenceLine y={-1.8} stroke="#f59e0b" strokeDasharray="3 3" />
                      <ReferenceLine y={0}    stroke="#94a3b8" strokeWidth={0.5} />
                      <Bar dataKey="z" name="Z" radius={[2,2,0,0]} fill="#8b5cf6"
                        label={false}
                        // @ts-ignore
                        cell={adv.monthZScores.map(e => e.anomaly ? "#ef4444" : "#8b5cf6")} />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-[9px] text-muted-foreground text-center mt-1">{ar?"الأشرطة الحمراء = شهر استثنائي إحصائياً (|Z|>1.8)":"Röda staplar = statistiskt exceptionell månad"}</p>
                </CardContent>
              </Card>
            )}

            {/* Donut row — click to filter */}
            {(m.expByCat.length > 0 || m.incByCat.length > 0) && (
              <div className="grid grid-cols-2 gap-3">
                {m.expByCat.length > 0 && (
                  <Card className="border-none shadow-sm">
                    <CardHeader className="pb-1 pt-3 px-3">
                      <CardTitle className="text-[11px] flex items-center gap-1.5 text-red-600">
                        <ArrowDownCircle className="w-3.5 h-3.5" />{ar?"توزيع المصاريف":"Kostnadsfördelning"}
                      </CardTitle>
                      <p className="text-[8px] text-muted-foreground">{ar?"اضغط على الفئة للتصفية":"Klicka för att filtrera"}</p>
                    </CardHeader>
                    <CardContent className="px-2 pb-3">
                      <ResponsiveContainer width="100%" height={120}>
                        <PieChart onClick={e => { if (e?.activePayload?.[0]) { const id = e.activePayload[0].payload.id; setCatFilter(catFilter === id ? null : id); setTab("transactions"); } }}>
                          <Pie data={m.expByCat.map(e => ({ ...e, name: ar ? catMeta(e.id).ar : catMeta(e.id).sv }))}
                            cx="50%" cy="50%" innerRadius={28} outerRadius={50} dataKey="value" paddingAngle={2}>
                            {m.expByCat.map((e, i) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} stroke={catFilter===e.id?"#1e293b":"none"} strokeWidth={catFilter===e.id?2:0} />)}
                          </Pie>
                          <Tooltip formatter={(v:any) => fmtAmount(v, lang as any)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-0.5 mt-1">
                        {m.expByCat.slice(0,4).map((e,i) => (
                          <button key={e.id} onClick={() => { setCatFilter(catFilter===e.id?null:e.id); setTab("transactions"); }}
                            className={cn("w-full flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors", catFilter===e.id?"bg-muted":"hover:bg-muted/50")}>
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i%PIE_COLORS.length] }} />
                            <span className="text-[9px] text-muted-foreground truncate flex-1 text-start">{ar?catMeta(e.id).ar:catMeta(e.id).sv}</span>
                            <span className="text-[9px] font-bold">{e.pct.toFixed(0)}%</span>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {m.incByCat.length > 0 && (
                  <Card className="border-none shadow-sm">
                    <CardHeader className="pb-1 pt-3 px-3">
                      <CardTitle className="text-[11px] flex items-center gap-1.5 text-emerald-600">
                        <ArrowUpCircle className="w-3.5 h-3.5" />{ar?"مصادر الدخل":"Inkomstkällor"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-2 pb-3">
                      <ResponsiveContainer width="100%" height={120}>
                        <PieChart>
                          <Pie data={m.incByCat.map(e => ({ ...e, name: ar?catMeta(e.id).ar:catMeta(e.id).sv }))}
                            cx="50%" cy="50%" innerRadius={28} outerRadius={50} dataKey="value" paddingAngle={2}>
                            {m.incByCat.map((_,i) => <Cell key={i} fill={INC_COLORS[i%INC_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v:any) => fmtAmount(v, lang as any)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-0.5 mt-1">
                        {m.incByCat.slice(0,4).map((e,i) => (
                          <div key={e.id} className="flex items-center gap-1.5 px-1 py-0.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: INC_COLORS[i%INC_COLORS.length] }} />
                            <span className="text-[9px] text-muted-foreground truncate flex-1">{ar?catMeta(e.id).ar:catMeta(e.id).sv}</span>
                            <span className="text-[9px] font-bold">{e.pct.toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* HHI + Prediction */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDrillKey("hhi")}
                className={cn("rounded-2xl border border-border/40 p-3.5 text-start hover:shadow-md transition-all active:scale-[0.97]",
                  adv.hhiGrade === "diverse" ? "bg-emerald-50 dark:bg-emerald-950/20" : adv.hhiGrade === "moderate" ? "bg-amber-50 dark:bg-amber-950/20" : "bg-red-50 dark:bg-red-950/20")}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] text-muted-foreground">HHI {ar?"تركيز المصاريف":"Kostnadskoncentration"}</p>
                  <InfoTip metricKey="hhi" ar={ar} />
                </div>
                <p className="text-lg font-black">{Math.round(adv.hhi).toLocaleString()}</p>
                <Badge className="text-[8px] mt-1" variant="outline">{adv.hhiGrade === "diverse" ? (ar?"متنوع✅":"Diversifierat✅") : adv.hhiGrade === "moderate" ? (ar?"متوسط⚠️":"Måttligt⚠️") : (ar?"مركز❌":"Koncentrerat❌")}</Badge>
                <p className="text-[8px] text-muted-foreground/50 mt-1 flex items-center gap-0.5"><Eye className="w-2 h-2" />{ar?"اضغط للشرح":"Tryck för info"}</p>
              </button>
              {adv.pred && (
                <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-3.5 text-white">
                  <p className="text-[9px] text-slate-400 mb-2 flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-400" />{ar?"توقع الشهر القادم (انحدار خطي)":"Prognos nästa månad"}</p>
                  <div className="space-y-1">
                    {[{ l: ar?"دخل":"Intäkt", v: adv.pred.income, c:"text-emerald-400" }, { l: ar?"مصاريف":"Kostn.", v: adv.pred.expense, c:"text-red-400" }, { l: ar?"ربح":"Vinst", v: adv.pred.profit, c: adv.pred.profit>=0?"text-blue-400":"text-orange-400" }].map(x => (
                      <div key={x.l} className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">{x.l}</span>
                        <span className={cn("font-black", x.c)}>{fmtAmount(x.v, lang as any)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Expense Heatmap */}
            {adv.heatmap.length > 0 && monthly.length >= 2 && (
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-500" />
                    {ar ? "خريطة حرارة المصاريف (فئة × شهر)" : "Kostnadsvärmekartan (kategori × månad)"}
                    <span className="text-[9px] text-muted-foreground ms-auto">{ar?"الأحمر=أعلى إنفاق":"Röd=högst"}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-4 overflow-x-auto">
                  {(() => {
                    const months = monthly.slice(-6).map(m => ({ key: m.month, label: ar ? m.monthAr : m.month }));
                    const maxVal = Math.max(...adv.heatmap.flatMap(r => Object.values(r.months)));
                    return (
                      <table className="w-full text-[8px] border-collapse">
                        <thead>
                          <tr>
                            <th className="text-start py-1 px-1 text-muted-foreground font-semibold w-20">{ar?"الفئة":"Kategori"}</th>
                            {months.map(m => <th key={m.key} className="py-1 px-0.5 text-center text-muted-foreground">{m.label}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {adv.heatmap.filter(r => Object.values(r.months).some(v => v > 0)).map(row => (
                            <tr key={row.cat} className="hover:bg-muted/20">
                              <td className="py-0.5 px-1 font-medium text-[8px] truncate max-w-[70px]">
                                {catMeta(row.cat).icon} {ar ? catMeta(row.cat).ar : catMeta(row.cat).sv}
                              </td>
                              {months.map(m => {
                                const val = row.months[m.key] ?? 0;
                                const intensity = maxVal > 0 ? val / maxVal : 0;
                                return (
                                  <td key={m.key} className="py-0.5 px-0.5">
                                    <div
                                      title={val > 0 ? fmtAmount(val) : "—"}
                                      className="rounded h-5 flex items-center justify-center text-[7px] font-bold cursor-help transition-all hover:scale-110"
                                      style={{
                                        background: val > 0 ? `rgba(239,68,68,${Math.max(0.08, intensity * 0.85)})` : "transparent",
                                        color: intensity > 0.6 ? "#991b1b" : intensity > 0.2 ? "#b91c1c" : "#cbd5e1",
                                      }}>
                                      {val > 0 ? `${(val/1000).toFixed(0)}k` : "·"}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Daily rates */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-border/40 p-3.5">
                <p className="text-[10px] text-muted-foreground">{ar?"معدل الإنفاق اليومي":"Daglig utgiftstakt"}</p>
                <p className="text-sm font-black text-red-600 mt-1">{fmtAmount(m.dailyBurnRate, lang as any)}</p>
                <p className="text-[9px] text-muted-foreground">{ar?"/ يوم":"/ dag"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-border/40 p-3.5">
                <p className="text-[10px] text-muted-foreground">{ar?"ثبات الدخل (CV)":"Inkomsttabilitet (CV)"}</p>
                <p className="text-sm font-black text-blue-600 mt-1">{adv.incomeCV !== null ? `${adv.incomeCV.toFixed(1)}%` : "—"}</p>
                <p className="text-[9px] text-muted-foreground">{ar?"أقل = أكثر استقراراً":"Lägre = mer stabilt"}</p>
              </div>
            </div>
          </div>
        )}

        {/* ══ TAB: ADD ══════════════════════════════════════════════════════════ */}
        {tab === "add" && (
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2"><Plus className="w-4 h-4 text-emerald-500" />{ar?"تسجيل معاملة جديدة":"Registrera ny transaktion"}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-5"><AddTransactionForm ar={ar} onSuccess={refetch} /></CardContent>
          </Card>
        )}

        {/* ══ TAB: ANALYSIS ═════════════════════════════════════════════════════ */}
        {tab === "analysis" && (
          <div className="space-y-5">

            {/* Health gauge */}
            <Card className="border-none shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-500" />
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex items-center gap-4">
                  <HealthGauge score={m.healthScore} grade={m.healthGrade} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{ar?"درجة الصحة المالية":"Finansiellt hälsopoäng"}</p>
                    <p className={cn("text-lg font-black", gradeColor)}>{{ excellent: ar?"ممتاز 🌟":"Utmärkt 🌟", good: ar?"جيد ✅":"Bra ✅", fair: ar?"مقبول ⚠️":"Acceptabelt ⚠️", poor: ar?"ضعيف ❌":"Svag ❌" }[m.healthGrade]}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {m.profitMargin !== null ? `${ar?"هامش":"Marginal"}: ${m.profitMargin.toFixed(1)}% · OER: ${m.oer?.toFixed(0)??"—"}%` : ar?"أضف بيانات للتقييم":"Lägg till data"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Per-bird */}
            {flocks.length > 0 && (
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bird className="w-4 h-4 text-amber-500" />
                    {ar?"اقتصاديات الطير الواحد":"Per-fågelekonomik"}
                    <InfoTip metricKey="cost_per_bird" ar={ar} />
                    <Badge variant="outline" className="text-[9px] ms-auto">{totalBirds.toLocaleString()} {ar?"طير":"fåglar"}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[
                      { label: ar?"التكلفة / طير":"Kostnad / fågel",    value: m.costPerBird,           color:"text-red-600",     bg:"bg-red-50 dark:bg-red-950/20",     key:"cost_per_bird" },
                      { label: ar?"الإيراد / طير":"Intäkt / fågel",     value: m.revenuePerBird,        color:"text-emerald-600", bg:"bg-emerald-50 dark:bg-emerald-950/20", key: null },
                      { label: ar?"الربح / طير":"Vinst / fågel",         value: m.profitPerBird,         color: m.profitPerBird !== null && m.profitPerBird >= 0 ? "text-blue-600":"text-orange-600", bg:"bg-blue-50 dark:bg-blue-950/20", key:"profit_margin" },
                      { label: ar?"سعر التعادل":"Break-even/fågel",     value: m.breakEvenPricePerBird, color:"text-purple-600",  bg:"bg-purple-50 dark:bg-purple-950/20", key: null },
                    ].map(({ label, value, color, bg, key }) => (
                      <button key={label} onClick={() => key && setDrillKey(key)}
                        className={cn("rounded-xl p-3 text-start transition-all", bg, key && "hover:shadow-sm active:scale-[0.97]")}>
                        <div className="flex items-center gap-1 mb-0.5">
                          <p className="text-[9px] text-muted-foreground">{label}</p>
                          {key && <InfoTip metricKey={key} ar={ar} />}
                        </div>
                        <p className={cn("text-sm font-black", color)}>{value !== null ? fmtAmount(value, lang as any) : "—"}</p>
                        {key && <p className="text-[8px] text-muted-foreground/50 mt-0.5 flex items-center gap-0.5"><Eye className="w-2 h-2" />{ar?"اضغط للشرح":"Tryck"}</p>}
                      </button>
                    ))}
                  </div>
                  {m.costPerBird !== null && (
                    <div className="border-t border-border/40 pt-3 space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground">{ar?"التوزيع على القطعان":"Fördelning per flock"}</p>
                      {flocks.map(f => {
                        const share = f.count / Math.max(1, totalBirds);
                        return (
                          <div key={f.id} className="flex items-center gap-2">
                            <span className="text-lg shrink-0">🐔</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-semibold truncate">{f.name}</p>
                              <div className="flex items-center gap-1.5">
                                <div className="h-1.5 flex-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-400 rounded-full" style={{ width:`${share*100}%` }} />
                                </div>
                                <span className="text-[9px] text-muted-foreground">{(share*100).toFixed(0)}%</span>
                              </div>
                            </div>
                            <div className="text-end shrink-0">
                              <p className="text-[10px] font-bold text-red-600">{fmtAmount(m.totalExpense*share, lang as any)}</p>
                              <p className="text-[9px] text-muted-foreground">{f.count} {ar?"طير":"fåglar"}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Feed analysis */}
            <Card className="border-none shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-500" />
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wheat className="w-4 h-4 text-amber-500" />{ar?"استهلاك وكفاءة العلف":"Foderkonsumtion & effektivitet"}
                  <Badge variant="outline" className="text-[9px] ms-auto">{feed.trackedEntries} {ar?"سجل بوزن":"viktposter"}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {feed.totalFeedCost === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm font-semibold mb-1">{ar?"لا توجد سجلات علف":"Inga foderposter"}</p>
                    <button onClick={() => setTab("add")} className="text-xs text-amber-600 underline">{ar?"← سجّل علفاً الآن":"← Registrera foder"}</button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { l: ar?"إجمالي العلف":"Total foder",      v: feed.totalFeedKg > 0 ? fmtKg(feed.totalFeedKg) : "—",                    s: feed.dailyFeedKg > 0 ? `${fmtKg(feed.dailyFeedKg)}/${ar?"يوم":"dag"}` : ar?"أدخل وزن العلف":"Ange vikt", bg:"bg-amber-50 dark:bg-amber-950/20", c:"text-amber-700" },
                        { l: ar?"تكلفة العلف":"Foderkostnad",       v: fmtAmount(feed.totalFeedCost, lang as any),                              s: feed.feedCostPerKg ? `${fmtAmount(feed.feedCostPerKg, lang as any)}/كغ` : "—",   bg:"bg-red-50 dark:bg-red-950/20",    c:"text-red-700" },
                        { l: ar?"علف/طير":"Foder/fågel",            v: feed.feedPerBirdKg !== null ? fmtKg(feed.feedPerBirdKg) : "—",            s: ar?"معيار: 3.5–5 كغ":"Standard: 3,5–5 kg",                                        bg:"bg-orange-50 dark:bg-orange-950/20",c:"text-orange-700" },
                        { l: ar?"تكلفة علف/طير":"Foderkost/fågel", v: feed.feedCostPerBird !== null ? fmtAmount(feed.feedCostPerBird, lang as any) : "—", s: ar?"من تكلفة العلف الكلية":"Av total foderkostnad",                   bg:"bg-yellow-50 dark:bg-yellow-950/20",c:"text-yellow-700" },
                      ].map(x => (
                        <div key={x.l} className={cn("rounded-xl p-3", x.bg)}>
                          <p className="text-[9px] text-muted-foreground">{x.l}</p>
                          <p className={cn("text-sm font-black mt-0.5", x.c)}>{x.v}</p>
                          <p className="text-[9px] text-muted-foreground">{x.s}</p>
                        </div>
                      ))}
                    </div>
                    {feed.feedPerBirdKg !== null && (() => {
                      const g = { excellent:{ l:ar?"ممتاز🌟":"Utmärkt🌟",c:"text-emerald-600",bg:"bg-emerald-50 dark:bg-emerald-950/20",bar:"#10b981",pct:92},
                                  good:     { l:ar?"جيد✅":"Bra✅",       c:"text-blue-600",  bg:"bg-blue-50 dark:bg-blue-950/20",    bar:"#3b82f6",pct:68},
                                  fair:     { l:ar?"مرتفع⚠️":"Högt⚠️",  c:"text-amber-600", bg:"bg-amber-50 dark:bg-amber-950/20",  bar:"#f59e0b",pct:42},
                                  high:     { l:ar?"مفرط❌":"Överdrivet❌",c:"text-red-600",  bg:"bg-red-50 dark:bg-red-950/20",      bar:"#ef4444",pct:18}}[feed.fcrGrade];
                      return (
                        <div className={cn("rounded-xl p-3.5", g.bg)}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div><p className="text-[10px] text-muted-foreground">{ar?"كفاءة التحويل الغذائي (FCR)":"Foderkonverteringsgrad (FCR)"}</p><p className={cn("text-sm font-black", g.c)}>{g.l}</p></div>
                            <div className="text-end"><p className={cn("text-xl font-black", g.c)}>{feed.feedPerBirdKg.toFixed(1)}</p><p className="text-[9px] text-muted-foreground">{ar?"كغ/طير":"kg/fågel"}</p></div>
                          </div>
                          <div className="h-2 bg-white/50 dark:bg-black/20 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width:`${g.pct}%`, background: g.bar }} />
                          </div>
                        </div>
                      );
                    })()}
                    {feed.monthlyFeed.length > 1 && feed.totalFeedKg > 0 && (
                      <ResponsiveContainer width="100%" height={80}>
                        <BarChart data={feed.monthlyFeed} margin={{ top:0, right:0, bottom:0, left:-28 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey={ar?"monthAr":"month"} tick={{ fontSize:8 }} />
                          <YAxis tick={{ fontSize:8 }} tickFormatter={v => `${v>=1000?(v/1000).toFixed(0)+"t":v}`} />
                          <Tooltip formatter={(v:any) => [`${Number(v).toFixed(0)} ${ar?"كغ":"kg"}`, ar?"علف":"Foder"]} />
                          <Bar dataKey="kg" fill="#f59e0b" radius={[3,3,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                    {feed.untrackedEntries > 0 && (
                      <div className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-border/40 p-3">
                        <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[10px]">{ar?`${feed.untrackedEntries} سجل بدون وزن — أضف كمية بوحدة: كيلو/طن`:`${feed.untrackedEntries} poster utan vikt — lägg till mängd med enhet: kg/ton`}</p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Financial ratios */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2"><Scale className="w-4 h-4 text-blue-500" />{ar?"النسب المالية مقابل المعايير الصناعية":"Finansiella nyckeltal vs. branschstandard"}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {[
                  { label: ar?"نسبة العلف":"Foderandel",     value: m.feedRatio,   bLow:55, bHigh:65, icon:"🌾", hint:ar?"معيار 55–65%":"Standard 55–65%", key:"feed_ratio",     lowerBetter: false },
                  { label: ar?"نسبة العمالة":"Arbetar.",      value: m.laborRatio,  bLow:15, bHigh:25, icon:"👷", hint:ar?"معيار 15–25%":"Standard 15–25%", key: null,            lowerBetter: false },
                  { label: ar?"OER":"OER",                    value: m.oer,         bLow:65, bHigh:80, icon:"📊", hint:ar?"معيار 65–80%":"Standard 65–80%", key:"oer",            lowerBetter: true  },
                  { label: ar?"هامش الربح":"Vinstmarginal",   value: m.profitMargin,bLow:15, bHigh:30, icon:"💰", hint:ar?"معيار 15–30%":"Standard 15–30%", key:"profit_margin",  lowerBetter: false },
                  { label: ar?"ROI":"ROI",                    value: m.roi,         bLow:10, bHigh:25, icon:"📈", hint:ar?"معيار 10–25%/سنة":"Standard 10–25%", key:"roi",         lowerBetter: false },
                  { label: ar?"هامش إجمالي":"Bruttomarginal", value: m.totalIncome > 0 ? (m.grossProfit/m.totalIncome)*100 : null, bLow:25, bHigh:50, icon:"💎", hint:ar?"الإيراد − التكاليف المتغيرة":"Intäkt − rörliga kostn.", key:"gross_margin", lowerBetter: false },
                ].map(({ label, value, bLow, bHigh, icon, hint, key, lowerBetter }) => {
                  if (value === null) return (
                    <div key={label} className="flex items-center gap-2 py-1 opacity-40">
                      <span className="text-base">{icon}</span>
                      <div className="flex-1"><p className="text-[10px] font-semibold">{label}</p><p className="text-[9px] text-muted-foreground">{hint}</p></div>
                      <span className="text-xs font-bold">—</span>
                    </div>
                  );
                  const inRange = value >= bLow && value <= bHigh;
                  const tooHigh = value > bHigh;
                  const status = inRange ? "ok" : lowerBetter ? (tooHigh ? "bad" : "great") : (tooHigh ? "great" : "bad");
                  const barColor = status === "ok" ? "#10b981" : status === "great" ? "#3b82f6" : "#ef4444";
                  const emoji = status === "ok" ? "✅" : status === "great" ? "🌟" : "⚠️";
                  return (
                    <button key={label} onClick={() => key && setDrillKey(key)} className={cn("w-full text-start", key && "hover:bg-muted/20 rounded-xl px-2 py-1.5 -mx-2 transition-colors")}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{icon}</span>
                          <div><p className="text-[10px] font-semibold leading-none">{label}</p><p className="text-[9px] text-muted-foreground">{hint}</p></div>
                          {key && <InfoTip metricKey={key} ar={ar} />}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-black" style={{ color:barColor }}>{value.toFixed(1)}%</span>
                          <span className="text-[10px]">{emoji}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width:`${Math.min(100,Math.abs(value))}%`, background:barColor }} />
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Fixed vs variable */}
            {m.totalExpense > 0 && (
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2"><Layers className="w-4 h-4 text-purple-500" />{ar?"التكاليف الثابتة vs المتغيرة":"Fasta vs. rörliga kostnader"}<InfoTip metricKey="gross_margin" ar={ar} /></CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="rounded-xl bg-slate-100 dark:bg-slate-900/50 p-3">
                      <p className="text-[9px] text-muted-foreground">{ar?"ثابتة (إيجار، عمالة، معدات)":"Fasta"}</p>
                      <p className="text-sm font-black mt-1">{fmtAmount(m.fixedCosts, lang as any)}</p>
                      <p className="text-[9px] text-muted-foreground">{m.totalExpense>0?((m.fixedCosts/m.totalExpense)*100).toFixed(0):0}%</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3">
                      <p className="text-[9px] text-muted-foreground">{ar?"متغيرة (علف، دواء، وقود)":"Rörliga"}</p>
                      <p className="text-sm font-black mt-1 text-amber-600">{fmtAmount(m.variableCosts, lang as any)}</p>
                      <p className="text-[9px] text-muted-foreground">{m.totalExpense>0?((m.variableCosts/m.totalExpense)*100).toFixed(0):0}%</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200/50 p-3">
                    <div className="flex justify-between text-[10px] mb-1.5">
                      <span className="font-semibold text-blue-700 dark:text-blue-300">{ar?"نقطة التعادل":"Break-even"}</span>
                      <span className="font-black text-blue-700 dark:text-blue-300">{fmtAmount(m.totalExpense, lang as any)}</span>
                    </div>
                    <div className="h-2.5 bg-white/60 dark:bg-slate-800/60 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width:`${Math.min(100,m.totalExpense>0?(m.totalIncome/m.totalExpense)*100:0)}%`, background: m.totalIncome>=m.totalExpense?"#10b981":"#f59e0b" }} />
                    </div>
                    <div className="flex justify-between text-[9px] mt-1 text-muted-foreground">
                      <span>{ar?"دخل فعلي":"Faktisk inkomst"}: {fmtAmount(m.totalIncome, lang as any)}</span>
                      <span>{m.totalExpense>0?((m.totalIncome/m.totalExpense)*100).toFixed(0):0}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <AlertBanner alerts={alerts} ar={ar} />
          </div>
        )}

        {/* ══ TAB: SIMULATOR ════════════════════════════════════════════════════ */}
        {tab === "simulator" && <SimulatorTab m={m} flocks={flocks} ar={ar} lang={lang} />}

        {/* ══ TAB: TRANSACTIONS ══════════════════════════════════════════════════ */}
        {tab === "transactions" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={ar?"بحث...":"Sök..."} className="h-9 ps-8 text-sm" />
              </div>
              {catFilter && (
                <button onClick={() => setCatFilter(null)} className="flex items-center gap-1 px-2.5 rounded-lg bg-primary/10 text-primary text-xs font-medium">
                  {catMeta(catFilter).icon} <X className="w-3 h-3" />
                </button>
              )}
              <div className="flex rounded-lg overflow-hidden border border-border/60">
                {(["all","income","expense"] as const).map(f => (
                  <button key={f} onClick={() => setTxFilter(f)} className={cn("px-2.5 py-1.5 text-[10px] font-semibold transition-colors",
                    txFilter===f ? (f==="income"?"bg-emerald-500 text-white":f==="expense"?"bg-red-500 text-white":"bg-primary text-primary-foreground") : "text-muted-foreground bg-background")}>
                    {f==="all"?(ar?"الكل":"Alla"):f==="income"?(ar?"دخل":"Inkomst"):(ar?"مصاريف":"Kostnader")}
                  </button>
                ))}
              </div>
            </div>
            {filteredTxs.length === 0 ? (
              <Card className="border-dashed"><CardContent className="py-12 text-center"><Receipt className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" /><p className="text-sm text-muted-foreground">{ar?"لا توجد معاملات":"Inga transaktioner"}</p></CardContent></Card>
            ) : (
              <Card className="border-none shadow-sm">
                <div className="divide-y divide-border/30">
                  {filteredTxs.map(tx => {
                    const meta = catMeta(tx.category);
                    return (
                      <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg", tx.type==="income"?"bg-emerald-100 dark:bg-emerald-900/30":"bg-red-100 dark:bg-red-900/30")}>{meta.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-semibold truncate">{tx.description}</p>
                            <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">{ar?meta.ar:meta.sv}</Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[9px] text-muted-foreground flex items-center gap-1"><Calendar className="w-2.5 h-2.5" />{tx.date}</span>
                            {tx.authorName && <span className="text-[9px] text-muted-foreground opacity-60">{tx.authorName}</span>}
                            {tx.quantity && tx.unit && <span className="text-[9px] text-muted-foreground">{Number(tx.quantity).toLocaleString()} {tx.unit}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={cn("text-sm font-black", tx.type==="income"?"text-emerald-600":"text-red-600")}>{tx.type==="income"?"+":"−"}{fmtAmount(Number(tx.amount), lang as any)}</span>
                          {isAdmin && (
                            <button onClick={() => handleDelete(tx.id)} disabled={deletingId===tx.id} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500">
                              {deletingId===tx.id?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Trash2 className="w-3.5 h-3.5"/>}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-4 py-3 border-t border-border/40 bg-muted/20 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{filteredTxs.length} {ar?"معاملة":"transaktioner"}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-xs text-emerald-600">+{fmtAmount(filteredTxs.filter(t=>t.type==="income").reduce((s,t)=>s+Number(t.amount),0), lang as any)}</span>
                    <span className="font-bold text-xs text-red-600">−{fmtAmount(filteredTxs.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.amount),0), lang as any)}</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ══ TAB: STATEMENT (P&L) ══════════════════════════════════════════════ */}
        {tab === "statement" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 p-5 text-white shadow-xl">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-slate-300" />
                <h2 className="text-sm font-black">{ar?"قائمة الدخل والأرباح والخسائر":"Resultaträkning (P&L)"}</h2>
                <Badge className="bg-white/10 text-slate-200 text-[9px] ms-auto">{ar?"شامل":"Fullständig"}</Badge>
              </div>
              <p className="text-[10px] text-slate-400 mb-4">{ar?"نظام الإدارة المالية الذكي · مزرعة الدواجن":"Intelligent finanshantering · Fjäderfägård"}</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[{ l:ar?"إجمالي الإيرادات":"Intäkter", v:m.totalIncome, c:"text-emerald-400" }, { l:ar?"إجمالي المصاريف":"Kostnader", v:m.totalExpense, c:"text-red-400" }, { l:ar?"صافي الربح":"Nettovinst", v:m.netProfit, c:m.netProfit>=0?"text-blue-400":"text-orange-400" }].map(x => (
                  <div key={x.l} className="bg-white/5 rounded-xl p-2.5">
                    <p className="text-[9px] text-slate-400">{x.l}</p>
                    <p className={cn("text-sm font-black mt-1", x.c)}>{x.v>=0?"":"-"}{fmtAmount(Math.abs(x.v), lang as any)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-xs font-black text-emerald-600 flex items-center gap-2"><ArrowUpCircle className="w-3.5 h-3.5" />{ar?"أ. الإيرادات التشغيلية":"A. Rörelseintäkter"}</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {m.incByCat.length === 0 ? <p className="text-[11px] text-muted-foreground">{ar?"لا إيرادات مسجلة":"Inga intäkter"}</p> : (
                  <>{m.incByCat.map(inc => { const meta = catMeta(inc.id); return (
                    <div key={inc.id} className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground flex items-center gap-1.5"><span>{meta.icon}</span>{ar?meta.ar:meta.sv}</span>
                      <span className="font-bold text-emerald-600">{fmtAmount(inc.value, lang as any)}</span>
                    </div>
                  ); })}
                  <div className="border-t border-border/40 pt-2 flex justify-between text-xs font-black"><span>{ar?"إجمالي الإيرادات":"Totalt"}</span><span className="text-emerald-600">{fmtAmount(m.totalIncome, lang as any)}</span></div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Variable costs */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-xs font-black text-amber-600 flex items-center gap-2"><ArrowDownCircle className="w-3.5 h-3.5" />{ar?"ب. تكلفة الإنتاج المتغيرة (COGS)":"B. Rörliga produktionskostnader (COGS)"}</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {m.expByCat.filter(e => { const meta = catMeta(e.id); return "fixed" in meta && !(meta as any).fixed; }).map(e => { const meta = catMeta(e.id); return (
                  <div key={e.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1.5"><span>{meta.icon}</span>{ar?meta.ar:meta.sv}</span>
                    <span className="font-bold text-red-600">({fmtAmount(e.value, lang as any)})</span>
                  </div>
                ); })}
                <div className="border-t border-border/40 pt-2 flex justify-between text-xs font-bold"><span>{ar?"إجمالي المتغيرة":"Totalt rörligt"}</span><span className="text-red-600">({fmtAmount(m.variableCosts, lang as any)})</span></div>
                <div className="flex justify-between text-xs font-black border-t border-border/60 pt-2">
                  <span className="text-blue-600 flex items-center gap-1">{ar?"إجمالي الربح":"Bruttovinst"}<InfoTip metricKey="gross_margin" ar={ar} /></span>
                  <span className={cn("font-black", m.grossProfit>=0?"text-blue-600":"text-orange-600")}>{m.grossProfit>=0?"+":""}{fmtAmount(Math.abs(m.grossProfit), lang as any)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Fixed costs */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-xs font-black text-red-600 flex items-center gap-2"><ArrowDownCircle className="w-3.5 h-3.5" />{ar?"ج. المصاريف التشغيلية الثابتة (OPEX)":"C. Fasta driftskostnader (OPEX)"}</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {m.expByCat.filter(e => { const meta = catMeta(e.id); return "fixed" in meta && (meta as any).fixed; }).map(e => { const meta = catMeta(e.id); return (
                  <div key={e.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1.5"><span>{meta.icon}</span>{ar?meta.ar:meta.sv}</span>
                    <span className="font-bold text-red-600">({fmtAmount(e.value, lang as any)})</span>
                  </div>
                ); })}
                <div className="border-t border-border/40 pt-2 flex justify-between text-xs font-bold"><span>{ar?"إجمالي الثابتة":"Totalt fast"}</span><span className="text-red-600">({fmtAmount(m.fixedCosts, lang as any)})</span></div>
              </CardContent>
            </Card>

            {/* Net result */}
            <div className={cn("rounded-2xl p-5 shadow-md", m.netProfit>=0?"bg-gradient-to-r from-emerald-500 to-teal-600 text-white":"bg-gradient-to-r from-red-500 to-rose-600 text-white")}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-black">{ar?"صافي الربح / الخسارة":"Nettoresultat"}</span>
                <span className="text-xl font-black">{m.netProfit>=0?"+":""}{fmtAmount(Math.abs(m.netProfit), lang as any)}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center bg-white/10 rounded-xl p-2.5">
                {[
                  { l:ar?"هامش":"Marginal", v:m.profitMargin!==null?`${m.profitMargin.toFixed(1)}%`:"—", k:"profit_margin" },
                  { l:"ROI",               v:m.roi!==null?`${m.roi.toFixed(1)}%`:"—",            k:"roi" },
                  { l:"OER",               v:m.oer!==null?`${m.oer.toFixed(1)}%`:"—",            k:"oer" },
                  { l:ar?"ربح/طير":"Vinst/fågel", v:m.profitPerBird!==null?fmtAmount(Math.abs(m.profitPerBird), lang as any):"—", k:"cost_per_bird" },
                ].map(x => (
                  <button key={x.l} onClick={() => setDrillKey(x.k)} className="text-center hover:bg-white/10 rounded-lg p-1 transition-colors">
                    <p className="text-[9px] opacity-70">{x.l}</p>
                    <p className="text-xs font-black">{x.v}</p>
                    <InfoTip metricKey={x.k} ar={ar} />
                  </button>
                ))}
              </div>
            </div>

            {/* Monthly table */}
            {monthly.length > 0 && (
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-blue-500" />{ar?"الاتجاه الشهري":"Månadsöversikt"}</CardTitle></CardHeader>
                <CardContent className="px-2 pb-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead><tr className="border-b border-border/40">
                        <th className="text-start px-3 py-2 text-muted-foreground">{ar?"الشهر":"Månad"}</th>
                        <th className="text-end px-3 py-2 text-emerald-600">{ar?"دخل":"Inkomst"}</th>
                        <th className="text-end px-3 py-2 text-red-600">{ar?"مصاريف":"Kostnader"}</th>
                        <th className="text-end px-3 py-2 text-blue-600">{ar?"ربح":"Vinst"}</th>
                        <th className="text-end px-3 py-2 text-purple-600">Z</th>
                      </tr></thead>
                      <tbody>
                        {monthly.slice(-12).reverse().map((row, i) => {
                          const zRow = adv.monthZScores.find(z => z.month === row.month);
                          return (
                            <tr key={i} className={cn("border-b border-border/20 hover:bg-muted/20", zRow?.anomaly && "bg-rose-50/50 dark:bg-rose-950/10")}>
                              <td className="px-3 py-2 font-medium">{ar?row.monthAr:row.month}</td>
                              <td className="text-end px-3 py-2 text-emerald-600 font-bold">{fmtAmount(row.income, lang as any)}</td>
                              <td className="text-end px-3 py-2 text-red-600 font-bold">{fmtAmount(row.expense, lang as any)}</td>
                              <td className={cn("text-end px-3 py-2 font-bold", row.profit>=0?"text-blue-600":"text-orange-600")}>{row.profit>=0?"+":""}{fmtAmount(Math.abs(row.profit), lang as any)}</td>
                              <td className={cn("text-end px-3 py-2 font-bold text-[9px]", zRow?.anomaly?"text-rose-600":"text-muted-foreground")}>{zRow ? zRow.z.toFixed(2) : "—"}{zRow?.anomaly?" ⚡":""}</td>
                            </tr>
                          );
                        })}
                        {adv.pred && (
                          <tr className="bg-muted/30 border-t-2 border-dashed border-border/60">
                            <td className="px-3 py-2 font-bold text-muted-foreground">{ar?"التوقع →":"Prognos →"}</td>
                            <td className="text-end px-3 py-2 text-emerald-500 font-bold italic">{fmtAmount(adv.pred.income, lang as any)}</td>
                            <td className="text-end px-3 py-2 text-red-500 font-bold italic">{fmtAmount(adv.pred.expense, lang as any)}</td>
                            <td className={cn("text-end px-3 py-2 font-bold italic", adv.pred.profit>=0?"text-blue-500":"text-orange-500")}>{adv.pred.profit>=0?"+":""}{fmtAmount(Math.abs(adv.pred.profit), lang as any)}</td>
                            <td className="text-end px-3 py-2 text-[9px] text-muted-foreground">ML</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <div className="h-6" />
      </div>

      {/* ══ Drill-Down Modal ══════════════════════════════════════════════════════ */}
      <DrillModal
        open={drillKey !== null}
        onClose={() => setDrillKey(null)}
        title={drillKey ? (ar ? (GLOSSARY[drillKey]?.nameAr ?? drillKey) : (GLOSSARY[drillKey]?.nameSv ?? drillKey)) : ""}
      >
        {drillContent}
      </DrillModal>
    </div>
  );
}
