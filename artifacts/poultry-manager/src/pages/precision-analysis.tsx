/**
 * صفحة نظام الذكاء الزراعي — 7 نقاط / Jordbruksintelligens — 7 punkter
 * Context-aware, temporally intelligent, bilingual (AR/SV only).
 */
import { useState, useCallback, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiFetch, apiPost } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Brain, RefreshCw, Loader2, AlertTriangle, AlertCircle,
  Info, CheckCircle2, ShieldAlert, ShieldCheck, Shield,
  TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown,
  Zap, Target, Clock, Activity, BarChart3, ChevronDown, ChevronUp,
  MessageSquare, ThumbsUp, ThumbsDown, Calendar, Database,
  Lightbulb, Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types (mirrors backend) ──────────────────────────────────────────────────

interface ReportSection {
  titleAr: string; titleSv: string;
  contentAr: string; contentSv: string;
}

interface ChangeItem {
  metricAr: string; metricSv: string;
  current: string; previous: string;
  change: number | null;
  direction: "up" | "down" | "stable";
  significance: "critical" | "warning" | "normal";
}

interface RiskSection extends ReportSection {
  riskLevel: "critical" | "high" | "medium" | "low";
  riskScore: number;
  factors: string[];
}

interface ActionItem {
  rank: 1 | 2 | 3;
  immediacy: "now" | "today" | "this_week";
  actionAr: string; actionSv: string;
  whyAr: string; whySv: string;
}

interface IntelligenceReport {
  generatedAt: string;
  lang: string;
  overallRisk: "critical" | "warning" | "stable" | "good";
  confidenceScore: number;
  dataQuality: "excellent" | "good" | "limited" | "none";
  point1_currentState: ReportSection;
  point2_historicalComparison: ReportSection;
  point3_quantifiedChanges: ChangeItem[];
  point4_rootCause: ReportSection;
  point5_riskEvaluation: RiskSection;
  point6_immediateActions: ActionItem[];
  point7_consequences: ReportSection;
}

interface ContextAlert {
  flag: string;
  severity: "critical" | "warning" | "info";
  titleAr: string; titleSv: string;
  detailAr: string; detailSv: string;
  pctChange?: number;
}

interface FarmContext {
  generatedAt: string;
  windowDays: number;
  activeDays: number;
  alerts: ContextAlert[];
  today: { income: number; expense: number; profit: number; noteCount: number; tasksCompleted: number; tasksDue: number; taskCompletionRate: number } | null;
  avg7Day: { income: number; expense: number; profit: number; taskCompletionRate: number };
  farm: { totalChickens: number; totalFlocks: number; activeHatchingCycles: number; overallHatchRate: number };
  financial: { totalIncome: number; totalExpense: number; profit: number; margin: number | null };
  snapshots: any[];
}

