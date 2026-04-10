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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Egg, Pencil, Trash2, Thermometer, Droplets } from "lucide-react";
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
  const in21 = new Date(Date.now() + 21 * 86400000).toISOString().split("T")[0];
  const [form, setForm] = useState({
    batchName: initial?.batchName ?? "",
    eggsSet: initial?.eggsSet ?? 1,
    eggsHatched: initial?.eggsHatched ?? "",
    startDate: initial?.startDate ?? today,
    expectedHatchDate: initial?.expectedHatchDate ?? in21,
    actualHatchDate: initial?.actualHatchDate ?? "",
    status: initial?.status ?? "incubating",
    temperature: initial?.temperature ?? "",
    humidity: initial?.humidity ?? "",
    notes: initial?.notes ?? "",
  });

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ ...form, eggsHatched: form.eggsHatched ? Number(form.eggsHatched) : null, temperature: form.temperature ? Number(form.temperature) : null, humidity: form.humidity ? Number(form.humidity) : null, actualHatchDate: form.actualHatchDate || null }); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>اسم الدفعة</Label>
          <Input value={form.batchName} onChange={e => setForm(f => ({ ...f, batchName: e.target.value }))} placeholder="مثل: الدفعة الثالثة" required />
        </div>
        <div className="space-y-1.5">
          <Label>عدد البيض المحضّن</Label>
          <Input type="number" min={1} value={form.eggsSet} onChange={e => setForm(f => ({ ...f, eggsSet: Number(e.target.value) }))} required />
        </div>
        <div className="space-y-1.5">
          <Label>عدد الفقس (اختياري)</Label>
          <Input type="number" min={0} value={form.eggsHatched} onChange={e => setForm(f => ({ ...f, eggsHatched: e.target.value }))} placeholder="بعد الاكتمال" />
        </div>
        <div className="space-y-1.5">
          <Label>تاريخ البدء</Label>
          <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
        </div>
        <div className="space-y-1.5">
          <Label>تاريخ الفقس المتوقع</Label>
          <Input type="date" value={form.expectedHatchDate} onChange={e => setForm(f => ({ ...f, expectedHatchDate: e.target.value }))} required />
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
        <div className="space-y-1.5">
          <Label>تاريخ الفقس الفعلي</Label>
          <Input type="date" value={form.actualHatchDate} onChange={e => setForm(f => ({ ...f, actualHatchDate: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>درجة الحرارة (°م)</Label>
          <Input type="number" step="0.1" value={form.temperature} onChange={e => setForm(f => ({ ...f, temperature: e.target.value }))} placeholder="37.5" />
        </div>
        <div className="space-y-1.5">
          <Label>الرطوبة (%)</Label>
          <Input type="number" step="0.1" value={form.humidity} onChange={e => setForm(f => ({ ...f, humidity: e.target.value }))} placeholder="60" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>ملاحظات</Label>
          <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات اختيارية..." />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
        <Button type="submit">حفظ</Button>
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

  const refresh = () => qc.invalidateQueries({ queryKey: getListHatchingCyclesQueryKey() });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">دورات التفقيس</h1>
          <p className="text-muted-foreground text-sm">تتبع دفعات البيض ومعدلات الفقس</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />دفعة جديدة</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>إضافة دفعة تفقيس جديدة</DialogTitle></DialogHeader>
            <CycleForm onSubmit={async d => { await createCycle.mutateAsync({ data: d }); toast({ title: "تم إضافة الدفعة" }); setOpen(false); refresh(); }} onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>)}</div>
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
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold">{cycle.batchName}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[cycle.status]}`}>
                          {STATUS_LABELS[cycle.status]}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Egg className="w-3.5 h-3.5" />
                          {cycle.eggsSet} بيضة {cycle.eggsHatched != null && `← ${cycle.eggsHatched} فقست (${hatchRate}%)`}
                        </span>
                        {cycle.temperature != null && (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Thermometer className="w-3.5 h-3.5" />{cycle.temperature}°م
                          </span>
                        )}
                        {cycle.humidity != null && (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Droplets className="w-3.5 h-3.5" />{cycle.humidity}%
                          </span>
                        )}
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>البدء: {cycle.startDate}</span>
                        <span>المتوقع: {cycle.expectedHatchDate}</span>
                        {cycle.actualHatchDate && <span>الفعلي: {cycle.actualHatchDate}</span>}
                      </div>
                      {cycle.notes && <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2">{cycle.notes}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => setEditItem(cycle)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="destructive" onClick={async () => { if (!confirm("حذف هذه الدفعة؟")) return; await deleteCycle.mutateAsync({ id: cycle.id }); toast({ title: "تم الحذف" }); refresh(); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editItem} onOpenChange={v => !v && setEditItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>تعديل الدفعة</DialogTitle></DialogHeader>
          {editItem && <CycleForm initial={editItem} onSubmit={async d => { await updateCycle.mutateAsync({ id: editItem.id, data: d }); toast({ title: "تم التحديث" }); setEditItem(null); refresh(); }} onClose={() => setEditItem(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
