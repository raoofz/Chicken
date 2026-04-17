/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  مدير مزرعة الدواجن — نظام الإدارة المالية والإنتاج v4.0
 *  Poultry Farm Finance & Production Intelligence System
 *
 *  Algorithms : EMA · Z-Score · Cash Runway · Profit Velocity · LinReg
 *               Cumulative P&L · Period Comparison · Income CV (stability)
 *  UX          : InfoTips · Drill-Down Modals · Simulator · Heatmap
 *                Edit Transactions · Recommendations Engine · Best/Worst Month
 *                Animated Amounts · Period-vs-Period KPI delta badges
 *  Bilingual AR/SV · Live 30s Polling · University-Grade Analytics
 * ══════════════════════════════════════════════════════════════════════════════
 */
import { useState, useMemo, useEffect } from "react";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Line, ComposedChart,
  ReferenceLine, Area, AreaChart,
} from "recharts";
import {
  TrendingUp, TrendingDown, Plus, Trash2, Loader2, Edit2,
  ArrowUpCircle, ArrowDownCircle, Search, Target, Activity,
  RefreshCw, Receipt, Calendar, Award, FileText, Info, Zap,
  Bird, Egg, Scale, BarChart3, CircleDollarSign, Layers,
  AlertTriangle, CheckCircle, Wheat, Syringe, Bolt, Droplets,
  Flame, Truck, Home, Package, ShieldPlus, Wrench, Factory,
  BarChart2, Sliders, FlaskConical, Brain, Sigma, GitBranch,
  ArrowRight, X, Eye, Star, Lightbulb, Trophy, TrendingUp as Trend,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── API ──────────────────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include", ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Error");
  return r.status === 204 ? null : r.json();
}

// ─── Category Definitions ────────────────────────────────────────────────────
const EXPENSE_CATS = [
  { id: "feed",                ar: "علف",              sv: "Foder",            icon: "🌾", fixed: false, Icon: Wheat     },
  { id: "medicine",            ar: "أدوية وعلاج",      sv: "Medicin",          icon: "💊", fixed: false, Icon: Syringe   },
  { id: "vaccines",            ar: "لقاحات",           sv: "Vacciner",         icon: "💉", fixed: false, Icon: ShieldPlus},
  { id: "electricity",         ar: "كهرباء",           sv: "El",               icon: "⚡", fixed: true,  Icon: Bolt      },
  { id: "water",               ar: "ماء",              sv: "Vatten",           icon: "💧", fixed: false, Icon: Droplets  },
  { id: "fuel",                ar: "وقود ومولد",        sv: "Bränsle",          icon: "⛽", fixed: false, Icon: Flame     },
  { id: "labor",               ar: "عمالة وأجور",       sv: "Arbetskraft",      icon: "👷", fixed: true,  Icon: Award     },
  { id: "equipment",           ar: "معدات وأجهزة",      sv: "Utrustning",       icon: "🔧", fixed: true,  Icon: Wrench    },
  { id: "maintenance",         ar: "صيانة",            sv: "Underhåll",        icon: "🛠️", fixed: true,  Icon: Factory   },
  { id: "disinfection",        ar: "مطهرات ومعقمات",    sv: "Desinfektion",     icon: "🧴", fixed: false, Icon: Package   },
  { id: "transport",           ar: "نقل وشحن",          sv: "Transport",        icon: "🚛", fixed: false, Icon: Truck     },
  { id: "rent",                ar: "إيجار",            sv: "Hyra",             icon: "🏠", fixed: true,  Icon: Home      },
  { id: "incubation_supplies", ar: "مستلزمات تفقيس",   sv: "Kläckningsförnöd", icon: "🥚", fixed: false, Icon: Egg      },
  { id: "eggs_purchase",       ar: "شراء بيض تفقيس",   sv: "Inköp av ägg",     icon: "🐣", fixed: false, Icon: Egg      },
  { id: "other",               ar: "أخرى",             sv: "Övrigt",           icon: "📦", fixed: false, Icon: Package   },
];
const INCOME_CATS = [
  { id: "chick_sale",   ar: "بيع كتاكيت",    sv: "Kycklingförsäljning",      icon: "🐥", Icon: Bird       },
  { id: "egg_sale",     ar: "بيع بيض",        sv: "Äggförsäljning",           icon: "🥚", Icon: Egg        },
  { id: "chicken_sale", ar: "بيع دجاج (لحم)", sv: "Slaktkycklingförsäljning", icon: "🍗", Icon: Bird       },
  { id: "manure_sale",  ar: "بيع سماد",       sv: "Gödselförsäljning",        icon: "♻️", Icon: Layers     },
  { id: "other",        ar: "دخل أخرى",       sv: "Övriga intäkter",          icon: "📈", Icon: TrendingUp },
];
const ALL_CATS = [...EXPENSE_CATS, ...INCOME_CATS];
const catMeta = (id: string) =>
  ALL_CATS.find(c => c.id === id) ?? { id, ar: id, sv: id, icon: "📦", fixed: false, Icon: Package };

const PIE_COLORS = [
  "#ef4444","#f97316","#f59e0b","#84cc16","#06b6d4","#8b5cf6",
  "#ec4899","#14b8a6","#fb923c","#a78bfa","#34d399","#60a5fa",
  "#f472b6","#38bdf8","#4ade80",
];
const INC_COLORS = ["#10b981","#3b82f6","#6366f1","#f59e0b","#14b8a6"];

