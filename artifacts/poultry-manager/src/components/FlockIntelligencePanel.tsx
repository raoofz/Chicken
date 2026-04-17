/**
 * FlockIntelligencePanel — AI Intelligence Tab for Flocks Module
 * ─────────────────────────────────────────────────────────────────────────────
 * Features:
 *  • Health / Risk / Performance score gauges
 *  • Confidence meter with threshold behavior (< 60 → ask user, > 80 → auto-suggest)
 *  • Prioritized decision list (P1 critical, P2 important, P3 monitoring)
 *  • Predictive intelligence (risk forecasts)
 *  • Smart Arabic note parser with live feedback
 *  • Event timeline (last 30 events)
 */

import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Brain, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown,
  Zap, Shield, Activity, Clock, ChevronDown, ChevronUp, Sparkles,
  MessageSquare, History, RefreshCw, Info,
} from "lucide-react";

// ── Types (mirrors engine output) ─────────────────────────────────────────────

interface FlockDecision {
  priority: 1 | 2 | 3;
  urgency: "now" | "today" | "this_week";
  titleAr: string; titleSv: string;
  actionAr: string; actionSv: string;
  reasonAr: string; reasonSv: string;
  confidence: number;
}

interface FlockPrediction {
  type: string;
  probabilityPct: number;
  horizon: string;
  descriptionAr: string; descriptionSv: string;
  preventionAr: string; preventionSv: string;
}

interface Anomaly {
  severity: "critical" | "high" | "medium";
  titleAr: string; titleSv: string;
  detailAr: string; detailSv: string;
}

interface IntelligenceResult {
  flockId: number; flockName: string; generatedAt: string;
  healthScore: number; riskScore: number; performanceIndex: number;
  dataQuality: "excellent" | "good" | "limited" | "none";
  confidence: number;
  requiresClarification: boolean;
  clarificationAr: string | null; clarificationSv: string | null;
  anomalies: Anomaly[];
  decisions: FlockDecision[];
  predictions: FlockPrediction[];
  summaryAr: string; summarySv: string;
  autoSuggest: boolean;
}

interface ParsedEvent {
  type: string; subtype: string; severity: string;
  signalAr: string; signalSv: string; confidence: number;
  value?: string | number;
}

interface ParseResult {
  events: ParsedEvent[];
  overallConfidence: number;
  requiresClarification: boolean;
  clarificationAr: string | null; clarificationSv: string | null;
  summaryAr: string; summarySv: string;
}

