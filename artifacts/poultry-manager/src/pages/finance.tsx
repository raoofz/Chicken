/**
 * نظام إدارة مالية متكامل — Complete Financial Management System
 * Full bilingual (AR/SV) — Poultry Farm Finance
 */
import { useState, useMemo, useCallback } from "react";
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
  Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Plus, Trash2, Loader2,
  ArrowUpCircle, ArrowDownCircle, Filter, Brain, RefreshCw,
  Receipt, Search, Target, BarChart2, Activity, Wallet, Sparkles,
  ChevronDown, AlertTriangle, CheckCircle, Calendar, Award,
  FileText, ShieldAlert, ShieldCheck, Info,
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

type Period = "today" | "week" | "month" | "year" | "all";
type TabType = "overview" | "charts" | "transactions" | "reports" | "ai";
type FilterType = "all" | "income" | "expense";

interface Transaction {
  id: number; date: string; type: "income"|"expense"; category: string;
  description: string; amount: string; quantity: string|null;
  unit: string|null; notes: string|null; authorName: string|null; createdAt: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include", ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Error");
  return r.status === 204 ? null : r.json();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function calcHealthScore(income: number, expense: number, txCount: number): {
  score: number; grade: "excellent"|"good"|"fair"|"poor"; color: string; bgColor: string;
} {
  if (txCount === 0) return { score: 0, grade: "poor", color: "text-slate-400", bgColor: "from-slate-300 to-slate-400" };
  const margin = income > 0 ? ((income - expense) / income) * 100 : (income === 0 && expense === 0 ? 50 : 0);
  const clampedMargin = Math.max(0, Math.min(100, margin + 50));
  const score = Math.round(clampedMargin);
  if (score >= 75) return { score, grade: "excellent", color: "text-emerald-600", bgColor: "from-emerald-400 to-teal-500" };
  if (score >= 60) return { score, grade: "good", color: "text-blue-600", bgColor: "from-blue-400 to-indigo-500" };
  if (score >= 45) return { score, grade: "fair", color: "text-amber-600", bgColor: "from-amber-400 to-orange-500" };
  return { score, grade: "poor", color: "text-red-600", bgColor: "from-red-400 to-rose-500" };
}

// ─── Health Gauge (SVG) ───────────────────────────────────────────────────────
const GRADE_COLORS: Record<string, { start: string; end: string; text: string; badge: string }> = {
  excellent: { start: "#34d399", end: "#14b8a6", text: "#059669", badge: "bg-emerald-100 text-emerald-700" },
  good:      { start: "#60a5fa", end: "#6366f1", text: "#2563eb", badge: "bg-blue-100 text-blue-700" },
  fair:      { start: "#fbbf24", end: "#f97316", text: "#d97706", badge: "bg-amber-100 text-amber-700" },
  poor:      { start: "#f87171", end: "#fb7185", text: "#dc2626", badge: "bg-red-100 text-red-700" },
};

