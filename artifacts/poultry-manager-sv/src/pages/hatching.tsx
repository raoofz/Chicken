import { useState } from "react";
import { useListHatchingCycles, getListHatchingCyclesQueryKey, useCreateHatchingCycle, useDeleteHatchingCycle, useUpdateHatchingCycle } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Egg, Pencil, Trash2, Thermometer, Droplets, Clock, ArrowLeftRight, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const STATUS_LABELS: Record<string, string> = { incubating: "Ruvning", hatching: "Kläcks nu", completed: "Klar", failed: "Misslyckad" };
const STATUS_COLORS: Record<string, string> = { incubating: "bg-blue-100 text-blue-700", hatching: "bg-amber-100 text-amber-700", completed: "bg-emerald-100 text-emerald-700", failed: "bg-red-100 text-red-700" };

function CycleForm({ initial, onSubmit, onClose }: { initial?: any; onSubmit: (d: any) => void; onClose: () => void }) {
  const today = new Date().toISOString().split("T")[0];
  const in18 = new Date(Date.now() + 18 * 86400000).toISOString().split("T")[0];
  const in21 = new Date(Date.now() + 21 * 86400000).toISOString().split("T")[0];
  const [form, setForm] = useState({
    batchName: initial?.batchName ?? "", eggsSet: initial?.eggsSet ?? 1, eggsHatched: initial?.eggsHatched ?? "",
    startDate: initial?.startDate ?? today, setTime: initial?.setTime ?? "",
    expectedHatchDate: initial?.expectedHatchDate ?? in21, actualHatchDate: initial?.actualHatchDate ?? "",
    lockdownDate: initial?.lockdownDate ?? in18, lockdownTime: initial?.lockdownTime ?? "",
    status: initial?.status ?? "incubating", temperature: initial?.temperature ?? "", humidity: initial?.humidity ?? "",
    lockdownTemperature: initial?.lockdownTemperature ?? "", lockdownHumidity: initial?.lockdownHumidity ?? "", notes: initial?.notes ?? "",
  });
  const toNum = (v: string) => v !== "" ? Number(v) : null;
  const toStr = (v: string) => v || null;

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ ...form, eggsHatched: toNum(String(form.eggsHatched)), temperature: toNum(String(form.temperature)), humidity: toNum(String(form.humidity)), lockdownTemperature: toNum(String(form.lockdownTemperature)), lockdownHumidity: toNum(String(form.lockdownHumidity)), actualHatchDate: toStr(form.actualHatchDate), setTime: toStr(form.setTime), lockdownDate: toStr(form.lockdownDate), lockdownTime: toStr(form.lockdownTime) }); }} className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
      <div className="space-y-3">
        <div className="space-y-1.5"><Label>Namn på omgång</Label><Input value={form.batchName} onChange={e => setForm(f => ({ ...f, batchName: e.target.value }))} placeholder="T.ex. Omgång 3" required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Antal ägg</Label><Input type="number" min={1} value={form.eggsSet} onChange={e => setForm(f => ({ ...f, eggsSet: Number(e.target.value) }))} required /></div>
          <div className="space-y-1.5"><Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="incubating">Ruvning</SelectItem><SelectItem value="hatching">Kläcks nu</SelectItem>
                <SelectItem value="completed">Klar</SelectItem><SelectItem value="failed">Misslyckad</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3">
        <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm"><Thermometer className="w-4 h-4" />Fas 1 — Ruvning (dag 1–18)</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Startdatum</Label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required /></div>
          <div className="space-y-1.5"><Label>Tid</Label><Input type="time" value={form.setTime} onChange={e => setForm(f => ({ ...f, setTime: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Temperatur (°C)</Label><Input type="number" step="0.1" value={form.temperature} onChange={e => setForm(f => ({ ...f, temperature: e.target.value }))} placeholder="37.8" /></div>
          <div className="space-y-1.5"><Label>Luftfuktighet (%)</Label><Input type="number" step="0.1" value={form.humidity} onChange={e => setForm(f => ({ ...f, humidity: e.target.value }))} placeholder="56" /></div>
        </div>
        <p className="text-xs text-blue-600/70"><Info className="w-3 h-3 inline mr-1" />Rekommenderat: 37.5–38°C, fuktighet 50–60%</p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
        <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm"><ArrowLeftRight className="w-4 h-4" />Fas 2 — Kläckning (dag 18–21)</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Flyttdatum (dag 18)</Label><Input type="date" value={form.lockdownDate} onChange={e => setForm(f => ({ ...f, lockdownDate: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Tid</Label><Input type="time" value={form.lockdownTime} onChange={e => setForm(f => ({ ...f, lockdownTime: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Temperatur (°C)</Label><Input type="number" step="0.1" value={form.lockdownTemperature} onChange={e => setForm(f => ({ ...f, lockdownTemperature: e.target.value }))} placeholder="37.2" /></div>
          <div className="space-y-1.5"><Label>Luftfuktighet (%)</Label><Input type="number" step="0.1" value={form.lockdownHumidity} onChange={e => setForm(f => ({ ...f, lockdownHumidity: e.target.value }))} placeholder="70" /></div>
        </div>
        <p className="text-xs text-amber-600/70"><Info className="w-3 h-3 inline mr-1" />Rekommenderat: 37.0–37.5°C, fuktighet 70–75%</p>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground font-semibold text-sm"><Egg className="w-4 h-4" />Resultat</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Beräknat kläckdatum</Label><Input type="date" value={form.expectedHatchDate} onChange={e => setForm(f => ({ ...f, expectedHatchDate: e.target.value }))} required /></div>
          <div className="space-y-1.5"><Label>Faktiskt kläckdatum</Label><Input type="date" value={form.actualHatchDate} onChange={e => setForm(f => ({ ...f, actualHatchDate: e.target.value }))} /></div>
          <div className="col-span-2 space-y-1.5"><Label>Antal kläckta (valfritt)</Label><Input type="number" min={0} value={form.eggsHatched} onChange={e => setForm(f => ({ ...f, eggsHatched: e.target.value }))} placeholder="Fylls i efter avslutad omgång" /></div>
        </div>
      </div>

      <div className="space-y-1.5"><Label>Anteckningar</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Valfria anteckningar..." /></div>
      <div className="flex gap-2 justify-end pt-1"><Button type="button" variant="outline" onClick={onClose}>Avbryt</Button><Button type="submit">Spara</Button></div>
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
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: getListHatchingCyclesQueryKey() });
  const handleDelete = async () => {
    if (deleteId == null) return;
    try { await deleteCycle.mutateAsync({ id: deleteId }); toast({ title: "Omgång borttagen" }); setDeleteId(null); refresh(); }
    catch (err: any) { toast({ title: "Kunde inte ta bort", description: err?.message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kläckning</h1>
          <p className="text-muted-foreground text-sm">21 dagar: 18 dagars ruvning + 3 dagars kläckning</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" />Ny omgång</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Ny kläckningsomgång</DialogTitle></DialogHeader>
              <CycleForm onSubmit={async d => { try { await createCycle.mutateAsync({ data: d }); toast({ title: "Omgång skapad" }); setOpen(false); refresh(); } catch (err: any) { toast({ title: "Fel", description: err?.message, variant: "destructive" }); } }} onClose={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200"><Thermometer className="w-3.5 h-3.5" />Dag 1–18: Ruvning — 37.5–38°C / fuktighet 50–55%</div>
        <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200"><ArrowLeftRight className="w-3.5 h-3.5" />Dag 18–21: Kläckning — 37.0–37.5°C / fuktighet 70–75%</div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>)}</div>
      ) : cycles?.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Egg className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">Inga omgångar ännu</h3>
          <p className="text-muted-foreground text-sm">Lägg till din första kläckningsomgång</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {cycles?.map(cycle => {
            const hatchRate = cycle.eggsHatched != null ? Math.round((cycle.eggsHatched / cycle.eggsSet) * 100) : null;
            return (
              <Card key={cycle.id} className="border-border/60 hover:shadow-md transition-all duration-200">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold">{cycle.batchName}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[cycle.status]}`}>{STATUS_LABELS[cycle.status]}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Egg className="w-3.5 h-3.5" />{cycle.eggsSet} ägg {cycle.eggsHatched != null && `→ ${cycle.eggsHatched} kläckta (${hatchRate}%)`}</span>
                      </div>
                      <div className="flex flex-wrap gap-3 bg-blue-50/60 rounded-lg px-3 py-2 border border-blue-100">
                        <span className="text-xs font-medium text-blue-700">Ruvning (1–18):</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">{cycle.startDate}{cycle.setTime && <span className="flex items-center gap-0.5 ml-1"><Clock className="w-3 h-3" />{cycle.setTime}</span>}</span>
                        {cycle.temperature != null && <span className="text-xs text-muted-foreground flex items-center gap-1"><Thermometer className="w-3 h-3" />{cycle.temperature}°C</span>}
                        {cycle.humidity != null && <span className="text-xs text-muted-foreground flex items-center gap-1"><Droplets className="w-3 h-3" />{cycle.humidity}%</span>}
                      </div>
                      <div className="flex flex-wrap gap-3 bg-amber-50/60 rounded-lg px-3 py-2 border border-amber-100">
                        <span className="text-xs font-medium text-amber-700">Kläckning (18–21):</span>
                        {cycle.lockdownDate ? <span className="text-xs text-muted-foreground flex items-center gap-1">{cycle.lockdownDate}{cycle.lockdownTime && <span className="flex items-center gap-0.5 ml-1"><Clock className="w-3 h-3" />{cycle.lockdownTime}</span>}</span> : <span className="text-xs text-muted-foreground/50">Inte flyttad ännu</span>}
                        {cycle.lockdownTemperature != null && <span className="text-xs text-muted-foreground flex items-center gap-1"><Thermometer className="w-3 h-3" />{cycle.lockdownTemperature}°C</span>}
                        {cycle.lockdownHumidity != null && <span className="text-xs text-muted-foreground flex items-center gap-1"><Droplets className="w-3 h-3" />{cycle.lockdownHumidity}%</span>}
                        <span className="text-xs text-muted-foreground">Beräknat: {cycle.expectedHatchDate}</span>
                        {cycle.actualHatchDate && <span className="text-xs text-emerald-600">Faktiskt: {cycle.actualHatchDate}</span>}
                      </div>
                      {cycle.notes && <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2">{cycle.notes}</p>}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => setEditItem(cycle)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="destructive" onClick={() => setDeleteId(cycle.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editItem} onOpenChange={v => !v && setEditItem(null)}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Ändra omgång</DialogTitle></DialogHeader>
          {editItem && <CycleForm initial={editItem} onSubmit={async d => { try { await updateCycle.mutateAsync({ id: editItem.id, data: d }); toast({ title: "Omgång uppdaterad" }); setEditItem(null); refresh(); } catch (err: any) { toast({ title: "Fel", description: err?.message, variant: "destructive" }); } }} onClose={() => setEditItem(null)} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId != null} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Ta bort omgång?</AlertDialogTitle><AlertDialogDescription>Är du säker? Detta går inte att ångra.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Avbryt</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Ja, ta bort</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
