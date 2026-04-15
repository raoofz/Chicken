/**
 * ملاحظات يومية — Daily Notes + Farm Photos
 * Combined page: text notes & photo uploads with AI vision analysis
 */
import { useState, useRef, useCallback, useEffect, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Trash2, FileText, Camera, Upload, Image as ImageIcon, Brain,
  Tag, AlertTriangle, CheckCircle, Clock, X, RefreshCw, ZoomIn, Calendar,
  MessageSquare, Loader2, ChevronDown, ChevronUp, Activity, Thermometer,
  Droplets, Zap, TrendingUp, TrendingDown, Minus, BarChart3, Shield, Star, Send,
  Sparkles, CheckCircle2, ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

// ─── API helpers ─────────────────────────────────────────────────────────────
async function fetchNotes() {
  const r = await fetch("/api/notes?limit=100", { credentials: "include" });
  if (!r.ok) throw new Error("fetch_error");
  return r.json();
}
async function createNote(data: { content: string; date: string; category: string }) {
  const r = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
  if (!r.ok) throw new Error("add_error");
  return r.json();
}
async function deleteNote(id: number) {
  const r = await fetch(`/api/notes/${id}`, { method: "DELETE", credentials: "include" });
  if (!r.ok) throw new Error("delete_error");
}
async function fetchImages(date?: string) {
  const url = date ? `/api/notes/images?date=${date}` : "/api/notes/images";
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error("fetch_error");
  return r.json();
}
async function deleteImage(id: number) {
  const r = await fetch(`/api/notes/images/${id}`, { method: "DELETE", credentials: "include" });
  if (!r.ok) throw new Error("delete_error");
}
async function reanalyzeImage(id: number, lang?: string) {
  const r = await fetch(`/api/notes/images/${id}/analyze`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lang: lang ?? "ar" }),
  });
  if (!r.ok) throw new Error("analyze_error");
  return r.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface VisionMetrics {
  estimatedBirdCount: number;
  densityScore: number;
  crowdingScore: number;
  activityLevel: number;
  healthScore: number;
  injuryRisk: number;
  floorCleanliness: number;
  lightingScore: number;
  lightingUniformity: number;
  riskScore: number;
  gridData?: { rows: number; cols: number; zones: GridZone[] };
}

interface GridZone {
  row: number;
  col: number;
  density: number;
  activity: number;
  cleanliness: number;
  lighting: number;
  label: string;
}

interface NoteImage {
  id: number;
  date: string;
  imageUrl: string;
  originalName: string;
  category: string;
  caption: string | null;
  authorName: string | null;
  aiAnalysis: string | null;
  aiTags: string[] | null;
  aiAlerts: { level: string; message: string }[] | null;
  aiConfidence: number | null;
  visualMetrics: VisionMetrics | null;
  riskScore: number | null;
  analysisStatus: string;
  createdAt: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  general:     { bg: "bg-slate-50",   text: "text-slate-700",  border: "border-slate-200" },
  health:      { bg: "bg-red-50",     text: "text-red-700",    border: "border-red-200" },
  production:  { bg: "bg-amber-50",   text: "text-amber-700",  border: "border-amber-200" },
  feeding:     { bg: "bg-green-50",   text: "text-green-700",  border: "border-green-200" },
  maintenance: { bg: "bg-blue-50",    text: "text-blue-700",   border: "border-blue-200" },
  observation: { bg: "bg-purple-50",  text: "text-purple-700", border: "border-purple-200" },
  incubator:   { bg: "bg-orange-50",  text: "text-orange-700", border: "border-orange-200" },
  flock:       { bg: "bg-teal-50",    text: "text-teal-700",   border: "border-teal-200" },
};

const NOTE_CATEGORY_KEYS = ["general","health","production","feeding","maintenance","observation","incubator","flock"] as const;
const IMG_CATEGORY_KEYS  = ["general","health","production","feeding","incubator","flock","maintenance"] as const;

