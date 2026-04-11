import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, FileText, Calendar, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = { general: "Allm\u00e4nt", health: "H\u00e4lsa", production: "Produktion", feeding: "Utfodring", maintenance: "Underh\u00e5ll", observation: "Observation" };
const CATEGORY_COLORS: Record<string, string> = { general: "bg-slate-100 text-slate-700", health: "bg-red-50 text-red-700", production: "bg-amber-50 text-amber-700", feeding: "bg-green-50 text-green-700", maintenance: "bg-blue-50 text-blue-700", observation: "bg-purple-50 text-purple-700" };

async function fetchNotes() { const res = await fetch("/api/notes?limit=100", { credentials: "include" }); if (!res.ok) throw new Error("Kunde inte h\u00e4mta anteckningar"); return res.json(); }
async function createNote(data: { content: string; date: string; category: string }) { const res = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) }); if (!res.ok) throw new Error("Kunde inte l\u00e4gga till anteckning"); return res.json(); }
async function deleteNote(id: number) { const res = await fetch(`/api/notes/${id}`, { method: "DELETE", credentials: "include" }); if (!res.ok) throw new Error("Kunde inte ta bort anteckning"); }

export default function Notes() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: notes, isLoading } = useQuery({ queryKey: ["notes"], queryFn: fetchNotes });
  const addMutation = useMutation({ mutationFn: createNote, onSuccess: () => { toast({ title: "Anteckning tillagd" }); qc.invalidateQueries({ queryKey: ["notes"] }); setContent(""); setOpen(false); }, onError: () => toast({ title: "Fel", description: "Kunde inte l\u00e4gga till", variant: "destructive" }) });
  const deleteMutation = useMutation({ mutationFn: deleteNote, onSuccess: () => { toast({ title: "Anteckning borttagen" }); qc.invalidateQueries({ queryKey: ["notes"] }); setDeleteId(null); }, onError: () => toast({ title: "Fel", description: "Kunde inte ta bort", variant: "destructive" }) });

  const grouped = (notes ?? []).reduce((acc: Record<string, any[]>, note: any) => { const d = note.date; if (!acc[d]) acc[d] = []; acc[d].push(note); return acc; }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const formatDate = (dateStr: string) => {
    if (dateStr === today) return "Idag";
    const d = new Date(dateStr + "T00:00:00");
    const DAYS = ["s\u00f6ndag","m\u00e5ndag","tisdag","onsdag","torsdag","fredag","l\u00f6rdag"];
    const MONTHS = ["januari","februari","mars","april","maj","juni","juli","augusti","september","oktober","november","december"];
    return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Dagliga anteckningar</h1><p className="text-muted-foreground text-sm">Dokumentera observationer och dagliga h\u00e4ndelser</p></div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" />Ny anteckning</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>L\u00e4gg till daglig anteckning</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Datum</Label><input type="date" className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Kategori</Label>
                    <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5"><Label>Inneh\u00e5ll *</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Skriv dina anteckningar h\u00e4r..." rows={5} className="resize-none" autoFocus /></div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setOpen(false)}>Avbryt</Button>
                  <Button onClick={() => addMutation.mutate({ content, date: selectedDate, category })} disabled={!content.trim() || addMutation.isPending}>{addMutation.isPending ? "Sparar..." : "Spara"}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">{[1,2,3].map(i => <Card key={i}><CardContent className="p-5"><Skeleton className="h-20 w-full" /></CardContent></Card>)}</div>
      ) : sortedDates.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">Inga anteckningar \u00e4nnu</h3>
          <p className="text-muted-foreground text-sm">{isAdmin ? "B\u00f6rja dokumentera dina dagliga observationer" : "Inga anteckningar har registrerats \u00e4nnu"}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm text-primary">{formatDate(date)}</span>
                <span className="text-xs text-muted-foreground">{date}</span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{grouped[date].length} anteckning{grouped[date].length > 1 ? "ar" : ""}</span>
              </div>
              <div className="space-y-3">
                {grouped[date].map((note: any) => (
                  <Card key={note.id} className="border-border/60 hover:shadow-sm transition-all duration-200">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1", CATEGORY_COLORS[note.category])}><Tag className="w-3 h-3" />{CATEGORY_LABELS[note.category]}</span>
                            {note.authorName && <span className="text-xs text-muted-foreground">av: {note.authorName}</span>}
                            <span className="text-xs text-muted-foreground ml-auto">{new Date(note.createdAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
                        </div>
                        {isAdmin && <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive shrink-0 w-8 h-8 p-0" onClick={() => setDeleteId(note.id)}><Trash2 className="w-4 h-4" /></Button>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={deleteId != null} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Bekr\u00e4fta borttagning</AlertDialogTitle><AlertDialogDescription>\u00c4r du s\u00e4ker p\u00e5 att du vill ta bort denna anteckning? Detta kan inte \u00e5ngras.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Avbryt</AlertDialogCancel><AlertDialogAction onClick={() => deleteId != null && deleteMutation.mutate(deleteId)} className="bg-destructive hover:bg-destructive/90">Ja, ta bort</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
