import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldAlert, Loader2, TrendingUp, TrendingDown, Minus,
  Brain, GitFork, Shuffle, Layers, ChevronRight,
  RefreshCw, AlertTriangle, CheckCircle2, Info,
  Target, Clock, Zap, BarChart3, Activity,
  ArrowRight, Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Module = "predict" | "causal" | "simulate" | "decision" | null;

interface Evidence {
  metric: string; value: string; benchmark: string;
  deviation: string; relevance: "critical" | "high" | "medium" | "low"; source: string;
}
interface ActionStep {
  priority: number; action: string; timeframe: string;
  expectedOutcome: string; urgency: "immediate" | "today" | "this_week" | "monitor";
}
interface Scenario { label: string; probability: number; outcome: string; hatchRate?: number; }
interface AdvancedOutput {
  analysisType: string;
  observations: string[];
  rootCause: { primary: string; mechanism: string; contributingFactors: { factor: string; weight: number; evidence: string }[] };
  riskLevel: { level: "critical" | "high" | "medium" | "low"; score: number; rationale: string };
  impact: { immediate: string; shortTerm: string; longTerm: string; quantifiedLoss: string };
  actionPlan: ActionStep[];
  prediction: { outcome: string; probability: number; timeHorizon: string; confidence: number; scenarios: Scenario[] };
  confidenceScore: number;
  evidence: Evidence[];
  dataQuality: { score: number; sampleSize: number; completeness: number };
}
interface SimResult {
  p10: number; p25: number; p50: number; p75: number; p90: number;
  mean: number; std: number; failureProbability: number;
  expectedHatched: number; currentBenchmark: number; improvement: number;
  distribution: { bucket: string; count: number; pct: number }[];
  scenarios: Scenario[];
  sensitivity: { factor: string; impact: number; direction: "positive" | "negative" }[];
  evidence: Evidence[]; confidenceScore: number;
  recommendation: string; analysisType: string;
}
interface DecisionResult {
  overallScore: number; overallRisk: "critical" | "high" | "medium" | "low";
  summaryStatement: string; predictive: AdvancedOutput; causal: AdvancedOutput;
  simulation: SimResult; topThreeActions: ActionStep[];
  confidenceScore: number; analysisType: string; timestamp: string;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const RISK_COLOR = {
  critical: { bg: "bg-red-50 dark:bg-red-950/20", border: "border-red-200 dark:border-red-800/40", text: "text-red-700 dark:text-red-400", dot: "bg-red-500", badge: "bg-red-500 text-white" },
  high:     { bg: "bg-orange-50 dark:bg-orange-950/20", border: "border-orange-200 dark:border-orange-800/40", text: "text-orange-700 dark:text-orange-400", dot: "bg-orange-500", badge: "bg-orange-500 text-white" },
  medium:   { bg: "bg-amber-50 dark:bg-amber-950/20", border: "border-amber-200 dark:border-amber-800/40", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500", badge: "bg-amber-500 text-white" },
  low:      { bg: "bg-emerald-50 dark:bg-emerald-950/20", border: "border-emerald-200 dark:border-emerald-800/40", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500", badge: "bg-emerald-500 text-white" },
};

const REL_COLOR = {
  critical: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20",
  high: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20",
  medium: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20",
  low: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20",
};

const URGENCY_COLOR = {
  immediate: "text-red-600 bg-red-50 dark:bg-red-950/20 border-red-200",
  today: "text-orange-600 bg-orange-50 dark:bg-orange-950/20 border-orange-200",
  this_week: "text-amber-600 bg-amber-50 dark:bg-amber-950/20 border-amber-200",
  monitor: "text-blue-600 bg-blue-50 dark:bg-blue-950/20 border-blue-200",
};

const urgencyLabel = (u: string, isSv: boolean) => {
  const m: Record<string, [string, string]> = {
    immediate: ["فوري 🔴", "Omedelbart 🔴"],
    today: ["اليوم 🟠", "Idag 🟠"],
    this_week: ["هذا الأسبوع 🟡", "Den här veckan 🟡"],
    monitor: ["متابعة 🔵", "Övervaka 🔵"],
  };
  return (m[u] ?? ["—", "—"])[isSv ? 1 : 0];
};

const riskLabel = (l: string, isSv: boolean) => {
  const m: Record<string, [string, string]> = {
    critical: ["حرج 🔴", "Kritisk 🔴"], high: ["مرتفع 🟠", "Hög 🟠"],
    medium: ["متوسط 🟡", "Medel 🟡"], low: ["منخفض 🟢", "Låg 🟢"],
  };
  return (m[l] ?? ["—", "—"])[isSv ? 1 : 0];
};

// ─────────────────────────────────────────────
// SUBCOMPONENTS
// ─────────────────────────────────────────────

function SectionHeader({ icon, label, color = "violet" }: { icon: React.ReactNode; label: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={cn("w-1.5 h-4 rounded-full", `bg-${color}-500`)} />
      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        {icon}{label}
      </span>
    </div>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 70 ? "emerald" : score >= 50 ? "amber" : "red";
  return (
    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", `bg-${color}-100 dark:bg-${color}-900/30 text-${color}-700 dark:text-${color}-400`)}>
      🎯 {score}%
    </span>
  );
}

function EvidenceTable({ evidence, isSv }: { evidence: Evidence[]; isSv: boolean }) {
  return (
    <div className="space-y-2">
      {evidence.map((e, i) => (
        <div key={i} className={cn("rounded-xl border p-3 text-right", REL_COLOR[e.relevance])}>
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded uppercase", REL_COLOR[e.relevance])}>
              {e.relevance}
            </span>
            <span className="font-semibold text-sm text-foreground">{e.metric}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-[11px]">
            <div><span className="text-muted-foreground">{isSv ? "Värde: " : "القيمة: "}</span><strong>{e.value}</strong></div>
            <div><span className="text-muted-foreground">{isSv ? "Mål: " : "المرجع: "}</span><strong>{e.benchmark}</strong></div>
            <div><span className="text-muted-foreground">{isSv ? "Avvik.: " : "الانحراف: "}</span><strong>{e.deviation}</strong></div>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">{isSv ? "Källa: " : "المصدر: "}{e.source}</div>
        </div>
      ))}
    </div>
  );
}

function ActionPlanList({ steps, isSv }: { steps: ActionStep[]; isSv: boolean }) {
  return (
    <div className="space-y-2">
      {steps.map((s, i) => (
        <div key={i} className={cn("rounded-xl border p-3 text-right", URGENCY_COLOR[s.urgency])}>
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="text-[10px] font-bold">{urgencyLabel(s.urgency, isSv)}</span>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-foreground/10 text-[10px] font-bold flex items-center justify-center shrink-0">{s.priority}</span>
              <span className="font-semibold text-sm text-foreground">{s.action}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.timeframe}</span>
            <span className="flex items-center gap-1"><Target className="w-3 h-3" />{s.expectedOutcome}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ScenarioBar({ scenarios }: { scenarios: Scenario[] }) {
  const colors = ["bg-emerald-500", "bg-blue-500", "bg-amber-500", "bg-red-500"];
  return (
    <div className="space-y-2">
      {scenarios.map((s, i) => (
        <div key={i} className="text-right">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs font-bold text-foreground">{s.probability}%</span>
            <span className="text-xs font-medium">{s.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-1000", colors[i % 4])}
                style={{ width: `${s.probability}%` }} />
            </div>
            <span className="text-[11px] text-muted-foreground min-w-[80px] text-left">{s.outcome}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function RiskGauge({ score, level }: { score: number; level: string }) {
  const r = RISK_COLOR[level as keyof typeof RISK_COLOR] ?? RISK_COLOR.low;
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className={cn("rounded-2xl border p-4 flex items-center gap-4", r.bg, r.border)}>
      <svg width="90" height="90" className="-rotate-90 shrink-0">
        <circle cx="45" cy="45" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
        <circle cx="45" cy="45" r="40" fill="none" strokeWidth="8" strokeLinecap="round"
          className={cn("transition-all duration-1000", r.dot.replace("bg-", "stroke-"))}
          strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="flex-1 text-right">
        <div className={cn("text-3xl font-black tabular-nums", r.text)}>{score}</div>
        <div className="text-xs text-muted-foreground">/100</div>
        <div className={cn("text-xs font-bold mt-1 px-2 py-0.5 rounded-full inline-block", r.badge)}>
          {riskLabel(level, false)}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ADVANCED OUTPUT VIEWER
// ─────────────────────────────────────────────

function AdvancedOutputView({ result, isSv }: { result: AdvancedOutput; isSv: boolean }) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">{result.analysisType}</p>
        <ConfidenceBadge score={result.confidenceScore} />
      </div>

      {/* 1. Observations */}
      <div>
        <SectionHeader icon={<Activity className="w-3.5 h-3.5" />} label={isSv ? "📊 Observationer" : "📊 الملاحظات"} color="blue" />
        <div className={cn("rounded-2xl border p-4 space-y-2 text-right", "border-blue-200/60 bg-blue-50/30 dark:bg-blue-950/20 dark:border-blue-800/40")}>
          {result.observations.map((o, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
              <span>{o}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Root Cause */}
      <div>
        <SectionHeader icon={<Brain className="w-3.5 h-3.5" />} label={isSv ? "🧠 Grundorsak" : "🧠 السبب الجذري"} color="violet" />
        <div className="rounded-2xl border border-violet-200/60 bg-violet-50/30 dark:bg-violet-950/20 dark:border-violet-800/40 p-4 text-right space-y-3">
          <div>
            <span className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase">{isSv ? "الأساسي" : "الأساسي"}: </span>
            <span className="font-bold text-sm">{result.rootCause.primary}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-6">{result.rootCause.mechanism}</p>
          <div className="space-y-1.5">
            {result.rootCause.contributingFactors.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                  <div className="h-full rounded-full bg-violet-500 transition-all duration-700" style={{ width: `${f.weight}%` }} />
                </div>
                <span className="text-[11px] font-bold text-violet-600 dark:text-violet-400 w-10 text-left">{f.weight}%</span>
                <span className="text-[11px] text-foreground min-w-[100px] text-right">{f.factor}</span>
                <span className="text-[10px] text-muted-foreground">{f.evidence}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Risk Level */}
      <div>
        <SectionHeader icon={<AlertTriangle className="w-3.5 h-3.5" />} label={isSv ? "⚠️ Risknivå" : "⚠️ مستوى الخطر"} color="amber" />
        <RiskGauge score={result.riskLevel.score} level={result.riskLevel.level} />
        <p className="text-xs text-muted-foreground mt-2 text-right leading-5">{result.riskLevel.rationale}</p>
      </div>

      {/* 4. Impact */}
      <div>
        <SectionHeader icon={<TrendingDown className="w-3.5 h-3.5" />} label={isSv ? "📈 Påverkan" : "📈 التأثير"} color="orange" />
        <div className="rounded-2xl border border-orange-200/60 bg-orange-50/30 dark:bg-orange-950/20 dark:border-orange-800/40 p-4 space-y-2 text-right">
          {[
            [isSv ? "فوري" : "فوري", result.impact.immediate],
            [isSv ? "قصير المدى" : "قصير المدى", result.impact.shortTerm],
            [isSv ? "طويل المدى" : "طويل المدى", result.impact.longTerm],
            [isSv ? "الخسارة المُكمّمة" : "الخسارة المُكمّمة", result.impact.quantifiedLoss],
          ].map(([k, v], i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="font-bold text-orange-700 dark:text-orange-400 shrink-0 text-[11px] pt-0.5">{k}:</span>
              <span className="text-foreground/90">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Action Plan */}
      <div>
        <SectionHeader icon={<CheckCircle2 className="w-3.5 h-3.5" />} label={isSv ? "✅ Handlingsplan" : "✅ خطة العمل"} color="emerald" />
        <ActionPlanList steps={result.actionPlan} isSv={isSv} />
      </div>

      {/* 6. Prediction */}
      <div>
        <SectionHeader icon={<TrendingUp className="w-3.5 h-3.5" />} label={isSv ? "🔮 Prognos" : "🔮 التوقع"} color="indigo" />
        <div className="rounded-2xl border border-indigo-200/60 bg-indigo-50/30 dark:bg-indigo-950/20 dark:border-indigo-800/40 p-4 space-y-3 text-right">
          <p className="font-semibold text-sm">{result.prediction.outcome}</p>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">{isSv ? "Sannolikhet" : "الاحتمال"}: <strong className="text-indigo-600">{result.prediction.probability}%</strong></span>
            <span className="text-muted-foreground">{isSv ? "Horisont" : "الأفق"}: <strong>{result.prediction.timeHorizon}</strong></span>
          </div>
          <ScenarioBar scenarios={result.prediction.scenarios} />
        </div>
      </div>

      {/* 7. Confidence Score */}
      <div>
        <SectionHeader icon={<Target className="w-3.5 h-3.5" />} label={isSv ? "🎯 Konfidenspoäng" : "🎯 درجة الثقة"} color="teal" />
        <div className="rounded-2xl border border-teal-200/60 bg-teal-50/30 dark:bg-teal-950/20 p-4 text-right">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">{isSv ? "حجم العينة" : "حجم العينة"}: {result.dataQuality.sampleSize}</span>
            <span className="text-2xl font-black text-teal-600 dark:text-teal-400">{result.confidenceScore}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
            <div className="h-full rounded-full bg-teal-500 transition-all duration-1000" style={{ width: `${result.confidenceScore}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {isSv ? "Datakomplettering" : "اكتمال البيانات"}: {result.dataQuality.completeness}%
          </p>
        </div>
      </div>

      {/* 8. Evidence */}
      <div>
        <SectionHeader icon={<Info className="w-3.5 h-3.5" />} label={isSv ? "🧾 Evidens" : "🧾 الأدلة"} color="slate" />
        <EvidenceTable evidence={result.evidence} isSv={isSv} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SIMULATION VIEW
// ─────────────────────────────────────────────

function SimulationView({ isSv }: { isSv: boolean }) {
  const { toast } = useToast();
  const { lang } = useLanguage();
  const [temperature, setTemperature] = useState(37.65);
  const [humidity, setHumidity] = useState(55);
  const [taskRate, setTaskRate] = useState(90);
  const [eggsSet, setEggsSet] = useState(100);
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runSim = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/simulate", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temperature, humidity, taskCompletionRate: taskRate, eggsSet, lang }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setResult(data.result);
    } catch (e: any) {
      toast({ title: isSv ? "Fel" : "خطأ", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [temperature, humidity, taskRate, eggsSet, lang, isSv, toast]);

  const maxDistPct = result ? Math.max(...result.distribution.map(d => d.pct)) : 1;

  return (
    <div className="space-y-5">
      <div className="text-xs text-muted-foreground text-right">{isSv ? "محاكاة مونت كارلو — 2000 سيناريو بناءً على بيانات المزرعة" : "محاكاة مونت كارلو — 2000 سيناريو بناءً على بيانات المزرعة"}</div>

      {/* Controls */}
      <div className="rounded-2xl border border-border/60 p-4 space-y-4 bg-muted/10">
        {[
          { label: isSv ? "درجة الحرارة °C" : "درجة الحرارة °C", value: temperature, set: setTemperature, min: 36, max: 39, step: 0.1, fmt: (v: number) => v.toFixed(1) },
          { label: isSv ? "الرطوبة %" : "الرطوبة %", value: humidity, set: setHumidity, min: 40, max: 80, step: 1, fmt: (v: number) => v + "%" },
          { label: isSv ? "نسبة إنجاز المهام %" : "نسبة إنجاز المهام %", value: taskRate, set: setTaskRate, min: 0, max: 100, step: 5, fmt: (v: number) => v + "%" },
          { label: isSv ? "عدد البيض" : "عدد البيض", value: eggsSet, set: setEggsSet, min: 10, max: 500, step: 10, fmt: (v: number) => v + " بيضة" },
        ].map(({ label, value, set, min, max, step, fmt }) => (
          <div key={label} className="text-right">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-bold text-foreground">{fmt(value)}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <input
              type="range" min={min} max={max} step={step} value={value}
              onChange={e => set(Number(e.target.value))}
              className="w-full h-2 rounded-full accent-violet-500 cursor-pointer"
            />
          </div>
        ))}
        <Button onClick={runSim} disabled={loading} className="w-full gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
          {isSv ? "تشغيل المحاكاة" : "تشغيل المحاكاة"}
        </Button>
      </div>

      {result && (
        <div className="space-y-5">
          {/* Key stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: isSv ? "متوقع (P50)" : "متوقع (P50)", value: `${result.p50}%`, color: "blue" },
              { label: isSv ? "متفائل (P90)" : "متفائل (P90)", value: `${result.p90}%`, color: "emerald" },
              { label: isSv ? "متشائم (P10)" : "متشائم (P10)", value: `${result.p10}%`, color: "red" },
              { label: isSv ? "خطر الفشل" : "خطر الفشل", value: `${result.failureProbability}%`, color: result.failureProbability > 30 ? "red" : result.failureProbability > 15 ? "amber" : "emerald" },
              { label: isSv ? "بيض متوقع فقسه" : "بيض متوقع فقسه", value: `${result.expectedHatched}`, color: "violet" },
              { label: isSv ? "ثقة النموذج" : "ثقة النموذج", value: `${result.confidenceScore}%`, color: "teal" },
            ].map(({ label, value, color }) => (
              <div key={label} className={cn("rounded-2xl border p-3 text-right", `border-${color}-200/60 bg-${color}-50/30 dark:bg-${color}-950/20`)}>
                <div className={cn("text-xl font-black", `text-${color}-600 dark:text-${color}-400`)}>{value}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Distribution chart */}
          <div>
            <SectionHeader icon={<BarChart3 className="w-3.5 h-3.5" />} label={isSv ? "توزيع النتائج" : "توزيع النتائج"} color="violet" />
            <div className="rounded-2xl border border-violet-200/60 bg-violet-50/20 p-4">
              <div className="flex items-end gap-1 h-28">
                {result.distribution.map((d, i) => {
                  const heightPct = maxDistPct > 0 ? (d.pct / maxDistPct) * 100 : 0;
                  const isGood = parseInt(d.bucket) >= 75;
                  const isMid = parseInt(d.bucket) >= 50;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      {d.pct > 0 && <span className="text-[8px] text-muted-foreground">{d.pct}%</span>}
                      <div className="w-full rounded-t overflow-hidden" style={{ height: `${heightPct}%`, minHeight: d.pct > 0 ? 4 : 0 }}>
                        <div className={cn("w-full h-full", isGood ? "bg-emerald-500" : isMid ? "bg-amber-500" : "bg-red-400")} />
                      </div>
                      <span className="text-[7px] text-muted-foreground rotate-45 mt-1">{d.bucket.split("-")[0]}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
                <span>🟢 جيد ≥75%</span><span>🟡 مقبول ≥50%</span><span>🔴 ضعيف &lt;50%</span>
              </div>
            </div>
          </div>

          {/* Scenarios */}
          <div>
            <SectionHeader icon={<Layers className="w-3.5 h-3.5" />} label={isSv ? "🔮 السيناريوهات" : "🔮 السيناريوهات"} color="indigo" />
            <ScenarioBar scenarios={result.scenarios} />
          </div>

          {/* Sensitivity */}
          <div>
            <SectionHeader icon={<Activity className="w-3.5 h-3.5" />} label={isSv ? "حساسية العوامل" : "حساسية العوامل"} color="teal" />
            <div className="space-y-2">
              {result.sensitivity.map((s, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-right">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    {s.direction === "positive" ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                    <span className="font-bold">{s.impact.toFixed(1)}%</span>
                  </div>
                  <span className="flex-1">{s.factor}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendation */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 text-right text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4 inline-block ml-1" />
            {result.recommendation}
          </div>

          {/* Evidence */}
          <div>
            <SectionHeader icon={<Info className="w-3.5 h-3.5" />} label={isSv ? "🧾 Evidens" : "🧾 الأدلة"} color="slate" />
            <EvidenceTable evidence={result.evidence} isSv={isSv} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// DECISION ENGINE VIEW
// ─────────────────────────────────────────────

function DecisionView({ result, isSv }: { result: DecisionResult; isSv: boolean }) {
  const rc = RISK_COLOR[result.overallRisk];
  return (
    <div className="space-y-5">
      {/* Overall header */}
      <div className={cn("rounded-2xl border p-4 text-right", rc.bg, rc.border)}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-col items-end gap-1">
            <div className={cn("text-4xl font-black", rc.text)}>{result.overallScore}</div>
            <div className="text-xs text-muted-foreground">/100 {isSv ? "مجمّع" : "مجمّع"}</div>
            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", rc.badge)}>{riskLabel(result.overallRisk, isSv)}</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold leading-6 text-right">{result.summaryStatement}</p>
            <p className="text-[10px] text-muted-foreground mt-1 text-right">{result.analysisType}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <ConfidenceBadge score={result.confidenceScore} />
          <span>{new Date(result.timestamp).toLocaleString("ar-SA")}</span>
        </div>
      </div>

      {/* Top 3 Actions */}
      <div>
        <SectionHeader icon={<Zap className="w-3.5 h-3.5" />} label={isSv ? "✅ أولى 3 خطوات الآن" : "✅ أولى 3 خطوات الآن"} color="emerald" />
        <ActionPlanList steps={result.topThreeActions} isSv={isSv} />
      </div>

      {/* Simulation quick stats */}
      <div>
        <SectionHeader icon={<Shuffle className="w-3.5 h-3.5" />} label={isSv ? "🔄 نتيجة المحاكاة" : "🔄 نتيجة المحاكاة"} color="violet" />
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "P50", value: `${result.simulation.p50}%`, color: "blue" },
            { label: "P90", value: `${result.simulation.p90}%`, color: "emerald" },
            { label: isSv ? "خطر الفشل" : "خطر الفشل", value: `${result.simulation.failureProbability}%`, color: result.simulation.failureProbability > 30 ? "red" : "amber" },
          ].map(({ label, value, color }) => (
            <div key={label} className={cn("rounded-xl border p-2.5 text-center", `border-${color}-200/60 bg-${color}-50/30 dark:bg-${color}-950/20`)}>
              <div className={cn("text-lg font-black", `text-${color}-600 dark:text-${color}-400`)}>{value}</div>
              <div className="text-[10px] text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Predictive summary */}
      <div>
        <SectionHeader icon={<TrendingUp className="w-3.5 h-3.5" />} label={isSv ? "🔮 الملخص التنبؤي" : "🔮 الملخص التنبؤي"} color="indigo" />
        <div className="rounded-2xl border border-indigo-200/60 bg-indigo-50/30 dark:bg-indigo-950/20 p-4 space-y-2 text-right">
          <p className="font-semibold text-sm">{result.predictive.prediction.outcome}</p>
          <div className="text-xs text-muted-foreground">{result.predictive.prediction.timeHorizon}</div>
          <ScenarioBar scenarios={result.predictive.prediction.scenarios.slice(0, 2)} />
        </div>
      </div>

      {/* Causal summary */}
      <div>
        <SectionHeader icon={<GitFork className="w-3.5 h-3.5" />} label={isSv ? "🧠 السبب الجذري" : "🧠 السبب الجذري"} color="violet" />
        <div className="rounded-2xl border border-violet-200/60 bg-violet-50/30 dark:bg-violet-950/20 p-4 text-right space-y-2">
          <p className="font-bold text-sm">{result.causal.rootCause.primary}</p>
          <p className="text-xs text-muted-foreground">{result.causal.rootCause.mechanism}</p>
          <div className="space-y-1">
            {result.causal.rootCause.contributingFactors.slice(0, 3).map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <div className="w-16 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                  <div className="h-full bg-violet-500" style={{ width: `${f.weight}%` }} />
                </div>
                <span className="text-violet-600 font-bold">{f.weight}%</span>
                <span>{f.factor}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────

const MODULES = [
  {
    id: "predict" as Module,
    icon: <TrendingUp className="w-6 h-6 text-white" />,
    gradient: "from-indigo-500 to-violet-600",
    border: "border-indigo-200/60 dark:border-indigo-800/40",
    bg: "from-indigo-50/60 to-violet-50/30 dark:from-indigo-950/20 dark:to-violet-950/10",
    hover: "hover:border-indigo-400/80 hover:shadow-indigo-500/10",
    tags: ["التنبؤ 48-72 ساعة", "XGBoost/LSTM", "احتمال الفشل", "R² تحليل"],
    tagColor: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300",
  },
  {
    id: "causal" as Module,
    icon: <GitFork className="w-6 h-6 text-white" />,
    gradient: "from-violet-500 to-purple-600",
    border: "border-violet-200/60 dark:border-violet-800/40",
    bg: "from-violet-50/60 to-purple-50/30 dark:from-violet-950/20 dark:to-purple-950/10",
    hover: "hover:border-violet-400/80 hover:shadow-violet-500/10",
    tags: ["DoWhy/CausalML", "رسم سببي DAG", "تحديد المسبب", "أثر قياسي"],
    tagColor: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300",
  },
  {
    id: "simulate" as Module,
    icon: <Shuffle className="w-6 h-6 text-white" />,
    gradient: "from-teal-500 to-emerald-600",
    border: "border-teal-200/60 dark:border-teal-800/40",
    bg: "from-teal-50/60 to-emerald-50/30 dark:from-teal-950/20 dark:to-emerald-950/10",
    hover: "hover:border-teal-400/80 hover:shadow-teal-500/10",
    tags: ["مونت كارلو 2000 تكرار", "P10/P50/P90", "حساسية العوامل", "توزيع احتمالي"],
    tagColor: "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300",
  },
  {
    id: "decision" as Module,
    icon: <Layers className="w-6 h-6 text-white" />,
    gradient: "from-amber-500 to-orange-600",
    border: "border-amber-200/60 dark:border-amber-800/40",
    bg: "from-amber-50/60 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10",
    hover: "hover:border-amber-400/80 hover:shadow-amber-500/10",
    tags: ["يدمج كل المحاور", "توصية واحدة", "أولويات فورية", "ثقة مجمّعة"],
    tagColor: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  },
];

const MODULE_LABELS: Record<NonNullable<Module>, [string, string]> = {
  predict: ["التحليل التنبؤي", "Prediktiv analys"],
  causal: ["التحليل السببي", "Kausal analys"],
  simulate: ["محاكاة السيناريوهات", "Scenariosimulering"],
  decision: ["محرك القرار المتكامل", "Integrerad beslutsmekanism"],
};

export default function AdvancedAnalysis() {
  const { isAdmin } = useAuth();
  const { lang } = useLanguage();
  const { toast } = useToast();
  const isSv = lang === "sv";

  const [module, setModule] = useState<Module>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdvancedOutput | DecisionResult | null>(null);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <ShieldAlert className="w-16 h-16 text-muted-foreground/40" />
        <h2 className="text-xl font-bold">{isSv ? "للمديرين فقط" : "للمديرين فقط"}</h2>
      </div>
    );
  }

  const runModule = async (mod: NonNullable<Module>) => {
    setModule(mod);
    setResult(null);
    setLoading(true);
    const endpointMap: Record<NonNullable<Module>, string> = {
      predict: "/api/ai/predict",
      causal: "/api/ai/causal",
      simulate: "",
      decision: "/api/ai/decision",
    };
    if (mod === "simulate") { setLoading(false); return; }
    try {
      const res = await fetch(endpointMap[mod], {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "خطأ");
      const data = await res.json();
      setResult(mod === "decision" ? data.result : data.result);
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
      setModule(null);
    } finally { setLoading(false); }
  };

  const reset = () => { setModule(null); setResult(null); };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-5rem)]">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">
              {isSv ? "نظام الذكاء الاصطناعي المتقدم" : "نظام الذكاء الاصطناعي المتقدم"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isSv ? "Prediktiv · Kausal · Monte Carlo · Beslutsmekanism" : "تنبؤي · سببي · مونت كارلو · محرك قرار"}
            </p>
          </div>
        </div>
        {(module || result) && !loading && (
          <Button onClick={reset} variant="ghost" size="sm" className="gap-1.5 text-xs h-8 text-muted-foreground">
            <ChevronRight className="w-3.5 h-3.5" />{isSv ? "Tillbaka" : "رجوع"}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-4">

        {/* MODULE SELECTOR */}
        {!module && !loading && (
          <div className="space-y-6">
            <div className="text-center space-y-2 py-4">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-indigo-500/15 via-violet-500/15 to-purple-500/15 border border-violet-200/40 flex items-center justify-center">
                <Brain className="w-10 h-10 text-violet-500" />
              </div>
              <h2 className="text-lg font-bold">{isSv ? "اختر نوع التحليل" : "اختر نوع التحليل"}</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {isSv ? "كل محرك يحلل مزرعتك من زاوية مختلفة — مبني على بياناتك الفعلية" : "كل محرك يحلل مزرعتك من زاوية مختلفة — مبني على بياناتك الفعلية"}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {MODULES.map((m) => {
                const [arLabel, svLabel] = MODULE_LABELS[m.id!];
                const descriptions: Record<NonNullable<Module>, [string, string]> = {
                  predict: [
                    "يتنبأ بالمشاكل قبل 48-72 ساعة — احتمالات مبنية على انحدار خطي + EWMA",
                    "Förutsäger problem 48-72 timmar i förväg — sannolikheter baserade på linjär regression + EWMA",
                  ],
                  causal: [
                    "يحدد السبب الحقيقي وليس مجرد ارتباط — رسم سببي مع قياس أثر كل عامل",
                    "Identifierar den verkliga orsaken, inte bara korrelation — kausalt diagram med effektmätning",
                  ],
                  simulate: [
                    "جرّب سيناريوهات مختلفة بمتغيرات حرارة/رطوبة/مهام — 2000 تكرار مونت كارلو",
                    "Prova olika scenarier med temp/fukt/uppgifter — 2000 Monte Carlo-iterationer",
                  ],
                  decision: [
                    "يدمج التنبؤ + السببية + المحاكاة → قرار واحد واضح مع أولويات فورية",
                    "Kombinerar Prediction + Kausalitet + Simulering → ett tydligt beslut med omedelbara prioriteringar",
                  ],
                };
                return (
                  <button
                    key={m.id}
                    onClick={() => runModule(m.id!)}
                    className={cn(
                      "group text-right rounded-2xl border-2 p-5 transition-all duration-200 hover:shadow-lg",
                      `bg-gradient-to-br ${m.bg}`, m.border, m.hover
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("w-11 h-11 rounded-2xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-105 transition-transform", m.gradient)}>
                        {m.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{isSv ? svLabel : arLabel}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-5">
                          {isSv ? descriptions[m.id!][1] : descriptions[m.id!][0]}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {m.tags.map(tag => (
                        <span key={tag} className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", m.tagColor)}>{tag}</span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* LOADING */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-5">
            <div className="w-24 h-24 rounded-3xl bg-violet-500/15 flex items-center justify-center animate-pulse">
              <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
            </div>
            <p className="font-bold text-lg">{isSv ? "تحليل متقدم جارٍ..." : "تحليل متقدم جارٍ..."}</p>
            <p className="text-sm text-violet-500 animate-pulse">{isSv ? "يقرأ بيانات المزرعة ويحسب النتائج..." : "يقرأ بيانات المزرعة ويحسب النتائج..."}</p>
          </div>
        )}

        {/* SIMULATION (interactive, no loading state) */}
        {module === "simulate" && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <ConfidenceBadge score={75} />
              <h2 className="font-bold text-right">{isSv ? "محاكاة مونت كارلو" : "محاكاة مونت كارلو"}</h2>
            </div>
            <SimulationView isSv={isSv} />
          </div>
        )}

        {/* PREDICTIVE / CAUSAL RESULT */}
        {result && module !== "decision" && module !== "simulate" && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button onClick={() => runModule(module!)} variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                <RefreshCw className="w-3.5 h-3.5" />{isSv ? "Uppdatera" : "تحديث"}
              </Button>
              <h2 className="font-bold text-right">{MODULE_LABELS[module!][isSv ? 1 : 0]}</h2>
            </div>
            <AdvancedOutputView result={result as AdvancedOutput} isSv={isSv} />
          </div>
        )}

        {/* DECISION ENGINE RESULT */}
        {result && module === "decision" && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button onClick={() => runModule("decision")} variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                <RefreshCw className="w-3.5 h-3.5" />{isSv ? "Uppdatera" : "تحديث"}
              </Button>
              <h2 className="font-bold text-right">{isSv ? "محرك القرار المتكامل" : "محرك القرار المتكامل"}</h2>
            </div>
            <DecisionView result={result as DecisionResult} isSv={isSv} />
          </div>
        )}

      </div>
    </div>
  );
}
