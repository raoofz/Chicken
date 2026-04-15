import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldAlert, Loader2, Sparkles, AlertTriangle, CheckCircle2,
  Zap, Activity, TrendingUp, TrendingDown, Minus,
  Shield, Target, RefreshCw, ArrowUpRight, Clock, Flame,
  BarChart3, Microscope, Thermometer, Settings2, Database,
  ChevronRight, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

type ToolMode = null | "full" | "perf";

interface LiveInsight {
  id: string; icon: string; title: string; value: string; unit: string;
  detail: string; status: "good" | "warning" | "critical" | "neutral";
  trend?: "up" | "down" | "stable"; badge?: string;
}
interface Alert { type: string; title: string; description: string; severity?: number; }
interface Recommendation { priority: string; title: string; description: string; reason: string; impact: string; confidence: number; }
interface Prediction { title: string; description: string; confidence: string; probability?: number; timeframe?: string; }
interface Anomaly { title: string; description: string; severity: string; metric: string; currentValue: string; expectedRange: string; }
interface SectionItem { label: string; value: string; status: string; detail?: string; }
interface Section { icon: string; title: string; category: string; items: SectionItem[]; healthScore: number; }

interface FarmAnalysis {
  score: number;
  scoreLabel: string;
  scoreBreakdown?: { category: string; score: number; weight: number; label: string }[];
  alerts: Alert[];
  anomalies?: Anomaly[];
  sections?: Section[];
  recommendations?: Recommendation[];
  predictions: Prediction[];
  errors: { title: string; description: string; solution: string }[];
  topPriority: string;
  futureRisk?: {
    level: "critical" | "high" | "medium" | "low";
    title: string; summary: string; horizon: string;
    triggers: string[]; actions: string[];
  };
  summary?: string;
  liveInsights?: LiveInsight[];
  dataQuality?: { score: number; label: string; issues: string[] };
}

