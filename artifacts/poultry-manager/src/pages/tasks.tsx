import { useState } from "react";
import { useListTasks, getListTasksQueryKey, useCreateTask, useDeleteTask, useUpdateTask } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, CheckSquare, Square, Trash2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = { feeding: "تغذية", health: "صحة", cleaning: "نظافة", hatching: "تفقيس", other: "أخرى" };
const PRIORITY_COLORS: Record<string, string> = { low: "border-r-gray-300", medium: "border-r-amber-400", high: "border-r-red-500" };
const PRIORITY_LABELS: Record<string, string> = { low: "منخفضة", medium: "متوسطة", high: "عالية" };

function TaskForm({ onSubmit, onClose }: { onSubmit: (d: any) => void; onClose: () => void }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ title: "", description: "", category: "other", priority: "medium", dueDate: today });
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="space-y-1.5">
        <Label>عنوان المهمة</Label>
        <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="مثل: تغذية الصباح" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>التصنيف</Label>
          <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>الأولوية</Label>
          <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="high">عالية</SelectItem>
              <SelectItem value="medium">متوسطة</SelectItem>
              <SelectItem value="low">منخفضة</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>تاريخ الاستحقاق</Label>
        <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
        <Button type="submit">إضافة</Button>
      </div>
    </form>
  );
}

export default function Tasks() {
  const today = new Date().toISOString().split("T")[0];
  const { data: tasks, isLoading } = useListTasks({ query: { queryKey: getListTasksQueryKey({ date: today }) } });
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: getListTasksQueryKey({ date: today }) });

  const toggleComplete = async (task: any) => {
    await updateTask.mutateAsync({ id: task.id, data: { completed: !task.completed } });
    refresh();
  };

  const pending = tasks?.filter(t => !t.completed) ?? [];
  const done = tasks?.filter(t => t.completed) ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">مهام اليوم</h1>
          <p className="text-muted-foreground text-sm">{today} — {done.length} من {tasks?.length ?? 0} مكتملة</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />مهمة جديدة</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>إضافة مهمة جديدة</DialogTitle></DialogHeader>
            <TaskForm onSubmit={async d => { await createTask.mutateAsync({ data: d }); toast({ title: "تمت الإضافة" }); setOpen(false); refresh(); }} onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <Card key={i}><CardContent className="p-4"><Skeleton className="h-10 w-full" /></CardContent></Card>)}</div>
      ) : tasks?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-4" />
            <h3 className="font-semibold text-lg mb-1">لا توجد مهام اليوم</h3>
            <p className="text-muted-foreground text-sm">أضف مهامك اليومية لتتابع تقدمك</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">معلقة ({pending.length})</h2>
              {pending.map(task => (
                <Card key={task.id} className={cn("border-r-4 transition-all duration-200", PRIORITY_COLORS[task.priority], "hover:shadow-sm")}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <button onClick={() => toggleComplete(task)} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                      <Square className="w-5 h-5" />
                    </button>
                    <div className="flex-1">
                      <p className="font-medium">{task.title}</p>
                      <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span>{CATEGORY_LABELS[task.category]}</span>
                        <span>{PRIORITY_LABELS[task.priority]}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={async () => { await deleteTask.mutateAsync({ id: task.id }); refresh(); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">مكتملة ({done.length})</h2>
              {done.map(task => (
                <Card key={task.id} className="border-border/40 opacity-60 hover:opacity-80 transition-opacity">
                  <CardContent className="p-4 flex items-center gap-3">
                    <button onClick={() => toggleComplete(task)} className="shrink-0 text-emerald-500 hover:text-emerald-600 transition-colors">
                      <CheckSquare className="w-5 h-5" />
                    </button>
                    <p className="flex-1 line-through text-muted-foreground">{task.title}</p>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={async () => { await deleteTask.mutateAsync({ id: task.id }); refresh(); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
