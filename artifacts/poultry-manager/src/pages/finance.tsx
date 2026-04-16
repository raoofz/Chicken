/**
 * نظام الذكاء المالي والإنتاجي المتكامل
 * Integrated Financial & Production Intelligence System
 * Live updates · Anomaly Detection · Cost Intelligence · Predictive Engine
 * Fully deterministic · Bilingual AR/SV · Google-grade UX
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ComposedChart,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Plus, Trash2, Loader2,
  ArrowUpCircle, ArrowDownCircle, Filter, Brain, RefreshCw,
  Receipt, Search, Target, BarChart2, Activity, Wallet, Sparkles,
  ChevronDown, AlertTriangle, CheckCircle, Calendar, Award,
  FileText, ShieldAlert, ShieldCheck, Info, Zap, Eye, Cpu,
  TrendingUp as Trend, Flame, Bird, Egg, Scale, Clock, BarChart3,
  CircleDollarSign, PieChart as PieChartIcon, Layers, BrainCircuit,
  ArrowRight, ArrowLeft, Microscope, Wifi, WifiOff, RefreshCcw,
  ChevronRight, Star, AlertCircle, CheckSquare, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES_EXPENSE = ["feed","medicine","equipment","electricity","labor","maintenance","other"];
const CATEGORIES_INCOME  = ["chick_sale","egg_sale","other"];
const COLORS_EXPENSE = ["#ef4444","#f97316","#f59e0b","#84cc16","#06b6d4","#8b5cf6","#ec4899"];
const COLORS_INCOME  = ["#10b981","#3b82f6","#6366f1"];
const COLORS_CHART   = ["#10b981","#ef4444","#3b82f6","#f59e0b","#8b5cf6","#ec4899","#14b8a6","#f97316"];

const CAT_KEYS: Record<string,string> = {
  feed:"finance.cat.feed", medicine:"finance.cat.medicine", chick_sale:"finance.cat.chick_sale",
  egg_sale:"finance.cat.egg_sale", equipment:"finance.cat.equipment", electricity:"finance.cat.electricity",
  labor:"finance.cat.labor", maintenance:"finance.cat.maintenance", other:"finance.cat.other",
};
const CAT_ICONS: Record<string,string> = {
  feed:"🌾", medicine:"💊", chick_sale:"🐥", egg_sale:"🥚",
  equipment:"🔧", electricity:"⚡", labor:"👷", maintenance:"🛠️", other:"📦",
};
const LIVE_INTERVAL_MS = 30_000;

// ─── Types ────────────────────────────────────────────────────────────────────
type Period = "today" | "week" | "month" | "year" | "all";
type TabType = "overview" | "intelligence" | "charts" | "transactions" | "reports";
type FilterType = "all" | "income" | "expense";

interface Transaction {
  id: number; date: string; type: "income"|"expense"; category: string;
  description: string; amount: string; quantity: string|null;
  unit: string|null; notes: string|null; authorName: string|null; createdAt: string;
}
interface DashSummary {
  totalChickens: number; totalFlocks: number; overallHatchRate: number;
  activeHatchingCycles: number; totalEggsIncubating: number;
  goalsCompleted: number; totalGoals: number;
}

// ─── Anomaly types ────────────────────────────────────────────────────────────
interface Anomaly {
  id: string; severity: "critical" | "warning" | "info";
  titleAr: string; titleSv: string; msgAr: string; msgSv: string;
  metricAr?: string; metricSv?: string;
}

// ─── Cost Intelligence types ──────────────────────────────────────────────────
interface CostIntel {
  costPerBird: number | null;
  revenuePerBird: number | null;
  profitPerBird: number | null;
  dailyBurnRate: number;
  dailyRevRate: number;
  breakEvenIncome: number;
  feedRatio: number | null;
  laborRatio: number | null;
  roiPercent: number | null;
}

// ─── Prediction types ─────────────────────────────────────────────────────────
interface Prediction {
  nextMonthIncome: number | null;
  nextMonthExpense: number | null;
  nextMonthProfit: number | null;
  trend: "up" | "down" | "stable";
  confidence: "low" | "medium" | "high";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include", ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Error");
  return r.status === 204 ? null : r.json();
}

function fmtAmount(n: number, lang: "ar"|"sv" = "ar"): string {
  const formatted = new Intl.NumberFormat(lang === "ar" ? "ar-IQ" : "sv-SE").format(Math.abs(Math.round(n)));
  return lang === "ar" ? `${formatted} د.ع` : `${formatted} IQD`;
}

function getPeriodRange(period: Period): { start: string; end: string } | null {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (period === "all") return null;
  if (period === "today") return { start: fmt(today), end: fmt(today) };
  if (period === "week") {
    const s = new Date(today); s.setDate(today.getDate() - 6);
    return { start: fmt(s), end: fmt(today) };
  }
  if (period === "month") {
    return { start: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), end: fmt(today) };
  }
  if (period === "year") {
    return { start: `${today.getFullYear()}-01-01`, end: fmt(today) };
  }
  return null;
}

function getPeriodDays(period: Period): number {
  return { today: 1, week: 7, month: 30, year: 365, all: 90 }[period];
}

// ─── Anomaly Detection Engine ─────────────────────────────────────────────────
function detectAnomalies(
  income: number, expense: number,
  txs: Transaction[],
  expByCat: { cat: string; value: number }[],
  totalChickens: number,
  monthlyData: { income: number; expense: number; profit: number }[]
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const profit = income - expense;
  const margin = income > 0 ? (profit / income) * 100 : null;

  // Rule 1: Operating at a loss
  if (income > 0 && profit < 0) {
    anomalies.push({
      id: "loss", severity: "critical",
      titleAr: "⚠️ خسارة مالية مُكتشفة", titleSv: "⚠️ Ekonomisk förlust detekterad",
      msgAr: `المزرعة تعمل بخسارة صافية قدرها ${fmtAmount(Math.abs(profit), "ar")}. يجب مراجعة هيكل التكاليف فوراً.`,
      msgSv: `Gården drivs med en nettoförlust på ${fmtAmount(Math.abs(profit), "sv")}. Kostnadsstrukturen måste granskas omedelbart.`,
      metricAr: fmtAmount(profit, "ar"), metricSv: fmtAmount(profit, "sv"),
    });
  }

  // Rule 2: Dangerously high expense ratio
  if (income > 0 && margin !== null && margin < 10 && margin >= 0) {
    anomalies.push({
      id: "margin_low", severity: "warning",
      titleAr: "هامش الربح خطير جداً", titleSv: "Kritiskt låg vinstmarginal",
      msgAr: `هامش الربح ${margin.toFixed(1)}% أقل من الحد الآمن 15%. مزرعتك معرضة لمخاطر مالية عالية.`,
      msgSv: `Vinstmarginalen ${margin.toFixed(1)}% är under den säkra gränsen 15%. Gården är utsatt för höga finansiella risker.`,
      metricAr: `${margin.toFixed(1)}%`, metricSv: `${margin.toFixed(1)}%`,
    });
  }

  // Rule 3: Feed cost concentration (>45% of expenses)
  const feedEntry = expByCat.find(c => c.cat === "feed");
  if (feedEntry && expense > 0) {
    const feedRatio = (feedEntry.value / expense) * 100;
    if (feedRatio > 45) {
      anomalies.push({
        id: "feed_heavy", severity: "warning",
        titleAr: "🌾 تركز مفرط في تكاليف العلف", titleSv: "🌾 Hög koncentration i foderkostnader",
        msgAr: `العلف يمثل ${feedRatio.toFixed(0)}% من إجمالي المصاريف — أعلى من المعيار 40%. راجع كميات العلف وجودته.`,
        msgSv: `Foder utgör ${feedRatio.toFixed(0)}% av totala kostnader — över standarden 40%. Granska fodermängd och -kvalitet.`,
        metricAr: `${feedRatio.toFixed(0)}%`, metricSv: `${feedRatio.toFixed(0)}%`,
      });
    }
  }

  // Rule 4: Single expense category dominates (>60%)
  if (expByCat.length > 0 && expense > 0) {
    const top = expByCat[0];
    const topRatio = (top.value / expense) * 100;
    if (topRatio > 60 && top.cat !== "feed") {
      anomalies.push({
        id: "cat_concentration", severity: "warning",
        titleAr: "تركيز عالٍ في بند واحد", titleSv: "Hög koncentration i en kategori",
        msgAr: `فئة "${CAT_ICONS[top.cat] ?? ""} ${top.cat}" تستهلك ${topRatio.toFixed(0)}% من المصاريف — مخاطرة عالية.`,
        msgSv: `Kategorin "${CAT_ICONS[top.cat] ?? ""} ${top.cat}" konsumerar ${topRatio.toFixed(0)}% av kostnaderna — hög risk.`,
        metricAr: `${topRatio.toFixed(0)}%`, metricSv: `${topRatio.toFixed(0)}%`,
      });
    }
  }

  // Rule 5: No income recorded
  if (txs.length > 5 && income === 0) {
    anomalies.push({
      id: "no_income", severity: "warning",
      titleAr: "لا يوجد دخل مسجل في الفترة", titleSv: "Ingen inkomst registrerad i perioden",
      msgAr: "تسجيل الدخل ضروري لتحليل الربحية. أضف معاملات الدخل لفترتك المحددة.",
      msgSv: "Inkomstregistrering är nödvändig för lönsamhetsanalys. Lägg till inkomsttransaktioner för din valda period.",
    });
  }

  // Rule 6: Declining profit trend (last 3 months)
  if (monthlyData.length >= 3) {
    const recent = monthlyData.slice(-3);
    const declining = recent[0].profit > recent[1].profit && recent[1].profit > recent[2].profit;
    if (declining && recent[2].profit < 0) {
      anomalies.push({
        id: "trend_down", severity: "critical",
        titleAr: "📉 اتجاه تنازلي متسارع للأرباح", titleSv: "📉 Accelererande nedåtgående vinsttrend",
        msgAr: "الأرباح تتراجع بشكل متسارع خلال آخر 3 أشهر. تدخّل فوري مطلوب.",
        msgSv: "Vinsterna sjunker accelererande under de senaste 3 månaderna. Omedelbar intervention krävs.",
      });
    }
  }

  // Rule 7: Good performance
  if (income > 0 && margin !== null && margin >= 25 && profit > 0) {
    anomalies.push({
      id: "excellent", severity: "info",
      titleAr: "✅ أداء مالي استثنائي", titleSv: "✅ Exceptionell finansiell prestanda",
      msgAr: `هامش ربح ${margin.toFixed(1)}% يتجاوز المعيار الصناعي بشكل ممتاز. استمر في هذا المسار.`,
      msgSv: `Vinstmarginal ${margin.toFixed(1)}% överstiger branschstandarden utmärkt. Fortsätt på denna kurs.`,
      metricAr: `${margin.toFixed(1)}%`, metricSv: `${margin.toFixed(1)}%`,
    });
  }

  return anomalies;
}

// ─── Cost Intelligence Engine ─────────────────────────────────────────────────
function computeCostIntel(
  income: number, expense: number,
  txs: Transaction[],
  totalChickens: number,
  periodDays: number
): CostIntel {
  const feedVal = txs.filter(t => t.type === "expense" && t.category === "feed").reduce((s,t) => s + Number(t.amount), 0);
  const laborVal = txs.filter(t => t.type === "expense" && t.category === "labor").reduce((s,t) => s + Number(t.amount), 0);

  return {
    costPerBird: totalChickens > 0 ? expense / totalChickens : null,
    revenuePerBird: totalChickens > 0 ? income / totalChickens : null,
    profitPerBird: totalChickens > 0 ? (income - expense) / totalChickens : null,
    dailyBurnRate: periodDays > 0 ? expense / periodDays : 0,
    dailyRevRate: periodDays > 0 ? income / periodDays : 0,
    breakEvenIncome: expense,
    feedRatio: expense > 0 && feedVal > 0 ? (feedVal / expense) * 100 : null,
    laborRatio: expense > 0 && laborVal > 0 ? (laborVal / expense) * 100 : null,
    roiPercent: expense > 0 ? ((income - expense) / expense) * 100 : null,
  };
}

// ─── Predictive Financial Engine (Linear Trend) ────────────────────────────────
function computePrediction(monthlyData: { income: number; expense: number; profit: number }[]): Prediction {
  if (monthlyData.length < 2) return { nextMonthIncome: null, nextMonthExpense: null, nextMonthProfit: null, trend: "stable", confidence: "low" };

  const recent = monthlyData.slice(-Math.min(6, monthlyData.length));
  const n = recent.length;

  // Simple linear regression for income and expense
  function linReg(vals: number[]): number {
    const xMean = (n - 1) / 2;
    const yMean = vals.reduce((s,v) => s+v, 0) / n;
    let num = 0, den = 0;
    vals.forEach((v, i) => { num += (i - xMean) * (v - yMean); den += (i - xMean) ** 2; });
    const slope = den !== 0 ? num / den : 0;
    const intercept = yMean - slope * xMean;
    return Math.round(intercept + slope * n);
  }

  const nextInc = Math.max(0, linReg(recent.map(m => m.income)));
  const nextExp = Math.max(0, linReg(recent.map(m => m.expense)));
  const nextProfit = nextInc - nextExp;

  const lastProfit = recent[recent.length - 1].profit;
  const trend: "up"|"down"|"stable" = nextProfit > lastProfit * 1.05 ? "up" : nextProfit < lastProfit * 0.95 ? "down" : "stable";
  const confidence: "low"|"medium"|"high" = n >= 5 ? "high" : n >= 3 ? "medium" : "low";

  return { nextMonthIncome: nextInc, nextMonthExpense: nextExp, nextMonthProfit: nextProfit, trend, confidence };
}

// ─── Health Score ─────────────────────────────────────────────────────────────
function calcHealthScore(income: number, expense: number, txCount: number): {
  score: number; grade: "excellent"|"good"|"fair"|"poor"; color: string; bgColor: string;
} {
  if (txCount === 0) return { score: 0, grade: "poor", color: "text-slate-400", bgColor: "from-slate-300 to-slate-400" };
  const margin = income > 0 ? ((income - expense) / income) * 100 : 0;
  const clampedMargin = Math.max(0, Math.min(100, margin + 50));
  const score = Math.round(clampedMargin);
  if (score >= 75) return { score, grade: "excellent", color: "text-emerald-600", bgColor: "from-emerald-400 to-teal-500" };
  if (score >= 60) return { score, grade: "good", color: "text-blue-600", bgColor: "from-blue-400 to-indigo-500" };
  if (score >= 45) return { score, grade: "fair", color: "text-amber-600", bgColor: "from-amber-400 to-orange-500" };
  return { score, grade: "poor", color: "text-red-600", bgColor: "from-red-400 to-rose-500" };
}

// ─── Grade colors ─────────────────────────────────────────────────────────────
const GRADE_COLORS: Record<string, { start: string; end: string; text: string; badge: string }> = {
  excellent: { start: "#34d399", end: "#14b8a6", text: "#059669", badge: "bg-emerald-100 text-emerald-700" },
  good:      { start: "#60a5fa", end: "#6366f1", text: "#2563eb", badge: "bg-blue-100 text-blue-700" },
  fair:      { start: "#fbbf24", end: "#f97316", text: "#d97706", badge: "bg-amber-100 text-amber-700" },
  poor:      { start: "#f87171", end: "#fb7185", text: "#dc2626", badge: "bg-red-100 text-red-700" },
};

// ─── SVG Health Gauge ─────────────────────────────────────────────────────────
function HealthGauge({ score, grade }: { score: number; grade: string; color: string; bgColor: string }) {
  const R = 56; const cx = 70; const cy = 70;
  const circumference = Math.PI * R;
  const dash = (score / 100) * circumference;
  const gc = GRADE_COLORS[grade] ?? GRADE_COLORS.poor;
  const gradeLabel = { excellent: { ar: "ممتاز", sv: "Utmärkt" }, good: { ar: "جيد", sv: "Bra" }, fair: { ar: "مقبول", sv: "Godkänt" }, poor: { ar: "ضعيف", sv: "Svagt" } }[grade] ?? { ar: grade, sv: grade };
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <svg width="140" height="90" viewBox="0 0 140 90">
          <defs>
            <linearGradient id="gaugeGradFin" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={gc.start} />
              <stop offset="100%" stopColor={gc.end} />
            </linearGradient>
          </defs>
          <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
            fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
          <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
            fill="none" stroke="url(#gaugeGradFin)" strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ transition: "stroke-dasharray 1s ease" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-3xl font-black" style={{ color: gc.text }}>{score}</span>
          <span className="text-[10px] text-muted-foreground">/100</span>
        </div>
      </div>
      <Badge className={cn("text-xs font-bold px-3 py-1", gc.badge)}>{gradeLabel.ar} / {gradeLabel.sv}</Badge>
    </div>
  );
}

// ─── Live Badge ───────────────────────────────────────────────────────────────
function LiveBadge({ lastUpdated, isFetching }: { lastUpdated: Date; isFetching: boolean }) {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceRender(n => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.round((Date.now() - lastUpdated.getTime()) / 1000);
  const label = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`;
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
      {isFetching ? (
        <RefreshCcw className="w-3 h-3 animate-spin text-blue-500" />
      ) : (
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
      )}
      <span className="hidden sm:inline">Live · {label} ago / sedan</span>
    </div>
  );
}

// ─── Anomaly Alert Strip ──────────────────────────────────────────────────────
function AnomalyStrip({ anomalies, lang }: { anomalies: Anomaly[]; lang: "ar"|"sv" }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = anomalies.filter(a => !dismissed.has(a.id) && a.severity !== "info");
  if (visible.length === 0) return null;
  const top = visible[0];
  const cfg = top.severity === "critical"
    ? { bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/40", icon: AlertTriangle, ic: "text-red-500", text: "text-red-700 dark:text-red-300" }
    : { bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40", icon: AlertTriangle, ic: "text-amber-500", text: "text-amber-700 dark:text-amber-300" };
  const Icon = cfg.icon;
  return (
    <div className={cn("rounded-xl border px-3.5 py-2.5 flex items-center gap-3", cfg.bg)}>
      <Icon className={cn("w-4 h-4 flex-shrink-0", cfg.ic)} />
      <div className="flex-1 min-w-0">
        <span className={cn("text-xs font-bold", cfg.text)}>{lang === "ar" ? top.titleAr : top.titleSv}</span>
        {visible.length > 1 && (
          <Badge variant="outline" className="ms-2 text-[9px] h-4">{visible.length - 1}+</Badge>
        )}
        <p className={cn("text-[10px] truncate", cfg.text)}>{lang === "ar" ? top.msgAr : top.msgSv}</p>
      </div>
      {top.metricAr && (
        <span className={cn("text-xs font-black shrink-0", cfg.text)}>{lang === "ar" ? top.metricAr : top.metricSv}</span>
      )}
      <button onClick={() => setDismissed(s => new Set([...s, top.id]))}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors text-sm leading-none">×</button>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, gradient, trend, badge }: {
  label: string; value: string; sub?: string; icon: any; gradient: string;
  trend?: "up"|"down"|"neutral"; badge?: { text: string; color: string };
}) {
  return (
    <Card className="border-none shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        <div className={cn("h-1 w-full bg-gradient-to-r", gradient)} />
        <div className="p-4 flex items-center gap-3">
          <div className={cn("w-11 h-11 rounded-2xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-sm", gradient)}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground leading-none mb-1 truncate">{label}</p>
            <p className="text-base font-bold truncate leading-tight">{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {trend === "up" && <TrendingUp className="w-4 h-4 text-emerald-500" />}
            {trend === "down" && <TrendingDown className="w-4 h-4 text-red-500" />}
            {badge && <Badge className={cn("text-[9px] h-4 px-1.5", badge.color)}>{badge.text}</Badge>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Mini Sparkline SVG ───────────────────────────────────────────────────────
function Sparkline({ data, color = "#10b981" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data); const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80; const h = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={Number(pts.split(" ").pop()?.split(",")[0])} cy={Number(pts.split(" ").pop()?.split(",")[1])} r="2.5" fill={color} />
    </svg>
  );
}

// ─── Add Transaction Dialog ───────────────────────────────────────────────────
function AddTransactionDialog({ onSuccess }: { onSuccess: () => void }) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: "expense" as "income"|"expense",
    date: new Date().toISOString().split("T")[0],
    category: "", description: "", amount: "", quantity: "", unit: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const cats = form.type === "income" ? CATEGORIES_INCOME : CATEGORIES_EXPENSE;

  const handleSubmit = async () => {
    if (!form.date || !form.category || !form.description || !form.amount) {
      toast({ variant: "destructive", title: t("finance.error.required") }); return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/transactions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount), quantity: form.quantity ? Number(form.quantity) : null }),
      });
      toast({ title: t("finance.added") });
      setOpen(false);
      setForm({ type: "expense", date: new Date().toISOString().split("T")[0], category: "", description: "", amount: "", quantity: "", unit: "", notes: "" });
      onSuccess();
    } catch (e: any) { toast({ variant: "destructive", title: e.message }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-none shadow-md shadow-emerald-500/20">
          <Plus className="w-4 h-4" />{t("finance.add")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" dir={lang === "ar" ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-500" />
            {t("finance.add")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex gap-2">
            {(["expense","income"] as const).map(tp => (
              <button key={tp} onClick={() => setForm(f => ({ ...f, type: tp, category: "" }))}
                className={cn("flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all border-2",
                  form.type === tp
                    ? tp === "income" ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20"
                                      : "bg-red-500 text-white border-red-500 shadow-md shadow-red-500/20"
                    : "bg-muted text-muted-foreground border-transparent hover:border-slate-200")}>
                {tp === "income" ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                {t(`finance.type.${tp}`)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">{t("finance.date")}</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">{t("finance.amount")} (IQD)</Label>
              <Input type="number" min="0" placeholder="0" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">{t("finance.category")}</Label>
            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue placeholder={t("finance.category")} /></SelectTrigger>
              <SelectContent>
                {cats.map(c => (
                  <SelectItem key={c} value={c}>
                    <span className="flex items-center gap-2">
                      <span>{CAT_ICONS[c]}</span>{t(CAT_KEYS[c] ?? c)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">{t("finance.description")}</Label>
            <Input placeholder={t("finance.description")} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">{t("finance.quantity")} ({t("finance.optional")})</Label>
              <Input type="number" min="0" placeholder="0" value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">{t("finance.unit")} ({t("finance.optional")})</Label>
              <Input placeholder="kg, لتر..." value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">{t("finance.notes.label")} ({t("finance.optional")})</Label>
            <Textarea className="text-sm resize-none" rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <Button className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-none"
            onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <CheckCircle className="w-4 h-4 me-2" />}
            {t("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Custom Chart Tooltip ─────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, lang }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 shadow-xl rounded-xl px-4 py-3 border border-border/50 text-xs">
      <p className="font-bold mb-2 text-slate-700 dark:text-slate-200">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold flex items-center justify-between gap-4">
          <span>{p.name}</span>
          <span>{fmtAmount(p.value, lang)}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Metric Tile ──────────────────────────────────────────────────────────────
function MetricTile({ icon: Icon, label, value, sub, bg, color, trend }: {
  icon: any; label: string; value: string; sub?: string; bg: string; color: string; trend?: "up"|"down"|"neutral";
}) {
  return (
    <div className={cn("rounded-2xl p-3.5 flex items-start gap-3", bg)}>
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", color, "bg-white/50 dark:bg-black/20")}>
        <Icon className={cn("w-4.5 h-4.5", color)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[10px] font-medium opacity-70", color)}>{label}</p>
        <p className={cn("text-sm font-black leading-tight", color)}>{value}</p>
        {sub && <p className={cn("text-[9px] opacity-60", color)}>{sub}</p>}
      </div>
      {trend === "up" && <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-1" />}
      {trend === "down" && <TrendingDown className="w-3.5 h-3.5 text-red-600 shrink-0 mt-1" />}
    </div>
  );
}

// ─── Main Finance Component ───────────────────────────────────────────────────
export default function Finance() {
  const { t, lang } = useLanguage();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const ar = lang === "ar";

  const [period, setPeriod] = useState<Period>("month");
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // ── Live Data Queries ──────────────────────────────────────────────────────
  const {
    data: transactions = [],
    isLoading,
    isFetching: txFetching,
  } = useQuery<Transaction[]>({
    queryKey: ["transactions"],
    queryFn: () => apiFetch("/api/transactions"),
    refetchInterval: LIVE_INTERVAL_MS,
    staleTime: 20_000,
  });

  const { data: summary = [], isFetching: sumFetching } = useQuery<any[]>({
    queryKey: ["transactions-summary"],
    queryFn: () => apiFetch("/api/transactions/summary"),
    refetchInterval: LIVE_INTERVAL_MS,
    staleTime: 20_000,
  });

  const { data: farmSummary } = useQuery<DashSummary>({
    queryKey: ["farm-summary-finance"],
    queryFn: () => apiFetch("/api/dashboard/summary"),
    refetchInterval: LIVE_INTERVAL_MS,
    staleTime: 20_000,
  });

  const isFetching = txFetching || sumFetching;
  useEffect(() => { if (!isFetching) setLastUpdated(new Date()); }, [isFetching]);

  // ── Period Filter ──────────────────────────────────────────────────────────
  const periodFiltered = useMemo(() => {
    const range = getPeriodRange(period);
    if (!range) return transactions;
    return transactions.filter(tr => tr.date >= range.start && tr.date <= range.end);
  }, [transactions, period]);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalIncome  = useMemo(() => periodFiltered.filter(t => t.type === "income").reduce((s,t) => s + Number(t.amount), 0), [periodFiltered]);
  const totalExpense = useMemo(() => periodFiltered.filter(t => t.type === "expense").reduce((s,t) => s + Number(t.amount), 0), [periodFiltered]);
  const profit = totalIncome - totalExpense;
  const marginPct = totalIncome > 0 ? ((profit / totalIncome) * 100).toFixed(1) : "—";
  const periodDays = getPeriodDays(period);

  const health = useMemo(() => calcHealthScore(totalIncome, totalExpense, periodFiltered.length), [totalIncome, totalExpense, periodFiltered.length]);

  // ── Monthly Data ───────────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; income: number; expense: number; profit: number }> = {};
    summary.forEach((r: any) => {
      if (!map[r.month]) map[r.month] = { month: r.month, income: 0, expense: 0, profit: 0 };
      if (r.type === "income") map[r.month].income += Number(r.total);
      else map[r.month].expense += Number(r.total);
    });
    const arr = Object.values(map).sort((a,b) => a.month.localeCompare(b.month)).slice(-9);
    return arr.map(d => ({ ...d, profit: d.income - d.expense }));
  }, [summary]);

  // ── Category Breakdowns ────────────────────────────────────────────────────
  const expenseByCat = useMemo(() => {
    const map: Record<string,number> = {};
    periodFiltered.filter(t => t.type === "expense").forEach(tr => {
      map[tr.category] = (map[tr.category] ?? 0) + Number(tr.amount);
    });
    return Object.entries(map)
      .map(([cat, value]) => ({ name: `${CAT_ICONS[cat]??""} ${t(CAT_KEYS[cat]??cat)}`, value, cat }))
      .sort((a,b) => b.value - a.value);
  }, [periodFiltered, t]);

  const incomeByCat = useMemo(() => {
    const map: Record<string,number> = {};
    periodFiltered.filter(t => t.type === "income").forEach(tr => {
      map[tr.category] = (map[tr.category] ?? 0) + Number(tr.amount);
    });
    return Object.entries(map)
      .map(([cat, value]) => ({ name: `${CAT_ICONS[cat]??""} ${t(CAT_KEYS[cat]??cat)}`, value, cat }))
      .sort((a,b) => b.value - a.value);
  }, [periodFiltered, t]);

  // ── Intelligence Computations ──────────────────────────────────────────────
  const totalChickens = farmSummary?.totalChickens ?? 0;
  const anomalies = useMemo(() => detectAnomalies(totalIncome, totalExpense, periodFiltered, expenseByCat, totalChickens, monthlyData), [totalIncome, totalExpense, periodFiltered, expenseByCat, totalChickens, monthlyData]);
  const costIntel = useMemo(() => computeCostIntel(totalIncome, totalExpense, periodFiltered, totalChickens, periodDays), [totalIncome, totalExpense, periodFiltered, totalChickens, periodDays]);
  const prediction = useMemo(() => computePrediction(monthlyData), [monthlyData]);

  // ── Filtered Transactions ──────────────────────────────────────────────────
  const filteredTx = useMemo(() => {
    let arr = filter === "all" ? periodFiltered : periodFiltered.filter(t => t.type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(t => t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || String(t.amount).includes(q));
    }
    return arr;
  }, [periodFiltered, filter, search]);

  const bestMonth  = useMemo(() => monthlyData.length ? monthlyData.reduce((a,b) => a.profit > b.profit ? a : b) : null, [monthlyData]);
  const worstMonth = useMemo(() => monthlyData.length ? monthlyData.reduce((a,b) => a.profit < b.profit ? a : b) : null, [monthlyData]);

  const handleDelete = async (id: number) => {
    if (!confirm(t("finance.confirm.delete"))) return;
    setDeletingId(id);
    try {
      await apiFetch(`/api/transactions/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["transactions-summary"] });
      toast({ title: t("finance.deleted") });
    } catch (e: any) { toast({ variant: "destructive", title: e.message }); }
    finally { setDeletingId(null); }
  };

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["transactions-summary"] });
  }, [qc]);

  // ── Tab Config ─────────────────────────────────────────────────────────────
  const PERIODS: { key: Period; labelAr: string; labelSv: string }[] = [
    { key: "today",  labelAr: "اليوم", labelSv: "Idag" },
    { key: "week",   labelAr: "أسبوع", labelSv: "Vecka" },
    { key: "month",  labelAr: "شهر",   labelSv: "Månad" },
    { key: "year",   labelAr: "سنة",   labelSv: "År" },
    { key: "all",    labelAr: "الكل",  labelSv: "Alla" },
  ];

  const TABS: { key: TabType; icon: any; labelAr: string; labelSv: string; badge?: number }[] = [
    { key: "overview",      icon: Activity,    labelAr: "الأداء",     labelSv: "Prestanda" },
    { key: "intelligence",  icon: BrainCircuit, labelAr: "الذكاء المالي", labelSv: "Finansiell intelligens", badge: anomalies.filter(a => a.severity !== "info").length || undefined },
    { key: "charts",        icon: BarChart2,   labelAr: "التحليل البياني", labelSv: "Diagram" },
    { key: "transactions",  icon: Receipt,     labelAr: "المعاملات", labelSv: "Transaktioner" },
    { key: "reports",       icon: FileText,    labelAr: "التقارير",  labelSv: "Rapporter" },
  ];

  const criticalAnomalies = anomalies.filter(a => a.severity !== "info");

  // ── Monthly sparkline data for chart
  const profitSparkData = monthlyData.map(m => m.profit);
  const incomeSparkData = monthlyData.map(m => m.income);

  const isRtl = lang === "ar";

  return (
    <div className="flex flex-col gap-4 pb-8 animate-in fade-in duration-300">

      {/* ══ HEADER ═══════════════════════════════════════════════════════════ */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
            <CircleDollarSign className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{ar ? "الذكاء المالي والإنتاجي" : "Finansiell & Produktionsintelligens"}</h1>
              <LiveBadge lastUpdated={lastUpdated} isFetching={isFetching} />
            </div>
            <p className="text-xs text-muted-foreground">{ar ? "تحليل مباشر · كشف شذوذات · توقعات ذكية" : "Direktanalys · Anomalidetektion · Smarta prognoser"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={invalidate}
            className="gap-1.5 text-xs h-8">
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
            {ar ? "تحديث" : "Uppdatera"}
          </Button>
          <AddTransactionDialog onSuccess={invalidate} />
        </div>
      </div>

      {/* ── Anomaly Alert Strip ─────────────────────────────────────────────── */}
      {criticalAnomalies.length > 0 && (
        <AnomalyStrip anomalies={criticalAnomalies} lang={lang as "ar"|"sv"} />
      )}

      {/* ══ PERIOD SELECTOR ══════════════════════════════════════════════════ */}
      <div className="flex gap-1 p-1 bg-muted/60 rounded-xl overflow-x-auto">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={cn(
              "flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
              period === p.key
                ? "bg-white dark:bg-slate-800 shadow-sm text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground hover:text-foreground"
            )}>
            <span className="block">{ar ? p.labelAr : p.labelSv}</span>
          </button>
        ))}
      </div>

      {/* ══ LIVE KPI STRIP ════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label={ar ? "إجمالي الدخل" : "Total inkomst"}
          value={fmtAmount(totalIncome, lang as any)}
          sub={`${periodFiltered.filter(t=>t.type==="income").length} ${ar ? "معاملة" : "transaktioner"}`}
          icon={ArrowUpCircle} gradient="from-emerald-400 to-teal-500" trend="up"
          badge={incomeSparkData.length > 1 ? undefined : undefined}
        />
        <KpiCard
          label={ar ? "إجمالي المصاريف" : "Totala kostnader"}
          value={fmtAmount(totalExpense, lang as any)}
          sub={`${periodFiltered.filter(t=>t.type==="expense").length} ${ar ? "معاملة" : "transaktioner"}`}
          icon={ArrowDownCircle} gradient="from-red-400 to-rose-500" trend="down"
        />
        <KpiCard
          label={ar ? "صافي الربح" : "Nettovinst"}
          value={`${profit >= 0 ? "+" : ""}${fmtAmount(profit, lang as any)}`}
          sub={`${ar ? "الهامش" : "Marginal"}: ${marginPct}%`}
          icon={profit >= 0 ? TrendingUp : TrendingDown}
          gradient={profit >= 0 ? "from-blue-400 to-indigo-500" : "from-orange-400 to-red-500"}
          trend={profit >= 0 ? "up" : "down"}
          badge={profit < 0 ? { text: ar ? "خسارة!" : "Förlust!", color: "bg-red-100 text-red-700" } : undefined}
        />
        <KpiCard
          label={ar ? "الصحة المالية" : "Finansiell hälsa"}
          value={`${health.score}/100`}
          sub={ar ? { excellent:"ممتاز", good:"جيد", fair:"مقبول", poor:"ضعيف" }[health.grade] : { excellent:"Utmärkt", good:"Bra", fair:"Godkänt", poor:"Svagt" }[health.grade]}
          icon={Award}
          gradient={{ excellent:"from-emerald-400 to-teal-500", good:"from-blue-400 to-indigo-500", fair:"from-amber-400 to-orange-500", poor:"from-red-400 to-rose-500" }[health.grade]}
        />
      </div>

      {/* ══ PRODUCTION KPI STRIP (if farm data available) ═════════════════ */}
      {farmSummary && (farmSummary.totalChickens > 0 || farmSummary.activeHatchingCycles > 0) && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-100 dark:border-amber-800/30 p-3 flex items-center gap-2.5">
            <Bird className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">{ar ? "إجمالي الدواجن" : "Totalt fjäderfä"}</p>
              <p className="text-sm font-black text-amber-700">{farmSummary.totalChickens.toLocaleString()}</p>
            </div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/20 dark:to-pink-950/20 border border-rose-100 dark:border-rose-800/30 p-3 flex items-center gap-2.5">
            <Egg className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">{ar ? "معدل التفقيس" : "Kläckningsgrad"}</p>
              <p className="text-sm font-black text-rose-700">{farmSummary.overallHatchRate}%</p>
            </div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border border-violet-100 dark:border-violet-800/30 p-3 flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-violet-600 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">{ar ? "دورات تفقيس" : "Kläckcykler"}</p>
              <p className="text-sm font-black text-violet-700">{farmSummary.activeHatchingCycles}</p>
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB BAR ══════════════════════════════════════════════════════════ */}
      <div className="flex gap-0 border-b border-border overflow-x-auto">
        {TABS.map(({ key, icon: Icon, labelAr, labelSv, badge }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={cn(
              "relative flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap",
              activeTab === key
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            <Icon className="w-3.5 h-3.5" />
            {ar ? labelAr : labelSv}
            {badge && badge > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">{badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: PERFORMANCE OVERVIEW
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {periodFiltered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-14 text-center">
                <CircleDollarSign className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">{t("finance.empty")}</p>
                <p className="text-muted-foreground/60 text-xs mt-1">{t("finance.empty.desc")}</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* ── Score + Breakdown ─────────────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-none shadow-sm overflow-hidden">
                  <div className={cn("h-1.5 bg-gradient-to-r", health.bgColor)} />
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      {ar ? "الصحة المالية" : "Finansiell hälsa"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <HealthGauge {...health} />
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground">{ar ? "دخل" : "Inkomst"}</p>
                        <p className="text-sm font-bold text-emerald-600">{fmtAmount(totalIncome, lang as any)}</p>
                        <Sparkline data={incomeSparkData} color="#10b981" />
                      </div>
                      <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground">{ar ? "مصاريف" : "Kostnader"}</p>
                        <p className="text-sm font-bold text-red-600">{fmtAmount(totalExpense, lang as any)}</p>
                        <Sparkline data={monthlyData.map(m => m.expense)} color="#ef4444" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm overflow-hidden">
                  <div className="h-1.5 bg-gradient-to-r from-blue-400 to-indigo-500" />
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-500" />
                      {ar ? "توزيع الربح" : "Vinstfördelning"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pb-4">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1"><ArrowUpCircle className="w-3 h-3 text-emerald-500"/>{ar ? "دخل" : "Inkomst"}</span>
                        <span className="font-semibold text-emerald-600">{fmtAmount(totalIncome, lang as any)}</span>
                      </div>
                      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-700" style={{ width: totalIncome > 0 ? "100%" : "0%" }} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1"><ArrowDownCircle className="w-3 h-3 text-red-500"/>{ar ? "مصاريف" : "Kostnader"}</span>
                        <span className="font-semibold text-red-600">{fmtAmount(totalExpense, lang as any)}</span>
                      </div>
                      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-red-400 to-rose-500 rounded-full transition-all duration-700"
                          style={{ width: totalIncome > 0 ? `${Math.min(100, (totalExpense/totalIncome)*100)}%` : totalExpense > 0 ? "100%" : "0%" }} />
                      </div>
                    </div>
                    <div className={cn("rounded-xl p-3 flex items-center justify-between",
                      profit >= 0 ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-red-50 dark:bg-red-950/20")}>
                      <span className={cn("text-sm font-bold", profit >= 0 ? "text-emerald-700" : "text-red-700")}>
                        {profit >= 0 ? "✅ " : "❌ "}{ar ? "صافي الربح" : "Nettovinst"}
                      </span>
                      <span className={cn("text-sm font-black", profit >= 0 ? "text-emerald-700" : "text-red-700")}>
                        {profit >= 0 ? "+" : ""}{fmtAmount(profit, lang as any)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      {ar ? "هامش الربح" : "Vinstmarginal"}: <strong>{marginPct}%</strong>
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* ── Top Expense Categories ───────────────────────────── */}
              {expenseByCat.length > 0 && (
                <Card className="border-none shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Flame className="w-4 h-4 text-red-500" />
                      {ar ? "أعلى بنود المصاريف" : "Topp kostnadsposter"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2.5 pb-4">
                    {expenseByCat.slice(0, 5).map((cat, i) => {
                      const pct = totalExpense > 0 ? (cat.value / totalExpense) * 100 : 0;
                      return (
                        <div key={cat.cat}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground font-medium">{cat.name}</span>
                            <span className="font-bold">{fmtAmount(cat.value, lang as any)} <span className="text-muted-foreground font-normal">({pct.toFixed(0)}%)</span></span>
                          </div>
                          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: COLORS_EXPENSE[i % COLORS_EXPENSE.length] }} />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* ── Monthly Trend Mini Chart ─────────────────────────── */}
              {monthlyData.length >= 2 && (
                <Card className="border-none shadow-sm">
                  <CardHeader className="pb-0 pt-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Trend className="w-4 h-4 text-blue-500" />
                        {ar ? "اتجاه الأرباح الشهرية" : "Månatlig vinsttrend"}
                      </CardTitle>
                      <Sparkline data={profitSparkData} color={profit >= 0 ? "#10b981" : "#ef4444"} />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <ResponsiveContainer width="100%" height={140}>
                      <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="profitGradOv" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip content={<ChartTooltip lang={lang} />} />
                        <Area type="monotone" dataKey="profit" name={ar ? "الربح" : "Vinst"}
                          stroke="#3b82f6" fill="url(#profitGradOv)" strokeWidth={2} dot={{ r: 2.5, fill: "#3b82f6" }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* ── Best / Worst Month ───────────────────────────────── */}
              {bestMonth && (
                <div className="grid grid-cols-2 gap-3">
                  <Card className="border-none shadow-sm bg-emerald-50 dark:bg-emerald-950/20">
                    <CardContent className="p-3.5 text-center">
                      <p className="text-[10px] text-muted-foreground mb-0.5">{ar ? "أفضل شهر" : "Bästa månaden"}</p>
                      <p className="text-xs font-bold text-emerald-700">{bestMonth.month}</p>
                      <p className="text-sm font-black text-emerald-600">+{fmtAmount(bestMonth.profit, lang as any)}</p>
                    </CardContent>
                  </Card>
                  {worstMonth && worstMonth.month !== bestMonth.month && (
                    <Card className="border-none shadow-sm bg-red-50 dark:bg-red-950/20">
                      <CardContent className="p-3.5 text-center">
                        <p className="text-[10px] text-muted-foreground mb-0.5">{ar ? "أصعب شهر" : "Svåraste månaden"}</p>
                        <p className="text-xs font-bold text-red-700">{worstMonth.month}</p>
                        <p className="text-sm font-black text-red-600">{fmtAmount(worstMonth.profit, lang as any)}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: FINANCIAL INTELLIGENCE
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "intelligence" && (
        <div className="space-y-5">

          {/* ── Intelligence Header ────────────────────────────────────────── */}
          <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white shadow-lg shadow-violet-500/20">
            <div className="flex items-center gap-3 mb-2">
              <BrainCircuit className="w-6 h-6 text-white/90" />
              <h2 className="text-base font-black">{ar ? "محرك الذكاء المالي" : "Finansiell intelligensmotor"}</h2>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">
              {ar
                ? "نظام حتمي متكامل: كشف الشذوذات · ذكاء التكاليف · التنبؤ المالي · قرارات المدير المالي — بدون ذكاء اصطناعي خارجي"
                : "Fullständigt deterministiskt system: Anomalidetektion · Kostnadsintelligens · Finansiell prognos · CFO-beslut — utan extern AI"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { labelAr: `${anomalies.length} تنبيه`, labelSv: `${anomalies.length} varningar` },
                { labelAr: totalChickens > 0 ? `${fmtAmount(costIntel.costPerBird ?? 0, "ar")}/طير` : ar ? "لا توجد بيانات إنتاج" : "Ingen produktionsdata", labelSv: totalChickens > 0 ? `${fmtAmount(costIntel.costPerBird ?? 0, "sv")}/fågel` : "Ingen produktionsdata" },
                { labelAr: prediction.trend === "up" ? "اتجاه ↑" : prediction.trend === "down" ? "اتجاه ↓" : "مستقر ↔", labelSv: prediction.trend === "up" ? "Trend ↑" : prediction.trend === "down" ? "Trend ↓" : "Stabil ↔" },
              ].map((b, i) => (
                <Badge key={i} className="bg-white/20 text-white border-white/30 text-[10px]">
                  {ar ? b.labelAr : b.labelSv}
                </Badge>
              ))}
            </div>
          </div>

          {/* ── Section 1: Anomaly Detection ──────────────────────────────── */}
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
              <Microscope className="w-4 h-4 text-red-500" />
              {ar ? "كاشف الشذوذات المالية" : "Finansiell anomalidetektor"}
              {anomalies.length > 0 && (
                <Badge className="bg-red-100 text-red-700 text-[10px]">{anomalies.length} {ar ? "تنبيه" : "varningar"}</Badge>
              )}
            </h3>
            {anomalies.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-4 flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-sm font-semibold text-emerald-700">{ar ? "لا توجد شذوذات مُكتشفة" : "Inga anomalier detekterade"}</p>
                  <p className="text-xs text-emerald-600/70">{ar ? "المالية في وضع طبيعي لهذه الفترة" : "Ekonomin är normal för denna period"}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {anomalies.map(a => {
                  const cfg = {
                    critical: { bg: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40", icon: XCircle, ic: "text-red-500", title: "text-red-700 dark:text-red-300", msg: "text-red-600/80 dark:text-red-400/80" },
                    warning:  { bg: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40", icon: AlertTriangle, ic: "text-amber-500", title: "text-amber-700 dark:text-amber-300", msg: "text-amber-600/80 dark:text-amber-400/80" },
                    info:     { bg: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40", icon: CheckSquare, ic: "text-emerald-500", title: "text-emerald-700 dark:text-emerald-300", msg: "text-emerald-600/80 dark:text-emerald-400/80" },
                  }[a.severity];
                  const Icon = cfg.icon;
                  return (
                    <div key={a.id} className={cn("rounded-xl border p-4 flex items-start gap-3", cfg.bg)}>
                      <Icon className={cn("w-5 h-5 flex-shrink-0 mt-0.5", cfg.ic)} />
                      <div className="flex-1">
                        <p className={cn("text-sm font-bold", cfg.title)}>{ar ? a.titleAr : a.titleSv}</p>
                        <p className={cn("text-xs leading-relaxed mt-0.5", cfg.msg)}>{ar ? a.msgAr : a.msgSv}</p>
                      </div>
                      {a.metricAr && (
                        <span className={cn("text-sm font-black shrink-0", cfg.title)}>{ar ? a.metricAr : a.metricSv}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Section 2: Cost Intelligence ──────────────────────────────── */}
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
              <Scale className="w-4 h-4 text-blue-500" />
              {ar ? "ذكاء التكاليف والإنتاجية" : "Kostnadsintelligens & produktivitet"}
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              {totalChickens > 0 && (
                <>
                  <MetricTile
                    icon={Bird} label={ar ? "تكلفة الطير الواحد" : "Kostnad per fågel"}
                    value={costIntel.costPerBird !== null ? fmtAmount(costIntel.costPerBird, lang as any) : "—"}
                    bg="bg-blue-50 dark:bg-blue-950/20" color="text-blue-700 dark:text-blue-300"
                  />
                  <MetricTile
                    icon={CircleDollarSign} label={ar ? "إيراد الطير الواحد" : "Intäkt per fågel"}
                    value={costIntel.revenuePerBird !== null ? fmtAmount(costIntel.revenuePerBird, lang as any) : "—"}
                    bg="bg-emerald-50 dark:bg-emerald-950/20" color="text-emerald-700 dark:text-emerald-300"
                  />
                  <MetricTile
                    icon={TrendingUp} label={ar ? "ربح الطير الواحد" : "Vinst per fågel"}
                    value={costIntel.profitPerBird !== null ? `${costIntel.profitPerBird >= 0 ? "+" : ""}${fmtAmount(costIntel.profitPerBird, lang as any)}` : "—"}
                    bg={costIntel.profitPerBird !== null && costIntel.profitPerBird >= 0 ? "bg-indigo-50 dark:bg-indigo-950/20" : "bg-red-50 dark:bg-red-950/20"}
                    color={costIntel.profitPerBird !== null && costIntel.profitPerBird >= 0 ? "text-indigo-700 dark:text-indigo-300" : "text-red-700 dark:text-red-300"}
                    trend={costIntel.profitPerBird !== null ? (costIntel.profitPerBird >= 0 ? "up" : "down") : undefined}
                  />
                </>
              )}
              <MetricTile
                icon={Clock} label={ar ? "الإنفاق اليومي" : "Daglig utgiftsgrad"}
                value={fmtAmount(costIntel.dailyBurnRate, lang as any)}
                sub={ar ? `/ ${ar ? "يوم" : "dag"}` : "/ dag"}
                bg="bg-orange-50 dark:bg-orange-950/20" color="text-orange-700 dark:text-orange-300"
              />
              <MetricTile
                icon={Target} label={ar ? "نقطة التعادل" : "Brytpunkt"}
                value={fmtAmount(costIntel.breakEvenIncome, lang as any)}
                sub={ar ? "دخل مطلوب" : "Inkomst krävs"}
                bg="bg-purple-50 dark:bg-purple-950/20" color="text-purple-700 dark:text-purple-300"
              />
              {costIntel.roiPercent !== null && (
                <MetricTile
                  icon={BarChart3} label={ar ? "العائد على الاستثمار" : "Avkastning (ROI)"}
                  value={`${costIntel.roiPercent >= 0 ? "+" : ""}${costIntel.roiPercent.toFixed(1)}%`}
                  bg={costIntel.roiPercent >= 0 ? "bg-teal-50 dark:bg-teal-950/20" : "bg-rose-50 dark:bg-rose-950/20"}
                  color={costIntel.roiPercent >= 0 ? "text-teal-700 dark:text-teal-300" : "text-rose-700 dark:text-rose-300"}
                  trend={costIntel.roiPercent >= 0 ? "up" : "down"}
                />
              )}
            </div>

            {/* Cost ratios */}
            {(costIntel.feedRatio !== null || costIntel.laborRatio !== null) && (
              <div className="mt-3 space-y-2">
                {costIntel.feedRatio !== null && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">🌾 {ar ? "نسبة العلف من المصاريف" : "Foderandel av kostnader"}</span>
                      <span className={cn("font-bold", costIntel.feedRatio > 50 ? "text-red-600" : costIntel.feedRatio > 40 ? "text-amber-600" : "text-emerald-600")}>{costIntel.feedRatio.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${costIntel.feedRatio}%`, backgroundColor: costIntel.feedRatio > 50 ? "#ef4444" : costIntel.feedRatio > 40 ? "#f59e0b" : "#10b981" }} />
                    </div>
                  </div>
                )}
                {costIntel.laborRatio !== null && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">👷 {ar ? "نسبة العمالة من المصاريف" : "Arbetsandel av kostnader"}</span>
                      <span className="font-bold text-blue-600">{costIntel.laborRatio.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-blue-400 transition-all duration-700" style={{ width: `${costIntel.laborRatio}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Section 3: Predictive Financial Engine ────────────────────── */}
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
              <Cpu className="w-4 h-4 text-purple-500" />
              {ar ? "محرك التنبؤ المالي" : "Finansiell prognosmotor"}
              <Badge className={cn("text-[9px]", prediction.confidence === "high" ? "bg-emerald-100 text-emerald-700" : prediction.confidence === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600")}>
                {ar ? { high:"ثقة عالية", medium:"ثقة متوسطة", low:"بيانات قليلة" }[prediction.confidence] : { high:"Hög tillförlitlighet", medium:"Medel tillförlitlighet", low:"Otillräckliga data" }[prediction.confidence]}
              </Badge>
            </h3>
            {prediction.nextMonthProfit === null ? (
              <div className="rounded-xl border-dashed border-2 border-muted p-6 text-center">
                <Cpu className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{ar ? "أضف معاملات لأشهر متعددة لتفعيل التنبؤ" : "Lägg till transaktioner för flera månader för att aktivera prognos"}</p>
              </div>
            ) : (
              <Card className="border-none shadow-sm overflow-hidden">
                <div className={cn("h-1.5", prediction.trend === "up" ? "bg-gradient-to-r from-emerald-400 to-teal-500" : prediction.trend === "down" ? "bg-gradient-to-r from-red-400 to-rose-500" : "bg-gradient-to-r from-slate-300 to-slate-400")} />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{ar ? "توقعات الشهر القادم" : "Prognos nästa månad"}</p>
                      <p className={cn("text-2xl font-black", prediction.nextMonthProfit >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {prediction.nextMonthProfit >= 0 ? "+" : ""}{fmtAmount(prediction.nextMonthProfit, lang as any)}
                      </p>
                    </div>
                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center",
                      prediction.trend === "up" ? "bg-emerald-100 dark:bg-emerald-900/30" :
                      prediction.trend === "down" ? "bg-red-100 dark:bg-red-900/30" : "bg-slate-100 dark:bg-slate-800")}>
                      {prediction.trend === "up" ? <TrendingUp className="w-7 h-7 text-emerald-600" /> :
                       prediction.trend === "down" ? <TrendingDown className="w-7 h-7 text-red-600" /> :
                       <Activity className="w-7 h-7 text-slate-500" />}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-2.5">
                      <p className="text-[10px] text-muted-foreground">{ar ? "دخل متوقع" : "Beräknad inkomst"}</p>
                      <p className="text-sm font-bold text-emerald-600">{fmtAmount(prediction.nextMonthIncome!, lang as any)}</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-2.5">
                      <p className="text-[10px] text-muted-foreground">{ar ? "مصاريف متوقعة" : "Beräknade kostnader"}</p>
                      <p className="text-sm font-bold text-red-600">{fmtAmount(prediction.nextMonthExpense!, lang as any)}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center mt-3">
                    {ar ? "* بناءً على اتجاه آخر " : "* Baserat på trenden de senaste "}{monthlyData.length} {ar ? "أشهر — حتمي تماماً" : "månaderna — fullt deterministisk"}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Section 4: CFO Decision Engine ───────────────────────────── */}
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-500" />
              {ar ? "توصيات المدير المالي" : "CFO-rekommendationer"}
            </h3>
            {(() => {
              const decisions: { icon: any; actionAr: string; actionSv: string; reasonAr: string; reasonSv: string; priority: "high"|"medium"|"low" }[] = [];

              if (profit < 0) decisions.push({ icon: AlertCircle, priority: "high",
                actionAr: "مراجعة فورية لهيكل التكاليف", actionSv: "Omedelbar granskning av kostnadsstrukturen",
                reasonAr: "المزرعة تسجل خسارة — يجب تحديد مصادر النزيف المالي وقطعها", reasonSv: "Gården registrerar förlust — identifiera och stoppa de finansiella blödningarna" });

              if (costIntel.feedRatio !== null && costIntel.feedRatio > 45) decisions.push({ icon: Zap, priority: "high",
                actionAr: "التفاوض على أسعار العلف بشكل جماعي", actionSv: "Förhandla om foderpris kollektivt",
                reasonAr: `العلف يستهلك ${costIntel.feedRatio.toFixed(0)}% من المصاريف — يمكن توفير 10-15% بالشراء الجماعي`, reasonSv: `Foder konsumerar ${costIntel.feedRatio.toFixed(0)}% av kostnaderna — 10-15% kan sparas vid kollektivt inköp` });

              if (totalIncome > 0 && incomeByCat.length === 1) decisions.push({ icon: Target, priority: "medium",
                actionAr: "تنويع مصادر الدخل", actionSv: "Diversifiera inkomstkällorna",
                reasonAr: "مصدر دخل واحد يشكل مخاطرة عالية — أضف بيع بيض أو منتجات ثانوية", reasonSv: "En enda inkomstkälla utgör hög risk — lägg till äggförsäljning eller biprodukter" });

              if (prediction.trend === "down") decisions.push({ icon: TrendingDown, priority: "high",
                actionAr: "تطبيق خطة تعافٍ مالي فورية", actionSv: "Implementera omedelbar finansiell återhämtningsplan",
                reasonAr: "الاتجاه التنازلي يستمر — تدخل فوري ضروري لوقف التراجع", reasonSv: "Den nedåtgående trenden fortsätter — omedelbar intervention krävs" });

              if (health.score >= 75) decisions.push({ icon: Star, priority: "low",
                actionAr: "التخطيط للتوسعة وزيادة الطاقة الإنتاجية", actionSv: "Planera expansion och ökad produktionskapacitet",
                reasonAr: `الصحة المالية ${health.score}/100 تمنح قدرة للاستثمار في التوسع المدروس`, reasonSv: `Finansiell hälsa ${health.score}/100 ger kapacitet att investera i välplanerad expansion` });

              if (transactions.length > 20 && periodFiltered.length === 0) decisions.push({ icon: Eye, priority: "medium",
                actionAr: "مراجعة توزيع المعاملات عبر الفترات", actionSv: "Granska transaktionsfördelning över perioder",
                reasonAr: "توجد معاملات لكنها خارج الفترة المحددة — راجع اختيار الفترة", reasonSv: "Det finns transaktioner men utanför den valda perioden — granska periodvalet" });

              const colors = { high: "border-red-200 bg-red-50 dark:bg-red-950/20", medium: "border-amber-200 bg-amber-50 dark:bg-amber-950/20", low: "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20" };
              const textColors = { high: "text-red-700 dark:text-red-300", medium: "text-amber-700 dark:text-amber-300", low: "text-emerald-700 dark:text-emerald-300" };
              const nums = { high: "bg-red-500", medium: "bg-amber-500", low: "bg-emerald-500" };

              if (decisions.length === 0) return (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-4 flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  <p className="text-sm text-emerald-700">{ar ? "الوضع المالي مستقر — لا توصيات عاجلة حالياً" : "Det finansiella läget är stabilt — inga brådskande rekommendationer för tillfället"}</p>
                </div>
              );

              return (
                <div className="space-y-2.5">
                  {decisions.slice(0, 5).map((d, i) => {
                    const DIcon = d.icon;
                    return (
                      <div key={i} className={cn("rounded-xl border p-4 flex items-start gap-3", colors[d.priority])}>
                        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0 mt-0.5", nums[d.priority])}>{i+1}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <DIcon className={cn("w-4 h-4 shrink-0", textColors[d.priority])} />
                            <p className={cn("text-sm font-bold", textColors[d.priority])}>{ar ? d.actionAr : d.actionSv}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ar ? d.reasonAr : d.reasonSv}</p>
                        </div>
                        <Badge className={cn("text-[9px] shrink-0", d.priority === "high" ? "bg-red-100 text-red-700" : d.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
                          {ar ? { high:"عاجل", medium:"متوسط", low:"منخفض" }[d.priority] : { high:"Brådskande", medium:"Medel", low:"Låg" }[d.priority]}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* ── Section 5: Time Intelligence ─────────────────────────────── */}
          {monthlyData.length >= 2 && (
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-indigo-500" />
                {ar ? "ذكاء الوقت — أداء شهر بشهر" : "Tidsintelligens — Månadsvis prestanda"}
              </h3>
              <Card className="border-none shadow-sm">
                <CardContent className="p-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip lang={lang} />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="income" name={ar ? "دخل" : "Inkomst"} fill="#10b981" radius={[3,3,0,0]} opacity={0.85} />
                      <Bar dataKey="expense" name={ar ? "مصاريف" : "Kostnader"} fill="#ef4444" radius={[3,3,0,0]} opacity={0.85} />
                      <Line type="monotone" dataKey="profit" name={ar ? "ربح" : "Vinst"} stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: ADVANCED CHARTS
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "charts" && (
        <div className="space-y-4">
          {monthlyData.length < 1 ? (
            <Card className="border-dashed">
              <CardContent className="py-14 text-center">
                <BarChart2 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">{ar ? "لا توجد بيانات كافية للرسم البياني" : "Otillräckliga data för diagram"}</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Combined Chart */}
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-0">
                  <CardTitle className="text-sm">{ar ? "المقارنة الشهرية الشاملة" : "Fullständig månadsöversikt"}</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={monthlyData} margin={{ top: 4, right: 4, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip lang={lang} />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="income" name={ar ? "الدخل" : "Inkomst"} fill="#10b981" radius={[4,4,0,0]} />
                      <Bar dataKey="expense" name={ar ? "المصاريف" : "Kostnader"} fill="#ef4444" radius={[4,4,0,0]} />
                      <Line type="monotone" dataKey="profit" name={ar ? "الربح" : "Vinst"} stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: "#6366f1" }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Profit Area Chart */}
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-0">
                  <CardTitle className="text-sm">{ar ? "منحنى الربح والتوقع" : "Vinstkurva & prognos"}</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart
                      data={[
                        ...monthlyData,
                        ...(prediction.nextMonthProfit !== null ? [{ month: ar ? "توقع" : "Prognos", income: prediction.nextMonthIncome!, expense: prediction.nextMonthExpense!, profit: prediction.nextMonthProfit, isPrediction: true }] : [])
                      ]}
                      margin={{ top: 4, right: 4, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="profitGradChart" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip lang={lang} />} />
                      <Area type="monotone" dataKey="profit" name={ar ? "الربح" : "Vinst"}
                        stroke="#6366f1" fill="url(#profitGradChart)" strokeWidth={2.5} dot={{ r: 3, fill: "#6366f1" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Expense & Income Donuts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {expenseByCat.length > 0 && (
                  <Card className="border-none shadow-sm">
                    <CardHeader className="pb-0">
                      <CardTitle className="text-sm">{ar ? "توزيع المصاريف" : "Kostnadsfördelning"}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={expenseByCat} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                            dataKey="value" paddingAngle={3}
                            label={({ percent }: any) => `${(percent*100).toFixed(0)}%`}
                            labelLine={false} style={{ fontSize: 9 }}>
                            {expenseByCat.map((_,i) => <Cell key={i} fill={COLORS_EXPENSE[i%COLORS_EXPENSE.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: any) => fmtAmount(Number(v), lang as any)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                        {expenseByCat.slice(0,5).map((c,i) => (
                          <span key={c.cat} className="text-[9px] flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ background: COLORS_EXPENSE[i%COLORS_EXPENSE.length] }} />
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {incomeByCat.length > 0 && (
                  <Card className="border-none shadow-sm">
                    <CardHeader className="pb-0">
                      <CardTitle className="text-sm">{ar ? "توزيع الدخل" : "Inkomstfördelning"}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={incomeByCat} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                            dataKey="value" paddingAngle={3}
                            label={({ percent }: any) => `${(percent*100).toFixed(0)}%`}
                            labelLine={false} style={{ fontSize: 9 }}>
                            {incomeByCat.map((_,i) => <Cell key={i} fill={COLORS_INCOME[i%COLORS_INCOME.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: any) => fmtAmount(Number(v), lang as any)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                        {incomeByCat.map((c,i) => (
                          <span key={c.cat} className="text-[9px] flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ background: COLORS_INCOME[i%COLORS_INCOME.length] }} />
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: TRANSACTIONS
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "transactions" && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder={ar ? "ابحث في المعاملات..." : "Sök transaktioner..."} value={search}
                onChange={e => setSearch(e.target.value)} className="ps-8 h-9 text-xs" />
            </div>
            <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
              {(["all","income","expense"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={cn("px-3 py-1 rounded-lg text-xs font-semibold transition-all",
                    filter === f ? "bg-white dark:bg-slate-800 shadow-sm text-emerald-600" : "text-muted-foreground hover:text-foreground")}>
                  {ar ? { all:"الكل", income:"دخل", expense:"مصروف" }[f] : { all:"Alla", income:"Inkomst", expense:"Kostnad" }[f]}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : filteredTx.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <Receipt className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{search ? (ar ? "لا نتائج" : "Inga resultat") : t("finance.empty")}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-none shadow-sm">
              <div className="divide-y divide-border/40">
                {filteredTx.map(tr => (
                  <div key={tr.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg",
                      tr.type === "income" ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30")}>
                      {CAT_ICONS[tr.category] ?? (tr.type === "income" ? "📈" : "📉")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{tr.description}</p>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">
                          {t(CAT_KEYS[tr.category] ?? tr.category)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />{tr.date}
                        </span>
                        {tr.authorName && <span className="text-[10px] text-muted-foreground opacity-60">{tr.authorName}</span>}
                        {tr.quantity && tr.unit && (
                          <span className="text-[10px] text-muted-foreground">{tr.quantity} {tr.unit}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={cn("text-sm font-bold",
                        tr.type === "income" ? "text-emerald-600" : "text-red-600")}>
                        {tr.type === "income" ? "+" : "-"}{fmtAmount(Number(tr.amount), lang as any)}
                      </span>
                      {isAdmin && (
                        <button onClick={() => handleDelete(tr.id)} disabled={deletingId === tr.id}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500">
                          {deletingId === tr.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{filteredTx.length} {ar ? "معاملة" : "transaktioner"}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-emerald-600">+{fmtAmount(filteredTx.filter(t=>t.type==="income").reduce((s,t)=>s+Number(t.amount),0), lang as any)}</span>
                  <span className="text-xs font-semibold text-red-600">-{fmtAmount(filteredTx.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.amount),0), lang as any)}</span>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: REPORTS
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          {/* P&L Header */}
          <div className="rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950 p-5 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-slate-300" />
              <h2 className="text-sm font-black text-slate-100">{ar ? "بيان الأرباح والخسائر" : "Resultaträkning (P&L)"}</h2>
              <Badge className="bg-white/10 text-slate-200 text-[9px]">{ar ? "شامل" : "Fullständig"}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-[10px] text-slate-400">{ar ? "إجمالي الدخل" : "Totala intäkter"}</p>
                <p className="text-lg font-black text-emerald-400">{fmtAmount(totalIncome, lang as any)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-400">{ar ? "إجمالي المصاريف" : "Totala kostnader"}</p>
                <p className="text-lg font-black text-red-400">{fmtAmount(totalExpense, lang as any)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-400">{ar ? "صافي الربح" : "Nettovinst"}</p>
                <p className={cn("text-lg font-black", profit >= 0 ? "text-blue-300" : "text-orange-400")}>
                  {profit >= 0 ? "+" : ""}{fmtAmount(profit, lang as any)}
                </p>
              </div>
            </div>
          </div>

          {/* Smart Alerts Panel */}
          {(() => {
            const alerts: { type: "good"|"warning"|"danger"; msgAr: string; msgSv: string }[] = [];
            if (profit < 0) alerts.push({ type: "danger", msgAr: `⛔ خسارة صافية: ${fmtAmount(Math.abs(profit), "ar")} — تتطلب تدخلاً عاجلاً`, msgSv: `⛔ Nettoförlust: ${fmtAmount(Math.abs(profit), "sv")} — kräver omedelbar åtgärd` });
            else if (profit > 0) alerts.push({ type: "good", msgAr: `✅ ربح محقق: ${fmtAmount(profit, "ar")} (${marginPct}% هامش)`, msgSv: `✅ Vinst uppnådd: ${fmtAmount(profit, "sv")} (${marginPct}% marginal)` });
            if (totalExpense > totalIncome * 0.85 && profit >= 0) alerts.push({ type: "warning", msgAr: `⚠️ المصاريف تستهلك ${((totalExpense/totalIncome)*100).toFixed(0)}% من الدخل — مراجعة ضرورية`, msgSv: `⚠️ Kostnader konsumerar ${((totalExpense/totalIncome)*100).toFixed(0)}% av inkomst — granskning nödvändig` });
            if (expenseByCat.length > 0 && totalExpense > 0) {
              const topRatio = (expenseByCat[0].value/totalExpense)*100;
              if (topRatio > 55) alerts.push({ type: "warning", msgAr: `⚠️ ${expenseByCat[0].name} يستهلك ${topRatio.toFixed(0)}% من المصاريف`, msgSv: `⚠️ ${expenseByCat[0].name} konsumerar ${topRatio.toFixed(0)}% av kostnaderna` });
            }
            if (totalChickens > 0 && costIntel.costPerBird !== null) alerts.push({ type: "good", msgAr: `📊 تكلفة الطير الواحد: ${fmtAmount(costIntel.costPerBird, "ar")} | إيراد: ${fmtAmount(costIntel.revenuePerBird ?? 0, "ar")}`, msgSv: `📊 Kostnad per fågel: ${fmtAmount(costIntel.costPerBird, "sv")} | Intäkt: ${fmtAmount(costIntel.revenuePerBird ?? 0, "sv")}` });

            const cfg = { good: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 text-emerald-700 dark:text-emerald-300", warning: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 text-amber-700 dark:text-amber-300", danger: "bg-red-50 dark:bg-red-950/20 border-red-200 text-red-700 dark:text-red-300" };
            return alerts.length > 0 ? (
              <div className="space-y-2">
                {alerts.map((a, i) => (
                  <div key={i} className={cn("rounded-xl border px-4 py-2.5 text-xs font-medium", cfg[a.type])}>
                    {ar ? a.msgAr : a.msgSv}
                  </div>
                ))}
              </div>
            ) : null;
          })()}

          {/* Income Breakdown */}
          {incomeByCat.length > 0 && (
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowUpCircle className="w-4 h-4 text-emerald-500" />
                  {ar ? "مصادر الدخل التفصيلية" : "Detaljerade inkomstkällor"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 space-y-2.5">
                {incomeByCat.map((cat, i) => {
                  const pct = totalIncome > 0 ? (cat.value / totalIncome) * 100 : 0;
                  return (
                    <div key={cat.cat}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground font-medium">{cat.name}</span>
                        <span className="font-bold text-emerald-600">{fmtAmount(cat.value, lang as any)} <span className="text-muted-foreground font-normal">({pct.toFixed(0)}%)</span></span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: COLORS_INCOME[i%COLORS_INCOME.length] }} />
                      </div>
                    </div>
                  );
                })}
                <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2">
                  <span className="text-xs font-bold">{ar ? "إجمالي الدخل" : "Total inkomst"}</span>
                  <span className="text-sm font-black text-emerald-600">{fmtAmount(totalIncome, lang as any)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Expense Breakdown */}
          {expenseByCat.length > 0 && (
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4 text-red-500" />
                  {ar ? "بنود المصاريف التفصيلية" : "Detaljerade kostnadsposter"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 space-y-2.5">
                {expenseByCat.map((cat, i) => {
                  const pct = totalExpense > 0 ? (cat.value / totalExpense) * 100 : 0;
                  return (
                    <div key={cat.cat}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground font-medium">{cat.name}</span>
                        <span className="font-bold text-red-600">{fmtAmount(cat.value, lang as any)} <span className="text-muted-foreground font-normal">({pct.toFixed(0)}%)</span></span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: COLORS_EXPENSE[i%COLORS_EXPENSE.length] }} />
                      </div>
                    </div>
                  );
                })}
                <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2">
                  <span className="text-xs font-bold">{ar ? "إجمالي المصاريف" : "Totala kostnader"}</span>
                  <span className="text-sm font-black text-red-600">{fmtAmount(totalExpense, lang as any)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 4 KPI Tiles */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: ar ? "هامش الربح الصافي" : "Nettovinstmarginal", value: `${marginPct}%`, bg: "bg-blue-50 dark:bg-blue-950/20", color: "text-blue-700 dark:text-blue-300" },
              { label: ar ? "إجمالي المعاملات" : "Totalt transaktioner", value: String(periodFiltered.length), bg: "bg-purple-50 dark:bg-purple-950/20", color: "text-purple-700 dark:text-purple-300" },
              { label: ar ? "الإنفاق اليومي" : "Daglig utgift", value: fmtAmount(costIntel.dailyBurnRate, lang as any), bg: "bg-orange-50 dark:bg-orange-950/20", color: "text-orange-700 dark:text-orange-300" },
              { label: ar ? "العائد على الاستثمار" : "ROI", value: costIntel.roiPercent !== null ? `${costIntel.roiPercent >= 0 ? "+" : ""}${costIntel.roiPercent.toFixed(1)}%` : "—", bg: costIntel.roiPercent !== null && costIntel.roiPercent >= 0 ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-red-50 dark:bg-red-950/20", color: costIntel.roiPercent !== null && costIntel.roiPercent >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300" },
            ].map((m, i) => (
              <div key={i} className={cn("rounded-xl p-3.5", m.bg)}>
                <p className={cn("text-[10px] opacity-70", m.color)}>{m.label}</p>
                <p className={cn("text-lg font-black", m.color)}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
