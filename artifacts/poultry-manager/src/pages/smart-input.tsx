/**
 * smart-input.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 *  Chat-style natural-language pipeline:
 *    1. Worker types what happened today (Arabic or Swedish)
 *    2. Server parses → extracts structured actions + validates them
 *    3. Editable review card appears (toggle on/off, see warnings + errors)
 *    4. User confirms → atomic server-side commit
 *    5. All dashboards & decision engine refresh automatically
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useRef, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Sparkles, CheckCircle2, AlertTriangle, XCircle, Info, Loader2, Trash2, Egg, Wallet, Bird, ListChecks, MessageSquareText, RefreshCw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiPost } from "@/lib/api";

// ─── Types matching the server contract ────────────────────────────────────
type ActionType = "transaction" | "hatching_cycle" | "hatching_result" | "flock" | "task";
interface ExtractedAction { type: ActionType; description: string; data: Record<string, any>; }
interface ValidationIssue { severity: "error" | "warning" | "info"; code: string; ar: string; sv: string; field?: string; }
interface ValidatedAction { index: number; action: ExtractedAction; issues: ValidationIssue[]; blocking: boolean; normalized: Record<string, any>; }
interface ParseResponse {
  summary: string;
  inputText: string;
  actions: ExtractedAction[];
  validation: { actions: ValidatedAction[]; totalActions: number; totalErrors: number; totalWarnings: number; canCommit: boolean; };
}
interface CommitResponse {
  success: true;
  saved: { type: string; id: number; description: string }[];
  failed: { index: number; type: string; error: string }[];
  counts: { transactions: number; hatchingCycles: number; flocks: number; tasks: number; };
  fingerprint: string;
  committedAt: string;
}

// ─── Conversation message types ────────────────────────────────────────────
interface UserMessage  { kind: "user"; id: string; text: string; date: string; }
interface ParsedMessage { kind: "parsed"; id: string; date: string; parse: ParseResponse; toggled: boolean[]; edited: Record<string, any>[]; status: "pending" | "saving" | "saved" | "error"; result?: CommitResponse; error?: string; sourceText: string; }
type Message = UserMessage | ParsedMessage;

// ─── Small helpers ─────────────────────────────────────────────────────────
const ACTION_ICON: Record<ActionType, any> = {
  transaction: Wallet, hatching_cycle: Egg, hatching_result: Egg, flock: Bird, task: ListChecks,
};
const ACTION_TINT: Record<ActionType, string> = {
  transaction: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900",
  hatching_cycle: "text-amber-600 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900",
  hatching_result: "text-amber-600 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900",
  flock: "text-blue-600 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900",
  task: "text-purple-600 bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900",
};

function newId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function ActionTitle({ type, ar }: { type: ActionType; ar: boolean }) {
  const labels: Record<ActionType, [string, string]> = {
    transaction:     ["معاملة مالية",         "Transaktion"],
    hatching_cycle:  ["دورة تفقيس جديدة",      "Ny kläckcykel"],
    hatching_result: ["نتيجة تفقيس",          "Kläckresultat"],
    flock:           ["قطيع جديد",             "Ny flock"],
    task:            ["مهمة",                   "Uppgift"],
  };
  return <>{ar ? labels[type][0] : labels[type][1]}</>;
}

// ─── Editable field renderer ───────────────────────────────────────────────
function EditableField({
  fieldKey, value, onChange, ar, errored,
}: { fieldKey: string; value: any; onChange: (v: any) => void; ar: boolean; errored: boolean }) {
  const labels: Record<string, [string, string]> = {
    amount:    ["المبلغ",        "Belopp"],
    eggsSet:   ["عدد البيض",      "Antal ägg"],
    eggsHatched:["عدد الكتاكيت",  "Kläckta"],
    count:     ["عدد الطيور",     "Antal fåglar"],
    temperature:["الحرارة (°م)",   "Temperatur (°C)"],
    humidity:  ["الرطوبة (%)",    "Luftfuktighet (%)"],
    date:      ["التاريخ",        "Datum"],
    title:     ["العنوان",        "Titel"],
    category:  ["الفئة",          "Kategori"],
    description:["الوصف",         "Beskrivning"],
    name:      ["الاسم",          "Namn"],
    ageDays:   ["العمر (يوم)",    "Ålder (dagar)"],
  };
  const label = labels[fieldKey]?.[ar ? 0 : 1] ?? fieldKey;
  const isNum = ["amount","eggsSet","eggsHatched","count","temperature","humidity","ageDays"].includes(fieldKey);
  const isDate = fieldKey === "date";
  return (
    <label className="block">
      <span className="text-[10px] text-muted-foreground block mb-0.5">{label}</span>
      <input
        type={isDate ? "date" : isNum ? "number" : "text"}
        value={value ?? ""}
        onChange={e => onChange(isNum ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
        className={cn(
          "w-full text-xs px-2 py-1.5 rounded-md border bg-background",
          errored ? "border-red-400 focus:border-red-500" : "border-border focus:border-primary",
          "focus:outline-none focus:ring-1 focus:ring-primary/30"
        )}
      />
    </label>
  );
}

// ─── Issue badge ────────────────────────────────────────────────────────────
function IssueBadge({ issue, ar }: { issue: ValidationIssue; ar: boolean }) {
  const style = issue.severity === "error"
    ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900"
    : issue.severity === "warning"
      ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900"
      : "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900";
  const Icon = issue.severity === "error" ? XCircle : issue.severity === "warning" ? AlertTriangle : Info;
  return (
    <div className={cn("flex items-start gap-1.5 px-2 py-1.5 rounded-lg border text-[11px]", style)}>
      <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span className="leading-snug">{ar ? issue.ar : issue.sv}</span>
    </div>
  );
}

// ─── Action card (inside parsed message) ───────────────────────────────────
function ActionCard({
  va, included, edits, ar, onToggle, onEdit, locked,
}: {
  va: ValidatedAction; included: boolean; edits: Record<string, any>; ar: boolean;
  onToggle: () => void; onEdit: (key: string, value: any) => void; locked: boolean;
}) {
  const Icon = ACTION_ICON[va.action.type];
  const merged = useMemo(() => ({ ...va.normalized, ...edits }), [va.normalized, edits]);
  const errFields = new Set(va.issues.filter(i => i.severity === "error" && i.field).map(i => i.field!));
  // Pick which fields to show inline based on action type
  const fieldsByType: Record<ActionType, string[]> = {
    transaction:     ["amount", "category", "date", "description"],
    hatching_cycle:  ["eggsSet", "temperature", "humidity"],
    hatching_result: ["eggsHatched"],
    flock:           ["name", "count", "ageDays"],
    task:            ["title"],
  };
  const visible = fieldsByType[va.action.type] ?? [];

  return (
    <div className={cn(
      "rounded-xl border p-3 transition-all",
      included ? ACTION_TINT[va.action.type] : "bg-muted/30 text-muted-foreground border-border opacity-60"
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Icon className="w-4 h-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold leading-tight"><ActionTitle type={va.action.type} ar={ar} /></p>
            <p className="text-[10px] opacity-75 truncate">{va.action.description}</p>
          </div>
        </div>
        {!locked && (
          <button
            onClick={onToggle}
            className={cn(
              "shrink-0 text-[10px] px-2 py-1 rounded-md font-bold transition-colors",
              included ? "bg-white/60 dark:bg-black/30 hover:bg-white" : "bg-foreground/10 hover:bg-foreground/20"
            )}
          >{included ? (ar ? "إلغاء" : "Ta bort") : (ar ? "إضافة" : "Inkludera")}</button>
        )}
      </div>

      {included && visible.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          {visible.map(k => (
            <EditableField
              key={k}
              fieldKey={k}
              value={merged[k]}
              onChange={v => onEdit(k, v)}
              ar={ar}
              errored={errFields.has(k)}
            />
          ))}
        </div>
      )}

      {included && va.issues.length > 0 && (
        <div className="space-y-1.5">
          {va.issues.map((iss, i) => <IssueBadge key={i} issue={iss} ar={ar} />)}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function SmartInputPage() {
  const { lang, dir } = useLanguage();
  const ar = lang === "ar";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const feedRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages, parsing]);

  // Greeting message
  useEffect(() => {
    if (messages.length === 0) {
      const greeting = ar
        ? "مرحباً 👋 اكتب باختصار ما حدث في المزرعة اليوم — مثال: «بعت 30 كتكوت بـ 60000، اشتريت كيس علف بـ 50000، الحرارة 37.6 والرطوبة 53».\nسأستخرج الإجراءات وأعرضها للمراجعة قبل الحفظ."
        : "Hej 👋 Skriv kort vad som hände på gården idag — t.ex.: ”Sålde 30 kycklingar för 60000, köpte en fodersäck för 50000, temperaturen 37.6 och fuktighet 53”.\nJag extraherar åtgärderna och visar dem för granskning före sparande.";
      setMessages([{ kind: "user", id: newId(), text: greeting, date: new Date().toISOString() } as any]);
      // Replace 'user' with 'system' marker via a synthetic 'parsed' is overkill — instead we just style the first user message lightly
    }
  }, []); // eslint-disable-line

  // ── PARSE handler (no save) ──
  async function onParse() {
    const t = text.trim();
    if (t.length < 5) {
      toast({ title: ar ? "اكتب جملة أطول قليلاً" : "Skriv en längre mening", variant: "destructive" });
      return;
    }
    const userMsg: UserMessage = { kind: "user", id: newId(), text: t, date: new Date().toISOString() };
    setMessages(m => [...m, userMsg]);
    setText("");
    setParsing(true);
    try {
      const parse = await apiPost<ParseResponse>("/api/ai/parse", { text: t, lang });
      const parsedMsg: ParsedMessage = {
        kind: "parsed",
        id: newId(),
        date: new Date().toISOString(),
        parse,
        toggled: parse.validation.actions.map(va => !va.blocking), // include by default unless blocked
        edited: parse.validation.actions.map(() => ({})),
        status: "pending",
        sourceText: t,
      };
      setMessages(m => [...m, parsedMsg]);
    } catch (e: any) {
      toast({ title: ar ? "فشل التحليل" : "Tolkning misslyckades", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setParsing(false);
    }
  }

  // ── User edits in a parsed message ──
  function updateMsg(id: string, patch: (m: ParsedMessage) => ParsedMessage) {
    setMessages(arr => arr.map(m => (m.kind === "parsed" && m.id === id ? patch(m) : m)));
  }

  // ── COMMIT handler ──
  async function onCommit(id: string) {
    const target = messages.find(m => m.kind === "parsed" && m.id === id) as ParsedMessage | undefined;
    if (!target) return;

    // Build payload from toggled + edited
    const actionsToSend = target.parse.validation.actions
      .map((va, i) => ({
        included: target.toggled[i],
        action: { type: va.action.type, description: va.action.description, data: { ...va.normalized, ...target.edited[i] } },
      }))
      .filter(x => x.included)
      .map(x => x.action);

    if (actionsToSend.length === 0) {
      toast({ title: ar ? "لم تختر أي إجراء" : "Inga åtgärder valda", variant: "destructive" });
      return;
    }

    updateMsg(id, m => ({ ...m, status: "saving" }));
    try {
      const result = await apiPost<CommitResponse>("/api/ai/commit",
        { actions: actionsToSend, lang, originalText: target.sourceText }
      );
      updateMsg(id, m => ({ ...m, status: "saved", result }));
      // ░ INVALIDATE EVERYTHING — every dashboard, KPI, decision engine, brain page ░
      await qc.invalidateQueries();
      toast({
        title: ar ? "✅ تم الحفظ" : "✅ Sparat",
        description: ar
          ? `تم حفظ ${result.saved.length} إجراء — الواجهات حُدّثت`
          : `${result.saved.length} åtgärder sparade — alla vyer uppdaterade`,
      });
    } catch (e: any) {
      updateMsg(id, m => ({ ...m, status: "error", error: String(e?.message ?? e) }));
      toast({ title: ar ? "فشل الحفظ" : "Sparande misslyckades", description: String(e?.message ?? e), variant: "destructive" });
    }
  }

  function discardMsg(id: string) {
    setMessages(arr => arr.filter(m => m.id !== id));
  }

  function clearChat() {
    setMessages([]);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background" dir={dir}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/40 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
            <MessageSquareText className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-black leading-tight">
              {ar ? "اكتب يومك بالعربي — أنا أحفظه لك" : "Skriv din dag — jag sparar den åt dig"}
            </h1>
            <p className="text-[10px] text-muted-foreground">
              {ar ? "تحليل + تحقق صارم + مراجعة + حفظ تلقائي مع تحديث فوري لكل اللوحات" : "Tolkning + sträng validering + granskning + automatiskt sparande med direkt uppdatering"}
            </p>
          </div>
          {messages.length > 1 && (
            <Button variant="ghost" size="sm" onClick={clearChat} className="text-[11px]">
              <Trash2 className="w-3 h-3 me-1" />{ar ? "مسح" : "Rensa"}
            </Button>
          )}
        </div>
      </div>

      {/* Conversation feed */}
      <div ref={feedRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg, idx) => {
            const isGreeting = idx === 0 && msg.kind === "user" && messages.length > 0;
            if (msg.kind === "user") {
              return (
                <div key={msg.id} className={cn("flex", isGreeting ? "justify-start" : (ar ? "justify-start" : "justify-end"))}>
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line shadow-sm",
                    isGreeting
                      ? "bg-muted text-foreground border border-border/50"
                      : "bg-primary text-primary-foreground"
                  )}>
                    {isGreeting && (
                      <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-bold opacity-80">
                        <Sparkles className="w-3.5 h-3.5" />
                        {ar ? "المساعد" : "Assistent"}
                      </div>
                    )}
                    {msg.text}
                  </div>
                </div>
              );
            }

            // Parsed bot message
            const p = msg.parse;
            const includedCount = msg.toggled.filter(Boolean).length;
            const errCount = p.validation.actions.reduce((s, va, i) => s + (msg.toggled[i] ? va.issues.filter(x => x.severity === "error").length : 0), 0);
            const warnCount = p.validation.actions.reduce((s, va, i) => s + (msg.toggled[i] ? va.issues.filter(x => x.severity === "warning").length : 0), 0);
            const canSave = includedCount > 0 && errCount === 0 && msg.status !== "saving" && msg.status !== "saved";

            return (
              <div key={msg.id} className={cn("flex", ar ? "justify-end" : "justify-start")}>
                <Card className="max-w-[92%] w-full shadow-md border-2 border-purple-100 dark:border-purple-900/30">
                  <CardContent className="p-3 space-y-3">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground border-b border-border/50 pb-2">
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                      <span className="font-bold text-foreground">{ar ? "نتيجة التحليل" : "Tolkningsresultat"}</span>
                      <Badge variant="secondary" className="text-[10px] py-0 h-5">
                        {p.validation.totalActions} {ar ? "إجراء" : "åtgärder"}
                      </Badge>
                      {warnCount > 0 && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] py-0 h-5">{warnCount} {ar ? "تحذير" : "varn."}</Badge>}
                      {errCount > 0 && <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px] py-0 h-5">{errCount} {ar ? "خطأ" : "fel"}</Badge>}
                    </div>

                    {p.validation.totalActions === 0 ? (
                      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-300">
                        {ar
                          ? "لم أستطع استخراج أي إجراء واضح. حاول إعادة الصياغة بأرقام محددة (المبلغ، عدد البيض، عدد الكتاكيت...)."
                          : "Kunde inte extrahera några tydliga åtgärder. Försök formulera om med specifika siffror."}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {p.validation.actions.map((va, i) => (
                          <ActionCard
                            key={i}
                            va={va}
                            included={msg.toggled[i]}
                            edits={msg.edited[i]}
                            ar={ar}
                            locked={msg.status === "saving" || msg.status === "saved"}
                            onToggle={() => updateMsg(msg.id, m => {
                              const t = [...m.toggled]; t[i] = !t[i]; return { ...m, toggled: t };
                            })}
                            onEdit={(k, v) => updateMsg(msg.id, m => {
                              const e = [...m.edited]; e[i] = { ...e[i], [k]: v }; return { ...m, edited: e };
                            })}
                          />
                        ))}
                      </div>
                    )}

                    {/* Status row */}
                    {msg.status === "saved" && msg.result && (
                      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 p-3 text-xs">
                        <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400 mb-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          {ar ? "تم الحفظ بنجاح" : "Sparat"}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-[11px] text-emerald-800 dark:text-emerald-300">
                          {msg.result.counts.transactions > 0 && <div>💰 {msg.result.counts.transactions} {ar ? "معاملة" : "transaktion"}</div>}
                          {msg.result.counts.hatchingCycles > 0 && <div>🥚 {msg.result.counts.hatchingCycles} {ar ? "تفقيس" : "kläckning"}</div>}
                          {msg.result.counts.flocks > 0 && <div>🐔 {msg.result.counts.flocks} {ar ? "قطيع" : "flock"}</div>}
                          {msg.result.counts.tasks > 0 && <div>✅ {msg.result.counts.tasks} {ar ? "مهمة" : "uppgift"}</div>}
                        </div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-500 mt-2 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" />
                          {ar ? "اللوحات والتقارير حُدّثت تلقائياً" : "Alla vyer uppdaterades automatiskt"}
                        </div>
                      </div>
                    )}
                    {msg.status === "error" && (
                      <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-3 text-xs text-red-700 dark:text-red-400">
                        <div className="flex items-center gap-2 font-bold mb-1"><XCircle className="w-4 h-4" />{ar ? "فشل الحفظ" : "Sparande misslyckades"}</div>
                        <div className="text-[11px]">{msg.error}</div>
                      </div>
                    )}

                    {/* Actions */}
                    {p.validation.totalActions > 0 && msg.status !== "saved" && (
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          onClick={() => onCommit(msg.id)}
                          disabled={!canSave}
                          size="sm"
                          className="flex-1 text-xs"
                        >
                          {msg.status === "saving"
                            ? <><Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" />{ar ? "جارٍ الحفظ..." : "Sparar..."}</>
                            : <><CheckCircle2 className="w-3.5 h-3.5 me-1.5" />{ar ? `تأكيد وحفظ (${includedCount})` : `Bekräfta & spara (${includedCount})`}</>}
                        </Button>
                        <Button
                          onClick={() => discardMsg(msg.id)}
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground"
                          disabled={msg.status === "saving"}
                        >
                          {ar ? "تجاهل" : "Avfärda"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}

          {parsing && (
            <div className={cn("flex", ar ? "justify-end" : "justify-start")}>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-muted text-muted-foreground text-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {ar ? "جارٍ التحليل والتحقق..." : "Tolkar och validerar..."}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border/40 px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2">
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onParse(); }
              }}
              placeholder={ar
                ? "مثال: بعت 25 كتكوت بـ 50000، اشتريت كيس علف 30 كغ بـ 45000، الحرارة 37.7"
                : "Ex: Sålde 25 kycklingar för 50000, köpte en 30-kg fodersäck för 45000, temp 37.7"}
              className="min-h-[60px] max-h-32 text-sm resize-none flex-1"
              disabled={parsing}
            />
            <Button
              onClick={onParse}
              disabled={parsing || text.trim().length < 5}
              className="h-[60px] px-4 shrink-0"
            >
              {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            {ar ? "اضغط Ctrl+Enter للإرسال — لا شيء يُحفظ قبل تأكيدك" : "Tryck Ctrl+Enter för att skicka — inget sparas innan du bekräftar"}
          </p>
        </div>
      </div>
    </div>
  );
}
