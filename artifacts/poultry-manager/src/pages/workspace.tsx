/**
 * Workspace — مساحة العمل اليومية / Daglig arbetsyta
 *
 * Unifies three previously separate sections into one operational tool:
 *   • Activity logs (سجل النشاط)
 *   • Daily notes  (الملاحظات اليومية)
 *   • Goals        (الأهداف)
 *
 * Backed by `/api/workspace/feed`, `/api/workspace/summary`,
 * and `/api/workspace/goal-activity/:id`. Uses the existing per-resource
 * write endpoints (POST /activity-logs, POST /notes, POST/PUT/DELETE /goals).
 *
 * Cross-link: every log AND note can carry an optional `goalId`, which the
 * backend uses to attribute work to a goal. Logs may also include a
 * `progressDelta` to advance the goal's `currentValue` atomically.
 */
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Target, BookOpen, FileText, CheckCircle2, AlertTriangle,
  Calendar, ChevronDown, ChevronRight, Trash2, Pencil, Link2,
  Activity as ActivityIcon, ListChecks, Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FeedEntry {
  kind: "log" | "note";
  id: number;
  date: string;
  category: string;
  title: string;
  content: string | null;
  goalId: number | null;
  authorName: string | null;
  createdAt: string;
}
interface Goal {
  id: number;
  title: string;
  description?: string | null;
  targetValue: number;
  currentValue: number;
  unit: string;
  category: string;
  deadline: string | null;
  completed: boolean;
}
interface Summary {
  logs:  { today: number; week: number };
  notes: { today: number; week: number };
  goals: { active: number; achieved: number; atRisk: number; total: number };
}

// ─── Categories ───────────────────────────────────────────────────────────────
const LOG_CATS  = ["feeding","health","hatching","cleaning","observation","other"] as const;
const NOTE_CATS = ["general","health","production","feeding","maintenance","observation"] as const;
const GOAL_CATS = ["production","health","growth","financial","other"] as const;