interface TimelineEvent {
  id: number; event_type: string; subtype: string; severity: string;
  payload: Record<string, unknown>; confidence: number; created_at: string;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  flockId: number;
  flockName: string;
  ar: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreGauge({ value, label, colorFn }: {
  value: number;
  label: string;
  colorFn: (v: number) => string;
}) {
  const color = colorFn(value);
  const r = 30; const circ = 2 * Math.PI * r;
  const dash = circ * (1 - value / 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
          <circle
            cx="40" cy="40" r={r} fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={circ} strokeDashoffset={dash}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold" style={{ color }}>{value}</span>
        </div>
      </div>
      <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

function healthColor(v: number) {
  return v >= 70 ? "#10b981" : v >= 45 ? "#f59e0b" : "#ef4444";
}
function riskColor(v: number) {
  return v >= 60 ? "#ef4444" : v >= 35 ? "#f59e0b" : "#10b981";
}
function perfColor(v: number) {
  return v >= 70 ? "#6366f1" : v >= 45 ? "#f59e0b" : "#ef4444";
}

function ConfidenceMeter({ value, ar }: { value: number; ar: boolean }) {
  const color = value >= 80 ? "#10b981" : value >= 60 ? "#f59e0b" : "#ef4444";
  const label = value >= 80
    ? (ar ? "موثوقية عالية — توصية تلقائية" : "Hög tillförlitlighet — auto-förslag")
    : value >= 60
    ? (ar ? "موثوقية مقبولة — يُوصى بالمراجعة" : "Godtagbar tillförlitlighet — granskning rekommenderas")
    : (ar ? "بيانات محدودة — مطلوب توضيح" : "Begränsade data — förtydligande krävs");

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">{ar ? "موثوقية التحليل" : "Analysförtroende"}</span>
        <span className="font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <p className="text-[10px]" style={{ color }}>{label}</p>
    </div>
  );
}

function PriorityBadge({ priority, urgency, ar }: { priority: 1 | 2 | 3; urgency: string; ar: boolean }) {
  const cfg = {
    1: { color: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-400/30", icon: "🚨", label: ar ? "حرج الآن" : "Kritisk nu" },
    2: { color: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-400/30", icon: "⚠️", label: ar ? "مهم اليوم" : "Viktigt idag" },
    3: { color: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-400/30", icon: "📋", label: ar ? "متابعة" : "Uppföljning" },
  }[priority];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}>
      <span>{cfg.icon}</span>{cfg.label}
    </span>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const color = severity === "critical" ? "bg-red-500" : severity === "high" ? "bg-orange-500" : severity === "medium" ? "bg-yellow-500" : "bg-emerald-500";
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${color} mt-0.5`} />;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FlockIntelligencePanel({ flockId, flockName, ar }: Props) {
  const { toast } = useToast();

  const [result, setResult]       = useState<IntelligenceResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [noteText, setNoteText]   = useState("");
  const [parsing, setParsing]     = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [timeline, setTimeline]   = useState<TimelineEvent[] | null>(null);
  const [loadingTL, setLoadingTL] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [expandedDecision, setExpandedDecision] = useState<number | null>(null);

  // ── Run full analysis ──────────────────────────────────────────────────────
  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setParseResult(null);
    try {
      const resp = await apiFetch<IntelligenceResult>(
        `/api/flocks/${flockId}/intelligence/analyze`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      setResult(resp);
    } catch (err: any) {
      toast({ title: ar ? "خطأ" : "Fel", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [flockId, ar, toast]);

  // ── Parse Arabic note ──────────────────────────────────────────────────────
  const parseNote = useCallback(async () => {
    if (!noteText.trim()) return;
    setParsing(true);
    setParseResult(null);
    try {
      const resp = await apiFetch<ParseResult>(
        `/api/flocks/${flockId}/intelligence/parse-note`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: noteText }) }
      );
      setParseResult(resp);
    } catch (err: any) {
      toast({ title: ar ? "خطأ" : "Fel", description: err.message, variant: "destructive" });
    } finally {
      setParsing(false);
    }
  }, [flockId, noteText, ar, toast]);

  // ── Load timeline ──────────────────────────────────────────────────────────
  const loadTimeline = useCallback(async () => {
    setLoadingTL(true);
    try {
      const resp = await apiFetch<TimelineEvent[]>(
        `/api/flocks/${flockId}/intelligence/timeline?limit=20`
      );
      setTimeline(resp);
      setShowTimeline(true);
    } catch (err: any) {
      toast({ title: ar ? "خطأ" : "Fel", description: err.message, variant: "destructive" });
    } finally {
      setLoadingTL(false);
    }
  }, [flockId, ar, toast]);

  const severityBg: Record<string, string> = {
    critical: "bg-red-500/10 border-red-400/30",
    high:     "bg-orange-500/10 border-orange-400/30",
    medium:   "bg-yellow-500/10 border-yellow-400/30",
    positive: "bg-emerald-500/10 border-emerald-400/30",
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header + Analyze button ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-violet-500" />
          <div>
            <p className="font-semibold text-sm">{ar ? "محرك الذكاء الاصطناعي" : "AI Intelligence Engine"}</p>
            <p className="text-[11px] text-muted-foreground">
              {ar ? "تحليل عميق · قرارات مرتّبة · توقعات" : "Djupanalys · Prioriterade beslut · Prognoser"}
            </p>
          </div>
        </div>
        <Button
          size="sm" onClick={runAnalysis} disabled={loading}
          className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
        >
          {loading
            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            : <Sparkles className="w-3.5 h-3.5" />}
          {ar ? (loading ? "جارٍ التحليل…" : "تحليل ذكي") : (loading ? "Analyserar…" : "Analysera")}
        </Button>
      </div>

      {/* ── No analysis yet ────────────────────────────────────────────── */}
      {!result && !loading && (
        <div className="rounded-xl border border-dashed border-violet-300/50 dark:border-violet-700/40 bg-violet-50/30 dark:bg-violet-950/20 p-6 text-center space-y-2">
          <Brain className="w-10 h-10 mx-auto text-violet-400 opacity-50" />
          <p className="text-sm text-muted-foreground">
            {ar
              ? `اضغط "تحليل ذكي" لتشغيل محرك الذكاء على القطيع "${flockName}"`
              : `Klicka "Analysera" för att köra AI-analys på flocken "${flockName}"`}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {ar
              ? "يُحسب: درجة الصحة، مستوى الخطر، الأداء، الشذوذات، القرارات المرتبة، التوقعات"
              : "Beräknar: hälsopoäng, risknivå, prestanda, anomalier, prioriterade beslut, prognoser"}
          </p>
        </div>
      )}

      {/* ── Loading skeleton ───────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-3">
          <div className="h-24 rounded-xl bg-muted/40 animate-pulse" />
          <div className="h-16 rounded-xl bg-muted/40 animate-pulse" />
          <div className="h-32 rounded-xl bg-muted/40 animate-pulse" />
        </div>
      )}

      {/* ── Intelligence Result ────────────────────────────────────────── */}
      {result && (
        <div className="space-y-4">

          {/* Summary */}
          <div className="rounded-xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200/50 dark:border-violet-800/30 p-3 text-sm">
            <p className="text-violet-800 dark:text-violet-300">{ar ? result.summaryAr : result.summarySv}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {ar ? "آخر تحليل:" : "Senaste analys:"} {new Date(result.generatedAt).toLocaleTimeString(ar ? "ar-IQ" : "sv-SE")}
            </p>
          </div>

          {/* Score Gauges */}
          <div className="flex justify-around py-2">
            <ScoreGauge value={result.healthScore}      label={ar ? "الصحة" : "Hälsa"}       colorFn={healthColor} />
            <ScoreGauge value={result.riskScore}        label={ar ? "الخطر" : "Risk"}         colorFn={riskColor} />
            <ScoreGauge value={result.performanceIndex} label={ar ? "الأداء" : "Prestanda"}   colorFn={perfColor} />
          </div>

          {/* Confidence Meter */}
          <div className="rounded-xl border border-border/60 p-3">
            <ConfidenceMeter value={result.confidence} ar={ar} />
            {/* Clarification request (confidence < 60) */}
            {result.requiresClarification && result.clarificationAr && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5">
                <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  {ar ? result.clarificationAr : result.clarificationSv}
                </p>
              </div>
            )}
            {/* Auto-suggest flag */}
            {result.autoSuggest && !result.requiresClarification && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                <Zap className="w-3 h-3" />
                {ar ? "بيانات كافية — التوصية الأولى مُقترَحة تلقائياً" : "Tillräcklig data — första rekommendation auto-föreslagen"}
              </div>
            )}
          </div>

          {/* Anomalies */}
          {result.anomalies.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                {ar ? "شذوذات مرصودة" : "Registrerade anomalier"} ({result.anomalies.length})
              </p>
              {result.anomalies.map((a, i) => (
                <div key={i} className={`rounded-lg border p-3 text-xs space-y-1 ${
                  a.severity === "critical" ? "bg-red-500/10 border-red-400/30" :
                  a.severity === "high" ? "bg-orange-500/10 border-orange-400/30" :
                  "bg-yellow-500/10 border-yellow-400/30"
                }`}>
                  <div className="flex items-center gap-1.5 font-semibold">
                    <SeverityDot severity={a.severity} />
                    {ar ? a.titleAr : a.titleSv}
                  </div>
                  <p className="text-muted-foreground ps-3.5">{ar ? a.detailAr : a.detailSv}</p>
                </div>
              ))}
            </div>
          )}

          {/* Decisions */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-violet-500" />
              {ar ? "القرارات المقترحة" : "Föreslagna åtgärder"} ({result.decisions.length})
            </p>
            {result.decisions.map((d, i) => (
              <div key={i} className={`rounded-xl border overflow-hidden ${
                d.priority === 1 ? "border-red-400/30 bg-red-500/5" :
                d.priority === 2 ? "border-orange-400/30 bg-orange-500/5" :
                "border-blue-400/30 bg-blue-500/5"
              }`}>
                <button
                  className="w-full flex items-center justify-between p-3 text-start"
                  onClick={() => setExpandedDecision(expandedDecision === i ? null : i)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <PriorityBadge priority={d.priority} urgency={d.urgency} ar={ar} />
                    <span className="text-xs font-semibold truncate">{ar ? d.titleAr : d.titleSv}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] text-muted-foreground">{d.confidence}%</span>
                    {expandedDecision === i
                      ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                      : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                </button>
                {expandedDecision === i && (
                  <div className="px-3 pb-3 space-y-2 border-t border-border/30 pt-2">
                    <div className="text-[11px] text-muted-foreground">
                      <span className="font-medium">{ar ? "السبب: " : "Orsak: "}</span>
                      {ar ? d.reasonAr : d.reasonSv}
                    </div>
                    <div className="bg-background/60 rounded-lg p-2.5">
                      <p className="text-[11px] font-medium mb-1">{ar ? "الإجراءات:" : "Åtgärder:"}</p>
                      {(ar ? d.actionAr : d.actionSv).split("\n").map((line, j) => (
                        <p key={j} className="text-xs text-foreground/80 leading-relaxed">{line}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Predictions */}
          {result.predictions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                {ar ? "التوقعات" : "Prognoser"} ({result.predictions.length})
              </p>
              {result.predictions.map((p, i) => (
                <div key={i} className="rounded-xl border border-blue-300/40 bg-blue-500/5 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{ar ? p.descriptionAr : p.descriptionSv}</p>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0 ms-2">
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{p.probabilityPct}%</span>
                      <span className="text-[9px] text-muted-foreground">{p.horizon}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${p.probabilityPct}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    <span className="font-medium">{ar ? "الوقاية: " : "Förebyggande: "}</span>
                    {ar ? p.preventionAr : p.preventionSv}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Smart Note Parser ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="flex items-center gap-2 bg-muted/30 px-3 py-2">
          <MessageSquare className="w-4 h-4 text-emerald-500" />
          <p className="text-xs font-semibold">{ar ? "محلّل الملاحظات الذكي" : "Smart anteckningstolkare"}</p>
        </div>
        <div className="p-3 space-y-3">
          <Textarea
            value={noteText}
            onChange={e => { setNoteText(e.target.value); setParseResult(null); }}
            placeholder={ar
              ? "اكتب ملاحظتك بالعربية — مثال: مات 3 دجاج اليوم، الباقي خامل ولا يأكل"
              : "Skriv din anteckning — t.ex. 3 kycklingar dog idag, resten är slöa"}
            className="min-h-[70px] text-sm resize-none"
            dir="auto"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm" variant="outline" onClick={parseNote}
              disabled={parsing || !noteText.trim()}
              className="gap-1.5 flex-1"
            >
              {parsing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
              {ar ? (parsing ? "جارٍ التحليل…" : "حلّل النص") : (parsing ? "Analyserar…" : "Analysera text")}
            </Button>
            {noteText && (
              <Button size="sm" variant="ghost" onClick={() => { setNoteText(""); setParseResult(null); }} className="px-2">
                ✕
              </Button>
            )}
          </div>

          {/* Parse result */}
          {parseResult && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">{ar ? parseResult.summaryAr : parseResult.summarySv}</p>
                <span className="text-[10px] text-muted-foreground">
                  {ar ? "ثقة:" : "Konf:"} {Math.round(parseResult.overallConfidence * 100)}%
                </span>
              </div>
              {parseResult.requiresClarification && parseResult.clarificationAr && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  {ar ? parseResult.clarificationAr : parseResult.clarificationSv}
                </div>
              )}
              {parseResult.events.length > 0 && (
                <div className="space-y-1.5">
                  {parseResult.events.map((evt, i) => (
                    <div key={i} className={`rounded-lg border p-2 text-xs flex items-start gap-2 ${severityBg[evt.severity] ?? "bg-muted/30"}`}>
                      <SeverityDot severity={evt.severity} />
                      <div className="min-w-0">
                        <span className="font-medium">{ar ? evt.signalAr : evt.signalSv}</span>
                        {evt.value !== undefined && (
                          <span className="text-muted-foreground ms-1">({evt.value})</span>
                        )}
                        <span className="text-muted-foreground ms-2 text-[10px]">{evt.type}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground ms-auto flex-shrink-0">
                        {Math.round(evt.confidence * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Event Timeline ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <button
          className="w-full flex items-center justify-between bg-muted/30 px-3 py-2"
          onClick={() => {
            if (!showTimeline) { loadTimeline(); }
            else { setShowTimeline(false); }
          }}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-blue-500" />
            <p className="text-xs font-semibold">{ar ? "تاريخ الأحداث" : "Händelsehistorik"}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {loadingTL && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            {showTimeline ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
        </button>

        {showTimeline && timeline && (
          <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
            {timeline.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {ar ? "لا توجد أحداث مسجّلة بعد" : "Inga händelser registrerade ännu"}
              </p>
            ) : (
              timeline.map((evt) => (
                <div key={evt.id} className="flex items-start gap-2.5 text-xs pb-2 border-b border-border/30 last:border-0">
                  <SeverityDot severity={evt.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium capitalize">{evt.event_type}</span>
                      {evt.subtype && evt.subtype !== evt.event_type && (
                        <span className="text-[10px] text-muted-foreground">· {evt.subtype}</span>
                      )}
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{evt.confidence}%</Badge>
                    </div>
                    {evt.payload?.signalAr && (
                      <p className="text-muted-foreground mt-0.5 truncate">
                        {ar ? String(evt.payload.signalAr) : String((evt.payload as any).signalSv ?? evt.payload.signalAr)}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {new Date(evt.created_at).toLocaleString(ar ? "ar-IQ" : "sv-SE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

    </div>
  );
}
