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
  MessageSquare, Loader2, ChevronDown, ChevronUp
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
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const imageFileUrl = `/api/notes/images/file/${img.imageUrl.replace(/^\/objects\//, "")}`;
  const hasAlerts = (img.aiAlerts ?? []).length > 0;
  const criticalAlerts = (img.aiAlerts ?? []).filter(a => a.level === "critical");

  return (
    <>
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setLightbox(false)}
        >
          <button className="absolute top-4 right-4 text-white" onClick={() => setLightbox(false)}>
            <X className="w-8 h-8" />
          </button>
          <img src={imageFileUrl} alt={img.originalName} className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl" />
        </div>
      )}

      <Card className={cn(
        "overflow-hidden border transition-shadow hover:shadow-md",
        criticalAlerts.length > 0 ? "border-red-300" : ""
      )}>
        {/* Image */}
        <div className="relative aspect-video bg-slate-100 cursor-pointer group" onClick={() => setLightbox(true)}>
          <img
            src={imageFileUrl}
            alt={img.originalName}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="absolute top-2 right-2">
            <StatusBadge status={img.analysisStatus} />
          </div>
          {criticalAlerts.length > 0 && (
            <div className="absolute bottom-2 left-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />تنبيه
            </div>
          )}
        </div>

        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{img.originalName ?? "صورة"}</p>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span className="text-xs text-slate-400">{img.date}</span>
                {img.category && (
                  <Badge variant="secondary" className="text-xs">
                    {IMAGE_CATEGORIES[img.category] ?? img.category}
                  </Badge>
                )}
                {img.authorName && <span className="text-xs text-slate-400">بواسطة {img.authorName}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {img.analysisStatus === "failed" && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onReanalyze(img.id)} title="إعادة التحليل">
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                </Button>
              )}
              {isAdmin && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => onDelete(img.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>

          {img.caption && (
            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5">{img.caption}</p>
          )}

          {/* Tags */}
          {(img.aiTags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {(img.aiTags ?? []).map((tag, i) => (
                <span key={i} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
          )}

          {/* Confidence */}
          {img.aiConfidence != null && img.analysisStatus === "done" && (
            <ConfidenceBar value={img.aiConfidence} />
          )}

          {/* Alerts */}
          {hasAlerts && (
            <div className="space-y-1">
              {(img.aiAlerts ?? []).map((alert, i) => (
                <div key={i} className={cn(
                  "text-xs flex items-start gap-1.5 px-2 py-1.5 rounded-lg",
                  alert.level === "critical" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                )}>
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  {alert.message}
                </div>
              ))}
            </div>
          )}

          {/* AI Analysis */}
          {img.aiAnalysis && img.analysisStatus === "done" && (
            <div>
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <Brain className="w-3.5 h-3.5" />
                {expanded ? "إخفاء التحليل" : "عرض تحليل الذكاء الاصطناعي"}
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {expanded && (
                <div className="mt-2 text-xs text-slate-700 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl px-3 py-2.5 leading-relaxed whitespace-pre-wrap">
                  {img.aiAnalysis}
                </div>
              )}
            </div>
          )}

          {img.analysisStatus === "analyzing" && (
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              جارٍ تحليل الصورة بالذكاء الاصطناعي...
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
          سيتم تحليل الصورة تلقائياً بالذكاء الاصطناعي لاكتشاف أي مشاكل
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
  // Images query — poll every 10s to catch analysis completion
  const { data: images = [], isLoading: imagesLoading } = useQuery({
    queryKey: ["noteImages"],
    queryFn: () => fetchImages(),
    refetchInterval: 10_000,
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

  // Stats
  const totalAlerts = images.reduce((acc: number, img: NoteImage) => acc + (img.aiAlerts ?? []).length, 0);
  const criticalCount = images.reduce((acc: number, img: NoteImage) =>
    acc + (img.aiAlerts ?? []).filter(a => a.level === "critical").length, 0);
  const analyzedCount = images.filter((img: NoteImage) => img.analysisStatus === "done").length;

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