const CAT_TONE: Record<string, { dot: string; text: string; bg: string }> = {
  feeding:     { dot: "bg-amber-500",   text: "text-amber-700",   bg: "bg-amber-50" },
  health:      { dot: "bg-red-500",     text: "text-red-700",     bg: "bg-red-50" },
  hatching:    { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" },
  cleaning:    { dot: "bg-blue-500",    text: "text-blue-700",    bg: "bg-blue-50" },
  observation: { dot: "bg-violet-500",  text: "text-violet-700",  bg: "bg-violet-50" },
  general:     { dot: "bg-slate-500",   text: "text-slate-700",   bg: "bg-slate-50" },
  production:  { dot: "bg-orange-500",  text: "text-orange-700",  bg: "bg-orange-50" },
  growth:      { dot: "bg-teal-500",    text: "text-teal-700",    bg: "bg-teal-50" },
  financial:   { dot: "bg-purple-500",  text: "text-purple-700",  bg: "bg-purple-50" },
  maintenance: { dot: "bg-cyan-500",    text: "text-cyan-700",    bg: "bg-cyan-50" },
  other:       { dot: "bg-gray-500",    text: "text-gray-700",    bg: "bg-gray-50" },
};
const tone = (c: string) => CAT_TONE[c] ?? CAT_TONE.other;

// ─── API helpers (raw fetch, matches existing notes.tsx pattern) ──────────────
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: "include", ...init });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text().catch(() => "")}`);
  if (r.status === 204) return undefined as T;
  return r.json();
}
const fetchFeed    = (params: string) => api<FeedEntry[]>(`/api/workspace/feed${params}`);
const fetchSummary = ()                => api<Summary>("/api/workspace/summary");
const fetchGoals   = ()                => api<Goal[]>("/api/goals");

// ─── Top KPI strip ────────────────────────────────────────────────────────────
function KPIStrip({ s, ar }: { s: Summary | undefined; ar: boolean }) {
  if (!s) return <Skeleton className="h-20 w-full rounded-xl" />;
  const items = [
    { icon: ActivityIcon, label: ar ? "نشاط اليوم"   : "Aktivitet idag",  value: s.logs.today,    sub: ar ? `${s.logs.week} هذا الأسبوع` : `${s.logs.week} denna vecka`,  tone: "bg-blue-50 text-blue-700 border-blue-200" },
    { icon: FileText,     label: ar ? "ملاحظات اليوم" : "Anteckningar idag", value: s.notes.today,  sub: ar ? `${s.notes.week} هذا الأسبوع` : `${s.notes.week} denna vecka`, tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    { icon: Target,       label: ar ? "أهداف نشطة"   : "Aktiva mål",       value: s.goals.active,  sub: ar ? `${s.goals.achieved} محقق`    : `${s.goals.achieved} uppnådda`,  tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { icon: AlertTriangle,label: ar ? "أهداف تقترب من الموعد" : "Mål nära deadline", value: s.goals.atRisk, sub: ar ? "خلال 7 أيام" : "Inom 7 dagar", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
      {items.map((it, i) => (
        <Card key={i} className={cn("border", it.tone)}>
          <CardContent className="p-3 flex items-start gap-2.5">
            <it.icon className="w-4 h-4 mt-0.5 shrink-0 opacity-80" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium opacity-80 truncate">{it.label}</p>
              <p className="text-xl font-bold leading-none mt-0.5">{it.value}</p>
              <p className="text-[10px] opacity-70 mt-1 truncate">{it.sub}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Quick Add dialog (note OR log, both can link to a goal) ──────────────────
function QuickAddDialog({
  open, onOpenChange, goals, presetType, presetGoalId, onSuccess, ar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  goals: Goal[];
  presetType?: "log" | "note";
  presetGoalId?: number | null;
  onSuccess: () => void;
  ar: boolean;
}) {
  const today = new Date().toISOString().split("T")[0];
  const { toast } = useToast();
  const [type,    setType]    = useState<"log" | "note">(presetType ?? "log");
  const [title,   setTitle]   = useState("");
  const [content, setContent] = useState("");
  const [date,    setDate]    = useState(today);
  const [category,setCategory]= useState<string>(presetType === "note" ? "general" : "observation");
  const [goalId,  setGoalId]  = useState<string>(presetGoalId ? String(presetGoalId) : "");
  const [delta,   setDelta]   = useState<string>("");
  const [saving,  setSaving]  = useState(false);

  // Reset internal state whenever the dialog re-opens
  useEffect(() => {
    if (open) {
      setType(presetType ?? "log");
      setTitle("");
      setContent("");
      setDate(today);
      setCategory(presetType === "note" ? "general" : "observation");
      setGoalId(presetGoalId ? String(presetGoalId) : "");
      setDelta("");
    }
  }, [open, presetType, presetGoalId, today]);

  const linkedGoal = goalId ? goals.find(g => g.id === Number(goalId)) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      if (type === "log") {
        if (!title.trim()) { toast({ title: ar ? "العنوان مطلوب" : "Titel krävs", variant: "destructive" }); setSaving(false); return; }
        await api("/api/activity-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: content.trim() || null,
            category, date,
            goalId: goalId ? Number(goalId) : null,
            progressDelta: goalId && delta ? Number(delta) : null,
          }),
        });
      } else {
        if (!content.trim()) { toast({ title: ar ? "المحتوى مطلوب" : "Innehåll krävs", variant: "destructive" }); setSaving(false); return; }
        await api("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: content.trim(), date, category,
            goalId: goalId ? Number(goalId) : null,
          }),
        });
      }
      toast({ title: ar ? "تم الحفظ" : "Sparad" });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: ar ? "فشل الحفظ" : "Misslyckades", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const cats = type === "log" ? LOG_CATS : NOTE_CATS;
  const catLabels: Record<string, { ar: string; sv: string }> = {
    feeding:     { ar: "تغذية",   sv: "Utfodring" },
    health:      { ar: "صحة",     sv: "Hälsa" },
    hatching:    { ar: "تفقيس",   sv: "Kläckning" },
    cleaning:    { ar: "تنظيف",   sv: "Rengöring" },
    observation: { ar: "ملاحظة",  sv: "Observation" },
    other:       { ar: "أخرى",    sv: "Övrigt" },
    general:     { ar: "عام",     sv: "Allmänt" },
    production:  { ar: "إنتاج",   sv: "Produktion" },
    maintenance: { ar: "صيانة",   sv: "Underhåll" },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={ar ? "rtl" : "ltr"} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            {ar ? "إضافة سريعة" : "Snabbtillägg"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("log")}
              className={cn("rounded-lg border p-2.5 flex items-center justify-center gap-2 text-sm font-medium transition",
                type === "log" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted")}
            >
              <ActivityIcon className="w-3.5 h-3.5" />
              {ar ? "نشاط" : "Aktivitet"}
            </button>
            <button
              type="button"
              onClick={() => setType("note")}
              className={cn("rounded-lg border p-2.5 flex items-center justify-center gap-2 text-sm font-medium transition",
                type === "note" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted")}
            >
              <FileText className="w-3.5 h-3.5" />
              {ar ? "ملاحظة" : "Anteckning"}
            </button>
          </div>

          {/* Title (logs only) */}
          {type === "log" && (
            <div className="space-y-1.5">
              <Label className="text-xs">{ar ? "العنوان" : "Titel"}</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)}
                placeholder={ar ? "مثال: رش مبيد على القفص ٣" : "T.ex. Sprutade ströbädd"} required />
            </div>
          )}

          {/* Content / description */}
          <div className="space-y-1.5">
            <Label className="text-xs">{type === "log" ? (ar ? "تفاصيل (اختياري)" : "Detaljer (valfritt)") : (ar ? "المحتوى" : "Innehåll")}</Label>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={type === "log" ? 2 : 4}
              placeholder={type === "log"
                ? (ar ? "ماذا حدث بالضبط..." : "Vad hände exakt...")
                : (ar ? "اكتب الملاحظة..." : "Skriv anteckning...")}
              required={type === "note"}
            />
          </div>

          {/* Date + Category */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{ar ? "التاريخ" : "Datum"}</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{ar ? "التصنيف" : "Kategori"}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cats.map(c => (
                    <SelectItem key={c} value={c}>
                      {ar ? (catLabels[c]?.ar ?? c) : (catLabels[c]?.sv ?? c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Link to goal (optional) */}
          <div className="space-y-1.5 rounded-lg border border-dashed p-2.5 bg-muted/30">
            <Label className="text-xs flex items-center gap-1.5">
              <Link2 className="w-3 h-3" />
              {ar ? "اربط بهدف (اختياري)" : "Koppla till mål (valfritt)"}
            </Label>
            <Select value={goalId || "none"} onValueChange={v => setGoalId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder={ar ? "بدون هدف" : "Inget mål"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{ar ? "بدون" : "Inget"}</SelectItem>
                {goals.filter(g => !g.completed).map(g => (
                  <SelectItem key={g.id} value={String(g.id)}>{g.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Progress delta — only meaningful for logs linked to a goal */}
            {type === "log" && linkedGoal && (
              <div className="pt-1.5 space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">
                  {ar ? `إضافة للتقدم (${linkedGoal.unit})` : `Lägg till i framsteg (${linkedGoal.unit})`}
                </Label>
                <Input type="number" step="0.1" value={delta} onChange={e => setDelta(e.target.value)}
                  placeholder={ar ? "مثال: ٥٠" : "T.ex. 50"} />
                <p className="text-[10px] text-muted-foreground">
                  {ar
                    ? `الحالي ${linkedGoal.currentValue}/${linkedGoal.targetValue} ${linkedGoal.unit}`
                    : `Aktuellt ${linkedGoal.currentValue}/${linkedGoal.targetValue} ${linkedGoal.unit}`}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {ar ? "إلغاء" : "Avbryt"}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (ar ? "...يحفظ" : "Sparar...") : (ar ? "حفظ" : "Spara")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Goal form (create / edit) ────────────────────────────────────────────────
function GoalDialog({
  open, onOpenChange, initial, onSaved, ar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Goal | null;
  onSaved: () => void;
  ar: boolean;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: "", description: "", targetValue: 100, currentValue: 0, unit: "",
    category: "production", deadline: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        title:        initial?.title ?? "",
        description:  initial?.description ?? "",
        targetValue:  initial?.targetValue ?? 100,
        currentValue: initial?.currentValue ?? 0,
        unit:         initial?.unit ?? "",
        category:     initial?.category ?? "production",
        deadline:     initial?.deadline ?? "",
      });
    }
  }, [open, initial]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        description: form.description || null,
        targetValue: Number(form.targetValue),
        currentValue: Number(form.currentValue),
        unit: form.unit,
        category: form.category,
        deadline: form.deadline || null,
      };
      if (initial) {
        await api(`/api/goals/${initial.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await api("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      toast({ title: ar ? "تم الحفظ" : "Sparad" });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: ar ? "فشل الحفظ" : "Misslyckades", description: err?.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  const catLabels: Record<string, { ar: string; sv: string }> = {
    production: { ar: "إنتاج",   sv: "Produktion" },
    health:     { ar: "صحة",     sv: "Hälsa" },
    growth:     { ar: "نمو",     sv: "Tillväxt" },
    financial:  { ar: "مالي",    sv: "Ekonomi" },
    other:      { ar: "أخرى",    sv: "Övrigt" },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={ar ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>{initial ? (ar ? "تعديل هدف" : "Redigera mål") : (ar ? "هدف جديد" : "Nytt mål")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{ar ? "العنوان" : "Titel"}</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={ar ? "مثال: إنتاج 1000 بيضة هذا الشهر" : "T.ex. 1000 ägg denna månad"} required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{ar ? "القيمة المستهدفة" : "Målvärde"}</Label>
              <Input type="number" step="0.1" value={form.targetValue}
                onChange={e => setForm(f => ({ ...f, targetValue: Number(e.target.value) }))} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{ar ? "القيمة الحالية" : "Aktuellt värde"}</Label>
              <Input type="number" step="0.1" value={form.currentValue}
                onChange={e => setForm(f => ({ ...f, currentValue: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{ar ? "الوحدة" : "Enhet"}</Label>
              <Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                placeholder={ar ? "بيضة، كجم، ..." : "ägg, kg, ..."} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{ar ? "التصنيف" : "Kategori"}</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOAL_CATS.map(c => (
                    <SelectItem key={c} value={c}>{ar ? catLabels[c].ar : catLabels[c].sv}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{ar ? "الموعد النهائي (اختياري)" : "Slutdatum (valfritt)"}</Label>
            <Input type="date" value={form.deadline}
              onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {ar ? "إلغاء" : "Avbryt"}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (ar ? "...يحفظ" : "Sparar...") : (ar ? "حفظ" : "Spara")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Feed item (used in Timeline tab and Goal expansion) ─────────────────────
function FeedItem({
  item, goalsById, ar, onDelete,
}: {
  item: FeedEntry;
  goalsById: Map<number, Goal>;
  ar: boolean;
  onDelete?: () => void;
}) {
  const t = tone(item.category);
  const linkedGoal = item.goalId ? goalsById.get(item.goalId) : null;

  return (
    <div className={cn("rounded-lg border p-3 bg-card hover:shadow-sm transition flex gap-3")}>
      <div className={cn("w-1 self-stretch rounded-full shrink-0", t.dot)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-wide border-0", t.bg, t.text)}>
              {item.kind === "log" ? (ar ? "نشاط" : "Aktivitet") : (ar ? "ملاحظة" : "Anteckning")}
            </Badge>
            <span className={cn("text-[11px] font-medium", t.text)}>{item.category}</span>
          </div>
          {onDelete && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        <p className="font-semibold text-sm leading-tight">{item.title}</p>
        {item.content && item.kind === "note" && (
          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">{item.content}</p>
        )}
        {item.content && item.kind === "log" && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.content}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{item.date}</span>
          {item.authorName && <span>· {item.authorName}</span>}
          {linkedGoal && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              <Link2 className="w-3 h-3" />
              {linkedGoal.title}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Goal card (with linked activity expand) ──────────────────────────────────
function GoalCard({
  goal, allFeed, ar, onEdit, onDelete, onLogProgress,
}: {
  goal: Goal;
  allFeed: FeedEntry[];
  ar: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onLogProgress: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const linked = useMemo(() => allFeed.filter(e => e.goalId === goal.id), [allFeed, goal.id]);
  const pct = Math.min(100, Math.round((goal.currentValue / Math.max(goal.targetValue, 1)) * 100));
  const overdue = goal.deadline && !goal.completed && goal.deadline < new Date().toISOString().slice(0, 10);

  return (
    <Card className={cn("transition", goal.completed && "border-emerald-200 bg-emerald-50/30")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {goal.completed && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              <h3 className="font-semibold text-sm">{goal.title}</h3>
              <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", tone(goal.category).bg, tone(goal.category).text)}>
                {goal.category}
              </span>
              {overdue && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700 flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {ar ? "متأخر" : "Försenad"}
                </span>
              )}
            </div>
            {goal.deadline && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {ar ? "الموعد:" : "Slutdatum:"} {goal.deadline}
              </p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            {!goal.completed && (
              <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" onClick={onLogProgress}>
                <Plus className="w-3 h-3 me-1" />
                {ar ? "سجّل تقدم" : "Logga"}
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="w-3 h-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-3">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-muted-foreground">{goal.currentValue} / {goal.targetValue} {goal.unit}</span>
            <span className="font-bold text-primary">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full transition-all", goal.completed ? "bg-emerald-500" : "bg-primary")}
              style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Linked activity expander */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full mt-3 flex items-center justify-between text-[11px] font-medium text-muted-foreground hover:text-foreground transition"
        >
          <span className="flex items-center gap-1.5">
            <Link2 className="w-3 h-3" />
            {ar ? `النشاط المرتبط (${linked.length})` : `Kopplad aktivitet (${linked.length})`}
          </span>
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className={cn("w-3.5 h-3.5", ar && "rotate-180")} />}
        </button>

        {expanded && (
          <div className="mt-2 space-y-1.5 pt-2 border-t">
            {linked.length === 0 ? (
              <p className="text-[11px] text-muted-foreground text-center py-2">
                {ar ? "لا يوجد نشاط مرتبط بعد. اضغط \"سجّل تقدم\" لإضافة." : "Ingen kopplad aktivitet än."}
              </p>
            ) : (
              linked.slice(0, 8).map(e => (
                <div key={`${e.kind}-${e.id}`} className="flex items-start gap-2 text-[11px] p-1.5 rounded bg-muted/40">
                  <span className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", tone(e.category).dot)} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{e.title}</p>
                    <p className="text-muted-foreground text-[10px]">{e.date} · {e.kind === "log" ? (ar ? "نشاط" : "Akt") : (ar ? "ملاحظة" : "Ant")}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Workspace() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const { toast } = useToast();

  // Read tab from query string for backward-compat with old /goals, /logs, /notes
  const initialTab: "timeline" | "goals" =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "goals"
      ? "goals" : "timeline";
  const [tab, setTab] = useState<"timeline" | "goals">(initialTab);
  const [filterType, setFilterType] = useState<"all" | "log" | "note">("all");
  const [days,       setDays]       = useState<number>(14);

  // Quick-add state
  const [addOpen,        setAddOpen]        = useState(false);
  const [addPresetType,  setAddPresetType]  = useState<"log" | "note">("log");
  const [addPresetGoal,  setAddPresetGoal]  = useState<number | null>(null);

  // Goal CRUD state
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingGoal,    setEditingGoal]    = useState<Goal | null>(null);

  // Delete confirmations
  const [deleteEntry, setDeleteEntry] = useState<{ kind: "log" | "note" | "goal"; id: number } | null>(null);

  // ── Queries ──
  const feedParams = `?days=${days}&type=${filterType}&limit=300`;
  const { data: feed = [],    isLoading: feedLoading }  = useQuery({ queryKey: ["workspace-feed", days, filterType], queryFn: () => fetchFeed(feedParams) });
  const { data: summary,      isLoading: sumLoading }   = useQuery({ queryKey: ["workspace-summary"],                queryFn: fetchSummary });
  const { data: goals = [],   isLoading: goalsLoading } = useQuery({ queryKey: ["goals"],                            queryFn: fetchGoals });

  const goalsById = useMemo(() => new Map(goals.map(g => [g.id, g])), [goals]);
  const activeGoals    = goals.filter(g => !g.completed);
  const completedGoals = goals.filter(g => g.completed);

  function refreshAll() {
    qc.invalidateQueries({ queryKey: ["workspace-feed"] });
    qc.invalidateQueries({ queryKey: ["workspace-summary"] });
    qc.invalidateQueries({ queryKey: ["goals"] });
  }

  async function confirmDelete() {
    if (!deleteEntry) return;
    const { kind, id } = deleteEntry;
    const url = kind === "log"  ? `/api/activity-logs/${id}`
              : kind === "note" ? `/api/notes/${id}`
              :                   `/api/goals/${id}`;
    try {
      await api(url, { method: "DELETE" });
      toast({ title: ar ? "تم الحذف" : "Borttaget" });
      refreshAll();
    } catch (err: any) {
      toast({ title: ar ? "فشل الحذف" : "Borttagning misslyckades", description: err?.message, variant: "destructive" });
    } finally {
      setDeleteEntry(null);
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300 pb-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <ListChecks className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">
              {ar ? "مساحة العمل اليومية" : "Daglig arbetsyta"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ar ? "نشاط، ملاحظات، وأهداف — في تدفق واحد" : "Aktivitet, anteckningar och mål — i ett flöde"}
            </p>
          </div>
        </div>
        <Button onClick={() => { setAddPresetType("log"); setAddPresetGoal(null); setAddOpen(true); }}
          className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-none">
          <Plus className="w-4 h-4" />
          {ar ? "إضافة" : "Lägg till"}
        </Button>
      </div>

      {/* ── KPI Strip ───────────────────────────────────────────────── */}
      {sumLoading ? <Skeleton className="h-20 w-full rounded-xl" /> : <KPIStrip s={summary} ar={ar} />}

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setTab("timeline")}
          className={cn("px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition flex items-center gap-2",
            tab === "timeline" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
        >
          <ActivityIcon className="w-3.5 h-3.5" />
          {ar ? "الخط الزمني" : "Tidslinje"}
        </button>
        <button
          onClick={() => setTab("goals")}
          className={cn("px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition flex items-center gap-2",
            tab === "goals" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
        >
          <Target className="w-3.5 h-3.5" />
          {ar ? "الأهداف" : "Mål"}
          {activeGoals.length > 0 && (
            <span className="text-[10px] bg-primary/10 text-primary rounded-full px-1.5 py-0.5">{activeGoals.length}</span>
          )}
        </button>
      </div>

      {/* ── TIMELINE TAB ────────────────────────────────────────────── */}
      {tab === "timeline" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "الكل" : "Alla"}</SelectItem>
                <SelectItem value="log">{ar ? "نشاط فقط" : "Endast aktivitet"}</SelectItem>
                <SelectItem value="note">{ar ? "ملاحظات فقط" : "Endast anteckningar"}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(days)} onValueChange={v => setDays(Number(v))}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">{ar ? "آخر 7 أيام" : "Senaste 7 dagarna"}</SelectItem>
                <SelectItem value="14">{ar ? "آخر 14 يوم" : "Senaste 14 dagarna"}</SelectItem>
                <SelectItem value="30">{ar ? "آخر 30 يوم" : "Senaste 30 dagarna"}</SelectItem>
                <SelectItem value="90">{ar ? "آخر 90 يوم" : "Senaste 90 dagarna"}</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-[11px] text-muted-foreground ms-auto">{feed.length} {ar ? "عنصر" : "objekt"}</span>
          </div>

          {/* Grouped feed by date */}
          {feedLoading ? (
            <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>
          ) : feed.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{ar ? "لا يوجد نشاط بعد" : "Ingen aktivitet ännu"}</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">{ar ? "اضغط \"إضافة\" لتسجيل أول نشاط أو ملاحظة" : "Klicka \"Lägg till\" för att börja"}</p>
              </CardContent>
            </Card>
          ) : (
            (() => {
              const byDate = new Map<string, FeedEntry[]>();
              feed.forEach(e => {
                if (!byDate.has(e.date)) byDate.set(e.date, []);
                byDate.get(e.date)!.push(e);
              });
              return Array.from(byDate.entries()).map(([date, items]) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{date}</h2>
                    <span className="text-[10px] text-muted-foreground">({items.length})</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="space-y-2">
                    {items.map(item => (
                      <FeedItem
                        key={`${item.kind}-${item.id}`}
                        item={item}
                        goalsById={goalsById}
                        ar={ar}
                        onDelete={() => setDeleteEntry({ kind: item.kind, id: item.id })}
                      />
                    ))}
                  </div>
                </div>
              ));
            })()
          )}
        </div>
      )}

      {/* ── GOALS TAB ───────────────────────────────────────────────── */}
      {tab === "goals" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {activeGoals.length} {ar ? "نشط" : "aktiva"} · {completedGoals.length} {ar ? "محقق" : "uppnådda"}
            </p>
            <Button size="sm" onClick={() => { setEditingGoal(null); setGoalDialogOpen(true); }} className="gap-1.5 h-8">
              <Plus className="w-3.5 h-3.5" />
              {ar ? "هدف جديد" : "Nytt mål"}
            </Button>
          </div>

          {goalsLoading ? (
            <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}</div>
          ) : goals.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Target className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{ar ? "لا توجد أهداف بعد" : "Inga mål ännu"}</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {activeGoals.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {ar ? "أهداف نشطة" : "Aktiva mål"}
                  </h2>
                  {activeGoals.map(g => (
                    <GoalCard
                      key={g.id} goal={g} allFeed={feed} ar={ar}
                      onEdit={() => { setEditingGoal(g); setGoalDialogOpen(true); }}
                      onDelete={() => setDeleteEntry({ kind: "goal", id: g.id })}
                      onLogProgress={() => { setAddPresetType("log"); setAddPresetGoal(g.id); setAddOpen(true); }}
                    />
                  ))}
                </div>
              )}
              {completedGoals.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {ar ? "أهداف محققة" : "Uppnådda mål"}
                  </h2>
                  {completedGoals.map(g => (
                    <GoalCard
                      key={g.id} goal={g} allFeed={feed} ar={ar}
                      onEdit={() => { setEditingGoal(g); setGoalDialogOpen(true); }}
                      onDelete={() => setDeleteEntry({ kind: "goal", id: g.id })}
                      onLogProgress={() => { setAddPresetType("log"); setAddPresetGoal(g.id); setAddOpen(true); }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Dialogs */}
      <QuickAddDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        goals={goals}
        presetType={addPresetType}
        presetGoalId={addPresetGoal}
        onSuccess={refreshAll}
        ar={ar}
      />
      <GoalDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        initial={editingGoal}
        onSaved={refreshAll}
        ar={ar}
      />
      <AlertDialog open={deleteEntry != null} onOpenChange={v => !v && setDeleteEntry(null)}>
        <AlertDialogContent dir={ar ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{ar ? "تأكيد الحذف" : "Bekräfta borttagning"}</AlertDialogTitle>
            <AlertDialogDescription>
              {ar ? "لا يمكن التراجع عن هذا الإجراء." : "Detta går inte att ångra."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ar ? "إلغاء" : "Avbryt"}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              {ar ? "حذف" : "Ta bort"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
