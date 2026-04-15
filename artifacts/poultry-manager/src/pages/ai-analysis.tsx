import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldAlert, Loader2, Sparkles, AlertTriangle, CheckCircle2,
  Zap, Activity, TrendingUp, TrendingDown, Minus,
  Shield, Target, RefreshCw, ArrowUpRight, Clock, Flame,
  BarChart3, Database, ChevronRight, AlertCircle,
  ExternalLink, ClipboardList, Star, X, Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ToolMode = null | "full" | "admin";

interface LiveInsight {
  id: string; icon: string; title: string; value: string; unit: string;
  detail: string; status: "good" | "warning" | "critical" | "neutral";
  trend?: "up" | "down" | "stable"; badge?: string;
}
interface Alert { type: string; title: string; description: string; severity?: number; category?: string; }
interface Recommendation { priority: string; title: string; description: string; reason: string; impact: string; confidence: number; category?: string; }
interface Prediction { title: string; description: string; confidence: string; probability?: number; timeframe?: string; }
interface Anomaly { title: string; description: string; severity: string; metric: string; currentValue: string; expectedRange: string; category?: string; }
interface SectionItem { label: string; value: string; status: string; detail?: string; }
interface Section { icon: string; title: string; category: string; items: SectionItem[]; healthScore: number; }

interface FarmAnalysis {
  score: number; scoreLabel: string;
  scoreBreakdown?: { category: string; score: number; weight: number; label: string }[];
  alerts: Alert[]; anomalies?: Anomaly[]; sections?: Section[];
  recommendations?: Recommendation[]; predictions: Prediction[];
  errors: { title: string; description: string; solution: string }[];
  topPriority: string;
  futureRisk?: { level: string; title: string; summary: string; horizon: string; triggers: string[]; actions: string[]; };
  summary?: string; liveInsights?: LiveInsight[];
  dataQuality?: { score: number; label: string; issues: string[] };
}

const INSIGHT_NAV: Record<string, string> = {
  birds: "/flocks", hatching: "/hatching", hatchrate: "/hatching",
  tasks: "/tasks", goals: "/goals", completion: "/tasks",
};

const ALERT_CAT_NAV: Record<string, string> = {
  biological: "/flocks", environment: "/hatching", incubation: "/hatching",
  operational: "/tasks", goals: "/goals", documentation: "/logs",
};