// ─── Upload image helper ──────────────────────────────────────────────────────
async function uploadFarmPhoto(
  file: File,
  date: string,
  category: string,
  caption: string,
  lang?: string,
): Promise<NoteImage> {
  // 1) Get presigned upload URL
  const urlRes = await fetch("/api/notes/images/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ contentType: file.type, name: file.name }),
  });
  if (!urlRes.ok) {
    const e = await urlRes.json().catch(() => ({}));
    throw new Error(e.error ?? "Failed to get upload URL");
  }
  const { uploadURL, objectPath } = await urlRes.json();

  // 2) Upload directly to GCS
  const uploadRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!uploadRes.ok) throw new Error("Failed to upload to storage");

  // 3) Save record + trigger AI
  const saveRes = await fetch("/api/notes/images/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ objectPath, originalName: file.name, mimeType: file.type, date, category, caption, lang: lang ?? "ar" }),
  });
  if (!saveRes.ok) {
    const e = await saveRes.json().catch(() => ({}));
    throw new Error(e.error ?? "Failed to save record");
  }
  const { id } = await saveRes.json();
  return { id } as NoteImage;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  if (status === "done")      return <Badge className="bg-green-100 text-green-700 text-xs gap-1"><CheckCircle className="w-3 h-3"/>{t("img.status.done")}</Badge>;
  if (status === "analyzing") return <Badge className="bg-blue-100 text-blue-700 text-xs gap-1"><Loader2 className="w-3 h-3 animate-spin"/>{t("img.status.analyzing")}</Badge>;
  if (status === "failed")    return <Badge className="bg-red-100 text-red-700 text-xs gap-1"><AlertTriangle className="w-3 h-3"/>{t("img.status.failed")}</Badge>;
  return <Badge className="bg-slate-100 text-slate-600 text-xs gap-1"><Clock className="w-3 h-3"/>{t("img.status.pending")}</Badge>;
}

function ConfidenceBar({ value }: { value: number }) {
  const { t } = useLanguage();
  const color = value >= 80 ? "bg-green-500" : value >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-xs text-slate-500">{t("img.confidence")}</span>
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-600">{value}%</span>
    </div>
  );
}

