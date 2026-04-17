import { useState } from "react";
import {
  useListFlocks, getListFlocksQueryKey,
  useCreateFlock, useDeleteFlock, useUpdateFlock,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Bird, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

function calcAgeDays(birthDate: string) {
  if (!birthDate) return 0;
  const start = new Date(birthDate);
  const now = new Date();
  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function FlockForm({ initial, onSubmit, onClose, isEdit }: { initial?: any; onSubmit: (data: any) => void; onClose: () => void; isEdit?: boolean }) {
  const { t } = useLanguage();
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? "");
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    breed: initial?.breed ?? "",
    count: initial?.count ?? 1,
    ageDays: initial?.ageDays ?? calcAgeDays(initial?.birthDate ?? ""),
    purpose: initial?.purpose ?? "eggs",
    notes: initial?.notes ?? "",
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label>{t("flocks.groupName")}</Label>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("flocks.groupName.placeholder")} required autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label>{t("flocks.breed")}</Label>
          <Input value={form.breed} onChange={(e) => setForm((f) => ({ ...f, breed: e.target.value }))} placeholder={t("flocks.breed.placeholder")} required />
        </div>
        <div className="space-y-1.5">
          <Label>{t("flocks.count")}</Label>
          <Input type="number" min={1} value={form.count} onChange={(e) => setForm((f) => ({ ...f, count: Number(e.target.value) }))} required />
        </div>
        <div className="space-y-1.5">
          <Label>{t("flocks.birthDate")}</Label>
          <Input type="date" value={birthDate} onChange={(e) => { const value = e.target.value; setBirthDate(value); setForm((f) => ({ ...f, ageDays: calcAgeDays(value) })); }} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("flocks.ageDays")}</Label>
          <Input type="number" min={0} value={form.ageDays} onChange={(e) => setForm((f) => ({ ...f, ageDays: Number(e.target.value) }))} required />
        </div>
        <div className="space-y-1.5">
          <Label>{t("flocks.purpose")}</Label>
          <Select value={form.purpose} onValueChange={(v) => setForm((f) => ({ ...f, purpose: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="eggs">🥚 {t("purpose.eggs")}</SelectItem>
              <SelectItem value="meat">🍗 {t("purpose.meat")}</SelectItem>
              <SelectItem value="hatching">🐣 {t("purpose.hatching")}</SelectItem>
              <SelectItem value="mixed">🔄 {t("purpose.mixed")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>{t("flocks.notes")}</Label>
          <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t("flocks.notes.placeholder")} />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button type="submit">{isEdit ? t("flocks.updateData") : t("common.add")}</Button>
      </div>
    </form>
  );
}

export default function Flocks() {
  const { isAdmin } = useAuth();
  const { t } = useLanguage();
  const { data: flocks, isLoading } = useListFlocks();
  const createFlock = useCreateFlock();
  const updateFlock = useUpdateFlock();
  const deleteFlock = useDeleteFlock();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const PURPOSE_LABELS: Record<string, string> = {
    eggs: t("purpose.eggs"), meat: t("purpose.meat"), hatching: t("purpose.hatching"), mixed: t("purpose.mixed"),
  };
  const PURPOSE_COLORS: Record<string, string> = {
    eggs: "bg-amber-100 text-amber-700 border border-amber-200",
    meat: "bg-red-100 text-red-700 border border-red-200",
    hatching: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    mixed: "bg-blue-100 text-blue-700 border border-blue-200",
  };

  const refresh = () => qc.invalidateQueries({ queryKey: getListFlocksQueryKey() });

  const handleCreate = async (data: any) => {
    try {
      await createFlock.mutateAsync({ data });
      toast({ title: t("flocks.added") });
      setOpen(false);
      refresh();
    } catch (err: any) {
      toast({ title: t("common.addError"), description: err?.message ?? t("common.addErrorDesc"), variant: "destructive" });
    }
  };

  const handleUpdate = async (data: any) => {
    try {
      await updateFlock.mutateAsync({ id: editItem.id, data });
      toast({ title: t("flocks.updated") });
      setEditItem(null);
      refresh();
    } catch (err: any) {
      toast({ title: t("common.updateError"), description: err?.message ?? t("common.addErrorDesc"), variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (deleteId == null) return;
    try {
      await deleteFlock.mutateAsync({ id: deleteId });
      toast({ title: t("flocks.deleted") });
      setDeleteId(null);
      refresh();
    } catch (err: any) {
      toast({ title: t("common.deleteError"), description: err?.message, variant: "destructive" });
    }
  };

  const totalChickens = flocks?.reduce((s, f) => s + f.count, 0) ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("flocks.title")}</h1>
          <p className="text-muted-foreground text-sm">
            {flocks?.length ?? 0} {t("flocks.groups")} — {totalChickens} {t("flocks.totalBirds")}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" />{t("flocks.addGroup")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("flocks.addGroupTitle")}</DialogTitle></DialogHeader>
              <FlockForm onSubmit={handleCreate} onClose={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (<Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>))}
        </div>
      ) : flocks?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Bird className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg mb-1">{t("flocks.noFlocks")}</h3>
            <p className="text-muted-foreground text-sm">
              {isAdmin ? t("flocks.noFlocks.admin") : t("flocks.noFlocks.worker")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flocks?.map((flock) => (
            <Card key={flock.id} className="hover:shadow-md transition-all duration-200 border-border/60 group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-base leading-snug">{flock.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">{flock.breed}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap ${PURPOSE_COLORS[flock.purpose]}`}>
                    {PURPOSE_LABELS[flock.purpose]}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted/50 rounded-xl p-3 text-center">
                    <div className="font-bold text-xl text-primary">{flock.count}</div>
                    <div className="text-muted-foreground text-xs mt-0.5">{t("flocks.bird")}</div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3 text-center">
                    <div className="font-bold text-xl text-primary">{flock.birthDate ? calcAgeDays(flock.birthDate) : flock.ageDays}</div>
                    <div className="text-muted-foreground text-xs mt-0.5">{t("flocks.day")}</div>
                  </div>
                </div>
                {flock.notes && (
                  <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-2.5 leading-relaxed">{flock.notes}</p>
                )}
                {isAdmin && (
                  <div className="flex gap-2 justify-end pt-1">
                    <Button size="sm" variant="outline" onClick={() => setEditItem(flock)} className="gap-1.5 h-8">
                      <Pencil className="w-3 h-3" />{t("common.edit")}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeleteId(flock.id)} className="gap-1.5 h-8">
                      <Trash2 className="w-3 h-3" />{t("common.delete")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editItem} onOpenChange={(v) => !v && setEditItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("flocks.editGroupTitle")}</DialogTitle></DialogHeader>
          {editItem && <FlockForm initial={editItem} onSubmit={handleUpdate} onClose={() => setEditItem(null)} isEdit />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId != null} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("common.confirmDeleteFlock")}</AlertDialogDescription>
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
