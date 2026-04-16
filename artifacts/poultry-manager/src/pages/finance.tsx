/**
 * ══════════════════════════════════════════════════════════════════════════════
 *   نظام الإدارة المالية الاحترافي المتكامل — مدير مزرعة الدواجن
 *   Professional Poultry Farm Finance Management System
 *   Full Financial Intelligence · Cost Per Bird · ROI · Break-Even Analysis
 *   Bilingual AR/SV · Live 30s Polling · University-Grade Analytics
 * ══════════════════════════════════════════════════════════════════════════════
 */
import { useState, useMemo, useEffect, useRef } from "react";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ComposedChart,
  ReferenceLine, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Plus, Trash2, Loader2, Edit2,
  ArrowUpCircle, ArrowDownCircle, Search, Target, Activity,
  RefreshCw, Receipt, Calendar, Award, FileText, Info, Zap,
  Bird, Egg, Scale, BarChart3, CircleDollarSign, Layers,
  ChevronRight, AlertTriangle, CheckCircle, XCircle,
  Wheat, Syringe, Bolt, Droplets, Flame, Truck, Home, Package,
  ShieldPlus, Wrench, Factory, DollarSign, PieChart as PieIcon,
  TrendingUp as Trend, BarChart2, Wallet, Star, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── API Base ─────────────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include", ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Error");
  return r.status === 204 ? null : r.json();
}

// ─── Category Definitions ─────────────────────────────────────────────────────
const EXPENSE_CATS = [
  { id: "feed",               ar: "علف",                   sv: "Foder",              icon: "🌾", fixed: false, Icon: Wheat        },
  { id: "medicine",           ar: "أدوية وعلاج",            sv: "Medicin",            icon: "💊", fixed: false, Icon: Syringe      },
  { id: "vaccines",           ar: "لقاحات",                 sv: "Vacciner",           icon: "💉", fixed: false, Icon: ShieldPlus   },
  { id: "electricity",        ar: "كهرباء",                 sv: "El",                 icon: "⚡", fixed: true,  Icon: Bolt         },
  { id: "water",              ar: "ماء",                    sv: "Vatten",             icon: "💧", fixed: false, Icon: Droplets     },
  { id: "fuel",               ar: "وقود ومولد",              sv: "Bränsle",            icon: "⛽", fixed: false, Icon: Flame        },
  { id: "labor",              ar: "عمالة وأجور",             sv: "Arbetskraft",        icon: "👷", fixed: true,  Icon: Award        },
  { id: "equipment",          ar: "معدات وأجهزة",            sv: "Utrustning",         icon: "🔧", fixed: true,  Icon: Wrench       },
  { id: "maintenance",        ar: "صيانة",                  sv: "Underhåll",          icon: "🛠️", fixed: true,  Icon: Factory      },
  { id: "disinfection",       ar: "مطهرات ومعقمات",          sv: "Desinfektion",       icon: "🧴", fixed: false, Icon: Package      },
  { id: "transport",          ar: "نقل وشحن",                sv: "Transport",          icon: "🚛", fixed: false, Icon: Truck        },
  { id: "rent",               ar: "إيجار",                  sv: "Hyra",               icon: "🏠", fixed: true,  Icon: Home         },
  { id: "incubation_supplies",ar: "مستلزمات تفقيس",          sv: "Kläckningsförnöd",   icon: "🥚", fixed: false, Icon: Egg          },
  { id: "eggs_purchase",      ar: "شراء بيض تفقيس",          sv: "Inköp av ägg",       icon: "🐣", fixed: false, Icon: Egg          },
  { id: "other",              ar: "أخرى",                   sv: "Övrigt",             icon: "📦", fixed: false, Icon: Package      },
];
const INCOME_CATS = [
  { id: "chick_sale",   ar: "بيع كتاكيت",          sv: "Kycklingförsäljning", icon: "🐥", Icon: Bird   },
  { id: "egg_sale",     ar: "بيع بيض",              sv: "Äggförsäljning",      icon: "🥚", Icon: Egg    },
  { id: "chicken_sale", ar: "بيع دجاج (لحم)",       sv: "Slaktkycklingförsäljning", icon: "🍗", Icon: Bird },
  { id: "manure_sale",  ar: "بيع سماد",             sv: "Gödselförsäljning",   icon: "♻️", Icon: Layers },
  { id: "other",        ar: "دخل أخرى",             sv: "Övriga intäkter",     icon: "📈", Icon: TrendingUp },
];

const ALL_CATS = [...EXPENSE_CATS, ...INCOME_CATS];
const catMeta = (id: string) =>
  ALL_CATS.find(c => c.id === id) ?? { id, ar: id, sv: id, icon: "📦", fixed: false, Icon: Package };

const PIE_COLORS = ["#ef4444","#f97316","#f59e0b","#84cc16","#06b6d4","#8b5cf6",
                    "#ec4899","#14b8a6","#fb923c","#a78bfa","#34d399","#60a5fa",
                    "#f472b6","#38bdf8","#4ade80"];
const INCOME_COLORS = ["#10b981","#3b82f6","#6366f1","#f59e0b","#14b8a6"];