function HealthGauge({ score, grade }: { score: number; grade: string; color: string; bgColor: string }) {
  const { t } = useLanguage();
  const R = 56; const cx = 70; const cy = 70;
  const circumference = Math.PI * R;
  const dash = (score / 100) * circumference;
  const gc = GRADE_COLORS[grade] ?? GRADE_COLORS.poor;
  return (
    <div className="flex flex-col items-center gap-2">
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
          <path
            d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
            fill="none" stroke="url(#gaugeGradFin)" strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-3xl font-black" style={{ color: gc.text }}>{score}</span>
          <span className="text-[10px] text-muted-foreground">/100</span>
        </div>
      </div>
      <Badge className={cn("text-xs font-bold px-3 py-1", gc.badge)}>
        {t(`finance.health.${grade}`)}
      </Badge>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, gradient, trend }: {
  label: string; value: string; sub?: string; icon: any; gradient: string; trend?: "up"|"down"|"neutral";
}) {
  return (
    <Card className="border-none shadow-sm overflow-hidden">
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
          {trend === "up" && <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />}
          {trend === "down" && <TrendingDown className="w-4 h-4 text-red-500 shrink-0" />}
        </div>
      </CardContent>
    </Card>
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
        <Button className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-none shadow-md">
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
                    : "bg-muted text-muted-foreground border-transparent hover:border-slate-200"
                )}>
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
              <SelectTrigger>
                <SelectValue placeholder={t("finance.category")} />
              </SelectTrigger>
              <SelectContent>
                {cats.map(c => (
                  <SelectItem key={c} value={c}>
                    <span className="flex items-center gap-2">
                      <span>{CAT_ICONS[c]}</span>
                      {t(CAT_KEYS[c] ?? c)}
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

          <Button className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-none"
            onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <CheckCircle className="w-4 h-4 me-2" />}
            {t("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, lang }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 shadow-lg rounded-lg px-3 py-2 border text-xs">
      <p className="font-semibold mb-1 text-slate-600">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: {fmtAmount(p.value, lang)}</p>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Finance() {
  const { t, lang } = useLanguage();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [period, setPeriod] = useState<Period>("month");
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["transactions"],
    queryFn: () => apiFetch("/api/transactions"),
  });
  const { data: summary = [] } = useQuery<any[]>({
    queryKey: ["transactions-summary"],
    queryFn: () => apiFetch("/api/transactions/summary"),
  });

  const PERIODS: { key: Period; labelKey: string }[] = [
    { key: "today",  labelKey: "finance.period.today" },
    { key: "week",   labelKey: "finance.period.week" },
    { key: "month",  labelKey: "finance.period.month" },
    { key: "year",   labelKey: "finance.period.year" },
    { key: "all",    labelKey: "finance.period.all" },
  ];
  const TABS: { key: TabType; labelKey: string; icon: any }[] = [
    { key: "overview",      labelKey: "finance.tab.overview",      icon: Activity },
    { key: "charts",        labelKey: "finance.tab.charts",        icon: BarChart2 },
    { key: "transactions",  labelKey: "finance.tab.transactions",  icon: Receipt },
    { key: "reports",       labelKey: "finance.tab.reports",       icon: FileText },
    { key: "ai",            labelKey: "finance.tab.ai",            icon: Brain },
  ];

  // Filter by period
  const periodFiltered = useMemo(() => {
    const range = getPeriodRange(period);
    if (!range) return transactions;
    return transactions.filter(tr => tr.date >= range.start && tr.date <= range.end);
  }, [transactions, period]);

  // Totals
  const totalIncome  = useMemo(() => periodFiltered.filter(t => t.type === "income").reduce((s,t) => s + Number(t.amount), 0), [periodFiltered]);
  const totalExpense = useMemo(() => periodFiltered.filter(t => t.type === "expense").reduce((s,t) => s + Number(t.amount), 0), [periodFiltered]);
  const profit = totalIncome - totalExpense;
  const marginPct = totalIncome > 0 ? ((profit / totalIncome) * 100).toFixed(1) : "—";
  const avgDaily = useMemo(() => {
    const days = period === "today" ? 1 : period === "week" ? 7 : period === "month" ? 30 : period === "year" ? 365 : 30;
    return totalIncome / days;
  }, [totalIncome, period]);

  // Health score
  const health = useMemo(() => calcHealthScore(totalIncome, totalExpense, periodFiltered.length), [totalIncome, totalExpense, periodFiltered.length]);

  // Monthly data for charts
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

  // Category donut data
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

  // Filtered transactions (search + type)
  const filteredTx = useMemo(() => {
    let arr = filter === "all" ? periodFiltered : periodFiltered.filter(t => t.type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(t =>
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        String(t.amount).includes(q)
      );
    }
    return arr;
  }, [periodFiltered, filter, search]);

  // Best / worst month
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

  const runAiAnalysis = useCallback(async () => {
    if (periodFiltered.length === 0) return;
    setAiLoading(true);
    try {
      const catBreakdown: Record<string,{ income:number; expense:number }> = {};
      periodFiltered.forEach(tr => {
        if (!catBreakdown[tr.category]) catBreakdown[tr.category] = { income: 0, expense: 0 };
        catBreakdown[tr.category][tr.type] += Number(tr.amount);
      });

      const isAr = lang === "ar";
      const prompt = isAr
        ? `أنت مستشار مالي خبير لمزرعة دواجن في الموصل، العراق. حلل هذه البيانات المالية بعمق:
— إجمالي الدخل: ${fmtAmount(totalIncome, "ar")}
— إجمالي المصاريف: ${fmtAmount(totalExpense, "ar")}
— صافي الربح/الخسارة: ${fmtAmount(profit, "ar")} (${marginPct}%)
— عدد المعاملات: ${periodFiltered.length}
— تفصيل الفئات: ${JSON.stringify(catBreakdown)}
— درجة الصحة المالية: ${health.score}/100

قدّم تحليلاً مالياً احترافياً شاملاً بالنقاط يتضمن:
١. تشخيص الوضع المالي الحالي ونقاط القوة والضعف
٢. أكبر بنود المصاريف وكيفية تخفيضها بشكل عملي
٣. فرص زيادة الدخل وتوسيع مصادر الإيراد
٤. توصيات استراتيجية محددة لتحسين الربحية
٥. مؤشرات الأداء التي يجب متابعتها أسبوعياً
اجعل التوصيات قابلة للتطبيق فوراً في مزرعة دواجن عراقية صغيرة.`
        : `You are an expert financial advisor for a poultry farm in Mosul, Iraq. Analyze this financial data in depth:
— Total income: ${fmtAmount(totalIncome, "sv")}
— Total expenses: ${fmtAmount(totalExpense, "sv")}
— Net profit/loss: ${fmtAmount(profit, "sv")} (${marginPct}%)
— Transactions: ${periodFiltered.length}
— Category breakdown: ${JSON.stringify(catBreakdown)}
— Financial health score: ${health.score}/100

Provide a comprehensive professional financial analysis including:
1. Current financial status diagnosis — strengths and weaknesses
2. Top expense categories and practical ways to reduce them
3. Income growth opportunities and revenue diversification
4. Strategic recommendations to improve profitability
5. Weekly KPIs to monitor
Make recommendations immediately actionable for a small Iraqi poultry farm.`;

      const r = await fetch(`${BASE}/api/ai/analyze`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, context: "financial" }),
      });

      if (r.ok) {
        const d = await r.json();
        setAiAnalysis(d.analysis ?? d.result ?? d.text ?? "");
      } else {
        // Smart bilingual local fallback
        const isAr = lang === "ar";
        const topExpCat = expenseByCat[0];
        const topIncCat = incomeByCat[0];
        const lines = isAr ? [
          `## 📊 ${t("finance.ai.analyze")}`,
          ``,
          `### 💰 الملخص المالي`,
          `- **الدخل:** ${fmtAmount(totalIncome, "ar")}`,
          `- **المصاريف:** ${fmtAmount(totalExpense, "ar")}`,
          `- **الربح:** ${fmtAmount(profit, "ar")} ${profit >= 0 ? "✅" : "❌"}`,
          `- **هامش الربح:** ${marginPct}%`,
          `- **درجة الصحة:** ${health.score}/100 — ${t(`finance.health.${health.grade}`)}`,
          ``,
          `### 🔍 التشخيص`,
          profit < 0
            ? `- ⚠️ المزرعة تعمل بخسارة — راجع بنود المصاريف بشكل عاجل`
            : profit > totalIncome * 0.2
            ? `- ✅ المزرعة تحقق هامش ربح ممتاز يتجاوز 20%`
            : `- ℹ️ المزرعة تحقق ربحاً معقولاً — يمكن تحسينه`,
          topExpCat ? `- 💸 أعلى بند مصروف: **${topExpCat.name}** (${fmtAmount(topExpCat.value, "ar")})` : "",
          topIncCat ? `- 📈 أعلى مصدر دخل: **${topIncCat.name}** (${fmtAmount(topIncCat.value, "ar")})` : "",
          ``,
          `### 💡 التوصيات`,
          `- سجّل جميع المعاملات يومياً لدقة التحليل`,
          `- راجع أسعار العلف والأدوية دورياً للحصول على أفضل سعر`,
          totalExpense > totalIncome * 0.8 ? `- ⚠️ المصاريف مرتفعة — ابحث عن فرص توفير في ${topExpCat?.name ?? "المصاريف"}` : "",
          `- تابع مؤشرات الأداء أسبوعياً: الدخل اليومي، نسبة الوفيات، تكلفة الكيلو`,
        ] : [
          `## 📊 Farm Financial Analysis`,
          ``,
          `### 💰 Financial Summary`,
          `- **Income:** ${fmtAmount(totalIncome, "sv")}`,
          `- **Expenses:** ${fmtAmount(totalExpense, "sv")}`,
          `- **Profit:** ${fmtAmount(profit, "sv")} ${profit >= 0 ? "✅" : "❌"}`,
          `- **Margin:** ${marginPct}%`,
          `- **Health Score:** ${health.score}/100 — ${t(`finance.health.${health.grade}`)}`,
          ``,
          `### 🔍 Diagnosis`,
          profit < 0
            ? `- ⚠️ Farm is operating at a loss — urgently review expense categories`
            : profit > totalIncome * 0.2
            ? `- ✅ Farm achieves excellent profit margin exceeding 20%`
            : `- ℹ️ Farm generates reasonable profit — can be improved`,
          topExpCat ? `- 💸 Top expense: **${topExpCat.name}** (${fmtAmount(topExpCat.value, "sv")})` : "",
          topIncCat ? `- 📈 Top income source: **${topIncCat.name}** (${fmtAmount(topIncCat.value, "sv")})` : "",
          ``,
          `### 💡 Recommendations`,
          `- Record all transactions daily for accurate analysis`,
          `- Review feed and medicine prices regularly for best deals`,
          totalExpense > totalIncome * 0.8 ? `- ⚠️ Expenses are high — find savings opportunities in ${topExpCat?.name ?? "expenses"}` : "",
          `- Monitor weekly KPIs: daily income, mortality rate, cost per kg`,
        ];
        setAiAnalysis(lines.filter(l => l !== "").join("\n"));
      }
    } catch {
      toast({ variant: "destructive", title: t("finance.ai.error") });
    } finally { setAiLoading(false); }
  }, [periodFiltered, lang, totalIncome, totalExpense, profit, marginPct, health, expenseByCat, incomeByCat, t, toast]);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["transactions-summary"] });
  }, [qc]);

  const isRtl = lang === "ar";

  return (
    <div className="flex flex-col gap-4 pb-6 animate-in fade-in duration-300">

      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t("finance.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("finance.desc")}</p>
          </div>
        </div>
        <AddTransactionDialog onSuccess={invalidate} />
      </div>

      {/* ─── Period Selector ────────────────────────────── */}
      <div className="flex gap-1.5 p-1 bg-muted/60 rounded-xl overflow-x-auto">
        {PERIODS.map(({ key, labelKey }) => (
          <button key={key} onClick={() => setPeriod(key)}
            className={cn(
              "flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
              period === key
                ? "bg-white dark:bg-slate-800 shadow-sm text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground hover:text-foreground"
            )}>
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* ─── KPI Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label={t("finance.income")} value={fmtAmount(totalIncome, lang)}
          sub={`${periodFiltered.filter(t=>t.type==="income").length} ${t("finance.tx.count")}`}
          icon={ArrowUpCircle} gradient="from-emerald-400 to-teal-500" trend="up" />
        <KpiCard label={t("finance.expense")} value={fmtAmount(totalExpense, lang)}
          sub={`${periodFiltered.filter(t=>t.type==="expense").length} ${t("finance.tx.count")}`}
          icon={ArrowDownCircle} gradient="from-red-400 to-rose-500" trend="down" />
        <KpiCard
          label={t("finance.profit")}
          value={`${profit >= 0 ? "+" : ""}${fmtAmount(profit, lang)}`}
          sub={`${t("finance.margin.pct")}: ${marginPct}%`}
          icon={profit >= 0 ? TrendingUp : TrendingDown}
          gradient={profit >= 0 ? "from-blue-400 to-indigo-500" : "from-orange-400 to-red-500"}
          trend={profit >= 0 ? "up" : "down"}
        />
        <KpiCard label={t("finance.transactions.count")} value={String(periodFiltered.length)}
          sub={`${t("finance.avg.daily")}: ${fmtAmount(avgDaily, lang)}`}
          icon={Receipt} gradient="from-purple-400 to-violet-500" />
      </div>

      {/* ─── Tab Navigation ─────────────────────────────── */}
      <div className="flex gap-0 border-b border-border overflow-x-auto">
        {TABS.map(({ key, labelKey, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap",
              activeTab === key
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            <Icon className="w-3.5 h-3.5" />
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* ─── OVERVIEW TAB ───────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {periodFiltered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-14 text-center">
                <DollarSign className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">{t("finance.empty")}</p>
                <p className="text-muted-foreground/60 text-xs mt-1">{t("finance.empty.desc")}</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Health Score + Profit Indicator */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-none shadow-sm overflow-hidden">
                  <div className={cn("h-1 bg-gradient-to-r", health.bgColor)} />
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      {t("finance.health.score")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <HealthGauge {...health} />
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">{t("finance.income")}</p>
                        <p className="text-sm font-bold text-emerald-600">{fmtAmount(totalIncome, lang)}</p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">{t("finance.expense")}</p>
                        <p className="text-sm font-bold text-red-600">{fmtAmount(totalExpense, lang)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Profit breakdown bar */}
                <Card className="border-none shadow-sm overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-500" />
                      {t("finance.profit.breakdown")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pb-4">
                    {/* Income bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1"><ArrowUpCircle className="w-3 h-3 text-emerald-500"/>{t("finance.type.income")}</span>
                        <span className="font-semibold text-emerald-600">{fmtAmount(totalIncome, lang)}</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-700"
                          style={{ width: totalIncome > 0 ? "100%" : "0%" }} />
                      </div>
                    </div>
                    {/* Expense bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1"><ArrowDownCircle className="w-3 h-3 text-red-500"/>{t("finance.type.expense")}</span>
                        <span className="font-semibold text-red-600">{fmtAmount(totalExpense, lang)}</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-red-400 to-rose-500 rounded-full transition-all duration-700"
                          style={{ width: totalIncome > 0 ? `${Math.min(100, (totalExpense/totalIncome)*100)}%` : totalExpense > 0 ? "100%" : "0%" }} />
                      </div>
                    </div>
                    {/* Profit */}
                    <div className={cn("rounded-xl p-3 flex items-center justify-between",
                      profit >= 0 ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-red-50 dark:bg-red-950/20")}>
                      <span className={cn("text-sm font-bold", profit >= 0 ? "text-emerald-700" : "text-red-700")}>
                        {profit >= 0 ? "✅ " : "❌ "}{t("finance.profit")}
                      </span>
                      <span className={cn("text-sm font-black", profit >= 0 ? "text-emerald-700" : "text-red-700")}>
                        {profit >= 0 ? "+" : ""}{fmtAmount(profit, lang)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">{t("finance.margin.pct")}: <strong>{marginPct}%</strong></p>
                  </CardContent>
                </Card>
              </div>

              {/* Top Categories */}
              {expenseByCat.length > 0 && (
                <Card className="border-none shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ChevronDown className="w-4 h-4 text-red-500" />
                      {t("finance.top.expenses")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2.5 pb-4">
                    {expenseByCat.slice(0, 5).map((cat, i) => {
                      const pct = totalExpense > 0 ? (cat.value / totalExpense) * 100 : 0;
                      return (
                        <div key={cat.cat} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{cat.name}</span>
                            <span className="font-semibold">{fmtAmount(cat.value, lang)} <span className="text-muted-foreground">({pct.toFixed(0)}%)</span></span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: COLORS_EXPENSE[i % COLORS_EXPENSE.length] }} />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Best / Worst Month */}
              {bestMonth && (
                <div className="grid grid-cols-2 gap-3">
                  <Card className="border-none shadow-sm bg-emerald-50 dark:bg-emerald-950/20">
                    <CardContent className="p-3 text-center">
                      <p className="text-[10px] text-muted-foreground mb-0.5">{t("finance.best.month")}</p>
                      <p className="text-xs font-bold text-emerald-700">{bestMonth.month}</p>
                      <p className="text-sm font-black text-emerald-600">+{fmtAmount(bestMonth.profit, lang)}</p>
                    </CardContent>
                  </Card>
                  {worstMonth && worstMonth.month !== bestMonth.month && (
                    <Card className="border-none shadow-sm bg-red-50 dark:bg-red-950/20">
                      <CardContent className="p-3 text-center">
                        <p className="text-[10px] text-muted-foreground mb-0.5">{t("finance.worst.month")}</p>
                        <p className="text-xs font-bold text-red-700">{worstMonth.month}</p>
                        <p className="text-sm font-black text-red-600">{fmtAmount(worstMonth.profit, lang)}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── CHARTS TAB ─────────────────────────────────── */}
      {activeTab === "charts" && (
        <div className="space-y-4">
          {monthlyData.length < 1 ? (
            <Card className="border-dashed">
              <CardContent className="py-14 text-center">
                <BarChart2 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">{t("finance.chart.nodata")}</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Monthly Bar Chart */}
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-0">
                  <CardTitle className="text-sm">{t("finance.chart.monthly")}</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip lang={lang} />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="income" name={t("finance.type.income")} fill="#10b981" radius={[4,4,0,0]} />
                      <Bar dataKey="expense" name={t("finance.type.expense")} fill="#ef4444" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Profit Trend Line */}
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-0">
                  <CardTitle className="text-sm">{t("finance.chart.trend")}</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip lang={lang} />} />
                      <Area type="monotone" dataKey="profit" name={t("finance.profit")}
                        stroke="#3b82f6" fill="url(#profitGrad)" strokeWidth={2.5} dot={{ r: 3, fill: "#3b82f6" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Expense & Income Donuts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {expenseByCat.length > 0 && (
                  <Card className="border-none shadow-sm">
                    <CardHeader className="pb-0">
                      <CardTitle className="text-sm">{t("finance.chart.expense.breakdown")}</CardTitle>
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
                          <Tooltip formatter={(v: any) => fmtAmount(Number(v), lang)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                        {expenseByCat.slice(0,4).map((c,i) => (
                          <span key={c.cat} className="text-[9px] flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS_EXPENSE[i%COLORS_EXPENSE.length] }} />
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
                      <CardTitle className="text-sm">{t("finance.chart.income.breakdown")}</CardTitle>
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
                          <Tooltip formatter={(v: any) => fmtAmount(Number(v), lang)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                        {incomeByCat.map((c,i) => (
                          <span key={c.cat} className="text-[9px] flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS_INCOME[i%COLORS_INCOME.length] }} />
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

      {/* ─── TRANSACTIONS TAB ───────────────────────────── */}
      {activeTab === "transactions" && (
        <div className="space-y-3">
          {/* Search + Filter */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder={t("finance.search.placeholder")} value={search}
                onChange={e => setSearch(e.target.value)}
                className="ps-8 h-8 text-xs" />
            </div>
            <div className="flex gap-1">
              {(["all","income","expense"] as const).map(f => (
                <Button key={f} size="sm" variant={filter === f ? "default" : "ghost"}
                  onClick={() => setFilter(f)} className="h-8 text-xs px-2.5">
                  {t(`finance.filter.${f}`)}
                </Button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : filteredTx.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <Receipt className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{search ? t("finance.no.results") : t("finance.empty")}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-none shadow-sm">
              <div className="divide-y divide-border/50">
                {filteredTx.map(tr => (
                  <div key={tr.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base",
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
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />{tr.date}
                        </span>
                        {tr.authorName && (
                          <span className="text-[10px] text-muted-foreground opacity-60">{tr.authorName}</span>
                        )}
                        {tr.quantity && tr.unit && (
                          <span className="text-[10px] text-muted-foreground">{tr.quantity} {tr.unit}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn("text-sm font-bold",
                        tr.type === "income" ? "text-emerald-600" : "text-red-600")}>
                        {tr.type === "income" ? "+" : "-"}{fmtAmount(Number(tr.amount), lang)}
                      </span>
                      {isAdmin && (
                        <Button variant="ghost" size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-600"
                          onClick={() => handleDelete(tr.id)}
                          disabled={deletingId === tr.id}>
                          {deletingId === tr.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
                <span>{filteredTx.length} {t("finance.tx.shown")}</span>
                <span className="font-semibold">{t("finance.tx.net")}: <span className={profit >= 0 ? "text-emerald-600" : "text-red-600"}>{fmtAmount(profit, lang)}</span></span>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ─── REPORTS TAB ────────────────────────────────── */}
      {activeTab === "reports" && (() => {
        // ── Compute report data ──────────────────────────────
        const allIncome = periodFiltered.filter(t => t.type === "income");
        const allExpense = periodFiltered.filter(t => t.type === "expense");
        const grossProfit = totalIncome - totalExpense;
        const marginNum = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0;

        // Expense breakdown by category with amounts + percentages
        const expBreakdown = CATEGORIES_EXPENSE.map(cat => {
          const amt = allExpense.filter(t => t.category === cat).reduce((s,t) => s+Number(t.amount), 0);
          return { cat, name: CAT_ICONS[cat] + " " + (lang === "ar" ? {
            feed:"علف", medicine:"دواء", equipment:"معدات", electricity:"كهرباء",
            labor:"عمالة", maintenance:"صيانة", other:"أخرى"
          }[cat] : {
            feed:"Foder", medicine:"Medicin", equipment:"Utrustning", electricity:"El",
            labor:"Arbete", maintenance:"Underhåll", other:"Övrigt"
          }[cat] ?? cat), amt };
        }).filter(x => x.amt > 0).sort((a,b) => b.amt - a.amt);

        // Income breakdown by category
        const incBreakdown = CATEGORIES_INCOME.map(cat => {
          const amt = allIncome.filter(t => t.category === cat).reduce((s,t) => s+Number(t.amount), 0);
          return { cat, name: CAT_ICONS[cat] + " " + (lang === "ar" ? {
            chick_sale:"بيع كتاكيت", egg_sale:"بيع بيض", other:"أخرى"
          }[cat] : {
            chick_sale:"Kycklingförsäljning", egg_sale:"Äggförsäljning", other:"Övrigt"
          }[cat] ?? cat), amt };
        }).filter(x => x.amt > 0).sort((a,b) => b.amt - a.amt);

        // Financial Alerts — rule-based intelligence
        type AlertLevel = "critical" | "warning" | "good" | "info";
        interface FinAlert { level: AlertLevel; titleAr: string; titleSv: string; msgAr: string; msgSv: string; }
        const alerts: FinAlert[] = [];

        if (periodFiltered.length === 0) {
          alerts.push({ level: "info",
            titleAr: "لا توجد بيانات", titleSv: "Ingen data",
            msgAr: "لا توجد معاملات في الفترة المحددة. أضف معاملاتك لرؤية التحليل.",
            msgSv: "Inga transaktioner i vald period. Lägg till transaktioner för analys." });
        } else {
          if (totalIncome === 0 && totalExpense > 0) {
            alerts.push({ level: "critical",
              titleAr: "⚠️ لا دخل مسجّل", titleSv: "⚠️ Ingen registrerad inkomst",
              msgAr: `مصاريف ${fmtAmount(totalExpense, lang)} بدون أي دخل مسجّل في هذه الفترة. سجّل مبيعاتك فوراً.`,
              msgSv: `Kostnader på ${fmtAmount(totalExpense, lang)} utan registrerade intäkter. Lägg in försäljning omgående.` });
          } else if (grossProfit < 0) {
            alerts.push({ level: "critical",
              titleAr: "خسارة صافية مرصودة", titleSv: "Nettoförlust detekterad",
              msgAr: `الخسارة الحالية: ${fmtAmount(Math.abs(grossProfit), lang)}. المصاريف تتجاوز الدخل بنسبة ${Math.abs(marginNum).toFixed(0)}%.`,
              msgSv: `Aktuell förlust: ${fmtAmount(Math.abs(grossProfit), lang)}. Kostnader överstiger intäkter med ${Math.abs(marginNum).toFixed(0)}%.` });
          } else if (marginNum < 10 && totalIncome > 0) {
            alerts.push({ level: "warning",
              titleAr: "هامش ربح منخفض", titleSv: "Låg vinstmarginal",
              msgAr: `هامش الربح ${marginNum.toFixed(1)}% أقل من المستوى الموصى به (20%+). راجع التكاليف.`,
              msgSv: `Vinstmarginal ${marginNum.toFixed(1)}% är under rekommenderad nivå (20%+). Se över kostnaderna.` });
          } else if (marginNum >= 20) {
            alerts.push({ level: "good",
              titleAr: "هامش ربح ممتاز", titleSv: "Utmärkt vinstmarginal",
              msgAr: `هامش الربح ${marginNum.toFixed(1)}% يتجاوز الهدف المثالي 20%. أداء مالي ممتاز!`,
              msgSv: `Vinstmarginal ${marginNum.toFixed(1)}% överstiger målnivån 20%. Utmärkt ekonomisk prestanda!` });
          }

          // High single-category expense warning
          if (expBreakdown.length > 0 && totalExpense > 0) {
            const top = expBreakdown[0];
            const pct = (top.amt / totalExpense) * 100;
            if (pct > 60) {
              alerts.push({ level: "warning",
                titleAr: `تركّز المصاريف في فئة واحدة`, titleSv: `Kostnadskoncentration`,
                msgAr: `${top.name} يمثّل ${pct.toFixed(0)}% من إجمالي المصاريف. تنويع التكاليف يقلّل المخاطر.`,
                msgSv: `${top.name} utgör ${pct.toFixed(0)}% av totala kostnader. Diversifiera för att minska risken.` });
            }
          }

          // ROI check: good if income > 1.5× expense
          if (totalExpense > 0 && totalIncome > 0) {
            const roi = ((totalIncome - totalExpense) / totalExpense) * 100;
            if (roi >= 50) {
              alerts.push({ level: "good",
                titleAr: "عائد استثماري عالٍ", titleSv: "Hög avkastning",
                msgAr: `عائد الاستثمار ${roi.toFixed(0)}% — كل دينار مستثمر ينتج ${(roi/100).toFixed(1)} دينار ربح صافي.`,
                msgSv: `ROI ${roi.toFixed(0)}% — varje investerad krona ger ${(roi/100).toFixed(1)} IQD nettovinst.` });
            } else if (roi < 5 && roi >= 0) {
              alerts.push({ level: "info",
                titleAr: "عائد استثماري ضعيف", titleSv: "Låg avkastning",
                msgAr: `عائد الاستثمار ${roi.toFixed(1)}% فقط. حسّن الكفاءة أو زد المبيعات لتحقيق ربحية أفضل.`,
                msgSv: `ROI på ${roi.toFixed(1)}%. Förbättra effektiviteten eller öka försäljningen för bättre lönsamhet.` });
            }
          }

          // High labor cost
          const laborAmt = allExpense.filter(t => t.category === "labor").reduce((s,t) => s+Number(t.amount), 0);
          if (totalExpense > 0 && laborAmt / totalExpense > 0.4) {
            alerts.push({ level: "info",
              titleAr: "تكلفة العمالة مرتفعة", titleSv: "Höga arbetskraftskostnader",
              msgAr: `العمالة تمثّل ${((laborAmt/totalExpense)*100).toFixed(0)}% من المصاريف. راجع جدولة العمل.`,
              msgSv: `Arbete utgör ${((laborAmt/totalExpense)*100).toFixed(0)}% av kostnaderna. Se över arbetsplaneringen.` });
          }
        }

        const alertCfg = {
          critical: { bg: "bg-red-50 dark:bg-red-950/20", border: "border-red-300 dark:border-red-800", dot: "bg-red-500", icon: ShieldAlert, iconColor: "text-red-500" },
          warning:  { bg: "bg-amber-50 dark:bg-amber-950/20", border: "border-amber-300 dark:border-amber-800", dot: "bg-amber-500", icon: AlertTriangle, iconColor: "text-amber-500" },
          good:     { bg: "bg-emerald-50 dark:bg-emerald-950/20", border: "border-emerald-300 dark:border-emerald-800", dot: "bg-emerald-500", icon: ShieldCheck, iconColor: "text-emerald-500" },
          info:     { bg: "bg-blue-50 dark:bg-blue-950/20", border: "border-blue-300 dark:border-blue-800", dot: "bg-blue-500", icon: Info, iconColor: "text-blue-500" },
        };

        return (
          <div className="space-y-5">

            {/* ── Report Header ─────────────────────────────── */}
            <Card className="border-none shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{lang === "ar" ? "تقرير الأداء المالي" : "Finansiell prestationsrapport"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {lang === "ar" ? "تحليل شامل ← قائمة الأرباح والخسائر ← التنبيهات" : "Fullständig analys ← P&L-rapport ← Varningar"}
                    </p>
                  </div>
                </div>

                {/* P&L Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-3 text-center">
                    <ArrowUpCircle className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                    <p className="text-[10px] text-muted-foreground mb-0.5">{lang === "ar" ? "إجمالي الدخل" : "Total inkomst"}</p>
                    <p className="text-sm font-black text-emerald-700 dark:text-emerald-400">{fmtAmount(totalIncome, lang)}</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-3 text-center">
                    <ArrowDownCircle className="w-4 h-4 text-red-500 mx-auto mb-1" />
                    <p className="text-[10px] text-muted-foreground mb-0.5">{lang === "ar" ? "إجمالي المصاريف" : "Totala kostnader"}</p>
                    <p className="text-sm font-black text-red-700 dark:text-red-400">{fmtAmount(totalExpense, lang)}</p>
                  </div>
                  <div className={cn("rounded-xl p-3 text-center", grossProfit >= 0 ? "bg-blue-50 dark:bg-blue-950/20" : "bg-orange-50 dark:bg-orange-950/20")}>
                    <DollarSign className={cn("w-4 h-4 mx-auto mb-1", grossProfit >= 0 ? "text-blue-500" : "text-orange-500")} />
                    <p className="text-[10px] text-muted-foreground mb-0.5">{lang === "ar" ? "صافي الربح" : "Nettovinst"}</p>
                    <p className={cn("text-sm font-black", grossProfit >= 0 ? "text-blue-700 dark:text-blue-400" : "text-orange-700 dark:text-orange-400")}>
                      {grossProfit >= 0 ? "+" : ""}{fmtAmount(Math.abs(grossProfit), lang)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Financial Alerts ──────────────────────────── */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                {lang === "ar" ? "التنبيهات المالية الذكية" : "Smarta finansiella varningar"}
              </h3>
              <div className="space-y-2">
                {alerts.map((a, i) => {
                  const cfg = alertCfg[a.level];
                  const Icon = cfg.icon;
                  return (
                    <div key={i} className={cn("rounded-xl border p-3.5 flex items-start gap-3", cfg.bg, cfg.border)}>
                      <Icon className={cn("w-4 h-4 flex-shrink-0 mt-0.5", cfg.iconColor)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground mb-0.5">{lang === "ar" ? a.titleAr : a.titleSv}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{lang === "ar" ? a.msgAr : a.msgSv}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── P&L Breakdown ─────────────────────────────── */}
            {(incBreakdown.length > 0 || expBreakdown.length > 0) && (
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    {lang === "ar" ? "قائمة الأرباح والخسائر التفصيلية" : "Detaljerad resultaträkning (P&L)"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4 space-y-4">
                  {/* Income sources */}
                  {incBreakdown.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        {lang === "ar" ? "مصادر الدخل" : "Inkomstkällor"}
                      </p>
                      <div className="space-y-2">
                        {incBreakdown.map((item, i) => {
                          const pct = totalIncome > 0 ? (item.amt / totalIncome) * 100 : 0;
                          return (
                            <div key={item.cat}>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-muted-foreground">{item.name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground">({pct.toFixed(0)}%)</span>
                                  <span className="font-semibold text-emerald-700">{fmtAmount(item.amt, lang)}</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50 mt-2">
                          <span className="font-semibold">{lang === "ar" ? "الإجمالي" : "Totalt"}</span>
                          <span className="font-black text-emerald-700">{fmtAmount(totalIncome, lang)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Expense breakdown */}
                  {expBreakdown.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                        {lang === "ar" ? "تفصيل المصاريف" : "Kostnadsfördelning"}
                      </p>
                      <div className="space-y-2">
                        {expBreakdown.map((item, i) => {
                          const pct = totalExpense > 0 ? (item.amt / totalExpense) * 100 : 0;
                          return (
                            <div key={item.cat}>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-muted-foreground">{item.name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground">({pct.toFixed(0)}%)</span>
                                  <span className="font-semibold text-red-700">{fmtAmount(item.amt, lang)}</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: COLORS_EXPENSE[i % COLORS_EXPENSE.length] }} />
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50 mt-2">
                          <span className="font-semibold">{lang === "ar" ? "الإجمالي" : "Totalt"}</span>
                          <span className="font-black text-red-700">{fmtAmount(totalExpense, lang)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Net result row */}
                  <div className={cn("rounded-xl p-3 flex items-center justify-between", grossProfit >= 0 ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-red-50 dark:bg-red-950/20")}>
                    <span className="text-xs font-bold">{lang === "ar" ? "صافي النتيجة" : "Nettoresultat"}</span>
                    <span className={cn("text-sm font-black", grossProfit >= 0 ? "text-emerald-700" : "text-red-700")}>
                      {grossProfit >= 0 ? "+" : ""}{fmtAmount(Math.abs(grossProfit), lang)}
                      <span className="text-[10px] font-medium ms-1 opacity-70">({marginNum.toFixed(1)}%)</span>
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Cost Efficiency Metrics ────────────────────── */}
            {totalExpense > 0 && (
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    {lang === "ar" ? "مؤشرات كفاءة التكلفة" : "Kostnadseffektivitetsmått"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        label: lang === "ar" ? "نسبة المصاريف/الدخل" : "Kostnader/inkomst",
                        val: totalIncome > 0 ? `${((totalExpense/totalIncome)*100).toFixed(1)}%` : "—",
                        sub: lang === "ar" ? "الأفضل: أقل من 80%" : "Optimalt: under 80%",
                        color: totalIncome > 0 && (totalExpense/totalIncome) < 0.8 ? "text-emerald-600" : "text-red-600",
                      },
                      {
                        label: lang === "ar" ? "عائد الاستثمار (ROI)" : "Avkastning (ROI)",
                        val: totalExpense > 0 && totalIncome > 0 ? `${(((totalIncome-totalExpense)/totalExpense)*100).toFixed(1)}%` : "—",
                        sub: lang === "ar" ? "الأفضل: أكثر من 20%" : "Optimalt: över 20%",
                        color: totalExpense > 0 && totalIncome > 0 && (totalIncome-totalExpense)/totalExpense >= 0.2 ? "text-emerald-600" : "text-amber-600",
                      },
                      {
                        label: lang === "ar" ? "متوسط المصاريف/يوم" : "Snittkostad/dag",
                        val: fmtAmount(totalExpense / (period === "today" ? 1 : period === "week" ? 7 : period === "month" ? 30 : period === "year" ? 365 : Math.max(1, transactions.length)), lang),
                        sub: lang === "ar" ? "للفترة المحددة" : "Under vald period",
                        color: "text-blue-600",
                      },
                      {
                        label: lang === "ar" ? "درجة الصحة المالية" : "Finansiell hälsa",
                        val: `${health.score}/100`,
                        sub: lang === "ar" ? { excellent:"ممتاز", good:"جيد", fair:"مقبول", poor:"ضعيف" }[health.grade] : { excellent:"Utmärkt", good:"Bra", fair:"Godkänt", poor:"Svagt" }[health.grade],
                        color: health.color,
                      },
                    ].map((m, i) => (
                      <div key={i} className="bg-muted/30 rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground mb-1">{m.label}</p>
                        <p className={cn("text-lg font-black", m.color)}>{m.val}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">{m.sub}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Empty state ────────────────────────────────── */}
            {periodFiltered.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="py-14 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {lang === "ar" ? "أضف معاملات لرؤية التقارير المالية التفصيلية" : "Lägg till transaktioner för detaljerade finansiella rapporter"}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        );
      })()}

      {/* ─── AI ANALYSIS TAB ────────────────────────────── */}
      {activeTab === "ai" && (
        <div className="space-y-4">
          <Card className="border-none shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm">
                    <Brain className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{t("finance.ai.analyze")}</p>
                    <p className="text-[10px] text-muted-foreground">{t("finance.ai.hint")}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={runAiAnalysis}
                  disabled={aiLoading || periodFiltered.length === 0}
                  className="h-8 text-xs gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50">
                  {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {aiLoading ? t("finance.ai.analyzing") : t("finance.ai.run")}
                </Button>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-purple-50 dark:bg-purple-950/20 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">{t("finance.health.score")}</p>
                  <p className={cn("text-xl font-black mt-0.5", health.color)}>{health.score}</p>
                  <p className="text-[9px] text-muted-foreground">/100</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">{t("finance.margin.pct")}</p>
                  <p className={cn("text-xl font-black mt-0.5", Number(marginPct) >= 0 ? "text-blue-600" : "text-red-600")}>{marginPct}%</p>
                  <p className="text-[9px] text-muted-foreground">{t("finance.net.margin")}</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">{t("finance.transactions.count")}</p>
                  <p className="text-xl font-black mt-0.5 text-emerald-600">{periodFiltered.length}</p>
                  <p className="text-[9px] text-muted-foreground">{t("finance.tx.total")}</p>
                </div>
              </div>

              {aiAnalysis ? (
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 rounded-xl p-4 text-xs leading-relaxed whitespace-pre-wrap border border-purple-100 dark:border-purple-800/30 text-slate-700 dark:text-slate-300">
                  {aiAnalysis}
                </div>
              ) : !aiLoading && (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                    <Brain className="w-8 h-8 text-purple-400" />
                  </div>
                  <p className="text-sm text-muted-foreground max-w-xs">{t("finance.ai.empty.hint")}</p>
                  {periodFiltered.length === 0 && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      {t("finance.ai.no.data")}
                    </Badge>
                  )}
                </div>
              )}
              {aiLoading && (
                <div className="flex items-center gap-3 py-6 justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                  <p className="text-sm text-muted-foreground">{t("finance.ai.analyzing")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
