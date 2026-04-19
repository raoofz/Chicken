/**
 * IntelligenceHub — Real-time cross-module intelligence alerts.
 * Each alert is clickable: shows a detail drawer with full analysis.
 * Hatching alerts navigate directly to the hatching page.
 */
import { useEffect, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, CheckCircle2, Info, ChevronRight, RefreshCw, Brain,
  XCircle, ChevronDown, ChevronUp, AlertCircle, ExternalLink,
  TrendingDown, TrendingUp, Minus, X, ArrowLeft, ArrowRight,
} from "lucide-react";

interface Alert {
  id: string;
  level: "critical" | "warning" | "info" | "good";
  module: string;
  titleAr: string;
  titleSv: string;
  bodyAr: string;
  bodySv: string;
  actionAr?: string;
  actionSv?: string;
  metric?: { value: number; unit: string; change?: number };
  href?: string;
}

interface Report {
  generatedAt: string;
  alerts: Alert[];
  summary: { critical: number; warning: number; info: number; good: number };
}

// ── Config ────────────────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  critical: {
    icon: XCircle,
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800/50",
    activeBg: "bg-red-100 dark:bg-red-900/40",
    iconColor: "text-red-500",
    titleColor: "text-red-700 dark:text-red-400",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
    drawerBg: "bg-red-50 dark:bg-red-950/20",
    drawerBorder: "border-red-200 dark:border-red-800/60",
    pulse: true,
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800/50",
    activeBg: "bg-amber-100 dark:bg-amber-900/40",
    iconColor: "text-amber-500",
    titleColor: "text-amber-700 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    drawerBg: "bg-amber-50 dark:bg-amber-950/20",
    drawerBorder: "border-amber-200 dark:border-amber-800/60",
    pulse: false,
  },
  info: {
    icon: Info,
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800/50",
    activeBg: "bg-blue-100 dark:bg-blue-900/40",
    iconColor: "text-blue-500",
    titleColor: "text-blue-700 dark:text-blue-400",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
    drawerBg: "bg-blue-50 dark:bg-blue-950/20",
    drawerBorder: "border-blue-200 dark:border-blue-800/60",
    pulse: false,
  },
  good: {
    icon: CheckCircle2,
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800/50",
    activeBg: "bg-emerald-100 dark:bg-emerald-900/40",
    iconColor: "text-emerald-500",
    titleColor: "text-emerald-700 dark:text-emerald-400",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
    drawerBg: "bg-emerald-50 dark:bg-emerald-950/20",
    drawerBorder: "border-emerald-200 dark:border-emerald-800/60",
    pulse: false,
  },
};

const MODULE_LABELS: Record<string, { ar: string; sv: string }> = {
  finance:     { ar: "مالي",       sv: "Finans"      },
  production:  { ar: "إنتاج",      sv: "Produktion"  },
  operations:  { ar: "تشغيل",      sv: "Drift"       },
  health:      { ar: "صحة",        sv: "Hälsa"       },
  feed:        { ar: "علف",        sv: "Foder"       },
  hatching:    { ar: "تفقيس",      sv: "Kläckning"   },
  correlation: { ar: "تحليل متقاطع", sv: "Korrelation" },
};

