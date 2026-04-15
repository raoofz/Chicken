import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldAlert, Loader2, Sparkles, AlertTriangle, CheckCircle2,
  Zap, Activity, TrendingUp, TrendingDown, Minus,
  Shield, Target, RefreshCw, ArrowUpRight, Clock, Flame
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveInsight {
  id: string;
  icon: string;
  title: string;
  value: string;
  unit: string;
  detail: string;
  status: "good" | "warning" | "critical" | "neutral";
  trend?: "up" | "down" | "stable";
  badge?: string;
}

interface Alert {
  type: string;
  title: string;
  description: string;
  category?: string;
  severity?: number;
}

interface Recommendation {
  priority: string;
  title: string;
  description: string;
  reason: string;
  impact: string;
  confidence: number;
  category: string;
}

interface Prediction {
  title: string;
  description: string;
  confidence: string;
  probability?: number;
  timeframe?: string;
}

interface FarmAnalysis {
  score: number;
  scoreLabel: string;
  scoreBreakdown?: { category: string; score: number; weight: number; label: string }[];
  alerts: Alert[];
  recommendations?: Recommendation[];
  predictions: Prediction[];
  errors: { title: string; description: string; solution: string }[];
  topPriority: string;
  futureRisk?: {
    level: "critical" | "high" | "medium" | "low";
    title: string;
    summary: string;
    horizon: string;
    triggers: string[];
    actions: string[];
  };
  summary?: string;
  liveInsights?: LiveInsight[];
}