export default function AiAnalysis() {
  const { isAdmin } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<FarmAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [tool, setTool] = useState<ToolMode>(null);

  const isSv = lang === "sv";

  const analyzeSteps = isSv ? [
    "Läser flockdata...", "Analyserar kläckcykler...", "Kontrollerar miljöparametrar...",
    "Analyserar uppgifter och mål...", "Skannar dagliga anteckningar...",
    "Identifierar avvikelser...", "Genererar prognoser...", "Beräknar slutpoäng...",
  ] : [
    "قراءة بيانات القطعان...", "تحليل دورات التفقيس...", "فحص المعايير البيئية...",
    "تحليل المهام والأهداف...", "مسح الملاحظات اليومية...",
    "كشف الشذوذ والانحرافات...", "توليد التوقعات...", "حساب النتيجة النهائية...",
  ];

  useEffect(() => {
    if (!analyzing) return;
    let step = 0;
    const interval = setInterval(() => {
      step = (step + 1) % analyzeSteps.length;
      setAnalyzeStep(step);
    }, 600);
    return () => clearInterval(interval);
  }, [analyzing]);

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
    setTool(selectedTool);
    setAnalyzing(true);
    setAnalyzeStep(0);
    setAnalysis(null);
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
    } finally {
      setAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) =>
    score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-500" : "text-red-500";
  const getRingColor = (score: number) =>
    score >= 80 ? "stroke-emerald-500" : score >= 60 ? "stroke-amber-500" : "stroke-red-500";
  const getBarColor = (score: number) =>
    score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";

  const insightStatusStyle = (status: LiveInsight["status"]) => ({
    card: status === "good" ? "border-emerald-200/60 bg-emerald-50/30 dark:bg-emerald-950/20 dark:border-emerald-800/40"
      : status === "warning" ? "border-amber-200/60 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-800/40"
      : status === "critical" ? "border-red-200/60 bg-red-50/30 dark:bg-red-950/20 dark:border-red-800/40"
      : "border-border/60 bg-muted/20",
    value: status === "good" ? "text-emerald-600 dark:text-emerald-400"
      : status === "warning" ? "text-amber-600 dark:text-amber-400"
      : status === "critical" ? "text-red-600 dark:text-red-400"
      : "text-foreground",
    dot: status === "good" ? "bg-emerald-500" : status === "warning" ? "bg-amber-500" : status === "critical" ? "bg-red-500" : "bg-muted-foreground/40",
  });

  const alertDot = (type: string) =>
    type === "danger" ? "bg-red-500" : type === "warning" ? "bg-amber-500" : type === "success" ? "bg-emerald-500" : "bg-blue-500";
  const alertCard = (type: string) =>
    type === "danger" ? "border-red-200 bg-red-50/40 dark:bg-red-950/20"
    : type === "warning" ? "border-amber-200 bg-amber-50/40 dark:bg-amber-950/20"
    : "border-blue-200 bg-blue-50/40 dark:bg-blue-950/20";

  const priorityStyle = (p: string) =>
    p === "urgent" ? "bg-red-500 text-white" : p === "high" ? "bg-orange-500 text-white"
    : p === "medium" ? "bg-amber-500 text-white" : "bg-blue-500 text-white";

  const priorityLabel = (p: string) => {
    if (isSv) { switch (p) { case "urgent": return "Brådskande"; case "high": return "Hög"; case "medium": return "Medel"; default: return "Låg"; } }
    switch (p) { case "urgent": return "عاجل"; case "high": return "مهم"; case "medium": return "متوسط"; default: return "عادي"; }
  };

  const itemStatusDot = (s: string) =>
    s === "good" ? "bg-emerald-500" : s === "warning" ? "bg-amber-500" : s === "danger" ? "bg-red-500" : "bg-muted-foreground/30";

  const anomalySeverityStyle = (s: string) =>
    s === "critical" ? "border-red-300 bg-red-50/40 dark:bg-red-950/20"
    : s === "high" ? "border-orange-300 bg-orange-50/40 dark:bg-orange-950/20"
    : s === "medium" ? "border-amber-300 bg-amber-50/40 dark:bg-amber-950/20"
    : "border-border/60 bg-muted/10";

  const sectionIcon = (cat: string) => {
    if (cat === "environment") return <Thermometer className="w-4 h-4 text-blue-500" />;
    if (cat === "biological") return <Microscope className="w-4 h-4 text-purple-500" />;
    return <Settings2 className="w-4 h-4 text-orange-500" />;
  };

  const TrendIcon = ({ trend }: { trend?: string }) => {
    if (trend === "up") return <TrendingUp className="w-3 h-3 text-emerald-500" />;
    if (trend === "down") return <TrendingDown className="w-3 h-3 text-red-500" />;
    return <Minus className="w-3 h-3 text-muted-foreground/60" />;
  };

  const ScoreRing = ({ score, size = 88 }: { score: number; size?: number }) => {
    const r = (size - 10) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    return (
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-muted/30" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="7" strokeLinecap="round"
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

  const topAlerts = (analysis?.alerts ?? []).slice(0, 5);
  const topRecs = (analysis?.recommendations ?? []).slice(0, 5);

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-5rem)]">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">
              {isSv ? "Intelligent analysmotor" : "محرك التحليل الذكي"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isSv ? "Välj ett analysverktyg nedan" : "اختر أداة التحليل أدناه"}
            </p>
          </div>
        </div>
        {analysis && !analyzing && (
          <Button onClick={() => { setAnalysis(null); setTool(null); }} variant="ghost" size="sm" className="gap-1.5 text-xs h-8 text-muted-foreground">
            <ChevronRight className="w-3.5 h-3.5" />
            {isSv ? "Tillbaka" : "رجوع"}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">

        {/* ── TOOL SELECTION SCREEN ── */}
        {!analysis && !analyzing && (
          <div className="flex flex-col items-center justify-center py-10 space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/15 to-indigo-500/15 border border-violet-200/40 flex items-center justify-center">
              <Activity className="w-10 h-10 text-violet-500" />
            </div>
            <div className="text-center space-y-1 max-w-sm">
              <h2 className="text-lg font-bold">{isSv ? "Välj analysverktyg" : "اختر أداة التحليل"}</h2>
              <p className="text-sm text-muted-foreground">
                {isSv ? "Båda verktygen analyserar samma gårdsdata men visar olika perspektiv"
                  : "كلا الأداتين تحللان نفس بيانات المزرعة لكنهما تعرضان منظورين مختلفين"}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl px-2">
              {/* Tool 1: Comprehensive Analysis */}
              <button
                onClick={() => runAnalysis("full")}
                className="group text-right rtl:text-right ltr:text-left rounded-2xl border-2 border-violet-200/60 bg-gradient-to-br from-violet-50/50 to-indigo-50/30 dark:from-violet-950/20 dark:to-indigo-950/10 dark:border-violet-800/40 p-5 hover:border-violet-400/80 hover:shadow-lg hover:shadow-violet-500/10 transition-all duration-200"
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-violet-500/20 group-hover:scale-105 transition-transform">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm leading-tight">
                      {isSv ? "Helhetsanalys" : "التحليل الشامل"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-5">
                      {isSv ? "Realtidsstatus · Varningar · Rekommendationer · Framtidsrisk"
                        : "الحالة المباشرة · التنبيهات · التوصيات · الخطر المستقبلي"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {(isSv ? ["📊 Nyckeltal", "🔔 Varningar", "🎯 Åtgärder", "🔮 Prognoser"]
                    : ["📊 مؤشرات حية", "🔔 تنبيهات", "🎯 توصيات", "🔮 توقعات"]).map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </button>

              {/* Tool 2: Performance & Anomaly Report */}
              <button
                onClick={() => runAnalysis("perf")}
                className="group text-right rtl:text-right ltr:text-left rounded-2xl border-2 border-teal-200/60 bg-gradient-to-br from-teal-50/50 to-emerald-50/30 dark:from-teal-950/20 dark:to-emerald-950/10 dark:border-teal-800/40 p-5 hover:border-teal-400/80 hover:shadow-lg hover:shadow-teal-500/10 transition-all duration-200"
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm leading-tight">
                      {isSv ? "Prestanda & Avvikelserapport" : "تقرير الأداء والشذوذ"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-5">
                      {isSv ? "Sektionspoäng · Avvikelser · Datakvalitet · Detaljerade mätvärden"
                        : "نقاط الأقسام · الشذوذات · جودة البيانات · المقاييس التفصيلية"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {(isSv ? ["🌡️ Miljö", "🧬 Biologi", "⚙️ Drift", "🔍 Avvikelser"]
                    : ["🌡️ البيئة", "🧬 الأحياء", "⚙️ العمليات", "🔍 شذوذات"]).map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── LOADING ── */}
        {analyzing && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-5">
            <div className="relative w-24 h-24">
              <div className={cn("absolute inset-0 rounded-3xl animate-pulse",
                tool === "perf" ? "bg-teal-500/15" : "bg-violet-500/15")} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className={cn("w-10 h-10 animate-spin", tool === "perf" ? "text-teal-500" : "text-violet-500")} />
              </div>
            </div>
            <p className="font-bold text-lg">{t("ai.analyzing")}</p>
            <p className={cn("text-sm font-medium animate-pulse min-h-[20px]",
              tool === "perf" ? "text-teal-600 dark:text-teal-400" : "text-violet-600 dark:text-violet-400")}>
              {analyzeSteps[analyzeStep]}
            </p>
            <div className="flex gap-1.5 mt-2">
              {analyzeSteps.map((_, i) => (
                <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-all duration-300",
                  i === analyzeStep ? (tool === "perf" ? "bg-teal-500" : "bg-violet-500") + " scale-125" : "bg-muted")} />
              ))}
            </div>
          </div>
        )}

        {/* ── TOOL 1: COMPREHENSIVE ANALYSIS ── */}
        {analysis && !analyzing && tool === "full" && (
          <div className="space-y-4">
            <Card className="border-border/60 shadow-md overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500" />
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                  <ScoreRing score={analysis.score} size={92} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-2xl font-black leading-tight", getScoreColor(analysis.score))}>{analysis.scoreLabel}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isSv ? "Hälsoindex för gården just nu" : "مؤشر صحة المزرعة الآن"}
                    </p>
                    {analysis.summary && (
                      <p className="text-xs text-muted-foreground leading-5 mt-2 border-t border-border/40 pt-2">{analysis.summary}</p>
                    )}
                  </div>
                  <Button onClick={() => runAnalysis("full")} variant="outline" size="sm" className="gap-1.5 rounded-full text-xs h-8 flex-shrink-0">
                    <RefreshCw className="w-3.5 h-3.5" />
                    {isSv ? "Uppdatera" : "تحديث"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {analysis.liveInsights && analysis.liveInsights.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-1.5 h-4 rounded-full bg-gradient-to-b from-violet-500 to-indigo-500" />
                  <h2 className="text-sm font-bold">{isSv ? "Realtidsstatus · Gården just nu" : "الحالة المباشرة · المزرعة الآن"}</h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 font-semibold ml-auto">LIVE</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {analysis.liveInsights.map((ins) => {
                    const s = insightStatusStyle(ins.status);
                    return (
                      <div key={ins.id} className={cn("rounded-2xl border p-4 flex flex-col gap-2 transition-all", s.card)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl leading-none">{ins.icon}</span>
                            <p className="text-[11px] font-semibold text-muted-foreground leading-tight">{ins.title}</p>
                          </div>
                          {ins.trend && <TrendIcon trend={ins.trend} />}
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
                          <span className={cn("self-start text-[10px] px-2 py-0.5 rounded-full font-semibold mt-0.5",
                            ins.status === "good" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : ins.status === "warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                            : ins.status === "critical" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                            : "bg-muted text-muted-foreground")}>{ins.badge}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2 border-border/60 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                      <Flame className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <h3 className="font-bold text-sm">{isSv ? "Viktigaste åtgärd just nu" : "أهم إجراء الآن"}</h3>
                  </div>
                  <p className="text-sm leading-7 text-foreground/90 font-medium">{analysis.topPriority}</p>
                  {analysis.summary && (
                    <div className="rounded-2xl bg-muted/20 border border-border/50 p-4">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                        {isSv ? "Verkställande sammanfattning" : "الملخص التنفيذي"}
                      </p>
                      <p className="text-sm leading-6 text-foreground/85">{analysis.summary}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h3 className="font-bold text-sm">{isSv ? "Framtida riskhorisont" : "الخطر المستقبلي"}</h3>
                  </div>
                  {analysis.futureRisk ? (
                    <div className="space-y-2">
                      <p className="text-sm font-bold">{analysis.futureRisk.title}</p>
                      <div className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-muted-foreground" /><p className="text-[11px] text-muted-foreground">{analysis.futureRisk.horizon}</p></div>
                      <p className="text-sm leading-6 text-foreground/85">{analysis.futureRisk.summary}</p>
                      {analysis.futureRisk.actions.slice(0, 2).map((a, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <ArrowUpRight className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-foreground/80">{a}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-4 text-center gap-2">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      <p className="text-xs text-muted-foreground">{isSv ? "Inga tydliga framtida risker" : "لا توجد مخاطر مستقبلية واضحة"}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="font-bold text-sm">{isSv ? "Aktiva varningar" : "التنبيهات النشطة"}</h3>
                    {topAlerts.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-bold ml-auto">{topAlerts.length}</span>}
                  </div>
                  {topAlerts.length === 0 ? (
                    <div className="flex flex-col items-center py-4 text-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{isSv ? "Inga aktiva varningar" : "لا توجد تنبيهات نشطة"}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {topAlerts.map((a, i) => (
                        <div key={i} className={cn("rounded-2xl border p-3.5", alertCard(a.type))}>
                          <div className="flex items-start gap-2">
                            <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0", alertDot(a.type))} />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold leading-tight">{a.title}</p>
                              <p className="text-xs text-muted-foreground mt-1 leading-5">{a.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                      <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h3 className="font-bold text-sm">{isSv ? "Rekommendationer" : "التوصيات"}</h3>
                    {topRecs.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold ml-auto">{topRecs.length}</span>}
                  </div>
                  {topRecs.length === 0 ? (
                    <div className="flex flex-col items-center py-4 gap-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{isSv ? "Inga rekommendationer" : "لا توجد توصيات"}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {topRecs.map((r, i) => (
                        <div key={i} className="rounded-2xl border border-border/60 p-3.5 bg-muted/10">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-semibold leading-tight">{r.title}</p>
                            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0", priorityStyle(r.priority))}>{priorityLabel(r.priority)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-5">{r.description}</p>
                          {r.impact && (
                            <div className="flex items-center gap-1 mt-1.5">
                              <Zap className="w-3 h-3 text-amber-500 flex-shrink-0" />
                              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">{r.impact}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {analysis.predictions && analysis.predictions.length > 0 && (
              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="font-bold text-sm">{isSv ? "Prognoser och förutsägelser" : "التوقعات والتنبؤات"}</h3>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {analysis.predictions.slice(0, 4).map((p, i) => (
                      <div key={i} className="rounded-2xl border border-border/60 p-3.5 bg-muted/10">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold leading-tight">{p.title}</p>
                          {p.timeframe && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-semibold flex-shrink-0">{p.timeframe}</span>}
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

        {/* ── TOOL 2: PERFORMANCE & ANOMALY REPORT ── */}
        {analysis && !analyzing && tool === "perf" && (
          <div className="space-y-4">
            {/* Header score */}
            <Card className="border-border/60 shadow-md overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500" />
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                  <ScoreRing score={analysis.score} size={92} />
                  <div className="flex-1">
                    <p className={cn("text-2xl font-black leading-tight", getScoreColor(analysis.score))}>{analysis.scoreLabel}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isSv ? "Sammansatt prestationsindex" : "مؤشر الأداء المركّب"}
                    </p>
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {analysis.scoreBreakdown?.map((s, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-muted-foreground font-medium truncate">{s.category}</p>
                            <p className={cn("text-[11px] font-bold tabular-nums", getScoreColor(s.score))}>{s.score}</p>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all duration-700", getBarColor(s.score))} style={{ width: `${s.score}%` }} />
                          </div>
                          <p className="text-[9px] text-muted-foreground">{s.label} · {s.weight}%</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button onClick={() => runAnalysis("perf")} variant="outline" size="sm" className="gap-1.5 rounded-full text-xs h-8 flex-shrink-0">
                    <RefreshCw className="w-3.5 h-3.5" />
                    {isSv ? "Uppdatera" : "تحديث"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Sections: Environment / Biological / Operational */}
            {analysis.sections && analysis.sections.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-1.5 h-4 rounded-full bg-gradient-to-b from-teal-500 to-emerald-500" />
                  <h2 className="text-sm font-bold">{isSv ? "Detaljerade sektionsresultat" : "نتائج الأقسام التفصيلية"}</h2>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  {analysis.sections.map((sec, si) => (
                    <Card key={si} className="border-border/60 shadow-sm">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {sectionIcon(sec.category)}
                            <p className="text-sm font-bold">{sec.title}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={cn("text-lg font-black tabular-nums", getScoreColor(sec.healthScore))}>{sec.healthScore}</span>
                            <span className="text-[10px] text-muted-foreground">/100</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all duration-700", getBarColor(sec.healthScore))} style={{ width: `${sec.healthScore}%` }} />
                        </div>
                        <div className="space-y-1.5">
                          {sec.items.slice(0, 6).map((item, ii) => (
                            <div key={ii} className="flex items-start gap-2 py-1 border-b border-border/30 last:border-0">
                              <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0", itemStatusDot(item.status))} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <p className="text-[11px] text-muted-foreground truncate">{item.label}</p>
                                  <p className="text-[11px] font-bold flex-shrink-0">{item.value}</p>
                                </div>
                                {item.detail && <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-4">{item.detail}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Anomalies */}
            {analysis.anomalies && analysis.anomalies.length > 0 && (
              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <h3 className="font-bold text-sm">{isSv ? "Detekterade avvikelser" : "الشذوذات المكتشفة"}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-bold ml-auto">{analysis.anomalies.length}</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {analysis.anomalies.map((an, i) => (
                      <div key={i} className={cn("rounded-2xl border p-3.5", anomalySeverityStyle(an.severity))}>
                        <p className="text-sm font-semibold">{an.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-5">{an.description}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-background/60 border border-border/60 font-mono">
                            {isSv ? "Aktuellt" : "الحالي"}: {an.currentValue}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-background/60 border border-border/60 font-mono">
                            {isSv ? "Förväntat" : "المتوقع"}: {an.expectedRange}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Data Quality */}
            {analysis.dataQuality && (
              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="font-bold text-sm">{isSv ? "Datakvalitetsbedömning" : "تقييم جودة البيانات"}</h3>
                    <div className="ml-auto flex items-center gap-2">
                      <span className={cn("text-lg font-black tabular-nums", getScoreColor(analysis.dataQuality.score))}>{analysis.dataQuality.score}</span>
                      <span className="text-xs text-muted-foreground">/100 — {analysis.dataQuality.label}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-700", getBarColor(analysis.dataQuality.score))} style={{ width: `${analysis.dataQuality.score}%` }} />
                  </div>
                  {analysis.dataQuality.issues.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        {isSv ? "Identifierade dataproblem" : "مشكلات البيانات المكتشفة"}
                      </p>
                      {analysis.dataQuality.issues.map((issue, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                          <p className="text-xs text-muted-foreground leading-5">{issue}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <p className="text-sm font-medium">{isSv ? "Datakvaliteten är utmärkt" : "جودة البيانات ممتازة"}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Errors */}
            {analysis.errors && analysis.errors.length > 0 && (
              <Card className="border-red-200/60 shadow-sm bg-red-50/20 dark:bg-red-950/10">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="font-bold text-sm text-red-700 dark:text-red-400">{isSv ? "Kritiska systemfel" : "مشاكل حرجة تحتاج تدخلاً"}</h3>
                  </div>
                  <div className="space-y-3">
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
    </div>
  );
}