// ─── Types ────────────────────────────────────────────────────────────────────
type Period = "week" | "month" | "quarter" | "year" | "all";
type FinTab = "dashboard" | "add" | "analysis" | "transactions" | "statement";

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
function fmtPct(n: number | null, decimals = 1): string {
  if (n === null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}%`;
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

// ─── Financial Intelligence Engine ────────────────────────────────────────────
interface FinMetrics {
  totalIncome: number; totalExpense: number; netProfit: number;
  profitMargin: number | null; roi: number | null;
  grossProfit: number; operatingExpense: number;
  fixedCosts: number; variableCosts: number;
  costPerBird: number | null; revenuePerBird: number | null;
  profitPerBird: number | null; breakEvenPricePerBird: number | null;
  dailyBurnRate: number; dailyRevRate: number;
  feedRatio: number | null; laborRatio: number | null;
  oer: number | null; // Operating Expense Ratio
  expByCat: { id: string; value: number; pct: number }[];
  incByCat: { id: string; value: number; pct: number }[];
  healthScore: number; healthGrade: "excellent"|"good"|"fair"|"poor";
}

function computeMetrics(txs: Tx[], flocks: Flock[], period: Period): FinMetrics {
  const periodDays = getPeriodDays(period);
  const totalIncome = txs.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = txs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const netProfit = totalIncome - totalExpense;
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : null;
  const roi = totalExpense > 0 ? (netProfit / totalExpense) * 100 : null;

  // Group expenses by category
  const expMap: Record<string, number> = {};
  txs.filter(t => t.type === "expense").forEach(t => {
    expMap[t.category] = (expMap[t.category] || 0) + Number(t.amount);
  });
  const incMap: Record<string, number> = {};
  txs.filter(t => t.type === "income").forEach(t => {
    incMap[t.category] = (incMap[t.category] || 0) + Number(t.amount);
  });

  const expByCat = Object.entries(expMap)
    .sort((a, b) => b[1] - a[1])
    .map(([id, value]) => ({ id, value, pct: totalExpense > 0 ? (value / totalExpense) * 100 : 0 }));
  const incByCat = Object.entries(incMap)
    .sort((a, b) => b[1] - a[1])
    .map(([id, value]) => ({ id, value, pct: totalIncome > 0 ? (value / totalIncome) * 100 : 0 }));

  // Fixed vs variable split
  const fixedCatIds = EXPENSE_CATS.filter(c => c.fixed).map(c => c.id);
  const fixedCosts = expByCat.filter(e => fixedCatIds.includes(e.id)).reduce((s, e) => s + e.value, 0);
  const variableCosts = totalExpense - fixedCosts;

  // Per-bird metrics
  const totalBirds = flocks.reduce((s, f) => s + f.count, 0);
  const costPerBird = totalBirds > 0 ? totalExpense / totalBirds : null;
  const revenuePerBird = totalBirds > 0 ? totalIncome / totalBirds : null;
  const profitPerBird = totalBirds > 0 ? netProfit / totalBirds : null;
  const breakEvenPricePerBird = totalBirds > 0 ? totalExpense / totalBirds : null;

  // Ratios
  const feedCost = expMap["feed"] ?? 0;
  const laborCost = expMap["labor"] ?? 0;
  const feedRatio = totalExpense > 0 ? (feedCost / totalExpense) * 100 : null;
  const laborRatio = totalExpense > 0 ? (laborCost / totalExpense) * 100 : null;
  const oer = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : null;

  // Daily rates
  const dailyBurnRate = periodDays > 0 ? totalExpense / periodDays : 0;
  const dailyRevRate = periodDays > 0 ? totalIncome / periodDays : 0;

  // Gross profit (Revenue - Variable Costs)
  const grossProfit = totalIncome - variableCosts;
  const operatingExpense = fixedCosts;

  // Health score (0-100)
  let healthScore = 50;
  if (totalIncome > 0) {
    const m = profitMargin ?? 0;
    healthScore = Math.max(0, Math.min(100, 50 + m));
  }
  const healthGrade: FinMetrics["healthGrade"] =
    healthScore >= 70 ? "excellent" :
    healthScore >= 55 ? "good" :
    healthScore >= 40 ? "fair" : "poor";

  return {
    totalIncome, totalExpense, netProfit, profitMargin, roi,
    grossProfit, operatingExpense,
    fixedCosts, variableCosts,
    costPerBird, revenuePerBird, profitPerBird, breakEvenPricePerBird,
    dailyBurnRate, dailyRevRate,
    feedRatio, laborRatio, oer,
    expByCat, incByCat,
    healthScore, healthGrade,
  };
}

function computeMonthlyData(allTxs: Tx[]): {
  month: string; monthAr: string; income: number; expense: number; profit: number;
}[] {
  const map: Record<string, { income: number; expense: number }> = {};
  allTxs.forEach(t => {
    const m = t.date.slice(0, 7);
    if (!map[m]) map[m] = { income: 0, expense: 0 };
    if (t.type === "income") map[m].income += Number(t.amount);
    else map[m].expense += Number(t.amount);
  });
  const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو",
                     "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, d]) => {
      const [y, mo] = m.split("-");
      return {
        month: `${mo}/${y.slice(2)}`,
        monthAr: AR_MONTHS[parseInt(mo) - 1] ?? m,
        income: d.income, expense: d.expense, profit: d.income - d.expense,
      };
    });
}

// ─── Anomaly Engine (11 rules) ─────────────────────────────────────────────
interface Alert {
  id: string; severity: "critical"|"warning"|"info";
  ar: string; sv: string;
}
function detectAlerts(m: FinMetrics, txCount: number): Alert[] {
  const alerts: Alert[] = [];
  if (txCount === 0) return alerts;

  if (m.netProfit < 0 && m.totalIncome > 0)
    alerts.push({ id: "loss", severity: "critical",
      ar: `⛔ خسارة صافية: ${fmtAmount(Math.abs(m.netProfit))} — راجع التكاليف فوراً`,
      sv: `⛔ Nettoförlust: ${fmtAmount(Math.abs(m.netProfit), "sv")} — granska kostnader omedelbart` });

  if (m.profitMargin !== null && m.profitMargin >= 0 && m.profitMargin < 10)
    alerts.push({ id: "low_margin", severity: "critical",
      ar: `⚠️ هامش ربح ${m.profitMargin.toFixed(1)}% — خطر! المعيار الصناعي ≥ 20%`,
      sv: `⚠️ Vinstmarginal ${m.profitMargin.toFixed(1)}% — Fara! Industristandard ≥ 20%` });

  if (m.feedRatio !== null && m.feedRatio > 65)
    alerts.push({ id: "feed_heavy", severity: "warning",
      ar: `🌾 العلف يستهلك ${m.feedRatio.toFixed(0)}% من المصاريف — المعيار 55-65%`,
      sv: `🌾 Foder förbrukar ${m.feedRatio.toFixed(0)}% av kostnader — Standard 55-65%` });

  if (m.oer !== null && m.oer > 90 && m.netProfit >= 0)
    alerts.push({ id: "oer_high", severity: "warning",
      ar: `📊 نسبة المصاريف التشغيلية ${m.oer.toFixed(0)}% — ضغط على الأرباح`,
      sv: `📊 Driftkostnadskvot ${m.oer.toFixed(0)}% — Tryck på vinst` });

  if (m.laborRatio !== null && m.laborRatio > 30)
    alerts.push({ id: "labor_high", severity: "warning",
      ar: `👷 تكلفة العمالة ${m.laborRatio.toFixed(0)}% — أعلى من المعيار 20-25%`,
      sv: `👷 Arbetskostnad ${m.laborRatio.toFixed(0)}% — Över standarden 20-25%` });

  if (m.totalIncome === 0 && txCount > 3)
    alerts.push({ id: "no_income", severity: "warning",
      ar: "لا دخل مسجل في هذه الفترة — أضف مبيعاتك لتحليل الربحية",
      sv: "Ingen inkomst registrerad — Lägg till försäljning för lönsamhetsanalys" });

  if (m.variableCosts > m.totalIncome * 0.95 && m.totalIncome > 0)
    alerts.push({ id: "var_high", severity: "warning",
      ar: "التكاليف المتغيرة تتجاوز 95% من الدخل — إعادة هيكلة التكاليف ضرورية",
      sv: "Rörliga kostnader överstiger 95% av inkomst — Omstrukturering nödvändig" });

  if (m.profitMargin !== null && m.profitMargin >= 25)
    alerts.push({ id: "excellent", severity: "info",
      ar: `✅ أداء ممتاز! هامش ربح ${m.profitMargin.toFixed(1)}% يتجاوز المعيار الصناعي`,
      sv: `✅ Utmärkt prestanda! Vinstmarginal ${m.profitMargin.toFixed(1)}% överstiger branschstandarden` });

  if (m.costPerBird !== null && m.costPerBird > 0)
    alerts.push({ id: "cpb", severity: "info",
      ar: `🐔 تكلفة الطير الواحد: ${fmtAmount(m.costPerBird)} | سعر التعادل: ${fmtAmount(m.breakEvenPricePerBird ?? 0)}`,
      sv: `🐔 Kostnad per fågel: ${fmtAmount(m.costPerBird, "sv")} | Break-even: ${fmtAmount(m.breakEvenPricePerBird ?? 0, "sv")}` });

  return alerts;
}

// ─── Linear Regression Prediction ─────────────────────────────────────────────
function linReg(vals: number[]): number {
  const n = vals.length;
  if (n < 2) return vals[0] ?? 0;
  const xm = (n - 1) / 2;
  const ym = vals.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  vals.forEach((v, i) => { num += (i - xm) * (v - ym); den += (i - xm) ** 2; });
  const slope = den !== 0 ? num / den : 0;
  return Math.max(0, Math.round(ym - slope * xm + slope * n));
}

// ══════════════════════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

// ─── Live Pulse Badge ──────────────────────────────────────────────────────────
function LiveBadge({ fetching }: { fetching: boolean }) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSec(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [fetching]);
  useEffect(() => { setSec(0); }, [fetching]);
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
      {fetching
        ? <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
        : <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
      <span className="hidden sm:inline">Live · {sec < 60 ? `${sec}s` : `${Math.floor(sec/60)}m`}</span>
    </div>
  );
}

// ─── KPI Tile ─────────────────────────────────────────────────────────────────
function KpiTile({
  label, value, sub, icon: Icon, color, trend, badge, onClick,
}: {
  label: string; value: string; sub?: string; icon: any;
  color: string; trend?: "up"|"down"|null; badge?: string; onClick?: () => void;
}) {
  const trendIcon = trend === "up"
    ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
    : trend === "down"
    ? <TrendingDown className="w-3.5 h-3.5 text-red-500" />
    : null;
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-2xl border border-border/40 bg-card shadow-sm",
        "hover:shadow-md hover:border-border/60 transition-all duration-200 overflow-hidden",
        onClick && "cursor-pointer active:scale-[0.98]"
      )}
    >
      <div className={cn("h-0.5 w-full", color)} />
      <div className="p-3.5 flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", color, "bg-opacity-15")}>
          <Icon className={cn("w-5 h-5", color.replace("bg-", "text-").replace("gradient-to-r from-", "text-").split(" ")[0])} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground leading-none mb-1">{label}</p>
          <p className="text-sm font-bold truncate leading-snug">{value}</p>
          {sub && <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {trendIcon}
          {badge && <Badge className="text-[9px] h-4 px-1.5 bg-muted text-muted-foreground">{badge}</Badge>}
        </div>
      </div>
    </button>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────
function SH({ icon: Icon, title, sub, color = "text-foreground" }: {
  icon: any; title: string; sub?: string; color?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={cn("w-4.5 h-4.5", color)} />
      <div>
        <p className="text-sm font-bold leading-none">{title}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────
function AlertBanner({ alerts, ar }: { alerts: Alert[]; ar: boolean }) {
  const [dismissed, setDismissed] = useState(new Set<string>());
  const visible = alerts.filter(a => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  const cfg = {
    critical: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300",
    warning:  "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300",
    info:     "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/40 text-blue-700 dark:text-blue-300",
  };

  return (
    <div className="space-y-2">
      {visible.slice(0, 4).map(a => (
        <div key={a.id} className={cn("rounded-xl border px-3.5 py-2.5 flex items-start gap-2.5", cfg[a.severity])}>
          {a.severity === "critical" ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
           : a.severity === "info" ? <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
           : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
          <p className="text-[11px] font-medium flex-1 leading-relaxed">{ar ? a.ar : a.sv}</p>
          <button onClick={() => setDismissed(s => new Set([...s, a.id]))} className="text-xs opacity-60 hover:opacity-100 shrink-0">×</button>
        </div>
      ))}
      {visible.length > 4 && (
        <p className="text-[10px] text-muted-foreground text-center">{visible.length - 4} {ar ? "تنبيه إضافي" : "fler varningar"}</p>
      )}
    </div>
  );
}

// ─── Health Gauge SVG ──────────────────────────────────────────────────────────
function HealthGauge({ score, grade }: { score: number; grade: string }) {
  const R = 52; const cx = 65; const cy = 65;
  const circ = Math.PI * R;
  const dash = (Math.min(score, 100) / 100) * circ;
  const COLORS = {
    excellent: { stroke: "#10b981", text: "#059669", label: { ar: "صحة ممتازة", sv: "Utmärkt" } },
    good:      { stroke: "#3b82f6", text: "#2563eb", label: { ar: "صحة جيدة",   sv: "Bra"      } },
    fair:      { stroke: "#f59e0b", text: "#d97706", label: { ar: "مقبول",       sv: "Godkänt"  } },
    poor:      { stroke: "#ef4444", text: "#dc2626", label: { ar: "ضعيف",        sv: "Svagt"    } },
  };
  const gc = COLORS[grade as keyof typeof COLORS] ?? COLORS.poor;
  return (
    <div className="flex flex-col items-center">
      <svg width="130" height="82" viewBox="0 0 130 82">
        <path d={`M ${cx-R} ${cy} A ${R} ${R} 0 0 1 ${cx+R} ${cy}`}
          fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
        <path d={`M ${cx-R} ${cy} A ${R} ${R} 0 0 1 ${cx+R} ${cy}`}
          fill="none" stroke={gc.stroke} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }} />
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="22" fontWeight="900" fill={gc.text}>{score}</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="9" fill="#94a3b8">/100</text>
      </svg>
    </div>
  );
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, ar }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/95 border border-border/60 rounded-xl p-2.5 shadow-lg text-[11px] backdrop-blur">
      <p className="font-bold mb-1.5 text-muted-foreground">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold">{fmtAmount(p.value, ar ? "ar" : "sv")}</span>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  ADD TRANSACTION FORM
// ══════════════════════════════════════════════════════════════════════════════
function AddTransactionForm({ ar, onSuccess }: { ar: boolean; onSuccess: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    type: "expense" as "income"|"expense",
    date: new Date().toISOString().split("T")[0],
    category: "",
    description: "",
    amount: "",
    qty: "",
    unitPrice: "",
    unit: "",
    notes: "",
    useCalc: false,
  });
  const [saving, setSaving] = useState(false);
  const cats = form.type === "expense" ? EXPENSE_CATS : INCOME_CATS;

  const calcAmount = useMemo(() => {
    if (form.useCalc && form.qty && form.unitPrice) {
      return (Number(form.qty) * Number(form.unitPrice)).toFixed(0);
    }
    return form.amount;
  }, [form.useCalc, form.qty, form.unitPrice, form.amount]);

  const set = (k: string, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    const finalAmount = form.useCalc ? calcAmount : form.amount;
    if (!form.date || !form.category || !form.description || !finalAmount) {
      toast({ variant: "destructive", title: ar ? "أكمل الحقول المطلوبة" : "Fyll i alla obligatoriska fält" });
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/transactions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date, type: form.type, category: form.category,
          description: form.description, amount: Number(finalAmount),
          quantity: form.qty ? Number(form.qty) : null,
          unit: form.unit || null, notes: form.notes || null,
        }),
      });
      toast({ title: ar ? "✅ تمت إضافة المعاملة" : "✅ Transaktion tillagd" });
      setForm(f => ({ ...f, category: "", description: "", amount: "", qty: "", unitPrice: "", unit: "", notes: "" }));
      onSuccess();
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message });
    } finally { setSaving(false); }
  };

  const selectedCat = cats.find(c => c.id === form.category);
  const finalAmount = form.useCalc ? calcAmount : form.amount;

  return (
    <div className="space-y-5">
      {/* Type Toggle */}
      <div className="flex rounded-xl overflow-hidden border border-border/60 p-0.5 bg-muted/30">
        {(["expense", "income"] as const).map(t => (
          <button
            key={t}
            onClick={() => set("type", t)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all",
              form.type === t
                ? t === "expense"
                  ? "bg-red-500 text-white shadow-sm"
                  : "bg-emerald-500 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "expense"
              ? <><ArrowDownCircle className="w-4 h-4" />{ar ? "مصروف" : "Kostnad"}</>
              : <><ArrowUpCircle className="w-4 h-4" />{ar ? "دخل" : "Inkomst"}</>}
          </button>
        ))}
      </div>

      {/* Date */}
      <div>
        <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />{ar ? "التاريخ" : "Datum"} *
        </Label>
        <Input type="date" value={form.date} onChange={e => set("date", e.target.value)}
          className="h-10" />
      </div>

      {/* Category */}
      <div>
        <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5 text-muted-foreground">
          <Layers className="w-3.5 h-3.5" />{ar ? "الفئة" : "Kategori"} *
        </Label>
        <div className="grid grid-cols-3 gap-1.5">
          {cats.map(c => (
            <button
              key={c.id}
              onClick={() => set("category", c.id)}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all",
                form.category === c.id
                  ? form.type === "expense"
                    ? "border-red-400 bg-red-50 dark:bg-red-950/20"
                    : "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20"
                  : "border-border/40 hover:border-border hover:bg-muted/40"
              )}
            >
              <span className="text-base leading-none">{c.icon}</span>
              <span className="text-[9px] font-medium leading-tight">{ar ? c.ar : c.sv}</span>
            </button>
          ))}
        </div>
        {selectedCat && (
          <div className={cn("mt-1.5 text-[10px] px-2 py-1 rounded-lg inline-flex items-center gap-1",
            form.type === "expense" ? "bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400"
              : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400")}>
            {selectedCat.icon} {ar ? selectedCat.ar : selectedCat.sv}
            {form.type === "expense" && "fixed" in selectedCat && (
              <Badge className="ms-1 text-[8px] h-3 px-1" variant="outline">
                {(selectedCat as any).fixed ? (ar ? "ثابت" : "Fast") : (ar ? "متغير" : "Rörlig")}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5 text-muted-foreground">
          <FileText className="w-3.5 h-3.5" />{ar ? "الوصف" : "Beskrivning"} *
        </Label>
        <Input value={form.description} onChange={e => set("description", e.target.value)}
          placeholder={ar ? "مثال: علف دجاج بياض — 50 كيس" : "T.ex. Hönsmat — 50 säckar"}
          className="h-10" />
      </div>

      {/* Amount Mode Toggle */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
            <CircleDollarSign className="w-3.5 h-3.5" />{ar ? "المبلغ" : "Belopp"} *
          </Label>
          <button
            onClick={() => set("useCalc", !form.useCalc)}
            className={cn(
              "text-[10px] px-2.5 py-1 rounded-lg border transition-all font-medium",
              form.useCalc
                ? "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/20 dark:border-blue-800 dark:text-blue-400"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            )}
          >
            {ar ? (form.useCalc ? "كمية × سعر ✓" : "كمية × سعر") : (form.useCalc ? "Antal × Pris ✓" : "Antal × Pris")}
          </button>
        </div>

        {form.useCalc ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">{ar ? "الكمية" : "Antal"}</Label>
                <Input type="number" value={form.qty} onChange={e => set("qty", e.target.value)}
                  placeholder="0" className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">{ar ? "الوحدة" : "Enhet"}</Label>
                <Input value={form.unit} onChange={e => set("unit", e.target.value)}
                  placeholder={ar ? "كيس/طن" : "säck"} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">{ar ? "سعر الوحدة د.ع" : "Styckkostnad"}</Label>
                <Input type="number" value={form.unitPrice} onChange={e => set("unitPrice", e.target.value)}
                  placeholder="0" className="h-9 text-sm" />
              </div>
            </div>
            <div className={cn("rounded-xl p-3 flex items-center justify-between",
              form.type === "expense" ? "bg-red-50 dark:bg-red-950/20" : "bg-emerald-50 dark:bg-emerald-950/20")}>
              <span className="text-xs text-muted-foreground">{ar ? "الإجمالي المحسوب:" : "Beräknat totalt:"}</span>
              <span className={cn("text-sm font-black",
                form.type === "expense" ? "text-red-600" : "text-emerald-600")}>
                {calcAmount ? fmtAmount(Number(calcAmount)) : "—"}
              </span>
            </div>
          </div>
        ) : (
          <Input type="number" value={form.amount} onChange={e => set("amount", e.target.value)}
            placeholder={ar ? "المبلغ بالدينار العراقي" : "Belopp i IQD"} className="h-10" />
        )}
      </div>

      {/* Notes */}
      <div>
        <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5 text-muted-foreground">
          <Info className="w-3.5 h-3.5" />{ar ? "ملاحظات" : "Anteckningar"} ({ar ? "اختياري" : "valfritt"})
        </Label>
        <Textarea value={form.notes} onChange={e => set("notes", e.target.value)}
          placeholder={ar ? "أي تفاصيل إضافية..." : "Ytterligare detaljer..."}
          className="h-20 text-sm resize-none" />
      </div>

      {/* Preview Card */}
      {form.category && form.description && finalAmount && Number(finalAmount) > 0 && (
        <div className={cn("rounded-xl border-2 p-3.5",
          form.type === "expense" ? "border-red-200 bg-red-50/50 dark:border-red-800/40 dark:bg-red-950/10"
            : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/10")}>
          <p className="text-[10px] text-muted-foreground mb-1">{ar ? "معاينة المعاملة" : "Transaktionsförhandsgranskning"}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{selectedCat?.icon ?? "📦"}</span>
              <div>
                <p className="text-xs font-bold">{form.description}</p>
                <p className="text-[10px] text-muted-foreground">{form.date} · {ar ? selectedCat?.ar : selectedCat?.sv}</p>
              </div>
            </div>
            <span className={cn("text-base font-black",
              form.type === "expense" ? "text-red-600" : "text-emerald-600")}>
              {form.type === "expense" ? "-" : "+"}{fmtAmount(Number(finalAmount))}
            </span>
          </div>
        </div>
      )}

      {/* Submit */}
      <Button
        onClick={handleSave}
        disabled={saving || !form.category || !form.description || !(Number(finalAmount) > 0)}
        className={cn("w-full h-12 text-sm font-bold shadow-md",
          form.type === "expense"
            ? "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white border-none shadow-red-500/20"
            : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-none shadow-emerald-500/20"
        )}
      >
        {saving
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <><Plus className="w-4 h-4 me-2" />{ar ? "حفظ المعاملة" : "Spara transaktion"}</>}
      </Button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN FINANCE PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function Finance() {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const ar = lang === "ar";
  const isAdmin = user?.role === "admin";
  const qc = useQueryClient();

  const [period, setPeriod] = useState<Period>("month");
  const [tab, setTab] = useState<FinTab>("dashboard");
  const [search, setSearch] = useState("");
  const [txFilter, setTxFilter] = useState<"all"|"income"|"expense">("all");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editTx, setEditTx] = useState<Tx | null>(null);

  // ─── Data Fetching ─────────────────────────────────────────────────────────
  const OPTS = { refetchInterval: 30_000, staleTime: 20_000 };
  const { data: allTxs = [], isFetching: txFetching } = useQuery<Tx[]>({
    queryKey: ["transactions"],
    queryFn: () => apiFetch("/api/transactions"),
    ...OPTS,
  });
  const { data: flocks = [] } = useQuery<Flock[]>({
    queryKey: ["flocks"],
    queryFn: () => apiFetch("/api/flocks"),
    ...OPTS,
  });

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["flocks"] });
  };

  // ─── Period filtering ──────────────────────────────────────────────────────
  const periodTxs = useMemo(() => {
    const range = getPeriodRange(period);
    if (!range) return allTxs;
    return allTxs.filter(t => t.date >= range.start && t.date <= range.end);
  }, [allTxs, period]);

  // ─── Core metrics ──────────────────────────────────────────────────────────
  const m = useMemo(() => computeMetrics(periodTxs, flocks, period), [periodTxs, flocks, period]);
  const monthly = useMemo(() => computeMonthlyData(allTxs), [allTxs]);
  const alerts = useMemo(() => detectAlerts(m, periodTxs.length), [m, periodTxs.length]);

  // Prediction
  const pred = useMemo(() => {
    if (monthly.length < 2) return null;
    const r = monthly.slice(-Math.min(6, monthly.length));
    return {
      income:  linReg(r.map(x => x.income)),
      expense: linReg(r.map(x => x.expense)),
      profit:  linReg(r.map(x => x.profit)),
    };
  }, [monthly]);

  // ─── Filtered transactions ─────────────────────────────────────────────────
  const filteredTxs = useMemo(() => {
    let txs = periodTxs;
    if (txFilter !== "all") txs = txs.filter(t => t.type === txFilter);
    if (search) {
      const q = search.toLowerCase();
      txs = txs.filter(t =>
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.amount.includes(q)
      );
    }
    return txs;
  }, [periodTxs, txFilter, search]);

  // ─── Delete ────────────────────────────────────────────────────────────────
  const { toast } = useToast();
  const handleDelete = async (id: number) => {
    if (!confirm(ar ? "هل تريد حذف هذه المعاملة؟" : "Vill du ta bort denna transaktion?")) return;
    setDeletingId(id);
    try {
      await apiFetch(`/api/transactions/${id}`, { method: "DELETE" });
      toast({ title: ar ? "تم الحذف" : "Borttagen" });
      refetch();
    } catch (e: any) { toast({ variant: "destructive", title: e.message }); }
    finally { setDeletingId(null); }
  };

  // ─── Period labels ─────────────────────────────────────────────────────────
  const PERIODS: { id: Period; ar: string; sv: string }[] = [
    { id: "week",    ar: "أسبوع",  sv: "Vecka"   },
    { id: "month",   ar: "شهر",    sv: "Månad"   },
    { id: "quarter", ar: "ربع سنة", sv: "Kvartal" },
    { id: "year",    ar: "سنة",    sv: "År"      },
    { id: "all",     ar: "الكل",   sv: "Allt"    },
  ];
  const TABS: { id: FinTab; ar: string; sv: string; icon: any }[] = [
    { id: "dashboard",    ar: "القيادة",    sv: "Dashboard",   icon: BarChart2       },
    { id: "add",          ar: "إضافة",      sv: "Lägg till",   icon: Plus            },
    { id: "analysis",     ar: "التحليل",    sv: "Analys",      icon: Zap             },
    { id: "transactions", ar: "المعاملات",  sv: "Transakter",  icon: Receipt         },
    { id: "statement",    ar: "التقارير",   sv: "Rapporter",   icon: FileText        },
  ];

  // ─── Grade colors ──────────────────────────────────────────────────────────
  const gradeColor = {
    excellent: "text-emerald-600", good: "text-blue-600",
    fair: "text-amber-600", poor: "text-red-600",
  }[m.healthGrade];

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-background pb-24" dir={ar ? "rtl" : "ltr"}>

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/40">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-base font-black leading-none flex items-center gap-2">
                <CircleDollarSign className="w-4.5 h-4.5 text-emerald-500" />
                {ar ? "الإدارة المالية" : "Ekonomihantering"}
              </h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {ar ? "تتبع شامل · تحليل متقدم · تكلفة الطير" : "Fullständig spårning · Avancerad analys · Kostnad per fågel"}
              </p>
            </div>
            <LiveBadge fetching={txFetching} />
          </div>

          {/* Period Selector */}
          <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-hide">
            {PERIODS.map(p => (
              <button key={p.id} onClick={() => setPeriod(p.id)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  period === p.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}>
                {ar ? p.ar : p.sv}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Bar */}
        <div className="border-t border-border/40">
          <div className="max-w-2xl mx-auto flex overflow-x-auto scrollbar-hide">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={cn(
                    "flex-1 shrink-0 flex flex-col items-center gap-0.5 py-2.5 px-2 text-[10px] font-semibold transition-all",
                    tab === t.id
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                  )}>
                  <Icon className="w-3.5 h-3.5" />
                  {ar ? t.ar : t.sv}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">

        {/* ── KPI Strip (always visible) ──────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <KpiTile
            label={ar ? "إجمالي الدخل" : "Total intäkt"}
            value={fmtAmount(m.totalIncome, lang as any)}
            sub={ar ? `${m.incByCat.length} مصدر` : `${m.incByCat.length} källor`}
            icon={ArrowUpCircle} color="bg-emerald-500"
            trend={m.totalIncome > 0 ? "up" : null}
          />
          <KpiTile
            label={ar ? "إجمالي المصاريف" : "Totala kostnader"}
            value={fmtAmount(m.totalExpense, lang as any)}
            sub={ar ? `${m.expByCat.length} بند` : `${m.expByCat.length} poster`}
            icon={ArrowDownCircle} color="bg-red-500"
            trend={m.totalExpense > m.totalIncome ? "down" : null}
          />
          <KpiTile
            label={ar ? "صافي الربح" : "Nettovinst"}
            value={(m.netProfit >= 0 ? "+" : "") + fmtAmount(Math.abs(m.netProfit), lang as any)}
            sub={m.profitMargin !== null ? `${m.profitMargin.toFixed(1)}% ${ar ? "هامش" : "marginal"}` : undefined}
            icon={m.netProfit >= 0 ? TrendingUp : TrendingDown}
            color={m.netProfit >= 0 ? "bg-blue-500" : "bg-orange-500"}
            trend={m.netProfit >= 0 ? "up" : "down"}
          />
          <KpiTile
            label={ar ? "العائد على الاستثمار" : "ROI"}
            value={m.roi !== null ? fmtPct(m.roi) : "—"}
            sub={m.costPerBird !== null ? `${fmtAmount(m.costPerBird, lang as any)}/${ar ? "طير" : "fågel"}` : undefined}
            icon={Target} color="bg-purple-500"
            trend={m.roi !== null && m.roi > 0 ? "up" : m.roi !== null ? "down" : null}
          />
        </div>

        {/* ── Alerts ──────────────────────────────────────────────────────── */}
        <AlertBanner alerts={alerts.filter(a => a.severity !== "info")} ar={ar} />

        {/* ════════════════════════════════════════════════════════════════
            TAB: DASHBOARD
           ════════════════════════════════════════════════════════════════ */}
        {tab === "dashboard" && (
          <div className="space-y-5">

            {/* Monthly Income vs Expense Chart */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  {ar ? "الدخل والمصاريف الشهرية" : "Månatliga intäkter och kostnader"}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                {monthly.length < 1 ? (
                  <div className="h-40 flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">{ar ? "لا توجد بيانات كافية" : "Otillräckliga data"}</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={monthly} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey={ar ? "monthAr" : "month"} tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip ar={ar} />} />
                      <Bar dataKey="income"  name={ar ? "دخل" : "Inkomst"}   fill="#10b981" radius={[3,3,0,0]} opacity={0.85} />
                      <Bar dataKey="expense" name={ar ? "مصاريف" : "Kostnader"} fill="#ef4444" radius={[3,3,0,0]} opacity={0.85} />
                      <Line dataKey="profit" name={ar ? "ربح" : "Vinst"} stroke="#3b82f6" strokeWidth={2}
                        dot={{ r: 3, fill: "#3b82f6" }} type="monotone" />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Donut Charts Row */}
            {(m.expByCat.length > 0 || m.incByCat.length > 0) && (
              <div className="grid grid-cols-2 gap-3">
                {/* Expense Donut */}
                {m.expByCat.length > 0 && (
                  <Card className="border-none shadow-sm">
                    <CardHeader className="pb-1 pt-3 px-3">
                      <CardTitle className="text-[11px] flex items-center gap-1.5 text-red-600">
                        <ArrowDownCircle className="w-3.5 h-3.5" />{ar ? "توزيع المصاريف" : "Kostnadsfördelning"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-2 pb-3">
                      <ResponsiveContainer width="100%" height={130}>
                        <PieChart>
                          <Pie data={m.expByCat.map(e => ({ ...e, name: ar ? catMeta(e.id).ar : catMeta(e.id).sv }))}
                            cx="50%" cy="50%" innerRadius={30} outerRadius={52}
                            dataKey="value" paddingAngle={2}>
                            {m.expByCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: any) => fmtAmount(v, lang as any)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1 mt-1">
                        {m.expByCat.slice(0, 4).map((e, i) => (
                          <div key={e.id} className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="text-[9px] text-muted-foreground truncate flex-1">{ar ? catMeta(e.id).ar : catMeta(e.id).sv}</span>
                            <span className="text-[9px] font-bold">{e.pct.toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Income Donut */}
                {m.incByCat.length > 0 && (
                  <Card className="border-none shadow-sm">
                    <CardHeader className="pb-1 pt-3 px-3">
                      <CardTitle className="text-[11px] flex items-center gap-1.5 text-emerald-600">
                        <ArrowUpCircle className="w-3.5 h-3.5" />{ar ? "مصادر الدخل" : "Inkomstkällor"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-2 pb-3">
                      <ResponsiveContainer width="100%" height={130}>
                        <PieChart>
                          <Pie data={m.incByCat.map(e => ({ ...e, name: ar ? catMeta(e.id).ar : catMeta(e.id).sv }))}
                            cx="50%" cy="50%" innerRadius={30} outerRadius={52}
                            dataKey="value" paddingAngle={2}>
                            {m.incByCat.map((_, i) => <Cell key={i} fill={INCOME_COLORS[i % INCOME_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: any) => fmtAmount(v, lang as any)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1 mt-1">
                        {m.incByCat.slice(0, 4).map((e, i) => (
                          <div key={e.id} className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: INCOME_COLORS[i % INCOME_COLORS.length] }} />
                            <span className="text-[9px] text-muted-foreground truncate flex-1">{ar ? catMeta(e.id).ar : catMeta(e.id).sv}</span>
                            <span className="text-[9px] font-bold">{e.pct.toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Prediction Card */}
            {pred && monthly.length >= 3 && (
              <Card className="border-none shadow-sm bg-gradient-to-r from-slate-800 to-slate-900 text-white">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-[11px] text-slate-300 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-yellow-400" />
                    {ar ? "توقعات الشهر القادم (نموذج الانحدار الخطي)" : "Nästa månads prognos (linjär regression)"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: ar ? "دخل متوقع" : "Förväntat intäkt",   value: pred.income,  color: "text-emerald-400" },
                      { label: ar ? "مصاريف متوقعة" : "Förv. kostnader", value: pred.expense, color: "text-red-400"     },
                      { label: ar ? "ربح متوقع" : "Förväntat vinst",    value: pred.profit,  color: pred.profit >= 0 ? "text-blue-400" : "text-orange-400" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="text-center">
                        <p className="text-[9px] text-slate-400 mb-0.5">{label}</p>
                        <p className={cn("text-xs font-black", color)}>{fmtAmount(value, lang as any)}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-500 mt-2 text-center">
                    {ar ? `استناداً إلى ${monthly.length} شهر من البيانات` : `Baserat på ${monthly.length} månaders data`}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Daily Rates */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-border/40 p-3.5">
                <p className="text-[10px] text-muted-foreground">{ar ? "معدل الإنفاق اليومي" : "Daglig utgiftstakt"}</p>
                <p className="text-sm font-black text-red-600 mt-1">{fmtAmount(m.dailyBurnRate, lang as any)}</p>
                <p className="text-[9px] text-muted-foreground">{ar ? "/ يوم" : "/ dag"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-border/40 p-3.5">
                <p className="text-[10px] text-muted-foreground">{ar ? "معدل الإيراد اليومي" : "Daglig intäktstakt"}</p>
                <p className="text-sm font-black text-emerald-600 mt-1">{fmtAmount(m.dailyRevRate, lang as any)}</p>
                <p className="text-[9px] text-muted-foreground">{ar ? "/ يوم" : "/ dag"}</p>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB: ADD TRANSACTION
           ════════════════════════════════════════════════════════════════ */}
        {tab === "add" && (
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-500" />
                {ar ? "تسجيل معاملة جديدة" : "Registrera ny transaktion"}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-5">
              <AddTransactionForm ar={ar} onSuccess={refetch} />
            </CardContent>
          </Card>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB: FINANCIAL ANALYSIS
           ════════════════════════════════════════════════════════════════ */}
        {tab === "analysis" && (
          <div className="space-y-5">

            {/* Financial Health Score */}
            <Card className="border-none shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-500" />
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex items-center gap-4">
                  <HealthGauge score={m.healthScore} grade={m.healthGrade} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{ar ? "درجة الصحة المالية" : "Finansiellt hälsopoäng"}</p>
                    <p className={cn("text-lg font-black", gradeColor)}>
                      {{ excellent: ar ? "ممتاز 🌟" : "Utmärkt 🌟",
                         good:      ar ? "جيد ✅"  : "Bra ✅",
                         fair:      ar ? "مقبول ⚠️" : "Acceptabelt ⚠️",
                         poor:      ar ? "ضعيف ❌"  : "Svag ❌" }[m.healthGrade]}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {m.profitMargin !== null
                        ? `${ar ? "هامش" : "Marginal"}: ${m.profitMargin.toFixed(1)}% · OER: ${m.oer?.toFixed(0) ?? "—"}%`
                        : ar ? "أضف بيانات للتقييم" : "Lägg till data för utvärdering"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Per-Bird Economics */}
            {flocks.length > 0 && (
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bird className="w-4 h-4 text-amber-500" />
                    {ar ? "اقتصاديات الطير الواحد" : "Per-fågelekonomik"}
                    <Badge variant="outline" className="text-[9px] ms-auto">
                      {flocks.reduce((s, f) => s + f.count, 0).toLocaleString()} {ar ? "طير" : "fåglar"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[
                      { label: ar ? "التكلفة / طير"   : "Kostnad / fågel",   value: m.costPerBird,            color: "text-red-600",     bg: "bg-red-50 dark:bg-red-950/20"     },
                      { label: ar ? "الإيراد / طير"   : "Intäkt / fågel",    value: m.revenuePerBird,         color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
                      { label: ar ? "الربح / طير"     : "Vinst / fågel",     value: m.profitPerBird,          color: m.profitPerBird !== null && m.profitPerBird >= 0 ? "text-blue-600" : "text-orange-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
                      { label: ar ? "سعر التعادل/طير" : "Break-even / fågel",value: m.breakEvenPricePerBird,  color: "text-purple-600",  bg: "bg-purple-50 dark:bg-purple-950/20" },
                    ].map(({ label, value, color, bg }) => (
                      <div key={label} className={cn("rounded-xl p-3", bg)}>
                        <p className="text-[9px] text-muted-foreground">{label}</p>
                        <p className={cn("text-sm font-black mt-0.5", color)}>
                          {value !== null ? fmtAmount(value, lang as any) : "—"}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Flock breakdown */}
                  {flocks.length > 0 && m.costPerBird !== null && (
                    <div className="border-t border-border/40 pt-3">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-2">{ar ? "توزيع التكلفة على القطعان" : "Kostnadsfördelning per flock"}</p>
                      <div className="space-y-2">
                        {flocks.map(f => {
                          const share = f.count / flocks.reduce((s, x) => s + x.count, 0);
                          const flockCost = m.totalExpense * share;
                          return (
                            <div key={f.id} className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-base shrink-0">🐔</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold truncate">{f.name}</p>
                                <div className="flex items-center gap-1.5">
                                  <div className="h-1.5 flex-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${share * 100}%` }} />
                                  </div>
                                  <span className="text-[9px] text-muted-foreground">{(share*100).toFixed(0)}%</span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-[10px] font-bold text-red-600">{fmtAmount(flockCost, lang as any)}</p>
                                <p className="text-[9px] text-muted-foreground">{f.count} {ar ? "طير" : "fåglar"}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Key Ratios & Benchmarks */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Scale className="w-4 h-4 text-blue-500" />
                  {ar ? "النسب المالية مقارنة بالمعايير الصناعية" : "Finansiella nyckeltal vs. branschstandard"}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {[
                  {
                    label:     ar ? "نسبة تكلفة العلف" : "Foderandel av kostnader",
                    value:     m.feedRatio,
                    benchmark: { low: 55, high: 65 },
                    unit:      "%",
                    icon:      "🌾",
                    hint:      ar ? "المعيار 55-65%" : "Standard 55-65%",
                  },
                  {
                    label:     ar ? "نسبة تكلفة العمالة" : "Arbetskostnadsandel",
                    value:     m.laborRatio,
                    benchmark: { low: 15, high: 25 },
                    unit:      "%",
                    icon:      "👷",
                    hint:      ar ? "المعيار 15-25%" : "Standard 15-25%",
                  },
                  {
                    label:     ar ? "نسبة المصاريف التشغيلية (OER)" : "Driftkostnadskvot (OER)",
                    value:     m.oer,
                    benchmark: { low: 65, high: 80 },
                    unit:      "%",
                    icon:      "📊",
                    hint:      ar ? "المعيار 65-80% (أقل = أفضل)" : "Standard 65-80% (lägre = bättre)",
                  },
                  {
                    label:     ar ? "هامش الربح الصافي" : "Nettovinstmarginal",
                    value:     m.profitMargin,
                    benchmark: { low: 15, high: 30 },
                    unit:      "%",
                    icon:      "💰",
                    hint:      ar ? "المعيار 15-30%" : "Standard 15-30%",
                  },
                  {
                    label:     ar ? "العائد على الاستثمار (ROI)" : "Avkastning på investering (ROI)",
                    value:     m.roi,
                    benchmark: { low: 10, high: 25 },
                    unit:      "%",
                    icon:      "📈",
                    hint:      ar ? "المعيار 10-25%/سنة" : "Standard 10-25%/år",
                  },
                ].map(({ label, value, benchmark, unit, icon, hint }) => {
                  if (value === null) return (
                    <div key={label} className="flex items-center gap-2 py-1 opacity-40">
                      <span className="text-base">{icon}</span>
                      <div className="flex-1">
                        <p className="text-[10px] font-semibold">{label}</p>
                        <p className="text-[9px] text-muted-foreground">{hint}</p>
                      </div>
                      <span className="text-xs font-bold">—</span>
                    </div>
                  );
                  const inRange = value >= benchmark.low && value <= benchmark.high;
                  const tooHigh  = value > benchmark.high;
                  // For OER and costs: lower is better; for profit/ROI: higher is better
                  const isLowerBetter = label.includes("OER") || label.includes("نسبة تكلفة") || label.includes("andel");
                  const status = inRange ? "ok"
                    : isLowerBetter
                      ? (tooHigh ? "bad" : "great")
                      : (tooHigh ? "great" : "bad");
                  const barColor = status === "ok" ? "#10b981" : status === "great" ? "#3b82f6" : "#ef4444";
                  const statusIcon = status === "ok" ? "✅" : status === "great" ? "🌟" : "⚠️";
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{icon}</span>
                          <div>
                            <p className="text-[10px] font-semibold leading-none">{label}</p>
                            <p className="text-[9px] text-muted-foreground">{hint}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-black" style={{ color: barColor }}>{value.toFixed(1)}{unit}</span>
                          <span className="text-[10px]">{statusIcon}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, Math.abs(value))}%`, background: barColor }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Fixed vs Variable Costs */}
            {m.totalExpense > 0 && (
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-500" />
                    {ar ? "التكاليف الثابتة مقابل المتغيرة" : "Fasta vs. rörliga kostnader"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="rounded-xl bg-slate-100 dark:bg-slate-900/50 p-3">
                      <p className="text-[9px] text-muted-foreground">{ar ? "ثابتة (إيجار، عمالة، معدات)" : "Fasta (hyra, arbetskraft, utrustning)"}</p>
                      <p className="text-sm font-black mt-1">{fmtAmount(m.fixedCosts, lang as any)}</p>
                      <p className="text-[9px] text-muted-foreground">{m.totalExpense > 0 ? ((m.fixedCosts/m.totalExpense)*100).toFixed(0) : 0}%</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3">
                      <p className="text-[9px] text-muted-foreground">{ar ? "متغيرة (علف، دواء، وقود)" : "Rörliga (foder, medicin, bränsle)"}</p>
                      <p className="text-sm font-black mt-1 text-amber-600">{fmtAmount(m.variableCosts, lang as any)}</p>
                      <p className="text-[9px] text-muted-foreground">{m.totalExpense > 0 ? ((m.variableCosts/m.totalExpense)*100).toFixed(0) : 0}%</p>
                    </div>
                  </div>
                  {/* Break-even bar */}
                  <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200/50 p-3">
                    <div className="flex justify-between text-[10px] mb-1.5">
                      <span className="font-semibold text-blue-700 dark:text-blue-300">{ar ? "نقطة التعادل" : "Break-even punkt"}</span>
                      <span className="font-black text-blue-700 dark:text-blue-300">{fmtAmount(m.totalExpense, lang as any)}</span>
                    </div>
                    <div className="h-2.5 bg-white/60 dark:bg-slate-800/60 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, m.totalExpense > 0 ? (m.totalIncome / m.totalExpense) * 100 : 0)}%`,
                          background: m.totalIncome >= m.totalExpense ? "#10b981" : "#f59e0b",
                        }} />
                    </div>
                    <div className="flex justify-between text-[9px] mt-1 text-muted-foreground">
                      <span>{ar ? "دخل فعلي" : "Faktisk inkomst"}: {fmtAmount(m.totalIncome, lang as any)}</span>
                      <span>{m.totalExpense > 0 ? ((m.totalIncome/m.totalExpense)*100).toFixed(0) : 0}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Expense Category Cards */}
            {m.expByCat.length > 0 && (
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-red-500" />
                    {ar ? "تفصيل بنود المصاريف" : "Kostnadsposter i detalj"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2.5">
                  {m.expByCat.map((e, i) => {
                    const meta = catMeta(e.id);
                    return (
                      <div key={e.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{meta.icon}</span>
                            <span className="font-medium">{ar ? meta.ar : meta.sv}</span>
                            {"fixed" in meta && (
                              <Badge variant="outline" className="text-[8px] h-3.5 px-1">
                                {(meta as any).fixed ? (ar ? "ثابت" : "Fast") : (ar ? "متغير" : "Rörlig")}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground text-[10px]">{e.pct.toFixed(1)}%</span>
                            <span className="font-bold text-red-600">{fmtAmount(e.value, lang as any)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${e.pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="border-t border-border/40 pt-2 flex justify-between">
                    <span className="text-xs font-bold">{ar ? "إجمالي المصاريف" : "Totala kostnader"}</span>
                    <span className="text-sm font-black text-red-600">{fmtAmount(m.totalExpense, lang as any)}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All Alerts (including info) */}
            <AlertBanner alerts={alerts} ar={ar} />
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB: TRANSACTIONS
           ════════════════════════════════════════════════════════════════ */}
        {tab === "transactions" && (
          <div className="space-y-3">

            {/* Filters */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={ar ? "بحث..." : "Sök..."}
                  className="h-9 ps-8 text-sm" />
              </div>
              <div className="flex rounded-lg overflow-hidden border border-border/60">
                {(["all", "income", "expense"] as const).map(f => (
                  <button key={f} onClick={() => setTxFilter(f)}
                    className={cn(
                      "px-2.5 py-1.5 text-[10px] font-semibold transition-colors",
                      txFilter === f
                        ? f === "income" ? "bg-emerald-500 text-white"
                          : f === "expense" ? "bg-red-500 text-white"
                          : "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground bg-background"
                    )}>
                    {f === "all" ? (ar ? "الكل" : "Alla")
                     : f === "income" ? (ar ? "دخل" : "Inkomst")
                     : (ar ? "مصاريف" : "Kostnader")}
                  </button>
                ))}
              </div>
            </div>

            {/* Transaction List */}
            {filteredTxs.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Receipt className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {search ? (ar ? "لا نتائج" : "Inga resultat") : (ar ? "لا توجد معاملات" : "Inga transaktioner")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-none shadow-sm">
                <div className="divide-y divide-border/30">
                  {filteredTxs.map(tx => {
                    const meta = catMeta(tx.category);
                    return (
                      <div key={tx.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg",
                          tx.type === "income" ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30")}>
                          {meta.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-semibold truncate">{tx.description}</p>
                            <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                              {ar ? meta.ar : meta.sv}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5" />{tx.date}
                            </span>
                            {tx.authorName && (
                              <span className="text-[9px] text-muted-foreground opacity-60">{tx.authorName}</span>
                            )}
                            {tx.quantity && tx.unit && (
                              <span className="text-[9px] text-muted-foreground">{Number(tx.quantity).toLocaleString()} {tx.unit}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={cn("text-sm font-black",
                            tx.type === "income" ? "text-emerald-600" : "text-red-600")}>
                            {tx.type === "income" ? "+" : "-"}{fmtAmount(Number(tx.amount), lang as any)}
                          </span>
                          {isAdmin && (
                            <button onClick={() => handleDelete(tx.id)} disabled={deletingId === tx.id}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500">
                              {deletingId === tx.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Footer totals */}
                <div className="px-4 py-3 border-t border-border/40 bg-muted/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{filteredTxs.length} {ar ? "معاملة" : "transaktioner"}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-600">
                        +{fmtAmount(filteredTxs.filter(t=>t.type==="income").reduce((s,t)=>s+Number(t.amount),0), lang as any)}
                      </span>
                      <span className="font-bold text-red-600">
                        -{fmtAmount(filteredTxs.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.amount),0), lang as any)}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB: INCOME STATEMENT / P&L REPORT
           ════════════════════════════════════════════════════════════════ */}
        {tab === "statement" && (
          <div className="space-y-4">

            {/* Statement Header */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 p-5 text-white shadow-xl">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-slate-300" />
                <h2 className="text-sm font-black text-white">{ar ? "قائمة الدخل والأرباح والخسائر" : "Resultaträkning (P&L)"}</h2>
              </div>
              <p className="text-[10px] text-slate-400 mb-4">
                {ar ? "نظام الإدارة المالية الاحترافي · مزرعة الدواجن" : "Professionellt ekonomihanteringssystem · Fjäderfägård"}
              </p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white/5 rounded-xl p-2.5">
                  <p className="text-[9px] text-slate-400">{ar ? "إجمالي الإيرادات" : "Totala intäkter"}</p>
                  <p className="text-sm font-black text-emerald-400 mt-1">{fmtAmount(m.totalIncome, lang as any)}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5">
                  <p className="text-[9px] text-slate-400">{ar ? "إجمالي المصاريف" : "Totala kostnader"}</p>
                  <p className="text-sm font-black text-red-400 mt-1">{fmtAmount(m.totalExpense, lang as any)}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5">
                  <p className="text-[9px] text-slate-400">{ar ? "صافي الربح" : "Nettovinst"}</p>
                  <p className={cn("text-sm font-black mt-1", m.netProfit >= 0 ? "text-blue-400" : "text-orange-400")}>
                    {m.netProfit >= 0 ? "+" : ""}{fmtAmount(Math.abs(m.netProfit), lang as any)}
                  </p>
                </div>
              </div>
            </div>

            {/* Revenue Section */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-black text-emerald-600 flex items-center gap-2">
                  <ArrowUpCircle className="w-3.5 h-3.5" />
                  {ar ? "أ. الإيرادات التشغيلية" : "A. Rörelseintäkter"}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {m.incByCat.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">{ar ? "لا توجد إيرادات مسجلة" : "Inga intäkter registrerade"}</p>
                ) : (
                  <>
                    {m.incByCat.map((inc) => {
                      const meta = catMeta(inc.id);
                      return (
                        <div key={inc.id} className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <span>{meta.icon}</span>{ar ? meta.ar : meta.sv}
                          </span>
                          <span className="font-bold text-emerald-600">{fmtAmount(inc.value, lang as any)}</span>
                        </div>
                      );
                    })}
                    <div className="border-t border-border/40 pt-2 flex justify-between text-xs font-black">
                      <span>{ar ? "إجمالي الإيرادات" : "Totala intäkter"}</span>
                      <span className="text-emerald-600">{fmtAmount(m.totalIncome, lang as any)}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Variable Costs */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-black text-amber-600 flex items-center gap-2">
                  <ArrowDownCircle className="w-3.5 h-3.5" />
                  {ar ? "ب. تكلفة الإنتاج المتغيرة (COGS)" : "B. Rörliga produktionskostnader (COGS)"}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {m.expByCat.filter(e => {
                  const meta = catMeta(e.id);
                  return "fixed" in meta && !(meta as any).fixed;
                }).map((e) => {
                  const meta = catMeta(e.id);
                  return (
                    <div key={e.id} className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <span>{meta.icon}</span>{ar ? meta.ar : meta.sv}
                      </span>
                      <span className="font-bold text-red-600">({fmtAmount(e.value, lang as any)})</span>
                    </div>
                  );
                })}
                <div className="border-t border-border/40 pt-2 flex justify-between text-xs font-bold">
                  <span>{ar ? "إجمالي التكاليف المتغيرة" : "Totala rörliga kostnader"}</span>
                  <span className="text-red-600">({fmtAmount(m.variableCosts, lang as any)})</span>
                </div>
                <div className="flex justify-between text-xs font-black border-t border-border/60 pt-2">
                  <span className="text-blue-600">{ar ? "إجمالي الربح" : "Bruttovinst"}</span>
                  <span className={cn("font-black", m.grossProfit >= 0 ? "text-blue-600" : "text-orange-600")}>
                    {m.grossProfit >= 0 ? "+" : ""}{fmtAmount(Math.abs(m.grossProfit), lang as any)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Fixed Costs */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-black text-red-600 flex items-center gap-2">
                  <ArrowDownCircle className="w-3.5 h-3.5" />
                  {ar ? "ج. المصاريف التشغيلية الثابتة (OPEX)" : "C. Fasta driftskostnader (OPEX)"}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {m.expByCat.filter(e => {
                  const meta = catMeta(e.id);
                  return "fixed" in meta && (meta as any).fixed;
                }).map((e) => {
                  const meta = catMeta(e.id);
                  return (
                    <div key={e.id} className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <span>{meta.icon}</span>{ar ? meta.ar : meta.sv}
                      </span>
                      <span className="font-bold text-red-600">({fmtAmount(e.value, lang as any)})</span>
                    </div>
                  );
                })}
                <div className="border-t border-border/40 pt-2 flex justify-between text-xs font-bold">
                  <span>{ar ? "إجمالي التكاليف الثابتة" : "Totala fasta kostnader"}</span>
                  <span className="text-red-600">({fmtAmount(m.fixedCosts, lang as any)})</span>
                </div>
              </CardContent>
            </Card>

            {/* Net Profit Summary */}
            <div className={cn("rounded-2xl p-5 shadow-md",
              m.netProfit >= 0
                ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
                : "bg-gradient-to-r from-red-500 to-rose-600 text-white")}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-black">{ar ? "صافي الربح / الخسارة" : "Nettoresultat"}</span>
                <span className="text-xl font-black">
                  {m.netProfit >= 0 ? "+" : ""}{fmtAmount(Math.abs(m.netProfit), lang as any)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center bg-white/10 rounded-xl p-2.5">
                <div>
                  <p className="text-[9px] opacity-70">{ar ? "هامش الربح" : "Vinstmarginal"}</p>
                  <p className="text-xs font-black">{m.profitMargin !== null ? `${m.profitMargin.toFixed(1)}%` : "—"}</p>
                </div>
                <div>
                  <p className="text-[9px] opacity-70">{ar ? "العائد ROI" : "ROI"}</p>
                  <p className="text-xs font-black">{m.roi !== null ? `${m.roi.toFixed(1)}%` : "—"}</p>
                </div>
                <div>
                  <p className="text-[9px] opacity-70">{ar ? "ربح/طير" : "Vinst/fågel"}</p>
                  <p className="text-xs font-black">
                    {m.profitPerBird !== null ? fmtAmount(Math.abs(m.profitPerBird), lang as any) : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Monthly Trend Table */}
            {monthly.length > 0 && (
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    {ar ? "الاتجاه الشهري التاريخي" : "Historisk månadsöversikt"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="border-b border-border/40">
                          <th className="text-start px-3 py-2 text-muted-foreground font-semibold">{ar ? "الشهر" : "Månad"}</th>
                          <th className="text-end px-3 py-2 text-emerald-600 font-semibold">{ar ? "دخل" : "Inkomst"}</th>
                          <th className="text-end px-3 py-2 text-red-600 font-semibold">{ar ? "مصاريف" : "Kostnader"}</th>
                          <th className="text-end px-3 py-2 text-blue-600 font-semibold">{ar ? "ربح" : "Vinst"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthly.slice(-12).reverse().map((row, i) => (
                          <tr key={i} className="border-b border-border/20 hover:bg-muted/20">
                            <td className="px-3 py-2 font-medium">{ar ? row.monthAr : row.month}</td>
                            <td className="text-end px-3 py-2 text-emerald-600 font-bold">{fmtAmount(row.income, lang as any)}</td>
                            <td className="text-end px-3 py-2 text-red-600 font-bold">{fmtAmount(row.expense, lang as any)}</td>
                            <td className={cn("text-end px-3 py-2 font-bold",
                              row.profit >= 0 ? "text-blue-600" : "text-orange-600")}>
                              {row.profit >= 0 ? "+" : ""}{fmtAmount(Math.abs(row.profit), lang as any)}
                            </td>
                          </tr>
                        ))}
                        {/* Prediction row */}
                        {pred && (
                          <tr className="bg-muted/30 border-t-2 border-dashed border-border/60">
                            <td className="px-3 py-2 font-bold text-muted-foreground">
                              {ar ? "التوقع →" : "Prognos →"}
                            </td>
                            <td className="text-end px-3 py-2 text-emerald-500 font-bold italic">{fmtAmount(pred.income, lang as any)}</td>
                            <td className="text-end px-3 py-2 text-red-500 font-bold italic">{fmtAmount(pred.expense, lang as any)}</td>
                            <td className={cn("text-end px-3 py-2 font-bold italic",
                              pred.profit >= 0 ? "text-blue-500" : "text-orange-500")}>
                              {pred.profit >= 0 ? "+" : ""}{fmtAmount(Math.abs(pred.profit), lang as any)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Info Alerts */}
            <AlertBanner alerts={alerts.filter(a => a.severity === "info")} ar={ar} />
          </div>
        )}

        {/* Bottom padding */}
        <div className="h-6" />
      </div>
    </div>
  );
}
