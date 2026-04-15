/**
 * ملاحظات يومية — Daily Notes
 * Smart text notes with AI parsing
 */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Trash2, FileText, Brain, Calendar,
  MessageSquare, Loader2, X, ChevronRight,
  Sparkles, CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

// ─── API helpers ─────────────────────────────────────────────────────────────
async function fetchNotes() {
  const r = await fetch("/api/notes?limit=100", { credentials: "include" });
  if (!r.ok) throw new Error("fetch_error");
  return r.json();
}
async function createNote(data: { content: string; date: string; category: string }) {
  const r = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
  if (!r.ok) throw new Error("add_error");
  return r.json();
}
async function deleteNote(id: number) {
  const r = await fetch(`/api/notes/${id}`, { method: "DELETE", credentials: "include" });
  if (!r.ok) throw new Error("delete_error");
}

// ─── Types ────────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  general:     { bg: "bg-slate-50",   text: "text-slate-700",  border: "border-slate-200" },
  health:      { bg: "bg-red-50",     text: "text-red-700",    border: "border-red-200" },
  production:  { bg: "bg-amber-50",   text: "text-amber-700",  border: "border-amber-200" },
  feeding:     { bg: "bg-green-50",   text: "text-green-700",  border: "border-green-200" },
  maintenance: { bg: "bg-blue-50",    text: "text-blue-700",   border: "border-blue-200" },
  observation: { bg: "bg-purple-50",  text: "text-purple-700", border: "border-purple-200" },
  incubator:   { bg: "bg-orange-50",  text: "text-orange-700", border: "border-orange-200" },
  flock:       { bg: "bg-teal-50",    text: "text-teal-700",   border: "border-teal-200" },
};

const NOTE_CATEGORY_KEYS = ["general","health","production","feeding","maintenance","observation","incubator","flock"] as const;

// ─── Smart Analysis Card ──────────────────────────────────────────────────────
interface SmartAnalysisResult {
  summary: string;
  totalSaved: number;
  totalExtracted: number;
  saved: Array<{ type: string; id: number; description: string }>;
}

const TYPE_ICONS: Record<string, string> = {
  hatching_cycle: "🥚", hatching_result: "🐣", transaction: "💰", flock: "🐔", task: "📋",
};
const TYPE_LABEL_KEYS: Record<string, string> = {
  hatching_cycle: "smart.hatching_cycle", hatching_result: "smart.hatching_result",
  transaction: "smart.transaction", flock: "smart.flock", task: "smart.task",
};