// ─── Metric Glossary ─────────────────────────────────────────────────────────
interface GlossaryEntry {
  nameAr: string; nameSv: string; formulaAr: string;
  descAr: string; descSv: string;
  benchmarkAr: string; benchmarkSv: string; colorClass: string;
}
const GLOSSARY: Record<string, GlossaryEntry> = {
  roi: { nameAr:"العائد على الاستثمار (ROI)", nameSv:"Avkastning på investering (ROI)", formulaAr:"ROI = ((الإيراد − المصاريف) ÷ المصاريف) × 100", descAr:"يقيس ربح كل دينار مُستثمر. كلما ارتفعت النسبة كلما كان الاستثمار أكفأ.", descSv:"Mäter vinst per investerad krona.", benchmarkAr:"دواجن: 10–25% سنوياً · ممتاز > 30%", benchmarkSv:"Fjäderfä: 10–25%/år · Utmärkt > 30%", colorClass:"text-purple-600" },
  profit_margin: { nameAr:"هامش الربح الصافي", nameSv:"Nettovinstmarginal", formulaAr:"هامش الربح = (صافي الربح ÷ إجمالي الإيراد) × 100", descAr:"نسبة ما يتبقى من كل دينار إيراد بعد خصم جميع المصاريف.", descSv:"Andel av varje intäktskrona kvar efter alla kostnader.", benchmarkAr:"< 10% ضعيف · 10–20% مقبول · 20–30% جيد · > 30% ممتاز", benchmarkSv:"< 10% Svag · 10–20% OK · 20–30% Bra · > 30% Utmärkt", colorClass:"text-blue-600" },
  oer: { nameAr:"نسبة المصاريف التشغيلية (OER)", nameSv:"Driftkostnadskvot (OER)", formulaAr:"OER = (إجمالي المصاريف ÷ إجمالي الإيراد) × 100", descAr:"ما يستهلكه الإنفاق من الإيراد. الرقم الأقل أفضل.", descSv:"Kostnaderna som andel av intäkterna. Lägre är bättre.", benchmarkAr:"< 65% ممتاز · 65–80% جيد · 80–90% مقبول · > 90% ضعيف", benchmarkSv:"< 65% Utmärkt · 65–80% Bra · 80–90% OK · > 90% Svag", colorClass:"text-orange-600" },
  feed_ratio: { nameAr:"نسبة تكلفة العلف", nameSv:"Foderandel", formulaAr:"نسبة العلف = (تكلفة العلف ÷ إجمالي المصاريف) × 100", descAr:"العلف هو المصروف الأكبر في الدواجن. النسبة الطبيعية 55–65%.", descSv:"Foder är den största kostnaden. Normal andel 55–65%.", benchmarkAr:"50–55% ممتاز · 55–65% طبيعي · > 65% مرتفع", benchmarkSv:"50–55% Utmärkt · 55–65% Normalt · > 65% Högt", colorClass:"text-amber-600" },
  cost_per_bird: { nameAr:"تكلفة الطير الواحد", nameSv:"Kostnad per fågel", formulaAr:"تكلفة/طير = إجمالي المصاريف ÷ إجمالي عدد الطيور", descAr:"المؤشر الأساسي لقياس كفاءة الإنتاج وتسعير البيع.", descSv:"Grundläggande produktionseffektivitetsmått.", benchmarkAr:"يختلف حسب السوق. قارنه مع دوراتك السابقة.", benchmarkSv:"Varierar med marknaden. Jämför med dina egna cykler.", colorClass:"text-red-600" },
  gross_margin: { nameAr:"هامش الربح الإجمالي", nameSv:"Bruttomarginal", formulaAr:"الإيراد − التكاليف المتغيرة (علف + دواء + وقود...)", descAr:"الربح قبل خصم التكاليف الثابتة. يقيس ربحية الإنتاج الجوهرية.", descSv:"Vinst innan fasta kostnader.", benchmarkAr:"يجب أن يكون موجباً دائماً. سالب = مشكلة في التكاليف المتغيرة.", benchmarkSv:"Måste alltid vara positiv.", colorClass:"text-teal-600" },
  ema_trend: { nameAr:"المتوسط المتحرك الأسي (EMA)", nameSv:"Exponentiellt rörligt medelvärde (EMA)", formulaAr:"EMA = α × القيمة_الحالية + (1−α) × EMA_السابقة  (α=0.35)", descAr:"خوارزمية تعطي وزناً أكبر للبيانات الحديثة. أدق من المتوسط البسيط.", descSv:"Algoritm som prioriterar nyare data. Mer exakt än enkelt medelvärde.", benchmarkAr:"يُستخدم في تحليل الأسهم. يتكيف مع التغيرات السريعة.", benchmarkSv:"Används i aktieanalys. Anpassar sig till snabba förändringar.", colorClass:"text-indigo-600" },
  z_score: { nameAr:"الانحراف المعياري Z-Score", nameSv:"Z-Score Standardavvikelse", formulaAr:"Z = (القيمة − المتوسط) ÷ الانحراف_المعياري", descAr:"يحدد الشهور غير الطبيعية إحصائياً. |Z| > 1.8 = شهر استثنائي.", descSv:"Identifierar statistiskt onormala månader.", benchmarkAr:"|Z| < 1 طبيعي · 1–1.8 ملحوظ · > 1.8 استثنائي يستحق تحقيقاً", benchmarkSv:"|Z| < 1 Normalt · 1–1.8 Anmärkningsvärt · > 1.8 Exceptionellt", colorClass:"text-rose-600" },
  cash_runway: { nameAr:"مدة الاستمرارية النقدية", nameSv:"Kassabana (Cash Runway)", formulaAr:"مدة الاستمرار = متوسط_الإيراد_الشهري ÷ معدل_الإنفاق_اليومي", descAr:"كم يوماً تستطيع الاستمرار بالإيراد الحالي إذا لم تتغير المصاريف.", descSv:"Hur länge gården kan fortsätta med nuvarande intäkter.", benchmarkAr:"< 30 يوم خطر · 30–90 مقبول · 90–180 جيد · > 180 ممتاز", benchmarkSv:"< 30 Fara · 30–90 OK · 90–180 Bra · > 180 Utmärkt", colorClass:"text-cyan-600" },
  profit_velocity: { nameAr:"زخم الربح (Profit Velocity)", nameSv:"Vinstmomentum", formulaAr:"الزخم = ((ربح_الأخير − ربح_السابق) ÷ |ربح_السابق|) × 100", descAr:"معدل تسارع أو تباطؤ الربح. مثل مفهوم التسارع في الفيزياء.", descSv:"Vinstens accelerations-/inbromsningshastighet.", benchmarkAr:"> +20% ممتاز · +5 إلى +20% جيد · −5 إلى +5% محايد · < −5% تراجع", benchmarkSv:"> +20% Utmärkt · +5 till +20% Bra · −5 till +5% Neutral · < −5% Nedgång", colorClass:"text-emerald-600" },
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Period = "week" | "month" | "quarter" | "year" | "all";
type FinTab = "dashboard" | "add" | "analysis" | "simulator" | "transactions" | "statement";
interface Tx {
  id: number; date: string; type: "income" | "expense"; category: string;
  description: string; amount: string; quantity: string | null;
  unit: string | null; notes: string | null; authorName: string | null; createdAt: string;
}
interface Flock { id: number; name: string; count: number; breed: string; purpose: string; }

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmtAmount(n: number, lang: "ar" | "sv" = "ar"): string {
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
  const fmt   = (d: Date) => d.toISOString().slice(0, 10);
  if (p === "all") return null;
  const offs: Record<Period, number> = { week: 7, month: 30, quarter: 90, year: 365, all: 0 };
  const s = new Date(today); s.setDate(today.getDate() - offs[p]);
  return { start: fmt(s), end: fmt(today) };
}
function getPeriodDays(p: Period): number {
  return { week: 7, month: 30, quarter: 90, year: 365, all: 180 }[p];
}
function getPrevPeriodRange(p: Period): { start: string; end: string } | null {
  if (p === "all") return null;
  const offs: Record<Period, number> = { week: 7, month: 30, quarter: 90, year: 365, all: 0 };
  const days = offs[p];
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date(today); end.setDate(today.getDate() - days);
  const start = new Date(today); start.setDate(today.getDate() - days * 2);
  return { start: fmt(start), end: fmt(end) };
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

const AR_M = ["يناير","فبراير","مارس","أبريل","مايو","يونيو",
              "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

// ═══════════════════════════════════════════════════════════════════════════════
//  ALGORITHM ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

interface FinMetrics {
  totalIncome: number; totalExpense: number; netProfit: number;
  profitMargin: number | null; roi: number | null;
  grossProfit: number; operatingExpense: number;
  fixedCosts: number; variableCosts: number;
  costPerBird: number | null; revenuePerBird: number | null;
  profitPerBird: number | null; breakEvenPricePerBird: number | null;
  dailyBurnRate: number; dailyRevRate: number;
  feedRatio: number | null; laborRatio: number | null; oer: number | null;
  expByCat: { id: string; value: number; pct: number }[];
  incByCat: { id: string; value: number; pct: number }[];
  healthScore: number; healthGrade: "excellent" | "good" | "fair" | "poor";
  feedCostRaw: number; laborCostRaw: number;
}

function computeMetrics(txs: Tx[], flocks: Flock[], period: Period): FinMetrics {
  const days = getPeriodDays(period);
  const totalIncome  = txs.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = txs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const netProfit    = totalIncome - totalExpense;
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : null;
  const roi          = totalExpense > 0 ? (netProfit / totalExpense) * 100 : null;
  const expMap: Record<string, number> = {};
  txs.filter(t => t.type === "expense").forEach(t => { expMap[t.category] = (expMap[t.category] || 0) + Number(t.amount); });
  const incMap: Record<string, number> = {};
  txs.filter(t => t.type === "income").forEach(t => { incMap[t.category] = (incMap[t.category] || 0) + Number(t.amount); });
  const expByCat = Object.entries(expMap).sort((a, b) => b[1] - a[1]).map(([id, value]) => ({ id, value, pct: totalExpense > 0 ? (value / totalExpense) * 100 : 0 }));
  const incByCat = Object.entries(incMap).sort((a, b) => b[1] - a[1]).map(([id, value]) => ({ id, value, pct: totalIncome  > 0 ? (value / totalIncome)  * 100 : 0 }));
  const fixedIds    = EXPENSE_CATS.filter(c => c.fixed).map(c => c.id);
  const fixedCosts  = expByCat.filter(e => fixedIds.includes(e.id)).reduce((s, e) => s + e.value, 0);
  const variableCosts = totalExpense - fixedCosts;
  const totalBirds = flocks.reduce((s, f) => s + f.count, 0);
  const costPerBird = totalBirds > 0 ? totalExpense / totalBirds : null;
  const revenuePerBird = totalBirds > 0 ? totalIncome / totalBirds : null;
  const profitPerBird  = totalBirds > 0 ? netProfit / totalBirds : null;
  const breakEvenPricePerBird = totalBirds > 0 ? totalExpense / totalBirds : null;
  const feedCostRaw  = expMap["feed"]  ?? 0;
  const laborCostRaw = expMap["labor"] ?? 0;
  const feedRatio  = totalExpense > 0 ? (feedCostRaw  / totalExpense) * 100 : null;
  const laborRatio = totalExpense > 0 ? (laborCostRaw / totalExpense) * 100 : null;
  const oer        = totalIncome  > 0 ? (totalExpense / totalIncome)  * 100 : null;
  const grossProfit      = totalIncome - variableCosts;
  const operatingExpense = fixedCosts;
  const dailyBurnRate = days > 0 ? totalExpense / days : 0;
  const dailyRevRate  = days > 0 ? totalIncome  / days : 0;
  let healthScore = 50;
  if (totalIncome > 0) healthScore = Math.max(0, Math.min(100, 50 + (profitMargin ?? 0)));
  const healthGrade: FinMetrics["healthGrade"] = healthScore >= 70 ? "excellent" : healthScore >= 55 ? "good" : healthScore >= 40 ? "fair" : "poor";
  return { totalIncome, totalExpense, netProfit, profitMargin, roi, grossProfit, operatingExpense, fixedCosts, variableCosts, costPerBird, revenuePerBird, profitPerBird, breakEvenPricePerBird, dailyBurnRate, dailyRevRate, feedRatio, laborRatio, oer, expByCat, incByCat, healthScore, healthGrade, feedCostRaw, laborCostRaw };
}

interface MonthRow { month: string; monthAr: string; income: number; expense: number; profit: number; cumulative: number; }
function computeMonthly(txs: Tx[]): MonthRow[] {
  const map: Record<string, { income: number; expense: number }> = {};
  txs.forEach(t => {
    const m = t.date.slice(0, 7);
    if (!map[m]) map[m] = { income: 0, expense: 0 };
    if (t.type === "income") map[m].income += Number(t.amount);
    else map[m].expense += Number(t.amount);
  });
  let cumulative = 0;
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([m, d]) => {
    const [, mo] = m.split("-");
    const profit = d.income - d.expense;
    cumulative += profit;
    return { month: m.slice(5), monthAr: AR_M[parseInt(mo) - 1] ?? m, income: d.income, expense: d.expense, profit, cumulative };
  });
}

// ─── Linear Regression ───────────────────────────────────────────────────────
function linReg(vals: number[]): number {
  const n = vals.length;
  if (n < 2) return vals[0] ?? 0;
  const xm = (n - 1) / 2, ym = vals.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  vals.forEach((v, i) => { num += (i - xm) * (v - ym); den += (i - xm) ** 2; });
  const slope = den !== 0 ? num / den : 0;
  return Math.max(0, Math.round(ym - slope * xm + slope * n));
}

interface AdvMetrics {
  emaIncome: number; emaExpense: number; emaProfit: number;
  monthZScores: { month: string; monthAr: string; profit: number; z: number; anomaly: boolean }[];
  cashRunway: number | null; profitVelocity: number | null; incomeCV: number | null;
  pred: { income: number; expense: number; profit: number } | null;
  heatmap: { cat: string; months: Record<string, number> }[];
  movingAvg: { month: string; monthAr: string; ma: number }[];
  bestMonth: MonthRow | null; worstMonth: MonthRow | null;
  allMonthsInLoss: boolean;
  profitableStreak: number; lossStreak: number;
}

function computeAdvanced(allTxs: Tx[], monthly: MonthRow[]): AdvMetrics {
  const ALPHA = 0.35;
  const r12 = monthly.slice(-12);
  let emaInc = r12[0]?.income ?? 0, emaExp = r12[0]?.expense ?? 0;
  r12.forEach(m => { emaInc = ALPHA * m.income + (1 - ALPHA) * emaInc; emaExp = ALPHA * m.expense + (1 - ALPHA) * emaExp; });
  const emaProfit = emaInc - emaExp;

  const profits = monthly.map(m => m.profit);
  const mean = profits.length > 0 ? profits.reduce((s, v) => s + v, 0) / profits.length : 0;
  const std  = profits.length > 1 ? Math.sqrt(profits.map(p => (p - mean) ** 2).reduce((s, v) => s + v, 0) / profits.length) : 0;
  const monthZScores = monthly.map(m => ({ month: m.month, monthAr: m.monthAr, profit: m.profit, z: std > 0 ? (m.profit - mean) / std : 0, anomaly: std > 0 && Math.abs((m.profit - mean) / std) > 1.8 }));

  const avg3Inc = monthly.slice(-3).reduce((s, m) => s + m.income, 0) / Math.max(1, Math.min(3, monthly.length));
  const avg3Exp = monthly.slice(-3).reduce((s, m) => s + m.expense, 0) / Math.max(1, Math.min(3, monthly.length));
  const avgDailyExp = avg3Exp / 30;
  const cashRunway = avgDailyExp > 0 ? avg3Inc / avgDailyExp : null;

  let profitVelocity: number | null = null;
  if (monthly.length >= 2) {
    const prev = monthly[monthly.length - 2].profit, last = monthly[monthly.length - 1].profit;
    profitVelocity = prev !== 0 ? ((last - prev) / Math.abs(prev)) * 100 : null;
  }

  const incomes = monthly.map(m => m.income);
  const iMean = incomes.length > 0 ? incomes.reduce((s, v) => s + v, 0) / incomes.length : 0;
  const iStd  = incomes.length > 1 ? Math.sqrt(incomes.map(v => (v - iMean) ** 2).reduce((s, v) => s + v, 0) / incomes.length) : 0;
  const incomeCV = iMean > 0 ? (iStd / iMean) * 100 : null;

  let pred: AdvMetrics["pred"] = null;
  if (monthly.length >= 2) {
    const r = monthly.slice(-Math.min(6, monthly.length));
    pred = { income: linReg(r.map(m => m.income)), expense: linReg(r.map(m => m.expense)), profit: linReg(r.map(m => m.profit)) };
  }

  const last6 = monthly.slice(-6).map(m => m.month);
  const heatCats = [...new Set(allTxs.filter(t => t.type === "expense").map(t => t.category))];
  const heatmap = heatCats.map(cat => {
    const months: Record<string, number> = {};
    last6.forEach(mo => { months[mo] = allTxs.filter(t => t.type === "expense" && t.category === cat && t.date.slice(5, 7) === mo).reduce((s, t) => s + Number(t.amount), 0); });
    return { cat, months };
  });

  const movingAvg = monthly.slice(2).map((m, i) => ({ month: m.month, monthAr: m.monthAr, ma: (monthly[i].profit + monthly[i + 1].profit + m.profit) / 3 }));

  // Best/Worst month — bestMonth ONLY if profit > 0 (never label a loss as "best")
  const profitableMonths = monthly.filter(m => m.profit > 0);
  const bestMonth  = profitableMonths.length > 0 ? profitableMonths.reduce((a, b) => b.profit > a.profit ? b : a) : null;
  const worstMonth = monthly.length > 0 ? monthly.reduce((a, b) => b.profit < a.profit ? b : a) : null;
  const allMonthsInLoss = monthly.length > 0 && profitableMonths.length === 0;

  // Profitable streak (consecutive positive months from last)
  let profitableStreak = 0, lossStreak = 0;
  for (let i = monthly.length - 1; i >= 0; i--) {
    if (monthly[i].profit > 0) { if (lossStreak === 0) profitableStreak++; else break; }
    else { if (profitableStreak === 0) lossStreak++; else break; }
  }

  return { emaIncome: emaInc, emaExpense: emaExp, emaProfit, monthZScores, cashRunway, profitVelocity, incomeCV, pred, heatmap, movingAvg, bestMonth, worstMonth, allMonthsInLoss, profitableStreak, lossStreak };
}

// ─── Alert Engine ────────────────────────────────────────────────────────────
interface Alert { id: string; severity: "critical" | "warning" | "info"; ar: string; sv: string; }
function detectAlerts(m: FinMetrics, txCount: number): Alert[] {
  const a: Alert[] = [];
  if (txCount === 0) return a;
  if (m.netProfit < 0 && m.totalIncome > 0)
    a.push({ id: "loss", severity: "critical", ar: `⛔ خسارة صافية: ${fmtAmount(Math.abs(m.netProfit))} — راجع التكاليف فوراً`, sv: `⛔ Nettoförlust: ${fmtAmount(Math.abs(m.netProfit), "sv")} — granska kostnader` });
  if (m.profitMargin !== null && m.profitMargin >= 0 && m.profitMargin < 10)
    a.push({ id: "low_margin", severity: "critical", ar: `⚠️ هامش ربح ${m.profitMargin.toFixed(1)}% — الحد الأمان 20%`, sv: `⚠️ Vinstmarginal ${m.profitMargin.toFixed(1)}% — Säkerhetsgräns 20%` });
  if (m.feedRatio !== null && m.feedRatio > 65)
    a.push({ id: "feed_heavy", severity: "warning", ar: `🌾 العلف ${m.feedRatio.toFixed(0)}% من المصاريف — المعيار 55–65%`, sv: `🌾 Foder ${m.feedRatio.toFixed(0)}% — Standard 55–65%` });
  if (m.oer !== null && m.oer > 90)
    a.push({ id: "oer_high", severity: "warning", ar: `📊 OER=${m.oer.toFixed(0)}% — مرتفع جداً (المعيار < 80%)`, sv: `📊 OER=${m.oer.toFixed(0)}% — Standard < 80%` });
  if (m.laborRatio !== null && m.laborRatio > 30)
    a.push({ id: "labor_high", severity: "warning", ar: `👷 العمالة ${m.laborRatio.toFixed(0)}% — أعلى من المعيار 20–25%`, sv: `👷 Arbetskostnad ${m.laborRatio.toFixed(0)}% — Över 20–25%` });
  if (m.totalIncome === 0 && txCount > 3)
    a.push({ id: "no_income", severity: "warning", ar: "لا دخل مسجل — أضف مبيعاتك لتحليل الربحية", sv: "Ingen inkomst — Lägg till försäljning" });
  if (m.variableCosts > m.totalIncome * 0.95 && m.totalIncome > 0)
    a.push({ id: "var_high", severity: "warning", ar: "التكاليف المتغيرة > 95% من الدخل — إعادة هيكلة ضرورية", sv: "Rörliga kostnader > 95% av intäkter" });
  if (m.profitMargin !== null && m.profitMargin >= 25)
    a.push({ id: "excellent", severity: "info", ar: `✅ هامش ربح ${m.profitMargin.toFixed(1)}% — أداء ممتاز يتجاوز المعيار الصناعي`, sv: `✅ Vinstmarginal ${m.profitMargin.toFixed(1)}% — Utmärkt` });
  if (m.costPerBird !== null)
    a.push({ id: "cpb", severity: "info", ar: `🐔 تكلفة/طير: ${fmtAmount(m.costPerBird)} | تعادل: ${fmtAmount(m.breakEvenPricePerBird ?? 0)}`, sv: `🐔 Kostnad/fågel: ${fmtAmount(m.costPerBird, "sv")}` });
  return a;
}

// ─── Smart Recommendations Engine ────────────────────────────────────────────
interface Rec { id: string; icon: string; titleAr: string; titleSv: string; bodyAr: string; bodySv: string; priority: "high" | "medium" | "low"; }
function generateRecommendations(m: FinMetrics, adv: AdvMetrics, monthly: MonthRow[]): Rec[] {
  const recs: Rec[] = [];
  if (m.feedRatio !== null && m.feedRatio > 65)
    recs.push({ id: "feed_cost", icon: "🌾", priority: "high", titleAr: "خفّض تكلفة العلف", titleSv: "Minska foderkostnaden", bodyAr: `العلف يستهلك ${m.feedRatio.toFixed(0)}% من ميزانيتك. حاول التفاوض مع الموردين أو التحول لعلف أرخص مع مراقبة FCR. هدفك: أقل من 65%.`, bodySv: `Foder förbrukar ${m.feedRatio.toFixed(0)}% av din budget. Förhandla med leverantörer eller byt till billigare foder.` });
  if (m.profitMargin !== null && m.profitMargin > 0 && m.profitMargin < 15)
    recs.push({ id: "margin", icon: "💰", priority: "high", titleAr: "رفع أسعار البيع", titleSv: "Höj försäljningspriset", bodyAr: `هامش ربحك ${m.profitMargin.toFixed(1)}% — منخفض. زيادة أسعار البيع 10% ستحسن هامشك بشكل ملحوظ مع الحفاظ على تنافسيتك في السوق.`, bodySv: `Vinstmarginal ${m.profitMargin.toFixed(1)}% är låg. Öka priset 10% för märkbar förbättring.` });
  if (adv.cashRunway !== null && adv.cashRunway < 60)
    recs.push({ id: "cash", icon: "💵", priority: "high", titleAr: "احتياطي نقدي منخفض", titleSv: "Låg likviditetsreserv", bodyAr: `مدة الاستمرارية ${Math.round(adv.cashRunway)} يوم فقط. ابحث عن تقليل المصاريف غير الضرورية أو تسريع تحصيل الإيرادات لتجنب أزمة سيولة.`, bodySv: `Kassabana ${Math.round(adv.cashRunway)} dagar. Minska kostnader eller påskynda inkomster.` });
  if (adv.profitVelocity !== null && adv.profitVelocity < -15)
    recs.push({ id: "velocity", icon: "📉", priority: "high", titleAr: "تراجع متسارع في الأرباح", titleSv: "Accelererande vintnedgång", bodyAr: `الأرباح تراجعت ${Math.abs(adv.profitVelocity).toFixed(0)}% مقارنة بالشهر السابق. ابحث عن سبب هذا التراجع المفاجئ — هل ارتفعت المصاريف أم انخفضت المبيعات؟`, bodySv: `Vinsten minskade ${Math.abs(adv.profitVelocity).toFixed(0)}% mot förra månaden.` });
  if (m.laborRatio !== null && m.laborRatio > 25)
    recs.push({ id: "labor", icon: "👷", priority: "medium", titleAr: "مراجعة تكاليف العمالة", titleSv: "Se över arbetskostnader", bodyAr: `تكلفة العمالة ${m.laborRatio.toFixed(0)}% — أعلى من المعيار. هل يمكن زيادة الإنتاجية أو اعتماد جدول عمل أكثر كفاءة؟`, bodySv: `Arbetskostnad ${m.laborRatio.toFixed(0)}% — Över standarden.` });
  if (adv.bestMonth && monthly.length >= 3)
    recs.push({ id: "best_replicate", icon: "🏆", priority: "medium", titleAr: `كرّر نجاح ${adv.bestMonth.monthAr}`, titleSv: `Upprepa ${adv.bestMonth.month}s framgång`, bodyAr: `أفضل شهر لديك كان ${adv.bestMonth.monthAr} بربح ${fmtAmount(adv.bestMonth.profit)}. حلّل ما اختلف في ذلك الشهر من حيث الأسعار والكميات واعمل على تكراره.`, bodySv: `Bästa månaden var ${adv.bestMonth.month} med ${fmtAmount(adv.bestMonth.profit, "sv")} i vinst.` });
  if (adv.incomeCV !== null && adv.incomeCV > 40)
    recs.push({ id: "stability", icon: "📅", priority: "medium", titleAr: "استقرار الدخل منخفض", titleSv: "Inkomsterna är instabila", bodyAr: `معامل تذبذب دخلك ${adv.incomeCV.toFixed(0)}% — مرتفع. هذا يجعل التخطيط صعباً. فكّر في عقود بيع دورية مع عملاء ثابتين لضمان تدفق نقدي منتظم.`, bodySv: `Inkomstens variationskoefficient ${adv.incomeCV.toFixed(0)}% är hög.` });
  if (m.netProfit > 0 && monthly.length >= 3)
    recs.push({ id: "reinvest", icon: "🚀", priority: "low", titleAr: "إعادة استثمار الأرباح", titleSv: "Återinvestera vinsten", bodyAr: `أنت تحقق أرباحاً جيدة (${fmtAmount(m.netProfit)}). فكّر في إعادة استثمار جزء منها في زيادة الطاقة الإنتاجية أو تحسين المعدات لتضاعف العائد مستقبلاً.`, bodySv: `Du genererar vinst ${fmtAmount(m.netProfit, "sv")}. Överväg att återinvestera.` });
  return recs.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]));
}

