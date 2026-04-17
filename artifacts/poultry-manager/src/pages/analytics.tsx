/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  نظام التحليل الفوري المستقل — Real-Time Analytics Dashboard
 *  تحديث كل 5 ثوانٍ · حسابات خادم SQL · إضافة سريعة · تحليل شامل
 * ══════════════════════════════════════════════════════════════════════════════
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import {
  TrendingUp, TrendingDown, Minus, Plus, Zap, RefreshCw,
  ArrowUpCircle, ArrowDownCircle, Wheat, Syringe, Bird, Egg,
  CheckCircle2, AlertTriangle, Activity, Clock, Database,
  BarChart3, DollarSign, Wallet, ShoppingCart, Wrench, Home,
  Flame, Truck, Package, Target, Layers, Droplets, Award,
  Factory, ChevronDown, ChevronUp, X, Save, Loader2,
  ShieldPlus, ArrowLeft, ArrowRight,
} from "lucide-react";
import { ExplainTip } from "@/components/ExplainTip";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Config ───────────────────────────────────────────────────────────────────
const REFRESH_INTERVAL = 5_000; // 5 ثوانٍ
const LIVE_TICK        = 1_000; // عداد الوقت كل ثانية

// ─── Colors ───────────────────────────────────────────────────────────────────
const PIE_COLORS = [
  "#ef4444","#f97316","#f59e0b","#84cc16","#06b6d4","#8b5cf6",
  "#ec4899","#14b8a6","#fb923c","#a78bfa","#34d399","#60a5fa",
  "#f472b6","#38bdf8","#4ade80","#facc15",
];

