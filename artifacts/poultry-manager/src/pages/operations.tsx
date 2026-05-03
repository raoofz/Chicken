/**
 * مركز العمليات اليومية — Daily Operations Center
 * ═══════════════════════════════════════════════
 * Unified view of planned Tasks + completed Activity Logs.
 * Core feature: when an activity is logged and linked to a task,
 * that task is automatically marked complete server-side.
 *
 * Data sources:
 *   - Tasks API       → planned/pending work
 *   - Activity Logs   → completed/recorded work
 *
 * Smart linking: when creating an activity, the form suggests
 * open tasks in the same category, allowing one-click linkage.
 */
import { useState, useCallback, useRef } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  useListTasks,
  useUpdateTask,
  useDeleteTask,
  useCreateTask,
  getListTasksQueryKey,
  useListActivityLogs,
  getListActivityLogsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  CheckCircle2, Circle, Plus, ClipboardList, Activity,
  Layers, AlertTriangle, Clock, Link2, Trash2, Calendar,
  ShieldCheck, ShieldAlert, RefreshCw, Zap, XCircle,
  FileText, Sparkles, Loader2, MessageSquare,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

// ── Notes API helpers ────────────────────────────────────────────────────────
const NOTE_CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  general:     { bg: "bg-slate-50",   text: "text-slate-700",  border: "border-slate-200" },
  health:      { bg: "bg-red-50",     text: "text-red-700",    border: "border-red-200" },
  production:  { bg: "bg-amber-50",   text: "text-amber-700",  border: "border-amber-200" },
  feeding:     { bg: "bg-green-50",   text: "text-green-700",  border: "border-green-200" },
  maintenance: { bg: "bg-blue-50",    text: "text-blue-700",   border: "border-blue-200" },
  observation: { bg: "bg-purple-50",  text: "text-purple-700", border: "border-purple-200" },
  incubator:   { bg: "bg-orange-50",  text: "text-orange-700", border: "border-orange-200" },
  flock:       { bg: "bg-teal-50",    text: "text-teal-700",   border: "border-teal-200" },
};
const NOTE_CAT_KEYS = ["general","health","production","feeding","maintenance","observation","incubator","flock"] as const;

// ── Constants ────────────────────────────────────────────────────────────────
const BASE_URL = import.meta.env.BASE_URL ?? "/";

const TASK_CATEGORIES = ["feeding", "health", "hatching", "cleaning", "observation", "other"] as const;
const ACTIVITY_CATEGORIES = TASK_CATEGORIES;

const PRIORITY_COLORS: Record<string, string> = {
  high:   "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low:    "bg-slate-100 text-slate-600 border-slate-200",
};

