/**
 * FEED INTELLIGENCE PAGE
 * Enterprise-grade feed cost analysis and egg production intelligence
 * Real AI — not cosmetic UI
 */

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wheat, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2,
  AlertCircle, Zap, Bird, Egg, BarChart3, RefreshCw, ChevronDown,
  ChevronUp, Info, Target, DollarSign, Activity, FlameKindling,
  ShieldCheck, Scale, Award,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  LineChart, Line, ReferenceLine, Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedInsight {
  severity: "critical" | "high" | "medium" | "low" | "positive";
  observation: string;
  why: string;
  action: string;
  evidence: string;
  expectedOutcome: string;
}

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
  insights: FeedInsight[];
}

interface FarmFeedSummary {
  analysisDate: string;
  periodDays: number;
  totalFeedSpend: number;
  totalFeedKg: number | null;
  totalBirds: number;
  farmCostPerBird: number;
  farmEfficiencyScore: number;
  feedCostPctOfExpenses: number;
  totalEggsProduced: number;
  farmCostPerEgg: number | null;
  farmCostPerDozen: number | null;
  benchmarkComparison: {
    feedCostPct: { actual: number; benchmark: number; status: string };
    avgFCR: { actual: number | null; benchmark: number | null; status: string };
  };
  trend: { direction: string; pctChange: number; alert: boolean };
  flockAnalyses: FlockFeedAnalysis[];
  topInsights: FeedInsight[];
  dataQuality: { hasPreciseFeedRecords: boolean; hasProductionData: boolean; completenessScore: number };
}

