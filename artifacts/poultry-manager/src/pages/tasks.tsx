import { useState } from "react";
import { useListTasks, getListTasksQueryKey, useCreateTask, useDeleteTask, useUpdateTask } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, CheckSquare, Square, Trash2, CheckCircle2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getDays, getMonths } from "@/lib/i18n";

function TaskForm({ initial, onSubmit, onClose, isEdit }: { initial?: any; onSubmit: (d: any) => void; onClose: () => void; isEdit?: boolean }) {
  const { t } = useLanguage();
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    category: initial?.category ?? "other",
    priority: initial?.priority ?? "medium",
    dueDate: initial?.dueDate ?? today,
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t("tasks.taskTitle")}</Label>
        <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={t("tasks.taskTitle.placeholder")} required autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label>{t("tasks.description")}</Label>
        <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={t("tasks.description.placeholder")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t("tasks.category")}</Label>
          <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="feeding">{t("category.feeding")}</SelectItem>
              <SelectItem value="health">{t("category.health")}</SelectItem>
              <SelectItem value="cleaning">{t("category.cleaning")}</SelectItem>
              <SelectItem value="hatching">{t("category.hatching")}</SelectItem>
              <SelectItem value="other">{t("category.other")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("tasks.priority")}</Label>
          <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="high">🔴 {t("priority.high")}</SelectItem>
              <SelectItem value="medium">🟡 {t("priority.medium")}</SelectItem>
              <SelectItem value="low">🟢 {t("priority.low")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>{t("tasks.dueDate")}</Label>
        <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button type="submit">{isEdit ? t("common.update") : t("common.add")}</Button>
      </div>
    </form>
  );
}

export default function Tasks() {
  const today = new Date().toISOString().split("T")[0];
  const { isAdmin } = useAuth();
  const { t, lang } = useLanguage();
  const isRtl = lang === "ar";
  const { data: tasks, isLoading } = useListTasks({ date: today }, { query: { queryKey: getListTasksQueryKey({ date: today }) } });
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const CATEGORY_LABELS: Record<string, string> = {
    feeding: t("category.feeding"), health: t("category.health"), cleaning: t("category.cleaning"),
    hatching: t("category.hatching"), other: t("category.other"),
  };
  const PRIORITY_COLORS: Record<string, string> = {
    low: isRtl ? "border-r-slate-300" : "border-l-slate-300",
    medium: isRtl ? "border-r-amber-400" : "border-l-amber-400",
    high: isRtl ? "border-r-red-500" : "border-l-red-500",
  };
  const PRIORITY_LABELS: Record<string, string> = {
    low: t("priority.low"), medium: t("priority.medium"), high: t("priority.high"),
  };

  const refresh = () => qc.invalidateQueries({ queryKey: getListTasksQueryKey({ date: today }) });

  const handleCreate = async (data: any) => {
    try {
      await createTask.mutateAsync({ data });
      toast({ title: t("tasks.added") });
      setOpen(false);
      refresh();
    } catch (err: any) {
      toast({ title: t("common.addError"), description: err?.message ?? t("common.addErrorDesc"), variant: "destructive" });
    }
  };

  const handleUpdate = async (data: any) => {
    try {
      await updateTask.mutateAsync({ id: editItem.id, data });
      toast({ title: t("tasks.updated") });
      setEditItem(null);
      refresh();
    } catch (err: any) {
      toast({ title: t("common.updateError"), description: err?.message ?? t("common.addErrorDesc"), variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (deleteId == null) return;
    try {
      await deleteTask.mutateAsync({ id: deleteId });
      toast({ title: t("tasks.deleted") });
      setDeleteId(null);
      refresh();
    } catch (err: any) {
      toast({ title: t("common.deleteError"), description: err?.message, variant: "destructive" });
    }
  };

  const toggleComplete = async (task: any) => {
    try {
      await updateTask.mutateAsync({ id: task.id, data: { completed: !task.completed } });
      refresh();
    } catch {
      toast({ title: t("tasks.statusError"), variant: "destructive" });
    }
  };

  const pending = tasks?.filter((t) => !t.completed) ?? [];
  const done = tasks?.filter((t) => t.completed) ?? [];

  const DAYS = getDays(lang);
  const MONTHS = getMonths(lang);
  const d = new Date();
  const dateLabel = lang === "ar"
    ? `${DAYS[d.getDay()]}، ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
    : `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("tasks.title")}</h1>
          <p className="text-muted-foreground text-sm">{dateLabel} — {done.length} {t("common.from")} {tasks?.length ?? 0} {t("tasks.completedOf")}</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" />{t("tasks.newTask")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("tasks.addTaskTitle")}</DialogTitle></DialogHeader>
              <TaskForm onSubmit={handleCreate} onClose={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {tasks && tasks.length > 0 && (
        <div className="bg-card rounded-xl p-4 border border-border/60">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">{t("tasks.progress")}</span>
            <span className="font-semibold text-primary">{Math.round((done.length / tasks.length) * 100)}%</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${tasks.length ? (done.length / tasks.length) * 100 : 0}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
            <span>{pending.length} {t("tasks.remaining")}</span>
            <span>{done.length} {t("tasks.completedLabel")}</span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => (<Card key={i}><CardContent className="p-4"><Skeleton className="h-10 w-full" /></CardContent></Card>))}</div>
      ) : tasks?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-4" />
            <h3 className="font-semibold text-lg mb-1">{t("tasks.noTasks")}</h3>
            <p className="text-muted-foreground text-sm">{isAdmin ? t("tasks.noTasks.admin") : t("tasks.noTasks.worker")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t("tasks.pending")} ({pending.length})</h2>
              {pending.map((task) => (
                <Card key={task.id} className={cn(isRtl ? "border-r-4" : "border-l-4", "transition-all duration-200 hover:shadow-sm", PRIORITY_COLORS[task.priority])}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <button onClick={() => toggleComplete(task)} className="shrink-0 text-muted-foreground hover:text-primary transition-colors"><Square className="w-5 h-5" /></button>
                    <div className="flex-1">
                      <p className="font-medium">{task.title}</p>
                      {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="bg-muted px-2 py-0.5 rounded">{CATEGORY_LABELS[task.category]}</span>
                        <span>{PRIORITY_LABELS[task.priority]}</span>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-primary w-8 h-8 p-0" onClick={() => setEditItem(task)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive w-8 h-8 p-0" onClick={() => setDeleteId(task.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t("tasks.doneSection")} ({done.length})</h2>
              {done.map((task) => (
                <Card key={task.id} className="border-border/40 opacity-60 hover:opacity-80 transition-opacity">
                  <CardContent className="p-4 flex items-center gap-3">
                    <button onClick={() => toggleComplete(task)} className="shrink-0 text-emerald-500 hover:text-emerald-600 transition-colors"><CheckSquare className="w-5 h-5" /></button>
                    <p className="flex-1 line-through text-muted-foreground">{task.title}</p>
                    {isAdmin && (
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive w-8 h-8 p-0 shrink-0" onClick={() => setDeleteId(task.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={!!editItem} onOpenChange={(v) => !v && setEditItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("tasks.editTaskTitle")}</DialogTitle></DialogHeader>
          {editItem && <TaskForm initial={editItem} onSubmit={handleUpdate} onClose={() => setEditItem(null)} isEdit />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId != null} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("common.confirmDeleteTask")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">{t("common.yesDelete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