export default function AiAnalysis() {
  const { isAdmin } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<FarmAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState(0);

  const isSv = lang === "sv";

  const analyzeSteps = isSv ? [
    "Läser flockdata...",
    "Analyserar kläckcykler...",
    "Kontrollerar miljöparametrar...",
    "Analyserar uppgifter och mål...",
    "Skannar dagliga anteckningar...",
    "Identifierar avvikelser...",
    "Genererar prognoser...",
    "Beräknar slutpoäng...",
  ] : [
    "قراءة بيانات القطعان...",
    "تحليل دورات التفقيس...",
    "فحص المعايير البيئية...",
    "تحليل المهام والأهداف...",
    "مسح الملاحظات اليومية...",
    "كشف الشذوذ والانحرافات...",
    "توليد التوقعات...",
    "حساب النتيجة النهائية...",
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

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <ShieldAlert className="w-16 h-16 text-muted-foreground/40" />
        <h2 className="text-xl font-bold">{t("ai.restricted")}</h2>
        <p className="text-muted-foreground">{t("ai.adminOnly")}</p>
      </div>
    );
  }

  const runAnalysis = async () => {
    setAnalyzing(true);
    setAnalyzeStep(0);
    try {
      const res = await fetch("/api/ai/analyze-farm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "error"); }
      const data = await res.json();
      setAnalysis(data.analysis);
    } catch (err: any) {
      toast({ title: isSv ? "Fel" : "خطأ", description: err.message, variant: "destructive" });
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

  const alertTypeStyle = (type: string) =>
    type === "danger" ? "border-red-200 bg-red-50/50 dark:bg-red-950/20"
    : type === "warning" ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20"
    : type === "success" ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20"
    : "border-blue-200 bg-blue-50/50 dark:bg-blue-950/20";

  const alertDot = (type: string) =>
    type === "danger" ? "bg-red-500" : type === "warning" ? "bg-amber-500" : type === "success" ? "bg-emerald-500" : "bg-blue-500";

  const priorityStyle = (p: string) =>
    p === "urgent" ? "bg-red-500 text-white"
    : p === "high" ? "bg-orange-500 text-white"
    : p === "medium" ? "bg-amber-500 text-white"
    : "bg-blue-500 text-white";

  const priorityLabel = (p: string) => {
    if (isSv) {
      switch (p) { case "urgent": return "Brådskande"; case "high": return "Hög"; case "medium": return "Medel"; default: return "Låg"; }
    }
    switch (p) { case "urgent": return "عاجل"; case "high": return "مهم"; case "medium": return "متوسط"; default: return "عادي"; }
  };

  const riskLevelStyle = (level?: string) =>
    level === "critical" ? "border-red-300 bg-red-50/50 dark:bg-red-950/20"
    : level === "high" ? "border-orange-300 bg-orange-50/50 dark:bg-orange-950/20"
    : level === "medium" ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"
    : "border-border/60";

  const topAlerts = (analysis?.alerts ?? []).slice(0, 5);
  const topRecs = (analysis?.recommendations ?? []).slice(0, 5);

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

  const TrendIcon = ({ trend }: { trend?: string }) => {
    if (trend === "up") return <TrendingUp className="w-3 h-3 text-emerald-500" />;
    if (trend === "down") return <TrendingDown className="w-3 h-3 text-red-500" />;
    return <Minus className="w-3 h-3 text-muted-foreground/60" />;
  };

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
              {isSv ? "Djupanalys · Avvikelsedetektering · Prognoser · Rekommendationer" : "تحليل عميق · كشف شذوذ · توقعات · توصيات"}
            </p>
          </div>
        </div>
        {analysis && !analyzing && (
          <Button onClick={runAnalysis} variant="outline" size="sm" className="gap-1.5 rounded-full text-xs h-8">
            <RefreshCw className="w-3.5 h-3.5" />
            {isSv ? "Uppdatera" : "تحديث"}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">

        {!analysis && !analyzing && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-6">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500/15 to-indigo-500/15 border border-violet-200/40 flex items-center justify-center">
              <Activity className="w-11 h-11 text-violet-500" />
            </div>
            <div className="space-y-2 max-w-md">
              <h2 className="text-lg font-bold">{t("ai.engineTitle")}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{t("ai.engineDesc")}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={runAnalysis} size="lg" className="gap-2 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 shadow-lg shadow-violet-500/20 text-white">
                <Sparkles className="w-5 h-5" /> {t("ai.startBtn")}
              </Button>
              <Button onClick={runAnalysis} size="lg" variant="outline" className="gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" /> {t("ai.riskBtn")}
              </Button>
            </div>
          </div>
        )}

        {analyzing && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-5">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-500/15 to-indigo-500/15 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
              </div>
            </div>
            <p className="font-bold text-lg">{t("ai.analyzing")}</p>
            <p className="text-sm text-violet-600 dark:text-violet-400 font-medium animate-pulse min-h-[20px]">
              {analyzeSteps[analyzeStep]}
            </p>
            <div className="flex gap-1.5 mt-2">
              {analyzeSteps.map((_, i) => (
                <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-all duration-300", i === analyzeStep ? "bg-violet-500 scale-125" : "bg-muted")} />
              ))}
            </div>
          </div>
        )}

        {analysis && !analyzing && (
          <div className="space-y-4">

            {/* ── SCORE HEADER ── */}
            <Card className="border-border/60 shadow-md overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500" />
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                  <ScoreRing score={analysis.score} size={92} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1">
                      <div>
                        <p className={cn("text-2xl font-black leading-tight", getScoreColor(analysis.score))}>
                          {analysis.scoreLabel}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {isSv ? "Hälsoindex för gården just nu" : "مؤشر صحة المزرعة الآن"}
                        </p>
                      </div>
                    </div>
                    {analysis.summary && (
                      <p className="text-xs text-muted-foreground leading-5 mt-2 border-t border-border/40 pt-2">
                        {analysis.summary}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── LIVE FARM INSIGHTS ── */}
            {analysis.liveInsights && analysis.liveInsights.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-1.5 h-4 rounded-full bg-gradient-to-b from-violet-500 to-indigo-500" />
                  <h2 className="text-sm font-bold">
                    {isSv ? "Realtidsstatus · Gården just nu" : "الحالة المباشرة · المزرعة الآن"}
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 font-semibold ml-auto">
                    LIVE
                  </span>
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
                            : "bg-muted text-muted-foreground"
                          )}>
                            {ins.badge}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── TOP PRIORITY + FUTURE RISK ── */}
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2 border-border/60 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                      <Flame className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <h3 className="font-bold text-sm">
                      {isSv ? "Viktigaste åtgärd just nu" : "أهم إجراء الآن"}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-bold ml-auto uppercase">
                      {isSv ? "Prioritet" : "أولوية"}
                    </span>
                  </div>
                  <p className="text-sm leading-7 text-foreground/90 font-medium">{analysis.topPriority}</p>
                  <div className="rounded-2xl bg-muted/20 border border-border/50 p-4">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                      {isSv ? "Verkställande sammanfattning" : "الملخص التنفيذي"}
                    </p>
                    <p className="text-sm leading-6 text-foreground/85">{analysis.summary}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn("border shadow-sm", riskLevelStyle(analysis.futureRisk?.level))}>
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
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <p className="text-[11px] text-muted-foreground">{analysis.futureRisk.horizon}</p>
                      </div>
                      <p className="text-sm leading-6 text-foreground/85">{analysis.futureRisk.summary}</p>
                      {analysis.futureRisk.actions.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/40">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                            {isSv ? "Åtgärder" : "إجراءات"}
                          </p>
                          {analysis.futureRisk.actions.slice(0, 2).map((a, i) => (
                            <div key={i} className="flex items-start gap-1.5 mt-1">
                              <ArrowUpRight className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-foreground/80">{a}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/60 p-3 text-sm text-muted-foreground text-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                      {isSv ? "Inga tydliga framtida risker" : "لا توجد مخاطر مستقبلية واضحة"}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── ALERTS + RECOMMENDATIONS ── */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="font-bold text-sm">{isSv ? "Aktiva varningar" : "التنبيهات النشطة"}</h3>
                    {topAlerts.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-bold ml-auto">
                        {topAlerts.length}
                      </span>
                    )}
                  </div>
                  {topAlerts.length === 0 ? (
                    <div className="flex flex-col items-center py-4 text-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {isSv ? "Inga aktiva varningar" : "لا توجد تنبيهات نشطة"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {topAlerts.map((a, i) => (
                        <div key={i} className={cn("rounded-2xl border p-3.5", alertTypeStyle(a.type))}>
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
                    {topRecs.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold ml-auto">
                        {topRecs.length}
                      </span>
                    )}
                  </div>
                  {topRecs.length === 0 ? (
                    <div className="flex flex-col items-center py-4 text-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {isSv ? "Inga rekommendationer" : "لا توجد توصيات"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {topRecs.map((r, i) => (
                        <div key={i} className="rounded-2xl border border-border/60 p-3.5 bg-muted/10">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-semibold leading-tight">{r.title}</p>
                            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0", priorityStyle(r.priority))}>
                              {priorityLabel(r.priority)}
                            </span>
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

            {/* ── PREDICTIONS ── */}
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
                          {p.timeframe && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-semibold flex-shrink-0">
                              {p.timeframe}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-5">{p.description}</p>
                        {p.probability != null && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-muted-foreground">
                                {isSv ? "Sannolikhet" : "الاحتمالية"}
                              </span>
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

            {/* ── ERRORS / CRITICAL ISSUES ── */}
            {analysis.errors && analysis.errors.length > 0 && (
              <Card className="border-red-200/60 shadow-sm bg-red-50/20 dark:bg-red-950/10">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="font-bold text-sm text-red-700 dark:text-red-400">
                      {isSv ? "Kritiska systemfel" : "مشاكل حرجة تحتاج تدخلاً"}
                    </h3>
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
