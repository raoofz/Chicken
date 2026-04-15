import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Brain, Loader2, TrendingUp, TrendingDown, Minus,
  Activity, AlertTriangle, CheckCircle2, Shield,
  Target, Clock, Zap, BarChart3, GitFork,
  RefreshCw, Info, ArrowRight, XCircle,
  Database, Layers, Eye, Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Type mirrors for backend PrecisionOutput ───────────────────────────────
interface RollingStats { window: number; count: number; mean: number; std: number; variance: number; min: number; max: number; rateOfChange: number; trend: OLSResult | null; }
interface OLSResult { slope: number; intercept: number; r2: number; se: number; ci95_lo: number; ci95_hi: number; n: number; predictions: number[]; }
interface AnomalyPoint { index: number; date: string; value: number; zScore: number; type: "spike" | "drop"; severity: "critical" | "high" | "low"; }
interface ChangePoint { index: number; date: string; cumulativeSum: number; direction: "shift_up" | "shift_down"; magnitude: number; }
interface FeatureVector { rolling3d: RollingStats | null; rolling7d: RollingStats | null; rolling14d: RollingStats | null; ewmaSlope: number; autocorrelationLag1: number; anomalies: AnomalyPoint[]; changePoints: ChangePoint[]; globalMean: number; globalStd: number; globalVariance: number; globalStability: number; sampleSize: number; }
interface AdaptiveThresholds { hatchRate: { good: number; acceptable: number; poor: number }; temperature: { optimal_lo: number; optimal_hi: number }; humidity: { optimal_lo: number; optimal_hi: number }; source: string; confidenceInThresholds: number; }
interface DataQualityReport { score: number; sufficient: boolean; issues: string[]; warnings: string[]; minimumMetByCriteria: Record<string, boolean>; }
interface RiskFactor { name: string; nameAr: string; weight: number; rawValue: number; normalized: number; logitContribution: number; evidence: string; }
interface RiskModel { factors: RiskFactor[]; logit: number; failureProbability: number; riskScore: number; riskLevel: "critical" | "high" | "medium" | "low"; adaptiveAdjustment: number; }
interface CausalPathway { id: string; nameAr: string; structuralEquation: string; weight: number; measuredValue: number; deviation: number; causalEffect: number; evidence: string; isTrueCause: boolean; }
interface CausalResult { dag: { nodes: string[]; edges: string[] }; pathways: CausalPathway[]; primaryCause: string; totalExplainedVariance: number; correlationVsCausation: string; }
interface ConfidenceResult { score: number; breakdown: Record<string, { weight: number; value: number; reason: string }>; accuracyAdjustment: number; }
interface PrecisionOutput { dataQuality: DataQualityReport; features: FeatureVector; adaptiveThresholds: AdaptiveThresholds; riskModel: RiskModel; prediction: { nextCycleHatchRate: number | null; ci95: [number, number] | null; failureProbability48h: number; trend: "improving" | "declining" | "stable"; horizon: string; }; anomalyTimeline: AnomalyPoint[]; changePoints: ChangePoint[]; causal: CausalResult; confidence: ConfidenceResult; meta: { engineVersion: string; computedAt: string; inputHash: string; modelMetrics: Record<string, number>; }; }
interface MonitorReport { accuracy: { resolvedCount: number; mae: number; rmse: number; bias: number; accuracyRate: number; trendAccuracy: number; confidenceAdjustment: number; } | null; stuckDetection: { isStuck: boolean; reason: string | null; recommendation: string | null; }; unresolvedPredictions: number; recentPredictions: Array<{ id: number; createdAt: string; predictedHatchRate: number | null; actualHatchRate: number | null; error: number | null; confidenceScore: number | null; resolved: boolean; }>; systemHealth: "healthy" | "degraded" | "unknown"; recommendation: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const riskColors: Record<string, string> = {
  critical: "text-red-700 bg-red-50 border-red-200",
  high: "text-orange-700 bg-orange-50 border-orange-200",
  medium: "text-yellow-700 bg-yellow-50 border-yellow-200",
  low: "text-green-700 bg-green-50 border-green-200",
};
const riskBg: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};
const riskLabels: Record<string, string> = {
  critical: "حرج",
  high: "عالٍ",
  medium: "متوسط",
  low: "منخفض",
};