// ─── Feed Metrics ────────────────────────────────────────────────────────────
interface FeedMetrics { totalFeedKg: number; totalFeedCost: number; dailyFeedKg: number; feedPerBirdKg: number | null; feedCostPerKg: number | null; feedCostPerBird: number | null; trackedEntries: number; untrackedEntries: number; monthlyFeed: { month: string; monthAr: string; kg: number; cost: number }[]; fcrGrade: "excellent" | "good" | "fair" | "high"; }
function computeFeedMetrics(allTxs: Tx[], flocks: Flock[], periodTxs: Tx[], periodDays: number): FeedMetrics {
  const feedTxs = periodTxs.filter(t => t.type === "expense" && t.category === "feed");
  const totalFeedCost = feedTxs.reduce((s, t) => s + Number(t.amount), 0);
  let totalFeedKg = 0, tracked = 0, untracked = 0;
  feedTxs.forEach(t => { const kg = parseFeedKg(t.quantity, t.unit); kg !== null ? (totalFeedKg += kg, tracked++) : untracked++; });
  const totalBirds = flocks.reduce((s, f) => s + f.count, 0);
  const feedPerBirdKg  = totalFeedKg > 0 && totalBirds > 0 ? totalFeedKg / totalBirds : null;
  const feedCostPerKg  = totalFeedKg > 0 ? totalFeedCost / totalFeedKg : null;
  const feedCostPerBird = totalBirds > 0 && totalFeedCost > 0 ? totalFeedCost / totalBirds : null;
  const dailyFeedKg = periodDays > 0 && totalFeedKg > 0 ? totalFeedKg / periodDays : 0;
  const mMap: Record<string, { kg: number; cost: number }> = {};
  allTxs.filter(t => t.type === "expense" && t.category === "feed").forEach(t => {
    const mo = t.date.slice(0, 7);
    if (!mMap[mo]) mMap[mo] = { kg: 0, cost: 0 };
    mMap[mo].cost += Number(t.amount);
    const kg = parseFeedKg(t.quantity, t.unit);
    if (kg !== null) mMap[mo].kg += kg;
  });
  const monthlyFeed = Object.entries(mMap).sort(([a], [b]) => a.localeCompare(b)).map(([m, d]) => ({ month: m.slice(5), monthAr: AR_M[parseInt(m.slice(5)) - 1] ?? m, ...d }));
  const fcrGrade: FeedMetrics["fcrGrade"] = feedPerBirdKg === null ? "good" : feedPerBirdKg < 3 ? "excellent" : feedPerBirdKg <= 5 ? "good" : feedPerBirdKg <= 7 ? "fair" : "high";
  return { totalFeedKg, totalFeedCost, dailyFeedKg, feedPerBirdKg, feedCostPerKg, feedCostPerBird, trackedEntries: tracked, untrackedEntries: untracked, monthlyFeed, fcrGrade };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  UI COMPONENTS (Accessible — no nested <button>)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── InfoTip — uses <span> so it can safely live inside <button> ──────────────
function InfoTip({ metricKey, ar }: { metricKey: string; ar: boolean }) {
  const [open, setOpen] = useState(false);
  const info = GLOSSARY[metricKey];
  if (!info) return null;
  return (
    <span className="relative inline-flex">
      <span
        role="button" tabIndex={0}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        onKeyDown={e => e.key === "Enter" && setOpen(o => !o)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-all text-[9px] font-bold text-muted-foreground shrink-0 cursor-pointer select-none"
        title={ar ? "اضغط لمعرفة المزيد" : "Klicka för mer info"}>
        ⓘ
      </span>
      {open && (
        <>
          <span className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <span className={cn("absolute z-50 w-72 bg-background border border-border/60 rounded-2xl shadow-2xl p-4 block", ar ? "right-0" : "left-0", "top-6")}>
            <span className="flex items-start justify-between mb-2 gap-2">
              <span className={cn("text-xs font-black block", info.colorClass)}>{ar ? info.nameAr : info.nameSv}</span>
              <span role="button" tabIndex={0} onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X className="w-3 h-3" /></span>
            </span>
            <span className="block bg-muted/40 rounded-xl px-3 py-2 mb-2.5 font-mono text-[10px] text-muted-foreground leading-relaxed">{info.formulaAr}</span>
            <span className="block text-[10px] text-foreground leading-relaxed mb-2">{ar ? info.descAr : info.descSv}</span>
            <span className="block border-t border-border/40 pt-2 text-[9px] text-muted-foreground leading-relaxed">{ar ? info.benchmarkAr : info.benchmarkSv}</span>
          </span>
        </>
      )}
    </span>
  );
}

// ─── Drill Modal ──────────────────────────────────────────────────────────────
function DrillModal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-black">{title}</DialogTitle>
          <DialogDescription className="text-[10px] text-muted-foreground">{title}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

// ─── Live Badge ───────────────────────────────────────────────────────────────
function LiveBadge({ fetching }: { fetching: boolean }) {
  const [sec, setSec] = useState(0);
  useEffect(() => { const id = setInterval(() => setSec(s => s + 1), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { setSec(0); }, [fetching]);
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
      {fetching ? <RefreshCw className="w-3 h-3 animate-spin text-blue-500" /> : <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />}
      <span className="hidden sm:inline">Live · {sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m`}</span>
    </div>
  );
}

// ─── KPI Tile (div-based to avoid nested button) ──────────────────────────────
function KpiTile({ label, value, sub, icon: Icon, colorTop, iconColor, trend, infoKey, ar, onClick, deltaLabel }: {
  label: string; value: string; sub?: string; icon: any; colorTop: string; iconColor: string;
  trend?: "up" | "down" | null; infoKey?: string; ar: boolean; onClick?: () => void; deltaLabel?: string;
}) {
  return (
    <div
      role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick}
      onKeyDown={onClick ? e => e.key === "Enter" && onClick() : undefined}
      className={cn("w-full text-start rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden transition-all duration-200", onClick && "cursor-pointer hover:shadow-md hover:border-border active:scale-[0.98]")}>
      <div className={cn("h-0.5 w-full", colorTop)} />
      <div className="p-3.5">
        <div className="flex items-start justify-between mb-1.5">
          <div className="w-8 h-8 rounded-xl bg-muted/40 flex items-center justify-center shrink-0">
            <Icon className={cn("w-4 h-4", iconColor)} />
          </div>
          <div className="flex items-center gap-1">
            {trend === "up"   && <TrendingUp   className="w-3.5 h-3.5 text-emerald-500" />}
            {trend === "down" && <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
            {/* InfoTip only shown when tile is NOT clickable — avoids stopPropagation conflict */}
            {infoKey && !onClick && <InfoTip metricKey={infoKey} ar={ar} />}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className="text-sm font-black truncate leading-snug">{value}</p>
        {sub && <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
        {deltaLabel && (
          <p className="text-[9px] mt-0.5 font-semibold"
            style={{ color: deltaLabel.startsWith("+") ? "#10b981" : deltaLabel.startsWith("−") ? "#ef4444" : "#94a3b8" }}>
            {deltaLabel}
          </p>
        )}
        {onClick && <p className="text-[8px] text-muted-foreground/50 mt-1 flex items-center gap-0.5"><Eye className="w-2 h-2" />{ar ? "اضغط للتفاصيل" : "Tryck"}</p>}
      </div>
    </div>
  );
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────
function AlertBanner({ alerts, ar }: { alerts: Alert[]; ar: boolean }) {
  const [dismissed, setDismissed] = useState(new Set<string>());
  const visible = alerts.filter(a => !dismissed.has(a.id));
  if (!visible.length) return null;
  const cfg = { critical: "bg-red-50 dark:bg-red-950/30 border-red-200 text-red-700 dark:text-red-300", warning: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 text-amber-700 dark:text-amber-300", info: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 text-blue-700 dark:text-blue-300" };
  return (
    <div className="space-y-2">
      {visible.slice(0, 4).map(a => (
        <div key={a.id} className={cn("rounded-xl border px-3.5 py-2.5 flex items-start gap-2.5", cfg[a.severity])}>
          {a.severity === "info" ? <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
          <p className="text-[11px] font-medium flex-1 leading-relaxed">{ar ? a.ar : a.sv}</p>
          <button onClick={() => setDismissed(s => new Set([...s, a.id]))} className="text-xs opacity-60 hover:opacity-100">×</button>
        </div>
      ))}
    </div>
  );
}

// ─── Health Gauge (SVG arc) ───────────────────────────────────────────────────
function HealthGauge({ score, grade }: { score: number; grade: string }) {
  const R = 52; const cx = 65; const cy = 65; const circ = Math.PI * R;
  const dash = (Math.min(score, 100) / 100) * circ;
  const GC = { excellent: { stroke: "#10b981", text: "#059669" }, good: { stroke: "#3b82f6", text: "#2563eb" }, fair: { stroke: "#f59e0b", text: "#d97706" }, poor: { stroke: "#ef4444", text: "#dc2626" } };
  const gc = GC[grade as keyof typeof GC] ?? GC.poor;
  return (
    <svg width="130" height="82" viewBox="0 0 130 82">
      <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
      <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none" stroke={gc.stroke} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }} />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="22" fontWeight="900" fill={gc.text}>{score}</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="9" fill="#94a3b8">/100</text>
    </svg>
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
          <span className="font-bold">{typeof p.value === "number" && Math.abs(p.value) > 1000 ? fmtAmount(p.value, ar ? "ar" : "sv") : typeof p.value === "number" ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Recommendations Panel ────────────────────────────────────────────────────
function RecommendationsPanel({ recs, ar }: { recs: Rec[]; ar: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (recs.length === 0) return null;
  const pc = { high: "border-red-200 bg-red-50 dark:bg-red-950/20", medium: "border-amber-200 bg-amber-50 dark:bg-amber-950/20", low: "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20" };
  const tc = { high: "text-red-700 dark:text-red-300", medium: "text-amber-700 dark:text-amber-300", low: "text-emerald-700 dark:text-emerald-300" };
  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-yellow-500" />
          {ar ? "توصيات الذكاء المالي" : "Finansiella rekommendationer"}
          <Badge className="text-[9px] ms-auto">{recs.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {recs.slice(0, 6).map(r => (
          <div key={r.id} className={cn("rounded-xl border px-3.5 py-2.5 cursor-pointer transition-all", pc[r.priority])} onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{r.icon}</span>
                <p className={cn("text-[11px] font-bold", tc[r.priority])}>{ar ? r.titleAr : r.titleSv}</p>
              </div>
              <span className={cn("text-[10px]", tc[r.priority])}>{expanded === r.id ? "▲" : "▼"}</span>
            </div>
            {expanded === r.id && (
              <p className={cn("text-[10px] mt-2 leading-relaxed border-t border-current/20 pt-2", tc[r.priority])}>{ar ? r.bodyAr : r.bodySv}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Month Detail Modal ───────────────────────────────────────────────────────
function buildMonthExplanation(month: MonthRow, allMonths: MonthRow[], type: "best" | "worst", ar: boolean): string[] {
  const avg = allMonths.length > 1
    ? allMonths.filter(m => m.month !== month.month)
    : allMonths;
  const avgIncome  = avg.reduce((s, m) => s + m.income, 0) / Math.max(1, avg.length);
  const avgExpense = avg.reduce((s, m) => s + m.expense, 0) / Math.max(1, avg.length);
  const reasons: string[] = [];

  if (type === "best") {
    if (month.income > avgIncome * 1.1)
      reasons.push(ar ? `📈 الإيرادات أعلى من المتوسط بنسبة ${((month.income / avgIncome - 1) * 100).toFixed(0)}%` : `📈 Intäkterna ${((month.income / avgIncome - 1) * 100).toFixed(0)}% över genomsnittet`);
    if (month.expense < avgExpense * 0.92)
      reasons.push(ar ? `💰 المصاريف أقل من المتوسط بنسبة ${((1 - month.expense / avgExpense) * 100).toFixed(0)}%` : `💰 Kostnaderna ${((1 - month.expense / avgExpense) * 100).toFixed(0)}% under genomsnittet`);
    if (month.profit > 0 && month.expense > 0)
      reasons.push(ar ? `✅ هامش ربح: ${((month.profit / month.income) * 100).toFixed(1)}%` : `✅ Vinstmarginal: ${((month.profit / month.income) * 100).toFixed(1)}%`);
    if (reasons.length === 0)
      reasons.push(ar ? "📊 أفضل توازن بين الإيرادات والمصاريف مقارنةً بالأشهر الأخرى" : "📊 Bästa balansen mellan intäkter och kostnader");
  } else {
    if (month.income < avgIncome * 0.9)
      reasons.push(ar ? `📉 الإيرادات أقل من المتوسط بنسبة ${((1 - month.income / avgIncome) * 100).toFixed(0)}%` : `📉 Intäkterna ${((1 - month.income / avgIncome) * 100).toFixed(0)}% under genomsnittet`);
    if (month.expense > avgExpense * 1.1)
      reasons.push(ar ? `🔺 المصاريف أعلى من المتوسط بنسبة ${((month.expense / avgExpense - 1) * 100).toFixed(0)}%` : `🔺 Kostnaderna ${((month.expense / avgExpense - 1) * 100).toFixed(0)}% över genomsnittet`);
    if (month.profit < 0)
      reasons.push(ar ? `⛔ خسارة صافية: ${fmtAmount(Math.abs(month.profit), ar ? "ar" : "sv")} دينار` : `⛔ Nettoförlust: ${fmtAmount(Math.abs(month.profit), "sv")}`);
    if (reasons.length === 0)
      reasons.push(ar ? "📊 أدنى توازن بين الإيرادات والمصاريف مقارنةً بالأشهر الأخرى" : "📊 Sämsta balansen mellan intäkter och kostnader");
    reasons.push(ar ? "💡 راجع أكبر بند مصاريف وابحث عن فرص تخفيض التكاليف" : "💡 Granska den största kostnadsposten och leta efter besparingsmöjligheter");
  }
  return reasons;
}

function MonthDetailModal({ month, type, allMonths, ar, lang, onClose }: {
  month: MonthRow; type: "best" | "worst"; allMonths: MonthRow[]; ar: boolean; lang: string; onClose: () => void;
}) {
  const isBest = type === "best";
  const reasons = buildMonthExplanation(month, allMonths, type, ar);
  const isLoss = month.profit < 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {isBest ? <Trophy className="w-4 h-4 text-yellow-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
            {isBest
              ? (ar ? `أفضل شهر — ${month.monthAr}` : `Bästa månaden — ${month.month}`)
              : (ar ? `أسوأ شهر — ${month.monthAr}` : `Sämsta månaden — ${month.month}`)}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isBest
              ? (ar ? "تفاصيل الأداء المالي لأفضل شهر" : "Finansiell prestation för bästa månaden")
              : (ar ? "تحليل الخسائر والأسباب الرئيسية" : "Förlustanalys och huvudorsaker")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Financials */}
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
              {ar ? "الأرقام المالية" : "Finansiella siffror"}
            </div>
            <div className="divide-y divide-border/40">
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-xs text-muted-foreground">{ar ? "إجمالي الإيرادات" : "Totala intäkter"}</span>
                <span className="text-sm font-bold text-emerald-600">+{fmtAmount(month.income, lang as any)}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-xs text-muted-foreground">{ar ? "إجمالي المصاريف" : "Totala kostnader"}</span>
                <span className="text-sm font-bold text-red-500">-{fmtAmount(month.expense, lang as any)}</span>
              </div>
              <div className={cn("flex items-center justify-between px-3 py-2.5", isLoss ? "bg-red-50 dark:bg-red-950/20" : "bg-emerald-50 dark:bg-emerald-950/20")}>
                <span className="text-xs font-semibold">{ar ? "صافي الربح / الخسارة" : "Nettoresultat"}</span>
                <span className={cn("text-sm font-black", isLoss ? "text-red-600" : "text-emerald-600")}>
                  {isLoss ? "-" : "+"}{fmtAmount(Math.abs(month.profit), lang as any)}
                </span>
              </div>
              {month.income > 0 && (
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-xs text-muted-foreground">{ar ? "هامش الربح" : "Vinstmarginal"}</span>
                  <span className={cn("text-sm font-bold", isLoss ? "text-red-500" : "text-blue-600")}>
                    {((month.profit / month.income) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Why section */}
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
              {isBest
                ? (ar ? "لماذا هو الأفضل؟" : "Varför bäst?")
                : (ar ? "الأسباب الرئيسية" : "Huvudorsaker")}
            </div>
            <ul className="divide-y divide-border/40">
              {reasons.map((r, i) => (
                <li key={i} className="px-3 py-2 text-xs leading-relaxed">{r}</li>
              ))}
            </ul>
          </div>

          {/* Suggestion for worst */}
          {!isBest && (
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200/60 p-3">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                  {ar
                    ? "قارن هذا الشهر مع أفضل شهر لديك وحدّد الفارق في المصاريف والإيرادات لتجنّب تكرار هذه النتائج."
                    : "Jämför denna månad med din bästa månad och identifiera skillnader i kostnader och intäkter."}
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Best/Worst Month Card ────────────────────────────────────────────────────
function BestWorstCard({ adv, monthly, ar, lang }: { adv: AdvMetrics; monthly: MonthRow[]; ar: boolean; lang: string }) {
  const [detailMonth, setDetailMonth] = useState<{ month: MonthRow; type: "best" | "worst" } | null>(null);

  if (monthly.length === 0) return null;

  return (
    <>
      {detailMonth && (
        <MonthDetailModal
          month={detailMonth.month}
          type={detailMonth.type}
          allMonths={monthly}
          ar={ar}
          lang={lang}
          onClose={() => setDetailMonth(null)}
        />
      )}

      {/* All months in loss — show warning */}
      {adv.allMonthsInLoss && (
        <div className="rounded-2xl bg-gradient-to-br from-orange-500/90 to-red-600 p-4 text-white shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-yellow-300" />
            <p className="text-xs font-bold text-orange-100">{ar ? "لا يوجد شهر مربح بعد" : "Ingen lönsam månad ännu"}</p>
          </div>
          <p className="text-sm font-semibold">
            {ar ? "⚠️ جميع الأشهر في خسارة — راجع هيكل التكاليف فوراً" : "⚠️ Alla månader på förlust — granska kostnadsstrukturen"}
          </p>
          <p className="text-[10px] mt-1 text-orange-200">
            {ar ? `إجمالي الخسارة: ${fmtAmount(Math.abs(monthly.reduce((s, m) => s + m.profit, 0)), lang as any)}` : `Total förlust: ${fmtAmount(Math.abs(monthly.reduce((s, m) => s + m.profit, 0)), "sv")}`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {adv.bestMonth ? (
          <button
            className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white shadow-md text-start cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all"
            onClick={() => setDetailMonth({ month: adv.bestMonth!, type: "best" })}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Trophy className="w-3.5 h-3.5 text-yellow-300" />
              <p className="text-[10px] font-bold text-emerald-100">{ar ? "أفضل شهر" : "Bästa månaden"}</p>
              <ArrowRight className="w-3 h-3 text-emerald-200 mr-auto" />
            </div>
            <p className="text-base font-black">{ar ? adv.bestMonth.monthAr : adv.bestMonth.month}</p>
            <p className="text-sm font-black text-yellow-300">+{fmtAmount(adv.bestMonth.profit, lang as any)}</p>
            {adv.profitableStreak > 1 && <p className="text-[9px] mt-1 text-emerald-100">🔥 {ar ? `${adv.profitableStreak} شهور مربحة` : `${adv.profitableStreak} lönsamma månader`}</p>}
            <p className="text-[9px] mt-1.5 text-emerald-200 underline underline-offset-2">{ar ? "اضغط للتفاصيل" : "Klicka för detaljer"}</p>
          </button>
        ) : (
          <div className="rounded-2xl bg-muted/60 border border-border/60 p-4 flex flex-col items-start justify-center">
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy className="w-3.5 h-3.5 text-muted-foreground/50" />
              <p className="text-[10px] font-bold text-muted-foreground">{ar ? "أفضل شهر" : "Bästa månaden"}</p>
            </div>
            <p className="text-xs font-semibold text-muted-foreground">{ar ? "لا يوجد بعد" : "Ännu inte"}</p>
          </div>
        )}

        {adv.worstMonth && (
          <button
            className="rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 p-4 text-white shadow-md text-start cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all"
            onClick={() => setDetailMonth({ month: adv.worstMonth!, type: "worst" })}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
              <p className="text-[10px] font-bold text-slate-300">{ar ? "أسوأ شهر" : "Sämsta månaden"}</p>
              <ArrowRight className="w-3 h-3 text-slate-400 mr-auto" />
            </div>
            <p className="text-base font-black">{ar ? adv.worstMonth.monthAr : adv.worstMonth.month}</p>
            <p className="text-sm font-black text-red-400">{adv.worstMonth.profit >= 0 ? "+" : ""}{fmtAmount(adv.worstMonth.profit, lang as any)}</p>
            <p className="text-[9px] mt-1.5 text-slate-400 underline underline-offset-2">{ar ? "اضغط للتفاصيل" : "Klicka för detaljer"}</p>
          </button>
        )}
      </div>
    </>
  );
}

// ─── Edit Transaction Dialog ──────────────────────────────────────────────────
function EditTxModal({ tx, open, onClose, onSaved, ar }: { tx: Tx | null; open: boolean; onClose: () => void; onSaved: () => void; ar: boolean }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: "", description: "", amount: "", notes: "" });
  useEffect(() => { if (tx) setForm({ date: tx.date, description: tx.description, amount: tx.amount, notes: tx.notes ?? "" }); }, [tx]);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const handleSave = async () => {
    if (!tx) return;
    setSaving(true);
    try {
      await apiFetch(`/api/transactions/${tx.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: form.date, description: form.description, amount: Number(form.amount), notes: form.notes || null }) });
      toast({ title: ar ? "✅ تم التحديث" : "✅ Uppdaterad" });
      onSaved(); onClose();
    } catch (e: any) { toast({ variant: "destructive", title: e.message }); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-black">{ar ? "تحرير المعاملة" : "Redigera transaktion"}</DialogTitle>
          <DialogDescription className="text-[10px]">{ar ? "يمكنك تعديل التاريخ والوصف والمبلغ" : "Du kan ändra datum, beskrivning och belopp"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div><Label className="text-xs mb-1 block">{ar ? "التاريخ" : "Datum"}</Label><Input type="date" value={form.date} onChange={e => set("date", e.target.value)} className="h-9" /></div>
          <div><Label className="text-xs mb-1 block">{ar ? "الوصف" : "Beskrivning"}</Label><Input value={form.description} onChange={e => set("description", e.target.value)} className="h-9" /></div>
          <div><Label className="text-xs mb-1 block">{ar ? "المبلغ (د.ع)" : "Belopp (IQD)"}</Label><Input type="number" value={form.amount} onChange={e => set("amount", e.target.value)} className="h-9" /></div>
          <div><Label className="text-xs mb-1 block">{ar ? "ملاحظات" : "Anteckningar"}</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} className="h-14 resize-none text-sm" /></div>
          <Button onClick={handleSave} disabled={saving} className="w-full h-10 bg-primary text-primary-foreground font-bold text-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : ar ? "حفظ التغييرات" : "Spara ändringar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Transaction Form ─────────────────────────────────────────────────────
function AddTransactionForm({ ar, onSuccess }: { ar: boolean; onSuccess: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ type: "expense" as "income" | "expense", date: new Date().toISOString().split("T")[0], category: "", description: "", amount: "", qty: "", unitPrice: "", unit: "", notes: "", useCalc: false });
  const [saving, setSaving] = useState(false);
  const cats = form.type === "expense" ? EXPENSE_CATS : INCOME_CATS;
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));
  const calcAmount = useMemo(() => form.useCalc && form.qty && form.unitPrice ? (Number(form.qty) * Number(form.unitPrice)).toFixed(0) : form.amount, [form]);
  const selectedCat = cats.find(c => c.id === form.category);
  const finalAmt = form.useCalc ? calcAmount : form.amount;
  const handleSave = async () => {
    if (!form.date || !form.category || !form.description || !finalAmt) { toast({ variant: "destructive", title: ar ? "أكمل الحقول المطلوبة" : "Fyll i alla fält" }); return; }
    setSaving(true);
    try {
      await apiFetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: form.date, type: form.type, category: form.category, description: form.description, amount: Number(finalAmt), quantity: form.qty ? Number(form.qty) : null, unit: form.unit || null, notes: form.notes || null }) });
      toast({ title: ar ? "✅ تمت إضافة المعاملة" : "✅ Transaktion tillagd" });
      setForm(f => ({ ...f, category: "", description: "", amount: "", qty: "", unitPrice: "", unit: "", notes: "" }));
      onSuccess();
    } catch (e: any) { toast({ variant: "destructive", title: e.message }); }
    finally { setSaving(false); }
  };
  return (
    <div className="space-y-5">
      <div className="flex rounded-xl overflow-hidden border border-border/60 p-0.5 bg-muted/30">
        {(["expense", "income"] as const).map(t => (
          <button key={t} onClick={() => set("type", t)} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all", form.type === t ? (t === "expense" ? "bg-red-500 text-white shadow-sm" : "bg-emerald-500 text-white shadow-sm") : "text-muted-foreground")}>
            {t === "expense" ? <><ArrowDownCircle className="w-4 h-4" />{ar ? "مصروف" : "Kostnad"}</> : <><ArrowUpCircle className="w-4 h-4" />{ar ? "دخل" : "Inkomst"}</>}
          </button>
        ))}
      </div>
      <div><Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5 text-muted-foreground"><Calendar className="w-3.5 h-3.5" />{ar ? "التاريخ" : "Datum"} *</Label><Input type="date" value={form.date} onChange={e => set("date", e.target.value)} className="h-10" /></div>
      <div>
        <Label className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-muted-foreground"><Layers className="w-3.5 h-3.5" />{ar ? "الفئة" : "Kategori"} *</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {cats.map(c => (
            <button key={c.id} onClick={() => set("category", c.id)} className={cn("flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all", form.category === c.id ? (form.type === "expense" ? "border-red-400 bg-red-50 dark:bg-red-950/20" : "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20") : "border-border/40 hover:border-border hover:bg-muted/40")}>
              <span className="text-base">{c.icon}</span>
              <span className="text-[9px] font-medium">{ar ? c.ar : c.sv}</span>
            </button>
          ))}
        </div>
        {form.category === "feed" && (
          <div className="mt-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 px-3 py-2.5">
            <p className="text-[10px] font-bold text-amber-700 flex items-center gap-1.5 mb-1.5"><Wheat className="w-3 h-3" />{ar ? "أدخل وزن العلف لتفعيل تحليل الاستهلاك" : "Ange fodervikt för förbrukningsanalys"}</p>
            <div className="flex gap-1 flex-wrap">
              {["كيلو","كغ","طن"].map(u => (
                <button key={u} onClick={() => { set("unit", u); set("useCalc", true); }} className={cn("text-[9px] px-2 py-0.5 rounded-md border font-bold transition-all", form.unit === u ? "bg-amber-500 text-white border-amber-500" : "bg-white dark:bg-transparent border-amber-300 text-amber-700")}>{u}</button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div><Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5 text-muted-foreground"><FileText className="w-3.5 h-3.5" />{ar ? "الوصف" : "Beskrivning"} *</Label><Input value={form.description} onChange={e => set("description", e.target.value)} placeholder={ar ? "وصف المعاملة..." : "Transaktionsbeskrivning..."} className="h-10" /></div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground"><CircleDollarSign className="w-3.5 h-3.5" />{ar ? "المبلغ" : "Belopp"} *</Label>
          <button onClick={() => set("useCalc", !form.useCalc)} className={cn("text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-all", form.useCalc ? "bg-blue-50 border-blue-200 text-blue-600" : "border-border/60 text-muted-foreground")}>{ar ? (form.useCalc ? "كمية×سعر ✓" : "كمية×سعر") : (form.useCalc ? "Antal×Pris ✓" : "Antal×Pris")}</button>
        </div>
        {form.useCalc ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-[10px] text-muted-foreground mb-1 block">{ar ? "الكمية" : "Antal"}</Label><Input type="number" value={form.qty} onChange={e => set("qty", e.target.value)} placeholder="0" className="h-9 text-sm" /></div>
              <div><Label className="text-[10px] text-muted-foreground mb-1 block">{ar ? "الوحدة" : "Enhet"}</Label><Input value={form.unit} onChange={e => set("unit", e.target.value)} placeholder="كغ" className="h-9 text-sm" /></div>
              <div><Label className="text-[10px] text-muted-foreground mb-1 block">{ar ? "سعر الوحدة" : "Styckpris"}</Label><Input type="number" value={form.unitPrice} onChange={e => set("unitPrice", e.target.value)} placeholder="0" className="h-9 text-sm" /></div>
            </div>
            <div className={cn("rounded-xl p-3 flex justify-between items-center", form.type === "expense" ? "bg-red-50 dark:bg-red-950/20" : "bg-emerald-50 dark:bg-emerald-950/20")}>
              <span className="text-xs text-muted-foreground">{ar ? "الإجمالي:" : "Totalt:"}</span>
              <span className={cn("text-sm font-black", form.type === "expense" ? "text-red-600" : "text-emerald-600")}>{calcAmount ? fmtAmount(Number(calcAmount)) : "—"}</span>
            </div>
          </div>
        ) : (
          <Input type="number" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder={ar ? "المبلغ بالدينار العراقي" : "Belopp i IQD"} className="h-10" />
        )}
      </div>
      <div><Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5 text-muted-foreground"><Info className="w-3.5 h-3.5" />{ar ? "ملاحظات" : "Anteckningar"}</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder={ar ? "تفاصيل إضافية..." : "Ytterligare detaljer..."} className="h-16 text-sm resize-none" /></div>
      {form.category && form.description && Number(finalAmt) > 0 && (
        <div className={cn("rounded-xl border-2 p-3.5", form.type === "expense" ? "border-red-200 bg-red-50/50 dark:border-red-800/40 dark:bg-red-950/10" : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/10")}>
          <p className="text-[10px] text-muted-foreground mb-1">{ar ? "معاينة" : "Förhandsgranskning"}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><span className="text-xl">{selectedCat?.icon ?? "📦"}</span><div><p className="text-xs font-bold">{form.description}</p><p className="text-[10px] text-muted-foreground">{form.date}</p></div></div>
            <span className={cn("text-base font-black", form.type === "expense" ? "text-red-600" : "text-emerald-600")}>{form.type === "expense" ? "−" : "+"}{fmtAmount(Number(finalAmt))}</span>
          </div>
        </div>
      )}
      <Button onClick={handleSave} disabled={saving || !form.category || !form.description || !(Number(finalAmt) > 0)}
        className={cn("w-full h-12 text-sm font-bold shadow-md border-none", form.type === "expense" ? "bg-gradient-to-r from-red-500 to-rose-600 text-white" : "bg-gradient-to-r from-emerald-500 to-teal-600 text-white")}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 me-2" />{ar ? "حفظ المعاملة" : "Spara transaktion"}</>}
      </Button>
    </div>
  );
}

// ─── Simulator Tab ────────────────────────────────────────────────────────────
function SimulatorTab({ m, flocks, ar, lang }: { m: FinMetrics; flocks: Flock[]; ar: boolean; lang: string }) {
  const [feedΔ, setFeedΔ]   = useState(0);
  const [salesΔ, setSalesΔ] = useState(0);
  const [birdsΔ, setBirdsΔ] = useState(0);
  const [laborΔ, setLaborΔ] = useState(0);
  const sim = useMemo(() => {
    const nFC = m.feedCostRaw  * (1 + feedΔ / 100);
    const nLC = m.laborCostRaw * (1 + laborΔ / 100);
    const nExp = Math.max(0, m.totalExpense + (nFC - m.feedCostRaw) + (nLC - m.laborCostRaw));
    const nInc = Math.max(0, m.totalIncome * (1 + salesΔ / 100));
    const nPro = nInc - nExp;
    const nMar = nInc > 0 ? (nPro / nInc) * 100 : null;
    const nROI = nExp > 0 ? (nPro / nExp) * 100 : null;
    const tB   = flocks.reduce((s, f) => s + f.count, 0);
    const nBirds = Math.round(tB * (1 + birdsΔ / 100));
    const nCPB = nBirds > 0 ? nExp / nBirds : null;
    return { nInc, nExp, nPro, nMar, nROI, nBirds, nCPB };
  }, [m, feedΔ, salesΔ, birdsΔ, laborΔ, flocks]);

  const SRow = ({ label, value, onChange, info }: { label: string; value: number; onChange: (v: number) => void; info: string }) => (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-1.5">
        <div><p className="text-xs font-semibold">{label}</p><p className="text-[9px] text-muted-foreground">{info}</p></div>
        <span className={cn("text-sm font-black min-w-[40px] text-end", value > 0 ? "text-emerald-600" : value < 0 ? "text-red-600" : "text-muted-foreground")}>{value > 0 ? "+" : ""}{value}%</span>
      </div>
      <input type="range" min="-50" max="100" step="5" value={value} onChange={e => onChange(Number(e.target.value))} className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary" />
      <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5"><span>−50%</span><span>0</span><span>+100%</span></div>
    </div>
  );
  const CRow = ({ label, cur, sim: sv, up }: { label: string; cur: number | null; sim: number | null; up: boolean }) => {
    const delta = cur !== null && sv !== null ? sv - cur : null;
    const good = delta !== null && (up ? delta > 0 : delta < 0);
    const bad  = delta !== null && (up ? delta < 0 : delta > 0);
    return (
      <div className="flex items-center justify-between py-2 border-b border-border/30 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{cur !== null ? (Math.abs(cur) > 1000 ? fmtAmount(cur, lang as any) : `${cur.toFixed(1)}%`) : "—"}</span>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <span className={cn("font-bold", good ? "text-emerald-600" : bad ? "text-red-600" : "")}>{sv !== null ? (Math.abs(sv) > 1000 ? fmtAmount(sv, lang as any) : `${sv.toFixed(1)}%`) : "—"}</span>
          {delta !== null && <span className={cn("text-[9px]", good ? "text-emerald-500" : bad ? "text-red-500" : "")}>{delta > 0.01 ? "▲" : delta < -0.01 ? "▼" : "─"}</span>}
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 p-5 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-1.5"><FlaskConical className="w-5 h-5 text-indigo-200" /><h2 className="text-sm font-black">{ar ? "محاكاة السيناريوهات المالية" : "Finansiell scenariosimulering"}</h2></div>
        <p className="text-[10px] text-indigo-200">{ar ? "حرّك الأشرطة وشاهد التأثير الفوري على كل المؤشرات المالية" : "Dra reglagen och se omedelbar påverkan på alla finansiella nyckeltal"}</p>
      </div>
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm flex items-center gap-2"><Sliders className="w-4 h-4 text-purple-500" />{ar ? "متغيرات المحاكاة" : "Simuleringsvariabler"}</CardTitle></CardHeader>
        <CardContent className="px-4 pb-4">
          <SRow label={ar ? "تغيير في أسعار المبيعات" : "Förändring i försäljningspriser"} value={salesΔ} onChange={setSalesΔ} info={ar ? "ماذا لو ارتفع / انخفض الدخل؟" : "Vad händer om intäkterna förändras?"} />
          <SRow label={ar ? "تغيير في سعر العلف" : "Förändring i foderpris"} value={feedΔ} onChange={setFeedΔ} info={ar ? "ماذا لو تغير سعر العلف؟" : "Vad händer om foderpriset ändras?"} />
          <SRow label={ar ? "تغيير في تكاليف العمالة" : "Förändring i arbetskostnader"} value={laborΔ} onChange={setLaborΔ} info={ar ? "ماذا لو تغيرت رواتب العمال؟" : "Vad händer om lönerna ändras?"} />
          <SRow label={ar ? "تغيير في عدد الطيور" : "Förändring i antal fåglar"} value={birdsΔ} onChange={setBirdsΔ} info={ar ? "ماذا لو تغير حجم القطيع؟" : "Vad händer om flockstorleken ändras?"} />
          <Button variant="outline" onClick={() => { setFeedΔ(0); setSalesΔ(0); setBirdsΔ(0); setLaborΔ(0); }} className="w-full h-8 text-xs mt-1">{ar ? "إعادة تعيين" : "Återställ"}</Button>
        </CardContent>
      </Card>
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm flex items-center gap-2"><GitBranch className="w-4 h-4 text-indigo-500" />{ar ? "المقارنة: الحالي ← المحاكاة" : "Jämförelse: Nuv. ← Simulerat"}</CardTitle></CardHeader>
        <CardContent className="px-4 pb-4">
          <CRow label={ar ? "إجمالي الدخل" : "Total intäkt"} cur={m.totalIncome} sim={sim.nInc} up />
          <CRow label={ar ? "إجمالي المصاريف" : "Totala kostnader"} cur={m.totalExpense} sim={sim.nExp} up={false} />
          <CRow label={ar ? "صافي الربح" : "Nettovinst"} cur={m.netProfit} sim={sim.nPro} up />
          <CRow label={ar ? "هامش الربح %" : "Vinstmarginal %"} cur={m.profitMargin} sim={sim.nMar} up />
          <CRow label={ar ? "ROI %" : "ROI %"} cur={m.roi} sim={sim.nROI} up />
          <CRow label={ar ? "تكلفة/طير" : "Kostnad/fågel"} cur={m.costPerBird} sim={sim.nCPB} up={false} />
        </CardContent>
      </Card>
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm flex items-center gap-2"><Sigma className="w-4 h-4 text-rose-500" />{ar ? "مصفوفة الحساسية" : "Känslighetsmatris"}<InfoTip metricKey="profit_margin" ar={ar} /></CardTitle></CardHeader>
        <CardContent className="px-3 pb-4 overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead><tr className="border-b border-border/40"><th className="text-start py-2 px-1.5 text-muted-foreground">{ar ? "التغيير" : "Förändring"}</th>{[-20,-10,0,10,20].map(p => <th key={p} className={cn("text-center py-2 px-1 font-bold", p > 0 ? "text-emerald-600" : p < 0 ? "text-red-600" : "text-muted-foreground")}>{p > 0 ? `+${p}` : p}%</th>)}</tr></thead>
            <tbody>
              {[{ label: ar ? "المبيعات" : "Försäljning", fn: (p: number) => (m.totalIncome*(1+p/100)) - m.totalExpense }, { label: ar ? "سعر العلف" : "Foderpris", fn: (p: number) => m.totalIncome - (m.totalExpense + m.feedCostRaw*p/100) }, { label: ar ? "العمالة" : "Arbetskraft", fn: (p: number) => m.totalIncome - (m.totalExpense + m.laborCostRaw*p/100) }].map(row => (
                <tr key={row.label} className="border-b border-border/20 hover:bg-muted/20">
                  <td className="py-2 px-1.5 font-semibold">{row.label}</td>
                  {[-20,-10,0,10,20].map(p => {
                    const profit = row.fn(p);
                    const bg = profit > m.netProfit * 1.05 ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700" : profit < m.netProfit * 0.95 ? "bg-red-50 dark:bg-red-950/20 text-red-700" : "bg-muted/30 text-muted-foreground";
                    return <td key={p} className={cn("text-center py-2 px-1 rounded font-bold", bg)}>{fmtAmount(Math.abs(profit)).replace(/ د\.ع/, "")}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[9px] text-muted-foreground mt-2">{ar ? "القيم بالدينار العراقي · أخضر = أفضل · أحمر = أسوأ" : "Värden i IQD · Grön = bättre · Röd = sämre"}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function Finance() {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const ar = lang === "ar";
  const isAdmin = user?.role === "admin";
  const qc = useQueryClient();
  const { toast } = useToast();

  const [period,    setPeriod]    = useState<Period>("month");
  const [tab,       setTab]       = useState<FinTab>("dashboard");
  const [search,    setSearch]    = useState("");
  const [txFilter,  setTxFilter]  = useState<"all"|"income"|"expense">("all");
  const [catFilter, setCatFilter] = useState<string|null>(null);
  const [drillKey,  setDrillKey]  = useState<string|null>(null);
  const [editTx,    setEditTx]    = useState<Tx|null>(null);
  const [deleting,  setDeleting]  = useState<number|null>(null);

  // ── Data ───────────────────────────────────────────────────────────────────
  const OPTS = { refetchInterval: 30_000, staleTime: 20_000 };
  const { data: allTxs = [], isFetching } = useQuery<Tx[]>({ queryKey: ["transactions"], queryFn: () => apiFetch("/api/transactions"), ...OPTS });
  const { data: flocks = [] }             = useQuery<Flock[]>({ queryKey: ["flocks"], queryFn: () => apiFetch("/api/flocks"), ...OPTS });
  const refetch = () => { qc.invalidateQueries({ queryKey: ["transactions"] }); };

  // ── Period filter ──────────────────────────────────────────────────────────
  const periodTxs = useMemo(() => { const r = getPeriodRange(period); if (!r) return allTxs; return allTxs.filter(t => t.date >= r.start && t.date <= r.end); }, [allTxs, period]);
  const prevTxs   = useMemo(() => { const r = getPrevPeriodRange(period); if (!r) return []; return allTxs.filter(t => t.date >= r.start && t.date <= r.end); }, [allTxs, period]);

  // ── Computations ───────────────────────────────────────────────────────────
  const m       = useMemo(() => computeMetrics(periodTxs, flocks, period), [periodTxs, flocks, period]);
  const prev    = useMemo(() => computeMetrics(prevTxs, flocks, period),   [prevTxs, flocks, period]);
  const monthly = useMemo(() => computeMonthly(allTxs), [allTxs]);
  const adv     = useMemo(() => computeAdvanced(allTxs, monthly), [allTxs, monthly]);
  const feed    = useMemo(() => computeFeedMetrics(allTxs, flocks, periodTxs, getPeriodDays(period)), [allTxs, flocks, periodTxs, period]);
  const alerts  = useMemo(() => detectAlerts(m, periodTxs.length), [m, periodTxs.length]);
  const recs    = useMemo(() => generateRecommendations(m, adv, monthly), [m, adv, monthly]);

  // ── Delta helpers (period vs previous period) ──────────────────────────────
  const delta = (cur: number, prv: number) => prv === 0 ? null : ((cur - prv) / Math.abs(prv)) * 100;
  const deltaLabel = (cur: number, prv: number, isGoodUp = true) => {
    const d = delta(cur, prv);
    if (d === null) return undefined;
    const positive = d > 0;
    const sign = positive ? "+" : "−";
    const good = isGoodUp ? positive : !positive;
    return `${good ? "" : ""}${sign}${Math.abs(d).toFixed(0)}% ${ar ? "vs الفترة السابقة" : "vs föregående"}`;
  };

  // ── Filtered transactions ──────────────────────────────────────────────────
  const filteredTxs = useMemo(() => {
    let txs = periodTxs;
    if (txFilter !== "all") txs = txs.filter(t => t.type === txFilter);
    if (catFilter) txs = txs.filter(t => t.category === catFilter);
    if (search) { const q = search.toLowerCase(); txs = txs.filter(t => t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.amount.includes(q)); }
    return txs.sort((a, b) => b.date.localeCompare(a.date));
  }, [periodTxs, txFilter, catFilter, search]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    if (!confirm(ar ? "حذف هذه المعاملة؟" : "Ta bort?")) return;
    setDeleting(id);
    try { await apiFetch(`/api/transactions/${id}`, { method: "DELETE" }); toast({ title: ar ? "تم الحذف" : "Borttagen" }); refetch(); }
    catch (e: any) { toast({ variant: "destructive", title: e.message }); }
    finally { setDeleting(null); }
  };

  const totalBirds = flocks.reduce((s, f) => s + f.count, 0);
  const gradeColor = { excellent: "text-emerald-600", good: "text-blue-600", fair: "text-amber-600", poor: "text-red-600" }[m.healthGrade];
  const fmtKg = (kg: number) => kg >= 1000 ? `${(kg / 1000).toFixed(2)} ${ar ? "طن" : "ton"}` : `${kg.toFixed(1)} ${ar ? "كغ" : "kg"}`;

  const PERIODS: { id: Period; ar: string; sv: string }[] = [
    { id:"week", ar:"أسبوع", sv:"Vecka" }, { id:"month", ar:"شهر", sv:"Månad" },
    { id:"quarter", ar:"ربع", sv:"Kvartal" }, { id:"year", ar:"سنة", sv:"År" }, { id:"all", ar:"الكل", sv:"Allt" },
  ];
  const TABS: { id: FinTab; ar: string; sv: string; icon: any }[] = [
    { id:"dashboard",    ar:"القيادة",   sv:"Dashboard", icon:BarChart2     },
    { id:"add",          ar:"إضافة",     sv:"Lägg till", icon:Plus          },
    { id:"analysis",     ar:"التحليل",   sv:"Analys",    icon:Zap           },
    { id:"simulator",    ar:"محاكاة",    sv:"Simulator", icon:FlaskConical  },
    { id:"transactions", ar:"السجلات",   sv:"Transakter",icon:Receipt       },
    { id:"statement",    ar:"التقارير",  sv:"Rapporter", icon:FileText      },
  ];

  // ── Drill-down content ────────────────────────────────────────────────────
  const drillContent = useMemo(() => {
    if (!drillKey) return null;
    const info = GLOSSARY[drillKey];
    if (!info) return null;
    return (
      <div className="space-y-4 pt-1">
        <div className="rounded-xl bg-muted/40 px-3 py-2.5 font-mono text-[11px] text-muted-foreground leading-relaxed">📐 {info.formulaAr}</div>
        <p className="text-xs text-foreground leading-relaxed">{ar ? info.descAr : info.descSv}</p>
        <div className="rounded-xl border border-border/40 p-3.5">
          <p className="text-[10px] font-bold text-muted-foreground mb-1">{ar ? "المعايير الصناعية" : "Branschnormer"}</p>
          <p className="text-[10px] text-foreground">{ar ? info.benchmarkAr : info.benchmarkSv}</p>
        </div>
        {drillKey === "roi" && m.roi !== null && <div className="text-center py-2"><p className="text-[10px] text-muted-foreground">{ar ? "قيمتك الحالية" : "Ditt nuvarande värde"}</p><p className={cn("text-4xl font-black mt-1", info.colorClass)}>{m.roi.toFixed(1)}%</p></div>}
        {drillKey === "profit_margin" && m.profitMargin !== null && <div className="text-center py-2"><p className="text-[10px] text-muted-foreground">{ar ? "قيمتك الحالية" : "Ditt nuvarande värde"}</p><p className={cn("text-4xl font-black mt-1", info.colorClass)}>{m.profitMargin.toFixed(1)}%</p></div>}
        {drillKey === "oer" && m.oer !== null && <div className="text-center py-2"><p className="text-[10px] text-muted-foreground">{ar ? "قيمتك الحالية" : "Ditt nuvarande värde"}</p><p className={cn("text-4xl font-black mt-1", info.colorClass)}>{m.oer.toFixed(1)}%</p></div>}
        {drillKey === "z_score" && <div className="space-y-2"><p className="text-[10px] font-bold">{ar ? "الشهور الاستثنائية:" : "Exceptionella månader:"}</p>{adv.monthZScores.filter(z => z.anomaly).map(z => <div key={z.month} className="flex items-center justify-between text-xs rounded-lg bg-rose-50 dark:bg-rose-950/20 px-3 py-2"><span>{ar ? z.monthAr : z.month}</span><span className="font-black text-rose-600">Z = {z.z.toFixed(2)}</span></div>)}{!adv.monthZScores.some(z => z.anomaly) && <p className="text-[11px] text-muted-foreground">{ar ? "لا توجد أشهر استثنائية — أداء مستقر" : "Inga exceptionella månader"}</p>}</div>}
        {drillKey === "ema_trend" && <div className="grid grid-cols-3 gap-2 text-center">{[{ l: ar?"دخل EMA":"Intäkt EMA", v: adv.emaIncome, c:"text-emerald-600" }, { l: ar?"مصاريف EMA":"Kostnad EMA", v: adv.emaExpense, c:"text-red-600" }, { l: ar?"ربح EMA":"Vinst EMA", v: adv.emaProfit, c:"text-blue-600" }].map(x => <div key={x.l} className="rounded-xl bg-muted/40 p-2.5"><p className="text-[9px] text-muted-foreground">{x.l}</p><p className={cn("text-xs font-black", x.c)}>{fmtAmount(x.v, lang as any)}</p></div>)}</div>}
        {drillKey === "cash_runway" && adv.cashRunway !== null && <div className="text-center py-2"><p className="text-[10px] text-muted-foreground">{ar ? "مدة الاستمرارية" : "Kassabana"}</p><p className={cn("text-4xl font-black mt-1", info.colorClass)}>{Math.round(adv.cashRunway)}</p><p className="text-sm text-muted-foreground">{ar ? "يوم" : "dagar"}</p></div>}
      </div>
    );
  }, [drillKey, m, adv, ar, lang]);

  return (
    <div className="min-h-screen bg-background pb-24" dir={ar ? "rtl" : "ltr"}>

      {/* ══ Header ═══════════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/40">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-base font-black flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-500" />
                {ar ? "المالية والإنتاج — الذكاء المتكامل" : "Ekonomi & Produktion — Integrerad intelligens"}
              </h1>
              <p className="text-[9px] text-muted-foreground">EMA · Z-Score · توقعات · محاكاة · توصيات · اضغط أي رقم لفهمه</p>
            </div>
            <LiveBadge fetching={isFetching} />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-hide">
            {PERIODS.map(p => (
              <button key={p.id} onClick={() => setPeriod(p.id)} className={cn("shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all", period === p.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted")}>{ar ? p.ar : p.sv}</button>
            ))}
          </div>
        </div>
        <div className="border-t border-border/40 max-w-2xl mx-auto flex overflow-x-auto scrollbar-hide">
          {TABS.map(t => { const Icon = t.icon; return (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex-1 shrink-0 flex flex-col items-center gap-0.5 py-2.5 px-2 text-[10px] font-semibold transition-all", tab === t.id ? "text-primary border-b-2 border-primary" : "text-muted-foreground border-b-2 border-transparent")}>
              <Icon className="w-3.5 h-3.5" />{ar ? t.ar : t.sv}
            </button>
          ); })}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">

        {/* ══ KPI Strip (with period-vs-period delta badges) ═════════════════════ */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <KpiTile label={ar?"إجمالي الدخل":"Total intäkt"} value={fmtAmount(m.totalIncome, lang as any)} sub={`${m.incByCat.length} ${ar?"مصدر":"källor"}`} icon={ArrowUpCircle} colorTop="bg-emerald-500" iconColor="text-emerald-500" trend={m.totalIncome > 0 ? "up" : null} ar={ar} deltaLabel={deltaLabel(m.totalIncome, prev.totalIncome)} onClick={() => setTab("transactions")} />
          <KpiTile label={ar?"إجمالي المصاريف":"Totala kostnader"} value={fmtAmount(m.totalExpense, lang as any)} sub={`${m.expByCat.length} ${ar?"بند":"poster"}`} icon={ArrowDownCircle} colorTop="bg-red-500" iconColor="text-red-500" trend={m.totalExpense > m.totalIncome ? "down" : null} ar={ar} deltaLabel={deltaLabel(m.totalExpense, prev.totalExpense, false)} onClick={() => setTab("transactions")} />
          <KpiTile label={ar?"صافي الربح":"Nettovinst"} value={(m.netProfit >= 0 ? "+" : "") + fmtAmount(Math.abs(m.netProfit), lang as any)} sub={m.profitMargin !== null ? `${m.profitMargin.toFixed(1)}%` : undefined} icon={m.netProfit >= 0 ? TrendingUp : TrendingDown} colorTop={m.netProfit >= 0 ? "bg-blue-500" : "bg-orange-500"} iconColor={m.netProfit >= 0 ? "text-blue-500" : "text-orange-500"} trend={m.netProfit >= 0 ? "up" : "down"} infoKey="profit_margin" ar={ar} deltaLabel={deltaLabel(m.netProfit, prev.netProfit)} onClick={() => setDrillKey("profit_margin")} />
          <KpiTile label={ar?"ROI":"ROI"} value={m.roi !== null ? `${m.roi.toFixed(1)}%` : "—"} sub={m.costPerBird !== null ? `${fmtAmount(m.costPerBird, lang as any)}/${ar?"طير":"fågel"}` : undefined} icon={Target} colorTop="bg-purple-500" iconColor="text-purple-500" trend={m.roi !== null && m.roi > 0 ? "up" : null} infoKey="roi" ar={ar} deltaLabel={m.roi !== null && prev.roi !== null ? deltaLabel(m.roi, prev.roi) : undefined} onClick={() => setDrillKey("roi")} />
        </div>

        {/* Alerts */}
        <AlertBanner alerts={alerts.filter(a => a.severity !== "info")} ar={ar} />

        {/* ══════════════════════════════════════════════════════════════════
            DASHBOARD TAB
           ══════════════════════════════════════════════════════════════════ */}
        {tab === "dashboard" && (
          <div className="space-y-5">

            {/* Advanced KPI row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: ar?"دخل EMA":"EMA-intäkt",       val: adv.emaIncome > 0 ? fmtAmount(adv.emaIncome, lang as any) : "—", sub: ar?"متوسط أسي α=0.35":"Exp. rörligt medel", key:"ema_trend",        c:"text-indigo-600", bg:"bg-indigo-50 dark:bg-indigo-950/20" },
                { label: ar?"استمرارية نقدية":"Kassabana", val: adv.cashRunway !== null ? `${Math.round(adv.cashRunway)} ${ar?"يوم":"d"}` : "—", sub: ar?"بالمعدل الحالي":"Vid nuv. takt",     key:"cash_runway",     c:"text-cyan-600",   bg:"bg-cyan-50 dark:bg-cyan-950/20" },
                { label: ar?"زخم الربح":"Vinstmomentum",  val: adv.profitVelocity !== null ? fmtPct(adv.profitVelocity) : "—", sub: ar?"vs الشهر السابق":"vs förra",             key:"profit_velocity", c: adv.profitVelocity !== null && adv.profitVelocity > 0 ? "text-emerald-600" : "text-red-600", bg: adv.profitVelocity !== null && adv.profitVelocity > 0 ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-red-50 dark:bg-red-950/20" },
              ].map(k => (
                <div key={k.key} role="button" tabIndex={0} onClick={() => setDrillKey(k.key)} onKeyDown={e => e.key === "Enter" && setDrillKey(k.key)}
                  className={cn("rounded-2xl border border-border/40 p-3 text-start cursor-pointer hover:shadow-md transition-all active:scale-[0.97]", k.bg)}>
                  <p className="text-[9px] text-muted-foreground leading-tight mb-1">{k.label}</p>
                  <p className={cn("text-sm font-black", k.c)}>{k.val}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{k.sub}</p>
                  <p className="text-[8px] text-muted-foreground/40 mt-0.5 flex items-center gap-0.5"><Eye className="w-2 h-2" />{ar?"اضغط للشرح":"Tryck"}</p>
                </div>
              ))}
            </div>

            {/* Best/Worst Month */}
            <BestWorstCard adv={adv} monthly={monthly} ar={ar} lang={lang} />

            {/* Monthly Chart — with cumulative P&L line */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  {ar ? "الأداء الشهري + P&L التراكمي" : "Månadsresultat + kumulativ P&L"}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                {monthly.length < 1 ? (
                  <div className="h-40 flex items-center justify-center"><p className="text-xs text-muted-foreground">{ar ? "لا توجد بيانات بعد" : "Inga data ännu"}</p></div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={monthly} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey={ar ? "monthAr" : "month"} tick={{ fontSize: 9 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTip ar={ar} />} />
                      <Bar yAxisId="left" dataKey="income"  name={ar?"دخل":"Inkomst"}    fill="#10b981" radius={[3,3,0,0]} opacity={0.85} />
                      <Bar yAxisId="left" dataKey="expense" name={ar?"مصاريف":"Kostnader"} fill="#ef4444" radius={[3,3,0,0]} opacity={0.85} />
                      <Line yAxisId="left" dataKey="profit" name={ar?"ربح شهري":"Månadsvinst"} stroke="#3b82f6" strokeWidth={2} dot={{ r:3, fill:"#3b82f6" }} type="monotone" />
                      <Line yAxisId="right" dataKey="cumulative" name={ar?"تراكمي":"Kumulativt"} stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 3" dot={false} type="monotone" />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
                <p className="text-[8px] text-muted-foreground text-center mt-1">{ar ? "الخط البنفسجي = الربح التراكمي المتراكم عبر الزمن" : "Lila linje = kumulativ vinst över tid"}</p>
              </CardContent>
            </Card>

            {/* Z-Score Anomaly Chart */}
            {adv.monthZScores.length >= 2 && (
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sigma className="w-4 h-4 text-rose-500" />
                    {ar ? "كشف الشذوذات الإحصائية (Z-Score)" : "Statistisk avvikelsedetektering"}
                    <InfoTip metricKey="z_score" ar={ar} />
                    <span role="button" tabIndex={0} onClick={() => setDrillKey("z_score")} className="ms-auto text-[9px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 cursor-pointer"><Eye className="w-2.5 h-2.5" />{ar?"تفاصيل":"Detaljer"}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-4">
                  <ResponsiveContainer width="100%" height={100}>
                    <BarChart data={adv.monthZScores} margin={{ top: 5, right: 5, bottom: 0, left: -28 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey={ar ? "monthAr" : "month"} tick={{ fontSize: 8 }} />
                      <YAxis tick={{ fontSize: 8 }} />
                      <Tooltip formatter={(v: any) => [Number(v).toFixed(2), "Z-Score"]} />
                      <ReferenceLine y={1.8}  stroke="#f59e0b" strokeDasharray="3 3" />
                      <ReferenceLine y={-1.8} stroke="#f59e0b" strokeDasharray="3 3" />
                      <ReferenceLine y={0}    stroke="#94a3b8" strokeWidth={0.5} />
                      <Bar dataKey="z" name="Z" radius={[2,2,0,0]}>
                        {adv.monthZScores.map((e, i) => <Cell key={i} fill={e.anomaly ? "#ef4444" : "#8b5cf6"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-[9px] text-muted-foreground text-center mt-1">{ar ? "الأحمر = شهر استثنائي (|Z| > 1.8)" : "Rött = exceptionell månad"}</p>
                </CardContent>
              </Card>
            )}

            {/* Pie charts */}
            {(m.expByCat.length > 0 || m.incByCat.length > 0) && (
              <div className="grid grid-cols-2 gap-3">
                {m.expByCat.length > 0 && (
                  <Card className="border-none shadow-sm">
                    <CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-[11px] text-red-600 flex items-center gap-1"><ArrowDownCircle className="w-3.5 h-3.5" />{ar?"توزيع المصاريف":"Kostnader"}</CardTitle><p className="text-[8px] text-muted-foreground">{ar?"اضغط للتصفية":"Filtrera"}</p></CardHeader>
                    <CardContent className="px-2 pb-3">
                      <ResponsiveContainer width="100%" height={110}>
                        <PieChart onClick={e => { if (e?.activePayload?.[0]) { const id = e.activePayload[0].payload.id; setCatFilter(catFilter===id?null:id); setTab("transactions"); } }}>
                          <Pie data={m.expByCat.map(e => ({ ...e, name: ar?catMeta(e.id).ar:catMeta(e.id).sv }))} cx="50%" cy="50%" innerRadius={26} outerRadius={48} dataKey="value" paddingAngle={2}>
                            {m.expByCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: any) => fmtAmount(v, lang as any)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-0.5 mt-1">
                        {m.expByCat.slice(0,4).map((e,i) => (
                          <div key={e.id} role="button" tabIndex={0} onClick={() => { setCatFilter(catFilter===e.id?null:e.id); setTab("transactions"); }} className={cn("w-full flex items-center gap-1.5 rounded px-1 py-0.5 cursor-pointer transition-colors", catFilter===e.id?"bg-muted":"hover:bg-muted/50")}>
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="text-[9px] text-muted-foreground truncate flex-1 text-start">{ar?catMeta(e.id).ar:catMeta(e.id).sv}</span>
                            <span className="text-[9px] font-bold">{e.pct.toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {m.incByCat.length > 0 && (
                  <Card className="border-none shadow-sm">
                    <CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-[11px] text-emerald-600 flex items-center gap-1"><ArrowUpCircle className="w-3.5 h-3.5" />{ar?"مصادر الدخل":"Inkomstkällor"}</CardTitle></CardHeader>
                    <CardContent className="px-2 pb-3">
                      <ResponsiveContainer width="100%" height={110}>
                        <PieChart>
                          <Pie data={m.incByCat.map(e => ({ ...e, name: ar?catMeta(e.id).ar:catMeta(e.id).sv }))} cx="50%" cy="50%" innerRadius={26} outerRadius={48} dataKey="value" paddingAngle={2}>
                            {m.incByCat.map((_, i) => <Cell key={i} fill={INC_COLORS[i % INC_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: any) => fmtAmount(v, lang as any)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-0.5 mt-1">
                        {m.incByCat.slice(0,4).map((e,i) => (
                          <div key={e.id} className="flex items-center gap-1.5 px-1 py-0.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: INC_COLORS[i % INC_COLORS.length] }} />
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

            {/* Prediction (next-month linear projection) */}
            {adv.pred && (
              <div className="rounded-2xl bg-slate-800 p-3 text-white">
                <p className="text-[9px] text-slate-400 mb-2 flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-400" />{ar?"توقع الشهر القادم (انحدار خطي على آخر 6 أشهر)":"Prognos nästa månad (linjär regression, 6 mån)"}</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { l:ar?"دخل متوقع":"Förv. intäkt", v:adv.pred.income,  c:"text-emerald-400" },
                    { l:ar?"مصاريف متوقعة":"Förv. kostnad", v:adv.pred.expense, c:"text-red-400" },
                    { l:ar?"ربح متوقع":"Förv. vinst",  v:adv.pred.profit,   c:adv.pred.profit>=0?"text-blue-400":"text-orange-400" },
                  ].map(x => (
                    <div key={x.l} className="rounded-lg bg-slate-700/50 p-2">
                      <p className="text-[9px] text-slate-400 mb-0.5">{x.l}</p>
                      <p className={cn("text-xs font-black", x.c)}>{fmtAmount(x.v, lang as any)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expense Heatmap */}
            {adv.heatmap.length > 0 && monthly.length >= 2 && (
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-500" />
                    {ar ? "خريطة حرارة المصاريف" : "Kostnadsvärmekartan"}
                    <span className="text-[8px] text-muted-foreground ms-auto">{ar?"أحمر = أعلى إنفاق":"Röd = Högt"}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-4 overflow-x-auto">
                  {(() => {
                    const months = monthly.slice(-6).map(m => ({ key: m.month, label: ar ? m.monthAr : m.month }));
                    const maxVal = Math.max(1, ...adv.heatmap.flatMap(r => Object.values(r.months)));
                    return (
                      <table className="w-full text-[8px] border-collapse">
                        <thead><tr><th className="text-start py-1 px-1 text-muted-foreground w-20">{ar?"الفئة":"Kategori"}</th>{months.map(m => <th key={m.key} className="py-1 px-0.5 text-center text-muted-foreground">{m.label}</th>)}</tr></thead>
                        <tbody>{adv.heatmap.filter(r => Object.values(r.months).some(v => v > 0)).map(row => (
                          <tr key={row.cat} className="hover:bg-muted/20">
                            <td className="py-0.5 px-1 font-medium truncate max-w-[70px]">{catMeta(row.cat).icon} {ar?catMeta(row.cat).ar:catMeta(row.cat).sv}</td>
                            {months.map(m => { const val = row.months[m.key] ?? 0; const i = val / maxVal; return (
                              <td key={m.key} className="py-0.5 px-0.5"><div title={val > 0 ? fmtAmount(val) : "—"} className="rounded h-5 flex items-center justify-center text-[7px] font-bold cursor-help hover:scale-110 transition-transform" style={{ background: val>0?`rgba(239,68,68,${Math.max(0.08,i*0.85)})`:"transparent", color: i>0.6?"#991b1b":i>0.2?"#b91c1c":"#cbd5e1" }}>{val>0?`${(val/1000).toFixed(0)}k`:"·"}</div></td>
                            ); })}
                          </tr>
                        ))}</tbody>
                      </table>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            <RecommendationsPanel recs={recs} ar={ar} />

            {/* Daily rates + stability */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-border/40 p-3">
                <p className="text-[9px] text-muted-foreground">{ar?"إنفاق يومي":"Daglig kostnad"}</p>
                <p className="text-sm font-black text-red-600 mt-1">{fmtAmount(m.dailyBurnRate, lang as any)}</p>
                <p className="text-[8px] text-muted-foreground">{ar?"/ يوم":"/ dag"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-border/40 p-3">
                <p className="text-[9px] text-muted-foreground">{ar?"دخل يومي":"Daglig intäkt"}</p>
                <p className="text-sm font-black text-emerald-600 mt-1">{fmtAmount(m.dailyRevRate, lang as any)}</p>
                <p className="text-[8px] text-muted-foreground">{ar?"/ يوم":"/ dag"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-border/40 p-3">
                <p className="text-[9px] text-muted-foreground">{ar?"ثبات الدخل CV":"Stabilitet CV"}</p>
                <p className="text-sm font-black text-blue-600 mt-1">{adv.incomeCV !== null ? `${adv.incomeCV.toFixed(0)}%` : "—"}</p>
                <p className="text-[8px] text-muted-foreground">{ar?"أقل = أكثر استقراراً":"Lägre = stabilt"}</p>
              </div>
            </div>
          </div>
        )}

        {/* ══ ADD TAB ═══════════════════════════════════════════════════════════ */}
        {tab === "add" && (
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm flex items-center gap-2"><Plus className="w-4 h-4 text-emerald-500" />{ar?"تسجيل معاملة جديدة":"Registrera ny transaktion"}</CardTitle></CardHeader>
            <CardContent className="px-4 pb-5"><AddTransactionForm ar={ar} onSuccess={refetch} /></CardContent>
          </Card>
        )}

        {/* ══ ANALYSIS TAB ══════════════════════════════════════════════════════ */}
        {tab === "analysis" && (
          <div className="space-y-5">
            {/* Health gauge */}
            <Card className="border-none shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-500" />
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex items-center gap-4">
                  <HealthGauge score={m.healthScore} grade={m.healthGrade} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{ar?"درجة الصحة المالية (0–100)":"Finansiell hälsopoäng (0–100)"}</p>
                    <p className={cn("text-lg font-black", gradeColor)}>{{ excellent: ar?"ممتاز 🌟":"Utmärkt 🌟", good: ar?"جيد ✅":"Bra ✅", fair: ar?"مقبول ⚠️":"Acceptabelt ⚠️", poor: ar?"ضعيف ❌":"Svag ❌" }[m.healthGrade]}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{m.profitMargin !== null ? `${ar?"هامش":"Marginal"}: ${m.profitMargin.toFixed(1)}% · OER: ${m.oer?.toFixed(0)??"—"}%` : ar?"أضف بيانات للتقييم":"Lägg till data"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Per-bird */}
            {flocks.length > 0 && (
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2"><Bird className="w-4 h-4 text-amber-500" />{ar?"اقتصاديات الطير الواحد":"Per-fågelekonomik"}<InfoTip metricKey="cost_per_bird" ar={ar} /><Badge variant="outline" className="text-[9px] ms-auto">{totalBirds.toLocaleString()} {ar?"طير":"fåglar"}</Badge></CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: ar?"تكلفة/طير":"Kostnad/fågel", value: m.costPerBird, color:"text-red-600", bg:"bg-red-50 dark:bg-red-950/20", key:"cost_per_bird" },
                      { label: ar?"إيراد/طير":"Intäkt/fågel",  value: m.revenuePerBird, color:"text-emerald-600", bg:"bg-emerald-50 dark:bg-emerald-950/20", key: null },
                      { label: ar?"ربح/طير":"Vinst/fågel",     value: m.profitPerBird, color: m.profitPerBird !== null && m.profitPerBird >= 0 ? "text-blue-600" : "text-orange-600", bg:"bg-blue-50 dark:bg-blue-950/20", key:"profit_margin" },
                      { label: ar?"سعر التعادل/طير":"Break-even/fågel", value: m.breakEvenPricePerBird, color:"text-purple-600", bg:"bg-purple-50 dark:bg-purple-950/20", key: null },
                    ].map(({ label, value, color, bg, key }) => (
                      <div key={label} role={key ? "button" : undefined} tabIndex={key ? 0 : undefined} onClick={key ? () => setDrillKey(key) : undefined} className={cn("rounded-xl p-3 text-start transition-all", bg, key && "cursor-pointer hover:shadow-sm active:scale-[0.97]")}>
                        <div className="flex items-center gap-1 mb-0.5"><p className="text-[9px] text-muted-foreground">{label}</p>{key && <InfoTip metricKey={key} ar={ar} />}</div>
                        <p className={cn("text-sm font-black", color)}>{value !== null ? fmtAmount(value, lang as any) : "—"}</p>
                        {key && <p className="text-[8px] text-muted-foreground/40 mt-0.5 flex items-center gap-0.5"><Eye className="w-2 h-2" />{ar?"اضغط":"Tryck"}</p>}
                      </div>
                    ))}
                  </div>
                  {m.costPerBird !== null && flocks.length > 1 && (
                    <div className="border-t border-border/40 pt-3 mt-3 space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground">{ar?"توزيع التكاليف على القطعان":"Kostnadsfördelning per flock"}</p>
                      {flocks.map(f => { const share = f.count / Math.max(1, totalBirds); return (
                        <div key={f.id} className="flex items-center gap-2">
                          <span className="text-lg shrink-0">🐔</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold truncate">{f.name}</p>
                            <div className="flex items-center gap-1.5"><div className="h-1.5 flex-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-amber-400 rounded-full" style={{ width: `${share*100}%` }} /></div><span className="text-[9px] text-muted-foreground">{(share*100).toFixed(0)}%</span></div>
                          </div>
                          <div className="text-end shrink-0"><p className="text-[10px] font-bold text-red-600">{fmtAmount(m.totalExpense*share, lang as any)}</p><p className="text-[9px] text-muted-foreground">{f.count} {ar?"طير":"fåglar"}</p></div>
                        </div>
                      ); })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Feed section */}
            <Card className="border-none shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />
              <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm flex items-center gap-2"><Wheat className="w-4 h-4 text-amber-500" />{ar?"استهلاك وكفاءة العلف":"Foderkonsumtion & FCR"}<Badge variant="outline" className="text-[9px] ms-auto">{feed.trackedEntries} {ar?"سجل":"poster"}</Badge></CardTitle></CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {feed.totalFeedCost === 0 ? (
                  <div className="text-center py-4"><p className="text-sm font-semibold mb-1">{ar?"لا توجد سجلات علف":"Inga foderposter"}</p><button onClick={() => setTab("add")} className="text-xs text-amber-600 underline">{ar?"← سجّل علفاً الآن":"← Registrera foder"}</button></div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { l:ar?"إجمالي العلف":"Total foder", v:feed.totalFeedKg>0?fmtKg(feed.totalFeedKg):"—", s:feed.dailyFeedKg>0?`${fmtKg(feed.dailyFeedKg)}/${ar?"يوم":"dag"}`:"", bg:"bg-amber-50", c:"text-amber-700" },
                        { l:ar?"تكلفة العلف":"Foderkostnad", v:fmtAmount(feed.totalFeedCost,lang as any), s:feed.feedCostPerKg?`${fmtAmount(feed.feedCostPerKg,lang as any)}/${ar?"كغ":"kg"}`:"", bg:"bg-red-50", c:"text-red-700" },
                        { l:ar?"علف/طير":"Foder/fågel", v:feed.feedPerBirdKg!==null?fmtKg(feed.feedPerBirdKg):"—", s:ar?"معيار: 3.5–5 كغ":"Standard: 3,5–5 kg", bg:"bg-orange-50", c:"text-orange-700" },
                        { l:ar?"تكلفة علف/طير":"Foderkost/fågel", v:feed.feedCostPerBird!==null?fmtAmount(feed.feedCostPerBird,lang as any):"—", s:"", bg:"bg-yellow-50", c:"text-yellow-700" },
                      ].map(x => <div key={x.l} className={cn("rounded-xl p-3 dark:bg-opacity-20", x.bg)}><p className="text-[9px] text-muted-foreground">{x.l}</p><p className={cn("text-sm font-black mt-0.5", x.c)}>{x.v}</p>{x.s && <p className="text-[9px] text-muted-foreground">{x.s}</p>}</div>)}
                    </div>
                    {feed.feedPerBirdKg !== null && (() => {
                      const g = { excellent:{l:ar?"FCR: ممتاز 🌟":"FCR: Utmärkt 🌟",c:"text-emerald-600",bg:"bg-emerald-50 dark:bg-emerald-950/20",bar:"#10b981",pct:90}, good:{l:ar?"FCR: جيد ✅":"FCR: Bra ✅",c:"text-blue-600",bg:"bg-blue-50 dark:bg-blue-950/20",bar:"#3b82f6",pct:65}, fair:{l:ar?"FCR: مرتفع ⚠️":"FCR: Högt ⚠️",c:"text-amber-600",bg:"bg-amber-50 dark:bg-amber-950/20",bar:"#f59e0b",pct:40}, high:{l:ar?"FCR: مفرط ❌":"FCR: Överdrivet ❌",c:"text-red-600",bg:"bg-red-50 dark:bg-red-950/20",bar:"#ef4444",pct:20}}[feed.fcrGrade];
                      return <div className={cn("rounded-xl p-3.5",g.bg)}><div className="flex items-center justify-between mb-1.5"><p className={cn("text-sm font-black",g.c)}>{g.l}</p><div className="text-end"><p className={cn("text-xl font-black",g.c)}>{feed.feedPerBirdKg.toFixed(1)}</p><p className="text-[9px] text-muted-foreground">{ar?"كغ/طير":"kg/fågel"}</p></div></div><div className="h-2 bg-white/50 dark:bg-black/20 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{width:`${g.pct}%`,background:g.bar}} /></div></div>;
                    })()}
                    {feed.untrackedEntries > 0 && <div className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-border/40 p-3"><Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" /><p className="text-[10px]">{ar?`${feed.untrackedEntries} سجل بدون وزن — أضف كمية بوحدة كيلو/طن`:`${feed.untrackedEntries} poster utan vikt`}</p></div>}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Financial ratios */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm flex items-center gap-2"><Scale className="w-4 h-4 text-blue-500" />{ar?"النسب المالية vs المعايير الصناعية":"Finansiella nyckeltal vs. bransch"}</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {[
                  { label:ar?"نسبة العلف":"Foderandel", value:m.feedRatio,   bL:55, bH:65, icon:"🌾", hint:ar?"55–65%":"55–65%", key:"feed_ratio",    lo:false },
                  { label:ar?"نسبة العمالة":"Arbete",   value:m.laborRatio,  bL:15, bH:25, icon:"👷", hint:ar?"15–25%":"15–25%", key: null,           lo:false },
                  { label:"OER",                        value:m.oer,         bL:65, bH:80, icon:"📊", hint:ar?"65–80%":"65–80%", key:"oer",           lo:true  },
                  { label:ar?"هامش الربح":"Marginal",   value:m.profitMargin,bL:15, bH:30, icon:"💰", hint:ar?"15–30%":"15–30%", key:"profit_margin", lo:false },
                  { label:"ROI",                        value:m.roi,         bL:10, bH:25, icon:"📈", hint:ar?"10–25%/سنة":"10–25%", key:"roi",       lo:false },
                  { label:ar?"هامش إجمالي":"Brutto",   value:m.totalIncome>0?(m.grossProfit/m.totalIncome)*100:null, bL:25, bH:50, icon:"💎", hint:ar?"25–50%":"25–50%", key:"gross_margin", lo:false },
                ].map(({ label, value, bL, bH, icon, hint, key, lo }) => {
                  if (value === null) return <div key={label} className="flex items-center gap-2 py-1 opacity-40"><span>{icon}</span><div className="flex-1"><p className="text-[10px] font-semibold">{label}</p><p className="text-[9px] text-muted-foreground">{hint}</p></div><span className="text-xs">—</span></div>;
                  const inR = value >= bL && value <= bH;
                  const hi  = value > bH;
                  const st  = inR ? "ok" : lo ? (hi ? "bad" : "great") : (hi ? "great" : "bad");
                  const barC = st==="ok"?"#10b981":st==="great"?"#3b82f6":"#ef4444";
                  const emoji = st==="ok"?"✅":st==="great"?"🌟":"⚠️";
                  return (
                    <div key={label} role={key?"button":undefined} tabIndex={key?0:undefined} onClick={key?()=>setDrillKey(key):undefined} className={cn("w-full text-start", key&&"cursor-pointer hover:bg-muted/20 rounded-xl px-2 py-1.5 -mx-2 transition-colors")}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5"><span>{icon}</span><div><p className="text-[10px] font-semibold leading-none">{label}</p><p className="text-[9px] text-muted-foreground">{hint}</p></div>{key&&<InfoTip metricKey={key} ar={ar} />}</div>
                        <div className="flex items-center gap-1"><span className="text-xs font-black" style={{color:barC}}>{value.toFixed(1)}%</span><span className="text-[10px]">{emoji}</span></div>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{width:`${Math.min(100,Math.abs(value))}%`,background:barC}} /></div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Fixed vs variable + break-even */}
            {m.totalExpense > 0 && (
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm flex items-center gap-2"><Layers className="w-4 h-4 text-purple-500" />{ar?"الثابتة vs المتغيرة":"Fasta vs. rörliga"}<InfoTip metricKey="gross_margin" ar={ar} /></CardTitle></CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="rounded-xl bg-slate-100 dark:bg-slate-900/50 p-3"><p className="text-[9px] text-muted-foreground">{ar?"ثابتة":"Fasta"}</p><p className="text-sm font-black mt-1">{fmtAmount(m.fixedCosts,lang as any)}</p><p className="text-[9px] text-muted-foreground">{m.totalExpense>0?((m.fixedCosts/m.totalExpense)*100).toFixed(0):0}%</p></div>
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3"><p className="text-[9px] text-muted-foreground">{ar?"متغيرة":"Rörliga"}</p><p className="text-sm font-black text-amber-600 mt-1">{fmtAmount(m.variableCosts,lang as any)}</p><p className="text-[9px] text-muted-foreground">{m.totalExpense>0?((m.variableCosts/m.totalExpense)*100).toFixed(0):0}%</p></div>
                  </div>
                  <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200/50 p-3">
                    <div className="flex justify-between text-[10px] mb-1.5"><span className="font-semibold text-blue-700">{ar?"نقطة التعادل":"Break-even"}</span><span className="font-black text-blue-700">{fmtAmount(m.totalExpense,lang as any)}</span></div>
                    <div className="h-2.5 bg-white/60 dark:bg-slate-800/60 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{width:`${Math.min(100,m.totalExpense>0?(m.totalIncome/m.totalExpense)*100:0)}%`,background:m.totalIncome>=m.totalExpense?"#10b981":"#f59e0b"}} /></div>
                    <div className="flex justify-between text-[9px] mt-1 text-muted-foreground"><span>{ar?"دخل فعلي":"Faktisk inkomst"}: {fmtAmount(m.totalIncome,lang as any)}</span><span>{m.totalExpense>0?((m.totalIncome/m.totalExpense)*100).toFixed(0):0}%</span></div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            <RecommendationsPanel recs={recs} ar={ar} />
            <AlertBanner alerts={alerts} ar={ar} />
          </div>
        )}

        {/* ══ SIMULATOR TAB ══════════════════════════════════════════════════════ */}
        {tab === "simulator" && <SimulatorTab m={m} flocks={flocks} ar={ar} lang={lang} />}

        {/* ══ TRANSACTIONS TAB ═══════════════════════════════════════════════════ */}
        {tab === "transactions" && (
          <div className="space-y-3">
            {/* Filters */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={ar?"بحث...":"Sök..."} className="h-9 ps-8 text-sm" />
              </div>
              {catFilter && <button onClick={() => setCatFilter(null)} className="flex items-center gap-1 px-2.5 rounded-lg bg-primary/10 text-primary text-xs font-medium">{catMeta(catFilter).icon}<X className="w-3 h-3" /></button>}
              <div className="flex rounded-lg overflow-hidden border border-border/60">
                {(["all","income","expense"] as const).map(f => (
                  <button key={f} onClick={() => setTxFilter(f)} className={cn("px-2.5 py-1.5 text-[10px] font-semibold transition-colors", txFilter===f?(f==="income"?"bg-emerald-500 text-white":f==="expense"?"bg-red-500 text-white":"bg-primary text-primary-foreground"):"text-muted-foreground bg-background")}>
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
                    const amt = Number(tx.amount);
                    const sizeClass = amt > 1_000_000 ? "text-base" : amt > 500_000 ? "text-sm" : "text-sm";
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
                            {tx.quantity && tx.unit && <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded">{Number(tx.quantity).toLocaleString()} {tx.unit}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={cn("font-black", sizeClass, tx.type==="income"?"text-emerald-600":"text-red-600")}>
                            {tx.type==="income"?"+":"−"}{fmtAmount(amt, lang as any)}
                          </span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isAdmin && <button onClick={() => setEditTx(tx)} className="text-muted-foreground hover:text-blue-500 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>}
                            {isAdmin && <button onClick={() => handleDelete(tx.id)} disabled={deleting===tx.id} className="text-muted-foreground hover:text-red-500 transition-colors">{deleting===tx.id?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Trash2 className="w-3.5 h-3.5"/>}</button>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-4 py-3 border-t border-border/40 bg-muted/20 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{filteredTxs.length} {ar?"معاملة":"transaktioner"}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-xs text-emerald-600">+{fmtAmount(filteredTxs.filter(t=>t.type==="income").reduce((s,t)=>s+Number(t.amount),0),lang as any)}</span>
                    <span className="font-bold text-xs text-red-600">−{fmtAmount(filteredTxs.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.amount),0),lang as any)}</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ══ STATEMENT TAB ══════════════════════════════════════════════════════ */}
        {tab === "statement" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 p-5 text-white shadow-xl">
              <div className="flex items-center gap-2 mb-1"><FileText className="w-4 h-4 text-slate-300" /><h2 className="text-sm font-black">{ar?"قائمة الدخل والأرباح والخسائر (P&L)":"Resultaträkning (P&L)"}</h2></div>
              <p className="text-[10px] text-slate-400 mb-4">{ar?"نظام الإدارة المالية الذكي · مزرعة الدواجن":"Intelligent finanshantering · Fjäderfägård"}</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[{l:ar?"الإيرادات":"Intäkter",v:m.totalIncome,c:"text-emerald-400"},{l:ar?"المصاريف":"Kostnader",v:m.totalExpense,c:"text-red-400"},{l:ar?"الربح الصافي":"Nettovinst",v:m.netProfit,c:m.netProfit>=0?"text-blue-400":"text-orange-400"}].map(x => (
                  <div key={x.l} className="bg-white/5 rounded-xl p-2.5"><p className="text-[9px] text-slate-400">{x.l}</p><p className={cn("text-sm font-black mt-1",x.c)}>{x.v<0?"-":""}{fmtAmount(Math.abs(x.v),lang as any)}</p></div>
                ))}
              </div>
            </div>
            {/* A: Revenue */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-xs font-black text-emerald-600 flex items-center gap-2"><ArrowUpCircle className="w-3.5 h-3.5" />{ar?"أ. الإيرادات التشغيلية":"A. Rörelseintäkter"}</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {m.incByCat.length===0?<p className="text-[11px] text-muted-foreground">{ar?"لا إيرادات":"Inga intäkter"}</p>:<>
                  {m.incByCat.map(i=>{const meta=catMeta(i.id);return<div key={i.id} className="flex items-center justify-between text-[11px]"><span className="text-muted-foreground flex items-center gap-1.5"><span>{meta.icon}</span>{ar?meta.ar:meta.sv}</span><span className="font-bold text-emerald-600">{fmtAmount(i.value,lang as any)}</span></div>;})}
                  <div className="border-t border-border/40 pt-2 flex justify-between text-xs font-black"><span>{ar?"إجمالي":"Totalt"}</span><span className="text-emerald-600">{fmtAmount(m.totalIncome,lang as any)}</span></div>
                </>}
              </CardContent>
            </Card>
            {/* B: COGS */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-xs font-black text-amber-600 flex items-center gap-2"><ArrowDownCircle className="w-3.5 h-3.5" />{ar?"ب. تكلفة الإنتاج المتغيرة (COGS)":"B. Rörliga produktionskostnader (COGS)"}</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {m.expByCat.filter(e=>{const m=catMeta(e.id);return "fixed" in m&&!(m as any).fixed;}).map(e=>{const meta=catMeta(e.id);return<div key={e.id} className="flex items-center justify-between text-[11px]"><span className="text-muted-foreground flex items-center gap-1.5"><span>{meta.icon}</span>{ar?meta.ar:meta.sv}</span><span className="font-bold text-red-600">({fmtAmount(e.value,lang as any)})</span></div>;})}
                <div className="border-t border-border/40 pt-2 flex justify-between text-xs font-bold"><span>{ar?"إجمالي المتغيرة":"Totalt rörligt"}</span><span className="text-red-600">({fmtAmount(m.variableCosts,lang as any)})</span></div>
                <div className="flex justify-between text-xs font-black border-t border-border/60 pt-2"><span className="text-blue-600 flex items-center gap-1">{ar?"الربح الإجمالي":"Bruttovinst"}<InfoTip metricKey="gross_margin" ar={ar} /></span><span className={cn("font-black",m.grossProfit>=0?"text-blue-600":"text-orange-600")}>{m.grossProfit>=0?"+":"-"}{fmtAmount(Math.abs(m.grossProfit),lang as any)}</span></div>
              </CardContent>
            </Card>
            {/* C: OPEX */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-xs font-black text-red-600 flex items-center gap-2"><ArrowDownCircle className="w-3.5 h-3.5" />{ar?"ج. المصاريف التشغيلية الثابتة (OPEX)":"C. Fasta driftskostnader (OPEX)"}</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {m.expByCat.filter(e=>{const m=catMeta(e.id);return "fixed" in m&&(m as any).fixed;}).map(e=>{const meta=catMeta(e.id);return<div key={e.id} className="flex items-center justify-between text-[11px]"><span className="text-muted-foreground flex items-center gap-1.5"><span>{meta.icon}</span>{ar?meta.ar:meta.sv}</span><span className="font-bold text-red-600">({fmtAmount(e.value,lang as any)})</span></div>;})}
                <div className="border-t border-border/40 pt-2 flex justify-between text-xs font-bold"><span>{ar?"إجمالي الثابتة":"Totalt fast"}</span><span className="text-red-600">({fmtAmount(m.fixedCosts,lang as any)})</span></div>
              </CardContent>
            </Card>
            {/* Net result */}
            <div className={cn("rounded-2xl p-5 shadow-md", m.netProfit>=0?"bg-gradient-to-r from-emerald-500 to-teal-600 text-white":"bg-gradient-to-r from-red-500 to-rose-600 text-white")}>
              <div className="flex items-center justify-between mb-3"><span className="text-sm font-black">{ar?"صافي الربح / الخسارة":"Nettoresultat"}</span><span className="text-xl font-black">{m.netProfit>=0?"+":"-"}{fmtAmount(Math.abs(m.netProfit),lang as any)}</span></div>
              <div className="grid grid-cols-4 gap-2 text-center bg-white/10 rounded-xl p-2.5">
                {[{l:ar?"هامش":"Marginal",v:m.profitMargin!==null?`${m.profitMargin.toFixed(1)}%`:"—",k:"profit_margin"},{l:"ROI",v:m.roi!==null?`${m.roi.toFixed(1)}%`:"—",k:"roi"},{l:"OER",v:m.oer!==null?`${m.oer.toFixed(1)}%`:"—",k:"oer"},{l:ar?"ربح/طير":"Vinst/f.",v:m.profitPerBird!==null?fmtAmount(Math.abs(m.profitPerBird),lang as any):"—",k:"cost_per_bird"}].map(x=>(
                  <div key={x.l} role="button" tabIndex={0} onClick={()=>setDrillKey(x.k)} onKeyDown={e=>e.key==="Enter"&&setDrillKey(x.k)} className="text-center hover:bg-white/10 rounded-lg p-1 transition-colors cursor-pointer">
                    <p className="text-[9px] opacity-70">{x.l}</p><p className="text-xs font-black">{x.v}</p><InfoTip metricKey={x.k} ar={ar} />
                  </div>
                ))}
              </div>
            </div>
            {/* Monthly table with Z */}
            {monthly.length > 0 && (
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-blue-500" />{ar?"الاتجاه الشهري":"Månadsöversikt"}</CardTitle></CardHeader>
                <CardContent className="px-2 pb-4 overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead><tr className="border-b border-border/40"><th className="text-start px-3 py-2 text-muted-foreground">{ar?"الشهر":"Månad"}</th><th className="text-end px-2 py-2 text-emerald-600">{ar?"دخل":"Inkomst"}</th><th className="text-end px-2 py-2 text-red-600">{ar?"مصاريف":"Kostn."}</th><th className="text-end px-2 py-2 text-blue-600">{ar?"ربح":"Vinst"}</th><th className="text-end px-2 py-2 text-purple-600">{ar?"تراكمي":"Kumulat."}</th><th className="text-end px-2 py-2 text-rose-500">Z</th></tr></thead>
                    <tbody>
                      {monthly.slice(-12).reverse().map((row,i)=>{const zR=adv.monthZScores.find(z=>z.month===row.month);return(
                        <tr key={i} className={cn("border-b border-border/20 hover:bg-muted/20",zR?.anomaly&&"bg-rose-50/50 dark:bg-rose-950/10")}>
                          <td className="px-3 py-2 font-medium">{ar?row.monthAr:row.month}</td>
                          <td className="text-end px-2 py-2 text-emerald-600 font-bold">{fmtAmount(row.income,lang as any)}</td>
                          <td className="text-end px-2 py-2 text-red-600 font-bold">{fmtAmount(row.expense,lang as any)}</td>
                          <td className={cn("text-end px-2 py-2 font-bold",row.profit>=0?"text-blue-600":"text-orange-600")}>{row.profit>=0?"+":"-"}{fmtAmount(Math.abs(row.profit),lang as any)}</td>
                          <td className={cn("text-end px-2 py-2 font-bold",row.cumulative>=0?"text-purple-600":"text-orange-600")}>{row.cumulative>=0?"+":"-"}{fmtAmount(Math.abs(row.cumulative),lang as any)}</td>
                          <td className={cn("text-end px-2 py-2 font-bold text-[9px]",zR?.anomaly?"text-rose-600":"text-muted-foreground")}>{zR?zR.z.toFixed(2):"—"}{zR?.anomaly?"⚡":""}</td>
                        </tr>
                      );})}
                      {adv.pred&&<tr className="bg-muted/30 border-t-2 border-dashed border-border/60"><td className="px-3 py-2 font-bold text-muted-foreground">{ar?"توقع →":"Prognos →"}</td><td className="text-end px-2 py-2 text-emerald-500 italic font-bold">{fmtAmount(adv.pred.income,lang as any)}</td><td className="text-end px-2 py-2 text-red-500 italic font-bold">{fmtAmount(adv.pred.expense,lang as any)}</td><td className={cn("text-end px-2 py-2 italic font-bold",adv.pred.profit>=0?"text-blue-500":"text-orange-500")}>{adv.pred.profit>=0?"+":"-"}{fmtAmount(Math.abs(adv.pred.profit),lang as any)}</td><td className="text-end px-2 py-2 text-muted-foreground">—</td><td className="text-end px-2 py-2 text-[9px] text-muted-foreground">ML</td></tr>}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <div className="h-6" />
      </div>

      {/* ══ Drill-Down Modal ════════════════════════════════════════════════════ */}
      <DrillModal open={drillKey !== null} onClose={() => setDrillKey(null)} title={drillKey ? (ar ? (GLOSSARY[drillKey]?.nameAr ?? drillKey) : (GLOSSARY[drillKey]?.nameSv ?? drillKey)) : ""}>
        {drillContent}
      </DrillModal>

      {/* ══ Edit Transaction Modal ══════════════════════════════════════════════ */}
      <EditTxModal tx={editTx} open={editTx !== null} onClose={() => setEditTx(null)} onSaved={refetch} ar={ar} />
    </div>
  );
}
