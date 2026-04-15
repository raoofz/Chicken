/**
 * صفحة التحليل الذكي للمزرعة
 * يعمل تلقائياً ويتحدث كلما تغيرت البيانات
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Brain, Loader2, TrendingUp, TrendingDown, Minus,
  Activity, AlertTriangle, CheckCircle2, Shield,
  Target, RefreshCw, Info, XCircle,
  Database, Eye, Bell, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────
interface RollingStats { window: number; count: number; mean: number; std: number; variance: number; min: number; max: number; rateOfChange: number; trend: { slope: number; r2: number; n: number } | null; }
interface AnomalyPoint { index: number; date: string; value: number; zScore: number; type: "spike" | "drop"; severity: "critical" | "high" | "low"; }
interface ChangePoint { index: number; date: string; direction: "shift_up" | "shift_down"; magnitude: number; }
interface FeatureVector { rolling3d: RollingStats | null; rolling7d: RollingStats | null; rolling14d: RollingStats | null; ewmaSlope: number; autocorrelationLag1: number; anomalies: AnomalyPoint[]; changePoints: ChangePoint[]; globalMean: number; globalStd: number; globalVariance: number; globalStability: number; sampleSize: number; }
interface AdaptiveThresholds { hatchRate: { good: number; acceptable: number; poor: number }; temperature: { optimal_lo: number; optimal_hi: number }; humidity: { optimal_lo: number; optimal_hi: number }; source: string; }
interface DataQualityReport { score: number; sufficient: boolean; issues: string[]; warnings: string[]; minimumMetByCriteria: Record<string, boolean>; }
interface RiskFactor { name: string; nameAr: string; weight: number; rawValue: number; normalized: number; evidence: string; }
interface RiskModel { factors: RiskFactor[]; failureProbability: number; riskScore: number; riskLevel: "critical" | "high" | "medium" | "low"; }
interface CausalPathway { id: string; nameAr: string; causalEffect: number; evidence: string; isTrueCause: boolean; weight: number; }
interface CausalResult { pathways: CausalPathway[]; primaryCause: string; }
interface ConfidenceResult { score: number; breakdown: Record<string, { weight: number; value: number; reason: string }>; }
interface PrecisionOutput { dataQuality: DataQualityReport; features: FeatureVector; adaptiveThresholds: AdaptiveThresholds; riskModel: RiskModel; prediction: { nextCycleHatchRate: number | null; ci95: [number, number] | null; failureProbability48h: number; trend: "improving" | "declining" | "stable"; }; anomalyTimeline: AnomalyPoint[]; changePoints: ChangePoint[]; causal: CausalResult; confidence: ConfidenceResult; meta: { computedAt: string; inputHash: string; modelMetrics: Record<string, number>; }; }
interface MonitorReport { accuracy: { resolvedCount: number; mae: number; accuracyRate: number; } | null; stuckDetection: { isStuck: boolean; reason: string | null; }; recentPredictions: Array<{ id: number; createdAt: string; predictedHatchRate: number | null; actualHatchRate: number | null; error: number | null; confidenceScore: number | null; resolved: boolean; }>; recommendation: string; }

// ─── تسميات بسيطة للعوامل ────────────────────────────────────────────────────
const factorLabels: Record<string, string> = {
  hatch_rate:    "نسبة الفقس",
  temperature:   "درجة الحرارة",
  humidity:      "الرطوبة",
  trend:         "اتجاه الأداء",
  operations:    "المهام المتأخرة",
  documentation: "التوثيق اليومي",
};

const riskBg: Record<string, string> = {
  critical: "bg-red-500", high: "bg-orange-500", medium: "bg-yellow-500", low: "bg-green-500",
};
const riskText: Record<string, string> = {
  critical: "text-red-700", high: "text-orange-700", medium: "text-yellow-700", low: "text-green-700",
};
const riskBorder: Record<string, string> = {
  critical: "bg-red-50 border-red-200", high: "bg-orange-50 border-orange-200", medium: "bg-yellow-50 border-yellow-200", low: "bg-green-50 border-green-200",
};
const riskLabel: Record<string, string> = {
  critical: "🔴 خطر شديد — تدخل فوري", high: "🟠 خطر مرتفع — تصرف اليوم",
  medium: "🟡 متوسط — راقب الوضع", low: "🟢 جيد — استمر",
};

// ─── مكونات مساعدة ────────────────────────────────────────────────────────────
function Bar({ value, max = 100, color = "bg-amber-500" }: { value: number; max?: number; color?: string }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
      <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

function Card2({ title, icon: Icon, children, accent = false }: { title: string; icon: any; children: React.ReactNode; accent?: boolean }) {
  return (
    <Card className={cn("border shadow-sm", accent && "border-amber-200")}>
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <Icon className={cn("h-4 w-4", accent ? "text-amber-600" : "text-gray-500")} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">{children}</CardContent>
    </Card>
  );
}

// ─── المكوّن الرئيسي ──────────────────────────────────────────────────────────
export default function PrecisionAnalysis() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PrecisionOutput | null>(null);
  const [monitor, setMonitor] = useState<MonitorReport | null>(null);
  const [tab, setTab] = useState<"main" | "history">("main");
  const [dataChanged, setDataChanged] = useState(false);
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const fingerprintRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── التحليل ──────────────────────────────────────────────────────────────
  const runAnalysis = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const resp = await fetch("/api/ai/precision", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (!resp.ok) throw new Error((await resp.json()).error ?? resp.statusText);
      const data = await resp.json();
      setResult(data.result);
      setDataChanged(false);
      setLastHash(data.result.meta.inputHash);
      fingerprintRef.current = data.result.meta.inputHash;
      setLastRunAt(new Date().toLocaleTimeString("ar-SA"));
      if (!silent) toast({ title: "✅ تم التحليل", description: "النتائج محدّثة بأحدث بيانات المزرعة" });
    } catch (e: any) {
      if (!silent) toast({ variant: "destructive", title: "خطأ في التحليل", description: e.message });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast]);

  // ── فحص تغيّر البيانات ───────────────────────────────────────────────────
  const checkFingerprint = useCallback(async () => {
    try {
      const resp = await fetch("/api/ai/fingerprint", { credentials: "include" });
      if (!resp.ok) return;
      const { fingerprint } = await resp.json();
      if (fingerprintRef.current && fingerprint !== fingerprintRef.current) {
        setDataChanged(true);
        // Auto re-run silently
        fingerprintRef.current = fingerprint;
        await runAnalysis(true);
        toast({ title: "🔄 تحديث تلقائي", description: "البيانات تغيّرت — جارٍ تحديث التحليل" });
      } else if (!fingerprintRef.current) {
        fingerprintRef.current = fingerprint;
      }
    } catch { /* silent */ }
  }, [runAnalysis, toast]);

  // ── التحليل الأولي عند فتح الصفحة + مؤقت كل 30 ثانية ─────────────────────
  useEffect(() => {
    runAnalysis(false);
    intervalRef.current = setInterval(checkFingerprint, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── سجل المراقبة ─────────────────────────────────────────────────────────
  const loadMonitor = useCallback(async () => {
    try {
      const resp = await fetch("/api/ai/monitor", { credentials: "include" });
      if (!resp.ok) return;
      const data = await resp.json();
      setMonitor(data.report);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (tab === "history") loadMonitor();
  }, [tab, loadMonitor]);

  if (!user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 gap-2">
        <Shield className="h-5 w-5" />للمديرين فقط
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4" dir="rtl">

      {/* ── رأس الصفحة ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Brain className="h-5 w-5 text-amber-600" />
            التحليل الذكي للمزرعة
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            يتحدث تلقائياً كل 30 ثانية
            {lastRunAt && ` · آخر تحديث ${lastRunAt}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={tab === "main" ? "default" : "outline"} onClick={() => setTab("main")} className={tab === "main" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}>
            <Brain className="h-3.5 w-3.5 ml-1" />التحليل
          </Button>
          <Button size="sm" variant={tab === "history" ? "default" : "outline"} onClick={() => setTab("history")} className={tab === "history" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}>
            <Eye className="h-3.5 w-3.5 ml-1" />السجل
          </Button>
        </div>
      </div>

      {/* ── إشعار تحديث البيانات ── */}
      {dataChanged && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">
          <Bell className="h-4 w-4 flex-shrink-0 animate-pulse" />
          البيانات تغيّرت — جارٍ التحديث التلقائي...
        </div>
      )}

      {/* ── زر التحديث اليدوي ── */}
      <Button onClick={() => runAnalysis(false)} disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 text-sm">
        {loading
          ? <><Loader2 className="h-4 w-4 animate-spin ml-2" />جارٍ التحليل...</>
          : <><RefreshCw className="h-4 w-4 ml-2" />تحديث التحليل الآن</>}
      </Button>

      {/* ══════════════════════════════════════════════════════ */}
      {/* تبويب التحليل الرئيسي */}
      {/* ══════════════════════════════════════════════════════ */}
      {tab === "main" && result && (
        <div className="space-y-4">

          {/* ── جودة البيانات ── */}
          <Card2 title="حالة البيانات" icon={Database}>
            <div className="flex items-center gap-3 mb-3">
              <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border", result.dataQuality.sufficient ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200")}>
                {result.dataQuality.sufficient
                  ? <><CheckCircle2 className="h-4 w-4" />البيانات كافية للتحليل</>
                  : <><XCircle className="h-4 w-4" />بيانات ناقصة — التحليل غير ممكن</>}
              </div>
              <span className="text-sm text-gray-500">{result.dataQuality.score}/100 نقطة</span>
            </div>
            <Bar value={result.dataQuality.score} color={result.dataQuality.score >= 70 ? "bg-green-500" : result.dataQuality.score >= 40 ? "bg-yellow-500" : "bg-red-500"} />
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {Object.entries(result.dataQuality.minimumMetByCriteria).map(([k, v]) => (
                <div key={k} className={cn("flex items-center gap-1.5 text-xs px-2 py-1.5 rounded border", v ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-600")}>
                  {v ? <CheckCircle2 className="h-3 w-3 flex-shrink-0" /> : <XCircle className="h-3 w-3 flex-shrink-0" />}
                  {k === "hasCompletedCycles" ? "دورات مكتملة" : k === "hasTemperatureData" ? "قراءات الحرارة" : k === "hasSufficientHistory" ? "تاريخ كافٍ (3+ دورات)" : k === "hasDocumentation" ? "ملاحظات يومية" : k === "hasActiveCycles" ? "دورات نشطة" : k}
                </div>
              ))}
            </div>
            {result.dataQuality.issues.map((iss, i) => (
              <div key={i} className="mt-2 flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded px-3 py-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />{iss}
              </div>
            ))}
            {result.dataQuality.warnings.map((w, i) => (
              <div key={i} className="mt-1.5 flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 rounded px-3 py-2">
                <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />{w}
              </div>
            ))}
          </Card2>

          {/* ── مستوى الخطر ── */}
          <Card2 title="مستوى الخطر الحالي" icon={Shield} accent>
            <div className="flex items-center gap-4 mb-4">
              <div className={cn("w-20 h-20 rounded-full flex flex-col items-center justify-center font-black text-2xl text-white shadow-lg", riskBg[result.riskModel.riskLevel])}>
                {result.riskModel.riskScore}
                <span className="text-xs font-normal">/ 100</span>
              </div>
              <div>
                <div className={cn("text-base font-bold", riskText[result.riskModel.riskLevel])}>
                  {riskLabel[result.riskModel.riskLevel]}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  احتمال مشكلة خلال 48 ساعة: <strong>{(result.riskModel.failureProbability * 100).toFixed(0)}%</strong>
                </div>
              </div>
            </div>

            {/* عوامل الخطر */}
            <div className="space-y-2.5">
              {result.riskModel.factors.map((f) => (
                <div key={f.name}>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span className="font-medium">{factorLabels[f.name] ?? f.nameAr}</span>
                    <span className="text-gray-400">{f.evidence}</span>
                  </div>
                  <Bar
                    value={f.normalized * 100}
                    max={120}
                    color={f.normalized > 0.7 ? "bg-red-500" : f.normalized > 0.4 ? "bg-yellow-500" : "bg-green-500"}
                  />
                </div>
              ))}
            </div>
          </Card2>

          {/* ── توقع الدورة القادمة ── */}
          <Card2 title="توقع الدورة القادمة" icon={Target} accent>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-black text-amber-700">
                  {result.prediction.nextCycleHatchRate?.toFixed(0) ?? "—"}%
                </div>
                <div className="text-xs text-amber-600 mt-1">نسبة الفقس المتوقعة</div>
                {result.prediction.ci95 && (
                  <div className="text-xs text-gray-400 mt-1">
                    بين {result.prediction.ci95[0].toFixed(0)}% و {result.prediction.ci95[1].toFixed(0)}%
                  </div>
                )}
              </div>
              <div className={cn("border rounded-xl p-4 text-center", result.prediction.failureProbability48h > 65 ? "bg-red-50 border-red-200" : result.prediction.failureProbability48h > 45 ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200")}>
                <div className={cn("text-3xl font-black", result.prediction.failureProbability48h > 65 ? "text-red-700" : result.prediction.failureProbability48h > 45 ? "text-orange-700" : "text-green-700")}>
                  {result.prediction.failureProbability48h.toFixed(0)}%
                </div>
                <div className="text-xs text-gray-600 mt-1">خطر خلال 48 ساعة</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center flex flex-col items-center justify-center">
                {result.prediction.trend === "improving" ? <TrendingUp className="h-8 w-8 text-green-600 mb-1" /> : result.prediction.trend === "declining" ? <TrendingDown className="h-8 w-8 text-red-600 mb-1" /> : <Minus className="h-8 w-8 text-gray-500 mb-1" />}
                <div className="text-xs text-blue-700 font-bold">
                  {result.prediction.trend === "improving" ? "أداء في تحسّن" : result.prediction.trend === "declining" ? "أداء في تراجع" : "أداء مستقر"}
                </div>
              </div>
            </div>
          </Card2>

          {/* ── أسباب المشكلة ── */}
          <Card2 title="أسباب المشكلة" icon={Activity}>
            <div className="mb-3 px-3 py-2 bg-amber-50 rounded-lg border border-amber-100 text-sm">
              <span className="text-gray-500">السبب الرئيسي: </span>
              <span className="font-bold text-amber-800">{result.causal.primaryCause}</span>
            </div>
            <div className="space-y-2">
              {result.causal.pathways.map((p) => (
                <div key={p.id} className="border rounded-lg p-3 bg-white">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-800">{p.nameAr}</span>
                    <span className={cn("text-sm font-bold", p.causalEffect > 10 ? "text-red-600" : p.causalEffect > 5 ? "text-orange-600" : "text-green-600")}>
                      {p.causalEffect.toFixed(1) === "0.0" ? "لا تأثير" : `${p.causalEffect.toFixed(1)}% تأثير`}
                    </span>
                  </div>
                  <Bar value={p.causalEffect} max={40} color={p.causalEffect > 15 ? "bg-red-500" : p.causalEffect > 8 ? "bg-orange-500" : "bg-green-400"} />
                  <div className="text-xs text-gray-400 mt-1.5">{p.evidence}</div>
                </div>
              ))}
            </div>
          </Card2>

          {/* ── قراءات غير عادية ── */}
          <Card2 title="قراءات غير عادية" icon={AlertTriangle}>
            {result.anomalyTimeline.length === 0 && result.changePoints.length === 0 ? (
              <div className="flex items-center gap-2 py-3 text-green-700 bg-green-50 rounded-lg border border-green-200 px-4 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                لا توجد قراءات غير عادية — الأداء منتظم
              </div>
            ) : (
              <div className="space-y-2">
                {result.anomalyTimeline.map((a, i) => (
                  <div key={i} className={cn("flex items-center justify-between rounded-lg px-3 py-2.5 text-sm border", a.severity === "critical" ? "bg-red-50 border-red-200" : a.severity === "high" ? "bg-orange-50 border-orange-200" : "bg-yellow-50 border-yellow-200")}>
                    <div className="flex items-center gap-2">
                      {a.type === "drop" ? <TrendingDown className="h-4 w-4 text-red-600" /> : <TrendingUp className="h-4 w-4 text-green-600" />}
                      <div>
                        <div className="font-medium">{a.date}</div>
                        <div className="text-xs text-gray-500">قيمة: {a.value.toFixed(1)}% — {a.type === "drop" ? "انخفاض مفاجئ" : "ارتفاع مفاجئ"}</div>
                      </div>
                    </div>
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded border", a.severity === "critical" ? "bg-red-100 text-red-700 border-red-200" : a.severity === "high" ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-yellow-100 text-yellow-700 border-yellow-200")}>
                      {a.severity === "critical" ? "خطر شديد" : a.severity === "high" ? "غير عادي" : "لاحظ"}
                    </span>
                  </div>
                ))}
                {result.changePoints.map((cp, i) => (
                  <div key={i} className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5 text-sm">
                    <div>
                      <div className="font-medium">{cp.date}</div>
                      <div className="text-xs text-gray-500">{cp.direction === "shift_down" ? "انخفاض مفاجئ في الأداء" : "ارتفاع مفاجئ في الأداء"}</div>
                    </div>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded border border-orange-200">تغيّر مفاجئ</span>
                  </div>
                ))}
              </div>
            )}
          </Card2>

          {/* ── إحصائيات الأداء ── */}
          <Card2 title="إحصائيات أداء المزرعة" icon={Activity}>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "متوسط نسبة الفقس", value: `${result.features.globalMean.toFixed(1)}%`, desc: "كل الدورات" },
                { label: "الانحراف العادي", value: `±${result.features.globalStd.toFixed(1)}%`, desc: "مدى التذبذب" },
                { label: "استقرار الأداء", value: `${(result.features.globalStability * 100).toFixed(0)}%`, desc: "100% = مثالي" },
                { label: "اتجاه الأداء", value: `${result.features.ewmaSlope > 0 ? "+" : ""}${result.features.ewmaSlope.toFixed(2)}`, desc: "لكل دورة" },
                { label: "عدد الدورات", value: result.features.sampleSize.toString(), desc: "دورات محللة" },
                { label: "ارتباط البيانات", value: result.features.autocorrelationLag1 > 0.3 ? "منتظم" : result.features.autocorrelationLag1 < -0.3 ? "متذبذب" : "عشوائي", desc: "نمط البيانات" },
              ].map((s, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 text-center border">
                  <div className="text-lg font-bold text-amber-700">{s.value}</div>
                  <div className="text-xs font-medium text-gray-700 mt-0.5">{s.label}</div>
                  <div className="text-xs text-gray-400">{s.desc}</div>
                </div>
              ))}
            </div>

            {/* نافذة 7 أيام */}
            {result.features.rolling7d && result.features.rolling7d.count > 0 && (
              <div className="border rounded-xl p-3 bg-white">
                <div className="text-xs font-bold text-gray-600 mb-2">آخر 7 أيام ({result.features.rolling7d.count} قراءة)</div>
                <div className="grid grid-cols-4 gap-2 text-xs text-center">
                  <div><span className="text-gray-400 block">متوسط</span><span className="font-bold">{result.features.rolling7d.mean.toFixed(1)}%</span></div>
                  <div><span className="text-gray-400 block">أعلى</span><span className="font-bold">{result.features.rolling7d.max.toFixed(1)}%</span></div>
                  <div><span className="text-gray-400 block">أدنى</span><span className="font-bold">{result.features.rolling7d.min.toFixed(1)}%</span></div>
                  <div><span className="text-gray-400 block">التغيّر</span><span className={cn("font-bold", result.features.rolling7d.rateOfChange > 0 ? "text-green-600" : result.features.rolling7d.rateOfChange < 0 ? "text-red-600" : "text-gray-600")}>{result.features.rolling7d.rateOfChange > 0 ? "+" : ""}{result.features.rolling7d.rateOfChange.toFixed(1)}%</span></div>
                </div>
              </div>
            )}
          </Card2>

          {/* ── المعايير المعتمدة ── */}
          <Card2 title="المعايير المعتمدة للمزرعة" icon={Target}>
            <div className={cn("mb-2 text-xs px-3 py-1.5 rounded border inline-block", result.adaptiveThresholds.source === "farm_history" ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200")}>
              {result.adaptiveThresholds.source === "farm_history" ? "✓ مشتقة من تاريخ مزرعتك" : "📖 معايير علمية افتراضية"}
            </div>
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div className="bg-gray-50 rounded-xl p-3 border text-xs">
                <div className="font-bold text-gray-700 mb-2">نسبة الفقس</div>
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-green-600">ممتاز</span><span className="font-bold">{result.adaptiveThresholds.hatchRate.good}%+</span></div>
                  <div className="flex justify-between"><span className="text-yellow-600">مقبول</span><span className="font-bold">{result.adaptiveThresholds.hatchRate.acceptable}%+</span></div>
                  <div className="flex justify-between"><span className="text-red-600">ضعيف</span><span className="font-bold">أقل {result.adaptiveThresholds.hatchRate.poor}%</span></div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border text-xs">
                <div className="font-bold text-gray-700 mb-2">درجة الحرارة</div>
                <div className="text-green-600 font-bold">{result.adaptiveThresholds.temperature.optimal_lo}° – {result.adaptiveThresholds.temperature.optimal_hi}°</div>
                <div className="text-gray-400 mt-1">النطاق المثالي</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border text-xs">
                <div className="font-bold text-gray-700 mb-2">الرطوبة</div>
                <div className="text-green-600 font-bold">{result.adaptiveThresholds.humidity.optimal_lo}% – {result.adaptiveThresholds.humidity.optimal_hi}%</div>
                <div className="text-gray-400 mt-1">النطاق المثالي</div>
              </div>
            </div>
          </Card2>

          {/* ── درجة الثقة بالنتائج ── */}
          <Card2 title="مدى الثقة بهذا التحليل" icon={Zap}>
            <div className="flex items-center gap-4 mb-3">
              <div className="text-4xl font-black text-amber-700">
                {result.confidence.score}<span className="text-lg text-gray-400">/100</span>
              </div>
              <div className="flex-1">
                <Bar value={result.confidence.score} color={result.confidence.score >= 70 ? "bg-green-500" : result.confidence.score >= 40 ? "bg-yellow-500" : "bg-red-500"} />
                <div className="text-xs text-gray-400 mt-1">
                  {result.confidence.score >= 70 ? "ثقة عالية — النتائج موثوقة" : result.confidence.score >= 40 ? "ثقة متوسطة — أضف المزيد من الدورات" : "ثقة منخفضة — النظام في مرحلة التعلم"}
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              {Object.entries(result.confidence.breakdown).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <span className="w-32 text-gray-500 flex-shrink-0">
                    {k === "sampleSize" ? "حجم البيانات" : k === "modelFit" ? "دقة النموذج" : k === "dataCoverage" ? "اكتمال البيانات" : "السجل التاريخي"}
                  </span>
                  <div className="flex-1"><Bar value={v.value} color="bg-amber-500" /></div>
                  <span className="font-bold text-gray-700 w-8 text-left">{v.value.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </Card2>

          {/* ── وقت آخر تحليل ── */}
          <div className="text-center text-xs text-gray-400 pb-2">
            آخر تحليل: {new Date(result.meta.computedAt).toLocaleString("ar-SA")} · بصمة البيانات: {result.meta.inputHash}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* تبويب السجل التاريخي */}
      {/* ══════════════════════════════════════════════════════ */}
      {tab === "history" && (
        <div className="space-y-4">
          {monitor ? (
            <>
              {/* صحة النظام */}
              <Card2 title="أداء التحليل الذكي" icon={Activity}>
                <div className="text-sm text-gray-700 mb-3">{monitor.recommendation}</div>
                {monitor.accuracy ? (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "متوسط الخطأ", value: `${monitor.accuracy.mae}%`, color: monitor.accuracy.mae < 5 ? "text-green-700" : monitor.accuracy.mae < 10 ? "text-yellow-700" : "text-red-700", desc: "كلما قلّ كلما أفضل" },
                      { label: "نسبة الدقة", value: `${monitor.accuracy.accuracyRate}%`, color: monitor.accuracy.accuracyRate >= 70 ? "text-green-700" : "text-orange-700", desc: "توقعات ضمن ±5%" },
                      { label: "توقعات محللة", value: monitor.accuracy.resolvedCount.toString(), color: "text-gray-700", desc: "دورات تم مقارنتها" },
                    ].map((m, i) => (
                      <div key={i} className="bg-gray-50 border rounded-xl p-3 text-center">
                        <div className={cn("text-xl font-bold", m.color)}>{m.value}</div>
                        <div className="text-xs text-gray-600 font-medium mt-0.5">{m.label}</div>
                        <div className="text-xs text-gray-400">{m.desc}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400 text-sm">
                    النظام في مرحلة التعلم — أكمل المزيد من الدورات لبناء السجل
                  </div>
                )}
                {monitor.stuckDetection.isStuck && (
                  <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
                    <strong>تنبيه:</strong> {monitor.stuckDetection.reason}
                  </div>
                )}
              </Card2>

              {/* سجل التوقعات */}
              {monitor.recentPredictions.length > 0 && (
                <Card2 title="سجل التوقعات الأخيرة" icon={Database}>
                  <div className="space-y-2">
                    {monitor.recentPredictions.map((p) => (
                      <div key={p.id} className="border rounded-xl p-3 bg-white text-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleString("ar-SA")}</span>
                          <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", p.resolved ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200")}>
                            {p.resolved ? "✓ تم التحقق" : "بانتظار النتيجة"}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs text-center">
                          <div><span className="text-gray-400 block">التوقع</span><span className="font-bold">{p.predictedHatchRate?.toFixed(0) ?? "—"}%</span></div>
                          <div><span className="text-gray-400 block">الفعلي</span><span className="font-bold">{p.actualHatchRate?.toFixed(0) ?? "—"}%</span></div>
                          <div><span className="text-gray-400 block">الفرق</span><span className={cn("font-bold", p.error != null ? (Math.abs(p.error) < 5 ? "text-green-600" : "text-red-600") : "text-gray-400")}>{p.error != null ? `${p.error > 0 ? "+" : ""}${p.error.toFixed(1)}%` : "—"}</span></div>
                          <div><span className="text-gray-400 block">الثقة</span><span className="font-bold">{p.confidenceScore ?? "—"}%</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card2>
              )}
            </>
          ) : (
            <div className="text-center py-10 text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              جارٍ تحميل السجل...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
