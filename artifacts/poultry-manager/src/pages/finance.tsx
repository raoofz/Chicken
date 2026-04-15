import { useState, useMemo } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Plus, Trash2, Edit3, Loader2,
  ArrowUpCircle, ArrowDownCircle, Filter, BarChart2, PieChart as PieIcon,
  Brain, RefreshCw, Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES_EXPENSE = ["feed", "medicine", "equipment", "electricity", "labor", "maintenance", "other"];
const CATEGORIES_INCOME  = ["chick_sale", "egg_sale", "other"];
const COLORS = ["#f59e0b","#10b981","#3b82f6","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316"];

const CAT_KEYS: Record<string, string> = {
  feed: "finance.cat.feed", medicine: "finance.cat.medicine", chick_sale: "finance.cat.chick_sale",
  egg_sale: "finance.cat.egg_sale", equipment: "finance.cat.equipment", electricity: "finance.cat.electricity",
  labor: "finance.cat.labor", maintenance: "finance.cat.maintenance", other: "finance.cat.other",
};

interface Transaction {
  id: number; date: string; type: "income" | "expense"; category: string;
  description: string; amount: string; quantity: string | null;
  unit: string | null; notes: string | null; authorName: string | null; createdAt: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include", ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Error");
  return r.status === 204 ? null : r.json();
}

