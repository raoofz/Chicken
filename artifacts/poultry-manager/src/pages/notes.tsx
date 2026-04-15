/**
 * ملاحظات يومية — Daily Notes + Farm Photos
 * Combined page: text notes & photo uploads with AI vision analysis
 */
import { useState, useRef, useCallback, useEffect } from "react";
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
  Droplets, Zap, TrendingUp, TrendingDown, Minus, BarChart3, Shield
} from "lucide-react";
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
async function reanalyzeImage(id: number) {
  const r = await fetch(`/api/notes/images/${id}/analyze`, { method: "POST", credentials: "include" });
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

const CATEGORY_LABELS: Record<string, string> = {
  general: "عام", health: "صحة", production: "إنتاج",
  feeding: "تغذية", maintenance: "صيانة", observation: "مراقبة",
  incubator: "حاضنة", flock: "قطيع",
};

const IMAGE_CATEGORIES: Record<string, string> = {
  general: "عام", health: "صحة الطيور", production: "إنتاج",
  feeding: "علف وماء", incubator: "حاضنة", flock: "القطيع",
  maintenance: "صيانة",
};

// ─── Upload image helper ──────────────────────────────────────────────────────
async function uploadFarmPhoto(
  file: File,
  date: string,
  category: string,
  caption: string,
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
    throw new Error(e.error ?? "فشل الحصول على رابط الرفع");
  }
  const { uploadURL, objectPath } = await urlRes.json();

  // 2) Upload directly to GCS
  const uploadRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!uploadRes.ok) throw new Error("فشل رفع الصورة إلى التخزين");

  // 3) Save record + trigger AI
  const saveRes = await fetch("/api/notes/images/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ objectPath, originalName: file.name, mimeType: file.type, date, category, caption }),
  });
  if (!saveRes.ok) {
    const e = await saveRes.json().catch(() => ({}));
    throw new Error(e.error ?? "فشل حفظ السجل");
  }
  const { id } = await saveRes.json();
  return { id } as NoteImage;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "done")      return <Badge className="bg-green-100 text-green-700 text-xs gap-1"><CheckCircle className="w-3 h-3"/>تم التحليل</Badge>;
  if (status === "analyzing") return <Badge className="bg-blue-100 text-blue-700 text-xs gap-1"><Loader2 className="w-3 h-3 animate-spin"/>جارٍ التحليل</Badge>;
  if (status === "failed")    return <Badge className="bg-red-100 text-red-700 text-xs gap-1"><AlertTriangle className="w-3 h-3"/>فشل التحليل</Badge>;
  return <Badge className="bg-slate-100 text-slate-600 text-xs gap-1"><Clock className="w-3 h-3"/>في الانتظار</Badge>;
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? "bg-green-500" : value >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-xs text-slate-500">الثقة</span>
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
  const color = score >= 65 ? "text-red-600 bg-red-50 border-red-200" : score >= 35 ? "text-amber-600 bg-amber-50 border-amber-200" : "text-emerald-600 bg-emerald-50 border-emerald-200";
  const label = score >= 65 ? "خطر مرتفع" : score >= 35 ? "تحت المراقبة" : "وضع جيد";
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
      <p className="text-[10px] text-slate-500 font-medium">🗺️ خريطة توزيع الطيور (حرارية)</p>
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {grid.flat().map((zone: any, i) => (
          <div
            key={i}
            className={cn("h-7 rounded-sm opacity-80 transition-opacity hover:opacity-100 cursor-help flex items-center justify-center", zone ? getColor(zone.density) : "bg-slate-200")}
            title={zone ? `${zone.label}: كثافة ${zone.density}% • نشاط ${zone.activity}%` : ""}
          >
            <span className="text-[8px] text-white/90 font-bold drop-shadow">{zone?.density ?? 0}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
        <span className="w-3 h-2 rounded-sm bg-emerald-300 inline-block" />منخفض
        <span className="w-3 h-2 rounded-sm bg-amber-400 inline-block mr-1" />متوسط
        <span className="w-3 h-2 rounded-sm bg-red-600 inline-block mr-1" />مرتفع
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
  const imageFileUrl = `/api/notes/images/file/${img.imageUrl.replace(/^\/objects\//, "")}`;
  const criticalAlerts = (img.aiAlerts ?? []).filter(a => a.level === "critical");
  const warnAlerts = (img.aiAlerts ?? []).filter(a => a.level === "warning");
  const m = img.visualMetrics;

  // Parse operational insights from analysis text
  const insights = img.aiAnalysis
    ? img.aiAnalysis.split("\n")
        .filter(l => l.includes("السبب:") || l.includes("التأثير:") || (l.includes("🔴") && l.includes(":")) || (l.includes("🟠") && l.includes(":")))
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
              خطر: {m.riskScore}/100
            </div>
          )}
          {criticalAlerts.length > 0 && (
            <div className="absolute bottom-2 left-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />{criticalAlerts.length} تنبيه حرج
            </div>
          )}
        </div>

        <CardContent className="p-3 space-y-2.5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{img.originalName ?? "صورة"}</p>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <span className="text-xs text-slate-400">{img.date}</span>
                {img.category && <Badge variant="secondary" className="text-xs">{IMAGE_CATEGORIES[img.category] ?? img.category}</Badge>}
                {img.authorName && <span className="text-xs text-slate-400">{img.authorName}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onReanalyze(img.id)} title="إعادة التحليل">
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
                  <Brain className="w-3.5 h-3.5" />التحليل التفصيلي (CV AI)
                </span>
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {expanded && (
                <div className="space-y-3 bg-gradient-to-br from-slate-50 to-indigo-50/20 border border-indigo-100 rounded-xl p-3">
                  {/* Metrics Grid */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-600 mb-2">📊 المقاييس الدقيقة</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      <MetricGauge label="النشاط الحركي" value={m.activityLevel} icon={<Activity className="w-2.5 h-2.5" />} />
                      <MetricGauge label="الصحة العامة" value={m.healthScore} icon={<Shield className="w-2.5 h-2.5" />} />
                      <MetricGauge label="التكدس" value={m.crowdingScore} higherIsBetter={false} icon={<Zap className="w-2.5 h-2.5" />} />
                      <MetricGauge label="نظافة الأرضية" value={m.floorCleanliness} icon={<Droplets className="w-2.5 h-2.5" />} />
                      <MetricGauge label="الإضاءة" value={m.lightingScore} icon={<Thermometer className="w-2.5 h-2.5" />} />
                      <MetricGauge label="كثافة التوزيع" value={m.densityScore} />
                    </div>
                    {m.estimatedBirdCount > 0 && (
                      <p className="text-[10px] text-slate-500 mt-1.5">
                        🐔 الطيور المرئية تقديراً: <strong className="text-slate-700">~{m.estimatedBirdCount}</strong>
                        {m.injuryRisk > 15 && <span className="text-red-600 mr-2">⚠️ مؤشر إصابة: {m.injuryRisk}%</span>}
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
                      <p className="text-[10px] font-semibold text-slate-600 mb-1.5">💡 ماذا تفعل الآن</p>
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
                        {showRawText ? "إخفاء التقرير الكامل" : "عرض التقرير الكامل"}
                      </button>
                      {showRawText && (
                        <pre className="mt-2 text-[9px] text-slate-600 whitespace-pre-wrap bg-white rounded-lg p-2 border border-slate-200 max-h-48 overflow-y-auto font-mono leading-relaxed">
                          {img.aiAnalysis}
                        </pre>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-indigo-100 pt-2">
                    <span className="text-[9px] text-slate-400">Computer Vision AI — 3 طبقات تحليل</span>
                    <button onClick={() => onReanalyze(img.id)} className="text-[10px] text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> إعادة التحليل
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {img.analysisStatus === "done" && !m && img.aiAnalysis && (
            <div className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-2 rounded-lg">
              <Brain className="w-3.5 h-3.5 inline ml-1" />
              تم التحليل (بيانات قديمة — أعد التحليل لعرض المقاييس الكاملة)
              <button onClick={() => onReanalyze(img.id)} className="mr-2 underline">إعادة التحليل</button>
            </div>
          )}

          {img.analysisStatus === "analyzing" && (
            <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-2.5 py-2 rounded-lg">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              جارٍ التحليل بـ CV AI — طبقة الرؤية + الذكاء + القرار...
            </div>
          )}

          {img.analysisStatus === "failed" && (
            <div className="flex items-center justify-between text-xs text-red-600 bg-red-50 px-2.5 py-2 rounded-lg">
              <span className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />فشل التحليل</span>
              <button onClick={() => onReanalyze(img.id)} className="text-red-700 underline flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />إعادة المحاولة
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
      toast({ title: "نوع غير مدعوم", description: "يُرجى اختيار صورة (JPEG, PNG, WebP, HEIC)", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "الملف كبير جداً", description: "الحد الأقصى 10MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    setProgress("جارٍ رفع الصورة...");
    try {
      await uploadFarmPhoto(file, date, imgCategory, caption);
      toast({ title: "تم رفع الصورة", description: "جارٍ تحليلها بالذكاء الاصطناعي..." });
      setCaption("");
      onDone();
    } catch (err: any) {
      toast({ title: "فشل الرفع", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setProgress("");
    }
  }, [date, imgCategory, caption, toast, onDone]);

  return (
    <Card className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 transition-colors">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-indigo-700">
          <Camera className="w-5 h-5" />
          رفع صورة من المزرعة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Category & Caption */}
        <div className="grid grid-cols-2 gap-2">
          <Select value={imgCategory} onValueChange={setImgCategory}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="الفئة" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(IMAGE_CATEGORIES).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            type="text"
            placeholder="وصف مختصر (اختياري)"
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
                <p className="text-sm font-medium text-slate-700">اسحب صورة هنا أو انقر للاختيار</p>
                <p className="text-xs text-slate-400 mt-1">JPEG, PNG, WebP, HEIC — حتى 10 ميجابايت</p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}>
                  <ImageIcon className="w-3.5 h-3.5" />اختر من المعرض
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8"
                  onClick={e => {
                    e.stopPropagation();
                    if (inputRef.current) { inputRef.current.capture = "environment"; inputRef.current.click(); }
                  }}>
                  <Camera className="w-3.5 h-3.5" />كاميرا
                </Button>
              </div>
            </>
          )}
        </div>

        <p className="text-xs text-center text-slate-400">
          يُحلَّل كل مصور تلقائياً — إضاءة، ألوان، كثافة بصرية + بيانات قطعانك وحاضناتك
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Notes() {
  const { isAdmin } = useAuth();
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notes"] }); toast({ title: "تمت الإضافة" }); setOpen(false); setContent(""); },
    onError: () => toast({ title: "خطأ في الإضافة", variant: "destructive" }),
  });

  const delNote = useMutation({
    mutationFn: deleteNote,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notes"] }); toast({ title: "تم الحذف" }); setDeleteId(null); },
    onError: () => toast({ title: "خطأ في الحذف", variant: "destructive" }),
  });

  const delImage = useMutation({
    mutationFn: deleteImage,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["noteImages"] }); toast({ title: "تم حذف الصورة" }); setDeleteImageId(null); },
    onError: () => toast({ title: "خطأ في الحذف", variant: "destructive" }),
  });

  const reanalyze = useMutation({
    mutationFn: reanalyzeImage,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["noteImages"] }); toast({ title: "جارٍ إعادة التحليل..." }); },
    onError: () => toast({ title: "فشل إعادة التحليل", variant: "destructive" }),
  });

  // Batch re-analyze all failed images
  const reanalyzeAllFailed = useCallback(async () => {
    const failed = images.filter((img: NoteImage) => img.analysisStatus === "failed");
    if (failed.length === 0) return;
    toast({ title: `إعادة تحليل ${failed.length} صورة...` });
    for (const img of failed) {
      await reanalyzeImage(img.id).catch(() => {});
    }
    qc.invalidateQueries({ queryKey: ["noteImages"] });
  }, [images, qc]);

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
          <h1 className="text-2xl font-bold text-slate-800">ملاحظات يومية</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {images.length} صورة · {notes.length} ملاحظة نصية
          </p>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <Badge className="bg-red-100 text-red-700 gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />{criticalCount} تنبيه حرج
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
                تم اكتشاف {criticalCount} تنبيه حرج في صور المزرعة — تحقق من الصور أدناه
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
                <p className="text-sm">{failedCount} صورة لم تُحلَّل بعد</p>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100" onClick={reanalyzeAllFailed}>
                إعادة تحليلها الآن
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
            صور المزرعة
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
            الملاحظات النصية
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
                <div className="text-xs text-slate-500">إجمالي الصور</div>
              </Card>
              <Card className="text-center py-3">
                <div className="text-2xl font-bold text-green-600">{analyzedCount}</div>
                <div className="text-xs text-slate-500">تم تحليلها</div>
              </Card>
              <Card className="text-center py-3">
                <div className={cn("text-2xl font-bold", totalAlerts > 0 ? "text-red-600" : "text-slate-400")}>
                  {totalAlerts}
                </div>
                <div className="text-xs text-slate-500">تنبيه مكتشف</div>
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
              <p className="text-slate-500 text-sm">لا توجد صور بعد</p>
              <p className="text-slate-400 text-xs mt-1">ارفع أول صورة من المزرعة باستخدام الأداة أعلاه</p>
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
                <Plus className="w-4 h-4" />إضافة ملاحظة
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>ملاحظة جديدة</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">التاريخ</label>
                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">الفئة</label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">الملاحظة</label>
                  <Textarea
                    placeholder="اكتب ملاحظتك هنا..."
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    className="min-h-[120px] resize-none"
                  />
                </div>
                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                  disabled={!content.trim() || addNote.isPending}
                  onClick={() => addNote.mutate({ content, date: selectedDate, category })}
                >
                  {addNote.isPending ? "جارٍ الحفظ..." : "حفظ الملاحظة"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Notes list */}
          {notesLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : notes.length === 0 ? (
            <Card className="py-16 text-center">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">لا توجد ملاحظات بعد</p>
              <p className="text-slate-400 text-xs mt-1">أضف أول ملاحظة يومية للمزرعة</p>
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
                              {CATEGORY_LABELS[note.category] ?? note.category}
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
            <AlertDialogTitle>حذف الملاحظة؟</AlertDialogTitle>
            <AlertDialogDescription>هذا الإجراء لا يمكن التراجع عنه.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteId && delNote.mutate(deleteId)}>
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete image confirm */}
      <AlertDialog open={deleteImageId !== null} onOpenChange={open => !open && setDeleteImageId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الصورة؟</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف الصورة وتحليلها نهائياً.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteImageId && delImage.mutate(deleteImageId)}>
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