interface BreedBenchmark {
  id: string; nameAr: string; nameSv: string; purpose: string;
  fcr: { overall: number };
  peakProductionPct: number | null;
  peakProductionWeek: number | null;
  mortalityRate: number;
  maturityAgeDays: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string) {
  const res = await fetch(`${BASE}/api${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function severityColor(s: string) {
  return {
    critical: "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400",
    high:     "bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400",
    medium:   "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400",
    low:      "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400",
    positive: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
  }[s] ?? "bg-muted border-border";
}

function severityIcon(s: string) {
  if (s === "critical") return <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />;
  if (s === "high")     return <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />;
  if (s === "medium")   return <Info className="h-4 w-4 text-yellow-500 shrink-0" />;
  if (s === "positive") return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
  return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
}

function efficiencyLabel(score: number) {
  if (score >= 85) return { label: "ممتاز", color: "text-emerald-600 dark:text-emerald-400" };
  if (score >= 70) return { label: "جيد", color: "text-blue-600 dark:text-blue-400" };
  if (score >= 55) return { label: "مقبول", color: "text-yellow-600 dark:text-yellow-400" };
  if (score >= 40) return { label: "ضعيف", color: "text-orange-600 dark:text-orange-400" };
  return { label: "حرج", color: "text-red-600 dark:text-red-400" };
}

function stageName(stage: string) {
  const m: Record<string, string> = {
    chick: "صوص",
    starter: "بداية",
    grower: "نمو",
    "pre-layer": "ما قبل البيض",
    layer: "إنتاج بيض",
    peak: "ذروة الإنتاج",
    "post-peak": "بعد الذروة",
    finisher: "تسمين",
  };
  return m[stage] ?? stage;
}

// ─── Circular Score Gauge ──────────────────────────────────────────────────────

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const size = 120;
  const strokeW = 10;
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#3b82f6" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="currentColor" strokeWidth={strokeW} className="text-muted/30" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={strokeW}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold" style={{ color }}>{score}</div>
        <div className="text-xs text-muted-foreground">/100</div>
      </div>
      <div className="text-xs text-muted-foreground text-center">{label}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FeedIntelligence() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";

  const [summary, setSummary] = useState<FarmFeedSummary | null>(null);
  const [benchmarks, setBenchmarks] = useState<{ breeds: BreedBenchmark[]; global: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(30);
  const [expandedFlock, setExpandedFlock] = useState<number | null>(null);
  const [showBenchmarks, setShowBenchmarks] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, b] = await Promise.all([
        apiFetch(`/feed-intelligence/summary?days=${period}`),
        apiFetch("/feed-intelligence/benchmarks"),
      ]);
      setSummary(s);
      setBenchmarks(b);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="p-4 md:p-6 space-y-4" dir={isAr ? "rtl" : "ltr"}>
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );

  if (error) return (
    <div className="p-6 text-center" dir={isAr ? "rtl" : "ltr"}>
      <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-3" />
      <p className="text-destructive font-medium">{error}</p>
      <Button onClick={load} variant="outline" className="mt-3">
        <RefreshCw className="h-4 w-4 me-2" /> إعادة المحاولة
      </Button>
    </div>
  );

  if (!summary) return null;

  const eff = efficiencyLabel(summary.farmEfficiencyScore);
  const trendIcon = summary.trend.direction === "increasing"
    ? <TrendingUp className="h-4 w-4 text-red-500" />
    : summary.trend.direction === "decreasing"
    ? <TrendingDown className="h-4 w-4 text-emerald-500" />
    : <Minus className="h-4 w-4 text-muted-foreground" />;

  // Chart data: per-flock cost comparison
  const flockChartData = summary.flockAnalyses.map(f => ({
    name: f.flockName.split("—")[0].trim(),
    تكلفة_الطائر: f.feedData.costPerBird,
    نقاط_الكفاءة: f.efficiencyScore,
    علف_متوقع_جم: f.benchmark.expectedDailyFeedGrams,
  }));

  // Radar chart: farm health dimensions
  const radarData = [
    { subject: "كفاءة العلف",    A: summary.farmEfficiencyScore },
    { subject: "جودة البيانات",  A: summary.dataQuality.completenessScore },
    { subject: "نسبة التكلفة",   A: Math.max(0, 100 - (summary.feedCostPctOfExpenses - 40)) },
    { subject: "الإنتاج",        A: summary.totalEggsProduced > 0 ? 75 : 20 },
    { subject: "التنبؤ",         A: summary.benchmarkComparison.feedCostPct.status === "good" ? 85 : 50 },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5" dir={isAr ? "rtl" : "ltr"}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wheat className="h-6 w-6 text-amber-500" />
            <h1 className="text-xl font-bold">استخبارات العلف والإنتاج</h1>
            <Badge variant="outline" className="text-xs">Enterprise AI</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            تحليل تكلفة العلف بالطائر · مقارنة FCR عالمية · منحنيات الإنتاج · توصيات قابلة للتنفيذ
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border">
            {[7, 14, 30, 90].map(d => (
              <button key={d}
                onClick={() => setPeriod(d)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${period === d
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent hover:bg-muted text-muted-foreground"}`}
              >{d}د</button>
            ))}
          </div>
          <Button onClick={load} variant="outline" size="sm">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Farm Efficiency Score */}
        <Card className="col-span-2 lg:col-span-1">
          <CardContent className="pt-5 pb-4 flex flex-col items-center gap-2">
            <div className="relative flex items-center justify-center">
              <ScoreGauge score={summary.farmEfficiencyScore} label="كفاءة المزرعة" />
            </div>
            <div className={`text-sm font-semibold ${eff.color}`}>{eff.label}</div>
          </CardContent>
        </Card>

        {/* Feed Spend */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">إنفاق العلف</span>
            </div>
            <div className="text-2xl font-bold">{summary.totalFeedSpend.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {summary.feedCostPctOfExpenses}% من إجمالي المصاريف
            </div>
            <div className={`mt-2 text-xs font-medium ${
              summary.benchmarkComparison.feedCostPct.status === "good"
                ? "text-emerald-600" : summary.benchmarkComparison.feedCostPct.status === "warning"
                ? "text-yellow-600" : "text-red-600"
            }`}>
              المعيار: {summary.benchmarkComparison.feedCostPct.benchmark}% (
              {summary.benchmarkComparison.feedCostPct.status === "good" ? "✓ ضمن المعيار" :
               summary.benchmarkComparison.feedCostPct.status === "warning" ? "⚠ مرتفع قليلاً" : "✗ فوق المعيار"}
              )
            </div>
          </CardContent>
        </Card>

        {/* Per Bird */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Bird className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">تكلفة / طائر</span>
            </div>
            <div className="text-2xl font-bold">{summary.farmCostPerBird.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {summary.totalBirds.toLocaleString()} طائر في المزرعة
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              {trendIcon}
              <span>
                {summary.trend.direction === "increasing" ? "ارتفع" :
                 summary.trend.direction === "decreasing" ? "انخفض" : "مستقر"}
                {summary.trend.pctChange !== 0 ? ` ${Math.abs(summary.trend.pctChange)}%` : ""}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Cost per egg */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Egg className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">تكلفة / بيضة</span>
            </div>
            <div className="text-2xl font-bold">
              {summary.farmCostPerEgg != null ? summary.farmCostPerEgg.toLocaleString() : "—"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {summary.farmCostPerDozen != null
                ? `${summary.farmCostPerDozen.toLocaleString()} / كرتونة`
                : `${summary.totalEggsProduced.toLocaleString()} بيضة منتجة`}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {summary.dataQuality.hasProductionData
                ? <span className="text-emerald-600">✓ بيانات إنتاج متاحة</span>
                : <span className="text-orange-500">⚠ لا توجد بيانات إنتاج</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Data Quality Banner ─────────────────────────────────────────────── */}
      {summary.dataQuality.completenessScore < 60 && (
        <Card className="border-yellow-500/30 bg-yellow-50/30 dark:bg-yellow-900/10">
          <CardContent className="py-3 px-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                دقة التحليل {summary.dataQuality.completenessScore}% — البيانات ناقصة
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {!summary.dataQuality.hasPreciseFeedRecords && "أضف سجلات علف دقيقة لكل قطيع من قسم 'سجلات العلف'. "}
                {!summary.dataQuality.hasProductionData && "سجّل إنتاج البيض اليومي من صفحة القطعان لتفعيل تحليل FCR. "}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Charts Row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Bar Chart: Per-flock cost */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              تكلفة العلف ونقاط الكفاءة بالقطيع
            </CardTitle>
          </CardHeader>
          <CardContent>
            {flockChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={flockChartData} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any, name: string) => [
                    name === "نقاط_الكفاءة" ? `${v}/100` : v.toLocaleString(),
                    name === "تكلفة_الطائر" ? "تكلفة/طائر" : "كفاءة"
                  ]} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="تكلفة_الطائر" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="نقاط_الكفاءة" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                لا توجد قطعان لعرض بياناتها
              </div>
            )}
          </CardContent>
        </Card>

        {/* Radar: Farm health dimensions */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              أبعاد الصحة التشغيلية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                <Radar name="المزرعة" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Top Insights ────────────────────────────────────────────────────── */}
      {summary.topInsights.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            رؤى ذكاء العلف — قابلة للتنفيذ
          </h2>
          <div className="space-y-2">
            {summary.topInsights.map((ins, i) => (
              <InsightCard key={i} insight={ins} />
            ))}
          </div>
        </div>
      )}

      {/* ── Per-Flock Deep Dive ─────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Bird className="h-4 w-4 text-blue-500" />
          تحليل عميق لكل قطيع
        </h2>
        <div className="space-y-2">
          {summary.flockAnalyses.map(flock => (
            <FlockCard
              key={flock.flockId}
              flock={flock}
              expanded={expandedFlock === flock.flockId}
              onToggle={() => setExpandedFlock(expandedFlock === flock.flockId ? null : flock.flockId)}
            />
          ))}
          {summary.flockAnalyses.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                لا توجد قطعان مسجّلة — أضف قطيعك الأول من صفحة القطعان
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Global Benchmarks Reference ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Award className="h-4 w-4 text-purple-500" />
              معايير الأداء العالمية (Global Benchmarks)
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowBenchmarks(s => !s)}>
              {showBenchmarks ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {showBenchmarks && benchmarks && (
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 px-3 text-start font-medium text-muted-foreground">السلالة</th>
                    <th className="py-2 px-3 text-center font-medium text-muted-foreground">FCR كلي</th>
                    <th className="py-2 px-3 text-center font-medium text-muted-foreground">ذروة الإنتاج %</th>
                    <th className="py-2 px-3 text-center font-medium text-muted-foreground">أسبوع الذروة</th>
                    <th className="py-2 px-3 text-center font-medium text-muted-foreground">وفيات %</th>
                    <th className="py-2 px-3 text-center font-medium text-muted-foreground">النضج (يوم)</th>
                    <th className="py-2 px-3 text-center font-medium text-muted-foreground">الغرض</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarks.breeds.map((b: BreedBenchmark) => (
                    <tr key={b.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 font-medium">{b.nameAr}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`font-mono ${b.fcr.overall <= 2 ? "text-emerald-600" : b.fcr.overall <= 3 ? "text-blue-600" : "text-orange-600"}`}>
                          {b.fcr.overall}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {b.peakProductionPct != null ? (
                          <span className={`font-mono ${b.peakProductionPct >= 90 ? "text-emerald-600" : b.peakProductionPct >= 75 ? "text-blue-600" : "text-orange-600"}`}>
                            {b.peakProductionPct}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-2 px-3 text-center font-mono">{b.peakProductionWeek ?? "—"}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`font-mono ${b.mortalityRate <= 2.5 ? "text-emerald-600" : b.mortalityRate <= 4 ? "text-yellow-600" : "text-red-600"}`}>
                          {b.mortalityRate}%
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center font-mono">{b.maturityAgeDays}</td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant="outline" className="text-[10px]">
                          {b.purpose === "eggs" ? "بيض" : b.purpose === "meat" ? "لحم" : "مزدوج"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
              <strong>FCR (نسبة تحويل العلف):</strong> كمية العلف (كجم) لإنتاج كجم واحد من اللحم أو كرتونة واحدة من البيض.
              كلما قلّ FCR، كانت الكفاءة أعلى. المصادر: Ross 308 Manual 2022، Hy-Line Performance Standards 2023، FAO 2020.
            </div>
          </CardContent>
        )}
      </Card>

    </div>
  );
}

// ─── Insight Card Component ────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: FeedInsight }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-lg border p-3 ${severityColor(insight.severity)}`}>
      <button className="w-full text-start" onClick={() => setOpen(o => !o)}>
        <div className="flex items-start gap-2">
          {severityIcon(insight.severity)}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug">{insight.observation}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{insight.action}</p>
          </div>
          {open ? <ChevronUp className="h-4 w-4 shrink-0 mt-0.5" /> : <ChevronDown className="h-4 w-4 shrink-0 mt-0.5" />}
        </div>
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-current/20 space-y-2 text-xs">
          <div><span className="font-semibold">لماذا: </span>{insight.why}</div>
          <div><span className="font-semibold">الدليل: </span><span className="font-mono">{insight.evidence}</span></div>
          <div><span className="font-semibold">النتيجة المتوقعة: </span>{insight.expectedOutcome}</div>
        </div>
      )}
    </div>
  );
}

// ─── Flock Card Component ──────────────────────────────────────────────────────

function FlockCard({ flock, expanded, onToggle }: {
  flock: FlockFeedAnalysis;
  expanded: boolean;
  onToggle: () => void;
}) {
  const eff = efficiencyLabel(flock.efficiencyScore);
  const fcrRating = flock.benchmark.fcrRating;

  return (
    <Card className="overflow-hidden">
      <button className="w-full" onClick={onToggle}>
        <div className="flex items-center gap-3 p-4">
          {/* Score ring */}
          <div className="relative shrink-0">
            <svg width={52} height={52} className="-rotate-90">
              <circle cx={26} cy={26} r={20} fill="none" stroke="currentColor" strokeWidth={6}
                className="text-muted/30" />
              <circle cx={26} cy={26} r={20} fill="none"
                stroke={flock.efficiencyScore >= 80 ? "#10b981" : flock.efficiencyScore >= 60 ? "#3b82f6" : flock.efficiencyScore >= 40 ? "#f59e0b" : "#ef4444"}
                strokeWidth={6} strokeDasharray={125.7}
                strokeDashoffset={125.7 - (flock.efficiencyScore / 100) * 125.7}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center rotate-0">
              <span className="text-xs font-bold">{flock.efficiencyScore}</span>
            </div>
          </div>

          <div className="flex-1 min-w-0 text-start">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">{flock.flockName}</span>
              <Badge variant="outline" className="text-[10px] shrink-0">{stageName(flock.growthStage)}</Badge>
              <span className={`text-xs font-medium shrink-0 ${eff.color}`}>{eff.label}</span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground">{flock.count} طائر · {flock.ageWeeks} أسبوع · {flock.breed}</span>
              <span className="text-xs font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                {flock.feedData.costPerBird.toLocaleString()} / طائر
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {flock.insights.filter(i => i.severity === "critical" || i.severity === "high").length > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {flock.insights.filter(i => i.severity === "critical" || i.severity === "high").length} تنبيه
              </Badge>
            )}
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 space-y-4">
          {/* Metrics grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3">
            <MetricCell
              label="تكلفة يومية / طائر"
              value={`${flock.feedData.dailyCostPerBird.toFixed(2)}`}
              sub="بالوحدة المحلية"
              icon={<DollarSign className="h-3.5 w-3.5" />}
            />
            <MetricCell
              label="علف متوقع / يوم"
              value={`${flock.benchmark.expectedDailyFeedGrams.toFixed(0)} جم`}
              sub={`للطائر الواحد — ${flock.breed}`}
              icon={<Scale className="h-3.5 w-3.5" />}
            />
            <MetricCell
              label="إنتاج متوقع"
              value={`${flock.benchmark.expectedProductionPct.toFixed(1)}%`}
              sub={`فعلي: ${flock.benchmark.actualProductionPct.toFixed(1)}%`}
              icon={<Egg className="h-3.5 w-3.5" />}
              status={flock.benchmark.productionRating.rating}
            />
            <MetricCell
              label="FCR المتوقع"
              value={`${flock.benchmark.expectedFCR}`}
              sub={flock.benchmark.actualFCR != null
                ? `فعلي: ${flock.benchmark.actualFCR}`
                : "يحتاج بيانات كجم علف"}
              icon={<FlameKindling className="h-3.5 w-3.5" />}
              status={fcrRating?.efficiency}
            />
          </div>

          {/* FCR Rating Bar */}
          {fcrRating && (
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">نسبة تحويل العلف FCR</span>
                <Badge variant="outline" className={`text-[10px] ${
                  fcrRating.efficiency === "excellent" ? "border-emerald-500 text-emerald-600" :
                  fcrRating.efficiency === "good" ? "border-blue-500 text-blue-600" :
                  fcrRating.efficiency === "poor" || fcrRating.efficiency === "critical" ? "border-red-500 text-red-600" :
                  "border-yellow-500 text-yellow-600"
                }`}>{fcrRating.label}</Badge>
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                فعلي: {flock.benchmark.actualFCR} | معيار: {flock.benchmark.expectedFCR} |
                انحراف: {fcrRating.deviation > 0 ? "+" : ""}{fcrRating.deviation.toFixed(1)}%
              </div>
            </div>
          )}

          {/* Cost per output */}
          {(flock.costPerEgg != null || flock.costPerDozen != null) && (
            <div className="flex gap-3">
              {flock.costPerEgg != null && (
                <div className="flex-1 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-lg p-3 text-center">
                  <Egg className="h-4 w-4 mx-auto text-yellow-500 mb-1" />
                  <div className="text-lg font-bold">{flock.costPerEgg.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">تكلفة العلف / بيضة</div>
                </div>
              )}
              {flock.costPerDozen != null && (
                <div className="flex-1 bg-amber-50/50 dark:bg-amber-900/10 rounded-lg p-3 text-center">
                  <Target className="h-4 w-4 mx-auto text-amber-500 mb-1" />
                  <div className="text-lg font-bold">{flock.costPerDozen.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">تكلفة العلف / كرتونة</div>
                </div>
              )}
            </div>
          )}

          {/* Flock-specific insights */}
          {flock.insights.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">رؤى خاصة بهذا القطيع:</p>
              {flock.insights.map((ins, i) => (
                <InsightCard key={i} insight={ins} />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Metric Cell ──────────────────────────────────────────────────────────────

function MetricCell({ label, value, sub, icon, status }: {
  label: string; value: string; sub?: string; icon?: React.ReactNode;
  status?: string;
}) {
  const statusColor = {
    excellent: "text-emerald-600",
    good: "text-blue-600",
    acceptable: "text-yellow-600",
    poor: "text-orange-600",
    critical: "text-red-600",
    low: "text-orange-600",
  }[status ?? ""] ?? "";

  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <div className="flex items-center gap-1 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px]">{label}</span>
      </div>
      <div className={`text-base font-bold font-mono ${statusColor}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