// Deep explanations for each module type
const MODULE_DETAIL: Record<string, { ar: string; sv: string }> = {
  finance: {
    ar: "يُحلّل محرك الذكاء بياناتك المالية الكاملة خلال آخر 30 يوماً. يشمل التحليل: الدخل الإجمالي، المصاريف حسب الفئة، هامش الربح الصافي، ونسبة تكاليف العلف. تُقارَن النتائج بمعايير الصناعة.",
    sv: "Intelligensmotorn analyserar dina fullständiga finansiella data för de senaste 30 dagarna. Analysen inkluderar: total inkomst, utgifter per kategori, nettovinstmarginal och foderkostnadsandel. Resultaten jämförs med branschstandarder.",
  },
  production: {
    ar: "يتتبع محرك الذكاء إنتاج البيض اليومي لكل قطيع، يكتشف الانخفاضات المفاجئة، ويقارن الأسابيع الأخيرة بالأسابيع السابقة للكشف عن أنماط الأداء.",
    sv: "Intelligensmotorn spårar daglig äggproduktion per flock, upptäcker plötsliga nedgångar och jämför de senaste veckorna med tidigare perioder för att identifiera prestandamönster.",
  },
  health: {
    ar: "يراقب محرك الذكاء حالة صحة القطعان والسجلات الصحية. يكتشف الأنماط السلبية المتكررة ويربطها بالتغيرات في الإنتاج للكشف المبكر عن الأمراض.",
    sv: "Intelligensmotorn övervakar flockars hälsostatus och hälsologgar. Identifierar återkommande negativa mönster och korrelerar dem med produktionsförändringar för tidig sjukdomsdetektering.",
  },
  operations: {
    ar: "يقيّم محرك الذكاء معدل إنجاز المهام اليومية والمتأخرة، ويحسب مؤشر الكفاءة التشغيلية للمزرعة بناءً على الأهداف والمهام المنجزة.",
    sv: "Intelligensmotorn utvärderar slutförandegrad för dagliga och försenade uppgifter, och beräknar gårdens operativa effektivitetsindex baserat på mål och slutförda uppgifter.",
  },
  feed: {
    ar: "يُحلّل محرك الذكاء نسبة تكلفة العلف من إجمالي المصاريف. المعدل المثالي هو 40-50%. أي نسبة تتجاوز 60% تُشير إلى مشكلة في إدارة التغذية أو أسعار المورّدين.",
    sv: "Intelligensmotorn analyserar foderkostnadens andel av totala utgifter. Optimalt intervall är 40-50%. Värden över 60% indikerar problem med foderhantering eller leverantörspriser.",
  },
  hatching: {
    ar: "يُحلّل محرك الذكاء معدلات التفقيس لآخر 3 دورات مكتملة ويحسب المتوسط. المعيار الصناعي المقبول هو 80% أو أكثر. أقل من 65% يعني مشكلة في الفقاسة.",
    sv: "Intelligensmotorn analyserar kläckningsgrad för de senaste 3 slutförda cyklerna och beräknar medelvärdet. Branschstandarden är 80% eller mer. Under 65% indikerar problem med ruvaren.",
  },
  correlation: {
    ar: "هذا تحليل متقاطع متقدم يربط بيانات من أكثر من وحدة في نفس الوقت. يكتشف محرك الذكاء الأنماط المخفية التي لا تظهر عند تحليل كل وحدة بمفردها.",
    sv: "Detta är avancerad korskorrelationsanalys som kopplar data från mer än en modul samtidigt. Intelligensmotorn identifierar dolda mönster som inte syns vid analys av varje modul separat.",
  },
};

