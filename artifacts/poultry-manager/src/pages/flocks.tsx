import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Bird, Plus, Pencil, Trash2, Heart, Egg, AlertTriangle, TrendingUp,
  TrendingDown, Minus, ChevronRight, Activity, Flame, Search, Filter,
  X, CheckCircle2, Clock, Star, BarChart3, Droplets, SlidersHorizontal,
  Calendar, ArrowUpDown, Stethoscope, Wheat, DollarSign, Scale,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import FlockIntelligencePanel from "@/components/FlockIntelligencePanel";
import { apiFetch } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Flock {
  id: number;
  name: string;
  breed: string;
  count: number;
  ageDays: number;
  birthDate: string | null;
  purpose: string;
  healthStatus: string;
  feedConsumptionKg: number | null;
  dailyEggTarget: number | null;
  notes: string | null;
  createdAt: string;
  totalEggs7d: number;
  avgDaily7d: number;
  latestLogDate: string | null;
}

interface ProductionLog {
  id: number;
  flockId: number;
  date: string;
  eggCount: number;
  notes: string | null;
  createdAt: string;
}

interface HealthLog {
  id: number;
  flockId: number;
  date: string;
  status: string;
  symptoms: string | null;
  treatment: string | null;
  notes: string | null;
  createdAt: string;
}

interface Analytics {
  flockCount: number;
  totalBirds: number;
  healthyCount: number;
  sickCount: number;
  totalEggs7d: number;
  avgDailyAllFlocks: number;
  topProducerName: string | null;
  topProducerAvgDaily: number;
}

// Feed intelligence types (mirrored from engine)
interface FlockFeedAnalysis {
  flockId: number;
  flockName: string;
  breed: string;
  count: number;
  ageDays: number;
  ageWeeks: number;
  growthStage: string;
  purpose: string;
  feedData: {
    totalCostAllocated: number;
    totalKgAllocated: number | null;
    costPerBird: number;
    dailyCostPerBird: number;
    dailyFeedKgPerBird: number | null;
  };
  benchmark: {
    expectedDailyFeedGrams: number;
    expectedFCR: number;
    actualFCR: number | null;
    fcrRating: { efficiency: string; deviation: number; label: string } | null;
    expectedProductionPct: number;
    actualProductionPct: number;
    productionRating: { rating: string; gap: number };
  };
  costPerEgg: number | null;
  costPerDozen: number | null;
  efficiencyScore: number;
  insights: Array<{
    severity: string;
    observation: string;
    why: string;
    action: string;
    evidence: string;
    expectedOutcome: string;
  }>;
}

interface FeedSummaryResponse {
  flockAnalyses: FlockFeedAnalysis[];
  farmEfficiencyScore: number;
  totalFeedSpend: number;
  feedCostPctOfExpenses: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcAgeDays(birthDate: string | null, ageDays: number) {
  if (!birthDate) return ageDays;
  const start = new Date(birthDate);
  const now   = new Date();
  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86_400_000));
}

function ageLabel(days: number, ar: boolean) {
  if (days < 30)  return ar ? `${days} يوم` : `${days} dagar`;
  if (days < 365) return ar ? `${Math.round(days / 30)} شهر` : `${Math.round(days / 30)} mån`;
  return ar ? `${(days / 365).toFixed(1)} سنة` : `${(days / 365).toFixed(1)} år`;
}

// ── Health meta ───────────────────────────────────────────────────────────────

