import { useState } from "react";
import {
  useListHatchingCycles, getListHatchingCyclesQueryKey,
  useCreateHatchingCycle, useDeleteHatchingCycle, useUpdateHatchingCycle
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Egg, Pencil, Trash2, Thermometer, Droplets, Clock, ArrowLeftRight, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABELS: Record<string, string> = {
  incubating: "قيد التحضين",
  hatching: "يفقس الآن",
  completed: "مكتمل",
  failed: "فشل",
};

const STATUS_COLORS: Record<string, string> = {
  incubating: "bg-blue-100 text-blue-700",
  hatching: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

function CycleForm({ initial, onSubmit, onClose }: { initial?: any; onSubmit: (d: any) => void; onClose: () => void }) {
  const today = new Date().toISOString().split("T")[0];
  const in18 = new Date(Date.now() + 18 * 86400000).toISOString().split("T")[0];
  const in21 = new Date(Date.now() + 21 * 86400000).toISOString().split("T")[0];
  const [form, setForm] = useState({
    batchName: initial?.batchName ?? "",
    eggsSet: initial?.eggsSet ?? 1,
    eggsHatched: initial?.eggsHatched ?? "",
    startDate: initial?.startDate ?? today,
    setTime: initial?.setTime ?? "",
    expectedHatchDate: initial?.expectedHatchDate ?? in21,
    actualHatchDate: initial?.actualHatchDate ?? "",
    lockdownDate: initial?.lockdownDate ?? in18,
    lockdownTime: initial?.lockdownTime ?? "",
    status: initial?.status ?? "incubating",
    temperature: initial?.temperature ?? "",
    humidity: initial?.humidity ?? "",
    lockdownTemperature: initial?.lockdownTemperature ?? "",
    lockdownHumidity: initial?.lockdownHumidity ?? "",
    notes: initial?.notes ?? "",
  });

  const toNum = (v: string) => v !== "" ? Number(v) : null;
  const toStr = (v: string) => v || null;

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        onSubmit({
          ...form,
          eggsHatched: toNum(String(form.eggsHatched)),
          temperature: toNum(String(form.temperature)),
          humidity: toNum(String(form.humidity)),
          lockdownTemperature: toNum(String(form.lockdownTemperature)),
          lockdownHumidity: toNum(String(form.lockdownHumidity)),
          actualHatchDate: toStr(form.actualHatchDate),
          setTime: toStr(form.setTime),
          lockdownDate: toStr(form.lockdownDate),
          lockdownTime: toStr(form.lockdownTime),
        });
      }}
      className="space-y-5 max-h-[70vh] overflow-y-auto pr-1"
    >
      {/* Basic info */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>اسم الدفعة</Label>
          <Input value={form.batchName} onChange={e => setForm(f => ({ ...f, batchName: e.target.value }))} placeholder="مثل: الدفعة الثالثة" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>عدد البيض المحضّن</Label>
            <Input type="number" min={1} value={form.eggsSet} onChange={e => setForm(f => ({ ...f, eggsSet: Number(e.target.value) }))} required />
          </div>
          <div className="space-y-1.5">
            <Label>الحالة</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="incubating">قيد التحضين</SelectItem>
                <SelectItem value="hatching">يفقس الآن</SelectItem>
                <SelectItem value="completed">مكتمل</SelectItem>
                <SelectItem value="failed">فشل</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Phase 1: Incubation (days 1-18) */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3">
        <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
          <Thermometer className="w-4 h-4" />
          المرحلة الأولى — التحضين (اليوم 1 → 18)
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>تاريخ وضع البيض</Label>
            <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label>ساعة ودقيقة الوضع</Label>
            <Input type="time" value={form.setTime} onChange={e => setForm(f => ({ ...f, setTime: e.target.value }))} placeholder="مثل: 08:30" />
          </div>
          <div className="space-y-1.5">
            <Label>درجة الحرارة (°م)</Label>
            <Input type="number" step="0.1" value={form.temperature} onChange={e => setForm(f => ({ ...f, temperature: e.target.value }))} placeholder="37.8" />
          </div>
          <div className="space-y-1.5">
            <Label>الرطوبة (%)</Label>
            <Input type="number" step="0.1" value={form.humidity} onChange={e => setForm(f => ({ ...f, humidity: e.target.value }))} placeholder="56" />
          </div>
        </div>
        <p className="text-xs text-blue-600/70">
          <Info className="w-3 h-3 inline ml-1" />
          الموصى به: 37.5–38°م، رطوبة 50–60%
        </p>
      </div>

      {/* Phase 2: Lockdown (days 18-21) */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
        <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
          <ArrowLeftRight className="w-4 h-4" />
          المرحلة الثانية — الإقفال والفقس (اليوم 18 → 21)
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>تاريخ نقل البيض (اليوم 18)</Label>
            <Input type="date" value={form.lockdownDate} onChange={e => setForm(f => ({ ...f, lockdownDate: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>ساعة ودقيقة النقل</Label>
            <Input type="time" value={form.lockdownTime} onChange={e => setForm(f => ({ ...f, lockdownTime: e.target.value }))} placeholder="مثل: 14:00" />
          </div>
          <div className="space-y-1.5">
            <Label>درجة الحرارة (°م)</Label>
            <Input type="number" step="0.1" value={form.lockdownTemperature} onChange={e => setForm(f => ({ ...f, lockdownTemperature: e.target.value }))} placeholder="37.2" />
          </div>
          <div className="space-y-1.5">
            <Label>الرطوبة (%)</Label>
            <Input type="number" step="0.1" value={form.lockdownHumidity} onChange={e => setForm(f => ({ ...f, lockdownHumidity: e.target.value }))} placeholder="70" />
          </div>
        </div>
        <p className="text-xs text-amber-600/70">
          <Info className="w-3 h-3 inline ml-1" />
          الموصى به: 37.0–37.5°م، رطوبة 65–75%
        </p>
      </div>

      {/* Hatch results */}
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground font-semibold text-sm">
          <Egg className="w-4 h-4" />
          نتائج الفقس
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>تاريخ الفقس المتوقع</Label>
            <Input type="date" value={form.expectedHatchDate} onChange={e => setForm(f => ({ ...f, expectedHatchDate: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label>تاريخ الفقس الفعلي</Label>
            <Input type="date" value={form.actualHatchDate} onChange={e => setForm(f => ({ ...f, actualHatchDate: e.target.value }))} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>عدد الفقس الفعلي (اختياري)</Label>
            <Input type="number" min={0} value={form.eggsHatched} onChange={e => setForm(f => ({ ...f, eggsHatched: e.target.value }))} placeholder="يُدخل بعد اكتمال الدفعة" />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label>ملاحظات إضافية</Label>
        <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات اختيارية..." />
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
        <Button type="submit">حفظ الدفعة</Button>
      </div>
    </form>
  );
}

export default function Hatching() {
  const { data: cycles, isLoading } = useListHatchingCycles({ query: { queryKey: getListHatchingCyclesQueryKey() } });
  const createCycle = useCreateHatchingCycle();
  const updateCycle = useUpdateHatchingCycle();
  const deleteCycle = useDeleteHatchingCycle();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: getListHatchingCyclesQueryKey() });

  const handleDelete = async () => {
    if (deleteId == null) return;
    await deleteCycle.mutateAsync({ id: deleteId });
    toast({ title: "تم حذف الدفعة" });
    setDeleteId(null);
    refresh();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">دورات التفقيس</h1>
          <p className="text-muted-foreground text-sm">الدورة 21 يوم — تحضين 18 يوم ثم إقفال وفقس 3 أيام</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />دفعة جديدة</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>إضافة دفعة تفقيس جديدة</DialogTitle></DialogHeader>
            <CycleForm
              onSubmit={async d => {
                await createCycle.mutateAsync({ data: d });
                toast({ title: "تم إضافة الدفعة بنجاح" });
                setOpen(false);
                refresh();
              }}
              onClose={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200">
          <Thermometer className="w-3.5 h-3.5" />
          اليوم 1–18: تحضين — 37.5–38°م / رطوبة 50–60%
        </div>
        <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200">
          <ArrowLeftRight className="w-3.5 h-3.5" />
          اليوم 18–21: إقفال — 37.0–37.5°م / رطوبة 65–75%
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>)}</div>
      ) : cycles?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Egg className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg mb-1">لا توجد دفعات بعد</h3>
            <p className="text-muted-foreground text-sm">أضف أول دفعة تفقيس لبدء المتابعة</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {cycles?.map(cycle => {
            const hatchRate = cycle.eggsHatched != null ? Math.round((cycle.eggsHatched / cycle.eggsSet) * 100) : null;
            return (
              <Card key={cycle.id} className="border-border/60 hover:shadow-md transition-all duration-200">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      {/* Header */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold">{cycle.batchName}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[cycle.status]}`}>
                          {STATUS_LABELS[cycle.status]}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Egg className="w-3.5 h-3.5" />
                          {cycle.eggsSet} بيضة {cycle.eggsHatched != null && `← ${cycle.eggsHatched} فقست (${hatchRate}%)`}
                        </span>
                      </div>

                      {/* Phase 1 */}
                      <div className="flex flex-wrap gap-3 bg-blue-50/60 rounded-lg px-3 py-2 border border-blue-100">
                        <span className="text-xs font-medium text-blue-700">تحضين (1–18):</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          📅 {cycle.startDate}
                          {cycle.setTime && <span className="flex items-center gap-0.5 mr-1"><Clock className="w-3 h-3" />{cycle.setTime}</span>}
                        </span>
                        {cycle.temperature != null && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Thermometer className="w-3 h-3" />{cycle.temperature}°م
                          </span>
                        )}
                        {cycle.humidity != null && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Droplets className="w-3 h-3" />{cycle.humidity}%
                          </span>
                        )}
                      </div>

                      {/* Phase 2 */}
                      <div className="flex flex-wrap gap-3 bg-amber-50/60 rounded-lg px-3 py-2 border border-amber-100">
                        <span className="text-xs font-medium text-amber-700">إقفال (18–21):</span>
                        {cycle.lockdownDate ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            📅 {cycle.lockdownDate}
                            {cycle.lockdownTime && <span className="flex items-center gap-0.5 mr-1"><Clock className="w-3 h-3" />{cycle.lockdownTime}</span>}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">لم يُنقل بعد</span>
                        )}
                        {cycle.lockdownTemperature != null && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Thermometer className="w-3 h-3" />{cycle.lockdownTemperature}°م
                          </span>
                        )}
                        {cycle.lockdownHumidity != null && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Droplets className="w-3 h-3" />{cycle.lockdownHumidity}%
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">متوقع: {cycle.expectedHatchDate}</span>
                        {cycle.actualHatchDate && <span className="text-xs text-emerald-600">فعلي: {cycle.actualHatchDate}</span>}
                      </div>

                      {cycle.notes && (
                        <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2">{cycle.notes}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => setEditItem(cycle)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="destructive" onClick={() => setDeleteId(cycle.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={v => !v && setEditItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>تعديل الدفعة</DialogTitle></DialogHeader>
          {editItem && (
            <CycleForm
              initial={editItem}
              onSubmit={async d => {
                await updateCycle.mutateAsync({ id: editItem.id, data: d });
                toast({ title: "تم التحديث بنجاح" });
                setEditItem(null);
                refresh();
              }}
              onClose={() => setEditItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId != null} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذه الدفعة؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">نعم، احذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