export default function AiAnalysis() {
  const { isAdmin } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [analysis, setAnalysis] = useState<FarmAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [tool, setTool] = useState<ToolMode>(null);
  const [quickSolveIssue, setQuickSolveIssue] = useState<{ title: string; description: string; category?: string } | null>(null);
  const [quickSolveResult, setQuickSolveResult] = useState<{
    steps: { icon: string; title: string; detail: string; urgency: string }[];
    summary: string; timeframe: string; relatedFacts: string[];
  } | null>(null);
  const [quickSolving, setQuickSolving] = useState(false);

  const isSv = lang === "sv";

  /* ── Different loading messages per tool ── */
  const loadingStepsFull = isSv
    ? ["Läser flockar i realtid...", "Kontrollerar temperatur...", "Söker aktiva varningar...", "Analyserar dagliga uppgifter...", "Beräknar hälsostatus...", "Genererar omedelbara åtgärder..."]
    : ["قراءة بيانات القطعان الآن...", "فحص درجات الحرارة...", "البحث عن التنبيهات النشطة...", "تحليل المهام اليومية...", "حساب صحة المزرعة...", "توليد الإجراءات الفورية..."];

  const loadingStepsAdmin = isSv
    ? ["Kompilerar produktionsdata...", "Beräknar kläckningsstatistik...", "Analyserar uppgiftsmönster...", "Mäter dokumentationskvalitet...", "Identifierar avvikelser...", "Genererar ledningsrapport..."]
    : ["تجميع بيانات الإنتاج...", "حساب إحصائيات التفقيس...", "تحليل أنماط المهام...", "قياس جودة التوثيق...", "كشف الشذوذات...", "إنشاء التقرير الإداري..."];

  const analyzeSteps = tool === "admin" ? loadingStepsAdmin : loadingStepsFull;

  useEffect(() => {
    if (!analyzing) return;
    let step = 0;
    const interval = setInterval(() => { step = (step + 1) % analyzeSteps.length; setAnalyzeStep(step); }, 650);
    return () => clearInterval(interval);
  }, [analyzing, tool]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail === "/ai") { setAnalysis(null); setTool(null); }
    };
    window.addEventListener("nav-reset", handler);
    return () => window.removeEventListener("nav-reset", handler);
  }, []);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <ShieldAlert className="w-16 h-16 text-muted-foreground/40" />
        <h2 className="text-xl font-bold">{t("ai.restricted")}</h2>
        <p className="text-muted-foreground">{t("ai.adminOnly")}</p>
      </div>
    );
  }

  const runAnalysis = async (selectedTool: ToolMode) => {
    setTool(selectedTool); setAnalyzing(true); setAnalyzeStep(0); setAnalysis(null);
    try {
      const res = await fetch("/api/ai/analyze-farm", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "error"); }
      const data = await res.json();
      setAnalysis(data.analysis);
    } catch (err: any) {
      toast({ title: isSv ? "Fel" : "خطأ", description: err.message, variant: "destructive" });
      setTool(null);
    } finally { setAnalyzing(false); }
  };

  const openQuickSolve = async (issue: { title: string; description: string; category?: string }) => {
    setQuickSolveIssue(issue);
    setQuickSolveResult(null);
    setQuickSolving(true);
    try {
      const res = await fetch("/api/ai/quick-solve", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...issue, lang }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "error"); }
      const data = await res.json();
      setQuickSolveResult(data.result);
    } catch (err: any) {
      toast({ title: isSv ? "Fel" : "خطأ", description: err.message, variant: "destructive" });
    } finally { setQuickSolving(false); }
  };

  const closeQuickSolve = () => { setQuickSolveIssue(null); setQuickSolveResult(null); setQuickSolving(false); };

  /* ── Helpers ── */
  const getScoreColor = (s: number) => s >= 80 ? "text-emerald-600" : s >= 60 ? "text-amber-500" : "text-red-500";
  const getRingColor  = (s: number) => s >= 80 ? "stroke-emerald-500" : s >= 60 ? "stroke-amber-500" : "stroke-red-500";
  const getBarColor   = (s: number) => s >= 80 ? "bg-emerald-500" : s >= 60 ? "bg-amber-500" : "bg-red-500";

  const insightStyle = (status: LiveInsight["status"]) => ({
    card: status === "good"     ? "border-emerald-200/60 bg-emerald-50/30 dark:bg-emerald-950/20 dark:border-emerald-800/40 hover:border-emerald-400/60"
        : status === "warning"  ? "border-amber-200/60 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-800/40 hover:border-amber-400/60"
        : status === "critical" ? "border-red-200/60 bg-red-50/30 dark:bg-red-950/20 dark:border-red-800/40 hover:border-red-400/60"
        : "border-border/60 bg-muted/20 hover:border-border",
    value: status === "good"     ? "text-emerald-600 dark:text-emerald-400"
         : status === "warning"  ? "text-amber-600 dark:text-amber-400"
         : status === "critical" ? "text-red-600 dark:text-red-400"
         : "text-foreground",
    dot: status === "good" ? "bg-emerald-500" : status === "warning" ? "bg-amber-500" : status === "critical" ? "bg-red-500" : "bg-muted-foreground/40",
  });

  const alertCardCls = (type: string) =>
    type === "danger"  ? "border-red-200 bg-red-50/40 dark:bg-red-950/20"
    : type === "warning" ? "border-amber-200 bg-amber-50/40 dark:bg-amber-950/20"
    : "border-blue-200 bg-blue-50/40 dark:bg-blue-950/20";

  const alertDotCls = (type: string) =>
    type === "danger" ? "bg-red-500" : type === "warning" ? "bg-amber-500" : type === "success" ? "bg-emerald-500" : "bg-blue-500";

  const priorityBadgeCls = (p: string) =>
    p === "urgent" ? "bg-red-500 text-white" : p === "high" ? "bg-orange-500 text-white"
    : p === "medium" ? "bg-amber-500 text-white" : "bg-blue-500 text-white";

  const priorityLabel = (p: string) => {
    if (isSv) { switch(p) { case "urgent": return "Brådskande"; case "high": return "Hög"; case "medium": return "Medel"; default: return "Låg"; } }
    switch(p) { case "urgent": return "عاجل"; case "high": return "مهم"; case "medium": return "متوسط"; default: return "عادي"; }
  };

  const TrendIcon = ({ trend }: { trend?: string }) =>
    trend === "up"   ? <TrendingUp   className="w-3 h-3 text-emerald-500" />
    : trend === "down" ? <TrendingDown className="w-3 h-3 text-red-500" />
    : <Minus className="w-3 h-3 text-muted-foreground/60" />;

  const ScoreRing = ({ score, size = 88 }: { score: number; size?: number }) => {
    const r = (size - 10) / 2; const circ = 2 * Math.PI * r; const offset = circ - (score / 100) * circ;
    return (
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-muted/30" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth="7" strokeLinecap="round"
            className={getRingColor(score)} strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className={cn("text-2xl font-black tabular-nums leading-none", getScoreColor(score))}>{score}</span>
          <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">/100</span>
        </div>
      </div>
    );
  };

  /* Filtered data for each tool */
  const urgentRecs   = (analysis?.recommendations ?? []).filter(r => r.priority === "urgent" || r.priority === "high").slice(0, 4);
  const allRecs      = (analysis?.recommendations ?? []).slice(0, 6);
  const activeAlerts = (analysis?.alerts ?? []).filter(a => a.type === "danger" || a.type === "warning").slice(0, 5);
  const shortPreds   = (analysis?.predictions ?? []).slice(0, 4);

  /* ─────────────────────────────────── */
  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-5rem)]">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg",
            tool === "admin" ? "bg-gradient-to-br from-teal-500 to-emerald-600 shadow-teal-500/25"
            : "bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/25")}>
            {tool === "admin" ? <BarChart3 className="w-5 h-5 text-white" /> : <Activity className="w-5 h-5 text-white" />}
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">
              {tool === "admin" ? (isSv ? "Precisionsledningsrapport" : "التقرير الإداري الدقيق")
               : (isSv ? "Intelligent analysmotor" : "محرك التحليل الذكي")}
            </h1>
            <p className="text-xs text-muted-foreground">
              {tool === "admin" ? (isSv ? "أداء الفترة · مؤشرات مفصّلة" : "أداء الفترة · مؤشرات مفصّلة")
               : (isSv ? "Status i realtid · Omedelbara åtgärder" : "الحالة الآن · الإجراءات الفورية")}
            </p>
          </div>
        </div>
        {analysis && !analyzing && (
          <Button onClick={() => { setAnalysis(null); setTool(null); }} variant="ghost" size="sm" className="gap-1.5 text-xs h-8 text-muted-foreground">
            <ChevronRight className="w-3.5 h-3.5" />{isSv ? "Tillbaka" : "رجوع"}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">

        {/* ─── TOOL SELECTION ─── */}
        {!analysis && !analyzing && (
          <div className="flex flex-col items-center justify-center py-8 space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/15 to-teal-500/15 border border-violet-200/40 flex items-center justify-center">
              <Activity className="w-10 h-10 text-violet-500" />
            </div>
            <div className="text-center space-y-1 max-w-xs">
              <h2 className="text-lg font-bold">{isSv ? "Välj analysverktyg" : "اختر أداة التحليل"}</h2>
              <p className="text-sm text-muted-foreground">
                {isSv ? "كل أداة تعرض منظوراً مختلفاً تماماً عن مزرعتك" : "كل أداة تعرض منظوراً مختلفاً تماماً عن مزرعتك"}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl px-2">

              {/* Tool 1 Card */}
              <button onClick={() => runAnalysis("full")}
                className="group text-right rounded-2xl border-2 border-violet-200/60 bg-gradient-to-br from-violet-50/60 to-indigo-50/30 dark:from-violet-950/20 dark:to-indigo-950/10 dark:border-violet-800/40 p-5 hover:border-violet-400/80 hover:shadow-lg hover:shadow-violet-500/10 transition-all duration-200">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-violet-500/20 group-hover:scale-105 transition-transform">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{isSv ? "محرك المزرعة الذكي" : "محرك المزرعة الذكي"}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-5">
                      {isSv ? "ما يجري الآن · الأخطار الفورية · اتخذ قرارك الآن" : "ما يجري الآن · الأخطار الفورية · اتخذ قرارك الآن"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["🟢 صحة المزرعة", "🔴 تنبيهات فورية", "⚡ إجراء عاجل", "🔮 توقعات قريبة"].map(tag => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium">{tag}</span>
                  ))}
                </div>
              </button>

              {/* Tool 2 Card */}
              <button onClick={() => runAnalysis("admin")}
                className="group text-right rounded-2xl border-2 border-teal-200/60 bg-gradient-to-br from-teal-50/60 to-emerald-50/30 dark:from-teal-950/20 dark:to-emerald-950/10 dark:border-teal-800/40 p-5 hover:border-teal-400/80 hover:shadow-lg hover:shadow-teal-500/10 transition-all duration-200">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{isSv ? "التقرير الإداري الدقيق" : "التقرير الإداري الدقيق"}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-5">
                      {isSv ? "أداء الفترة · تفاصيل الأقسام · قرارات إدارية" : "أداء الفترة · تفاصيل الأقسام · قرارات إدارية"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["📊 مؤشر الأداء", "🌡️ حرارة الحاضنة", "🥚 الإنتاج", "✅ إنجاز المهام", "📋 التوثيق"].map(tag => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium">{tag}</span>
                  ))}
                </div>
              </button>

            </div>
          </div>
        )}

        {/* ─── LOADING ─── */}
        {analyzing && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-5">
            <div className="relative w-24 h-24">
              <div className={cn("absolute inset-0 rounded-3xl animate-pulse", tool === "admin" ? "bg-teal-500/15" : "bg-violet-500/15")} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className={cn("w-10 h-10 animate-spin", tool === "admin" ? "text-teal-500" : "text-violet-500")} />
              </div>
            </div>
            <p className="font-bold text-lg">{t("ai.analyzing")}</p>
            <p className={cn("text-sm font-medium animate-pulse min-h-[20px]", tool === "admin" ? "text-teal-600 dark:text-teal-400" : "text-violet-600 dark:text-violet-400")}>
              {analyzeSteps[analyzeStep]}
            </p>
            <div className="flex gap-1.5 mt-2">
              {analyzeSteps.map((_, i) => (
                <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-all duration-300",
                  i === analyzeStep ? (tool === "admin" ? "bg-teal-500" : "bg-violet-500") + " scale-125" : "bg-muted")} />
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TOOL 1 — محرك المزرعة الذكي
            الحالة الآن + التنبيهات + الإجراءات العاجلة
        ══════════════════════════════════════════════ */}
        {analysis && !analyzing && tool === "full" && (
          <div className="space-y-4">

            {/* ① صحة المزرعة اللحظية */}
            <Card className="border-border/60 shadow-md overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500" />
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                  <div className="flex flex-col items-center gap-1">
                    <ScoreRing score={analysis.score} size={92} />
                    <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                      {isSv ? "Hälsostatus" : "صحة المزرعة"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-2xl font-black leading-tight", getScoreColor(analysis.score))}>{analysis.scoreLabel}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 mb-3">{isSv ? "Hälsoindex just nu — baserat på aktiva data" : "مؤشر الصحة الآن — بناءً على البيانات المباشرة"}</p>
                    {/* أهم إجراء الآن */}
                    <div className="rounded-xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200/50 dark:border-violet-800/40 p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Flame className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                        <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">{isSv ? "Viktigaste åtgärd just nu" : "الإجراء العاجل الآن"}</span>
                      </div>
                      <p className="text-sm font-semibold leading-6 text-foreground/90">{analysis.topPriority}</p>
                    </div>
                  </div>
                  <Button onClick={() => runAnalysis("full")} variant="outline" size="sm" className="gap-1.5 rounded-full text-xs h-8 flex-shrink-0">
                    <RefreshCw className="w-3.5 h-3.5" />{isSv ? "Uppdatera" : "تحديث"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ② الحالة المباشرة — 6 بطاقات LIVE (حصرياً هنا) */}
            {analysis.liveInsights && analysis.liveInsights.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-1.5 h-4 rounded-full bg-gradient-to-b from-violet-500 to-indigo-500" />
                  <h2 className="text-sm font-bold">{isSv ? "Realtidsstatus · Klicka för att navigera" : "الحالة المباشرة · اضغط للانتقال"}</h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 font-bold ml-auto animate-pulse">● LIVE</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {analysis.liveInsights.map((ins) => {
                    const s = insightStyle(ins.status);
                    const navPath = INSIGHT_NAV[ins.id];
                    return (
                      <button key={ins.id} onClick={() => navPath && navigate(navPath)}
                        className={cn("rounded-2xl border p-4 flex flex-col gap-2 transition-all text-right group", s.card, navPath ? "cursor-pointer hover:shadow-md active:scale-[0.98]" : "")}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl leading-none">{ins.icon}</span>
                            <p className="text-[11px] font-semibold text-muted-foreground leading-tight">{ins.title}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {ins.trend && <TrendIcon trend={ins.trend} />}
                            {navPath && <ExternalLink className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />}
                          </div>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span className={cn("text-2xl font-black tabular-nums leading-none", s.value)}>{ins.value}</span>
                          <span className="text-[11px] text-muted-foreground font-medium">{ins.unit}</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0", s.dot)} />
                          <p className="text-[11px] text-muted-foreground leading-5">{ins.detail}</p>
                        </div>
                        {ins.badge && (
                          <span className={cn("self-start text-[10px] px-2 py-0.5 rounded-full font-semibold",
                            ins.status === "good" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : ins.status === "warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                            : ins.status === "critical" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                            : "bg-muted text-muted-foreground")}>{ins.badge}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ③ التنبيهات الفورية (حصرياً هنا) */}
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="font-bold text-sm">{isSv ? "Aktiva varningar — kräver åtgärd nu" : "التنبيهات الفورية — تستلزم تدخلاً الآن"}</h3>
                  {activeAlerts.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-bold ml-auto">{activeAlerts.length}</span>
                  )}
                </div>
                {activeAlerts.length === 0 ? (
                  <div className="flex flex-col items-center py-5 text-center gap-2">
                    <CheckCircle2 className="w-9 h-9 text-emerald-500" />
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{isSv ? "لا توجد تنبيهات فورية — المزرعة مستقرة" : "لا توجد تنبيهات فورية — المزرعة مستقرة"}</p>
                  </div>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    {activeAlerts.map((a, i) => {
                      const navPath = a.category ? ALERT_CAT_NAV[a.category] : null;
                      return (
                        <div key={i} className={cn("rounded-2xl border p-3.5 group", alertCardCls(a.type))}>
                          <div className="flex items-start gap-2">
                            <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0", alertDotCls(a.type))} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <p className="text-sm font-semibold leading-tight">{a.title}</p>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 leading-5">{a.description}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  onClick={() => openQuickSolve({ title: a.title, description: a.description, category: a.category })}
                                  className="flex items-center gap-1 text-[11px] font-semibold text-violet-700 dark:text-violet-400 hover:text-violet-900 dark:hover:text-violet-300 transition-colors"
                                >
                                  <Lightbulb className="w-3 h-3" />{isSv ? "Lösning" : "حل سريع"}
                                </button>
                                {navPath && (
                                  <button onClick={() => navigate(navPath)} className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                                    <ExternalLink className="w-3 h-3" />{isSv ? "Öppna" : "فتح"}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ④ التوصيات العاجلة فقط (urgent + high — حصرياً هنا) */}
            {urgentRecs.length > 0 && (
              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <h3 className="font-bold text-sm">{isSv ? "Åtgärder att ta nu — hög prioritet" : "إجراءات عاجلة — أولوية عالية فقط"}</h3>
                  </div>
                  <div className="space-y-2">
                    {urgentRecs.map((r, i) => {
                      const navPath = r.category ? ALERT_CAT_NAV[r.category] : null;
                      return (
                        <div key={i} onClick={() => navPath && navigate(navPath)}
                          className={cn("rounded-2xl border border-border/60 p-3.5 bg-muted/10 group", navPath ? "cursor-pointer hover:bg-muted/20 active:scale-[0.99] transition-all" : "")}>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-semibold leading-tight flex-1">{r.title}</p>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold", priorityBadgeCls(r.priority))}>{priorityLabel(r.priority)}</span>
                              {navPath && <ExternalLink className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground leading-5">{r.description}</p>
                          {r.impact && (
                            <div className="flex items-center gap-1 mt-1.5">
                              <ArrowUpRight className="w-3 h-3 text-violet-500 flex-shrink-0" />
                              <p className="text-[11px] text-violet-700 dark:text-violet-400 font-medium">{r.impact}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ⑤ توقعات قصيرة المدى (حصرياً هنا) */}
            {shortPreds.length > 0 && (
              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="font-bold text-sm">{isSv ? "Prognoser — närmaste dagarna" : "توقعات الأيام القادمة القريبة"}</h3>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {shortPreds.map((p, i) => (
                      <div key={i} className="rounded-2xl border border-border/60 p-3.5 bg-muted/10">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold leading-tight">{p.title}</p>
                          {p.timeframe && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-semibold flex-shrink-0">{p.timeframe}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-5">{p.description}</p>
                        {p.probability != null && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-muted-foreground">{isSv ? "Sannolikhet" : "الاحتمالية"}</span>
                              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">{p.probability}%</span>
                            </div>
                            <div className="h-1 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${p.probability}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TOOL 2 — التقرير الإداري الدقيق
            مؤشر الأداء + الأقسام + الشذوذ + جميع التوصيات
        ══════════════════════════════════════════════════════ */}
        {analysis && !analyzing && tool === "admin" && (
          <div className="space-y-4">

            {/* ① مؤشر الأداء المركّب + شرائط الأقسام (حصرياً هنا) */}
            <Card className="border-border/60 shadow-md overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500" />
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-5">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <ScoreRing score={analysis.score} size={92} />
                    <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
                      {isSv ? "Prestanda" : "مؤشر الأداء"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className={cn("text-xl font-black leading-tight", getScoreColor(analysis.score))}>{analysis.scoreLabel}</p>
                        <p className="text-xs text-muted-foreground">{isSv ? "Sammansatt prestationsindex för perioden" : "مؤشر الأداء المركّب للفترة"}</p>
                      </div>
                      <Button onClick={() => runAnalysis("admin")} variant="outline" size="sm" className="gap-1.5 rounded-full text-xs h-8 flex-shrink-0">
                        <RefreshCw className="w-3.5 h-3.5" />{isSv ? "Uppdatera" : "تحديث"}
                      </Button>
                    </div>
                    {/* شرائط الأقسام الأربعة */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {analysis.scoreBreakdown?.map((s, i) => (
                        <div key={i} className="rounded-xl border border-border/50 bg-muted/10 p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-[10px] text-muted-foreground font-medium truncate leading-tight">{s.category}</p>
                            <p className={cn("text-sm font-black tabular-nums flex-shrink-0", getScoreColor(s.score))}>{s.score}</p>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all duration-700", getBarColor(s.score))} style={{ width: `${s.score}%` }} />
                          </div>
                          <p className="text-[9px] text-muted-foreground leading-none">{s.label} · {s.weight}%</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ② تقرير الأقسام التفصيلي (حصرياً هنا) */}
            {analysis.sections && analysis.sections.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-1.5 h-4 rounded-full bg-gradient-to-b from-teal-500 to-emerald-500" />
                  <h2 className="text-sm font-bold">{isSv ? "Detaljerade sektionsresultat" : "تقرير الأقسام التفصيلي"}</h2>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  {analysis.sections.map((sec, si) => {
                    const secNav = sec.category === "operational" ? "/tasks" : sec.category === "biological" ? "/flocks" : "/hatching";
                    return (
                      <Card key={si} className="border-border/60 shadow-sm">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <button onClick={() => navigate(secNav)} className="flex items-center gap-2 hover:opacity-80 transition-opacity group">
                              <span className="text-lg leading-none">{sec.icon}</span>
                              <p className="text-sm font-bold group-hover:underline underline-offset-2 leading-tight">{sec.title}</p>
                              <ExternalLink className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                            </button>
                            <div className="flex items-center gap-0.5">
                              <span className={cn("text-lg font-black tabular-nums", getScoreColor(sec.healthScore))}>{sec.healthScore}</span>
                              <span className="text-[10px] text-muted-foreground">/100</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all duration-700", getBarColor(sec.healthScore))} style={{ width: `${sec.healthScore}%` }} />
                          </div>
                          <div className="space-y-1.5">
                            {sec.items.slice(0, 7).map((item, ii) => (
                              <div key={ii} className="flex items-start gap-2 py-1 border-b border-border/30 last:border-0">
                                <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                                  item.status === "good" ? "bg-emerald-500" : item.status === "warning" ? "bg-amber-500" : item.status === "danger" ? "bg-red-500" : "bg-muted-foreground/30")} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <p className="text-[11px] text-muted-foreground truncate">{item.label}</p>
                                    <p className="text-[11px] font-bold flex-shrink-0">{item.value}</p>
                                  </div>
                                  {item.detail && <p className="text-[10px] text-muted-foreground/60 mt-0.5 leading-4">{item.detail}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ③ الشذوذات والانحرافات (حصرياً هنا) */}
            {analysis.anomalies && analysis.anomalies.length > 0 && (
              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <h3 className="font-bold text-sm">{isSv ? "Avvikelser och anomalier" : "الشذوذات والانحرافات عن المعيار"}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-bold ml-auto">{analysis.anomalies.length}</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {analysis.anomalies.map((an, i) => (
                      <div key={i} className="rounded-xl border border-orange-200/60 bg-orange-50/30 dark:bg-orange-950/10 p-3.5">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-semibold leading-tight">{an.title}</p>
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0",
                            an.severity === "high" || an.severity === "critical" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300")}>
                            {an.severity === "critical" ? (isSv ? "Kritisk" : "حرج") : an.severity === "high" ? (isSv ? "Hög" : "عالٍ") : (isSv ? "Medel" : "متوسط")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-5 mb-2">{an.description}</p>
                        <div className="flex items-center gap-3 text-[10px]">
                          <span className="font-medium text-red-600 dark:text-red-400">{isSv ? "Nuv." : "الحالي"}: {an.currentValue}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">{isSv ? "Förväntat" : "المتوقع"}: {an.expectedRange}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ④ جميع التوصيات الإدارية (حصرياً هنا — كلها ليس فقط العاجلة) */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                      <ClipboardList className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    </div>
                    <h3 className="font-bold text-sm">{isSv ? "Alla förvaltningsrekommendationer" : "جميع التوصيات الإدارية"}</h3>
                    {allRecs.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-bold ml-auto">{allRecs.length}</span>}
                  </div>
                  <div className="space-y-2">
                    {allRecs.map((r, i) => {
                      const navPath = r.category ? ALERT_CAT_NAV[r.category] : null;
                      return (
                        <div key={i} onClick={() => navPath && navigate(navPath)}
                          className={cn("rounded-xl border border-border/60 p-3 bg-muted/10 group", navPath ? "cursor-pointer hover:bg-muted/20 active:scale-[0.99] transition-all" : "")}>
                          <div className="flex items-start gap-2">
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold mt-0.5 flex-shrink-0 tabular-nums", priorityBadgeCls(r.priority))}>{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <p className="text-xs font-semibold leading-tight">{r.title}</p>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold", priorityBadgeCls(r.priority))}>{priorityLabel(r.priority)}</span>
                                  {navPath && <ExternalLink className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />}
                                </div>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5 leading-4">{r.reason}</p>
                              {r.impact && <p className="text-[10px] text-teal-700 dark:text-teal-400 font-medium mt-1">→ {r.impact}</p>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {allRecs.length === 0 && (
                      <div className="flex flex-col items-center py-4 gap-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{isSv ? "لا توصيات إضافية" : "لا توصيات إضافية"}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* ⑤ التوثيق + أفق المخاطرة (حصرياً هنا) */}
              <div className="space-y-4">
                {analysis.dataQuality && (
                  <Card className="border-border/60 shadow-sm">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <button onClick={() => navigate("/notes")} className="flex items-center gap-1 hover:underline underline-offset-2 group">
                          <h3 className="font-bold text-sm">{isSv ? "Dokumentation & Uppföljning" : "التوثيق والمتابعة"}</h3>
                          <ExternalLink className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                        </button>
                        <div className="ml-auto flex items-center gap-1.5">
                          <span className={cn("text-lg font-black tabular-nums", getScoreColor(analysis.dataQuality.score))}>{analysis.dataQuality.score}</span>
                          <span className="text-xs text-muted-foreground">— {analysis.dataQuality.label}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-700", getBarColor(analysis.dataQuality.score))} style={{ width: `${analysis.dataQuality.score}%` }} />
                      </div>
                      {analysis.dataQuality.issues.length > 0 ? (
                        <div className="space-y-1">
                          {analysis.dataQuality.issues.slice(0, 3).map((issue, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                              <p className="text-[11px] text-muted-foreground leading-5">{issue}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <p className="text-sm font-medium">{isSv ? "التوثيق منتظم وكامل" : "التوثيق منتظم وكامل"}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* أفق المخاطرة الاستراتيجي (حصرياً هنا) */}
                {analysis.futureRisk && (
                  <Card className="border-border/60 shadow-sm">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h3 className="font-bold text-sm">{isSv ? "Strategisk riskhorisont" : "أفق المخاطرة الاستراتيجي"}</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-semibold ml-auto">
                          <Clock className="w-2.5 h-2.5 inline-block mb-0.5 ml-0.5" />{analysis.futureRisk.horizon}
                        </span>
                      </div>
                      <p className="text-sm font-bold">{analysis.futureRisk.title}</p>
                      <p className="text-xs text-muted-foreground leading-5">{analysis.futureRisk.summary}</p>
                      {analysis.futureRisk.actions.slice(0, 3).map((a, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <Star className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                          <p className="text-[11px] text-foreground/80 leading-5">{a}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* ⑥ المشاكل الحرجة (حصرياً هنا) */}
            {analysis.errors && analysis.errors.length > 0 && (
              <Card className="border-red-200/60 shadow-sm bg-red-50/20 dark:bg-red-950/10">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="font-bold text-sm text-red-700 dark:text-red-400">{isSv ? "Kritiska problem — kräver ledningsåtgärd" : "مشاكل حرجة تستلزم تدخلاً إدارياً"}</h3>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {analysis.errors.map((e, i) => (
                      <div key={i} className="rounded-2xl border border-red-200 bg-white/60 dark:bg-red-950/20 p-4">
                        <p className="text-sm font-bold text-red-700 dark:text-red-400">{e.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-5">{e.description}</p>
                        <div className="mt-2 pt-2 border-t border-red-100 dark:border-red-800/40 flex items-start gap-1.5">
                          <ArrowUpRight className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-red-700 dark:text-red-400 font-medium">{e.solution}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        )}

      </div>

      {/* ── Quick Solve Modal ── */}
      {quickSolveIssue && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeQuickSolve} />
          <div className="relative bg-background border border-border/60 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md mx-auto max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 p-5 border-b border-border/60 flex-shrink-0">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-0.5">{isSv ? "Snabblösning" : "الحل السريع"}</p>
                <p className="text-sm font-semibold leading-tight line-clamp-1">{quickSolveIssue.title}</p>
              </div>
              <button onClick={closeQuickSolve} aria-label={isSv ? "Stäng" : "إغلاق"} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {quickSolving ? (
                <div className="flex flex-col items-center py-10 gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-violet-600 animate-spin" />
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">{isSv ? "Analyserar och genererar lösning..." : "تحليل البيانات وإنشاء الحل..."}</p>
                </div>
              ) : quickSolveResult ? (
                <>
                  {/* Summary */}
                  <div className="rounded-2xl bg-violet-50 dark:bg-violet-950/20 border border-violet-200/60 dark:border-violet-800/40 p-4">
                    <p className="text-sm leading-6 text-violet-900 dark:text-violet-200">{quickSolveResult.summary}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <Clock className="w-3.5 h-3.5 text-violet-500" />
                      <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-400">{isSv ? "Tidsram" : "الإطار الزمني"}: {quickSolveResult.timeframe}</span>
                    </div>
                  </div>

                  {/* Related Facts */}
                  {quickSolveResult.relatedFacts.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{isSv ? "Data från gården" : "بيانات المزرعة"}</p>
                      {quickSolveResult.relatedFacts.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-xl bg-muted/20 px-3 py-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                          <p className="text-xs text-muted-foreground">{f}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Steps */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{isSv ? "Åtgärdssteg" : "خطوات العمل"}</p>
                    {quickSolveResult.steps.map((step, i) => {
                      const urgencyCls = step.urgency === "critical"
                        ? "border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800/40"
                        : step.urgency === "high"
                          ? "border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-800/40"
                          : "border-border/60 bg-muted/10";
                      const urgencyDot = step.urgency === "critical" ? "bg-red-500" : step.urgency === "high" ? "bg-orange-500" : "bg-blue-500";
                      return (
                        <div key={i} className={cn("rounded-2xl border p-3.5 flex gap-3", urgencyCls)}>
                          <div className="flex-shrink-0 flex flex-col items-center gap-1">
                            <span className="text-xl leading-none">{step.icon}</span>
                            <div className={cn("w-1.5 h-1.5 rounded-full", urgencyDot)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold leading-tight">{step.title}</p>
                            <p className="text-xs text-muted-foreground mt-1 leading-5">{step.detail}</p>
                          </div>
                          <span className="text-[10px] font-bold text-muted-foreground flex-shrink-0 self-start">#{i + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