// ─── Metric Gauge ─────────────────────────────────────────────────────────────
function MetricGauge({ label, value, higherIsBetter = true, icon }: { label: string; value: number; higherIsBetter?: boolean; icon?: React.ReactNode }) {
  const isGood = higherIsBetter ? value >= 65 : value <= 35;
  const isWarn = higherIsBetter ? value >= 40 : value <= 60;
  const color = isGood ? "bg-emerald-500" : isWarn ? "bg-amber-500" : "bg-red-500";
  const textColor = isGood ? "text-emerald-700" : isWarn ? "text-amber-700" : "text-red-700";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500 flex items-center gap-1">{icon}{label}</span>
        <span className={cn("text-[10px] font-bold", textColor)}>{value}%</span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

// ─── Risk Score Ring ──────────────────────────────────────────────────────────
function RiskRing({ score }: { score: number }) {
  const { t } = useLanguage();
  const color = score >= 65 ? "text-red-600 bg-red-50 border-red-200" : score >= 35 ? "text-amber-600 bg-amber-50 border-amber-200" : "text-emerald-600 bg-emerald-50 border-emerald-200";
  const label = score >= 65 ? t("img.risk.high") : score >= 35 ? t("img.risk.medium") : t("img.risk.low");
  const icon = score >= 65 ? "🔴" : score >= 35 ? "🟡" : "✅";
  return (
    <div className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold", color)}>
      <Shield className="w-3.5 h-3.5" />
      <span>{icon} {label}</span>
      <span className="mr-auto font-bold">{score}/100</span>
    </div>
  );
}

// ─── Density Heatmap ──────────────────────────────────────────────────────────
function DensityHeatmap({ zones, rows, cols }: { zones: any[]; rows: number; cols: number }) {
  const { t } = useLanguage();
  const grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => zones.find((z: any) => z.row === r && z.col === c))
  );

  const getColor = (density: number) => {
    if (density >= 80) return "bg-red-600";
    if (density >= 60) return "bg-orange-500";
    if (density >= 40) return "bg-amber-400";
    if (density >= 20) return "bg-lime-400";
    return "bg-emerald-300";
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-slate-500 font-medium">{t("img.heatmap.title")}</p>
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {grid.flat().map((zone: any, i) => (
          <div
            key={i}
            className={cn("h-7 rounded-sm opacity-80 transition-opacity hover:opacity-100 cursor-help flex items-center justify-center", zone ? getColor(zone.density) : "bg-slate-200")}
            title={zone ? `${zone.label}: ${zone.density}% • ${zone.activity}%` : ""}
          >
            <span className="text-[8px] text-white/90 font-bold drop-shadow">{zone?.density ?? 0}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
        <span className="w-3 h-2 rounded-sm bg-emerald-300 inline-block" />{t("img.heatmap.low")}
        <span className="w-3 h-2 rounded-sm bg-amber-400 inline-block mr-1" />{t("img.heatmap.medium")}
        <span className="w-3 h-2 rounded-sm bg-red-600 inline-block mr-1" />{t("img.heatmap.high")}
      </div>
    </div>
  );
}

// ─── Image Card (Enhanced with CV AI) ────────────────────────────────────────
function ImageCard({
  img,
  isAdmin,
  onDelete,
  onReanalyze,
}: {
  img: NoteImage;
  isAdmin: boolean;
  onDelete: (id: number) => void;
  onReanalyze: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showRawText, setShowRawText] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [feedbackData, setFeedbackData] = useState({
    correctedBirdCount: "",
    correctedHealthScore: "",
    correctedRiskLevel: "",
    confidenceRating: 0,
    notes: "",
  });
  const { t } = useLanguage();
  const { toast } = useToast();

  const submitFeedback = async () => {
    setFeedbackSubmitting(true);
    try {
      const body: Record<string, any> = {};
      if (feedbackData.correctedBirdCount) body.correctedBirdCount = Number(feedbackData.correctedBirdCount);
      if (feedbackData.correctedHealthScore) body.correctedHealthScore = Number(feedbackData.correctedHealthScore);
      if (feedbackData.correctedRiskLevel) body.correctedRiskLevel = feedbackData.correctedRiskLevel;
      if (feedbackData.confidenceRating) body.confidenceRating = feedbackData.confidenceRating;
      if (feedbackData.notes) body.notes = feedbackData.notes;

      const r = await fetch(`/api/notes/images/${img.id}/feedback`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Request failed");
      setFeedbackDone(true);
      setShowFeedback(false);
      toast({ title: t("img.feedback.toast.title"), description: t("img.feedback.toast.desc") });
    } catch (e: any) {
      toast({ variant: "destructive", title: t("img.feedback.error"), description: e.message });
    } finally { setFeedbackSubmitting(false); }
  };
  const imageFileUrl = `/api/notes/images/file/${img.imageUrl.replace(/^\/objects\//, "")}`;
  const criticalAlerts = (img.aiAlerts ?? []).filter(a => a.level === "critical");
  const warnAlerts = (img.aiAlerts ?? []).filter(a => a.level === "warning");
  const m = img.visualMetrics;

  // Parse operational insights from analysis text
  const insights = img.aiAnalysis
    ? img.aiAnalysis.split("\n")
        .filter(l => l.includes("السبب:") || l.includes("التأثير:") || l.includes("Orsak:") || l.includes("Påverkan:") || (l.includes("🔴") && l.includes(":")) || (l.includes("🟠") && l.includes(":")))
    : [];

  // Parse action items from analysis text
  const actions = img.aiAnalysis
    ? img.aiAnalysis.split("\n")
        .filter(l => /^\s+\d+\.\s*(🚨|⚡|📌|📝)/.test(l))
        .slice(0, 4)
    : [];

  return (
    <>
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setLightbox(false)}>
          <button className="absolute top-4 right-4 text-white"><X className="w-8 h-8" /></button>
          <img src={imageFileUrl} alt={img.originalName} className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl" />
        </div>
      )}

      <Card className={cn("overflow-hidden border transition-shadow hover:shadow-md", criticalAlerts.length > 0 ? "border-red-300" : m && m.riskScore >= 35 ? "border-amber-200" : "")}>
        {/* Image */}
        <div className="relative aspect-video bg-slate-100 cursor-pointer group" onClick={() => setLightbox(true)}>
          <img src={imageFileUrl} alt={img.originalName} className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }} />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="absolute top-2 right-2"><StatusBadge status={img.analysisStatus} /></div>
          {m && (
            <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-full">
              {t("scan.imgReport.risk")} {m.riskScore}/100
            </div>
          )}
          {criticalAlerts.length > 0 && (
            <div className="absolute bottom-2 left-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />{criticalAlerts.length} {t("notes.critical.badge")}
            </div>
          )}
        </div>

        <CardContent className="p-3 space-y-2.5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{img.originalName ?? t("ai.photo.unnamed")}</p>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <span className="text-xs text-slate-400">{img.date}</span>
                {img.category && <Badge variant="secondary" className="text-xs">{t(`imgcat.${img.category}`) || img.category}</Badge>}
                {img.authorName && <span className="text-xs text-slate-400">{img.authorName}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onReanalyze(img.id)} title={t("img.reanalyze.btn.title")}>
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              </Button>
              {isAdmin && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => onDelete(img.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>

          {img.caption && <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5">{img.caption}</p>}

          {/* Tags */}
          {(img.aiTags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {(img.aiTags ?? []).map((tag, i) => (
                <span key={i} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
          )}

          {/* ── CV AI Rich Display ─────────────────────────────────────────── */}
          {img.analysisStatus === "done" && m && (
            <div className="space-y-2.5">
              {/* Risk score badge */}
              <RiskRing score={m.riskScore} />

              {/* Critical alerts */}
              {criticalAlerts.length > 0 && (
                <div className="space-y-1">
                  {criticalAlerts.map((a, i) => (
                    <div key={i} className="text-xs bg-red-50 text-red-700 px-2.5 py-1.5 rounded-lg flex items-start gap-1.5 border border-red-200">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{a.message}
                    </div>
                  ))}
                </div>
              )}
              {warnAlerts.length > 0 && warnAlerts.slice(0, 2).map((a, i) => (
                <div key={i} className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1.5 rounded-lg flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{a.message}
                </div>
              ))}

              {/* Expand toggle */}
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-2.5 py-1.5"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <Brain className="w-3.5 h-3.5" />{t("img.analysis.title")}
                </span>
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {expanded && (
                <div className="space-y-3 bg-gradient-to-br from-slate-50 to-indigo-50/20 border border-indigo-100 rounded-xl p-3">
                  {/* Metrics Grid */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-600 mb-2">{t("img.metrics.title")}</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      <MetricGauge label={t("img.metric.activity")} value={m.activityLevel} icon={<Activity className="w-2.5 h-2.5" />} />
                      <MetricGauge label={t("img.metric.health")} value={m.healthScore} icon={<Shield className="w-2.5 h-2.5" />} />
                      <MetricGauge label={t("img.metric.crowding")} value={m.crowdingScore} higherIsBetter={false} icon={<Zap className="w-2.5 h-2.5" />} />
                      <MetricGauge label={t("img.metric.cleanliness")} value={m.floorCleanliness} icon={<Droplets className="w-2.5 h-2.5" />} />
                      <MetricGauge label={t("img.metric.lighting")} value={m.lightingScore} icon={<Thermometer className="w-2.5 h-2.5" />} />
                      <MetricGauge label={t("img.metric.density")} value={m.densityScore} />
                    </div>
                    {m.estimatedBirdCount > 0 && (
                      <p className="text-[10px] text-slate-500 mt-1.5">
                        🐔 {t("img.birds.estimated")} <strong className="text-slate-700">~{m.estimatedBirdCount}</strong>
                        {m.injuryRisk > 15 && <span className="text-red-600 mr-2">{t("img.injury.risk")} {m.injuryRisk}%</span>}
                      </p>
                    )}
                  </div>

                  {/* Confidence */}
                  {img.aiConfidence != null && <ConfidenceBar value={img.aiConfidence} />}

                  {/* Density Heatmap */}
                  {m.gridData && m.gridData.zones.length > 0 && (
                    <DensityHeatmap zones={m.gridData.zones} rows={m.gridData.rows} cols={m.gridData.cols} />
                  )}

                  {/* Actions from analysis */}
                  {actions.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-600 mb-1.5">{t("img.actions.title")}</p>
                      <div className="space-y-1">
                        {actions.map((a, i) => (
                          <p key={i} className="text-[10px] text-slate-700 leading-relaxed">{a.trim()}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Toggle raw text */}
                  {img.aiAnalysis && (
                    <div>
                      <button
                        onClick={() => setShowRawText(!showRawText)}
                        className="text-[10px] text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
                      >
                        <ChevronDown className={cn("w-3 h-3 transition-transform", showRawText && "rotate-180")} />
                        {showRawText ? t("img.report.hide") : t("img.report.show")}
                      </button>
                      {showRawText && (
                        <pre className="mt-2 text-[9px] text-slate-600 whitespace-pre-wrap bg-white rounded-lg p-2 border border-slate-200 max-h-48 overflow-y-auto font-mono leading-relaxed">
                          {img.aiAnalysis}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* ── Phase 16: Feedback System ──────────────────────────── */}
                  <div className="border-t border-indigo-100 pt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-slate-400">{t("img.cv.label")}</span>
                      <div className="flex items-center gap-2">
                        {feedbackDone && <span className="text-[9px] text-emerald-600 font-medium">{t("img.feedback.done")}</span>}
                        <button
                          onClick={() => setShowFeedback(!showFeedback)}
                          className={cn("text-[10px] flex items-center gap-1 px-2 py-0.5 rounded-full border transition-colors",
                            showFeedback ? "bg-purple-100 text-purple-700 border-purple-200" : "text-purple-500 border-purple-200 hover:bg-purple-50")}
                        >
                          <Star className="w-3 h-3" /> {t("img.feedback.btn")}
                        </button>
                        <button onClick={() => onReanalyze(img.id)} className="text-[10px] text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" />{t("img.reanalyze")}
                        </button>
                      </div>
                    </div>

                    {showFeedback && (
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 space-y-2.5">
                        <p className="text-[10px] font-semibold text-purple-800 flex items-center gap-1">
                          <Star className="w-3 h-3" /> {t("img.feedback.title")}
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-purple-700 block mb-0.5">{t("img.feedback.birdCount")}</label>
                            <Input
                              type="number" min="0" placeholder={m?.estimatedBirdCount ? `~${m.estimatedBirdCount}` : "0"}
                              value={feedbackData.correctedBirdCount}
                              onChange={e => setFeedbackData(p => ({ ...p, correctedBirdCount: e.target.value }))}
                              className="h-7 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-purple-700 block mb-0.5">{t("img.feedback.health")}</label>
                            <Input
                              type="number" min="0" max="100" placeholder={m?.healthScore ? `${m.healthScore}%` : "0-100"}
                              value={feedbackData.correctedHealthScore}
                              onChange={e => setFeedbackData(p => ({ ...p, correctedHealthScore: e.target.value }))}
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] text-purple-700 block mb-0.5">{t("img.feedback.riskLevel")}</label>
                          <div className="flex gap-1 flex-wrap">
                            {(["low","medium","high","critical"] as const).map((v) => {
                              const cls = v === "low" ? "bg-emerald-100 text-emerald-700" : v === "medium" ? "bg-amber-100 text-amber-700" : v === "high" ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700";
                              return (
                                <button key={v} onClick={() => setFeedbackData(p => ({ ...p, correctedRiskLevel: p.correctedRiskLevel === v ? "" : v }))}
                                  className={cn("text-[9px] px-2 py-0.5 rounded-full border transition-all",
                                    feedbackData.correctedRiskLevel === v ? cls + " border-current font-bold" : "border-gray-200 text-gray-500 hover:border-gray-400")}>
                                  {t(`img.risk.level.${v}`)}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] text-purple-700 block mb-0.5">{t("img.feedback.rating")}</label>
                          <div className="flex gap-1">
                            {[1,2,3,4,5].map(s => (
                              <button key={s} onClick={() => setFeedbackData(p => ({ ...p, confidenceRating: s }))}>
                                <Star className={cn("w-4 h-4 transition-colors", feedbackData.confidenceRating >= s ? "text-amber-400 fill-amber-400" : "text-gray-300")} />
                              </button>
                            ))}
                            <span className="text-[9px] text-gray-400 mr-1 self-center">
                              {feedbackData.confidenceRating > 0 ? t(`img.rating.${feedbackData.confidenceRating}`) : ""}
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] text-purple-700 block mb-0.5">{t("img.feedback.notes")}</label>
                          <Textarea
                            placeholder={t("img.feedback.notes.placeholder")}
                            value={feedbackData.notes}
                            onChange={e => setFeedbackData(p => ({ ...p, notes: e.target.value }))}
                            className="text-xs min-h-[50px] resize-none"
                          />
                        </div>

                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setShowFeedback(false)} className="text-[10px] text-gray-500 hover:text-gray-700 px-2 py-1">{t("img.feedback.cancel")}</button>
                          <button
                            onClick={submitFeedback}
                            disabled={feedbackSubmitting || (!feedbackData.correctedBirdCount && !feedbackData.correctedHealthScore && !feedbackData.correctedRiskLevel && !feedbackData.notes && !feedbackData.confidenceRating)}
                            className="text-[10px] bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg flex items-center gap-1 disabled:opacity-50"
                          >
                            {feedbackSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                            {t("img.feedback.submit")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {img.analysisStatus === "done" && !m && img.aiAnalysis && (
            <div className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-2 rounded-lg">
              <Brain className="w-3.5 h-3.5 inline ml-1" />
              {t("img.status.done")} — <button onClick={() => onReanalyze(img.id)} className="mr-2 underline">{t("img.old.reanalyze")}</button>
            </div>
          )}

          {img.analysisStatus === "analyzing" && (
            <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-2.5 py-2 rounded-lg">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {t("img.analyzing.msg")}
            </div>
          )}

          {img.analysisStatus === "failed" && (
            <div className="flex items-center justify-between text-xs text-red-600 bg-red-50 px-2.5 py-2 rounded-lg">
              <span className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{t("img.status.failed")}</span>
              <button onClick={() => onReanalyze(img.id)} className="text-red-700 underline flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />{t("img.failed.retry")}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ─── Upload zone ──────────────────────────────────────────────────────────────
function PhotoUploadZone({
  date,
  onDone,
}: {
  date: string;
  onDone: () => void;
}) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [caption, setCaption] = useState("");
  const [imgCategory, setImgCategory] = useState("general");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!["image/jpeg", "image/png", "image/webp", "image/heic", "image/gif"].includes(file.type)) {
      toast({ title: t("upload.invalid.type"), description: t("upload.invalid.type.desc"), variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: t("upload.too.large"), description: t("upload.too.large.desc"), variant: "destructive" });
      return;
    }
    setUploading(true);
    setProgress(t("upload.uploading"));
    try {
      await uploadFarmPhoto(file, date, imgCategory, caption, lang);
      toast({ title: t("upload.success"), description: t("upload.success.desc") });
      setCaption("");
      onDone();
    } catch (err: any) {
      toast({ title: t("upload.failed"), description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setProgress("");
    }
  }, [date, imgCategory, caption, toast, onDone, t]);

  const imgCategoryLabels: Record<string, string> = {
    general: t("imgcat.general"), health: t("imgcat.health"), production: t("imgcat.production"),
    feeding: t("imgcat.feeding"), incubator: t("imgcat.incubator"), flock: t("imgcat.flock"),
    maintenance: t("imgcat.maintenance"),
  };

  return (
    <Card className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 transition-colors">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-indigo-700">
          <Camera className="w-5 h-5" />
          {t("upload.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Category & Caption */}
        <div className="grid grid-cols-2 gap-2">
          <Select value={imgCategory} onValueChange={setImgCategory}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder={t("upload.category.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(imgCategoryLabels).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            type="text"
            placeholder={t("upload.caption.placeholder")}
            value={caption}
            onChange={e => setCaption(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => !uploading && inputRef.current?.click()}
          className={cn(
            "relative border-2 border-dashed rounded-xl py-8 px-4 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all",
            dragOver ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100",
            uploading && "pointer-events-none opacity-70"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/gif"
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          {uploading ? (
            <>
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
              <p className="text-sm text-indigo-600 font-medium">{progress}</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">{t("upload.drag")}</p>
                <p className="text-xs text-slate-400 mt-1">{t("upload.maxSize")}</p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}>
                  <ImageIcon className="w-3.5 h-3.5" />{t("upload.gallery")}
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8"
                  onClick={e => {
                    e.stopPropagation();
                    if (inputRef.current) { inputRef.current.capture = "environment"; inputRef.current.click(); }
                  }}>
                  <Camera className="w-3.5 h-3.5" />{t("upload.camera")}
                </Button>
              </div>
            </>
          )}
        </div>

        <p className="text-xs text-center text-slate-400">
          {t("upload.aiDesc")}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Smart Analysis Card ──────────────────────────────────────────────────────
interface SmartAnalysisResult {
  summary: string;
  totalSaved: number;
  totalExtracted: number;
  saved: Array<{ type: string; id: number; description: string }>;
}

const TYPE_ICONS: Record<string, string> = {
  hatching_cycle: "🥚", hatching_result: "🐣", transaction: "💰", flock: "🐔", task: "📋",
};
// Maps type → i18n key (keys defined in i18n.ts under smart.*)
const TYPE_LABEL_KEYS: Record<string, string> = {
  hatching_cycle: "smart.hatching_cycle", hatching_result: "smart.hatching_result",
  transaction: "smart.transaction", flock: "smart.flock", task: "smart.task",
};

function SmartAnalysisCard({ loading, result, onDismiss }: {
  loading: boolean; result: SmartAnalysisResult | null; onDismiss: () => void;
}) {
  const { t } = useLanguage();
  if (!loading && !result) return null;

  return (
    <div className="animate-in slide-in-from-top-2 duration-300">
      <Card className="border border-purple-200 dark:border-purple-800/40 bg-purple-50 dark:bg-purple-950/20 shadow-sm overflow-hidden">
        <CardContent className="p-3">
          {loading ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">{t("smart.analyzing")}</p>
                <p className="text-xs text-purple-500">{t("smart.analyzing.desc")}</p>
              </div>
              <Loader2 className="w-4 h-4 animate-spin text-purple-500 mr-auto" />
            </div>
          ) : result ? (
            <>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-purple-700 dark:text-purple-300">
                      {t("smart.done")} — {result.totalSaved} {t("smart.items.saved")}
                    </p>
                    <button onClick={onDismiss} className="text-purple-400 hover:text-purple-600 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">{result.summary}</p>
                  <div className="mt-2 space-y-1">
                    {result.saved.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-purple-700 dark:text-purple-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span className="font-medium">{TYPE_ICONS[item.type]} {t(TYPE_LABEL_KEYS[item.type] ?? item.type)}</span>
                        <ChevronRight className="w-3 h-3 opacity-40" />
                        <span className="text-purple-600 dark:text-purple-400 truncate">{item.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Notes() {
  const { isAdmin } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const [tab, setTab] = useState<"notes" | "photos">("photos");
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [selectedDate, setSelectedDate] = useState(today);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteImageId, setDeleteImageId] = useState<number | null>(null);
  const [smartResult, setSmartResult] = useState<SmartAnalysisResult | null>(null);
  const [smartLoading, setSmartLoading] = useState(false);
  const pendingNoteRef = useRef<{ content: string; date: string } | null>(null);

  // Text notes query
  const { data: notes = [], isLoading: notesLoading } = useQuery({ queryKey: ["notes"], queryFn: fetchNotes });
  // Images query — poll every 3s while analyzing, else every 30s
  const { data: images = [], isLoading: imagesLoading } = useQuery({
    queryKey: ["noteImages"],
    queryFn: () => fetchImages(),
    refetchInterval: (query) => {
      const imgs = query.state.data as NoteImage[] | undefined;
      const hasAnalyzing = imgs?.some(i => i.analysisStatus === "analyzing" || i.analysisStatus === "pending");
      return hasAnalyzing ? 2_500 : 30_000;
    },
  });

  const addNote = useMutation({
    mutationFn: createNote,
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      toast({ title: t("notes.added.toast") });
      setOpen(false);
      const pending = pendingNoteRef.current;
      setContent("");
      pendingNoteRef.current = null;
      // Trigger smart analysis
      if (pending && pending.content.trim().length > 5) {
        setSmartLoading(true);
        setSmartResult(null);
        try {
          const r = await fetch("/api/ai/smart-analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ text: pending.content, date: pending.date, lang }),
          });
          if (r.ok) {
            const data = await r.json();
            if (data.totalSaved > 0) {
              setSmartResult(data);
              qc.invalidateQueries({ queryKey: ["transactions"] });
              qc.invalidateQueries({ queryKey: ["transactions-summary"] });
              qc.invalidateQueries({ queryKey: ["noteImages"] });
            }
          }
        } catch { /* silent */ }
        finally { setSmartLoading(false); }
      }
    },
    onError: () => toast({ title: t("notes.add.error"), variant: "destructive" }),
  });

  const delNote = useMutation({
    mutationFn: deleteNote,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notes"] }); toast({ title: t("notes.deleted.toast") }); setDeleteId(null); },
    onError: () => toast({ title: t("notes.del.error"), variant: "destructive" }),
  });

  const delImage = useMutation({
    mutationFn: deleteImage,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["noteImages"] }); toast({ title: t("notes.img.deleted.toast") }); setDeleteImageId(null); },
    onError: () => toast({ title: t("notes.del.error"), variant: "destructive" }),
  });

  const reanalyze = useMutation({
    mutationFn: (id: number) => reanalyzeImage(id, lang),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["noteImages"] }); toast({ title: t("img.reanalyze.title") }); },
    onError: () => toast({ title: t("img.reanalyze.failed"), variant: "destructive" }),
  });

  // Batch re-analyze all failed images
  const reanalyzeAllFailed = useCallback(async () => {
    const failed = images.filter((img: NoteImage) => img.analysisStatus === "failed");
    if (failed.length === 0) return;
    toast({ title: `${t("img.reanalyze.title")} (${failed.length})` });
    for (const img of failed) {
      await reanalyzeImage(img.id, lang).catch(() => {});
    }
    qc.invalidateQueries({ queryKey: ["noteImages"] });
  }, [images, qc, t, lang]);

  // Stats
  const totalAlerts = images.reduce((acc: number, img: NoteImage) => acc + (img.aiAlerts ?? []).length, 0);
  const criticalCount = images.reduce((acc: number, img: NoteImage) =>
    acc + (img.aiAlerts ?? []).filter(a => a.level === "critical").length, 0);
  const analyzedCount = images.filter((img: NoteImage) => img.analysisStatus === "done").length;
  const failedCount = images.filter((img: NoteImage) => img.analysisStatus === "failed").length;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t("nav.notes")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {images.length} {t("notes.photo.unit")} · {notes.length} {t("notes.note.unit")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <Badge className="bg-red-100 text-red-700 gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />{criticalCount} {t("notes.critical.badge")}
            </Badge>
          )}
        </div>
      </div>

      {/* Alert Summary */}
      {criticalCount > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">
                {criticalCount} {t("notes.critical.msg")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Failed re-analyze banner */}
      {failedCount > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-2.5 px-4">
            <div className="flex items-center justify-between gap-2 text-amber-700">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 shrink-0" />
                <p className="text-sm">{failedCount} {t("notes.failed.prefix")}</p>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100" onClick={reanalyzeAllFailed}>
                {t("notes.reanalyzeAll")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setTab("photos")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            tab === "photos" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <span className="flex items-center gap-2">
            <Camera className="w-4 h-4" />
            {t("notes.photos.tab")}
            {images.length > 0 && (
              <span className="bg-indigo-100 text-indigo-700 text-xs px-1.5 py-0.5 rounded-full">{images.length}</span>
            )}
          </span>
        </button>
        <button
          onClick={() => setTab("notes")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            tab === "notes" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t("notes.text.tab")}
            {notes.length > 0 && (
              <span className="bg-slate-100 text-slate-600 text-xs px-1.5 py-0.5 rounded-full">{notes.length}</span>
            )}
          </span>
        </button>
      </div>

      {/* ─── PHOTOS TAB ─── */}
      {tab === "photos" && (
        <div className="space-y-4">
          {/* Upload zone */}
          <PhotoUploadZone
            date={today}
            onDone={() => qc.invalidateQueries({ queryKey: ["noteImages"] })}
          />

          {/* Stats row */}
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <Card className="text-center py-3">
                <div className="text-2xl font-bold text-indigo-600">{images.length}</div>
                <div className="text-xs text-slate-500">{t("notes.stats.total")}</div>
              </Card>
              <Card className="text-center py-3">
                <div className="text-2xl font-bold text-green-600">{analyzedCount}</div>
                <div className="text-xs text-slate-500">{t("notes.stats.analyzed")}</div>
              </Card>
              <Card className="text-center py-3">
                <div className={cn("text-2xl font-bold", totalAlerts > 0 ? "text-red-600" : "text-slate-400")}>
                  {totalAlerts}
                </div>
                <div className="text-xs text-slate-500">{t("notes.stats.alerts")}</div>
              </Card>
            </div>
          )}

          {/* Image grid */}
          {imagesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
            </div>
          ) : images.length === 0 ? (
            <Card className="py-16 text-center">
              <Camera className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">{t("notes.nophotos")}</p>
              <p className="text-slate-400 text-xs mt-1">{t("notes.nophotos.desc")}</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {images.map((img: NoteImage) => (
                <ImageCard
                  key={img.id}
                  img={img}
                  isAdmin={isAdmin}
                  onDelete={setDeleteImageId}
                  onReanalyze={id => reanalyze.mutate(id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── NOTES TAB ─── */}
      {tab === "notes" && (
        <div className="space-y-4">
          {/* Add note button */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4" />{t("notes.add")}
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>{t("notes.new")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">{t("notes.date.label")}</label>
                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">{t("notes.cat.label")}</label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {NOTE_CATEGORY_KEYS.map(v => (
                          <SelectItem key={v} value={v}>{t(`notecat.${v}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">{t("notes.content.label")}</label>
                  <Textarea
                    placeholder={t("notes.input.placeholder")}
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    className="min-h-[120px] resize-none"
                  />
                </div>
                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2"
                  disabled={!content.trim() || addNote.isPending}
                  onClick={() => {
                    pendingNoteRef.current = { content, date: selectedDate };
                    addNote.mutate({ content, date: selectedDate, category });
                  }}
                >
                  {addNote.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />{t("notes.saving")}</>
                  ) : (
                    <><Sparkles className="w-4 h-4" />{t("notes.save")}</>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Notes list */}
          <SmartAnalysisCard
            loading={smartLoading}
            result={smartResult}
            onDismiss={() => setSmartResult(null)}
          />

          {notesLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : notes.length === 0 ? (
            <Card className="py-16 text-center">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">{t("notes.nonotes")}</p>
              <p className="text-slate-400 text-xs mt-1">{t("notes.nonotes.desc")}</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {notes.map((note: any) => {
                const colors = CATEGORY_COLORS[note.category] ?? CATEGORY_COLORS.general;
                return (
                  <Card key={note.id} className={cn("border", colors.border, "hover:shadow-sm transition-shadow")}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge className={cn("text-xs", colors.bg, colors.text)}>
                              {t(`notecat.${note.category}`) || note.category}
                            </Badge>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />{note.date}
                            </span>
                            {note.authorName && (
                              <span className="text-xs text-slate-400">{note.authorName}</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                        </div>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 shrink-0"
                            onClick={() => setDeleteId(note.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Delete note confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("notes.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("notes.delete.desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteId && delNote.mutate(deleteId)}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete image confirm */}
      <AlertDialog open={deleteImageId !== null} onOpenChange={open => !open && setDeleteImageId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("notes.deleteImg.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("notes.deleteImg.desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteImageId && delImage.mutate(deleteImageId)}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