function ProgressBar({ value, max = 100, color = "bg-amber-500", className = "" }: { value: number; max?: number; color?: string; className?: string }) {
  return (
    <div className={cn("w-full bg-gray-100 rounded-full h-2 overflow-hidden", className)}>
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return <span className={cn("px-2 py-0.5 rounded text-xs font-bold border", color)}>{text}</span>;
}

function SectionCard({ title, icon: Icon, children, className = "" }: { title: string; icon: any; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("border shadow-sm", className)}>
      <CardHeader className="pb-3 pt-4 px-5">
        <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Icon className="h-4 w-4 text-amber-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">{children}</CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PrecisionAnalysis() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [monLoading, setMonLoading] = useState(false);
  const [result, setResult] = useState<PrecisionOutput | null>(null);
  const [monitor, setMonitor] = useState<MonitorReport | null>(null);
  const [tab, setTab] = useState<"analysis" | "monitor">("analysis");

  const getApiBase = () => typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? `https://${window.location.hostname.replace(/^[^.]+/, (m) => m)}/api`.replace("//", "/").replace("https:/", "https://")
    : "/api";

  const apiUrl = (path: string) => {
    const base = typeof window !== "undefined"
      ? window.location.origin.replace(/-\d{2}-\d{6,}\./g, (m) => m)
      : "";
    return `${base}/api${path}`;
  };

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/ai/precision", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!resp.ok) throw new Error((await resp.json()).error ?? resp.statusText);
      const data = await resp.json();
      setResult(data.result);
      toast({ title: "تم التحليل الدقيق", description: `بصمة المدخلات: ${data.result.meta.inputHash}` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message });
    } finally { setLoading(false); }
  }, [toast]);

  const runMonitor = useCallback(async () => {
    setMonLoading(true);
    try {
      const resp = await fetch("/api/ai/monitor", { credentials: "include" });
      if (!resp.ok) throw new Error((await resp.json()).error ?? resp.statusText);
      const data = await resp.json();
      setMonitor(data.report);
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message });
    } finally { setMonLoading(false); }
  }, [toast]);

  if (!user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 gap-2 p-8">
        <Shield className="h-5 w-5" />
        <span>هذه الصفحة للمديرين فقط</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="h-5 w-5 text-amber-600" />
            محرك الدقة v2 — تحليل إحصائي متقدم
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            OLS · EWMA · Z-score · CUSUM · SCM · Bayesian Confidence
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === "analysis" ? "default" : "outline"} size="sm" onClick={() => setTab("analysis")} className={tab === "analysis" ? "bg-amber-600 hover:bg-amber-700" : ""}>
            <Brain className="h-4 w-4 ml-1" /> التحليل
          </Button>
          <Button variant={tab === "monitor" ? "default" : "outline"} size="sm" onClick={() => setTab("monitor")} className={tab === "monitor" ? "bg-amber-600 hover:bg-amber-700" : ""}>
            <Eye className="h-4 w-4 ml-1" /> المراقبة الذاتية
          </Button>
        </div>
      </div>

      {/* ANALYSIS TAB */}
      {tab === "analysis" && (
        <>
          <Button onClick={run} disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin ml-2" />جارٍ التحليل...</> : <><Zap className="h-4 w-4 ml-2" />تشغيل المحرك الدقيق</>}
          </Button>

          {result && (
            <div className="space-y-4">
              {/* Data Quality */}
              <SectionCard title="1. جودة البيانات — بوابة القبول" icon={Database}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn("px-3 py-1 rounded-full text-sm font-bold border", result.dataQuality.sufficient ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200")}>
                    {result.dataQuality.sufficient ? "✓ مقبول للتحليل" : "✗ رفض — بيانات ناقصة"}
                  </div>
                  <span className="text-gray-500 text-sm">نقاط: {result.dataQuality.score}/100</span>
                </div>
                <ProgressBar value={result.dataQuality.score} color={result.dataQuality.score >= 70 ? "bg-green-500" : result.dataQuality.score >= 40 ? "bg-yellow-500" : "bg-red-500"} className="mb-3" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  {Object.entries(result.dataQuality.minimumMetByCriteria).map(([k, v]) => (
                    <div key={k} className={cn("flex items-center gap-1.5 text-xs px-2 py-1 rounded border", v ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-600")}>
                      {v ? <CheckCircle2 className="h-3 w-3 flex-shrink-0" /> : <XCircle className="h-3 w-3 flex-shrink-0" />}
                      <span className="truncate">{k === "hasCompletedCycles" ? "دورات مكتملة" : k === "hasTemperatureData" ? "بيانات حرارة" : k === "hasSufficientHistory" ? "تاريخ كافٍ" : k === "hasDocumentation" ? "توثيق يومي" : k}</span>
                    </div>
                  ))}
                </div>
                {result.dataQuality.issues.length > 0 && (
                  <div className="space-y-1">{result.dataQuality.issues.map((iss, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded px-3 py-2">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />{iss}
                    </div>
                  ))}</div>
                )}
                {result.dataQuality.warnings.length > 0 && (
                  <div className="space-y-1 mt-2">{result.dataQuality.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-yellow-700 bg-yellow-50 rounded px-3 py-2">
                      <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />{w}
                    </div>
                  ))}</div>
                )}
              </SectionCard>

              {/* Feature Engineering */}
              <SectionCard title="2. Feature Engineering — الخصائص الإحصائية" icon={BarChart3}>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "المتوسط الكلي", value: `${result.features.globalMean.toFixed(1)}%`, sub: "Global Mean" },
                    { label: "الانحراف المعياري", value: `±${result.features.globalStd.toFixed(2)}`, sub: "Std Dev" },
                    { label: "الاستقرار", value: `${(result.features.globalStability * 100).toFixed(0)}%`, sub: "1 - CV" },
                    { label: "منحدر EWMA", value: result.features.ewmaSlope.toFixed(4), sub: "α=0.3" },
                    { label: "الارتباط الذاتي", value: result.features.autocorrelationLag1.toFixed(4), sub: "Lag-1 ACF" },
                    { label: "حجم العينة", value: result.features.sampleSize.toString(), sub: "دورة مكتملة" },
                  ].map((stat, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-3 text-center border">
                      <div className="text-lg font-bold text-amber-700">{stat.value}</div>
                      <div className="text-xs font-medium text-gray-700">{stat.label}</div>
                      <div className="text-xs text-gray-400">{stat.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Rolling Windows */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Rolling Windows</div>
                  {[result.features.rolling3d, result.features.rolling7d, result.features.rolling14d].filter(Boolean).map((r) => r && (
                    <div key={r.window} className="border rounded-lg p-3 bg-white">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-gray-700">{r.window} أيام — {r.count} نقطة بيانات</span>
                        {r.trend && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">R²={r.trend.r2} | slope={r.trend.slope}</span>}
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs text-center">
                        <div><span className="text-gray-400 block">متوسط</span><span className="font-bold">{r.mean.toFixed(1)}%</span></div>
                        <div><span className="text-gray-400 block">انحراف</span><span className="font-bold">±{r.std.toFixed(2)}</span></div>
                        <div><span className="text-gray-400 block">تباين</span><span className="font-bold">{r.variance.toFixed(2)}</span></div>
                        <div><span className="text-gray-400 block">معدل التغير</span><span className={cn("font-bold", r.rateOfChange > 0 ? "text-green-600" : r.rateOfChange < 0 ? "text-red-600" : "text-gray-600")}>{r.rateOfChange > 0 ? "+" : ""}{r.rateOfChange.toFixed(1)}%</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Anomaly Detection */}
              <SectionCard title="3. كشف الشذوذ — Z-score + CUSUM" icon={AlertTriangle}>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-700">{result.anomalyTimeline.length}</div>
                    <div className="text-xs text-red-600 mt-1">شذوذات Z-score مكتشفة</div>
                    <div className="text-xs text-red-400">{"(|z| > 2.5σ)"}</div>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-orange-700">{result.changePoints.length}</div>
                    <div className="text-xs text-orange-600 mt-1">نقاط تحوّل CUSUM</div>
                    <div className="text-xs text-orange-400">(4σ decision limit)</div>
                  </div>
                </div>

                {result.anomalyTimeline.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-gray-600 mb-2">الشذوذات بالترتيب الزمني:</div>
                    {result.anomalyTimeline.map((a, i) => (
                      <div key={i} className={cn("flex items-center justify-between rounded-lg px-3 py-2 text-sm border", a.severity === "critical" ? "bg-red-50 border-red-200" : a.severity === "high" ? "bg-orange-50 border-orange-200" : "bg-yellow-50 border-yellow-200")}>
                        <div className="flex items-center gap-2">
                          {a.type === "drop" ? <TrendingDown className="h-4 w-4 text-red-600" /> : <TrendingUp className="h-4 w-4 text-green-600" />}
                          <span className="font-medium">{a.date}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span>قيمة: <strong>{a.value.toFixed(1)}%</strong></span>
                          <span className={cn("font-bold", a.zScore < 0 ? "text-red-600" : "text-green-600")}>z={a.zScore.toFixed(2)}</span>
                          <Badge text={a.severity === "critical" ? "حرج" : a.severity === "high" ? "عالٍ" : "منخفض"} color={a.severity === "critical" ? "bg-red-100 text-red-700 border-red-200" : a.severity === "high" ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-yellow-100 text-yellow-700 border-yellow-200"} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-green-700 bg-green-50 rounded-lg border border-green-200 text-sm">
                    <CheckCircle2 className="h-5 w-5 mx-auto mb-1" />
                    لا شذوذات مكتشفة — البيانات ضمن النطاق الطبيعي (±2.5σ)
                  </div>
                )}

                {result.changePoints.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-bold text-gray-600 mb-2">نقاط التحوّل (CUSUM):</div>
                    {result.changePoints.map((cp, i) => (
                      <div key={i} className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm">
                        <span className="font-medium">{cp.date}</span>
                        <div className="flex items-center gap-3 text-xs">
                          <span>{cp.direction === "shift_down" ? "↓ انخفاض مفاجئ" : "↑ ارتفاع مفاجئ"}</span>
                          <span>شدة: <strong>{cp.magnitude.toFixed(2)}σ</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* Adaptive Thresholds */}
              <SectionCard title="4. العتبات التكيفية — مشتقة من بيانات المزرعة" icon={Settings2}>
                <div className="flex items-center gap-2 mb-3">
                  <Badge text={result.adaptiveThresholds.source === "farm_history" ? "مشتقة من التاريخ" : "قيم افتراضية علمية"} color={result.adaptiveThresholds.source === "farm_history" ? "bg-green-100 text-green-700 border-green-200" : "bg-blue-100 text-blue-700 border-blue-200"} />
                  <span className="text-xs text-gray-500">ثقة: {(result.adaptiveThresholds.confidenceInThresholds * 100).toFixed(0)}%</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 border">
                    <div className="text-xs font-bold text-gray-600 mb-2">معدل الفقس</div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-green-600">جيد ≥</span><span className="font-bold">{result.adaptiveThresholds.hatchRate.good}%</span></div>
                      <div className="flex justify-between"><span className="text-yellow-600">مقبول ≥</span><span className="font-bold">{result.adaptiveThresholds.hatchRate.acceptable}%</span></div>
                      <div className="flex justify-between"><span className="text-red-600">ضعيف &lt;</span><span className="font-bold">{result.adaptiveThresholds.hatchRate.poor}%</span></div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 border">
                    <div className="text-xs font-bold text-gray-600 mb-2">درجة الحرارة</div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-green-600">أدنى</span><span className="font-bold">{result.adaptiveThresholds.temperature.optimal_lo}°C</span></div>
                      <div className="flex justify-between"><span className="text-green-600">أعلى</span><span className="font-bold">{result.adaptiveThresholds.temperature.optimal_hi}°C</span></div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 border">
                    <div className="text-xs font-bold text-gray-600 mb-2">الرطوبة</div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-green-600">أدنى</span><span className="font-bold">{result.adaptiveThresholds.humidity.optimal_lo}%</span></div>
                      <div className="flex justify-between"><span className="text-green-600">أعلى</span><span className="font-bold">{result.adaptiveThresholds.humidity.optimal_hi}%</span></div>
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* Risk Model */}
              <SectionCard title="5. نموذج الخطر — Weighted Logistic Regression" icon={Shield}>
                <div className="flex items-center gap-4 mb-4">
                  <div className={cn("w-20 h-20 rounded-full flex flex-col items-center justify-center border-4 font-bold text-xl", riskBg[result.riskModel.riskLevel], "text-white border-white shadow-lg")}>
                    {result.riskModel.riskScore}
                    <span className="text-xs font-normal">/ 100</span>
                  </div>
                  <div>
                    <div className={cn("text-lg font-bold", result.riskModel.riskLevel === "critical" ? "text-red-700" : result.riskModel.riskLevel === "high" ? "text-orange-700" : result.riskModel.riskLevel === "medium" ? "text-yellow-700" : "text-green-700")}>
                      مستوى الخطر: {riskLabels[result.riskModel.riskLevel]}
                    </div>
                    <div className="text-sm text-gray-600">احتمال الفشل: <strong>{(result.riskModel.failureProbability * 100).toFixed(1)}%</strong></div>
                    <div className="text-xs text-gray-400 font-mono mt-1">logit = {result.riskModel.logit} → sigmoid = {result.riskModel.failureProbability.toFixed(4)}</div>
                  </div>
                </div>

                <div className="text-xs font-bold text-gray-600 mb-2">العوامل بالأوزان (مجموع = 1.0):</div>
                <div className="space-y-2">
                  {result.riskModel.factors.map((f) => (
                    <div key={f.name} className="border rounded-lg p-3 bg-white">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-gray-700">{f.nameAr}</span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">وزن {(f.weight * 100).toFixed(0)}%</span>
                          <span className="text-gray-500">تأثير: {f.logitContribution.toFixed(4)}</span>
                        </div>
                      </div>
                      <ProgressBar value={f.normalized * 100} max={150} color={f.normalized > 0.7 ? "bg-red-500" : f.normalized > 0.4 ? "bg-yellow-500" : "bg-green-500"} />
                      <div className="text-xs text-gray-500 mt-1">{f.evidence}</div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Prediction */}
              <SectionCard title="6. التنبؤ — OLS Extrapolation + Bayesian Confidence" icon={TrendingUp}>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-amber-700">{result.prediction.nextCycleHatchRate?.toFixed(1) ?? "—"}%</div>
                    <div className="text-xs text-amber-600">توقع الدورة القادمة</div>
                    {result.prediction.ci95 && <div className="text-xs text-gray-400 mt-1">95% CI: [{result.prediction.ci95[0]}%, {result.prediction.ci95[1]}%]</div>}
                  </div>
                  <div className={cn("border rounded-lg p-3 text-center", result.prediction.failureProbability48h > 65 ? "bg-red-50 border-red-200" : result.prediction.failureProbability48h > 45 ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200")}>
                    <div className={cn("text-2xl font-bold", result.prediction.failureProbability48h > 65 ? "text-red-700" : result.prediction.failureProbability48h > 45 ? "text-orange-700" : "text-green-700")}>{result.prediction.failureProbability48h.toFixed(1)}%</div>
                    <div className="text-xs text-gray-600">احتمال فشل 48 ساعة</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                    <div className="flex justify-center mb-1">
                      {result.prediction.trend === "improving" ? <TrendingUp className="h-7 w-7 text-green-600" /> : result.prediction.trend === "declining" ? <TrendingDown className="h-7 w-7 text-red-600" /> : <Minus className="h-7 w-7 text-gray-500" />}
                    </div>
                    <div className="text-xs text-blue-700 font-medium">{result.prediction.trend === "improving" ? "اتجاه تصاعدي" : result.prediction.trend === "declining" ? "اتجاه تنازلي" : "مستقر"}</div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border text-xs font-mono text-gray-600 space-y-1">
                  <div>R² = {result.meta.modelMetrics.r2} | slope = {result.meta.modelMetrics.olsSlope} | EWMA slope = {result.meta.modelMetrics.ewmaSlope}</div>
                  <div>autocorr(lag=1) = {result.meta.modelMetrics.autocorr} | sample n = {result.meta.modelMetrics.sampleSize}</div>
                  <div>input hash = {result.meta.inputHash} | computed at {new Date(result.meta.computedAt).toLocaleTimeString("ar-SA")}</div>
                </div>
              </SectionCard>

              {/* Causal Analysis */}
              <SectionCard title="7. التحليل السببي — Structural Causal Model (SCM)" icon={GitFork}>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
                  <strong>الارتباط مقابل السببية:</strong><br />
                  {result.causal.correlationVsCausation}
                </div>
                <div className="mb-3">
                  <span className="text-xs font-bold text-gray-600">السبب الرئيسي: </span>
                  <span className="text-sm font-bold text-red-700">{result.causal.primaryCause}</span>
                </div>
                <div className="space-y-2">
                  {result.causal.pathways.map((p) => (
                    <div key={p.id} className="border rounded-lg p-3 bg-white">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-800">{p.nameAr}</span>
                          {p.isTrueCause && <Badge text="سببية حقيقية" color="bg-purple-100 text-purple-700 border-purple-200" />}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-500">وزن {(p.weight * 100).toFixed(0)}%</span>
                          <span className={cn("font-bold", p.causalEffect > 10 ? "text-red-600" : p.causalEffect > 5 ? "text-orange-600" : "text-green-600")}>{p.causalEffect.toFixed(1)}% تأثير</span>
                        </div>
                      </div>
                      <ProgressBar value={p.causalEffect} max={40} color={p.causalEffect > 15 ? "bg-red-500" : p.causalEffect > 8 ? "bg-orange-500" : "bg-green-500"} />
                      <div className="text-xs text-gray-500 mt-1.5">{p.evidence}</div>
                      <div className="text-xs text-gray-400 mt-0.5 font-mono">{p.structuralEquation.split("(")[0]}</div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Confidence */}
              <SectionCard title="8. درجة الثقة — Bayesian Update" icon={Target}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-4xl font-black text-amber-700">{result.confidence.score}<span className="text-lg text-gray-400">/100</span></div>
                  <div className="flex-1">
                    <ProgressBar value={result.confidence.score} color={result.confidence.score >= 70 ? "bg-green-500" : result.confidence.score >= 40 ? "bg-yellow-500" : "bg-red-500"} />
                    {result.confidence.accuracyAdjustment !== 0 && (
                      <div className="text-xs text-gray-500 mt-1">تعديل Bayesian: {result.confidence.accuracyAdjustment > 0 ? "+" : ""}{(result.confidence.accuracyAdjustment * 100).toFixed(1)}% من السجل التاريخي</div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {Object.entries(result.confidence.breakdown).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-3 text-sm">
                      <span className="w-28 text-gray-600 text-xs truncate">{k === "sampleSize" ? "حجم العينة" : k === "modelFit" ? "جودة النموذج" : k === "dataCoverage" ? "تغطية البيانات" : "دقة تاريخية"}</span>
                      <div className="flex-1">
                        <ProgressBar value={v.value} color="bg-amber-500" />
                      </div>
                      <span className="text-xs font-bold text-gray-700 w-10 text-left">{v.value.toFixed(0)}%</span>
                      <span className="text-xs text-gray-400">×{v.weight}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}
        </>
      )}

      {/* SELF-MONITOR TAB */}
      {tab === "monitor" && (
        <>
          <Button onClick={runMonitor} disabled={monLoading} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3">
            {monLoading ? <><Loader2 className="h-4 w-4 animate-spin ml-2" />جارٍ التحميل...</> : <><RefreshCw className="h-4 w-4 ml-2" />تحديث تقرير المراقبة</>}
          </Button>

          {monitor && (
            <div className="space-y-4">
              {/* System Health */}
              <SectionCard title="صحة النظام" icon={Activity}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn("px-4 py-2 rounded-full font-bold text-sm border", monitor.systemHealth === "healthy" ? "bg-green-50 text-green-700 border-green-200" : monitor.systemHealth === "degraded" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-gray-50 text-gray-600 border-gray-200")}>
                    {monitor.systemHealth === "healthy" ? "✓ سليم" : monitor.systemHealth === "degraded" ? "⚠ متدهور" : "— غير معروف"}
                  </div>
                  <span className="text-sm text-gray-600">{monitor.recommendation}</span>
                </div>
                {monitor.stuckDetection.isStuck && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
                    <strong>كشف التعثر:</strong> {monitor.stuckDetection.reason}
                    <br /><span className="text-xs">{monitor.stuckDetection.recommendation}</span>
                  </div>
                )}
              </SectionCard>

              {/* Accuracy Metrics */}
              {monitor.accuracy ? (
                <SectionCard title="دقة التوقعات — Prediction vs Actual" icon={Target}>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: "متوسط الخطأ (MAE)", value: `${monitor.accuracy.mae}pp`, color: monitor.accuracy.mae < 5 ? "text-green-700" : monitor.accuracy.mae < 10 ? "text-yellow-700" : "text-red-700" },
                      { label: "جذر متوسط الخطأ (RMSE)", value: `${monitor.accuracy.rmse}pp`, color: "text-gray-700" },
                      { label: "الانحياز (Bias)", value: `${monitor.accuracy.bias > 0 ? "+" : ""}${monitor.accuracy.bias}pp`, color: "text-gray-700" },
                      { label: "دقة (±5pp)", value: `${monitor.accuracy.accuracyRate}%`, color: monitor.accuracy.accuracyRate >= 70 ? "text-green-700" : "text-orange-700" },
                      { label: "دقة الاتجاه", value: `${monitor.accuracy.trendAccuracy}%`, color: "text-gray-700" },
                      { label: "توقعات محلولة", value: monitor.accuracy.resolvedCount.toString(), color: "text-gray-700" },
                    ].map((m, i) => (
                      <div key={i} className="bg-gray-50 border rounded-lg p-3 text-center">
                        <div className={cn("text-xl font-bold", m.color)}>{m.value}</div>
                        <div className="text-xs text-gray-500 mt-1">{m.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 border">
                    تعديل Bayesian: {monitor.accuracy.confidenceAdjustment > 0 ? "+" : ""}{monitor.accuracy.confidenceAdjustment.toFixed(4)} logit
                    {" "}({monitor.accuracy.confidenceAdjustment < 0 ? "النموذج متفائل — نرفع إشارة الخطر" : "النموذج متحفظ — نخفف إشارة الخطر"})
                  </div>
                </SectionCard>
              ) : (
                <div className="bg-gray-50 border rounded-lg p-6 text-center text-gray-500">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <div className="text-sm font-medium">لا يوجد سجل توقعات بعد</div>
                  <div className="text-xs mt-1">شغّل التحليل عدة مرات ثم أكمل دورات جديدة لتفعيل التعلم الذاتي</div>
                </div>
              )}

              {/* Recent Predictions Log */}
              {monitor.recentPredictions.length > 0 && (
                <SectionCard title="سجل التوقعات الأخيرة" icon={Database}>
                  <div className="space-y-2">
                    {monitor.recentPredictions.map((p) => (
                      <div key={p.id} className={cn("border rounded-lg p-3 text-sm", p.resolved ? "bg-white" : "bg-gray-50")}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleString("ar-SA")}</span>
                          <Badge text={p.resolved ? "محلول" : "معلق"} color={p.resolved ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"} />
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs text-center">
                          <div><span className="text-gray-400 block">توقع</span><span className="font-bold">{p.predictedHatchRate?.toFixed(1) ?? "—"}%</span></div>
                          <div><span className="text-gray-400 block">فعلي</span><span className="font-bold">{p.actualHatchRate?.toFixed(1) ?? "—"}%</span></div>
                          <div><span className="text-gray-400 block">خطأ</span><span className={cn("font-bold", p.error != null ? (Math.abs(p.error) < 5 ? "text-green-600" : "text-red-600") : "text-gray-400")}>{p.error != null ? `${p.error > 0 ? "+" : ""}${p.error.toFixed(1)}pp` : "—"}</span></div>
                          <div><span className="text-gray-400 block">ثقة</span><span className="font-bold">{p.confidenceScore ?? "—"}%</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