// ── Data Hook ─────────────────────────────────────────────────────────────────
function useIntelligenceAlerts() {
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/intelligence/alerts");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData, lastRefresh]);

  useEffect(() => {
    const id = setInterval(() => setLastRefresh(Date.now()), 3 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return { data, loading, error, refresh: () => setLastRefresh(Date.now()) };
}

// ── Alert Detail Drawer ───────────────────────────────────────────────────────
interface DrawerProps {
  alert: Alert;
  ar: boolean;
  onClose: () => void;
}

function AlertDetailDrawer({ alert, ar, onClose }: DrawerProps) {
  const [, navigate] = useLocation();
  const cfg = LEVEL_CONFIG[alert.level];
  const Icon = cfg.icon;
  const modLabel = MODULE_LABELS[alert.module];
  const moduleDetail = MODULE_DETAIL[alert.module];

  const handleNavigate = () => {
    if (alert.href) {
      navigate(alert.href);
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Drawer from bottom */}
      <div className={cn(
        "fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl shadow-2xl",
        "max-h-[75vh] overflow-y-auto",
        "border-t",
        cfg.drawerBg, cfg.drawerBorder,
        "animate-slide-up-drawer"
      )}>
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-current opacity-20" />
        </div>

        <div className="px-4 pb-8 space-y-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className={cn("p-2 rounded-xl shrink-0 mt-0.5", cfg.activeBg)}>
              <Icon className={cn("w-5 h-5", cfg.iconColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={cn("text-base font-bold leading-tight", cfg.titleColor)}>
                  {ar ? alert.titleAr : alert.titleSv}
                </h3>
                {modLabel && (
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0", cfg.badge)}>
                    {ar ? modLabel.ar : modLabel.sv}
                  </span>
                )}
              </div>
              {alert.metric && (
                <div className={cn("text-lg font-bold tabular-nums mt-0.5", cfg.titleColor)}>
                  {alert.metric.value}{alert.metric.unit}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-black/10 transition-colors shrink-0"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Main body */}
          <div className="space-y-3">
            <div className="rounded-xl bg-background/60 border border-border/40 p-3">
              <p className="text-sm text-foreground leading-relaxed">
                {ar ? alert.bodyAr : alert.bodySv}
              </p>
            </div>

            {/* Module explanation */}
            {moduleDetail && (
              <div className="rounded-xl bg-background/40 border border-border/30 p-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  {ar ? "كيف يعمل التحليل؟" : "Hur fungerar analysen?"}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {ar ? moduleDetail.ar : moduleDetail.sv}
                </p>
              </div>
            )}

            {/* Level explanation */}
            <div className={cn("rounded-xl border p-3", cfg.bg, cfg.border)}>
              <p className="text-[11px] font-semibold mb-1.5 opacity-70">
                {ar ? "مستوى الأهمية" : "Prioritetsnivå"}
              </p>
              <p className={cn("text-xs font-bold", cfg.titleColor)}>
                {alert.level === "critical" && (ar ? "حرجي — يستوجب تدخلاً فورياً" : "Kritisk — kräver omedelbar åtgärd")}
                {alert.level === "warning"  && (ar ? "تحذير — راقب الوضع وتصرف قريباً" : "Varning — övervaka och agera snart")}
                {alert.level === "info"     && (ar ? "معلوماتي — للاطلاع والمتابعة" : "Informativt — för kännedom och uppföljning")}
                {alert.level === "good"     && (ar ? "جيد — استمر على هذا المستوى" : "Bra — fortsätt på den här nivån")}
              </p>
            </div>
          </div>

          {/* Action button */}
          {alert.href && (
            <button
              onClick={handleNavigate}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all",
                "bg-foreground text-background hover:opacity-90 active:scale-[0.98]"
              )}
            >
              <ExternalLink className="w-4 h-4" />
              {ar
                ? (alert.actionAr ?? "عرض التفاصيل")
                : (alert.actionSv ?? "Visa detaljer")
              }
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── Alert Card ────────────────────────────────────────────────────────────────
interface AlertCardProps {
  alert: Alert;
  ar: boolean;
  onClick: (alert: Alert) => void;
}

function AlertCard({ alert, ar, onClick }: AlertCardProps) {
  const cfg = LEVEL_CONFIG[alert.level];
  const Icon = cfg.icon;
  const modLabel = MODULE_LABELS[alert.module];

  // For hatching alerts, we navigate directly without drawer for non-admin aware context
  const isHatchingAlert = alert.module === "hatching" && alert.href === "/hatching";

  return (
    <button
      onClick={() => onClick(alert)}
      className={cn(
        "w-full text-start rounded-xl border p-3 flex gap-3 items-start",
        "transition-all duration-200 hover:shadow-md active:scale-[0.99]",
        "cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/50",
        cfg.bg, cfg.border,
      )}
    >
      {/* Icon */}
      <div className="shrink-0 mt-0.5">
        <Icon
          className={cn("w-[18px] h-[18px]", cfg.iconColor, cfg.pulse && "animate-pulse")}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5 text-start">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-sm font-semibold leading-tight", cfg.titleColor)}>
            {ar ? alert.titleAr : alert.titleSv}
          </span>
          {modLabel && (
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0", cfg.badge)}>
              {ar ? modLabel.ar : modLabel.sv}
            </span>
          )}
          {alert.metric && (
            <span className={cn("text-xs font-bold tabular-nums", cfg.titleColor)}>
              {alert.metric.value}{alert.metric.unit}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {ar ? alert.bodyAr : alert.bodySv}
        </p>
        {/* Tap hint */}
        <p className="text-[10px] text-muted-foreground/40 mt-0.5 flex items-center gap-1">
          {ar
            ? <><ChevronRight className="w-3 h-3 rotate-180" />اضغط لمزيد من التفاصيل</>
            : <>Tryck för detaljer<ChevronRight className="w-3 h-3" /></>
          }
        </p>
      </div>

      {/* Expand arrow */}
      <div className="shrink-0 self-center">
        <ChevronRight className={cn(
          "w-4 h-4 text-muted-foreground/40 transition-transform",
          ar ? "rotate-180" : ""
        )} />
      </div>
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
interface Props {
  className?: string;
}

export default function IntelligenceHub({ className }: Props) {
  const { lang } = useLanguage();
  const { isAdmin } = useAuth();
  const [, navigate] = useLocation();
  const ar = lang === "ar";
  const { data, loading, error, refresh } = useIntelligenceAlerts();
  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("intelligence-hub-collapsed");
      if (saved === "true") setCollapsed(true);
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      try { localStorage.setItem("intelligence-hub-collapsed", String(!prev)); } catch {}
      return !prev;
    });
  };

  const handleAlertClick = (alert: Alert) => {
    // Hatching active cycle alerts → navigate directly
    if (alert.module === "hatching" && alert.href === "/hatching") {
      navigate("/hatching");
      return;
    }
    // All other alerts → open detail drawer
    setSelectedAlert(alert);
  };

  const summary = data?.summary;
  const hasCritical = (summary?.critical ?? 0) > 0;
  const visibleAlerts = data?.alerts ?? [];
  const displayAlerts = showAll ? visibleAlerts : visibleAlerts.slice(0, 4);

  return (
    <>
      <div className={cn("rounded-2xl border bg-card shadow-sm overflow-hidden", className)}>
        {/* ── Header ── */}
        <div
          className={cn(
            "flex items-center gap-3 px-4 py-3 cursor-pointer select-none",
            "border-b border-border/60 transition-colors hover:bg-muted/30",
            hasCritical && "bg-red-50/50 dark:bg-red-950/20"
          )}
          onClick={toggleCollapsed}
        >
          <div className={cn("p-1.5 rounded-lg shrink-0", hasCritical ? "bg-red-100 dark:bg-red-900/40" : "bg-primary/10")}>
            <Brain className={cn("w-4 h-4", hasCritical ? "text-red-500 animate-pulse" : "text-primary")} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-foreground leading-none">
              {ar ? "أمور يجب الانتباه إليها بالمزرعة" : "Saker att uppmärksamma på gården"}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {ar ? "تحليل شامل · اضغط على أي تنبيه للتفاصيل" : "Fullständig analys · Tryck på en avisering för detaljer"}
            </p>
          </div>

          {/* Summary badges */}
          {summary && !loading && (
            <div className="flex items-center gap-1 shrink-0">
              {summary.critical > 0 && (
                <span className="text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 px-1.5 py-0.5 rounded-full animate-pulse">
                  {summary.critical}
                </span>
              )}
              {summary.warning > 0 && (
                <span className="text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 px-1.5 py-0.5 rounded-full">
                  {summary.warning}
                </span>
              )}
              {summary.info > 0 && (
                <span className="text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                  {summary.info}
                </span>
              )}
              {summary.good > 0 && (
                <span className="text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 px-1.5 py-0.5 rounded-full">
                  {summary.good}
                </span>
              )}
            </div>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); refresh(); }}
            className="p-1 rounded-md hover:bg-muted/60 transition-colors shrink-0"
            title={ar ? "تحديث" : "Uppdatera"}
          >
            <RefreshCw className={cn("w-3.5 h-3.5 text-muted-foreground", loading && "animate-spin")} />
          </button>

          {collapsed
            ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            : <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          }
        </div>

        {/* ── Body ── */}
        {!collapsed && (
          <div className="p-3 space-y-2">
            {loading && (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
                ))}
              </div>
            )}

            {error && !loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-3 px-3 rounded-lg bg-muted/30">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{ar ? "تعذّر تحميل التحليل" : "Kunde inte ladda analys"}</span>
                <button
                  onClick={refresh}
                  className="mr-auto text-xs text-primary hover:underline"
                >
                  {ar ? "أعد المحاولة" : "Försök igen"}
                </button>
              </div>
            )}

            {!loading && !error && visibleAlerts.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 py-3 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{ar ? "كل شيء يبدو ممتازاً!" : "Allt verkar utmärkt!"}</span>
              </div>
            )}

            {!loading && displayAlerts.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                ar={ar}
                onClick={handleAlertClick}
              />
            ))}

            {!loading && visibleAlerts.length > 4 && (
              <button
                onClick={() => setShowAll(p => !p)}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2 font-medium flex items-center justify-center gap-1"
              >
                {showAll
                  ? (ar ? "عرض أقل" : "Visa färre")
                  : (ar ? `عرض ${visibleAlerts.length - 4} تنبيه إضافي` : `Visa ${visibleAlerts.length - 4} fler`)
                }
                {showAll ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}

            {/* Timestamp + data quality */}
            {data?.generatedAt && !loading && (
              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] text-muted-foreground/40">
                  {ar ? "آخر تحديث" : "Uppdaterad"}:{" "}
                  {new Date(data.generatedAt).toLocaleTimeString(ar ? "ar-IQ" : "sv-SE", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="text-[10px] text-muted-foreground/40">
                  {ar ? "تحديث تلقائي كل 3 دقائق" : "Auto-uppdateras var 3:e minut"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Alert Detail Drawer ── */}
      {selectedAlert && (
        <AlertDetailDrawer
          alert={selectedAlert}
          ar={ar}
          onClose={() => setSelectedAlert(null)}
        />
      )}
    </>
  );
}
