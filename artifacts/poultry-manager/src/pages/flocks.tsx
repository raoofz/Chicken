import { useState } from "react";
import { useListFlocks, getListFlocksQueryKey, useCreateFlock, useDeleteFlock, useUpdateFlock } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Bird, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PURPOSE_LABELS: Record<string, string> = {
  eggs: "بيض",
  meat: "لحم",
  hatching: "تفقيس",
  mixed: "مختلط",
};

const PURPOSE_COLORS: Record<string, string> = {
  eggs: "bg-amber-100 text-amber-700",
  meat: "bg-red-100 text-red-700",
  hatching: "bg-emerald-100 text-emerald-700",
  mixed: "bg-blue-100 text-blue-700",
};

function FlockForm({ initial, onSubmit, onClose }: {
  initial?: any;
  onSubmit: (data: any) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    breed: initial?.breed ?? "",
    count: initial?.count ?? 1,
    ageWeeks: initial?.ageWeeks ?? 1,
    purpose: initial?.purpose ?? "eggs",
    notes: initial?.notes ?? "",
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label>اسم المجموعة</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="مثل: الدجاجات الرئيسية" required />
        </div>
        <div className="space-y-1.5">
          <Label>السلالة</Label>
          <Input value={form.breed} onChange={e => setForm(f => ({ ...f, breed: e.target.value }))} placeholder="مثل: عرب بلدي" required />
        </div>
        <div className="space-y-1.5">
          <Label>العدد</Label>
          <Input type="number" min={1} value={form.count} onChange={e => setForm(f => ({ ...f, count: Number(e.target.value) }))} required />
        </div>
        <div className="space-y-1.5">
          <Label>العمر (أسابيع)</Label>
          <Input type="number" min={1} value={form.ageWeeks} onChange={e => setForm(f => ({ ...f, ageWeeks: Number(e.target.value) }))} required />
        </div>
        <div className="space-y-1.5">
          <Label>الغرض</Label>
          <Select value={form.purpose} onValueChange={v => setForm(f => ({ ...f, purpose: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="eggs">بيض</SelectItem>
              <SelectItem value="meat">لحم</SelectItem>
              <SelectItem value="hatching">تفقيس</SelectItem>
              <SelectItem value="mixed">مختلط</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>ملاحظات (اختياري)</Label>
          <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات إضافية..." />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
        <Button type="submit">حفظ</Button>
      </div>
    </form>
  );
}

export default function Flocks() {
  const { data: flocks, isLoading } = useListFlocks({ query: { queryKey: getListFlocksQueryKey() } });
  const createFlock = useCreateFlock();
  const updateFlock = useUpdateFlock();
  const deleteFlock = useDeleteFlock();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: getListFlocksQueryKey() });

  const handleCreate = async (data: any) => {
    await createFlock.mutateAsync({ data });
    toast({ title: "تمت إضافة الدجاجات بنجاح" });
    setOpen(false);
    refresh();
  };

  const handleUpdate = async (data: any) => {
    await updateFlock.mutateAsync({ id: editItem.id, data });
    toast({ title: "تم تحديث الدجاجات" });
    setEditItem(null);
    refresh();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذه المجموعة؟")) return;
    await deleteFlock.mutateAsync({ id });
    toast({ title: "تم حذف المجموعة" });
    refresh();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الدجاجات</h1>
          <p className="text-muted-foreground text-sm">إدارة مجموعات الدجاجات وبياناتها</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />إضافة مجموعة</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>إضافة مجموعة دجاجات جديدة</DialogTitle></DialogHeader>
            <FlockForm onSubmit={handleCreate} onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>)}
        </div>
      ) : flocks?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Bird className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg mb-1">لا توجد دجاجات بعد</h3>
            <p className="text-muted-foreground text-sm">أضف أول مجموعة دجاجات لبدء المتابعة</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flocks?.map(flock => (
            <Card key={flock.id} className="hover:shadow-md transition-all duration-200 border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-base">{flock.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">{flock.breed}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PURPOSE_COLORS[flock.purpose]}`}>
                    {PURPOSE_LABELS[flock.purpose]}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <div className="font-bold text-lg text-primary">{flock.count}</div>
                    <div className="text-muted-foreground text-xs">طير</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <div className="font-bold text-lg text-primary">{flock.ageWeeks}</div>
                    <div className="text-muted-foreground text-xs">أسبوع</div>
                  </div>
                </div>
                {flock.notes && <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2">{flock.notes}</p>}
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setEditItem(flock)} className="gap-1.5">
                    <Pencil className="w-3 h-3" />تعديل
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(flock.id)} className="gap-1.5">
                    <Trash2 className="w-3 h-3" />حذف
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editItem} onOpenChange={v => !v && setEditItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>تعديل مجموعة الدجاجات</DialogTitle></DialogHeader>
          {editItem && <FlockForm initial={editItem} onSubmit={handleUpdate} onClose={() => setEditItem(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
