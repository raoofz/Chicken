import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Loader2, Sparkles, AlertTriangle, CheckCircle2, Zap, Activity, Thermometer, Bug, Settings, Database, Shield, Target, Info, ClipboardList, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

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
  category?: string;
}

interface SectionItem {
  label: string;
  value: string;
  status: string;
  detail?: string;
}

interface Section {
  icon: string;
  title: string;
  category: string;
  items: SectionItem[];
  healthScore: number;
}

interface TrendPoint {
  label: string;
  value: number;
}

interface FarmAnalysis {
  score: number;
  scoreLabel: string;
  scoreBreakdown?: { category: string; score: number; weight: number; label: string }[];
  alerts: Alert[];
  sections: Section[];
  recommendations?: Recommendation[];
  predictions: Prediction[];
  errors: { title: string; description: string; solution: string }[];
  trends?: {
    hatchRates: TrendPoint[];
    taskCompletion: TrendPoint[];
    flockGrowth: TrendPoint[];
    documentationFreq: TrendPoint[];
  };
  topPriority: string;
  futureRisk?: {
    level: "critical" | "high" | "medium" | "low";
    title: string;
    summary: string;
    horizon: string;
    triggers: string[];
    actions: string[];
  };
  aiCapabilities?: { title: string; description: string }[];
  summary?: string;
  dataQuality?: { score: number; label: string; issues: string[] };
  duties?: { priority: string; title: string; description: string }[];
}

