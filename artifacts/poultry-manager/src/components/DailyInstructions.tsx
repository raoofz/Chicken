/**
 * DailyInstructions — تعليمات اليوم
 * Displays structured worker instructions derived from manager's daily notes.
 * Auto-refreshes every 60 seconds.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  AlertTriangle, AlertCircle, CheckSquare, ChevronDown, ChevronUp,
  RefreshCw, Database, ExternalLink, ClipboardList,
} from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

// ── Types ────────────────────────────────────────────────────────────────────

interface DailyInstruction {
  id: string;
  type: "ALERT" | "WARNING" | "TASK";
  priority: "HIGH" | "MEDIUM" | "LOW";
  messageAr: string;
  messageSv: string;
  relatedModule: "feed" | "health" | "environment" | "hatching" | "operations" | "finance" | "general";
  sourceNoteId: number;
  dataConfirmed: boolean;
  dataContextAr?: string;
  dataContextSv?: string;
}

interface DailyInstructionsData {
  success: boolean;
  date: string;
  items: DailyInstruction[];
  meta: {
    noteCount: number;
    alertCount: number;
    warningCount: number;
    taskCount: number;
    generatedAt: string;
  };
}

// ── Module → link map ────────────────────────────────────────────────────────

const MODULE_HREF: Record<string, string> = {
  feed:        "/feed",
  health:      "/flocks",
  hatching:    "/hatching",
  operations:  "/operations",
  finance:     "/finance",
  environment: "/operations",
  general:     "/",
};

// ── Visual config per type ───────────────────────────────────────────────────

const TYPE_CONFIG = {
  ALERT: {
    icon: AlertCircle,
    bg:     "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800/50",
    badge:  "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
    iconCl: "text-red-500",
    labelAr: "تنبيه",
    labelSv: "Varning",
  },
  WARNING: {
    icon: AlertTriangle,
    bg:     "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800/50",
    badge:  "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    iconCl: "text-amber-500",
    labelAr: "تحذير",
    labelSv: "Tillsyn",
  },
  TASK: {
    icon: CheckSquare,
    bg:     "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800/50",
    badge:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
    iconCl: "text-emerald-600",
    labelAr: "مهمة",
    labelSv: "Uppgift",
  },
} as const;

const PRIORITY_DOT: Record<string, string> = {
  HIGH:   "bg-red-500",
  MEDIUM: "bg-amber-400",
  LOW:    "bg-emerald-500",
};

const PRIORITY_LABEL_AR: Record<string, string> = {
  HIGH: "عالية", MEDIUM: "متوسطة", LOW: "منخفضة",
};
const PRIORITY_LABEL_SV: Record<string, string> = {
  HIGH: "Hög", MEDIUM: "Medel", LOW: "Låg",
};

// ── Module labels ────────────────────────────────────────────────────────────

const MODULE_AR: Record<string, string> = {
  feed: "العلف", health: "الصحة", environment: "البيئة",
  hatching: "التفقيس", operations: "العمليات", finance: "المالية", general: "عام",
};
const MODULE_SV: Record<string, string> = {
  feed: "Foder", health: "Hälsa", environment: "Miljö",
  hatching: "Kläckning", operations: "Drift", finance: "Ekonomi", general: "Allmänt",
};

// ── Main Component ───────────────────────────────────────────────────────────

export function DailyInstructions() {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const [data, setData] = useState<DailyInstructionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/intelligence/daily-instructions");
      if (res.ok) {
        const json: DailyInstructionsData = await res.json();
        setData(json);
      }
    } catch {
      // network error — keep stale data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
    intervalRef.current = setInterval(() => loadData(true), 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadData]);

  // Nothing to show
  if (loading || !data || data.items.length === 0) return null;

  const { items, meta } = data;
  const alertCount   = meta.alertCount;
  const warningCount = meta.warningCount;
  const taskCount    = meta.taskCount;

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none bg-muted/30 hover:bg-muted/50 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className={`flex items-center gap-2.5 ${ar ? "flex-row-reverse" : ""}`}>
          <div className="p-1.5 rounded-lg bg-primary/10">
            <ClipboardList className="w-4 h-4 text-primary" />
          </div>
          <div className={ar ? "text-right" : "text-left"}>
            <h2 className="text-sm font-bold text-foreground leading-none">
              {ar ? "تعليمات اليوم" : "Dagens instruktioner"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ar
                ? `من ${meta.noteCount} ملاحظة للمدير`
                : `Från ${meta.noteCount} chefsnotering`}
            </p>
          </div>
        </div>

        <div className={`flex items-center gap-2 ${ar ? "flex-row-reverse" : ""}`}>
          {/* Summary badges */}
          <div className={`flex items-center gap-1.5 ${ar ? "flex-row-reverse" : ""}`}>
            {alertCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                <AlertCircle className="w-3 h-3" />{alertCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                <AlertTriangle className="w-3 h-3" />{warningCount}
              </span>
            )}
            {taskCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <CheckSquare className="w-3 h-3" />{taskCount}
              </span>
            )}
          </div>

          {/* Refresh + collapse */}
          <button
            onClick={e => { e.stopPropagation(); loadData(); }}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
            title={ar ? "تحديث" : "Uppdatera"}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          {collapsed
            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
            : <ChevronUp   className="w-4 h-4 text-muted-foreground" />
          }
        </div>
      </div>

      {/* ── Items ──────────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="divide-y divide-border/40">
          {items.map(item => {
            const cfg  = TYPE_CONFIG[item.type];
            const Icon = cfg.icon;
            const href = MODULE_HREF[item.relatedModule] ?? "/";
            const message = ar ? item.messageAr : item.messageSv;
            const dataCtx = ar ? item.dataContextAr : item.dataContextSv;
            const modLabel = ar ? MODULE_AR[item.relatedModule] : MODULE_SV[item.relatedModule];
            const priLabel = ar ? PRIORITY_LABEL_AR[item.priority] : PRIORITY_LABEL_SV[item.priority];

            return (
              <div
                key={item.id}
                className={`px-4 py-3 flex items-start gap-3 ${cfg.bg} ${ar ? "flex-row-reverse" : ""}`}
              >
                {/* Type icon */}
                <div className={`mt-0.5 p-1.5 rounded-lg border ${cfg.border} bg-white/60 dark:bg-black/20 flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${cfg.iconCl}`} />
                </div>

                {/* Content */}
                <div className={`flex-1 min-w-0 ${ar ? "text-right" : "text-left"}`}>
                  <div className={`flex items-center gap-2 mb-1 flex-wrap ${ar ? "flex-row-reverse" : ""}`}>
                    {/* Type badge */}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                      {ar ? cfg.labelAr : cfg.labelSv}
                    </span>
                    {/* Module */}
                    <span className="text-xs text-muted-foreground font-medium px-1.5 py-0.5 rounded bg-background/60">
                      {modLabel}
                    </span>
                    {/* Priority dot */}
                    <div className={`flex items-center gap-1 ${ar ? "flex-row-reverse" : ""}`}>
                      <div className={`w-2 h-2 rounded-full ${PRIORITY_DOT[item.priority]}`} />
                      <span className="text-xs text-muted-foreground">{priLabel}</span>
                    </div>
                    {/* Data confirmed badge */}
                    {item.dataConfirmed && (
                      <span className={`flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full
                        bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ${ar ? "flex-row-reverse" : ""}`}>
                        <Database className="w-2.5 h-2.5" />
                        {ar ? "مؤكد بالبيانات" : "Databekräftat"}
                      </span>
                    )}
                  </div>

                  {/* Message */}
                  <p className="text-sm font-medium text-foreground leading-snug">{message}</p>

                  {/* Data context (additional explanation) */}
                  {dataCtx && (
                    <p className="text-xs text-muted-foreground mt-1 italic">{dataCtx}</p>
                  )}
                </div>

                {/* Link to module */}
                <Link href={href}>
                  <button className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors mt-0.5">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className={`px-4 py-2 bg-muted/20 border-t border-border/40 flex items-center justify-between ${ar ? "flex-row-reverse" : ""}`}>
          <p className="text-xs text-muted-foreground">
            {ar ? "يتحدث تلقائياً كل دقيقة" : "Uppdateras automatiskt varje minut"}
          </p>
          <Link href="/notes">
            <button className={`text-xs text-primary hover:underline font-medium flex items-center gap-1 ${ar ? "flex-row-reverse" : ""}`}>
              {ar ? "عرض الملاحظات" : "Visa anteckningar"}
              <ExternalLink className="w-3 h-3" />
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
