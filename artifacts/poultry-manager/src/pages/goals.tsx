import { useState } from "react";
import { useListGoals, getListGoalsQueryKey, useCreateGoal, useUpdateGoal, useDeleteGoal } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Target, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const CAT_LABELS: Record<string, string> = { production: "إنتاج", health: "صحة", growth: "نمو", financial: "مالي", other: "أخرى" };
const CAT_COLORS: Record<string, string> = { production: "text-amber-600", health: "text-emerald-600", growth: "text-blue-600", financial: "text-violet-600", other: "text-gray-600" };

function GoalForm({ initial, onSubmit, onClose }: { initial?: any; onSubmit: (d: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    targetValue: initial?.targetValue ?? 100,
    currentValue: initial?.currentValue ?? 0,
    unit: initial?.unit ?? "",
    category: initial?.category ?? "production",
    deadline: initial?.deadline ?? "",
  });
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ ...form, targetValue: Number(form.targetValue), currentValue: Number(form.currentValue), deadline: form.deadline || null }); }} className="space-y-4">
      <div className="space-y-1.5">
        <Label>عنوان الهدف</Label>
        <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="مثل: إنتاج 200 بيضة أسبوعياً" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>القيمة المستهدفة</Label>
          <Input type="number" step="0.1" value={form.targetValue} onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))} required />
        </div>
        <div className="space-y-1.5">
          <Label>القيمة الحالية</Label>
          <Input type="number" step="0.1" value={form.currentValue} onChange={e => setForm(f => ({ ...f, currentValue: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>الوحدة</Label>
          <Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="مثل: بيضة، %, طير" required />
        </div>
        <div className="space-y-1.5">
          <Label>التصنيف</Label>
          <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CAT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>الموعد النهائي (اختياري)</Label>
        <Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
        <Button type="submit">حفظ</Button>
      </div>
    </form>
  );
}

function UpdateProgressDialog({ goal, onClose }: { goal: any; onClose: () => void }) {
  const updateGoal = useUpdateGoal();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [value, setValue] = useState(String(goal.currentValue));
  return (
    <form onSubmit={async e => {
      e.preventDefault();
      const newVal = Number(value);
      const completed = newVal >= Number(goal.targetValue);
      await updateGoal.mutateAsync({ id: goal.id, data: { currentValue: newVal, completed } });
      toast({ title: completed ? "تهانينا! تم تحقيق الهدف" : "تم تحديث التقدم" });
      qc.invalidateQueries({ queryKey: getListGoalsQueryKey() });
      onClose();
    }} className="space-y-4">
      <div className="space-y-1.5">
        <Label>القيمة الحالية ({goal.unit})</Label>
        <Input type="number" step="0.1" value={value} onChange={e => setValue(e.target.value)} required />
        <p className="text-xs text-muted-foreground">الهدف: {goal.targetValue} {goal.unit}</p>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
        <Button type="submit">تحديث</Button>
      </div>
    </form>
  );
}

export default function Goals() {
  const { data: goals, isLoading } = useListGoals({ query: { queryKey: getListGoalsQueryKey() } });
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [progressItem, setProgressItem] = useState<any>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: getListGoalsQueryKey() });

  const active = goals?.filter(g => !g.completed) ?? [];
  const completed = goals?.filter(g => g.completed) ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الأهداف</h1>
          <p className="text-muted-foreground text-sm">{completed.length} من {goals?.length ?? 0} أهداف محققة</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />هدف جديد</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>إضافة هدف جديد</DialogTitle></DialogHeader>
            <GoalForm onSubmit={async d => { await createGoal.mutateAsync({ data: d }); toast({ title: "تم إضافة الهدف" }); setOpen(false); refresh(); }} onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>
      ) : goals?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Target className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg mb-1">لا توجد أهداف بعد</h3>
            <p className="text-muted-foreground text-sm">ضع أهدافاً واضحة لمزرعتك وتابع تحقيقها</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">جارية ({active.length})</h2>
              {active.map(goal => {
                const pct = Math.min(100, Math.round((Number(goal.currentValue) / Number(goal.targetValue)) * 100));
                return (
                  <Card key={goal.id} className="border-border/60 hover:shadow-sm transition-all">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{goal.title}</h3>
                            <span className={cn("text-xs font-medium", CAT_COLORS[goal.category])}>{CAT_LABELS[goal.category]}</span>
                          </div>
                          {goal.deadline && <p className="text-xs text-muted-foreground mt-0.5">الموعد: {goal.deadline}</p>}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => setProgressItem(goal)} className="text-xs">تحديث</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditItem(goal)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { if (!confirm("حذف الهدف؟")) return; await deleteGoal.mutateAsync({ id: goal.id }); toast({ title: "تم الحذف" }); refresh(); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-muted-foreground">{goal.currentValue} {goal.unit}</span>
                          <span className="font-semibold text-primary">{pct}%</span>
                        </div>
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 text-left">الهدف: {goal.targetValue} {goal.unit}</div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {completed.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">محققة ({completed.length})</h2>
              {completed.map(goal => (
                <Card key={goal.id} className="border-emerald-200 bg-emerald-50/50">
                  <CardContent className="p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium">{goal.title}</p>
                      <p className="text-xs text-muted-foreground">{goal.targetValue} {goal.unit}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { await deleteGoal.mutateAsync({ id: goal.id }); refresh(); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={!!editItem} onOpenChange={v => !v && setEditItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>تعديل الهدف</DialogTitle></DialogHeader>
          {editItem && <GoalForm initial={editItem} onSubmit={async d => { await updateGoal.mutateAsync({ id: editItem.id, data: d }); toast({ title: "تم التحديث" }); setEditItem(null); refresh(); }} onClose={() => setEditItem(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!progressItem} onOpenChange={v => !v && setProgressItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>تحديث التقدم</DialogTitle></DialogHeader>
          {progressItem && <UpdateProgressDialog goal={progressItem} onClose={() => setProgressItem(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