export default function AiAnalysis() {
  const { isAdmin } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<FarmAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState(0);

  useEffect(() => {
    if (!analyzing) return;
    const steps = [
      "قراءة بيانات القطعان...",
      "تحليل دورات التفقيس...",
      "فحص المعايير البيئية...",
      "تحليل المهام والأهداف...",
      "مسح الملاحظات اليومية...",
      "كشف الشذوذ والانحرافات...",
      "توليد التوقعات...",
      "حساب النتيجة النهائية...",
    ];
    let step = 0;
    const interval = setInterval(() => {
      step = (step + 1) % steps.length;
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
      const res = await fetch("/api/ai/analyze-farm", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang: "ar" }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "فشل"); }
      const data = await res.json();
      setAnalysis(data.analysis);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const runFutureRisk = async () => {
    setAnalyzing(true);
    setAnalyzeStep(0);
    try {
      const res = await fetch("/api/ai/analyze-farm", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang: "sv" }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "فشل"); }
      const data = await res.json();
      setAnalysis(data.analysis);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-red-600";
  const getScoreRingColor = (score: number) => score >= 80 ? "stroke-emerald-500" : score >= 60 ? "stroke-amber-500" : "stroke-red-500";
  const topAlerts = (analysis?.alerts ?? []).slice(0, 5);
  const topRecommendations = (analysis?.recommendations ?? []).slice(0, 5);
  const termHelp = [
    { title: "البيئة", text: "تعني الحرارة والرطوبة والتهوية والنظافة داخل العنبر أو الفقاسة." },
    { title: "الأحياء", text: "تعني صحة الدجاج والكتاكيت والأجنة وأي أعراض مرضية أو نفوق." },
    { title: "العمليات", text: "تعني المهام اليومية مثل العلف والماء والتقليب والتحصين والمتابعة." },
    { title: "جودة البيانات", text: "تعني هل السجل كامل وصحيح وحديث، أم فيه نقص أو تكرار أو تعارض." },
  ];

  const priorityColor = (p: string) => {
    switch (p) { case "urgent": return "bg-red-500 text-white"; case "high": return "bg-orange-500 text-white"; case "medium": return "bg-amber-500 text-white"; default: return "bg-blue-500 text-white"; }
  };

  const priorityLabel = (p: string) => {
    switch (p) { case "urgent": return "عاجل"; case "high": return "مهم"; case "medium": return "متوسط"; default: return "عادي"; }
  };

  const ScoreRing = ({ score, size = 80 }: { score: number; size?: number }) => {
    const r = (size - 8) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    return (
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6" strokeLinecap="round" className={getScoreRingColor(score)} strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 1s ease" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-xl font-bold", getScoreColor(score))}>{score}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-5rem)]">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">محرك التحليل الذكي</h1>
            <p className="text-xs text-muted-foreground">تحليل عميق بالمعايير العلمية — كشف شذوذ — توقعات — توصيات</p>
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
        <p className="text-sm font-semibold mb-1">شرح سريع</p>
        <p className="text-sm text-muted-foreground leading-7">
          هذا التحليل يقرأ بيانات المزرعة ويحوّلها إلى مشاكل، وتوصيات، وخطر مستقبلي، ثم يشرح لك المصطلحات الأساسية تحتها مباشرة.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {!analysis && !analyzing && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-6">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
              <Activity className="w-12 h-12 text-emerald-600" />
            </div>
            <div className="space-y-2 max-w-md">
              <h2 className="text-lg font-bold">محرك تحليل خبير</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">يقرأ كل البيانات ويحللها بالمعايير العلمية: كشف الشذوذ، التوقعات، مؤشرات المخاطر، والتوصيات العملية.</p>
            </div>
            <Button onClick={runAnalysis} size="lg" className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg">
              <Sparkles className="w-5 h-5" /> ابدأ التحليل العميق
            </Button>
            <Button onClick={runFutureRisk} size="lg" className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg">
              <AlertTriangle className="w-5 h-5" /> تحليل المخاطر المستقبلية
            </Button>
          </div>
        )}

        {analyzing && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
              </div>
            </div>
            <p className="font-semibold text-lg">جارٍ التحليل العميق...</p>
            <p className="text-sm text-emerald-600 font-medium animate-pulse min-h-[20px]">{["قراءة بيانات القطعان...", "تحليل دورات التفقيس...", "فحص المعايير البيئية...", "تحليل المهام والأهداف...", "مسح الملاحظات اليومية...", "كشف الشذوذ والانحرافات...", "توليد التوقعات...", "حساب النتيجة النهائية..."][analyzeStep]}</p>
          </div>
        )}

        {analysis && !analyzing && (
          <div className="space-y-5">
            <Card className="border-border/60 shadow-lg overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row md:items-center gap-5">
                  <ScoreRing score={analysis.score} size={92} />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={cn("text-2xl font-bold", getScoreColor(analysis.score))}>{analysis.scoreLabel}</p>
                        <p className="text-sm text-muted-foreground mt-1">تنبيه / السبب / التوقع / الحل</p>
                      </div>
                      <Button onClick={runAnalysis} variant="outline" size="sm" className="gap-1.5 rounded-full">
                        <Sparkles className="w-3.5 h-3.5" /> تحديث
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {analysis.scoreBreakdown?.map((s, i) => (
                        <div key={i} className="rounded-2xl border border-border/60 bg-muted/25 p-3">
                          <p className="text-[11px] text-muted-foreground">{s.category}</p>
                          <p className="text-lg font-bold">{s.score}</p>
                          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", s.score >= 80 ? "bg-emerald-500" : s.score >= 60 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${s.score}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-3">
              <Card className="lg:col-span-2 border-border/60 shadow-sm">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-emerald-600" /><h3 className="font-bold">أهم إجراء الآن</h3></div>
                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Action</span>
                  </div>
                  <p className="text-sm leading-7 text-foreground/90">{analysis.topPriority}</p>
                  <div className="rounded-2xl bg-muted/20 border border-border/60 p-4">
                    <p className="text-sm font-semibold mb-2">الملخص التنفيذي</p>
                    <p className="text-sm leading-7 text-foreground/90">{analysis.summary}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <h3 className="font-bold">الخطر المستقبلي</h3>
                  </div>
                  {analysis.futureRisk ? (
                    <div className="rounded-2xl border border-border/60 p-3">
                      <p className="text-sm font-semibold">{analysis.futureRisk.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{analysis.futureRisk.horizon}</p>
                      <p className="text-sm mt-3 leading-7 text-foreground/90">{analysis.futureRisk.summary}</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/60 p-3 text-sm text-muted-foreground">لا توجد مخاطر مستقبلية واضحة حالياً.</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-red-500" /><h3 className="font-bold">أهم 5 مشاكل</h3></div>
                  <div className="space-y-2">{topAlerts.map((a, i) => (<div key={i} className="rounded-2xl border border-border/60 p-3"><p className="text-sm font-semibold">{a.title}</p><p className="text-xs text-muted-foreground mt-1 leading-6">{a.description}</p></div>))}</div>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2"><Target className="w-4 h-4 text-primary" /><h3 className="font-bold">أهم 5 توصيات</h3></div>
                  <div className="space-y-2">{topRecommendations.map((r, i) => (<div key={i} className="rounded-2xl border border-border/60 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{r.title}</p><span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold", priorityColor(r.priority))}>{priorityLabel(r.priority)}</span></div><p className="text-xs text-muted-foreground mt-1 leading-6">{r.description}</p></div>))}</div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-purple-600" /><h3 className="font-bold">4 أدوات ذكاء اصطناعي متقدمة</h3></div>
                <div className="grid gap-3 md:grid-cols-2">{analysis.aiCapabilities?.map((cap, i) => (<div key={i} className="rounded-2xl border border-border/60 p-3 bg-muted/20"><p className="text-sm font-semibold">{cap.title}</p><p className="text-xs text-muted-foreground mt-1 leading-6">{cap.description}</p></div>))}</div>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2"><Info className="w-4 h-4 text-blue-600" /><h3 className="font-bold">شرح المصطلحات</h3></div>
                <div className="grid gap-3 md:grid-cols-2">{termHelp.map((item) => (<div key={item.title} className="rounded-2xl border border-border/60 p-3"><p className="text-sm font-semibold">{item.title}</p><p className="text-xs text-muted-foreground mt-1 leading-6">{item.text}</p></div>))}</div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