function AddTransactionDialog({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: "expense" as "income" | "expense",
    date: new Date().toISOString().split("T")[0],
    category: "",
    description: "",
    amount: "",
    quantity: "",
    unit: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const cats = form.type === "income" ? CATEGORIES_INCOME : CATEGORIES_EXPENSE;

  const handleSubmit = async () => {
    if (!form.date || !form.category || !form.description || !form.amount) {
      toast({ variant: "destructive", title: t("finance.error.required") });
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount), quantity: form.quantity ? Number(form.quantity) : null }),
      });
      toast({ title: t("finance.added") });
      setOpen(false);
      setForm({ type: "expense", date: new Date().toISOString().split("T")[0], category: "", description: "", amount: "", quantity: "", unit: "", notes: "" });
      onSuccess();
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-none shadow-md">
          <Plus className="w-4 h-4" />{t("finance.add")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t("finance.add")}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Type toggle */}
          <div className="flex gap-2">
            {(["expense","income"] as const).map(tp => (
              <button key={tp} onClick={() => setForm(f => ({ ...f, type: tp, category: "" }))}
                className={cn("flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all border",
                  form.type === tp
                    ? tp === "income" ? "bg-emerald-500 text-white border-emerald-500" : "bg-red-500 text-white border-red-500"
                    : "bg-muted text-muted-foreground border-transparent"
                )}>
                {tp === "income" ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                {t(`finance.type.${tp}`)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("finance.date")}</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("finance.amount")} (IQD)</Label>
              <Input type="number" min="0" placeholder="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">{t("finance.category")}</Label>
            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue placeholder={t("finance.category")} /></SelectTrigger>
              <SelectContent>
                {cats.map(c => <SelectItem key={c} value={c}>{t(CAT_KEYS[c] ?? c)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">{t("finance.description")}</Label>
            <Input placeholder={t("finance.description")} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("finance.quantity")} ({t("finance.optional")})</Label>
              <Input type="number" min="0" placeholder="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("finance.unit")} ({t("finance.optional")})</Label>
              <Input placeholder="kg, لتر, قطعة..." value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">{t("finance.notes.label")} ({t("finance.optional")})</Label>
            <Textarea className="text-sm resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
            {t("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, icon: Icon, color, trend }: { label: string; value: string; icon: any; color: string; trend?: "up" | "down" | "neutral" }) {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground leading-none mb-1">{label}</p>
          <p className="text-lg font-bold truncate">{value}</p>
        </div>
        {trend && (
          trend === "up" ? <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
          : trend === "down" ? <TrendingDown className="w-4 h-4 text-red-500 shrink-0" />
          : null
        )}
      </CardContent>
    </Card>
  );
}

function fmtAmount(n: number) {
  return new Intl.NumberFormat("ar-IQ").format(n) + " د.ع";
}

export default function Finance() {
  const { t, lang } = useLanguage();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [chartView, setChartView] = useState<"bar" | "pie">("bar");
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

  const filtered = useMemo(() =>
    filter === "all" ? transactions : transactions.filter(t => t.type === filter),
    [transactions, filter]
  );

  const totalIncome  = useMemo(() => transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0), [transactions]);
  const totalExpense = useMemo(() => transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0), [transactions]);
  const profit = totalIncome - totalExpense;

  // Monthly chart data
  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; income: number; expense: number }> = {};
    summary.forEach((r: any) => {
      if (!map[r.month]) map[r.month] = { month: r.month, income: 0, expense: 0 };
      if (r.type === "income") map[r.month].income += Number(r.total);
      else map[r.month].expense += Number(r.total);
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  }, [summary]);

  // Category pie data
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach(tr => {
      const key = tr.category;
      map[key] = (map[key] ?? 0) + Number(tr.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name: t(CAT_KEYS[name] ?? name), value }));
  }, [transactions, t]);

  const handleDelete = async (id: number) => {
    if (!confirm(t("finance.confirm.delete"))) return;
    setDeletingId(id);
    try {
      await apiFetch(`/api/transactions/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["transactions-summary"] });
      toast({ title: t("finance.deleted") });
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message });
    } finally {
      setDeletingId(null);
    }
  };

  const runAiAnalysis = async () => {
    if (transactions.length === 0) return;
    setAiLoading(true);
    try {
      const totalsByCategory: Record<string, { income: number; expense: number }> = {};
      transactions.forEach(tr => {
        if (!totalsByCategory[tr.category]) totalsByCategory[tr.category] = { income: 0, expense: 0 };
        totalsByCategory[tr.category][tr.type] += Number(tr.amount);
      });

      const prompt = `أنت مستشار مالي لمزرعة دواجن في الموصل، العراق.
هذه البيانات المالية للمزرعة:
- إجمالي الدخل: ${fmtAmount(totalIncome)}
- إجمالي المصاريف: ${fmtAmount(totalExpense)}
- صافي الربح/الخسارة: ${fmtAmount(profit)}
- عدد المعاملات: ${transactions.length}
- تفصيل حسب الفئات: ${JSON.stringify(totalsByCategory, null, 2)}
- آخر ١٠ معاملات: ${JSON.stringify(transactions.slice(0, 10).map(t => ({ date: t.date, type: t.type, cat: t.category, amount: Number(t.amount) })), null, 2)}

قدم تحليلاً مالياً احترافياً شاملاً يتضمن:
١. تقييم الوضع المالي الحالي
٢. أكبر بنود المصاريف وكيفية تخفيضها
٣. فرص زيادة الدخل
٤. توصيات عملية ومحددة لتحسين الربحية
٥. مؤشرات الأداء الرئيسية التي يجب متابعتها
اجعل التحليل دقيقاً ومفيداً ومناسباً لمزرعة دواجن صغيرة في العراق.`;

      const r = await fetch(`${BASE}/api/ai/analyze`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, context: "financial" }),
      });
      if (r.ok) {
        const d = await r.json();
        setAiAnalysis(d.analysis ?? d.result ?? d.text ?? "");
      } else {
        // fallback local analysis
        const lines = [
          `📊 **التحليل المالي للمزرعة**`,
          ``,
          `💰 **ملخص مالي:**`,
          `• إجمالي الدخل: ${fmtAmount(totalIncome)}`,
          `• إجمالي المصاريف: ${fmtAmount(totalExpense)}`,
          `• صافي الربح: ${fmtAmount(profit)} ${profit >= 0 ? "✅" : "❌"}`,
          `• نسبة هامش الربح: ${totalIncome > 0 ? ((profit / totalIncome) * 100).toFixed(1) : 0}%`,
          ``,
          `📈 **ملاحظات:**`,
          profit < 0 ? `• ⚠️ المزرعة تعمل بخسارة حالياً — راجع بنود المصاريف` : `• ✅ المزرعة تحقق ربحاً إيجابياً`,
          totalExpense > 0 ? `• أعلى فئات المصاريف تحتاج مراجعة دورية` : "",
          `• يُنصح بتسجيل جميع المعاملات يومياً لدقة التحليل`,
        ].filter(Boolean);
        setAiAnalysis(lines.join("\n"));
      }
    } catch {
      toast({ variant: "destructive", title: t("finance.ai.error") });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t("finance.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("finance.desc")}</p>
          </div>
        </div>
        <AddTransactionDialog onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["transactions"] });
          qc.invalidateQueries({ queryKey: ["transactions-summary"] });
        }} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t("finance.income")} value={fmtAmount(totalIncome)} icon={ArrowUpCircle} color="bg-emerald-500" trend="up" />
        <StatCard label={t("finance.expense")} value={fmtAmount(totalExpense)} icon={ArrowDownCircle} color="bg-red-500" trend="down" />
        <StatCard
          label={t("finance.profit")}
          value={fmtAmount(profit)}
          icon={profit >= 0 ? TrendingUp : TrendingDown}
          color={profit >= 0 ? "bg-blue-500" : "bg-orange-500"}
          trend={profit >= 0 ? "up" : "down"}
        />
        <StatCard label={t("finance.transactions.count")} value={String(transactions.length)} icon={Receipt} color="bg-purple-500" />
      </div>

      {/* Charts */}
      {transactions.length > 0 && (
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold">{t("finance.chart.monthly")}</CardTitle>
            <div className="flex gap-1">
              <Button variant={chartView === "bar" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setChartView("bar")}>
                <BarChart2 className="w-3.5 h-3.5" />
              </Button>
              <Button variant={chartView === "pie" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setChartView("pie")}>
                <PieIcon className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {chartView === "bar" && monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => fmtAmount(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="income" name={t("finance.type.income")} fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name={t("finance.type.expense")} fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : chartView === "pie" && categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 9 }}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmtAmount(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">{t("finance.chart.nodata")}</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI Analysis */}
      {isAdmin && (
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-semibold">{t("finance.ai.analyze")}</span>
              </div>
              <Button variant="outline" size="sm" onClick={runAiAnalysis} disabled={aiLoading || transactions.length === 0} className="h-7 text-xs gap-1.5">
                {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                {aiLoading ? t("finance.ai.analyzing") : t("finance.ai.run")}
              </Button>
            </div>
            {aiAnalysis && (
              <div className="bg-purple-50 dark:bg-purple-950/20 rounded-xl p-3 text-xs leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-300 border border-purple-100 dark:border-purple-800/30">
                {aiAnalysis}
              </div>
            )}
            {!aiAnalysis && !aiLoading && (
              <p className="text-xs text-muted-foreground">{t("finance.ai.hint")}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transactions List */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2 flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-bold">{t("finance.transactions")}</CardTitle>
          <div className="flex gap-1">
            {(["all","income","expense"] as const).map(f => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "ghost"} onClick={() => setFilter(f)} className="h-7 text-xs px-2.5">
                {t(`finance.filter.${f}`)}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Receipt className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">{t("finance.empty")}</p>
              <p className="text-xs text-muted-foreground">{t("finance.empty.desc")}</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map(tr => (
                <div key={tr.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group">
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                    tr.type === "income" ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30")}>
                    {tr.type === "income"
                      ? <ArrowUpCircle className="w-4 h-4 text-emerald-600" />
                      : <ArrowDownCircle className="w-4 h-4 text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{tr.description}</span>
                      <Badge variant="secondary" className="text-[9px] h-4 shrink-0">{t(CAT_KEYS[tr.category] ?? tr.category)}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{tr.date}</span>
                      {tr.quantity && tr.unit && <span className="text-[10px] text-muted-foreground">{tr.quantity} {tr.unit}</span>}
                      {tr.authorName && <span className="text-[10px] text-muted-foreground">{tr.authorName}</span>}
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    <div className={cn("text-sm font-bold", tr.type === "income" ? "text-emerald-600" : "text-red-600")}>
                      {tr.type === "income" ? "+" : "-"}{fmtAmount(Number(tr.amount))}
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={() => handleDelete(tr.id)}
                      disabled={deletingId === tr.id}
                    >
                      {deletingId === tr.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