const HEALTH_META: Record<string, { labelAr: string; labelSv: string; color: string; bg: string; border: string; icon: typeof CheckCircle2 }> = {
  healthy:    { labelAr: "بصحة جيدة",   labelSv: "Frisk",        color: "#10b981", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", icon: CheckCircle2 },
  sick:       { labelAr: "مريضة",        labelSv: "Sjuk",         color: "#ef4444", bg: "bg-red-50 dark:bg-red-950/30",         border: "border-red-200 dark:border-red-800",         icon: AlertTriangle },
  recovering: { labelAr: "في التعافي",   labelSv: "Återhämtning", color: "#f59e0b", bg: "bg-amber-50 dark:bg-amber-950/30",     border: "border-amber-200 dark:border-amber-800",     icon: Activity },
  quarantine: { labelAr: "حجر صحي",      labelSv: "Karantän",     color: "#8b5cf6", bg: "bg-violet-50 dark:bg-violet-950/30",   border: "border-violet-200 dark:border-violet-800",   icon: AlertTriangle },
  treated:    { labelAr: "تمت المعالجة", labelSv: "Behandlad",    color: "#3b82f6", bg: "bg-blue-50 dark:bg-blue-950/30",       border: "border-blue-200 dark:border-blue-800",       icon: CheckCircle2 },
};
const getHealth = (s: string) => HEALTH_META[s] ?? HEALTH_META.healthy;

// ── Purpose meta ──────────────────────────────────────────────────────────────

const PURPOSE_META: Record<string, { labelAr: string; labelSv: string; emoji: string; color: string }> = {
  eggs:     { labelAr: "بياض", labelSv: "Ägg",        emoji: "🥚", color: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
  meat:     { labelAr: "لحم",  labelSv: "Kött",       emoji: "🍗", color: "text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800" },
  hatching: { labelAr: "تفقيس", labelSv: "Kläckning", emoji: "🐣", color: "text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
  mixed:    { labelAr: "مختلط", labelSv: "Blandat",   emoji: "🔄", color: "text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
};
const getPurpose = (p: string) => PURPOSE_META[p] ?? PURPOSE_META.mixed;

// ══ FORMS ════════════════════════════════════════════════════════════════════

function FlockForm({ initial, onSubmit, onClose, loading, isEdit }: {
  initial?: Flock; onSubmit: (d: any) => void; onClose: () => void; loading?: boolean; isEdit?: boolean;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [form, setForm] = useState({
    name:              initial?.name              ?? "",
    breed:             initial?.breed             ?? "",
    count:             initial?.count             ?? 1,
    ageDays:           initial ? calcAgeDays(initial.birthDate, initial.ageDays) : 0,
    birthDate:         initial?.birthDate         ?? "",
    purpose:           initial?.purpose           ?? "eggs",
    healthStatus:      initial?.healthStatus      ?? "healthy",
    feedConsumptionKg: initial?.feedConsumptionKg ?? "",
    dailyEggTarget:    initial?.dailyEggTarget     ?? "",
    notes:             initial?.notes             ?? "",
  });

  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e?.target?.value ?? e }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({
      ...form,
      count: Number(form.count),
      ageDays: Number(form.ageDays),
      feedConsumptionKg: form.feedConsumptionKg !== "" ? Number(form.feedConsumptionKg) : null,
      dailyEggTarget: form.dailyEggTarget !== "" ? Number(form.dailyEggTarget) : null,
      birthDate: form.birthDate || null,
    }); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>{ar ? "اسم المجموعة" : "Flocksnamn"} *</Label>
          <Input value={form.name} onChange={set("name")} required autoFocus placeholder={ar ? "مثال: دجاج بياض الأمل" : "T.ex. Värphöns Alpha"} />
        </div>
        <div className="space-y-1.5">
          <Label>{ar ? "السلالة" : "Ras"} *</Label>
          <Input value={form.breed} onChange={set("breed")} required placeholder={ar ? "مثال: لوهمان براون" : "T.ex. Lohmann Brown"} />
        </div>
        <div className="space-y-1.5">
          <Label>{ar ? "عدد الطيور" : "Antal fåglar"} *</Label>
          <Input type="number" min={1} value={form.count} onChange={set("count")} required />
        </div>
        <div className="space-y-1.5">
          <Label>{ar ? "تاريخ الميلاد" : "Födelsedag"}</Label>
          <Input type="date" value={form.birthDate} onChange={e => {
            const val = e.target.value;
            setForm(f => ({ ...f, birthDate: val, ageDays: val ? calcAgeDays(val, 0) : f.ageDays }));
          }} />
        </div>
        <div className="space-y-1.5">
          <Label>{ar ? "العمر (أيام)" : "Ålder (dagar)"} *</Label>
          <Input type="number" min={0} value={form.ageDays} onChange={set("ageDays")} required />
        </div>
        <div className="space-y-1.5">
          <Label>{ar ? "الغرض" : "Syfte"}</Label>
          <Select value={form.purpose} onValueChange={v => setForm(f => ({ ...f, purpose: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PURPOSE_META).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.emoji} {ar ? v.labelAr : v.labelSv}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{ar ? "الحالة الصحية" : "Hälsostatus"}</Label>
          <Select value={form.healthStatus} onValueChange={v => setForm(f => ({ ...f, healthStatus: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(HEALTH_META).map(([k, v]) => (
                <SelectItem key={k} value={k}>{ar ? v.labelAr : v.labelSv}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{ar ? "استهلاك العلف (كجم/يوم)" : "Foderförbrukning (kg/dag)"}</Label>
          <Input type="number" step="0.1" min={0} value={form.feedConsumptionKg} onChange={set("feedConsumptionKg")} placeholder="0.0" />
        </div>
        <div className="space-y-1.5">
          <Label>{ar ? "هدف البيض اليومي" : "Dagligt äggmål"}</Label>
          <Input type="number" min={0} value={form.dailyEggTarget} onChange={set("dailyEggTarget")} placeholder="0" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>{ar ? "ملاحظات" : "Anteckningar"}</Label>
          <Textarea value={form.notes} onChange={set("notes")} placeholder={ar ? "ملاحظات عن المجموعة..." : "Anteckningar om flocken..."} rows={2} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>{ar ? "إلغاء" : "Avbryt"}</Button>
        <Button type="submit" disabled={loading}>{isEdit ? (ar ? "تحديث" : "Uppdatera") : (ar ? "إضافة" : "Lägg till")}</Button>
      </div>
    </form>
  );
}

function ProductionLogForm({ flockName, onSubmit, onClose, loading }: {
  flockName: string; onSubmit: (d: any) => void; onClose: () => void; loading?: boolean;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ date: today, eggCount: "", notes: "" });
  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e?.target?.value ?? e }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ date: form.date, eggCount: Number(form.eggCount), notes: form.notes || null }); }} className="space-y-4">
      <p className="text-sm text-muted-foreground">{ar ? "تسجيل إنتاج بيض ليوم محدد" : "Registrera äggproduktion för en dag"}: <span className="font-medium text-foreground">{flockName}</span></p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{ar ? "التاريخ" : "Datum"}</Label>
          <Input type="date" value={form.date} onChange={set("date")} required />
        </div>
        <div className="space-y-1.5">
          <Label>{ar ? "عدد البيض" : "Antal ägg"}</Label>
          <Input type="number" min={0} value={form.eggCount} onChange={set("eggCount")} required placeholder="0" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>{ar ? "ملاحظة" : "Anteckning"}</Label>
          <Input value={form.notes} onChange={set("notes")} placeholder={ar ? "اختياري..." : "Valfritt..."} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>{ar ? "إلغاء" : "Avbryt"}</Button>
        <Button type="submit" disabled={loading}>{ar ? "تسجيل" : "Spara"}</Button>
      </div>
    </form>
  );
}

function HealthLogForm({ flockName, onSubmit, onClose, loading }: {
  flockName: string; onSubmit: (d: any) => void; onClose: () => void; loading?: boolean;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ date: today, status: "healthy", symptoms: "", treatment: "", notes: "" });
  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e?.target?.value ?? e }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ date: form.date, status: form.status, symptoms: form.symptoms || null, treatment: form.treatment || null, notes: form.notes || null }); }} className="space-y-4">
      <p className="text-sm text-muted-foreground">{ar ? "تسجيل حالة صحية" : "Registrera hälsohändelse"}: <span className="font-medium text-foreground">{flockName}</span></p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{ar ? "التاريخ" : "Datum"}</Label>
          <Input type="date" value={form.date} onChange={set("date")} required />
        </div>
        <div className="space-y-1.5">
          <Label>{ar ? "الحالة" : "Status"}</Label>
          <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(HEALTH_META).map(([k, v]) => (
                <SelectItem key={k} value={k}>{ar ? v.labelAr : v.labelSv}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>{ar ? "الأعراض" : "Symptom"}</Label>
          <Input value={form.symptoms} onChange={set("symptoms")} placeholder={ar ? "وصف الأعراض..." : "Beskriv symptom..."} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>{ar ? "العلاج" : "Behandling"}</Label>
          <Input value={form.treatment} onChange={set("treatment")} placeholder={ar ? "الدواء أو الإجراء المتخذ..." : "Medicin eller åtgärd..."} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>{ar ? "ملاحظات إضافية" : "Ytterligare anteckningar"}</Label>
          <Textarea value={form.notes} onChange={set("notes")} placeholder={ar ? "اختياري..." : "Valfritt..."} rows={2} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>{ar ? "إلغاء" : "Avbryt"}</Button>
        <Button type="submit" disabled={loading}>{ar ? "تسجيل" : "Spara"}</Button>
      </div>
    </form>
  );
}

// ══ DETAIL MODAL ══════════════════════════════════════════════════════════════