function SmartAnalysisCard({ loading, result, onDismiss }: {
  loading: boolean; result: SmartAnalysisResult | null; onDismiss: () => void;
}) {
  const { t } = useLanguage();
  if (!loading && !result) return null;

  return (
    <div className="animate-in slide-in-from-top-2 duration-300">
      <Card className="border border-purple-200 dark:border-purple-800/40 bg-purple-50 dark:bg-purple-950/20 shadow-sm overflow-hidden">
        <CardContent className="p-3">
          {loading ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">{t("smart.analyzing")}</p>
                <p className="text-xs text-purple-500">{t("smart.analyzing.desc")}</p>
              </div>
              <Loader2 className="w-4 h-4 animate-spin text-purple-500 mr-auto" />
            </div>
          ) : result ? (
            <>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-purple-700 dark:text-purple-300">
                      {t("smart.done")} — {result.totalSaved} {t("smart.items.saved")}
                    </p>
                    <button onClick={onDismiss} className="text-purple-400 hover:text-purple-600 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">{result.summary}</p>
                  <div className="mt-2 space-y-1">
                    {result.saved.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-purple-700 dark:text-purple-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span className="font-medium">{TYPE_ICONS[item.type]} {t(TYPE_LABEL_KEYS[item.type] ?? item.type)}</span>
                        <ChevronRight className="w-3 h-3 opacity-40" />
                        <span className="text-purple-600 dark:text-purple-400 truncate">{item.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Notes() {
  const { isAdmin } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [selectedDate, setSelectedDate] = useState(today);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [smartResult, setSmartResult] = useState<SmartAnalysisResult | null>(null);
  const [smartLoading, setSmartLoading] = useState(false);
  const pendingNoteRef = useRef<{ content: string; date: string } | null>(null);

  const { data: notes = [], isLoading: notesLoading } = useQuery({ queryKey: ["notes"], queryFn: fetchNotes });

  const addNote = useMutation({
    mutationFn: createNote,
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      toast({ title: t("notes.added.toast") });
      setOpen(false);
      const pending = pendingNoteRef.current;
      setContent("");
      pendingNoteRef.current = null;
      if (pending && pending.content.trim().length > 5) {
        setSmartLoading(true);
        setSmartResult(null);
        try {
          const r = await fetch("/api/ai/smart-analyze", {
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
    onError: () => toast({ title: t("notes.add.error"), variant: "destructive" }),
  });

  const delNote = useMutation({
    mutationFn: deleteNote,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notes"] }); toast({ title: t("notes.deleted.toast") }); setDeleteId(null); },
    onError: () => toast({ title: t("notes.del.error"), variant: "destructive" }),
  });

  return (
    <div className="flex flex-col gap-5 pb-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t("nav.notes")}</h1>
            <p className="text-xs text-muted-foreground">
              {notes.length} {t("notes.note.unit")}
            </p>
          </div>
        </div>

        {/* Add note */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-none shadow-md">
              <Plus className="w-4 h-4" />{t("notes.add")}
            </Button>
          </DialogTrigger>
          <DialogContent dir={lang === "ar" ? "rtl" : "ltr"}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-500" />
                {t("notes.new")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">{t("notes.date.label")}</label>
                  <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">{t("notes.cat.label")}</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {NOTE_CATEGORY_KEYS.map(v => (
                        <SelectItem key={v} value={v}>{t(`notecat.${v}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">{t("notes.content.label")}</label>
                <Textarea
                  placeholder={t("notes.input.placeholder")}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className="min-h-[120px] resize-none"
                />
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-2.5 flex items-start gap-2 border border-purple-100 dark:border-purple-800/30">
                <Sparkles className="w-3.5 h-3.5 text-purple-500 mt-0.5 shrink-0" />
                <p className="text-xs text-purple-700 dark:text-purple-300">{t("notes.smart.hint")}</p>
              </div>
              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2"
                disabled={!content.trim() || addNote.isPending}
                onClick={() => {
                  pendingNoteRef.current = { content, date: selectedDate };
                  addNote.mutate({ content, date: selectedDate, category });
                }}
              >
                {addNote.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />{t("notes.saving")}</>
                ) : (
                  <><Sparkles className="w-4 h-4" />{t("notes.save")}</>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Smart Analysis Card */}
      <SmartAnalysisCard
        loading={smartLoading}
        result={smartResult}
        onDismiss={() => setSmartResult(null)}
      />

      {/* Notes list */}
      {notesLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : notes.length === 0 ? (
        <Card className="py-16 text-center border-dashed">
          <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t("notes.nonotes")}</p>
          <p className="text-muted-foreground/60 text-xs mt-1">{t("notes.nonotes.desc")}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {notes.map((note: any) => {
            const colors = CATEGORY_COLORS[note.category] ?? CATEGORY_COLORS.general;
            return (
              <Card key={note.id} className={cn("border hover:shadow-sm transition-shadow", colors.border)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge className={cn("text-xs font-medium border-0", colors.bg, colors.text)}>
                          {t(`notecat.${note.category}`) || note.category}
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
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600 shrink-0"
                        onClick={() => setDeleteId(note.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent dir={lang === "ar" ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("notes.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("notes.delete.desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteId && delNote.mutate(deleteId)}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