const CAT_ICONS: Record<string, string> = {
  feeding:     "🌾",
  health:      "💊",
  hatching:    "🥚",
  cleaning:    "🧹",
  observation: "👁️",
  other:       "📋",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function fmtDate(d: string, ar: boolean) {
  return new Date(d).toLocaleDateString(ar ? "ar-IQ" : "sv-SE", {
    weekday: "short", month: "short", day: "numeric",
  });
}

// ── Create Activity Form ─────────────────────────────────────────────────────
function CreateActivityForm({
  ar,
  openTasks,
  onSuccess,
  onClose,
}: {
  ar: boolean;
  openTasks: any[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    title:       "",
    description: "",
    category:    "other" as string,
    date:        todayStr(),
    taskId:      "" as string,
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const catLabel = (c: string) =>
    ar
      ? { feeding: "تغذية", health: "صحة", hatching: "تفقيس", cleaning: "نظافة", observation: "ملاحظة", other: "أخرى" }[c] ?? c
      : { feeding: "Matning", health: "Hälsa", hatching: "Kläckning", cleaning: "Städning", observation: "Observation", other: "Övrigt" }[c] ?? c;

  // Smart suggestion: filter open tasks by selected category
  const suggestedTasks = openTasks.filter(t => !form.category || form.category === "other" || t.category === form.category);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}api/activity-logs`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          title:       form.title.trim(),
          description: form.description.trim() || null,
          category:    form.category,
          date:        form.date,
          taskId:      form.taskId ? Number(form.taskId) : null,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? (ar ? "خطأ في الحفظ" : "Fel vid sparning"));
      }
      toast({ title: ar ? "✅ تم تسجيل النشاط" : "✅ Aktivitet registrerad" });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: err?.message ?? (ar ? "فشل الحفظ" : "Misslyckades"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>{ar ? "عنوان النشاط" : "Aktivitetstitel"} *</Label>
        <Input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder={ar ? "ما الذي فعلته؟" : "Vad gjordes?"}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{ar ? "التصنيف" : "Kategori"}</Label>
          <Select
            value={form.category}
            onValueChange={v => setForm(f => ({ ...f, category: v, taskId: "" }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTIVITY_CATEGORIES.map(c => (
                <SelectItem key={c} value={c}>{CAT_ICONS[c]} {catLabel(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{ar ? "التاريخ" : "Datum"}</Label>
          <Input
            type="date"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{ar ? "تفاصيل إضافية (اختياري)" : "Detaljer (valfritt)"}</Label>
        <Input
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder={ar ? "أي ملاحظات..." : "Eventuella kommentarer..."} />
      </div>

      {/* Smart task link suggestion */}
      {suggestedTasks.length > 0 && (
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5 text-blue-500" />
            {ar ? "ربط بمهمة مفتوحة (اختياري)" : "Länka till öppen uppgift (valfritt)"}
          </Label>
          <Select
            value={form.taskId}
            onValueChange={v => setForm(f => ({ ...f, taskId: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={ar ? "اختر مهمة..." : "Välj uppgift..."} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{ar ? "— بدون ربط —" : "— Ingen länk —"}</SelectItem>
              {suggestedTasks.map(task => (
                <SelectItem key={task.id} value={String(task.id)}>
                  {CAT_ICONS[task.category] ?? "📋"} {task.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.taskId && (
            <p className="text-xs text-blue-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {ar ? "ستُحدَّد هذه المهمة كمكتملة تلقائياً" : "Uppgiften markeras som klar automatiskt"}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? (ar ? "جاري الحفظ..." : "Sparar...") : (ar ? "تسجيل النشاط" : "Registrera aktivitet")}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          {ar ? "إلغاء" : "Avbryt"}
        </Button>
      </div>
    </form>
  );
}

// ── Create Task Form ─────────────────────────────────────────────────────────
function CreateTaskForm({ ar, onSuccess, onClose }: { ar: boolean; onSuccess: () => void; onClose: () => void }) {
  const [form, setForm] = useState({
    title:       "",
    description: "",
    category:    "other" as string,
    priority:    "medium" as string,
    dueDate:     todayStr(),
  });
  const createTask = useCreateTask();
  const { toast } = useToast();

  const catLabel = (c: string) =>
    ar
      ? { feeding: "تغذية", health: "صحة", hatching: "تفقيس", cleaning: "نظافة", observation: "ملاحظة", other: "أخرى" }[c] ?? c
      : { feeding: "Matning", health: "Hälsa", hatching: "Kläckning", cleaning: "Städning", observation: "Observation", other: "Övrigt" }[c] ?? c;

  const priLabel = (p: string) =>
    ar
      ? { high: "عالية", medium: "متوسطة", low: "منخفضة" }[p] ?? p
      : { high: "Hög", medium: "Medel", low: "Låg" }[p] ?? p;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      await createTask.mutateAsync({
        data: {
          title:       form.title.trim(),
          description: form.description.trim() || undefined,
          category:    form.category as any,
          priority:    form.priority as any,
          dueDate:     form.dueDate || undefined,
        },
      });
      toast({ title: ar ? "✅ تمت إضافة المهمة" : "✅ Uppgift skapad" });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: err?.message ?? (ar ? "فشل الحفظ" : "Misslyckades"), variant: "destructive" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>{ar ? "عنوان المهمة" : "Uppgiftstitel"} *</Label>
        <Input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder={ar ? "ماذا يجب أن يُفعل؟" : "Vad ska göras?"}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{ar ? "التصنيف" : "Kategori"}</Label>
          <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TASK_CATEGORIES.map(c => (
                <SelectItem key={c} value={c}>{CAT_ICONS[c]} {catLabel(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{ar ? "الأولوية" : "Prioritet"}</Label>
          <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["high","medium","low"].map(p => (
                <SelectItem key={p} value={p}>{priLabel(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>{ar ? "تاريخ الاستحقاق" : "Förfallodatum"}</Label>
        <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label>{ar ? "تفاصيل (اختياري)" : "Detaljer (valfritt)"}</Label>
        <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="..." />
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={createTask.isPending} className="flex-1">
          {createTask.isPending ? (ar ? "جاري الحفظ..." : "Sparar...") : (ar ? "إضافة المهمة" : "Lägg till uppgift")}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>{ar ? "إلغاء" : "Avbryt"}</Button>
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OperationsPage() {
  const { t, lang } = useLanguage();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const ar = lang === "ar";
  const qc = useQueryClient();

  const { data: tasks,    isLoading: tasksLoading }  = useListTasks(
    {},
    { query: { queryKey: getListTasksQueryKey({}) } },
  );
  const { data: actLogs,  isLoading: logsLoading }   = useListActivityLogs(
    { query: { queryKey: getListActivityLogsQueryKey() } },
  );
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [tab,         setTab]         = useState<"overview" | "tasks" | "logs" | "notes" | "system">("overview");
  const [taskDialog,  setTaskDialog]  = useState(false);
  const [actDialog,   setActDialog]   = useState(false);
  const [filter,      setFilter]      = useState<"all" | "pending" | "done">("all");

  // ── Notes state ────────────────────────────────────────────────────────────
  const [noteDialog,    setNoteDialog]    = useState(false);
  const [noteContent,   setNoteContent]   = useState("");
  const [noteCategory,  setNoteCategory]  = useState("general");
  const [noteDate,      setNoteDate]      = useState(new Date().toISOString().split("T")[0]);
  const [noteDeleteId,  setNoteDeleteId]  = useState<number | null>(null);
  const [smartLoading,  setSmartLoading]  = useState(false);
  const [smartResult,   setSmartResult]   = useState<{ totalSaved: number; summary: string } | null>(null);
  const pendingNoteRef  = useRef<{ content: string; date: string } | null>(null);

  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}api/notes`, { credentials: "include" });
      if (!r.ok) throw new Error("notes fetch failed");
      return r.json();
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (data: { content: string; date: string; category: string }) => {
      const r = await fetch(`${BASE_URL}api/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("create note failed");
      return r.json();
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      toast({ title: ar ? "تمت إضافة الملاحظة" : "Anteckning sparad" });
      setNoteDialog(false);
      const pending = pendingNoteRef.current;
      setNoteContent("");
      pendingNoteRef.current = null;
      if (pending && pending.content.trim().length > 5) {
        setSmartLoading(true);
        setSmartResult(null);
        try {
          const r = await fetch(`${BASE_URL}api/ai/smart-analyze`, {
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
            }
          }
        } catch { /* silent */ }
        finally { setSmartLoading(false); }
      }
    },
    onError: () => toast({ title: ar ? "فشل إضافة الملاحظة" : "Misslyckades", variant: "destructive" }),
  });

  const delNoteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${BASE_URL}api/notes/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok && r.status !== 204) throw new Error("delete note failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      toast({ title: ar ? "تم حذف الملاحظة" : "Anteckning raderad" });
      setNoteDeleteId(null);
    },
    onError: () => toast({ title: ar ? "فشل الحذف" : "Misslyckades", variant: "destructive" }),
  });

  const noteCatLabel = (c: string) => ar
    ? { general: "عام", health: "صحة", production: "إنتاج", feeding: "تغذية", maintenance: "صيانة", observation: "ملاحظة", incubator: "حاضنة", flock: "قطيع" }[c] ?? c
    : { general: "Allmänt", health: "Hälsa", production: "Produktion", feeding: "Matning", maintenance: "Underhåll", observation: "Observation", incubator: "Inkubator", flock: "Flock" }[c] ?? c;

  // ── System Health state ───────────────────────────────────────────────────
  type IntegrityResult = {
    status: "ok" | "issues";
    durationMs: number;
    checkedAt: string;
    summary: {
      totalTransactions: number;
      nullDomainCount: number;
      domainMismatchCount: number;
      categoryViolationCount: number;
      eggClassifiedAsFeedCount: number;
      orphanActivityLogs: number;
      nullAmountCount: number;
      unknownCategories: string[];
      domainDistribution: Record<string, number>;
    };
    issues: Array<{ severity: "critical" | "warning"; check: string; detail: string }>;
    passed: string[];
  };
  type SeedResult = { inserted: number; durationMs: number; throughputPerSec: number; domainBreakdown: Record<string, number> };

  const [integrityResult, setIntegrityResult] = useState<IntegrityResult | null>(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedCount, setSeedCount] = useState(200);

  async function runIntegrityCheck() {
    setIntegrityLoading(true);
    try {
      const r = await fetch(`${BASE_URL}api/validate/integrity`, { credentials: "include" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "فشل الفحص");
      setIntegrityResult(data);
    } catch (err: any) {
      toast({ title: err?.message ?? (ar ? "فشل الفحص" : "Kontroll misslyckades"), variant: "destructive" });
    } finally {
      setIntegrityLoading(false);
    }
  }

  async function runSeedTest() {
    setSeedLoading(true);
    setSeedResult(null);
    try {
      const r = await fetch(`${BASE_URL}api/dev/seed-transactions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: seedCount }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "فشل الاختبار");
      setSeedResult(data);
      refresh();
    } catch (err: any) {
      toast({ title: err?.message ?? (ar ? "فشل اختبار الضغط" : "Stresstest misslyckades"), variant: "destructive" });
    } finally {
      setSeedLoading(false);
    }
  }

  async function purgeSeedData() {
    try {
      const r = await fetch(`${BASE_URL}api/dev/seed-transactions`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      toast({ title: ar ? `تم حذف ${data.deleted} سجل اختباري` : `${data.deleted} testposter borttagna` });
      setSeedResult(null);
      refresh();
    } catch (err: any) {
      toast({ title: err?.message, variant: "destructive" });
    }
  }

  const today = todayStr();

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: getListTasksQueryKey({}) });
    qc.invalidateQueries({ queryKey: getListActivityLogsQueryKey() });
    qc.invalidateQueries();
  }, [qc]);

  // Partition tasks
  const allTasks    = tasks ?? [];
  const openTasks   = allTasks.filter(t => !t.completed);
  const doneTasks   = allTasks.filter(t =>  t.completed);
  const overdueTasks = openTasks.filter(t => t.dueDate && t.dueDate < today);

  // Filtered tasks
  const filteredTasks = filter === "pending" ? openTasks
    : filter === "done"    ? doneTasks
    : allTasks;

  // Today's activity logs
  const allLogs   = actLogs ?? [];
  const todayLogs = allLogs.filter(l => l.date === today);
  const recentLogs = allLogs.slice(0, 20);

  async function toggleTask(task: any) {
    try {
      await updateTask.mutateAsync({ id: task.id, data: { ...task, completed: !task.completed } });
      refresh();
    } catch (err: any) {
      toast({ title: err?.message, variant: "destructive" });
    }
  }

  async function handleDeleteTask(id: number) {
    try {
      await deleteTask.mutateAsync({ id });
      refresh();
    } catch (err: any) {
      toast({ title: err?.message, variant: "destructive" });
    }
  }

  async function deleteLog(id: number) {
    try {
      const res = await fetch(`${BASE_URL}api/activity-logs/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) throw new Error("delete failed");
      refresh();
    } catch (err: any) {
      toast({ title: err?.message ?? (ar ? "فشل الحذف" : "Misslyckades"), variant: "destructive" });
    }
  }

  const priLabel = (p: string) => ar
    ? { high: "عالية", medium: "متوسطة", low: "منخفضة" }[p] ?? p
    : { high: "Hög", medium: "Medel", low: "Låg" }[p] ?? p;

  const catLabel = (c: string) => ar
    ? { feeding: "تغذية", health: "صحة", hatching: "تفقيس", cleaning: "نظافة", observation: "ملاحظة", other: "أخرى" }[c] ?? c
    : { feeding: "Matning", health: "Hälsa", hatching: "Kläckning", cleaning: "Städning", observation: "Observation", other: "Övrigt" }[c] ?? c;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="w-6 h-6 text-violet-500" />
            {ar ? "مركز العمليات اليومية" : "Daglig operationscentral"}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {ar ? "مهامك المخططة + سجل ما نُفِّذ — في مكان واحد" : "Planerade uppgifter + registrerade aktiviteter på ett ställe"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={noteDialog} onOpenChange={setNoteDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <FileText className="w-4 h-4" />
                {ar ? "ملاحظة جديدة" : "Ny anteckning"}
              </Button>
            </DialogTrigger>
            <DialogContent dir={ar ? "rtl" : "ltr"} className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  {ar ? "إضافة ملاحظة يومية" : "Lägg till anteckning"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">{ar ? "التاريخ" : "Datum"}</label>
                    <input type="date" value={noteDate} onChange={e => setNoteDate(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">{ar ? "الفئة" : "Kategori"}</label>
                    <Select value={noteCategory} onValueChange={setNoteCategory}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {NOTE_CAT_KEYS.map(v => (
                          <SelectItem key={v} value={v}>{noteCatLabel(v)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">{ar ? "المحتوى" : "Innehåll"}</label>
                  <Textarea
                    placeholder={ar ? "اكتب ملاحظتك هنا..." : "Skriv din anteckning här..."}
                    value={noteContent}
                    onChange={e => setNoteContent(e.target.value)}
                    className="min-h-[120px] resize-none"
                  />
                </div>
                <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-2.5 flex items-start gap-2 border border-purple-100 dark:border-purple-800/30">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    {ar ? "سيقوم الذكاء الاصطناعي بتحليل ملاحظتك واستخراج البيانات تلقائياً" : "AI analyserar anteckningen och extraherar data automatiskt"}
                  </p>
                </div>
                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2"
                  disabled={!noteContent.trim() || addNoteMutation.isPending}
                  onClick={() => {
                    pendingNoteRef.current = { content: noteContent, date: noteDate };
                    addNoteMutation.mutate({ content: noteContent, date: noteDate, category: noteCategory });
                  }}
                >
                  {addNoteMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" />{ar ? "جاري الحفظ..." : "Sparar..."}</>
                    : <><Sparkles className="w-4 h-4" />{ar ? "حفظ الملاحظة" : "Spara anteckning"}</>}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {isAdmin && (
            <>
              <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <ClipboardList className="w-4 h-4" />
                    {ar ? "مهمة جديدة" : "Ny uppgift"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{ar ? "إضافة مهمة" : "Lägg till uppgift"}</DialogTitle>
                  </DialogHeader>
                  <CreateTaskForm ar={ar} onSuccess={refresh} onClose={() => setTaskDialog(false)} />
                </DialogContent>
              </Dialog>

              <Dialog open={actDialog} onOpenChange={setActDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Activity className="w-4 h-4" />
                    {ar ? "تسجيل نشاط" : "Registrera aktivitet"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{ar ? "تسجيل نشاط تم تنفيذه" : "Registrera utförd aktivitet"}</DialogTitle>
                  </DialogHeader>
                  <CreateActivityForm ar={ar} openTasks={openTasks} onSuccess={refresh} onClose={() => setActDialog(false)} />
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-3 text-center">
          <div className="text-2xl font-black text-violet-600">{openTasks.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{ar ? "مهام مفتوحة" : "Öppna uppgifter"}</div>
        </div>
        <div className={`rounded-xl border p-3 text-center ${overdueTasks.length > 0 ? "bg-red-50 border-red-200" : "bg-card"}`}>
          <div className={`text-2xl font-black ${overdueTasks.length > 0 ? "text-red-600" : "text-slate-400"}`}>{overdueTasks.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{ar ? "مهام متأخرة" : "Försenade"}</div>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <div className="text-2xl font-black text-emerald-600">{todayLogs.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{ar ? "أنشطة اليوم" : "Aktiviteter idag"}</div>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <div className="text-2xl font-black text-indigo-600">{(notes as any[]).length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{ar ? "الملاحظات" : "Anteckningar"}</div>
        </div>
      </div>

      {/* ── Overdue Alert ── */}
      {overdueTasks.length > 0 && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            {ar
              ? `${overdueTasks.length} مهمة متأخرة: ${overdueTasks.map(t => t.title).join("، ")}`
              : `${overdueTasks.length} försenade uppgifter: ${overdueTasks.map(t => t.title).join(", ")}`}
          </span>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl flex-wrap">
        {(["overview", "tasks", "logs", "notes", "system"] as const).map(tab_ => (
          <button
            key={tab_}
            onClick={() => setTab(tab_)}
            className={`flex-1 text-xs font-medium py-2 rounded-lg transition-colors min-w-[60px] ${tab === tab_ ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tab_ === "overview" && (ar ? "عامة" : "Översikt")}
            {tab_ === "tasks"    && (ar ? `المهام (${allTasks.length})` : `Uppg. (${allTasks.length})`)}
            {tab_ === "logs"     && (ar ? `النشاط (${allLogs.length})` : `Akt. (${allLogs.length})`)}
            {tab_ === "notes"    && (ar ? `الملاحظات (${(notes as any[]).length})` : `Ant. (${(notes as any[]).length})`)}
            {tab_ === "system"   && (ar ? "🛡️ النظام" : "🛡️ System")}
          </button>
        ))}
      </div>

      {/* ══ OVERVIEW TAB ══ */}
      {tab === "overview" && (
        <div className="grid gap-4">
          {/* Today's pending tasks */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-violet-500" />
                {ar ? "مهام اليوم" : "Dagens uppgifter"}
                <Badge variant="secondary" className="text-xs">{openTasks.filter(t => !t.dueDate || t.dueDate <= today).length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {tasksLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : openTasks.filter(t => !t.dueDate || t.dueDate <= today).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{ar ? "لا توجد مهام معلقة لهذا اليوم 🎉" : "Inga väntande uppgifter för idag 🎉"}</p>
              ) : (
                openTasks.filter(t => !t.dueDate || t.dueDate <= today).map(task => (
                  <div key={task.id} className={`flex items-start gap-3 p-2.5 rounded-lg border ${task.dueDate && task.dueDate < today ? "border-red-200 bg-red-50/50" : "border-border/40 bg-muted/20"}`}>
                    <button
                      onClick={() => toggleTask(task)}
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-emerald-500 transition-colors"
                    >
                      <Circle className="w-4.5 h-4.5" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">{CAT_ICONS[task.category]} {catLabel(task.category)}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.medium}`}>{priLabel(task.priority)}</span>
                        {task.dueDate && (
                          <span className={`text-[10px] flex items-center gap-0.5 ${task.dueDate < today ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                            <Clock className="w-3 h-3" />
                            {fmtDate(task.dueDate, ar)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Today's activity log */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                {ar ? "سجل نشاط اليوم" : "Dagens aktivitetslogg"}
                <Badge variant="secondary" className="text-xs">{todayLogs.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {logsLoading ? (
                <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : todayLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {ar ? "لم يُسجَّل أي نشاط اليوم بعد" : "Ingen aktivitet registrerad idag än"}
                </p>
              ) : (
                todayLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/40">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{log.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">{CAT_ICONS[log.category]} {catLabel(log.category)}</span>
                        {(log as any).taskId && (
                          <span className="text-[10px] text-blue-600 flex items-center gap-0.5">
                            <Link2 className="w-3 h-3" />
                            {ar ? "مرتبط بمهمة" : "Länkad uppgift"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══ TASKS TAB ══ */}
      {tab === "tasks" && (
        <div className="space-y-3">
          {/* Filter strip */}
          <div className="flex gap-2">
            {(["all", "pending", "done"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${filter === f ? "bg-violet-100 border-violet-300 text-violet-700" : "bg-card border-border text-muted-foreground hover:bg-muted/50"}`}
              >
                {f === "all"     && (ar ? "الكل" : "Alla")}
                {f === "pending" && (ar ? "معلقة" : "Pågående")}
                {f === "done"    && (ar ? "مكتملة" : "Klara")}
              </button>
            ))}
          </div>

          {tasksLoading ? (
            <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filteredTasks.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">{ar ? "لا توجد مهام في هذا التصنيف" : "Inga uppgifter i denna kategori"}</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map(task => (
                <div
                  key={task.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${task.completed ? "opacity-60 border-border/30 bg-muted/20" : task.dueDate && task.dueDate < today ? "border-red-200 bg-red-50/30" : "border-border/40 bg-card hover:bg-muted/20"}`}
                >
                  <button onClick={() => toggleTask(task)} className={`mt-0.5 shrink-0 transition-colors ${task.completed ? "text-emerald-500" : "text-muted-foreground hover:text-emerald-500"}`}>
                    {task.completed ? <CheckCircle2 className="w-4.5 h-4.5" /> : <Circle className="w-4.5 h-4.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.completed ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">{CAT_ICONS[task.category]} {catLabel(task.category)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.medium}`}>{priLabel(task.priority)}</span>
                      {task.dueDate && (
                        <span className={`text-[10px] flex items-center gap-0.5 ${!task.completed && task.dueDate < today ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                          <Calendar className="w-3 h-3" />
                          {fmtDate(task.dueDate, ar)}
                        </span>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ SYSTEM HEALTH TAB ══ */}
      {tab === "system" && (
        <div className="space-y-4">
          {/* Data Integrity Check */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-violet-500" />
                {ar ? "فحص سلامة البيانات" : "Dataintegritetskontroll"}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                {ar
                  ? "يتحقق من: صحة domain لكل معاملة، أن البيض لا يدخل في العلف، تطابق SSOT، روابط المهام."
                  : "Kontrollerar: domän för varje transaktion, att ägg ej klassas som foder, SSOT-matchning, uppgiftslänkar."}
              </p>
              <Button
                size="sm"
                onClick={runIntegrityCheck}
                disabled={integrityLoading}
                className="gap-1.5 w-full"
              >
                {integrityLoading
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />{ar ? "جارٍ الفحص..." : "Kontrollerar..."}</>
                  : <><ShieldCheck className="w-3.5 h-3.5" />{ar ? "تشغيل الفحص الشامل" : "Kör fullständig kontroll"}</>}
              </Button>

              {integrityResult && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  {/* Status banner */}
                  <div className={`flex items-center gap-2 rounded-lg p-3 text-sm font-medium ${integrityResult.status === "ok" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                    {integrityResult.status === "ok"
                      ? <><ShieldCheck className="w-4 h-4" /> {ar ? "✅ النظام سليم — لا توجد مشاكل" : "✅ Systemet är friskt — inga problem"}</>
                      : <><ShieldAlert className="w-4 h-4" /> {ar ? `⚠️ ${integrityResult.issues.filter(i=>i.severity==="critical").length} مشاكل حرجة` : `⚠️ ${integrityResult.issues.filter(i=>i.severity==="critical").length} kritiska problem`}</>}
                    <span className="ml-auto text-[10px] opacity-70">{integrityResult.durationMs}ms</span>
                  </div>

                  {/* Summary grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { label: ar ? "إجمالي المعاملات" : "Totala transaktioner", val: integrityResult.summary.totalTransactions, ok: true },
                      { label: ar ? "بدون domain" : "Utan domän", val: integrityResult.summary.nullDomainCount, ok: integrityResult.summary.nullDomainCount === 0 },
                      { label: ar ? "تعارض domain/SSOT" : "Domän/SSOT-konflikt", val: integrityResult.summary.domainMismatchCount, ok: integrityResult.summary.domainMismatchCount === 0 },
                      { label: ar ? "بيض ↔ علف (الخطأ الأصلي)" : "Ägg→foder-fel", val: integrityResult.summary.eggClassifiedAsFeedCount, ok: integrityResult.summary.eggClassifiedAsFeedCount === 0 },
                      { label: ar ? "مهام يتيمة" : "Föräldralösa uppg.", val: integrityResult.summary.orphanActivityLogs, ok: integrityResult.summary.orphanActivityLogs === 0 },
                      { label: ar ? "مبالغ فارغة" : "Tomma belopp", val: integrityResult.summary.nullAmountCount, ok: integrityResult.summary.nullAmountCount === 0 },
                    ].map(({ label, val, ok }) => (
                      <div key={label} className={`rounded-lg border p-2 flex justify-between items-center ${ok ? "bg-card" : "bg-red-50 border-red-200"}`}>
                        <span className="text-muted-foreground">{label}</span>
                        <span className={`font-bold ${ok ? (val > 0 ? "text-foreground" : "text-emerald-600") : "text-red-600"}`}>{val}</span>
                      </div>
                    ))}
                  </div>

                  {/* Domain distribution */}
                  {Object.keys(integrityResult.summary.domainDistribution).length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{ar ? "توزيع النطاقات" : "Domänfördelning"}</p>
                      {Object.entries(integrityResult.summary.domainDistribution).map(([domain, cnt]) => (
                        <div key={domain} className="flex items-center gap-2 text-xs">
                          <span className="w-24 text-muted-foreground">{domain}</span>
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-violet-400 rounded-full"
                              style={{ width: `${Math.round((cnt / integrityResult.summary.totalTransactions) * 100)}%` }}
                            />
                          </div>
                          <span className="w-6 text-right font-medium">{cnt}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Passed checks */}
                  {integrityResult.passed.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">{ar ? "✅ فحوصات اجتازها النظام" : "✅ Godkända kontroller"}</p>
                      {integrityResult.passed.map(p => (
                        <div key={p} className="flex items-start gap-1.5 text-xs text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>{p}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Issues */}
                  {integrityResult.issues.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wide">{ar ? "🚨 المشاكل المكتشفة" : "🚨 Hittade problem"}</p>
                      {integrityResult.issues.map((issue, i) => (
                        <div key={i} className={`flex items-start gap-1.5 text-xs rounded px-2 py-1 ${issue.severity === "critical" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                          {issue.severity === "critical" ? <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                          <span className="break-all">{issue.detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stress Test */}
          {isAdmin && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  {ar ? "اختبار الضغط" : "Stresstest"}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  {ar
                    ? "يُدخل معاملات وهمية في معاملة DB واحدة ويقيس الأداء. البيانات بالكامل قابلة للحذف بعد الاختبار."
                    : "Infogar syntetiska transaktioner i en enda DB-transaktion och mäter prestanda. All data kan rensas efteråt."}
                </p>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    min={10}
                    max={2000}
                    value={seedCount}
                    onChange={e => setSeedCount(Number(e.target.value))}
                    className="w-28 text-sm h-8"
                  />
                  <span className="text-xs text-muted-foreground">{ar ? "معاملة" : "transaktioner"}</span>
                  <Button size="sm" onClick={runSeedTest} disabled={seedLoading} className="gap-1.5 ml-auto">
                    {seedLoading
                      ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />{ar ? "جارٍ..." : "Kör..."}</>
                      : <><Zap className="w-3.5 h-3.5" />{ar ? "تشغيل الاختبار" : "Kör test"}</>}
                  </Button>
                </div>

                {seedResult && (
                  <div className="rounded-lg border bg-amber-50 border-amber-200 p-3 space-y-2 animate-in fade-in duration-300">
                    <p className="text-xs font-semibold text-amber-800">{ar ? "نتائج اختبار الضغط" : "Stresstest-resultat"}</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-lg font-black text-amber-700">{seedResult.inserted}</div>
                        <div className="text-[10px] text-muted-foreground">{ar ? "معاملة أدخلت" : "Infogade"}</div>
                      </div>
                      <div>
                        <div className="text-lg font-black text-amber-700">{seedResult.durationMs}ms</div>
                        <div className="text-[10px] text-muted-foreground">{ar ? "وقت الإدخال" : "Tid"}</div>
                      </div>
                      <div>
                        <div className="text-lg font-black text-amber-700">{seedResult.throughputPerSec}</div>
                        <div className="text-[10px] text-muted-foreground">{ar ? "معاملة/ثانية" : "tx/sek"}</div>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {Object.entries(seedResult.domainBreakdown).map(([d, n]) => (
                        <div key={d} className="flex justify-between text-[11px] text-amber-700">
                          <span>{d}</span><span className="font-bold">{n}</span>
                        </div>
                      ))}
                    </div>
                    <Button size="sm" variant="outline" onClick={purgeSeedData} className="w-full gap-1.5 text-red-600 border-red-200 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                      {ar ? "حذف البيانات الاختبارية" : "Rensa testdata"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ══ NOTES TAB ══ */}
      {tab === "notes" && (
        <div className="space-y-3">
          {/* Smart Analysis Result */}
          {(smartLoading || smartResult) && (
            <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950/20">
              <CardContent className="p-3">
                {smartLoading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-500 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-white animate-pulse" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-purple-700">{ar ? "يحلل الذكاء الاصطناعي ملاحظتك..." : "AI analyserar din anteckning..."}</p>
                      <p className="text-xs text-purple-500">{ar ? "جاري استخراج البيانات" : "Extraherar data"}</p>
                    </div>
                    <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                  </div>
                ) : smartResult ? (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-500 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-purple-700">
                          {ar ? `تم استخراج ${smartResult.totalSaved} بيانات` : `${smartResult.totalSaved} poster extraherade`}
                        </p>
                        <button onClick={() => setSmartResult(null)} className="text-purple-400 hover:text-purple-600">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-purple-600 mt-0.5">{smartResult.summary}</p>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Notes list */}
          {notesLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          ) : (notes as any[]).length === 0 ? (
            <Card className="py-14 text-center border-dashed">
              <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{ar ? "لا توجد ملاحظات بعد" : "Inga anteckningar ännu"}</p>
              <p className="text-muted-foreground/60 text-xs mt-1">{ar ? "أضف ملاحظتك الأولى بالزر أعلاه" : "Lägg till din första anteckning"}</p>
            </Card>
          ) : (
            (notes as any[]).map((note) => {
              const colors = NOTE_CATEGORY_COLORS[note.category] ?? NOTE_CATEGORY_COLORS.general;
              return (
                <Card key={note.id} className={`border hover:shadow-sm transition-shadow ${colors.border}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge className={`text-xs font-medium border-0 ${colors.bg} ${colors.text}`}>
                            {noteCatLabel(note.category)}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />{note.date}
                          </span>
                          {note.authorName && (
                            <span className="text-xs text-muted-foreground opacity-60">{note.authorName}</span>
                          )}
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => setNoteDeleteId(note.id)}
                          className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}

          {/* Delete confirm */}
          <AlertDialog open={noteDeleteId !== null} onOpenChange={open => !open && setNoteDeleteId(null)}>
            <AlertDialogContent dir={ar ? "rtl" : "ltr"}>
              <AlertDialogHeader>
                <AlertDialogTitle>{ar ? "حذف الملاحظة" : "Ta bort anteckning"}</AlertDialogTitle>
                <AlertDialogDescription>{ar ? "هل أنت متأكد من حذف هذه الملاحظة؟" : "Är du säker på att du vill ta bort den här anteckningen?"}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{ar ? "إلغاء" : "Avbryt"}</AlertDialogCancel>
                <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => noteDeleteId && delNoteMutation.mutate(noteDeleteId)}>
                  {ar ? "حذف" : "Ta bort"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* ══ LOGS TAB ══ */}
      {tab === "logs" && (
        <div className="space-y-2">
          {logsLoading ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : recentLogs.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">{ar ? "لا توجد سجلات نشاط بعد" : "Inga aktivitetsloggar ännu"}</CardContent></Card>
          ) : (
            recentLogs.map(log => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl border border-border/40 bg-card hover:bg-muted/20 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 text-sm">
                  {CAT_ICONS[log.category] ?? "📋"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{log.title}</p>
                  {log.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{log.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">{catLabel(log.category)}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Calendar className="w-3 h-3" />
                      {fmtDate(log.date, ar)}
                    </span>
                    {(log as any).taskId && (
                      <span className="text-[10px] text-blue-600 flex items-center gap-0.5">
                        <Link2 className="w-3 h-3" />
                        {ar ? "مرتبط بمهمة" : "Länkad"}
                      </span>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={() => deleteLog(log.id)} className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