function FlockDetailModal({ flock, onClose, onRefresh, isAdmin, feedAnalysis }: {
  flock: Flock; onClose: () => void; onRefresh: () => void; isAdmin: boolean;
  feedAnalysis?: FlockFeedAnalysis;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { toast } = useToast();
  const [prodLogs, setProdLogs]     = useState<ProductionLog[]>([]);
  const [healthLogs, setHealthLogs] = useState<HealthLog[]>([]);
  const [tab, setTab]               = useState<"overview" | "production" | "health" | "feed" | "intelligence">("overview");
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [addProdOpen, setAddProdOpen]     = useState(false);
  const [addHealthOpen, setAddHealthOpen] = useState(false);
  const [savingProd, setSavingProd]   = useState(false);
  const [savingHealth, setSavingHealth] = useState(false);

  const health  = getHealth(flock.healthStatus);
  const purpose = getPurpose(flock.purpose);
  const age     = calcAgeDays(flock.birthDate, flock.ageDays);

  useEffect(() => {
    async function loadLogs() {
      setLoadingLogs(true);
      try {
        const [prod, hlth] = await Promise.all([
          apiFetch<ProductionLog[]>(`/api/flocks/${flock.id}/production-logs`),
          apiFetch<HealthLog[]>(`/api/flocks/${flock.id}/health-logs`),
        ]);
        setProdLogs(prod.slice(0, 30));
        setHealthLogs(hlth.slice(0, 20));
      } catch { /* silent */ }
      setLoadingLogs(false);
    }
    loadLogs();
  }, [flock.id]);

  const handleAddProd = async (data: any) => {
    setSavingProd(true);
    try {
      await apiFetch(`/api/flocks/${flock.id}/production-logs`, { method: "POST", body: JSON.stringify(data) });
      toast({ title: ar ? "تم تسجيل الإنتاج" : "Produktion registrerad" });
      setAddProdOpen(false);
      onRefresh();
      const logs = await apiFetch<ProductionLog[]>(`/api/flocks/${flock.id}/production-logs`);
      setProdLogs(logs.slice(0, 30));
    } catch (err: any) {
      toast({ title: ar ? "خطأ في الحفظ" : "Fel vid sparning", description: err.message, variant: "destructive" });
    }
    setSavingProd(false);
  };

  const handleAddHealth = async (data: any) => {
    setSavingHealth(true);
    try {
      await apiFetch(`/api/flocks/${flock.id}/health-logs`, { method: "POST", body: JSON.stringify(data) });
      toast({ title: ar ? "تم تسجيل الحالة الصحية" : "Hälsohändelse registrerad" });
      setAddHealthOpen(false);
      onRefresh();
      const logs = await apiFetch<HealthLog[]>(`/api/flocks/${flock.id}/health-logs`);
      setHealthLogs(logs.slice(0, 20));
    } catch (err: any) {
      toast({ title: ar ? "خطأ في الحفظ" : "Fel vid sparning", description: err.message, variant: "destructive" });
    }
    setSavingHealth(false);
  };

  // Chart data: last 14 days of production
  const chartData = useMemo(() => {
    const sorted = [...prodLogs].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
    return sorted.map(l => ({
      date: new Date(l.date).toLocaleDateString(ar ? "ar-IQ" : "sv-SE", { month: "short", day: "numeric" }),
      eggs: l.eggCount,
    }));
  }, [prodLogs, ar]);

  const avgProd = prodLogs.length > 0 ? Math.round(prodLogs.slice(0, 7).reduce((s, l) => s + l.eggCount, 0) / Math.min(7, prodLogs.length)) : 0;

  return (
    <>
      <Dialog open onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle className="text-xl">{flock.name}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">{flock.breed} · {ageLabel(age, ar)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2 py-1 rounded-full border font-medium ${purpose.color}`}>
                  {purpose.emoji} {ar ? purpose.labelAr : purpose.labelSv}
                </span>
                <span
                  className="text-xs px-2 py-1 rounded-full border font-medium"
                  style={{ background: health.color + "18", color: health.color, borderColor: health.color + "44" }}
                >
                  {ar ? health.labelAr : health.labelSv}
                </span>
              </div>
            </div>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {[
              { key: "overview",      labelAr: "عامة",       labelSv: "Översikt" },
              { key: "production",   labelAr: "الإنتاج",   labelSv: "Produktion" },
              { key: "health",       labelAr: "الصحة",     labelSv: "Hälsa" },
              { key: "feed",         labelAr: "العلف",      labelSv: "Foder" },
              { key: "intelligence", labelAr: "🧠 ذكاء",   labelSv: "🧠 AI" },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as any)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${tab === t.key ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {ar ? t.labelAr : t.labelSv}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === "overview" && (
            <div className="space-y-4">
              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: Bird,       value: flock.count, labelAr: "طير", labelSv: "fåglar" },
                  { icon: Calendar,   value: ageLabel(age, ar), labelAr: "العمر", labelSv: "Ålder" },
                  { icon: Egg,        value: flock.avgDaily7d || "—", labelAr: "بيض/يوم", labelSv: "ägg/dag" },
                  { icon: Wheat,      value: flock.feedConsumptionKg != null ? `${flock.feedConsumptionKg} كجم` : "—", labelAr: "علف/يوم", labelSv: "foder/dag" },
                ].map((s, i) => (
                  <div key={i} className="bg-muted/50 rounded-xl p-3 text-center">
                    <s.icon className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                    <div className="font-bold text-lg text-foreground">{s.value}</div>
                    <div className="text-[10px] text-muted-foreground">{ar ? s.labelAr : s.labelSv}</div>
                  </div>
                ))}
              </div>

              {/* Performance vs target */}
              {flock.dailyEggTarget && flock.dailyEggTarget > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>{ar ? "الأداء مقابل الهدف" : "Prestanda vs mål"}</span>
                    <span className="font-medium">{Math.round((flock.avgDaily7d / flock.dailyEggTarget) * 100)}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, (flock.avgDaily7d / flock.dailyEggTarget) * 100)}%`,
                        background: flock.avgDaily7d >= flock.dailyEggTarget * 0.9 ? "#10b981" : flock.avgDaily7d >= flock.dailyEggTarget * 0.7 ? "#f59e0b" : "#ef4444",
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>0</span>
                    <span>{ar ? `الهدف: ${flock.dailyEggTarget}` : `Mål: ${flock.dailyEggTarget}`}</span>
                  </div>
                </div>
              )}

              {/* Notes */}
              {flock.notes && (
                <div className="bg-muted/50 rounded-xl p-3 text-sm text-muted-foreground leading-relaxed">
                  {flock.notes}
                </div>
              )}
            </div>
          )}

          {tab === "production" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{ar ? "سجل الإنتاج" : "Produktionshistorik"}</p>
                  <p className="text-xs text-muted-foreground">{ar ? `متوسط: ${avgProd} بيضة/يوم (آخر ٧ أيام)` : `Snitt: ${avgProd} ägg/dag (senaste 7 dagar)`}</p>
                </div>
                {isAdmin && (
                  <Button size="sm" className="gap-1.5" onClick={() => setAddProdOpen(true)}>
                    <Plus className="w-3.5 h-3.5" />
                    {ar ? "تسجيل يوم" : "Lägg till"}
                  </Button>
                )}
              </div>

              {loadingLogs ? <Skeleton className="h-40 w-full" /> : chartData.length > 0 ? (
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(v: number) => [v, ar ? "بيضة" : "ägg"]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="eggs" radius={[4, 4, 0, 0]}>
                        {chartData.map((_, i) => <Cell key={i} fill="#f59e0b" />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Egg className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  {ar ? "لا يوجد سجل إنتاج بعد" : "Ingen produktionshistorik ännu"}
                </div>
              )}

              {/* Log list */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {prodLogs.map(l => (
                  <div key={l.id} className="flex items-center justify-between text-sm py-2 border-b border-border/40 last:border-0">
                    <div>
                      <span className="font-medium">{new Date(l.date).toLocaleDateString(ar ? "ar-IQ" : "sv-SE", { weekday: "short", month: "short", day: "numeric" })}</span>
                      {l.notes && <span className="text-xs text-muted-foreground ms-2">{l.notes}</span>}
                    </div>
                    <span className="font-bold text-amber-600">{l.eggCount} {ar ? "🥚" : "ägg"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "health" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{ar ? "السجل الصحي" : "Hälsohistorik"}</p>
                {isAdmin && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddHealthOpen(true)}>
                    <Stethoscope className="w-3.5 h-3.5" />
                    {ar ? "إضافة حدث" : "Lägg till"}
                  </Button>
                )}
              </div>

              {loadingLogs ? <Skeleton className="h-40 w-full" /> : healthLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Heart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  {ar ? "لا يوجد سجل صحي بعد" : "Ingen hälsohistorik ännu"}
                </div>
              ) : (
                <div className="space-y-3">
                  {healthLogs.map(l => {
                    const h = getHealth(l.status);
                    const HIcon = h.icon;
                    return (
                      <div key={l.id} className={`rounded-xl p-3 border ${h.border} ${h.bg}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <HIcon className="w-3.5 h-3.5" style={{ color: h.color }} />
                            <span className="font-semibold text-sm" style={{ color: h.color }}>{ar ? h.labelAr : h.labelSv}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(l.date).toLocaleDateString(ar ? "ar-IQ" : "sv-SE", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                        {l.symptoms && <p className="text-xs text-muted-foreground mb-1"><span className="font-medium">{ar ? "الأعراض:" : "Symptom:"}</span> {l.symptoms}</p>}
                        {l.treatment && <p className="text-xs text-muted-foreground mb-1"><span className="font-medium">{ar ? "العلاج:" : "Behandling:"}</span> {l.treatment}</p>}
                        {l.notes && <p className="text-xs text-muted-foreground">{l.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Feed Tab ──────────────────────────────────────────── */}
          {tab === "feed" && (
            <div className="space-y-4">
              {feedAnalysis ? (
                <>
                  {/* Score header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{ar ? "حاسبة العلف" : "Foderkalkylator"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ar ? "تحليل كفاءة العلف والتكلفة بناءً على سلالة القطيع وعمره" : "Analyserar fodereffektivitet och kostnad baserat på flockens ras och ålder"}
                      </p>
                    </div>
                    <div className="text-center shrink-0">
                      <div className="text-4xl font-black leading-none"
                        style={{ color: feedAnalysis.efficiencyScore >= 70 ? "#10b981" : feedAnalysis.efficiencyScore >= 45 ? "#f59e0b" : "#ef4444" }}>
                        {feedAnalysis.efficiencyScore}
                      </div>
                      <div className="text-[10px] text-muted-foreground">/100</div>
                    </div>
                  </div>

                  {/* ── Cost per Bird — Prominent Card ─────────────────── */}
                  <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-4 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-blue-200" />
                        <p className="text-xs font-bold text-blue-100">{ar ? "تكلفة العلف / طائر" : "Foderkostnad / fågel"}</p>
                      </div>
                      {feedAnalysis.feedData.dailyCostPerBird > 0 && (
                        <span className="text-[9px] bg-white/20 rounded-full px-2 py-0.5 text-blue-100">
                          {ar ? "محدّث تلقائياً" : "Automatisk uppdatering"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-end gap-3 mb-3">
                      <div>
                        <p className="text-3xl font-black leading-none">
                          {feedAnalysis.feedData.dailyCostPerBird > 0
                            ? feedAnalysis.feedData.dailyCostPerBird.toFixed(1)
                            : "—"}
                        </p>
                        <p className="text-[10px] text-blue-200 mt-0.5">{ar ? "دينار / طائر / يوم" : "IQD / fågel / dag"}</p>
                      </div>
                      {feedAnalysis.feedData.costPerBird > 0 && (
                        <div className="border-r border-white/30 pr-3 mr-1">
                          <p className="text-xl font-black leading-none">{feedAnalysis.feedData.costPerBird.toFixed(0)}</p>
                          <p className="text-[10px] text-blue-200 mt-0.5">{ar ? "دينار / طائر / شهر" : "IQD / fågel / mån"}</p>
                        </div>
                      )}
                    </div>
                    {/* Formula */}
                    <div className="bg-white/10 rounded-lg px-3 py-2">
                      <p className="text-[9px] text-blue-200 font-mono leading-relaxed">
                        {ar
                          ? `(علف يومي × سعر العلف) ÷ عدد الطيور`
                          : `(dagligt foder × foderpris) ÷ antal fåglar`}
                      </p>
                      {feedAnalysis.feedData.totalKgAllocated != null && (
                        <p className="text-[9px] text-blue-200 mt-1 font-mono">
                          {ar
                            ? `= (${feedAnalysis.feedData.totalKgAllocated.toFixed(1)} كجم × تكلفة/كجم) ÷ ${feedAnalysis.count} طائر`
                            : `= (${feedAnalysis.feedData.totalKgAllocated.toFixed(1)} kg × pris/kg) ÷ ${feedAnalysis.count} fåglar`}
                        </p>
                      )}
                    </div>
                    {feedAnalysis.feedData.dailyCostPerBird === 0 && (
                      <p className="text-[10px] text-yellow-300 mt-2">
                        ⚠️ {ar ? "أضف سجلات علف بسعر لحساب التكلفة" : "Lägg till foderanteckningar med pris för beräkning"}
                      </p>
                    )}
                  </div>

                  {/* 4-metric grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/50 rounded-xl p-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <Wheat className="w-3 h-3 text-amber-500" />
                        {ar ? "علف متوقع / طائر / يوم" : "Förväntat foder/fågel/dag"}
                      </div>
                      <div className="text-xl font-bold">{feedAnalysis.benchmark.expectedDailyFeedGrams}g</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {ar
                          ? `إجمالي القطيع: ${(feedAnalysis.benchmark.expectedDailyFeedGrams * feedAnalysis.count / 1000).toFixed(1)} كجم/يوم`
                          : `Totalt: ${(feedAnalysis.benchmark.expectedDailyFeedGrams * feedAnalysis.count / 1000).toFixed(1)} kg/dag`}
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-xl p-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <DollarSign className="w-3 h-3 text-blue-500" />
                        {ar ? "تكلفة العلف / طائر / يوم" : "Foderkostnad/fågel/dag"}
                      </div>
                      <div className="text-xl font-bold">
                        {feedAnalysis.feedData.dailyCostPerBird > 0 ? feedAnalysis.feedData.dailyCostPerBird.toFixed(2) : "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {feedAnalysis.feedData.costPerBird > 0
                          ? (ar ? `إجمالي 30 يوم / طائر: ${feedAnalysis.feedData.costPerBird.toFixed(1)}` : `30-dagars totalt: ${feedAnalysis.feedData.costPerBird.toFixed(1)}`)
                          : (ar ? "لا تتوفر بيانات تكلفة" : "Ingen kostnadsdata")}
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-xl p-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <Scale className="w-3 h-3 text-purple-500" />
                        {ar ? "FCR المتوقع (معيار السلالة)" : "Förväntat FCR (ras)"}
                      </div>
                      <div className="text-xl font-bold font-mono">{feedAnalysis.benchmark.expectedFCR}</div>
                      <div className={`text-[10px] mt-0.5 font-medium ${feedAnalysis.benchmark.fcrRating?.efficiency === "excellent" ? "text-emerald-600" : feedAnalysis.benchmark.fcrRating?.efficiency === "good" ? "text-blue-600" : "text-muted-foreground"}`}>
                        {feedAnalysis.benchmark.actualFCR != null
                          ? (ar ? `فعلي: ${feedAnalysis.benchmark.actualFCR}` : `Faktiskt: ${feedAnalysis.benchmark.actualFCR}`)
                          : (ar ? "يحتاج بيانات كجم علف" : "Behöver kg-data")}
                      </div>
                    </div>

                    {feedAnalysis.purpose !== "meat" && (
                      <div className="bg-muted/50 rounded-xl p-3">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <Egg className="w-3 h-3 text-yellow-500" />
                          {ar ? "إنتاج متوقع" : "Förväntad produktion"}
                        </div>
                        <div className="text-xl font-bold">{feedAnalysis.benchmark.expectedProductionPct.toFixed(1)}%</div>
                        <div className={`text-[10px] mt-0.5 font-medium ${feedAnalysis.benchmark.actualProductionPct > 0 ? (feedAnalysis.benchmark.productionRating.rating === "on-target" ? "text-emerald-600" : "text-orange-600") : "text-muted-foreground"}`}>
                          {feedAnalysis.benchmark.actualProductionPct > 0
                            ? (ar ? `فعلي: ${feedAnalysis.benchmark.actualProductionPct.toFixed(1)}%` : `Faktiskt: ${feedAnalysis.benchmark.actualProductionPct.toFixed(1)}%`)
                            : (ar ? "لا توجد سجلات إنتاج" : "Inga produktionsloggar")}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stage + breed info */}
                  <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{ar ? "مرحلة النمو:" : "Tillväxtfas:"}</span>
                      <span className="font-medium capitalize">{feedAnalysis.growthStage}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{ar ? "السلالة:" : "Ras:"}</span>
                      <span className="font-medium">{feedAnalysis.breed}</span>
                    </div>
                    {feedAnalysis.feedData.totalKgAllocated != null && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{ar ? "علف مسجّل (30 يوم):" : "Registrerat foder (30 dgr):"}</span>
                        <span className="font-medium font-mono">{feedAnalysis.feedData.totalKgAllocated.toFixed(1)} كجم</span>
                      </div>
                    )}
                  </div>

                  {/* Cost per output */}
                  {(feedAnalysis.costPerEgg != null || feedAnalysis.costPerDozen != null) && (
                    <div className="flex gap-3">
                      {feedAnalysis.costPerEgg != null && (
                        <div className="flex-1 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-xl p-3 text-center">
                          <Egg className="h-4 w-4 mx-auto text-yellow-500 mb-1" />
                          <div className="text-lg font-bold">{feedAnalysis.costPerEgg.toFixed(2)}</div>
                          <div className="text-[10px] text-muted-foreground">{ar ? "تكلفة علف / بيضة" : "Foderkostnad/ägg"}</div>
                        </div>
                      )}
                      {feedAnalysis.costPerDozen != null && (
                        <div className="flex-1 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl p-3 text-center">
                          <Star className="h-4 w-4 mx-auto text-amber-500 mb-1" />
                          <div className="text-lg font-bold">{feedAnalysis.costPerDozen.toFixed(2)}</div>
                          <div className="text-[10px] text-muted-foreground">{ar ? "تكلفة علف / كرتونة" : "Foderkostnad/dussin"}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Insights */}
                  {feedAnalysis.insights.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">{ar ? "توصيات للقطيع:" : "Rekommendationer för flocken:"}</p>
                      {feedAnalysis.insights.map((ins, i) => (
                        <div key={i} className={`rounded-lg border p-2.5 text-xs ${
                          ins.severity === "critical" ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400" :
                          ins.severity === "high" ? "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400" :
                          ins.severity === "positive" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400" :
                          "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400"
                        }`}>
                          <div className="font-medium mb-1">{ins.observation}</div>
                          <div className="text-muted-foreground">{ins.action}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* No cost data hint */}
                  {feedAnalysis.feedData.totalCostAllocated === 0 && (
                    <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground text-center">
                      <Wheat className="w-5 h-5 mx-auto mb-1 opacity-40" />
                      {ar
                        ? "سجّل مشتريات العلف من صفحة حاسبة العلف لرؤية التكاليف الفعلية"
                        : "Registrera foderköp i Foderkalkylator för att se faktiska kostnader"}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Wheat className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{ar ? "لا تتوفر بيانات علف لهذا القطيع" : "Ingen foderdata tillgänglig för denna flock"}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Intelligence Tab ───────────────────────────────────── */}
          {tab === "intelligence" && (
            <FlockIntelligencePanel
              flockId={flock.id}
              flockName={flock.name}
              ar={ar}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add production log */}
      <Dialog open={addProdOpen} onOpenChange={setAddProdOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{ar ? "تسجيل إنتاج البيض" : "Registrera äggproduktion"}</DialogTitle></DialogHeader>
          <ProductionLogForm flockName={flock.name} onSubmit={handleAddProd} onClose={() => setAddProdOpen(false)} loading={savingProd} />
        </DialogContent>
      </Dialog>

      {/* Add health log */}
      <Dialog open={addHealthOpen} onOpenChange={setAddHealthOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{ar ? "تسجيل حدث صحي" : "Registrera hälsohändelse"}</DialogTitle></DialogHeader>
          <HealthLogForm flockName={flock.name} onSubmit={handleAddHealth} onClose={() => setAddHealthOpen(false)} loading={savingHealth} />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ══ FEED MINI STRIP ══════════════════════════════════════════════════════════

function FeedMiniStrip({ fa, ar }: { fa: FlockFeedAnalysis; ar: boolean }) {
  const score = fa.efficiencyScore;
  const scoreColor = score >= 70 ? "#10b981" : score >= 45 ? "#f59e0b" : "#ef4444";
  const statusLabel = ar
    ? (score >= 70 ? "طبيعي" : score >= 45 ? "يُراقَب" : "حرج")
    : (score >= 70 ? "Normal" : score >= 45 ? "Bevaka" : "Kritisk");
  const borderCls = score >= 70
    ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20"
    : score >= 45
    ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
    : "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20";

  const expectedGrams = fa.benchmark.expectedDailyFeedGrams;
  const totalDailyKg  = (expectedGrams * fa.count / 1000);

  return (
    <div className={`rounded-lg border px-2.5 py-2 mt-1 ${borderCls}`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1" style={{ color: scoreColor }}>
          <Wheat className="w-2.5 h-2.5" />
          <span className="text-[9px] font-semibold">{ar ? "حاسبة العلف" : "Foderkalkylator"}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-bold font-mono" style={{ color: scoreColor }}>{score}/100</span>
          <span className="text-[8px] px-1 rounded-sm font-medium" style={{ background: scoreColor + "22", color: scoreColor }}>
            {statusLabel}
          </span>
        </div>
      </div>
      {/* 3-col metrics */}
      <div className="grid grid-cols-3 gap-1 text-center">
        <div className="bg-background/60 rounded px-1 py-1">
          <div className="text-[11px] font-bold text-foreground leading-none">{expectedGrams}g</div>
          <div className="text-[8px] text-muted-foreground mt-0.5">{ar ? "علف/طائر/يوم" : "g/fågel/dag"}</div>
        </div>
        <div className="bg-background/60 rounded px-1 py-1">
          <div className="text-[11px] font-bold text-foreground leading-none">{totalDailyKg.toFixed(1)}kg</div>
          <div className="text-[8px] text-muted-foreground mt-0.5">{ar ? "إجمالي يومي" : "Dagstotalt"}</div>
        </div>
        <div className="bg-background/60 rounded px-1 py-1">
          <div className="text-[11px] font-bold text-foreground leading-none">
            {fa.feedData.dailyCostPerBird > 0 ? fa.feedData.dailyCostPerBird.toFixed(2) : "—"}
          </div>
          <div className="text-[8px] text-muted-foreground mt-0.5">{ar ? "ريال/طائر/يوم" : "kr/fågel/dag"}</div>
        </div>
      </div>
    </div>
  );
}

// ══ FLOCK CARD ════════════════════════════════════════════════════════════════

function FlockCard({ flock, onEdit, onDelete, onDetail, onAddProd, onAddHealth, isAdmin, maxEggs, feedAnalysis }: {
  flock: Flock; onEdit: () => void; onDelete: () => void; onDetail: () => void;
  onAddProd: () => void; onAddHealth: () => void; isAdmin: boolean; maxEggs: number;
  feedAnalysis?: FlockFeedAnalysis;
}) {
  const { lang } = useLanguage();
  const ar      = lang === "ar";
  const health  = getHealth(flock.healthStatus);
  const purpose = getPurpose(flock.purpose);
  const age     = calcAgeDays(flock.birthDate, flock.ageDays);
  const HealthIcon = health.icon;
  const perfPct = maxEggs > 0 ? Math.min(100, (flock.avgDaily7d / maxEggs) * 100) : 0;
  const hasTarget = flock.dailyEggTarget && flock.dailyEggTarget > 0;
  const targetPct = hasTarget ? Math.min(100, (flock.avgDaily7d / flock.dailyEggTarget!) * 100) : null;
  const isUnderPerforming = hasTarget && flock.purpose === "eggs" && targetPct !== null && targetPct < 80;

  return (
    <Card className={`group border-2 transition-all duration-200 hover:shadow-lg cursor-pointer ${health.border} ${health.bg}`} onClick={onDetail}>
      {/* Top health color strip */}
      <div className="h-1.5 rounded-t-xl" style={{ background: health.color }} />

      <CardContent className="p-4 space-y-3">
        {/* Row 1: Name + badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-foreground text-sm leading-snug truncate">{flock.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{flock.breed}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${purpose.color}`}>
              {purpose.emoji} {ar ? purpose.labelAr : purpose.labelSv}
            </span>
            <span
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: health.color + "18", color: health.color, border: `1px solid ${health.color}33` }}
            >
              <HealthIcon className="w-2.5 h-2.5" />
              {ar ? health.labelAr : health.labelSv}
            </span>
          </div>
        </div>

        {/* Row 2: 3 stat boxes */}
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="bg-background/70 rounded-lg py-2">
            <div className="font-black text-lg text-foreground leading-none">{flock.count}</div>
            <div className="text-[9px] text-muted-foreground mt-0.5">{ar ? "طير" : "fåglar"}</div>
          </div>
          <div className="bg-background/70 rounded-lg py-2">
            <div className="font-black text-lg text-foreground leading-none">{ageLabel(age, ar)}</div>
            <div className="text-[9px] text-muted-foreground mt-0.5">{ar ? "العمر" : "Ålder"}</div>
          </div>
          <div className="bg-background/70 rounded-lg py-2">
            <div className="font-black text-lg leading-none" style={{ color: flock.avgDaily7d > 0 ? "#f59e0b" : undefined }}>
              {flock.avgDaily7d > 0 ? flock.avgDaily7d : "—"}
            </div>
            <div className="text-[9px] text-muted-foreground mt-0.5">{ar ? "بيضة/يوم" : "ägg/dag"}</div>
          </div>
        </div>

        {/* Row 3: Performance bar */}
        {flock.purpose === "eggs" && (
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>{ar ? "الأداء النسبي" : "Relativ prestanda"}</span>
              {targetPct !== null && (
                <span className={`font-semibold ${targetPct >= 90 ? "text-emerald-600" : targetPct >= 70 ? "text-amber-600" : "text-red-600"}`}>
                  {Math.round(targetPct)}% {ar ? "من الهدف" : "av mål"}
                </span>
              )}
            </div>
            <div className="h-2 rounded-full bg-background/70 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${perfPct}%`,
                  background: `linear-gradient(90deg, ${health.color}88, ${health.color})`,
                }}
              />
            </div>
          </div>
        )}

        {/* Row 4: Feed Intelligence Strip (or fallback) */}
        {feedAnalysis ? (
          <FeedMiniStrip fa={feedAnalysis} ar={ar} />
        ) : (
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5 border-t border-border/30">
            <span className="flex items-center gap-1">
              <Wheat className="w-3 h-3" />
              {flock.feedConsumptionKg != null ? `${flock.feedConsumptionKg} ${ar ? "كجم/يوم" : "kg/dag"}` : (ar ? "علف غير محدد" : "Foder ej angivet")}
            </span>
            {flock.totalEggs7d > 0 && (
              <span className="flex items-center gap-1">
                <Egg className="w-3 h-3 text-amber-500" />
                {flock.totalEggs7d} {ar ? "هذا الأسبوع" : "denna vecka"}
              </span>
            )}
          </div>
        )}

        {/* Row 5: Under-performing alert */}
        {isUnderPerforming && (
          <div className="flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 rounded-lg px-2.5 py-1.5 text-[10px] font-medium">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {ar ? "إنتاج أقل من ٨٠٪ من الهدف!" : "Produktion under 80% av målet!"}
          </div>
        )}

        {/* Row 6: Actions */}
        <div className="flex items-center gap-1 pt-1" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" className="h-7 flex-1 text-[10px] gap-1" onClick={onDetail}>
            <ChevronRight className="w-3 h-3" />
            {ar ? "تفاصيل" : "Detaljer"}
          </Button>
          {isAdmin && (
            <>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onAddProd} aria-label={ar ? "تسجيل إنتاج بيض" : "Registrera äggproduktion"} title={ar ? "تسجيل إنتاج" : "Produktion"}>
                <Egg className="w-3 h-3 text-amber-600" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onAddHealth} aria-label={ar ? "تسجيل حدث صحي" : "Hälsohändelse"} title={ar ? "حدث صحي" : "Hälsa"}>
                <Stethoscope className="w-3 h-3 text-blue-600" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onEdit} aria-label={ar ? "تعديل المجموعة" : "Redigera flock"}>
                <Pencil className="w-3 h-3 text-muted-foreground" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onDelete} aria-label={ar ? "حذف المجموعة" : "Radera flock"}>
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ══ MAIN PAGE ═════════════════════════════════════════════════════════════════

export default function Flocks() {
  const { isAdmin } = useAuth();
  const { lang }    = useLanguage();
  const { toast }   = useToast();
  const ar = lang === "ar";

  const [flocks,    setFlocks]    = useState<Flock[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [feedMap,   setFeedMap]   = useState<Map<number, FlockFeedAnalysis>>(new Map());
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  // Dialog states
  const [addOpen,     setAddOpen]     = useState(false);
  const [editFlock,   setEditFlock]   = useState<Flock | null>(null);
  const [deleteId,    setDeleteId]    = useState<number | null>(null);
  const [detailFlock, setDetailFlock] = useState<Flock | null>(null);
  const [prodFlock,   setProdFlock]   = useState<Flock | null>(null);
  const [healthFlock, setHealthFlock] = useState<Flock | null>(null);

  // Filters
  const [search,     setSearch]     = useState("");
  const [filterPurpose, setFilterPurpose] = useState("all");
  const [filterHealth,  setFilterHealth]  = useState("all");
  const [sortBy,     setSortBy]     = useState("name");

  const load = useCallback(async () => {
    try {
      const [f, a, feedSummary] = await Promise.all([
        apiFetch<Flock[]>("/api/flocks"),
        apiFetch<Analytics>("/api/flocks/analytics/summary"),
        apiFetch<FeedSummaryResponse>("/api/feed-intelligence/summary?days=30").catch(() => null),
      ]);
      setFlocks(f);
      setAnalytics(a);
      // Build flockId → feed analysis map
      if (feedSummary?.flockAnalyses) {
        const m = new Map<number, FlockFeedAnalysis>();
        for (const fa of feedSummary.flockAnalyses) m.set(fa.flockId, fa);
        setFeedMap(m);
      }
    } catch (err: any) {
      toast({ title: ar ? "خطأ في التحميل" : "Laddningsfel", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  }, [ar, toast]);

  useEffect(() => { load(); }, [load]);

  // ── Filter + Sort ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = [...flocks];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(f => f.name.toLowerCase().includes(q) || f.breed.toLowerCase().includes(q));
    }
    if (filterPurpose !== "all") list = list.filter(f => f.purpose === filterPurpose);
    if (filterHealth  !== "all") list = list.filter(f => f.healthStatus === filterHealth);
    list.sort((a, b) => {
      if (sortBy === "name")       return a.name.localeCompare(b.name);
      if (sortBy === "age")        return calcAgeDays(b.birthDate, b.ageDays) - calcAgeDays(a.birthDate, a.ageDays);
      if (sortBy === "production") return b.avgDaily7d - a.avgDaily7d;
      if (sortBy === "health")     return a.healthStatus.localeCompare(b.healthStatus);
      if (sortBy === "count")      return b.count - a.count;
      return 0;
    });
    return list;
  }, [flocks, search, filterPurpose, filterHealth, sortBy]);

  const maxEggs = useMemo(() => Math.max(...flocks.map(f => f.avgDaily7d), 0), [flocks]);

  // ── CRUD handlers ─────────────────────────────────────────────────────────

  const handleCreate = async (data: any) => {
    setSaving(true);
    try {
      await apiFetch("/api/flocks", { method: "POST", body: JSON.stringify(data) });
      toast({ title: ar ? "تمت إضافة المجموعة" : "Flock tillagd" });
      setAddOpen(false);
      await load();
    } catch (err: any) {
      toast({ title: ar ? "خطأ في الإضافة" : "Fel vid tillägg", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleUpdate = async (data: any) => {
    if (!editFlock) return;
    setSaving(true);
    try {
      await apiFetch(`/api/flocks/${editFlock.id}`, { method: "PUT", body: JSON.stringify(data) });
      toast({ title: ar ? "تم التحديث" : "Uppdaterad" });
      setEditFlock(null);
      await load();
    } catch (err: any) {
      toast({ title: ar ? "خطأ في التحديث" : "Fel vid uppdatering", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (deleteId == null) return;
    try {
      await apiFetch(`/api/flocks/${deleteId}`, { method: "DELETE" });
      toast({ title: ar ? "تم الحذف" : "Borttagen" });
      setDeleteId(null);
      await load();
    } catch (err: any) {
      toast({ title: ar ? "خطأ في الحذف" : "Fel vid borttagning", description: err.message, variant: "destructive" });
    }
  };

  const handleAddProd = async (flock: Flock, data: any) => {
    try {
      await apiFetch(`/api/flocks/${flock.id}/production-logs`, { method: "POST", body: JSON.stringify(data) });
      toast({ title: ar ? "تم تسجيل الإنتاج" : "Produktion registrerad" });
      setProdFlock(null);
      await load();
    } catch (err: any) {
      toast({ title: ar ? "خطأ" : "Fel", description: err.message, variant: "destructive" });
    }
  };

  const handleAddHealth = async (flock: Flock, data: any) => {
    try {
      await apiFetch(`/api/flocks/${flock.id}/health-logs`, { method: "POST", body: JSON.stringify(data) });
      toast({ title: ar ? "تم تسجيل الحالة" : "Hälsostatus uppdaterad" });
      setHealthFlock(null);
      await load();
    } catch (err: any) {
      toast({ title: ar ? "خطأ" : "Fel", description: err.message, variant: "destructive" });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const totalChickens = flocks.reduce((s, f) => s + f.count, 0);
  const healthyCount  = flocks.filter(f => f.healthStatus === "healthy").length;
  const sickCount     = flocks.filter(f => f.healthStatus === "sick" || f.healthStatus === "quarantine").length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bird className="w-6 h-6 text-primary" />
            {ar ? "إدارة الدواجن" : "Fjäderfähantering"}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {flocks.length} {ar ? "مجموعة" : "flockar"} · {totalChickens.toLocaleString()} {ar ? "طير إجمالاً" : "fåglar totalt"}
          </p>
        </div>
        {isAdmin && (
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4" />
            {ar ? "إضافة مجموعة" : "Lägg till flock"}
          </Button>
        )}
      </div>

      {/* ── KPI Strip ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Card key={i}><CardContent className="pt-5"><Skeleton className="h-14 w-full" /></CardContent></Card>)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Total birds */}
          <Card className="border-border/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <Bird className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-black text-foreground">{totalChickens.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground">{ar ? "إجمالي الطيور" : "Totalt antal fåglar"}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Best producer */}
          <Card className="border-border/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <Star className="w-4 h-4 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-black text-amber-600">
                    {analytics?.topProducerAvgDaily ?? "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {analytics?.topProducerName ?? (ar ? "أفضل منتج" : "Bästa producent")}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Health status */}
          <Card className="border-border/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${sickCount > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-emerald-100 dark:bg-emerald-900/30"}`}>
                  <Heart className={`w-4 h-4 ${sickCount > 0 ? "text-red-600" : "text-emerald-600"}`} />
                </div>
                <div>
                  <div className={`text-2xl font-black ${sickCount > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {flocks.length > 0 ? `${Math.round((healthyCount / flocks.length) * 100)}%` : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {sickCount > 0
                      ? (ar ? `${sickCount} مجموعة مريضة` : `${sickCount} sjuka flockar`)
                      : (ar ? "جميع المجموعات بصحة جيدة" : "Alla flockar friska")
                    }
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weekly eggs */}
          <Card className="border-border/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                  <Egg className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <div className="text-2xl font-black text-foreground">
                    {(analytics?.totalEggs7d ?? 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {ar ? "بيض آخر ٧ أيام" : "Ägg senaste 7 dagar"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Feed Intelligence Banner ─────────────────────────────────────── */}
      {feedMap.size > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
            <Wheat className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              {ar ? "حاسبة العلف مفعّلة" : "Foderkalkylator aktiv"}
            </p>
            <p className="text-[11px] text-amber-700/70 dark:text-amber-400/70 mt-0.5">
              {ar
                ? "كل بطاقة قطيع تعرض توقع العلف اليومي والتكلفة بناءً على عمر السلالة. اضغط \"العلف\" في تفاصيل القطيع للتحليل الكامل."
                : "Varje flockskort visar daglig foderestimering och kostnad baserat på rasens ålder. Klicka \"Foder\" i detaljerna för fullständig analys."}
            </p>
          </div>
          <DollarSign className="w-4 h-4 text-amber-500 shrink-0" />
        </div>
      )}

      {/* ── Filter Bar ───────────────────────────────────────────────────── */}
      <Card className="border-border/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder={ar ? "ابحث باسم أو السلالة..." : "Sök på namn eller ras..."}
                className="ps-8 h-8 text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && <button onClick={() => setSearch("")} className="absolute end-2 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>}
            </div>

            {/* Purpose filter */}
            <Select value={filterPurpose} onValueChange={setFilterPurpose}>
              <SelectTrigger className="h-8 text-xs w-36">
                <Filter className="w-3 h-3 me-1.5" />
                <SelectValue placeholder={ar ? "الغرض" : "Syfte"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الأغراض" : "Alla syften"}</SelectItem>
                {Object.entries(PURPOSE_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.emoji} {ar ? v.labelAr : v.labelSv}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Health filter */}
            <Select value={filterHealth} onValueChange={setFilterHealth}>
              <SelectTrigger className="h-8 text-xs w-36">
                <Heart className="w-3 h-3 me-1.5" />
                <SelectValue placeholder={ar ? "الصحة" : "Hälsa"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الحالات" : "Alla statusar"}</SelectItem>
                {Object.entries(HEALTH_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{ar ? v.labelAr : v.labelSv}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 text-xs w-36">
                <ArrowUpDown className="w-3 h-3 me-1.5" />
                <SelectValue placeholder={ar ? "ترتيب" : "Sortera"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">{ar ? "حسب الاسم" : "Namn"}</SelectItem>
                <SelectItem value="age">{ar ? "حسب العمر" : "Ålder"}</SelectItem>
                <SelectItem value="production">{ar ? "حسب الإنتاج" : "Produktion"}</SelectItem>
                <SelectItem value="health">{ar ? "حسب الصحة" : "Hälsa"}</SelectItem>
                <SelectItem value="count">{ar ? "حسب العدد" : "Antal"}</SelectItem>
              </SelectContent>
            </Select>

            {/* Active filter count */}
            {(filterPurpose !== "all" || filterHealth !== "all" || search) && (
              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-muted-foreground" onClick={() => { setSearch(""); setFilterPurpose("all"); setFilterHealth("all"); }}>
                <X className="w-3 h-3" />
                {ar ? "مسح الفلاتر" : "Rensa filter"}
              </Button>
            )}

            <span className="text-xs text-muted-foreground ms-auto">
              {filtered.length} / {flocks.length} {ar ? "مجموعة" : "flockar"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Flock Grid ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-48 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Bird className="w-16 h-16 text-muted-foreground/30 mb-4" />
            {flocks.length === 0 ? (
              <>
                <h3 className="font-bold text-lg mb-1">{ar ? "لا توجد مجموعات بعد" : "Inga flockar ännu"}</h3>
                <p className="text-muted-foreground text-sm">
                  {isAdmin ? (ar ? "ابدأ بإضافة مجموعتك الأولى" : "Börja med att lägga till din första flock") : (ar ? "لا توجد مجموعات مسجلة" : "Inga registrerade flockar")}
                </p>
              </>
            ) : (
              <>
                <h3 className="font-bold text-lg mb-1">{ar ? "لا توجد نتائج" : "Inga resultat"}</h3>
                <p className="text-muted-foreground text-sm">{ar ? "جرب تغيير الفلاتر أو مصطلح البحث" : "Försök ändra filter eller sökterm"}</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(flock => (
            <FlockCard
              key={flock.id}
              flock={flock}
              isAdmin={isAdmin}
              maxEggs={maxEggs}
              feedAnalysis={feedMap.get(flock.id)}
              onDetail={() => setDetailFlock(flock)}
              onEdit={() => setEditFlock(flock)}
              onDelete={() => setDeleteId(flock.id)}
              onAddProd={() => setProdFlock(flock)}
              onAddHealth={() => setHealthFlock(flock)}
            />
          ))}
        </div>
      )}

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}

      {/* Add flock */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{ar ? "إضافة مجموعة جديدة" : "Lägg till ny flock"}</DialogTitle></DialogHeader>
          <FlockForm onSubmit={handleCreate} onClose={() => setAddOpen(false)} loading={saving} />
        </DialogContent>
      </Dialog>

      {/* Edit flock */}
      <Dialog open={!!editFlock} onOpenChange={v => !v && setEditFlock(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{ar ? "تعديل المجموعة" : "Redigera flock"}</DialogTitle></DialogHeader>
          {editFlock && <FlockForm initial={editFlock} onSubmit={handleUpdate} onClose={() => setEditFlock(null)} loading={saving} isEdit />}
        </DialogContent>
      </Dialog>

      {/* Flock detail */}
      {detailFlock && (
        <FlockDetailModal
          flock={detailFlock}
          onClose={() => setDetailFlock(null)}
          onRefresh={load}
          isAdmin={isAdmin}
          feedAnalysis={feedMap.get(detailFlock.id)}
        />
      )}

      {/* Quick: add production log */}
      <Dialog open={!!prodFlock} onOpenChange={v => !v && setProdFlock(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{ar ? "تسجيل إنتاج البيض" : "Registrera äggproduktion"}</DialogTitle></DialogHeader>
          {prodFlock && (
            <ProductionLogForm
              flockName={prodFlock.name}
              onSubmit={data => handleAddProd(prodFlock, data)}
              onClose={() => setProdFlock(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Quick: add health log */}
      <Dialog open={!!healthFlock} onOpenChange={v => !v && setHealthFlock(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{ar ? "تسجيل حدث صحي" : "Registrera hälsohändelse"}</DialogTitle></DialogHeader>
        {healthFlock && (
            <HealthLogForm
              flockName={healthFlock.name}
              onSubmit={data => handleAddHealth(healthFlock, data)}
              onClose={() => setHealthFlock(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId != null} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ar ? "تأكيد الحذف" : "Bekräfta borttagning"}</AlertDialogTitle>
            <AlertDialogDescription>
              {ar ? "سيتم حذف المجموعة وجميع سجلاتها (الإنتاج والصحة) بشكل نهائي." : "Flocken och all dess historik (produktion och hälsa) raderas permanent."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ar ? "إلغاء" : "Avbryt"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              {ar ? "نعم، احذف" : "Ja, radera"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