// ─── Expense Categories ───────────────────────────────────────────────────────
const EXPENSE_CATS = [
  { id: "feed",              ar: "علف",             sv: "Foder",            icon: "🌾", Icon: Wheat     },
  { id: "medicine",         ar: "أدوية وعلاج",      sv: "Medicin",          icon: "💊", Icon: Syringe   },
  { id: "vaccines",         ar: "لقاحات",           sv: "Vacciner",         icon: "💉", Icon: ShieldPlus},
  { id: "electricity",      ar: "كهرباء",           sv: "El",               icon: "⚡", Icon: Zap       },
  { id: "water",            ar: "ماء",              sv: "Vatten",           icon: "💧", Icon: Droplets  },
  { id: "fuel",             ar: "وقود ومولد",        sv: "Bränsle",          icon: "⛽", Icon: Flame     },
  { id: "labor",            ar: "عمالة وأجور",       sv: "Arbetskraft",      icon: "👷", Icon: Award     },
  { id: "equipment",        ar: "معدات وأجهزة",      sv: "Utrustning",       icon: "🔧", Icon: Wrench    },
  { id: "maintenance",      ar: "صيانة",            sv: "Underhåll",        icon: "🛠️", Icon: Factory   },
  { id: "disinfection",     ar: "مطهرات ومعقمات",    sv: "Desinfektion",     icon: "🧴", Icon: Package   },
  { id: "transport",        ar: "نقل وشحن",          sv: "Transport",        icon: "🚛", Icon: Truck     },
  { id: "rent",             ar: "إيجار",            sv: "Hyra",             icon: "🏠", Icon: Home      },
  { id: "incubation_supplies",ar:"مستلزمات تفقيس",  sv: "Kläckningstillb.", icon: "🥚", Icon: Egg       },
  { id: "eggs_purchase",    ar: "شراء بيض تفقيس",   sv: "Inköp av ägg",     icon: "🐣", Icon: Egg       },
  { id: "other",            ar: "أخرى",             sv: "Övrigt",           icon: "📦", Icon: Package   },
];
const INCOME_CATS = [
  { id: "chick_sale",   ar: "بيع كتاكيت",    sv: "Kycklingförsäljning",  icon: "🐥", Icon: Bird       },
  { id: "egg_sale",     ar: "بيع بيض",        sv: "Äggförsäljning",       icon: "🥚", Icon: Egg        },
  { id: "chicken_sale", ar: "بيع دجاج (لحم)", sv: "Slaktkycklingförs.",   icon: "🍗", Icon: Bird       },
  { id: "manure_sale",  ar: "بيع سماد",       sv: "Gödselförsäljning",    icon: "♻️", Icon: Layers     },
  { id: "other",        ar: "دخل أخرى",       sv: "Övriga intäkter",      icon: "📈", Icon: TrendingUp },
];
const catMeta = (id: string, type: "income"|"expense") => {
  const list = type === "income" ? INCOME_CATS : EXPENSE_CATS;
  return list.find(c => c.id === id) ?? { id, ar: id, sv: id, icon: "📦", Icon: Package };
};

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmtMoney(n: number, lang: "ar"|"sv" = "ar"): string {
  const fmt = new Intl.NumberFormat(lang === "ar" ? "ar-IQ" : "sv-SE").format(Math.round(Math.abs(n)));
  return lang === "ar" ? `${fmt} د.ع` : `${fmt} IQD`;
}
function fmtPct(n: number, dec = 1): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(dec)}%`;
}
function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("ar-IQ", { month: "short", day: "numeric" });
}
function monthLabel(ym: string, ar: boolean): string {
  const m = parseInt(ym.split("-")[1]) - 1;
  const arNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const svNames = ["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];
  return ar ? arNames[m] : svNames[m];
}

// ─── Live Data Types ──────────────────────────────────────────────────────────
interface LiveKpis {
  total_income: string; total_expense: string; net_profit: string;
  tx_count: string; last_tx_at: string;
}
interface PeriodData { income: string; expense: string; tx_count?: string; }
interface CatRow { type: string; category: string; total: string; count: string; last_date: string; }
interface MonthRow { month: string; income: string; expense: string; profit: string; tx_count: string; }
interface FeedData { total_cost: string; total_kg: string; entry_count: string; avg_cost_per_entry: string; }
interface RecentTx { id: number; date: string; type: string; category: string; description: string; amount: string; unit?: string; quantity?: string; author_name?: string; }
interface FeedRatio { feed_total: string; all_expenses: string; }
interface DayRow { day: string; income: string; expense: string; }
interface LiveData {
  timestamp: string;
  kpis: LiveKpis;
  thisMonth: PeriodData;
  lastMonth: PeriodData;
  thisWeek: PeriodData;
  today: PeriodData;
  byCategory: CatRow[];
  monthly: MonthRow[];
  feedAnalysis: FeedData;
  recent: RecentTx[];
  categoryCount: number;
  topExpense: { description: string; amount: string; date: string; category: string } | null;
  topIncome:  { description: string; amount: string; date: string; category: string } | null;
  feedRatio: FeedRatio;
  last7days: DayRow[];
}

// ─── Animated Number ──────────────────────────────────────────────────────────
function AnimatedNum({ value, lang, className }: { value: number; lang: "ar"|"sv"; className?: string }) {
  const [displayed, setDisplayed] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (Math.abs(value - prev.current) < 1) { setDisplayed(value); return; }
    const steps = 20, start = prev.current, diff = value - start;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(start + diff * (i / steps));
      if (i >= steps) { clearInterval(timer); setDisplayed(value); prev.current = value; }
    }, 30);
    return () => clearInterval(timer);
  }, [value]);
  return <span className={className}>{fmtMoney(displayed, lang)}</span>;
}

// ─── Live Pulse ───────────────────────────────────────────────────────────────
function LivePulse({ lastUpdate, ar }: { lastUpdate: string; ar: boolean }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(lastUpdate).getTime()) / 1000);
      setSecs(elapsed);
    }, LIVE_TICK);
    return () => clearInterval(t);
  }, [lastUpdate]);
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="text-[10px] text-emerald-600 font-medium">
        {ar ? `مباشر · منذ ${secs}ث` : `Live · ${secs}s ago`}
      </span>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, trend, icon: Icon, color, lang, titleAr, titleSv, textAr, textSv }: {
  label: string; value: number; sub?: string; trend?: number;
  icon: React.ElementType; color: string; lang: "ar"|"sv";
  titleAr?: string; titleSv?: string; textAr?: string; textSv?: string;
}) {
  return (
    <div className={cn("rounded-2xl border p-4 flex flex-col gap-1 bg-card shadow-sm", color)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          {textAr && titleAr && (
            <ExplainTip titleAr={titleAr} titleSv={titleSv!} textAr={textAr} textSv={textSv!} />
          )}
        </div>
        <Icon className="w-4 h-4 text-muted-foreground/60" />
      </div>
      <AnimatedNum value={value} lang={lang} className="text-xl font-black tracking-tight" />
      <div className="flex items-center gap-1.5 mt-0.5">
        {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
        {trend !== undefined && (
          <span className={cn("text-[10px] font-bold flex items-center gap-0.5", trend >= 0 ? "text-emerald-600" : "text-red-500")}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {fmtPct(trend)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Quick Add Form ───────────────────────────────────────────────────────────
function QuickAddForm({ ar, onSuccess }: { ar: boolean; onSuccess: () => Promise<void> | void }) {
  const { toast } = useToast();
  const [type, setType]   = useState<"income"|"expense">("expense");
  const [cat, setCat]     = useState("");
  const [desc, setDesc]   = useState("");
  const [amt, setAmt]     = useState("");
  const [date, setDate]   = useState(new Date().toISOString().slice(0, 10));
  const [qty, setQty]     = useState("");
  const [unit, setUnit]   = useState("");
  const [open, setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);

  const cats = type === "expense" ? EXPENSE_CATS : INCOME_CATS;

  async function handleSave() {
    if (!cat || !desc || !amt || !date) {
      toast({ title: ar ? "يرجى ملء الحقول المطلوبة" : "Fyll i alla fält", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, type, category: cat, description: desc, amount: Number(amt), quantity: qty || null, unit: unit || null }),
      });
      toast({ title: ar ? "✅ تمت الإضافة بنجاح" : "✅ Tillagd" });
      setDesc(""); setAmt(""); setQty(""); setUnit(""); setCat("");
      await onSuccess();
      setOpen(false);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 text-sm font-semibold hover:bg-accent/30 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          {ar ? "إضافة سريعة" : "Snabbinlägg"}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 pt-0 space-y-3 border-t">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(["expense","income"] as const).map(t => (
              <button key={t} onClick={() => { setType(t); setCat(""); }}
                className={cn(
                  "py-2 rounded-xl text-xs font-bold border transition-all",
                  type === t
                    ? t === "expense" ? "bg-red-500 text-white border-red-500" : "bg-emerald-500 text-white border-emerald-500"
                    : "bg-muted text-muted-foreground border-transparent"
                )}>
                {t === "expense" ? (ar ? "مصروف" : "Kostnad") : (ar ? "دخل" : "Inkomst")}
              </button>
            ))}
          </div>

          {/* Category */}
          <div className="grid grid-cols-3 gap-1 max-h-28 overflow-y-auto">
            {cats.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)}
                className={cn(
                  "text-[10px] py-1 px-1.5 rounded-lg border text-center transition-all truncate",
                  cat === c.id ? "bg-primary text-white border-primary" : "bg-muted/50 border-transparent hover:border-primary/30"
                )}>
                {c.icon} {ar ? c.ar : c.sv}
              </button>
            ))}
          </div>

          {/* Date + Amount */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">{ar ? "التاريخ" : "Datum"}</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[10px]">{ar ? "المبلغ (د.ع)" : "Belopp (IQD)"}</Label>
              <Input type="number" value={amt} onChange={e => setAmt(e.target.value)} placeholder="0" className="h-8 text-xs" />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label className="text-[10px]">{ar ? "الوصف *" : "Beskrivning *"}</Label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder={ar ? "مثل: شراء علف ..." : "T.ex: Köpte foder..."} className="h-8 text-xs" />
          </div>

          {/* Qty + Unit (for feed) */}
          {cat === "feed" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">{ar ? "الكمية" : "Mängd"}</Label>
                <Input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">{ar ? "الوحدة" : "Enhet"}</Label>
                <select value={unit} onChange={e => setUnit(e.target.value)}
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-2">
                  <option value="">{ar ? "اختر" : "Välj"}</option>
                  <option value="كيلو">كيلو (kg)</option>
                  <option value="طن">طن (ton)</option>
                  <option value="غرام">غرام (g)</option>
                  <option value="كيس">كيس</option>
                </select>
              </div>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full h-9 text-xs" size="sm">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span className="mr-1">{ar ? "حفظ" : "Spara"}</span>
          </Button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function Analytics() {
  const { lang } = useLanguage();
  const { isAdmin } = useAuth();
  const ar = lang === "ar";
  const qc = useQueryClient();

  // ── Live Data ────────────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery<LiveData>({
    queryKey: ["analytics-live"],
    queryFn:  () => apiFetch("/api/analytics/live"),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 3_000,
    retry: 2,
  });

  const refresh = useCallback(() => { refetch(); }, [refetch]);

  // ── Delete Tx ────────────────────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["analytics-live"] }); },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">{ar ? "جارٍ تحميل التحليلات..." : "Laddar analys..."}</p>
      </div>
    </div>
  );

  if (isError || !data) return (
    <div className="flex items-center justify-center h-64 text-red-500 flex-col gap-3">
      <AlertTriangle className="w-8 h-8" />
      <p>{ar ? "خطأ في تحميل البيانات" : "Fel vid laddning"}</p>
      <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="w-3.5 h-3.5 mr-1" />{ar ? "إعادة المحاولة" : "Försök igen"}</Button>
    </div>
  );

  // ── Derived Values ───────────────────────────────────────────────────────────
  const kpis     = data.kpis;
  const total    = { inc: Number(kpis.total_income), exp: Number(kpis.total_expense) };
  const profit   = total.inc - total.exp;
  const margin   = total.inc > 0 ? (profit / total.inc) * 100 : 0;
  const thisM    = { inc: Number(data.thisMonth.income), exp: Number(data.thisMonth.expense) };
  const lastM    = { inc: Number(data.lastMonth.income), exp: Number(data.lastMonth.expense) };
  const thisW    = { inc: Number(data.thisWeek.income),  exp: Number(data.thisWeek.expense)  };
  const tod      = { inc: Number(data.today.income),     exp: Number(data.today.expense)     };
  const thisMProfit  = thisM.inc - thisM.exp;
  const lastMProfit  = lastM.inc - lastM.exp;
  const profitTrend  = lastMProfit !== 0 ? ((thisMProfit - lastMProfit) / Math.abs(lastMProfit)) * 100 : 0;
  const incTrend     = lastM.inc > 0 ? ((thisM.inc - lastM.inc) / lastM.inc) * 100 : 0;
  const expTrend     = lastM.exp > 0 ? ((thisM.exp - lastM.exp) / lastM.exp) * 100 : 0;

  const expCats  = data.byCategory.filter(r => r.type === "expense");
  const incCats  = data.byCategory.filter(r => r.type === "income");
  const totalExpCat = expCats.reduce((s, r) => s + Number(r.total), 0);
  const totalIncCat = incCats.reduce((s, r) => s + Number(r.total), 0);

  const feedRatio = (() => {
    const ft = Number(data.feedRatio.feed_total), ae = Number(data.feedRatio.all_expenses);
    return ae > 0 ? (ft / ae * 100) : 0;
  })();

  const chartData = data.monthly.slice(-12).map(r => ({
    name: monthLabel(r.month, ar),
    income:  Math.round(Number(r.income)),
    expense: Math.round(Number(r.expense)),
    profit:  Math.round(Number(r.profit)),
  }));

  const weekData = (() => {
    const map: Record<string, DayRow> = {};
    data.last7days.forEach(d => { map[d.day] = d; });
    const days: { name: string; income: number; expense: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const arDays = ["أح","إث","ث","أر","خ","ج","س"];
      const svDays = ["Sö","Må","Ti","On","To","Fr","Lö"];
      days.push({
        name: (ar ? arDays : svDays)[d.getDay()],
        income:  Math.round(Number(map[key]?.income  ?? 0)),
        expense: Math.round(Number(map[key]?.expense ?? 0)),
      });
    }
    return days;
  })();

  const pieData = expCats.map((r, i) => ({
    name: ar ? (catMeta(r.category, "expense").ar) : (catMeta(r.category, "expense").sv),
    value: Math.round(Number(r.total)),
    color: PIE_COLORS[i % PIE_COLORS.length],
    pct: totalExpCat > 0 ? Number(r.total) / totalExpCat * 100 : 0,
  })).slice(0, 8);

  const feedKg = Number(data.feedAnalysis.total_kg);
  const feedCost = Number(data.feedAnalysis.total_cost);
  const costPerKg = feedKg > 0 ? feedCost / feedKg : 0;

  return (
    <div className="space-y-4 pb-10" dir={ar ? "rtl" : "ltr"}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            {ar ? "التحليلات الفورية" : "Realtidsanalys"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ar ? "بيانات حية من قاعدة البيانات · تحديث تلقائي كل 5 ثوانٍ" : "Live data från databasen · Auto-uppdatering var 5:e sekund"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <LivePulse lastUpdate={data.timestamp} ar={ar} />
          <button onClick={refresh} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-3 h-3" /> {ar ? "تحديث" : "Uppdatera"}
          </button>
        </div>
      </div>

      {/* ── KPI Row ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label={ar ? "إجمالي الدخل" : "Total inkomst"}
          value={total.inc}
          sub={`↑ ${ar?"هذا الشهر":"Denna månad"}: ${fmtMoney(thisM.inc, lang as any)}`}
          trend={incTrend}
          icon={ArrowUpCircle} color="border-emerald-200/50 dark:border-emerald-800/30"
          lang={lang as any}
          titleAr="إجمالي الدخل" titleSv="Total inkomst"
          textAr="مجموع كل الأموال التي دخلت للمزرعة من بيع الكتاكيت والبيض والدجاج وأي مصدر دخل آخر. كلما كان هذا الرقم أعلى كان أفضل."
          textSv="Summan av alla intäkter till gården från försäljning av kycklingar, ägg och höns. Ju högre desto bättre."
        />
        <KpiCard
          label={ar ? "إجمالي المصاريف" : "Totala kostnader"}
          value={total.exp}
          sub={`↓ ${ar?"هذا الشهر":"Denna månad"}: ${fmtMoney(thisM.exp, lang as any)}`}
          trend={expTrend}
          icon={ArrowDownCircle} color="border-red-200/50 dark:border-red-800/30"
          lang={lang as any}
          titleAr="إجمالي المصاريف" titleSv="Totala kostnader"
          textAr="مجموع كل ما صُرف على المزرعة مثل العلف والأدوية والكهرباء والعمالة والصيانة وغيرها. حاول إبقاء هذا الرقم أقل من الدخل."
          textSv="Summan av alla utgifter för gården som foder, medicin, el, arbetskraft och underhåll. Håll detta lägre än inkomsten."
        />
        <KpiCard
          label={ar ? "صافي الربح" : "Nettovinst"}
          value={profit}
          sub={`${ar?"هامش":"Marginal"}: ${margin.toFixed(1)}%`}
          trend={profitTrend}
          icon={profit >= 0 ? TrendingUp : TrendingDown}
          color={profit >= 0 ? "border-blue-200/50 dark:border-blue-800/30" : "border-red-200/50 dark:border-red-800/30"}
          lang={lang as any}
          titleAr="صافي الربح" titleSv="Nettovinst"
          textAr="الفرق بين الدخل والمصاريف. إذا كان موجباً (+) أنت رابح. إذا كان سالباً (-) أنت في خسارة وتحتاج لمراجعة مصاريفك أو زيادة مبيعاتك."
          textSv="Skillnaden mellan inkomst och kostnader. Om positiv (+) går du med vinst. Om negativ (-) har du förlust."
        />
        <KpiCard
          label={ar ? "صافي اليوم" : "Netto idag"}
          value={tod.inc - tod.exp}
          sub={`${ar?"دخل":"Inc"}: ${fmtMoney(tod.inc, lang as any)}`}
          icon={Clock}
          color="border-violet-200/50 dark:border-violet-800/30"
          lang={lang as any}
          titleAr="صافي اليوم" titleSv="Netto idag"
          textAr="الفرق بين ما دخل وما صُرف اليوم فقط. يساعدك على معرفة هل اليوم كان مربحاً أم لا بشكل فوري."
          textSv="Skillnaden mellan dagens inkomster och utgifter. Visar om dagen var lönsam eller inte."
        />
      </div>

      {/* ── Main Grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left 2/3 */}
        <div className="lg:col-span-2 space-y-4">

          {/* Period Overview */}
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-bold text-muted-foreground">{ar ? "مقارنة الفترات" : "Periodjämförelse"}</p>
              <ExplainTip
                titleAr="مقارنة الفترات" titleSv="Periodjämförelse"
                textAr="مقارنة الدخل والمصاريف والصافي لثلاث فترات: اليوم فقط، هذا الأسبوع، وهذا الشهر. تساعدك على معرفة الأداء في كل فترة بشكل منفصل."
                textSv="Jämförelse av inkomster, kostnader och netto för tre perioder: idag, denna vecka, och denna månad."
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: ar?"اليوم":"Idag",         inc: tod.inc,   exp: tod.exp   },
                { label: ar?"هذا الأسبوع":"Vecka",  inc: thisW.inc, exp: thisW.exp },
                { label: ar?"هذا الشهر":"Månaden",  inc: thisM.inc, exp: thisM.exp },
              ].map(p => {
                const net = p.inc - p.exp;
                return (
                  <div key={p.label} className="rounded-xl bg-muted/40 p-3 space-y-2">
                    <p className="text-[10px] font-bold text-muted-foreground">{p.label}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-emerald-600 font-medium">{ar?"دخل":"Inc"}</span>
                        <span className="font-black text-emerald-700">{fmtMoney(p.inc, lang as any)}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-red-500 font-medium">{ar?"مصروف":"Utg"}</span>
                        <span className="font-black text-red-600">{fmtMoney(p.exp, lang as any)}</span>
                      </div>
                      <div className="h-px bg-border my-1" />
                      <div className="flex justify-between text-[10px]">
                        <span className="font-semibold">{ar?"صافي":"Netto"}</span>
                        <span className={cn("font-black", net >= 0 ? "text-blue-600" : "text-red-500")}>{fmtMoney(net, lang as any)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 7-Day Chart */}
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-bold text-muted-foreground">{ar ? "آخر 7 أيام" : "Senaste 7 dagarna"}</p>
              <ExplainTip
                titleAr="رسم بياني آخر 7 أيام" titleSv="Diagram senaste 7 dagarna"
                textAr="أعمدة خضراء = الدخل، أعمدة حمراء = المصاريف لكل يوم من آخر 7 أيام. اضغط على أي عمود لترى المبلغ الدقيق. يساعدك على رصد الأيام النشطة."
                textSv="Gröna staplar = inkomst, röda = kostnader per dag de senaste 7 dagarna. Tryck på en stapel för exakt belopp."
              />
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={weekData} barSize={8} margin={{ left: -20, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => v > 999999 ? `${(v/1000000).toFixed(1)}M` : v > 999 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip formatter={(v: number) => fmtMoney(v, lang as any)} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                <Bar dataKey="income"  fill="#10b981" radius={[3,3,0,0]} name={ar?"دخل":"Inkomst"} />
                <Bar dataKey="expense" fill="#ef4444" radius={[3,3,0,0]} name={ar?"مصروف":"Kostnad"} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Trend Chart */}
          {chartData.length > 1 && (
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-xs font-bold text-muted-foreground mb-3">{ar ? "الاتجاه الشهري" : "Månatlig trend"}</p>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartData} margin={{ left: -20, right: 4 }}>
                  <defs>
                    <linearGradient id="incG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="expG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => v > 999999 ? `${(v/1000000).toFixed(1)}M` : v > 999 ? `${(v/1000).toFixed(0)}K` : v} />
                  <Tooltip formatter={(v: number) => fmtMoney(v, lang as any)} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                  <Area dataKey="income"  stroke="#10b981" strokeWidth={2} fill="url(#incG)" name={ar?"دخل":"Inkomst"} />
                  <Area dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#expG)" name={ar?"مصروف":"Kostnad"} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Expense Category Breakdown */}
          {expCats.length > 0 && (
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-xs font-bold text-muted-foreground mb-3">{ar ? "توزيع المصاريف" : "Kostnadsfördelning"}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bar breakdown */}
                <div className="space-y-2">
                  {expCats.slice(0, 8).map((r, i) => {
                    const meta = catMeta(r.category, "expense");
                    const pct = totalExpCat > 0 ? Number(r.total) / totalExpCat * 100 : 0;
                    return (
                      <div key={r.category}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] font-medium flex items-center gap-1">
                            <span>{meta.icon}</span>
                            <span className="truncate">{ar ? meta.ar : meta.sv}</span>
                          </span>
                          <span className="text-[10px] font-black">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Pie */}
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={60} innerRadius={30} dataKey="value" paddingAngle={2}>
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmtMoney(v, lang as any)} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Income Sources */}
          {incCats.length > 0 && (
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-xs font-bold text-muted-foreground mb-3">{ar ? "مصادر الدخل" : "Inkomstkällor"}</p>
              <div className="space-y-2">
                {incCats.map((r, i) => {
                  const meta = catMeta(r.category, "income");
                  const pct = totalIncCat > 0 ? Number(r.total) / totalIncCat * 100 : 0;
                  return (
                    <div key={r.category}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-medium flex items-center gap-1">
                          <span>{meta.icon}</span><span>{ar ? meta.ar : meta.sv}</span>
                        </span>
                        <span className="text-[10px] font-black text-emerald-700">{fmtMoney(Number(r.total), lang as any)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700 bg-emerald-500"
                          style={{ width: `${pct}%`, opacity: 0.7 + (i === 0 ? 0.3 : 0) }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Transactions */}
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-bold text-muted-foreground mb-3">{ar ? "آخر المعاملات" : "Senaste transaktioner"}</p>
            {data.recent.length === 0 ? (
              <p className="text-xs text-center text-muted-foreground py-4">{ar ? "لا توجد معاملات بعد" : "Inga transaktioner ännu"}</p>
            ) : (
              <div className="space-y-1.5">
                {data.recent.map(tx => {
                  const isInc = tx.type === "income";
                  const meta  = catMeta(tx.category, tx.type as any);
                  return (
                    <div key={tx.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-muted/50 transition-colors group">
                      <span className="text-base shrink-0">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{tx.description}</p>
                        <p className="text-[10px] text-muted-foreground">{fmtDate(tx.date)} · {ar ? meta.ar : meta.sv}</p>
                      </div>
                      <span className={cn("text-xs font-black shrink-0", isInc ? "text-emerald-600" : "text-red-500")}>
                        {isInc ? "+" : "-"}{fmtMoney(Number(tx.amount), lang as any)}
                      </span>
                      {isAdmin && (
                        <button onClick={() => deleteMut.mutate(tx.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 1/3 */}
        <div className="space-y-4">

          {/* Quick Add */}
          <QuickAddForm ar={ar} onSuccess={async () => {
            await qc.invalidateQueries({ queryKey: ["analytics-live"] });
            await refetch();
          }} />

          {/* Stats */}
          <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
            <p className="text-xs font-bold text-muted-foreground">{ar ? "إحصاءات عامة" : "Allmän statistik"}</p>
            {[
              { label: ar?"إجمالي المعاملات":"Totala transaktioner", value: Number(kpis.tx_count).toString(), icon: Database },
              { label: ar?"الفئات النشطة":"Aktiva kategorier",       value: data.categoryCount.toString(),    icon: Layers  },
              { label: ar?"هامش الربح":"Vinstmarginal",              value: `${margin.toFixed(1)}%`,          icon: Target  },
              { label: ar?"تكلفة العلف من المصاريف":"Foderandel",    value: `${feedRatio.toFixed(1)}%`,       icon: Wheat   },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <s.icon className="w-3.5 h-3.5" />{s.label}
                </span>
                <span className="text-xs font-black">{s.value}</span>
              </div>
            ))}
          </div>

          {/* Feed Analysis */}
          {Number(data.feedAnalysis.entry_count) > 0 && (
            <div className="rounded-2xl border bg-amber-50 dark:bg-amber-950/20 p-4 shadow-sm space-y-3">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Wheat className="w-3.5 h-3.5" />
                {ar ? "تحليل العلف (آخر 6 أشهر)" : "Foderanalys (6 mån)"}
              </p>
              {[
                { label: ar?"إجمالي كمية العلف":"Total fodermängd",      value: `${Math.round(feedKg).toLocaleString()} ${ar?"كغ":"kg"}` },
                { label: ar?"تكلفة العلف الإجمالية":"Total foderkostnad", value: fmtMoney(feedCost, lang as any) },
                { label: ar?"متوسط سعر الكيلو":"Pris per kg",             value: costPerKg > 0 ? fmtMoney(costPerKg, lang as any) : "—" },
                { label: ar?"عدد مشتريات العلف":"Antal inköp",            value: data.feedAnalysis.entry_count },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-[10px] text-amber-700/70">{s.label}</span>
                  <span className="text-[11px] font-black text-amber-800 dark:text-amber-300">{s.value}</span>
                </div>
              ))}
              {feedRatio > 0 && (
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[9px] text-amber-700/60">{ar?"نسبة العلف من المصاريف":"Foder av totala kostnader"}</span>
                    <span className="text-[10px] font-black text-amber-800">{feedRatio.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-amber-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-amber-500 transition-all duration-700" style={{ width: `${Math.min(feedRatio, 100)}%` }} />
                  </div>
                  <p className="text-[9px] text-amber-600/70 mt-1">
                    {ar ? (feedRatio < 50 ? "✅ ممتاز — أقل من 50%" : feedRatio < 65 ? "✅ طبيعي — النطاق المثالي 50–65%" : feedRatio < 75 ? "⚠️ مرتفع — ينصح بمراجعة الكميات" : "❌ مرتفع جداً — راجع مصادر العلف")
                          : (feedRatio < 50 ? "✅ Utmärkt" : feedRatio < 65 ? "✅ Normalt" : feedRatio < 75 ? "⚠️ Högt" : "❌ Mycket högt")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Health Score */}
          <div className={cn("rounded-2xl border p-4 shadow-sm space-y-2",
            margin >= 20 ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/50" :
            margin >= 5  ? "bg-blue-50   dark:bg-blue-950/20   border-blue-200/50"    :
            margin >= 0  ? "bg-amber-50  dark:bg-amber-950/20  border-amber-200/50"   :
                           "bg-red-50    dark:bg-red-950/20    border-red-200/50"
          )}>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-muted-foreground">{ar ? "الصحة المالية" : "Finansiell hälsa"}</p>
              <ExplainTip
                titleAr="الصحة المالية" titleSv="Finansiell hälsa"
                textAr="تقييم سريع لوضع مزرعتك المالي بناءً على هامش الربح: ممتاز (>20%) ✅، جيد (5-20%)، مقبول (0-5%)، يحتاج مراجعة (خسارة ❌). هامش الربح هو النسبة المئوية للربح من الدخل."
                textSv="Snabb bedömning av gårdens ekonomiska hälsa baserat på vinstmarginal: Utmärkt (>20%), Bra (5–20%), Acceptabelt (0–5%), Behöver åtgärd (förlust)."
              />
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black">
                {margin >= 20 ? "🌟" : margin >= 5 ? "✅" : margin >= 0 ? "⚠️" : "❌"}
              </span>
              <div>
                <p className="text-sm font-black">
                  {margin >= 20 ? (ar?"ممتاز":"Utmärkt") : margin >= 5 ? (ar?"جيد":"Bra") : margin >= 0 ? (ar?"مقبول":"Acceptabelt") : (ar?"يحتاج مراجعة":"Behöver åtgärd")}
                </p>
                <p className="text-[10px] text-muted-foreground">{ar?"هامش الربح":"Vinstmarginal"}: {margin.toFixed(1)}%</p>
              </div>
            </div>
            {/* Score bar */}
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.max(0, Math.min(100, margin + 50))}%`,
                  background: margin >= 20 ? "linear-gradient(90deg,#10b981,#34d399)" :
                              margin >= 5  ? "linear-gradient(90deg,#3b82f6,#60a5fa)" :
                              margin >= 0  ? "linear-gradient(90deg,#f59e0b,#fcd34d)" :
                                            "linear-gradient(90deg,#ef4444,#f87171)",
                }} />
            </div>
          </div>

          {/* Top Records */}
          {(data.topIncome || data.topExpense) && (
            <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
              <p className="text-xs font-bold text-muted-foreground">{ar ? "أعلى القيم" : "Högsta värden"}</p>
              {data.topIncome && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 p-2.5 space-y-0.5">
                  <p className="text-[9px] text-emerald-600 font-bold">{ar?"🏆 أعلى دخل":"🏆 Högsta inkomst"}</p>
                  <p className="text-xs font-black text-emerald-700">{fmtMoney(Number(data.topIncome.amount), lang as any)}</p>
                  <p className="text-[9px] text-emerald-600/70 truncate">{data.topIncome.description}</p>
                  <p className="text-[9px] text-emerald-500/60">{fmtDate(data.topIncome.date)}</p>
                </div>
              )}
              {data.topExpense && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/20 p-2.5 space-y-0.5">
                  <p className="text-[9px] text-red-600 font-bold">{ar?"💸 أعلى مصروف":"💸 Högsta kostnad"}</p>
                  <p className="text-xs font-black text-red-700">{fmtMoney(Number(data.topExpense.amount), lang as any)}</p>
                  <p className="text-[9px] text-red-600/70 truncate">{data.topExpense.description}</p>
                  <p className="text-[9px] text-red-500/60">{fmtDate(data.topExpense.date)}</p>
                </div>
              )}
            </div>
          )}

          {/* Alert System */}
          <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                {ar ? "تنبيهات ذكية" : "Smarta varningar"}
              </p>
              <ExplainTip
                titleAr="التنبيهات الذكية" titleSv="Smarta varningar"
                textAr="تحذيرات تلقائية يولّدها النظام عند رصد مشكلة في البيانات مثل: نسبة علف عالية، خسارة مالية، أو غياب المبيعات. الألوان: 🔴 خطر يحتاج تدخل، 🟡 تحذير للمتابعة، 🟢 وضع جيد."
                textSv="Automatiska varningar när systemet ser ett problem: hög foderandel, ekonomisk förlust eller uteblivna intäkter. Röd = åtgärd krävs, Gul = bevaka, Grön = bra läge."
              />
            </div>
            {[
              { cond: feedRatio > 70,  msg: ar?"نسبة العلف عالية جداً (>70%)":"Foderandel > 70%",          color:"red"    },
              { cond: margin < 0,      msg: ar?"مزرعتك في خسارة الآن":"Gården är i förlust",                color:"red"    },
              { cond: margin >= 20,    msg: ar?"هامش ربح ممتاز (>20%)":"Utmärkt vinstmarginal",            color:"green"  },
              { cond: feedRatio>50&&feedRatio<=70, msg: ar?"نسبة العلف طبيعية":"Foderandel normal",         color:"green"  },
              { cond: Number(kpis.tx_count) === 0, msg: ar?"لا توجد معاملات بعد":"Inga transaktioner",     color:"amber"  },
              { cond: thisM.inc === 0 && thisM.exp > 0, msg: ar?"لا دخل هذا الشهر!":"Ingen inkomst i månaden!", color:"red" },
            ].filter(a => a.cond).slice(0, 4).map((a, i) => (
              <div key={i} className={cn(
                "flex items-start gap-1.5 text-[10px] rounded-lg px-2 py-1.5",
                a.color==="red"   ?"bg-red-50   text-red-700   dark:bg-red-950/30"  :
                a.color==="green" ?"bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30" :
                                   "bg-amber-50 text-amber-700 dark:bg-amber-950/30"
              )}>
                {a.color==="red" ? <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                                 : <CheckCircle2  className="w-3 h-3 mt-0.5 shrink-0" />}
                <span>{a.msg}</span>
              </div>
            ))}
            {[feedRatio > 70, margin < 0, margin >= 20, Number(kpis.tx_count) === 0].filter(Boolean).length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-2">
                {ar ? "الوضع جيد — لا تنبيهات" : "Allt OK — Inga varningar"}
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
