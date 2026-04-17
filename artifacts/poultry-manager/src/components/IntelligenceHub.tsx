/**
 * IntelligenceHub — Real-time cross-module intelligence alerts.
 * Fetches from /api/intelligence/alerts and displays prioritized insights.
 * Placed at the top of the Dashboard for maximum visibility.
 */
import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, AlertCircle, CheckCircle2, Info,
  TrendingDown, Zap, ChevronRight, RefreshCw, Brain,
  XCircle, ChevronDown, ChevronUp,
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

const LEVEL_CONFIG = {
  critical: {
    icon: XCircle,
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800/50",
    icon_color: "text-red-500",
    title_color: "text-red-700 dark:text-red-400",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
    pulse: true,
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800/50",
    icon_color: "text-amber-500",
    title_color: "text-amber-700 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    pulse: false,
  },
  info: {
    icon: Info,
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800/50",
    icon_color: "text-blue-500",
    title_color: "text-blue-700 dark:text-blue-400",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
    pulse: false,
  },
  good: {
    icon: CheckCircle2,
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800/50",
    icon_color: "text-emerald-500",
    title_color: "text-emerald-700 dark:text-emerald-400",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
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
  correlation: { ar: "ارتباط",     sv: "Korrelation" },
};

function useIntelligenceAlerts() {
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const fetch_data = useCallback(async () => {
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

  useEffect(() => { fetch_data(); }, [fetch_data, lastRefresh]);

  // Auto-refresh every 3 minutes
  useEffect(() => {
    const id = setInterval(() => setLastRefresh(Date.now()), 3 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return { data, loading, error, refresh: () => setLastRefresh(Date.now()) };
}

interface AlertCardProps { alert: Alert; ar: boolean }

function AlertCard({ alert, ar }: AlertCardProps) {
  const cfg = LEVEL_CONFIG[alert.level];
  const Icon = cfg.icon;
  const modLabel = MODULE_LABELS[alert.module];

  return (
    <div
      className={cn(
        "rounded-xl border p-3 flex gap-3 items-start transition-all duration-200",
        "hover:shadow-md active:scale-[0.99]",
        cfg.bg, cfg.border,
      )}
    >
      {/* Icon */}
      <div className="shrink-0 mt-0.5">
        <Icon className={cn("w-4.5 h-4.5", cfg.icon_color, cfg.pulse && "animate-pulse")} style={{ width: 18, height: 18 }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-sm font-semibold leading-tight", cfg.title_color)}>
            {ar ? alert.titleAr : alert.titleSv}
          </span>
          {modLabel && (
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", cfg.badge)}>
              {ar ? modLabel.ar : modLabel.sv}
            </span>
          )}
          {alert.metric && (
            <span className={cn("text-xs font-bold tabular-nums", cfg.title_color)}>
              {alert.metric.value}{alert.metric.unit}
              {alert.metric.change !== undefined && (
                <span className="opacity-70 font-normal mr-1">
                  {" "}({alert.metric.change > 0 ? "+" : ""}{alert.metric.change}%)
                </span>
              )}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {ar ? alert.bodyAr : alert.bodySv}
        </p>
        {alert.href && (alert.actionAr || alert.actionSv) && (
          <Link href={alert.href}>
            <span className={cn(
              "inline-flex items-center gap-1 text-xs font-medium mt-1 cursor-pointer",
              cfg.title_color, "hover:underline"
            )}>
              {ar ? alert.actionAr : alert.actionSv}
              <ChevronRight className="w-3 h-3" />
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}

interface Props {
  className?: string;
}

export default function IntelligenceHub({ className }: Props) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { data, loading, error, refresh } = useIntelligenceAlerts();
  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Keep collapsed state in localStorage
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

  const summary = data?.summary;
  const hasCritical = (summary?.critical ?? 0) > 0;
  const visibleAlerts = data?.alerts ?? [];
  const displayAlerts = showAll ? visibleAlerts : visibleAlerts.slice(0, 4);

  return (
    <div className={cn("rounded-2xl border bg-card shadow-sm overflow-hidden", className)}>
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 cursor-pointer select-none",
          "border-b border-border/60 transition-colors hover:bg-muted/30",
          hasCritical && "bg-red-50/50 dark:bg-red-950/20"
        )}
        onClick={toggleCollapsed}
      >
        <div className={cn("p-1.5 rounded-lg", hasCritical ? "bg-red-100 dark:bg-red-900/40" : "bg-primary/10")}>
          <Brain className={cn("w-4 h-4", hasCritical ? "text-red-500 animate-pulse" : "text-primary")} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground leading-none">
            {ar ? "مركز الذكاء الزراعي" : "Gårdens Intelligenscentrum"}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {ar ? "تحليل شامل لجميع بيانات المزرعة" : "Heltäckande analys av all gårdsdata"}
          </p>
        </div>

        {/* Summary badges */}
        {summary && !loading && (
          <div className="flex items-center gap-1.5 shrink-0">
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

        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="p-3 space-y-2">
          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2 px-3 rounded-lg bg-muted/30">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{ar ? "تعذّر تحميل التحليل" : "Kunde inte ladda analys"}</span>
            </div>
          )}

          {!loading && !error && visibleAlerts.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 py-2 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{ar ? "كل شيء يبدو جيداً!" : "Allt verkar bra!"}</span>
            </div>
          )}

          {!loading && displayAlerts.map(alert => (
            <AlertCard key={alert.id} alert={alert} ar={ar} />
          ))}

          {!loading && visibleAlerts.length > 4 && (
            <button
              onClick={() => setShowAll(p => !p)}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5 font-medium flex items-center justify-center gap-1"
            >
              {showAll
                ? (ar ? "عرض أقل" : "Visa färre")
                : (ar ? `عرض ${visibleAlerts.length - 4} تنبيه إضافي` : `Visa ${visibleAlerts.length - 4} fler`)
              }
              {showAll ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}

          {/* Timestamp */}
          {data?.generatedAt && !loading && (
            <p className="text-[10px] text-muted-foreground/50 text-center pt-1">
              {ar ? "آخر تحديث" : "Senast uppdaterad"}:{" "}
              {new Date(data.generatedAt).toLocaleTimeString(ar ? "ar-IQ" : "sv-SE", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