interface IntelligenceResponse {
  context: FarmContext;
  report: IntelligenceReport;
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function SectionCard({
  icon, titleAr, titleSv, children, defaultOpen = true, accent, lang,
}: {
  icon: React.ReactNode;
  titleAr: string; titleSv: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accent?: string;
  lang: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const title = lang === "ar" ? titleAr : titleSv;
  return (
    <div className={cn("rounded-2xl border border-border/60 overflow-hidden shadow-sm", accent)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-card hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="font-bold text-sm text-foreground">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5 pt-1 bg-card">{children}</div>}
    </div>
  );
}

function ContentText({ section, lang }: { section: ReportSection; lang: string }) {
  const text = lang === "ar" ? section.contentAr : section.contentSv;
  return (
    <div className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line font-mono-off">
      {text.split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        return <p key={i} className="mb-1">{line}</p>;
      })}
    </div>
  );
}

function AlertBanner({ alert, lang }: { alert: ContextAlert; lang: string }) {
  const cfg = {
    critical: { bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800", icon: <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />, badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", label: lang === "ar" ? "حرج" : "Kritisk" },
    warning:  { bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800", icon: <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />, badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", label: lang === "ar" ? "تحذير" : "Varning" },
    info:     { bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800", icon: <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />, badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", label: lang === "ar" ? "معلومة" : "Info" },
  };
  const c = cfg[alert.severity];
  return (
    <div className={cn("rounded-xl border px-4 py-3 flex items-start gap-3", c.bg)}>
      {c.icon}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-sm text-foreground">{lang === "ar" ? alert.titleAr : alert.titleSv}</span>
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", c.badge)}>{c.label}</span>
          {alert.pctChange !== undefined && (
            <span className="text-[10px] font-mono text-muted-foreground">{alert.pctChange > 0 ? "+" : ""}{alert.pctChange}%</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{lang === "ar" ? alert.detailAr : alert.detailSv}</p>
      </div>
    </div>
  );
}

function ChangeRow({ item, lang }: { item: ChangeItem; lang: string }) {
  const metric = lang === "ar" ? item.metricAr : item.metricSv;
  const dirIcon = item.direction === "up"
    ? <ArrowUp className="w-3.5 h-3.5 text-emerald-500" />
    : item.direction === "down"
    ? <ArrowDown className="w-3.5 h-3.5 text-red-500" />
    : <Minus className="w-3.5 h-3.5 text-amber-500" />;

  const sigColor = item.significance === "critical" ? "text-red-600 bg-red-50 dark:bg-red-950/20"
    : item.significance === "warning" ? "text-amber-600 bg-amber-50 dark:bg-amber-950/20"
    : "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20";

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0 gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{metric}</p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
          <span>{lang === "ar" ? "الآن:" : "Nu:"} <span className="text-foreground font-semibold">{item.current}</span></span>
          <span>|</span>
          <span>{lang === "ar" ? "قبل:" : "Före:"} <span className="text-foreground/70">{item.previous}</span></span>
        </div>
      </div>
      <div className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0", sigColor)}>
        {dirIcon}
        {item.change !== null ? `${item.change > 0 ? "+" : ""}${item.change}%` : "—"}
      </div>
    </div>
  );
}

function ActionCard({ action, lang }: { action: ActionItem; lang: string }) {
  const rankColors = ["bg-red-500", "bg-amber-500", "bg-blue-500"] as const;
  const immediacyLabel = {
    ar: { now: "الآن فوراً", today: "اليوم", this_week: "هذا الأسبوع" },
    sv: { now: "Omedelbart nu", today: "Idag", this_week: "Denna vecka" },
  };
  const immediacyColor = { now: "text-red-600 bg-red-100 dark:bg-red-900/30", today: "text-amber-600 bg-amber-100 dark:bg-amber-900/30", this_week: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" };

  return (
    <div className="rounded-xl border border-border/60 bg-background p-4 flex gap-3 hover:shadow-sm transition-shadow">
      <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0", rankColors[action.rank - 1])}>
        {action.rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap mb-1.5">
          <span className="font-bold text-sm text-foreground">{lang === "ar" ? action.actionAr : action.actionSv}</span>
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0", immediacyColor[action.immediacy])}>
            {immediacyLabel[lang === "ar" ? "ar" : "sv"][action.immediacy]}
          </span>
        </div>
        <div className="flex items-start gap-1.5">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">{lang === "ar" ? action.whyAr : action.whySv}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PrecisionAnalysis() {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [data, setData] = useState<IntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<"accepted" | "rejected" | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [showFeedbackForm, setShowFeedbackForm] = useState<"accepted" | "rejected" | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchIntelligence = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setData(null);
    setFeedbackSent(null);
    setFeedbackComment("");
    setShowFeedbackForm(null);

    try {
      const json = await apiFetch<{ report: IntelligenceReport; context: FarmContext }>(
        `/api/ai/intelligence?lang=${lang}&window=7`,
        { signal: abortRef.current.signal }
      );
      setData(json);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast({ title: lang === "ar" ? "خطأ" : "Fel", description: err.message ?? "unknown", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  }, [lang, toast]);

  const sendFeedback = useCallback(async (accepted: boolean) => {
    setFeedbackLoading(true);
    try {
      await apiPost("/api/ai/intelligence/feedback", {
        accepted, comment: feedbackComment, reportDate: data?.report.generatedAt,
      });
      setFeedbackSent(accepted ? "accepted" : "rejected");
      setShowFeedbackForm(null);
      toast({
        title: lang === "ar" ? (accepted ? "شكراً — تم قبول التقرير" : "تم تسجيل الملاحظة") : (accepted ? "Tack — Rapport godkänd" : "Feedback registrerad"),
        description: lang === "ar" ? "رأيك يحسّن التقارير القادمة" : "Din feedback förbättrar framtida rapporter",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setFeedbackLoading(false);
    }
  }, [data, feedbackComment, lang, toast]);

  const { report, context } = data ?? {};
  const isRtl = lang === "ar";

  const riskConfig = {
    critical: { color: "#ef4444", label: lang === "ar" ? "حرج" : "Kritisk", bg: "bg-red-50 dark:bg-red-950/20 border-red-200", icon: <ShieldAlert className="w-5 h-5 text-red-500" /> },
    warning:  { color: "#f59e0b", label: lang === "ar" ? "تحذير" : "Varning",  bg: "bg-amber-50 dark:bg-amber-950/20 border-amber-200", icon: <AlertCircle className="w-5 h-5 text-amber-500" /> },
    stable:   { color: "#6366f1", label: lang === "ar" ? "مستقر" : "Stabil",   bg: "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200", icon: <Shield className="w-5 h-5 text-indigo-500" /> },
    good:     { color: "#10b981", label: lang === "ar" ? "جيد" : "Bra",        bg: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200", icon: <ShieldCheck className="w-5 h-5 text-emerald-500" /> },
  };
  const riskCfg = report ? riskConfig[report.overallRisk] : riskConfig.stable;

  const dataQualityConfig = {
    excellent: { label: lang === "ar" ? "ممتاز" : "Utmärkt", color: "text-emerald-600" },
    good:      { label: lang === "ar" ? "جيد" : "Bra", color: "text-blue-600" },
    limited:   { label: lang === "ar" ? "محدود" : "Begränsad", color: "text-amber-600" },
    none:      { label: lang === "ar" ? "لا يوجد" : "Ingen", color: "text-red-600" },
  };

  // ── Idle state ──────────────────────────────────────────────────────────────
  if (!data && !loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 px-4">
        {/* Header */}
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Brain className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {lang === "ar" ? "نظام الذكاء الزراعي" : "Jordbruksintelligens"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {lang === "ar"
              ? "تحليل سياقي متكامل — يقرأ بيانات 7 أيام، يقارن الأنماط الزمنية، يكتشف التغيرات، ويقدم 7 نقاط تحليلية دقيقة."
              : "Fullständig kontextuell analys — läser 7 dagars data, jämför tidsmönster, upptäcker förändringar och presenterar 7 exakta analyspunkter."}
          </p>
        </div>

        {/* Protocol points */}
        <div className="w-full max-w-md grid grid-cols-2 gap-2">
          {[
            { n: "1", ar: "الحالة الراهنة", sv: "Aktuell status" },
            { n: "2", ar: "مقارنة تاريخية", sv: "Historisk jämförelse" },
            { n: "3", ar: "تغييرات مقيّسة %", sv: "Kvantifierade % ändringar" },
            { n: "4", ar: "تحليل الأسباب", sv: "Grundorsaksanalys" },
            { n: "5", ar: "تقييم المخاطر", sv: "Riskbedömning" },
            { n: "6", ar: "إجراءات فورية", sv: "Omedelbara åtgärder" },
            { n: "7", ar: "عواقب التقاعس", sv: "Konsekvenser av passivitet" },
            { n: "⚡", ar: "تغذية راجعة", sv: "Återkoppling" },
          ].map(p => (
            <div key={p.n} className="flex items-center gap-2 bg-muted/30 rounded-xl px-3 py-2">
              <span className="text-xs font-bold text-primary w-4 text-center">{p.n}</span>
              <span className="text-xs text-foreground/80">{lang === "ar" ? p.ar : p.sv}</span>
            </div>
          ))}
        </div>

        <button
          onClick={fetchIntelligence}
          className="flex items-center gap-3 bg-primary text-primary-foreground px-8 py-3.5 rounded-2xl font-bold text-base hover:bg-primary/90 active:scale-95 transition-all shadow-lg"
        >
          <Brain className="w-5 h-5" />
          {lang === "ar" ? "ابدأ التحليل الذكي" : "Starta intelligent analys"}
        </button>

        <p className="text-xs text-muted-foreground">
          {lang === "ar" ? "⏱ يستغرق 2-4 ثوانٍ — يحلل 7 أيام من البيانات" : "⏱ Tar 2-4 sekunder — analyserar 7 dagars data"}
        </p>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <Brain className="absolute inset-0 m-auto w-8 h-8 text-primary" />
        </div>
        <p className="text-base font-semibold text-foreground">
          {lang === "ar" ? "يحلل بيانات المزرعة..." : "Analyserar gårdsdata..."}
        </p>
        <div className="text-center text-sm text-muted-foreground space-y-1">
          {(lang === "ar"
            ? ["✓ قراءة بيانات 7 أيام", "✓ حساب المقارنات الزمنية", "✓ كشف التغيرات", "✓ بناء التقرير"]
            : ["✓ Läser 7 dagars data", "✓ Beräknar tidsjämförelser", "✓ Detekterar förändringar", "✓ Bygger rapport"]
          ).map((step, i) => (
            <p key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.4}s` }}>{step}</p>
          ))}
        </div>
      </div>
    );
  }

  // ── Report View ─────────────────────────────────────────────────────────────
  if (!report || !context) return null;

  const criticalAlerts = context.alerts.filter(a => a.severity === "critical");
  const warningAlerts  = context.alerts.filter(a => a.severity === "warning");
  const dq = dataQualityConfig[report.dataQuality];

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className={cn("flex items-start justify-between gap-3 flex-wrap", isRtl ? "flex-row-reverse" : "")}>
        <div className={isRtl ? "text-right" : ""}>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            {lang === "ar" ? "تقرير الذكاء الزراعي" : "Jordbruksintelligensrapport"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(report.generatedAt).toLocaleString(lang === "ar" ? "ar-IQ" : "sv-SE")}
          </p>
        </div>
        <button
          onClick={fetchIntelligence}
          className="flex items-center gap-2 text-sm bg-primary/10 text-primary hover:bg-primary/20 px-4 py-2 rounded-xl font-semibold transition-colors flex-shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
          {lang === "ar" ? "تحديث" : "Uppdatera"}
        </button>
      </div>

      {/* ── Overall Risk Badge + Context Stats ─────────────────────────────── */}
      <div className={cn("rounded-2xl border p-4 grid grid-cols-2 md:grid-cols-4 gap-4", riskCfg.bg)}>
        <div className="col-span-2 md:col-span-1 flex items-center gap-3">
          {riskCfg.icon}
          <div>
            <p className="text-xs text-muted-foreground">{lang === "ar" ? "مستوى الخطر" : "Risknivå"}</p>
            <p className="font-bold text-base" style={{ color: riskCfg.color }}>{riskCfg.label}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{lang === "ar" ? "ثقة التحليل" : "Analyskonfidensen"}</p>
          <p className="font-bold text-base text-foreground">{report.confidenceScore}%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{lang === "ar" ? "جودة البيانات" : "Datakvalitet"}</p>
          <p className={cn("font-bold text-base", dq.color)}>{dq.label}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{lang === "ar" ? "النافذة الزمنية" : "Tidsfönster"}</p>
          <p className="font-bold text-base text-foreground">
            {context.activeDays}/{context.windowDays} {lang === "ar" ? "يوم" : "dagar"}
          </p>
        </div>
      </div>

      {/* ── Active Alerts ────────────────────────────────────────────────────── */}
      {context.alerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            {lang === "ar" ? `تنبيهات نشطة (${context.alerts.length})` : `Aktiva varningar (${context.alerts.length})`}
          </p>
          {context.alerts.map((a, i) => (
            <AlertBanner key={i} alert={a} lang={lang} />
          ))}
        </div>
      )}

      {/* ── POINT 1: Current State ───────────────────────────────────────────── */}
      <SectionCard
        lang={lang}
        icon={<Activity className="w-5 h-5 text-blue-500" />}
        titleAr="1. حالة المزرعة الراهنة"
        titleSv="1. Aktuell gårdsstatus"
        defaultOpen={true}
      >
        <ContentText section={report.point1_currentState} lang={lang} />
      </SectionCard>

      {/* ── POINT 2: Historical Comparison ──────────────────────────────────── */}
      <SectionCard
        lang={lang}
        icon={<BarChart3 className="w-5 h-5 text-indigo-500" />}
        titleAr="2. مقارنة مع الأيام السابقة"
        titleSv="2. Jämförelse med tidigare dagar"
        defaultOpen={true}
      >
        <ContentText section={report.point2_historicalComparison} lang={lang} />
      </SectionCard>

      {/* ── POINT 3: Quantified Changes ─────────────────────────────────────── */}
      <SectionCard
        lang={lang}
        icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
        titleAr="3. التغيرات الكمية (%)"
        titleSv="3. Kvantifierade förändringar (%)"
        defaultOpen={true}
      >
        {report.point3_quantifiedChanges.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            {lang === "ar" ? "لا توجد بيانات كافية للمقارنة الزمنية" : "Inte tillräckliga uppgifter för tidsjämförelse"}
          </p>
        ) : (
          <div className="divide-y divide-border/40">
            {report.point3_quantifiedChanges.map((item, i) => (
              <ChangeRow key={i} item={item} lang={lang} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── POINT 4: Root Cause ─────────────────────────────────────────────── */}
      <SectionCard
        lang={lang}
        icon={<Lightbulb className="w-5 h-5 text-amber-500" />}
        titleAr="4. تحليل الأسباب الجذرية"
        titleSv="4. Grundorsaksanalys"
        defaultOpen={true}
      >
        <ContentText section={report.point4_rootCause} lang={lang} />
      </SectionCard>

      {/* ── POINT 5: Risk Evaluation ─────────────────────────────────────────── */}
      <SectionCard
        lang={lang}
        icon={<Shield className="w-5 h-5" style={{ color: riskCfg.color }} />}
        titleAr="5. تقييم المخاطر"
        titleSv="5. Riskbedömning"
        defaultOpen={true}
        accent={
          report.point5_riskEvaluation.riskLevel === "critical" ? "border-l-4 border-l-red-500" :
          report.point5_riskEvaluation.riskLevel === "high"     ? "border-l-4 border-l-orange-500" :
          report.point5_riskEvaluation.riskLevel === "medium"   ? "border-l-4 border-l-amber-500" :
          "border-l-4 border-l-emerald-500"
        }
      >
        {/* Risk gauge bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">{lang === "ar" ? "نقاط الخطر" : "Riskpoäng"}</span>
            <span className="font-bold text-sm" style={{ color: riskCfg.color }}>{report.point5_riskEvaluation.riskScore}/100</span>
          </div>
          <div className="h-2.5 bg-muted/30 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${report.point5_riskEvaluation.riskScore}%`, background: riskCfg.color }}
            />
          </div>
        </div>
        <ContentText section={report.point5_riskEvaluation} lang={lang} />
      </SectionCard>

      {/* ── POINT 6: Immediate Actions ───────────────────────────────────────── */}
      <SectionCard
        lang={lang}
        icon={<Zap className="w-5 h-5 text-amber-500" />}
        titleAr="6. إجراءات فورية — مرتّبة بالأولوية"
        titleSv="6. Omedelbara åtgärder — prioriterade"
        defaultOpen={true}
      >
        <div className="space-y-3">
          {report.point6_immediateActions.map((action, i) => (
            <ActionCard key={i} action={action} lang={lang} />
          ))}
        </div>
      </SectionCard>

      {/* ── POINT 7: Consequences ────────────────────────────────────────────── */}
      <SectionCard
        lang={lang}
        icon={<Clock className="w-5 h-5 text-red-500" />}
        titleAr="7. عواقب عدم التصرف"
        titleSv="7. Konsekvenser av utebliven åtgärd"
        defaultOpen={true}
        accent={
          report.overallRisk === "critical" ? "border-l-4 border-l-red-500" :
          report.overallRisk === "warning"  ? "border-l-4 border-l-amber-500" : ""
        }
      >
        <ContentText section={report.point7_consequences} lang={lang} />
      </SectionCard>

      {/* ── Feedback Loop ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-5 h-5 text-muted-foreground" />
          <p className="font-semibold text-sm text-foreground">
            {lang === "ar" ? "هل هذا التقرير دقيق؟" : "Är rapporten korrekt?"}
          </p>
          <span className="text-xs text-muted-foreground">
            {lang === "ar" ? "(تغذيتك الراجعة تُحسّن التقارير القادمة)" : "(Din feedback förbättrar framtida rapporter)"}
          </span>
        </div>

        {feedbackSent ? (
          <div className={cn("flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold",
            feedbackSent === "accepted" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30"
          )}>
            {feedbackSent === "accepted" ? <ThumbsUp className="w-4 h-4" /> : <ThumbsDown className="w-4 h-4" />}
            {lang === "ar"
              ? (feedbackSent === "accepted" ? "✅ شكراً — تم قبول التقرير وحفظ رأيك" : "📝 تم تسجيل ملاحظتك — شكراً")
              : (feedbackSent === "accepted" ? "✅ Tack — Rapporten godkänd och sparad" : "📝 Din feedback registrerad — Tack")}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-3">
              <button
                onClick={() => setShowFeedbackForm("accepted")}
                className={cn("flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all",
                  showFeedbackForm === "accepted"
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
                )}
              >
                <ThumbsUp className="w-4 h-4" />
                {lang === "ar" ? "دقيق ✓" : "Korrekt ✓"}
              </button>
              <button
                onClick={() => setShowFeedbackForm("rejected")}
                className={cn("flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all",
                  showFeedbackForm === "rejected"
                    ? "bg-red-600 text-white"
                    : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                )}
              >
                <ThumbsDown className="w-4 h-4" />
                {lang === "ar" ? "غير دقيق ✗" : "Felaktigt ✗"}
              </button>
            </div>

            {showFeedbackForm && (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                <textarea
                  value={feedbackComment}
                  onChange={e => setFeedbackComment(e.target.value)}
                  placeholder={lang === "ar" ? "تعليق اختياري — ما الذي كان خاطئاً؟" : "Valfri kommentar — Vad var fel?"}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  dir={isRtl ? "rtl" : "ltr"}
                />
                <button
                  disabled={feedbackLoading}
                  onClick={() => sendFeedback(showFeedbackForm === "accepted")}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
                >
                  {feedbackLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {lang === "ar" ? "إرسال" : "Skicka"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground pb-4 space-y-1">
        <p>{lang === "ar" ? "نظام قائم على القواعد المحددة — لا يستخدم ذكاء اصطناعي خارجي" : "Regelbaserat system — använder inte extern AI"}</p>
        <p>{lang === "ar" ? `ثقة التحليل: ${report.confidenceScore}% | نافذة البيانات: ${context.windowDays} أيام` : `Analyskonfidensen: ${report.confidenceScore}% | Datafönster: ${context.windowDays} dagar`}</p>
      </div>
    </div>
  );
}
