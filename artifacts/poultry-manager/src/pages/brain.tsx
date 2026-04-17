import { useState, useEffect, useRef, useCallback } from "react";
import {
  Brain, Activity, DollarSign, Wheat, Bird, Egg, CheckSquare, Target,
  BookOpen, AlertTriangle, CheckCircle2, Clock, TrendingUp, TrendingDown,
  Minus, RefreshCw, ShieldCheck, ShieldAlert, ShieldX, Zap, Flame,
  Package, Droplets, Wrench, Home, Truck, Award, Syringe, Layers,
  ChevronDown, ChevronUp, Eye, AlertCircle, Info, BarChart3, Calendar,
  FileText, Wind, Thermometer, CloudRain, Cpu,
} from "lucide-react";
import { ExplainTip } from "@/components/ExplainTip";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const BASE = import.meta.env.BASE_URL;
const REFRESH_INTERVAL   = 5_000;
const AUDIT_INTERVAL     = 3_600_000; // 1 hour
const DECISION_INTERVAL  = 30_000;   // 30 seconds — weather + incubation live check

// ─── Helpers ──────────────────────────────────────────────────────────────────
function money(n: number, lang: string) {
  const fmt = new Intl.NumberFormat(lang === "ar" ? "ar-IQ" : "sv-SE").format(Math.round(Math.abs(n)));
  return lang === "ar" ? `${fmt} د.ع` : `${fmt} IQD`;
}
function pct(n: number) { return `${n >= 0 ? "+" : ""}${Number(n).toFixed(1)}%`; }
function dayLabel(d: string, ar: boolean) {
  const names_ar = ["أحد","اثن","ثلا","أرب","خمي","جمع","سبت"];
  const names_sv = ["Sön","Mån","Tis","Ons","Tor","Fre","Lör"];
  const date = new Date(d);
  return ar ? names_ar[date.getDay()] : names_sv[date.getDay()];
}
function relDate(d: string, ar: boolean) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (diff === 0) return ar ? "اليوم" : "Idag";
  if (diff === 1) return ar ? "أمس" : "Igår";
  return ar ? `منذ ${diff} أيام` : `${diff} dagar sedan`;
}

// ─── API fetch ────────────────────────────────────────────────────────────────
async function apiFetch(path: string) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ─── Category labels ──────────────────────────────────────────────────────────
const CAT_AR: Record<string, string> = {
  feed:"علف", medicine:"أدوية وعلاج", vaccines:"لقاحات", electricity:"كهرباء",
  water:"ماء", fuel:"وقود ومولد", labor:"عمالة وأجور", equipment:"معدات",
  maintenance:"صيانة", disinfection:"مطهرات", transport:"نقل وشحن", rent:"إيجار",
  incubation_supplies:"مستلزمات تفقيس", eggs_purchase:"شراء بيض", other:"أخرى",
  chick_sale:"بيع كتاكيت", egg_sale:"بيع بيض", chicken_sale:"بيع دجاج",
  manure_sale:"بيع سماد",
};
const CAT_SV: Record<string, string> = {
  feed:"Foder", medicine:"Medicin", vaccines:"Vacciner", electricity:"El",
  water:"Vatten", fuel:"Bränsle", labor:"Arbetskraft", equipment:"Utrustning",
  maintenance:"Underhåll", disinfection:"Desinfektion", transport:"Transport", rent:"Hyra",
  incubation_supplies:"Kläckningstillb.", eggs_purchase:"Ägginköp", other:"Övrigt",
  chick_sale:"Kycklingförs.", egg_sale:"Äggförsäljning", chicken_sale:"Slaktkyckl.",
  manure_sale:"Gödselförs.",
};
const CAT_ICON: Record<string, typeof Wheat> = {
  feed:Wheat, medicine:Syringe, vaccines:ShieldCheck, electricity:Zap, water:Droplets,
  fuel:Flame, labor:Award, equipment:Wrench, maintenance:Wrench, disinfection:Package,
  transport:Truck, rent:Home, incubation_supplies:Egg, eggs_purchase:Egg, other:Package,
  chick_sale:Bird, egg_sale:Egg, chicken_sale:Bird, manure_sale:Layers,
};

// ─── Mini bar chart ───────────────────────────────────────────────────────────
function MiniBar({ days }: { days: { day: string; income: number; expense: number }[] }) {
  const maxVal = Math.max(...days.map(d => Math.max(d.income, d.expense)), 1);
  return (
    <div className="flex items-end gap-1 h-14">
      {days.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div className="w-full flex gap-0.5">
            <div className="flex-1 bg-emerald-500/70 rounded-t"
                 style={{ height: `${(d.income / maxVal) * 44}px` }} />
            <div className="flex-1 bg-red-400/70 rounded-t"
                 style={{ height: `${(d.expense / maxVal) * 44}px` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Score ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = size * 0.38;
  const c = size * 0.5;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#3b82f6" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor"
        strokeWidth={size * 0.08} className="text-muted/20" />
      <circle cx={c} cy={c} r={r} fill="none" stroke={color}
        strokeWidth={size * 0.08} strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        transform={`rotate(-90 ${c} ${c})`} />
      <text x={c} y={c + 5} textAnchor="middle" fontSize={size * 0.22}
        fontWeight="bold" fill={color}>{score}</text>
    </svg>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────
function Section({
  icon: Icon, title, badge, color, children, defaultOpen = true,
  explainTitleAr, explainTitleSv, explainAr, explainSv,
}: {
  icon: typeof Brain; title: string; badge?: string; color: string;
  children: React.ReactNode; defaultOpen?: boolean;
  explainTitleAr?: string; explainTitleSv?: string;
  explainAr?: string; explainSv?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 hover:bg-accent/20 transition-colors"
      >
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 text-start flex items-center gap-1.5">
          <span className="text-sm font-bold text-foreground">{title}</span>
          {explainAr && explainTitleAr && (
            <ExplainTip
              titleAr={explainTitleAr} titleSv={explainTitleSv!}
              textAr={explainAr} textSv={explainSv!}
              size="xs"
            />
          )}
        </div>
        {badge && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{badge}</span>
        )}
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-2">{children}</div>}
    </div>
  );
}

// ─── KPI tile ─────────────────────────────────────────────────────────────────
function Tile({ label, value, sub, color = "text-foreground", small = false }: {
  label: string; value: string; sub?: string; color?: string; small?: boolean;
}) {
  return (
    <div className="bg-muted/30 rounded-xl p-3">
      <p className="text-[10px] text-muted-foreground font-medium truncate">{label}</p>
      <p className={cn("font-bold truncate mt-0.5", color, small ? "text-sm" : "text-base")}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

// ─── Row item ─────────────────────────────────────────────────────────────────
function Row({ icon: Icon, label, value, sub, highlight }: {
  icon?: typeof Brain; label: string; value: string; sub?: string; highlight?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2 p-2 rounded-lg", highlight && "bg-primary/5")}>
      {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
      <span className="flex-1 text-xs text-muted-foreground truncate">{label}</span>
      <div className="text-right">
        <p className="text-xs font-bold text-foreground">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ pct, color = "#3b82f6", label, value }: {
  pct: number; color?: string; label: string; value: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground truncate">{label}</span>
        <span className="font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
             style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Audit badge ─────────────────────────────────────────────────────────────
function AuditBadge({ severity }: { severity: string }) {
  const cfg = {
    critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    high:     "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    medium:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    low:      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  };
  const label = { critical:"حرج", high:"عالي", medium:"متوسط", low:"منخفض" };
  return (
    <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold",
      cfg[severity as keyof typeof cfg] ?? cfg.low)}>
      {label[severity as keyof typeof label] ?? severity}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function BrainPage() {
  const { lang } = useLanguage();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const ar = lang === "ar";

  const [state, setState]       = useState<any>(null);
  const [audit, setAudit]       = useState<any>(null);
  const [decision, setDecision] = useState<any>(null);
  const [loadingState, setLoadingState]     = useState(true);
  const [loadingAudit, setLoadingAudit]     = useState(false);
  const [loadingDecision, setLoadingDecision] = useState(false);
  const [lastFetch, setLastFetch] = useState(0);
  const [tick, setTick]   = useState(0);
  const [auditExpanded, setAuditExpanded]       = useState(true);
  const [decisionExpanded, setDecisionExpanded] = useState(true);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const auditRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const decisionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch state ────────────────────────────────────────────────────────────
  const fetchState = useCallback(async (silent = false) => {
    try {
      const data = await apiFetch("api/brain/state");
      setState(data);
      setLastFetch(Date.now());
      setLoadingState(false);
    } catch {
      if (!silent) setLoadingState(false);
    }
  }, []);

  // ── Fetch audit ────────────────────────────────────────────────────────────
  const fetchAudit = useCallback(async (manual = false) => {
    setLoadingAudit(true);
    try {
      const path = manual ? "api/brain/audit?force=1" : "api/brain/audit";
      const data = await apiFetch(path);
      setAudit(data);
      if (manual) toast({ title: ar ? "✅ تم التدقيق" : "✅ Granskning klar" });
    } catch {}
    setLoadingAudit(false);
  }, [ar, toast]);

  // ── Fetch decision engine (weather + incubation intelligence) ──────────────
  const fetchDecision = useCallback(async () => {
    setLoadingDecision(true);
    try {
      const data = await apiFetch("api/ai/decision");
      setDecision(data);
    } catch {}
    setLoadingDecision(false);
  }, []);

  // ── Start intervals ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchState();
    fetchAudit();
    fetchDecision();

    timerRef.current    = setInterval(() => fetchState(true), REFRESH_INTERVAL);
    auditRef.current    = setInterval(() => fetchAudit(), AUDIT_INTERVAL);
    decisionRef.current = setInterval(() => fetchDecision(), DECISION_INTERVAL);
    tickRef.current     = setInterval(() => setTick(t => t + 1), 1_000);

    return () => {
      if (timerRef.current)    clearInterval(timerRef.current);
      if (auditRef.current)    clearInterval(auditRef.current);
      if (decisionRef.current) clearInterval(decisionRef.current);
      if (tickRef.current)     clearInterval(tickRef.current);
    };
  }, [fetchState, fetchAudit, fetchDecision]);

  const secsSince = Math.floor((Date.now() - lastFetch) / 1000);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loadingState) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Brain className="w-10 h-10 text-primary mx-auto animate-pulse" />
          <p className="text-sm text-muted-foreground">
            {ar ? "جارٍ تحليل بيانات المزرعة..." : "Analyserar gårdsdata..."}
          </p>
        </div>
      </div>
    );
  }
  if (!state) return null;

  // ── Derived values ─────────────────────────────────────────────────────────
  const fin = state.financial ?? {};
  const feed = state.feed ?? {};
  const flocks = state.flocks ?? {};
  const hatching = state.hatching ?? {};
  const tasks = state.tasks ?? {};
  const goals = state.goals ?? {};
  const notes: any[] = state.notes ?? [];
  const health = state.health ?? {};

  const totalIncome   = Number(fin.total_income ?? 0);
  const totalExpense  = Number(fin.total_expense ?? 0);
  const netProfit     = Number(fin.net_profit ?? 0);
  const margin        = fin.margin;
  const monthIncome   = Number(fin.month_income ?? 0);
  const monthExpense  = Number(fin.month_expense ?? 0);
  const todayIncome   = Number(fin.today_income ?? 0);
  const todayExpense  = Number(fin.today_expense ?? 0);

  const totalKg      = Number(feed.total_kg ?? 0);
  const feedCost     = Number(feed.total_cost ?? 0);
  const costPerKg    = feed.cost_per_kg;
  const feedHistory: any[] = feed.history ?? [];

  const flocksAll: any[] = flocks.list ?? [];
  const totalBirds = flocks.total_birds ?? 0;

  const hatchCycles: any[] = hatching.cycles ?? [];
  const activeCycles = hatchCycles.filter(c => ["active","incubating","lockdown"].includes(c.status));

  const overdueTask: any[] = tasks.overdue ?? [];
  const todayTask:   any[] = tasks.today   ?? [];
  const upcomingTask:any[] = tasks.upcoming ?? [];
  const doneTask:    any[] = tasks.done    ?? [];

  const activeGoals: any[] = goals.active  ?? [];
  const doneGoals:   any[] = goals.done    ?? [];

  // Category sorted by total
  const expCats = ((fin.categories as any[]) ?? []).filter(c => c.type === "expense").sort((a, b) => Number(b.total) - Number(a.total));
  const incCats = ((fin.categories as any[]) ?? []).filter(c => c.type === "income").sort((a, b) => Number(b.total) - Number(a.total));
  const maxExpCat = expCats.length > 0 ? Number(expCats[0].total) : 1;

  // Weekly data
  const weekDays: any[] = (fin.week_days as any[]) ?? [];

  // Audit issues count
  const criticalIssues = (audit?.issues ?? []).filter((i: any) => i.severity === "critical").length;
  const highIssues     = (audit?.issues ?? []).filter((i: any) => i.severity === "high").length;
  const totalIssues    = (audit?.issues ?? []).length;

  // ── Health color ──────────────────────────────────────────────────────────
  const healthColor = health.score >= 80 ? "text-emerald-600" : health.score >= 60 ? "text-blue-600" : health.score >= 40 ? "text-amber-600" : "text-red-600";
  const healthLabel = ar
    ? (health.score >= 80 ? "ممتازة" : health.score >= 60 ? "جيدة" : health.score >= 40 ? "مقبولة" : "ضعيفة")
    : (health.score >= 80 ? "Utmärkt" : health.score >= 60 ? "Bra" : health.score >= 40 ? "Godtagbar" : "Svag");

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-4" dir={ar ? "rtl" : "ltr"}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-black text-lg leading-tight">
                {ar ? "ذاكرة المزرعة" : "Gårdsminne"}
              </h1>
              <p className="text-white/60 text-xs mt-0.5">
                {ar ? "تحليل شامل • يتجدد كل 5 ث" : "Heltäckande analys • uppdateras var 5:e sek"}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <ScoreRing score={health.score ?? 60} />
            <div className="flex items-center gap-1">
              <span className={cn("text-xs font-bold", healthColor)}>{healthLabel}</span>
              <ExplainTip
                titleAr="درجة صحة المزرعة" titleSv="Gårdens hälsopoäng"
                textAr="رقم من 0 إلى 100 يلخص حالة مزرعتك: فوق 80 = ممتاز 🌟، 60-80 = جيد ✅، 40-60 = مقبول ⚠️، أقل من 40 = يحتاج تدخل فوري ❌. يحسب من الأداء المالي والإنتاج والمهام والأهداف."
                textSv="En siffra 0–100 som sammanfattar gårdens tillstånd: över 80 = utmärkt, 60–80 = bra, 40–60 = acceptabelt, under 40 = kräver omedelbar åtgärd."
                className="bg-white/20 text-white hover:bg-white/30"
              />
            </div>
          </div>
        </div>

        {/* Live ticker */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs text-white/70">
              {ar ? "مباشر" : "Live"} · {ar ? `تحديث منذ ${secsSince} ث` : `Uppdaterat ${secsSince}s sedan`}
            </span>
          </div>
          <div className="flex items-center gap-2 ms-auto">
            {criticalIssues > 0 && (
              <span className="bg-red-500/90 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                {criticalIssues} {ar ? "حرج" : "kritisk"}
              </span>
            )}
            {highIssues > 0 && (
              <span className="bg-orange-500/90 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                {highIssues} {ar ? "عالي" : "hög"}
              </span>
            )}
            <button
              onClick={() => { fetchState(); fetchAudit(true); }}
              className="bg-white/10 hover:bg-white/20 rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loadingState && "animate-spin")} />
              {ar ? "تحديث" : "Uppdatera"}
            </button>
          </div>
        </div>

        {/* 4 Quick KPIs */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            {
              label: ar?"الدخل":"Inkomst", value: money(totalIncome, lang), color:"text-emerald-400",
              titleAr:"إجمالي الدخل", titleSv:"Total inkomst",
              textAr:"مجموع كل الأموال الداخلة للمزرعة من بيع الكتاكيت والبيض والدجاج منذ بداية التسجيل.",
              textSv:"Summan av alla intäkter sedan starten."
            },
            {
              label: ar?"المصاريف":"Kost.", value: money(totalExpense, lang), color:"text-red-400",
              titleAr:"إجمالي المصاريف", titleSv:"Totala kostnader",
              textAr:"مجموع كل ما صُرف على المزرعة (علف، أدوية، كهرباء، عمالة) منذ بداية التسجيل.",
              textSv:"Summan av alla utgifter sedan starten."
            },
            {
              label: ar?"الربح":"Vinst", value: money(netProfit, lang), color: netProfit >= 0 ? "text-emerald-400" : "text-red-400",
              titleAr:"صافي الربح الإجمالي", titleSv:"Total nettovinst",
              textAr:"الفرق بين الدخل والمصاريف الإجمالي. موجب = ربح 💚، سالب = خسارة 🔴. هذا هو المؤشر الأهم لصحة المزرعة.",
              textSv:"Skillnaden mellan total inkomst och kostnader. Positiv = vinst, Negativ = förlust."
            },
            {
              label: ar?"الطيور":"Fåglar", value: String(totalBirds), color:"text-blue-400",
              titleAr:"إجمالي الطيور", titleSv:"Totalt antal fåglar",
              textAr:"عدد الطيور الحية المسجلة في المزرعة الآن من جميع القطعان.",
              textSv:"Totalt antal levande fåglar i alla flockar just nu."
            },
          ].map((k, i) => (
            <div key={i} className="bg-white/8 rounded-xl p-2.5 text-center relative">
              <div className="flex items-center justify-center gap-0.5">
                <p className="text-[9px] text-white/50 font-medium">{k.label}</p>
                <ExplainTip
                  titleAr={k.titleAr} titleSv={k.titleSv}
                  textAr={k.textAr} textSv={k.textSv}
                  className="bg-white/10 text-white/50 hover:bg-white/20 w-3 h-3"
                  size="xs"
                />
              </div>
              <p className={cn("text-[11px] font-black mt-0.5 leading-tight", k.color)}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Audit panel ─────────────────────────────────────────────────── */}
      {audit && (
        <div className={cn(
          "rounded-2xl border p-4 shadow-sm",
          totalIssues === 0 ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10"
                            : criticalIssues > 0 ? "border-red-200 bg-red-50/50 dark:bg-red-950/10"
                            : "border-amber-200 bg-amber-50/50 dark:bg-amber-950/10"
        )}>
          <button
            className="w-full flex items-center gap-2"
            onClick={() => setAuditExpanded(e => !e)}
          >
            {totalIssues === 0
              ? <ShieldCheck className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              : criticalIssues > 0
                ? <ShieldX className="w-5 h-5 text-red-500 flex-shrink-0" />
                : <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0" />
            }
            <div className="flex-1 text-start">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-foreground">
                  {ar ? "تقرير التدقيق الشامل" : "Fullständig granskningsrapport"}
                </p>
                <ExplainTip
                  titleAr="تقرير التدقيق الشامل" titleSv="Fullständig granskningsrapport"
                  textAr="مراجعة تلقائية لجميع بيانات المزرعة مرة واحدة في الساعة. يكشف: أيام ناقصة في السجل، أخطاء في البيانات، أو مشاكل تحتاج تصحيح. الدرجة من 100 تعكس جودة بياناتك."
                  textSv="Automatisk granskning av all gårdsdata en gång per timme. Hittar saknade dagar, datafel och problem som behöver åtgärd. Poäng av 100 = datakvalitet."
                  size="xs"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {ar
                  ? totalIssues === 0 ? "لا توجد مشاكل — البيانات نظيفة ✓" : `${totalIssues} مشكلة · نقاط ${audit.score}/100`
                  : totalIssues === 0 ? "Inga problem — data är ren ✓" : `${totalIssues} problem · Poäng ${audit.score}/100`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                role="button"
                tabIndex={0}
                onClick={e => { e.stopPropagation(); fetchAudit(true); }}
                onKeyDown={e => e.key === "Enter" && (e.stopPropagation(), fetchAudit(true))}
                className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-lg font-semibold hover:bg-primary/20 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={cn("w-3 h-3", loadingAudit && "animate-spin")} />
                {ar ? "إعادة التدقيق" : "Granska om"}
              </span>
              {auditExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </button>

          {auditExpanded && (
            <div className="mt-3 space-y-2">
              {/* Stats row */}
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: ar?"أيام مسجلة":"Reg. dagar",  value: String(audit.stats?.recorded_days ?? 0) },
                  { label: ar?"أيام مفقودة":"Saknade dagar", value: String(audit.stats?.missing_days ?? 0) },
                  { label: ar?"معاملات":"Transakt.",        value: String(audit.stats?.total_tx ?? 0) },
                  { label: ar?"أيام نشطة":"Aktiva dagar",  value: String(audit.stats?.active_days_30 ?? 0) },
                ].map((s, i) => (
                  <div key={i} className="bg-background/60 rounded-lg p-2 text-center">
                    <p className="text-[9px] text-muted-foreground">{s.label}</p>
                    <p className="text-xs font-bold text-foreground">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Issues */}
              {(audit.issues as any[]).map((iss: any, i: number) => (
                <div key={i} className="flex items-start gap-2 bg-background/50 rounded-xl p-2.5">
                  {iss.severity === "critical" ? <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                   : iss.severity === "high" ? <AlertCircle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
                   : iss.severity === "medium" ? <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                   : <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />}
                  <p className="flex-1 text-xs text-foreground">{ar ? iss.ar : iss.sv}</p>
                  <AuditBadge severity={iss.severity} />
                </div>
              ))}

              {/* Insights */}
              {(audit.insights as any[]).map((ins: any, i: number) => (
                <div key={i} className="flex items-start gap-2 bg-emerald-500/5 rounded-xl p-2.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">{ar ? ins.ar : ins.sv}</p>
                </div>
              ))}

              {totalIssues === 0 && (audit.insights as any[]).length === 0 && (
                <div className="flex items-center gap-2 bg-emerald-500/5 rounded-xl p-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    {ar ? "جودة البيانات مثالية — كل شيء في مكانه الصحيح" : "Perfekt datakvalitet — allt är på rätt plats"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Live Decision Engine ─────────────────────────────────────────── */}
      {(() => {
        if (!decision) return null;
        const w = decision.weather ?? {};
        const factors: any[] = decision.factors ?? [];
        const dangerFactors  = factors.filter((f: any) => f.status === "danger");
        const warnFactors    = factors.filter((f: any) => f.status === "warning");
        const os = decision.overallStatus as string;
        const hdrBg =
          os === "danger"  ? "from-red-950 to-red-900 border-red-800" :
          os === "warning" ? "from-amber-950 to-amber-900 border-amber-800" :
                             "from-emerald-950 to-emerald-900 border-emerald-800";
        const statusLabel = ar
          ? (os === "danger" ? "⚠️ خطر" : os === "warning" ? "🟡 تحذير" : "✅ جيد")
          : (os === "danger" ? "⚠️ Fara" : os === "warning" ? "🟡 Varning" : "✅ Bra");
        const summary = ar ? decision.summaryAr : decision.summarySv;
        return (
          <div className={cn("rounded-2xl border bg-gradient-to-br text-white shadow-xl", hdrBg)}>
            {/* Header */}
            <button
              className="w-full flex items-center gap-3 p-4"
              onClick={() => setDecisionExpanded(e => !e)}
            >
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-start">
                <p className="text-sm font-black leading-tight">
                  {ar ? "محرك القرار الحي" : "Live Beslutmotor"}
                </p>
                <p className="text-[10px] text-white/60 mt-0.5">
                  {ar ? "طقس · فقاسة · بيئة · يتجدد كل 30 ث" : "Väder · Kläckning · Miljö · uppdateras var 30s"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-[11px] px-2 py-1 rounded-lg font-bold",
                  os === "danger"  ? "bg-red-500/30" :
                  os === "warning" ? "bg-amber-500/30" : "bg-emerald-500/30"
                )}>{statusLabel}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); fetchDecision(); }}
                  onKeyDown={e => e.key === "Enter" && (e.stopPropagation(), fetchDecision())}
                  className="bg-white/10 hover:bg-white/20 rounded-lg p-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={cn("w-3 h-3", loadingDecision && "animate-spin")} />
                </span>
                {decisionExpanded ? <ChevronUp className="w-4 h-4 text-white/60" /> : <ChevronDown className="w-4 h-4 text-white/60" />}
              </div>
            </button>

            {decisionExpanded && (
              <div className="px-4 pb-4 space-y-3">
                {/* Weather strip */}
                <div className="bg-white/8 rounded-xl p-3 grid grid-cols-4 gap-2">
                  <div className="text-center">
                    <p className="text-2xl leading-tight">{w.weatherIcon ?? "🌤️"}</p>
                    <p className="text-[9px] text-white/60 mt-0.5">{ar ? (w.weatherLabelAr ?? "") : (w.weatherLabelSv ?? "")}</p>
                  </div>
                  {[
                    { Icon: Thermometer, val: `${w.temperature ?? "--"}°C`, lbl: ar ? "الحرارة" : "Temp" },
                    { Icon: Droplets,    val: `${w.humidity ?? "--"}%`,     lbl: ar ? "الرطوبة" : "Fukt" },
                    { Icon: Wind,        val: `${w.windSpeed ?? "--"} م/ث`, lbl: ar ? "الرياح" : "Vind" },
                  ].map(({ Icon, val, lbl }, i) => (
                    <div key={i} className="text-center">
                      <Icon className="w-3.5 h-3.5 text-white/50 mx-auto" />
                      <p className="text-sm font-bold text-white mt-0.5">{val}</p>
                      <p className="text-[9px] text-white/50">{lbl}</p>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <p className="text-xs text-white/80 leading-relaxed">{summary}</p>

                {/* Danger / Warning factors */}
                {[...dangerFactors, ...warnFactors].slice(0, 5).map((f: any, i: number) => (
                  <div key={i} className={cn(
                    "rounded-xl p-3 space-y-1.5",
                    f.status === "danger" ? "bg-red-500/20 border border-red-500/30"
                                         : "bg-amber-500/15 border border-amber-500/25"
                  )}>
                    <div className="flex items-center gap-2">
                      {f.status === "danger"
                        ? <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                        : <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                      <span className="text-xs font-bold text-white">{ar ? f.titleAr : f.titleSv}</span>
                      <span className={cn(
                        "ms-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold",
                        f.urgency === "immediate" ? "bg-red-500/40 text-red-200"
                        : f.urgency === "monitor" ? "bg-amber-500/30 text-amber-200"
                        : "bg-white/10 text-white/60"
                      )}>
                        {ar
                          ? f.urgency === "immediate" ? "فوري" : f.urgency === "monitor" ? "راقب" : "منخفض"
                          : f.urgency === "immediate" ? "Omedelbar" : f.urgency === "monitor" ? "Övervaka" : "Låg"}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/70 leading-relaxed">{ar ? f.adviceAr : f.adviceSv}</p>
                  </div>
                ))}

                {/* Good factors summary */}
                {decision.goodCount > 0 && dangerFactors.length === 0 && warnFactors.length === 0 && (
                  <div className="bg-emerald-500/15 border border-emerald-500/25 rounded-xl p-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <p className="text-xs text-emerald-200">
                      {ar
                        ? `${decision.goodCount} عامل بيئي ضمن النطاق الطبيعي — استمر بالعمل`
                        : `${decision.goodCount} miljöfaktorer inom normalt intervall — fortsätt arbeta`}
                    </p>
                  </div>
                )}

                {/* Score + timestamp */}
                <div className="flex items-center justify-between text-[10px] text-white/40 border-t border-white/10 pt-2">
                  <span>
                    {ar ? `نقاط القرار: ${decision.overallScore}/100` : `Beslutpoäng: ${decision.overallScore}/100`}
                  </span>
                  <span>
                    {ar ? "موصول بالطقس المباشر — الموصل" : "Anslutet till live-väder — Mosul"}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Financial Memory ─────────────────────────────────────────────── */}
      <Section icon={DollarSign} title={ar?"الذاكرة المالية":"Ekonomiminne"}
               color="bg-emerald-500" badge={`${fin.all_time_count ?? 0} ${ar?"معاملة":"transakt."}`}
               explainTitleAr="الذاكرة المالية" explainTitleSv="Ekonomiminne"
               explainAr="سجل تاريخي كامل لكل الدخل والمصاريف والأرباح منذ بداية المزرعة. يشمل: الإجماليات الكلية، أرقام هذا الشهر، أرقام اليوم، وتوزيع المصاريف على الفئات."
               explainSv="Fullständig historik över alla intäkter, kostnader och vinster sedan starten. Inkluderar totaler, månadssiffror, dagens siffror och kostnadskategorier.">
        <div className="grid grid-cols-3 gap-2 mb-2">
          <Tile label={ar?"إجمالي الدخل":"Total inkomst"} value={money(totalIncome, lang)} color="text-emerald-600" small />
          <Tile label={ar?"إجمالي المصاريف":"Total kostnad"} value={money(totalExpense, lang)} color="text-red-500" small />
          <Tile label={ar?"صافي الربح":"Nettovinst"} value={money(netProfit, lang)}
                color={netProfit >= 0 ? "text-emerald-600" : "text-red-500"} small />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Tile label={ar?"هذا الشهر (دخل)":"Denna mån (ink.)"} value={money(monthIncome, lang)} small />
          <Tile label={ar?"هذا الشهر (مصروف)":"Denna mån (kost.)"} value={money(monthExpense, lang)} small />
          <Tile label={ar?"اليوم (دخل)":"Idag (ink.)"} value={money(todayIncome, lang)} small />
          <Tile label={ar?"اليوم (مصروف)":"Idag (kost.)"} value={money(todayExpense, lang)} small />
        </div>
        {margin !== null && (
          <div className="mb-3">
            <ProgressBar
              pct={Math.max(0, Number(margin))}
              color={Number(margin) >= 20 ? "#10b981" : Number(margin) >= 10 ? "#f59e0b" : "#ef4444"}
              label={ar?"هامش الربح":"Vinstmarginal"}
              value={pct(Number(margin))}
            />
          </div>
        )}

        {/* 7-day mini chart */}
        {weekDays.length > 0 && (
          <div className="bg-muted/20 rounded-xl p-3 mb-3">
            <p className="text-[10px] text-muted-foreground mb-2 font-medium">{ar?"آخر 7 أيام":"Senaste 7 dagar"}</p>
            <MiniBar days={weekDays.map(d => ({
              day: d.day, income: Number(d.income), expense: Number(d.expense)
            }))} />
            <div className="flex justify-between mt-1">
              {weekDays.map((d, i) => (
                <span key={i} className="flex-1 text-center text-[9px] text-muted-foreground">
                  {dayLabel(d.day, ar)}
                </span>
              ))}
            </div>
            <div className="flex gap-3 mt-2">
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500/70" /><span className="text-[9px] text-muted-foreground">{ar?"دخل":"Ink."}</span></div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400/70" /><span className="text-[9px] text-muted-foreground">{ar?"مصروف":"Kost."}</span></div>
            </div>
          </div>
        )}

        {/* Expense categories */}
        {expCats.length > 0 && (
          <div className="space-y-1.5 mb-2">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{ar?"تفصيل المصاريف":"Kostnadsfördelning"}</p>
            {expCats.slice(0, 8).map((c: any, i: number) => {
              const CIcon = CAT_ICON[c.category] ?? Package;
              return (
                <div key={i} className="flex items-center gap-2">
                  <CIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-[10px] text-muted-foreground w-20 flex-shrink-0 truncate">
                    {(ar ? CAT_AR : CAT_SV)[c.category] ?? c.category}
                  </span>
                  <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-red-400/70"
                         style={{ width: `${(Number(c.total) / maxExpCat) * 100}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-foreground w-20 text-end">{money(Number(c.total), lang)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Income categories */}
        {incCats.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{ar?"مصادر الدخل":"Inkomstkällor"}</p>
            {incCats.map((c: any, i: number) => {
              const CIcon = CAT_ICON[c.category] ?? Package;
              return (
                <div key={i} className="flex items-center gap-2">
                  <CIcon className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                  <span className="text-[10px] text-muted-foreground flex-1 truncate">
                    {(ar ? CAT_AR : CAT_SV)[c.category] ?? c.category}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600">{money(Number(c.total), lang)}</span>
                  <span className="text-[9px] text-muted-foreground">×{c.tx_count}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Top records */}
        {fin.top_income_desc && (
          <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
            <Row icon={TrendingUp} label={ar?"أكبر دخل":"Högsta inkomst"}
                 value={money(Number(fin.top_income_amt), lang)} sub={fin.top_income_desc} />
            <Row icon={TrendingDown} label={ar?"أكبر مصروف":"Högsta kostnad"}
                 value={money(Number(fin.top_expense_amt), lang)} sub={fin.top_expense_desc} />
          </div>
        )}
      </Section>

      {/* ── Feed Intelligence ────────────────────────────────────────────── */}
      <Section icon={Wheat} title={ar?"ذاكرة العلف":"Foderminne"}
               explainTitleAr="ذاكرة العلف" explainTitleSv="Foderminne"
               explainAr="يتتبع جميع مشتريات العلف: الكميات بالكيلو، التكلفة الإجمالية، ومتوسط سعر الكيلو. العلف هو أكبر مصروف في معظم المزارع لذا متابعته مهمة جداً."
               explainSv="Spårar alla foderinköp: mängd i kg, totalkostnad och genomsnittspris per kg. Foder är vanligtvis den största utgiftsposten."
               color="bg-amber-500" badge={`${feed.entry_count ?? 0} ${ar?"إدخال":"poster"}`}>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Tile label={ar?"إجمالي التكلفة":"Total kostnad"} value={money(feedCost, lang)} color="text-amber-600" small />
          <Tile label={ar?"إجمالي الكميه (كغ)":"Total mängd (kg)"} value={totalKg > 0 ? `${totalKg.toFixed(1)} كغ` : "—"} small />
          <Tile label={ar?"تكلفة الكيلو":"Kostnad/kg"} value={costPerKg ? `${Number(costPerKg).toLocaleString()} د.ع` : "—"} small />
          <Tile label={ar?"متوسط يومي (30 يوم)":"Dagssnitt (30 d.)"} value={feed.avg_daily_cost ? money(Number(feed.avg_daily_cost), lang) : "—"} small />
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Tile label={ar?"أيام التغذية":"Foderdagar"} value={String(feed.feed_days ?? 0)} small />
          <Tile label={ar?"هذا الأسبوع":"Denna vecka"} value={feed.week_cost ? money(Number(feed.week_cost), lang) : "—"} small />
          <Tile label={ar?"اليوم":"Idag"} value={feed.today_cost ? money(Number(feed.today_cost), lang) : "—"} small />
        </div>
        {feed.missing_qty_count > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {ar ? `${feed.missing_qty_count} إدخال علف بدون كمية — يُقلل دقة الحساب` : `${feed.missing_qty_count} foderpost utan mängd`}
            </p>
          </div>
        )}
        {feedHistory.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-semibold">{ar?"آخر إدخالات العلف":"Senaste foderinmatningar"}</p>
            {feedHistory.slice(0, 5).map((f: any, i: number) => (
              <div key={i} className="flex items-center gap-2 bg-muted/20 rounded-lg px-2 py-1.5">
                <Wheat className="w-3 h-3 text-amber-500 flex-shrink-0" />
                <span className="flex-1 text-[10px] text-muted-foreground truncate">{f.description}</span>
                {f.quantity && <span className="text-[10px] text-muted-foreground">{Number(f.quantity).toFixed(0)} {f.unit}</span>}
                <span className="text-[10px] font-bold text-foreground">{money(Number(f.amount), lang)}</span>
                <span className="text-[9px] text-muted-foreground">{relDate(f.date, ar)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Flock Memory ─────────────────────────────────────────────────── */}
      <Section icon={Bird} title={ar?"ذاكرة القطعان":"Flockminne"}
               explainTitleAr="ذاكرة القطعان" explainTitleSv="Flockminne"
               explainAr="سجل جميع قطعان الطيور في المزرعة مع عدد الأفراد، السلالة، العمر، والغرض (لحم / بيض / تفقيس). يساعدك على معرفة كل تفصيل عن طيورك."
               explainSv="Register över alla flockar med antal, ras, ålder och syfte (kött/ägg/kläckning)."
               color="bg-blue-500" badge={`${flocks.count ?? 0} ${ar?"قطيع":"flockar"} · ${totalBirds} ${ar?"طير":"fåglar"}`}>
        {flocksAll.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            {ar ? "لا توجد قطعان مسجلة" : "Inga registrerade flockar"}
          </p>
        ) : flocksAll.map((f: any) => {
          const ageDays = Number(f.actual_age_days ?? f.age_days ?? 0);
          const ageWeeks = Math.floor(ageDays / 7);
          const purposeAr = f.purpose === "eggs" ? "بيض" : f.purpose === "meat" ? "لحم" : "تفقيس";
          return (
            <div key={f.id} className="bg-muted/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <Bird className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="font-semibold text-sm text-foreground flex-1">{f.name}</span>
                <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
                  {ar ? purposeAr : f.purpose}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="text-center">
                  <p className="text-xs font-bold text-foreground">{f.count}</p>
                  <p className="text-[9px] text-muted-foreground">{ar?"عدد":"Antal"}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-foreground">{ageWeeks} {ar?"أسبوع":"v."}</p>
                  <p className="text-[9px] text-muted-foreground">{ar?"العمر":"Ålder"}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-foreground truncate">{f.breed}</p>
                  <p className="text-[9px] text-muted-foreground">{ar?"السلالة":"Sort"}</p>
                </div>
              </div>
            </div>
          );
        })}
      </Section>

      {/* ── Hatching Memory ──────────────────────────────────────────────── */}
      <Section icon={Egg} title={ar?"ذاكرة التفقيس":"Kläckminne"}
               explainTitleAr="ذاكرة التفقيس" explainTitleSv="Kläckminne"
               explainAr="سجل كل دورات الفقاسة: عدد البيض الموضوع، تاريخ الوضع، تاريخ الفقس، وعدد الكتاكيت الناجحة. نسبة التفقيس = (كتاكيت ناجحة ÷ بيض موضوع) × 100."
               explainSv="Register över alla kläckningscykler: lagda ägg, datum, kläckta kycklingar. Kläckningsgrad = (kläckta ÷ lagda) × 100."
               color="bg-purple-500"
               badge={`${hatching.active_count ?? 0} ${ar?"نشط":"aktiva"} · ${hatching.total_cycles ?? 0} ${ar?"إجمالي":"totalt"}`}>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Tile label={ar?"إجمالي البيض":"Totalt ägg"} value={String(hatching.total_eggs_set ?? 0)} small />
          <Tile label={ar?"إجمالي الفقس":"Totalt kläckt"} value={String(hatching.total_eggs_hatched ?? 0)} small />
          <Tile label={ar?"متوسط نسبة الفقس":"Snitt kläckningsgr."} value={`${hatching.avg_hatch_rate ?? 0}%`}
                color={Number(hatching.avg_hatch_rate) >= 75 ? "text-emerald-600" : "text-amber-600"} small />
          <Tile label={ar?"دورات مكتملة":"Avslutade cykler"} value={String(hatching.completed_count ?? 0)} small />
        </div>

        {activeCycles.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground font-semibold">{ar?"الدورات النشطة":"Aktiva cykler"}</p>
            {activeCycles.map((c: any) => {
              const daysIn  = Number(c.days_in ?? 0);
              const daysLeft = Number(c.days_remaining ?? 0);
              const totalDays = daysIn + daysLeft;
              const pctDone = totalDays > 0 ? (daysIn / totalDays) * 100 : 0;
              const isOverdue = daysLeft < 0;
              return (
                <div key={c.id} className={cn(
                  "rounded-xl border p-3",
                  isOverdue ? "border-red-200 bg-red-50/50 dark:bg-red-950/10"
                            : "border-purple-200/50 bg-purple-50/30 dark:bg-purple-950/10"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Egg className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                    <span className="font-semibold text-xs flex-1">{c.batch_name}</span>
                    {isOverdue && (
                      <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">
                        {ar ? "تأخر!" : "Sen!"}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                    <div className="text-center">
                      <p className="text-xs font-bold">{c.eggs_set}</p>
                      <p className="text-[9px] text-muted-foreground">{ar?"بيضة":"Ägg"}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold">{daysIn}</p>
                      <p className="text-[9px] text-muted-foreground">{ar?"يوم مضى":"dagar inne"}</p>
                    </div>
                    <div className="text-center">
                      <p className={cn("text-xs font-bold", isOverdue ? "text-red-500" : "text-purple-600")}>
                        {isOverdue ? `${Math.abs(daysLeft)} ${ar?"يوم تأخير":"d. sen"}` : `${daysLeft} ${ar?"يوم":"dagar"}`}
                      </p>
                      <p className="text-[9px] text-muted-foreground">{ar?"متبقي":"kvar"}</p>
                    </div>
                  </div>
                  <ProgressBar pct={pctDone} color={isOverdue ? "#ef4444" : "#a855f7"}
                               label="" value="" />
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── Task Memory ──────────────────────────────────────────────────── */}
      <Section icon={CheckSquare} title={ar?"ذاكرة المهام":"Uppgiftsminne"}
               explainTitleAr="ذاكرة المهام" explainTitleSv="Uppgiftsminne"
               explainAr="يعرض المهام المتأخرة والمهام المجدولة لليوم والمهام القادمة. المهام المتأخرة هي الأكثر أهمية وتحتاج إنجازاً فورياً."
               explainSv="Visar försenade, dagens och kommande uppgifter. Försenade uppgifter kräver omedelbar uppmärksamhet."
               color="bg-rose-500"
               badge={`${overdueTask.length} ${ar?"متأخرة":"sena"} · ${todayTask.length} ${ar?"اليوم":"idag"}`}>
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {[
            { label:ar?"متأخرة":"Sena",    count:overdueTask.length,  color:"text-red-500" },
            { label:ar?"اليوم":"Idag",      count:todayTask.length,    color:"text-amber-500" },
            { label:ar?"قادمة":"Kommande",  count:upcomingTask.length, color:"text-blue-500" },
            { label:ar?"مكتملة":"Klara",   count:doneTask.length,     color:"text-emerald-500" },
          ].map((s, i) => (
            <div key={i} className="bg-muted/20 rounded-xl p-2 text-center">
              <p className={cn("text-base font-black", s.color)}>{s.count}</p>
              <p className="text-[9px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {overdueTask.length > 0 && (
          <div className="space-y-1 mb-2">
            <p className="text-[10px] text-red-500 font-semibold">{ar?"🔴 متأخرة":"🔴 Sena"}</p>
            {overdueTask.slice(0, 5).map((t: any) => (
              <div key={t.id} className="flex items-center gap-2 bg-red-50/50 dark:bg-red-950/10 rounded-lg px-2 py-1.5">
                <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                <span className="text-xs flex-1 truncate">{t.title}</span>
                <span className="text-[9px] text-red-400">{t.due_date}</span>
              </div>
            ))}
          </div>
        )}
        {todayTask.length > 0 && (
          <div className="space-y-1 mb-2">
            <p className="text-[10px] text-amber-500 font-semibold">{ar?"🟡 اليوم":"🟡 Idag"}</p>
            {todayTask.slice(0, 4).map((t: any) => (
              <div key={t.id} className="flex items-center gap-2 bg-amber-50/50 dark:bg-amber-950/10 rounded-lg px-2 py-1.5">
                <Clock className="w-3 h-3 text-amber-400 flex-shrink-0" />
                <span className="text-xs flex-1 truncate">{t.title}</span>
              </div>
            ))}
          </div>
        )}
        {upcomingTask.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-blue-500 font-semibold">{ar?"🔵 قادمة":"🔵 Kommande"}</p>
            {upcomingTask.slice(0, 3).map((t: any) => (
              <div key={t.id} className="flex items-center gap-2 bg-blue-50/50 dark:bg-blue-950/10 rounded-lg px-2 py-1.5">
                <Calendar className="w-3 h-3 text-blue-400 flex-shrink-0" />
                <span className="text-xs flex-1 truncate">{t.title}</span>
                <span className="text-[9px] text-blue-400">{t.due_date}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Goals Memory ─────────────────────────────────────────────────── */}
      <Section icon={Target} title={ar?"ذاكرة الأهداف":"Målminne"}
               explainTitleAr="ذاكرة الأهداف" explainTitleSv="Målminne"
               explainAr="يتتبع أهداف المزرعة ومدى التقدم نحو تحقيقها. يعرض الأهداف الجارية ونسبة الإنجاز لكل هدف، والأهداف المحققة."
               explainSv="Spårar gårdens mål och framsteg. Visar aktiva mål med procent uppnått och avslutade mål."
               color="bg-indigo-500"
               badge={`${activeGoals.length} ${ar?"نشط":"aktiva"} · ${doneGoals.length} ${ar?"مكتمل":"klara"}`}>
        {activeGoals.length === 0 && doneGoals.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            {ar ? "لا توجد أهداف مسجلة" : "Inga registrerade mål"}
          </p>
        ) : (
          <div className="space-y-2">
            {activeGoals.slice(0, 6).map((g: any) => {
              const p = Number(g.progress_pct ?? 0);
              const isOverdue = g.status_computed === "overdue";
              const isDueSoon = g.status_computed === "due_soon";
              return (
                <div key={g.id} className={cn(
                  "bg-muted/20 rounded-xl p-3",
                  isOverdue && "bg-red-50/30 dark:bg-red-950/10"
                )}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Target className={cn("w-3.5 h-3.5 flex-shrink-0",
                      isOverdue ? "text-red-400" : isDueSoon ? "text-amber-400" : "text-indigo-400")} />
                    <span className="text-xs font-medium flex-1 truncate">{g.title}</span>
                    <span className="text-[10px] font-bold text-indigo-600">{p.toFixed(0)}%</span>
                  </div>
                  <ProgressBar pct={p}
                    color={isOverdue ? "#ef4444" : isDueSoon ? "#f59e0b" : "#6366f1"}
                    label="" value="" />
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-muted-foreground">{Number(g.current_value).toFixed(0)} / {Number(g.target_value).toFixed(0)} {g.unit}</span>
                    {g.deadline && <span className={cn("text-[9px]", isOverdue ? "text-red-400" : "text-muted-foreground")}>{g.deadline}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── Notes Memory ─────────────────────────────────────────────────── */}
      <Section icon={FileText} title={ar?"ذاكرة الملاحظات":"Anteckningsminne"}
               explainTitleAr="ذاكرة الملاحظات" explainTitleSv="Anteckningsminne"
               explainAr="يعرض آخر الملاحظات اليومية المسجلة من قبل المشرفين والعمال. الملاحظات مهمة لتوثيق الأحداث غير العادية في المزرعة."
               explainSv="Visar de senaste dagliga anteckningarna från personal. Viktigt för att dokumentera ovanliga händelser."
               color="bg-teal-500"
               badge={`${notes.length} ${ar?"آخر ملاحظة":"senaste"}`}
               defaultOpen={false}>
        {notes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            {ar ? "لا توجد ملاحظات بعد" : "Inga anteckningar ännu"}
          </p>
        ) : notes.map((n: any, i: number) => {
          const catColors: Record<string, string> = {
            health:"text-red-500", feeding:"text-amber-500", production:"text-blue-500",
            maintenance:"text-gray-500", observation:"text-purple-500", general:"text-teal-500",
          };
          return (
            <div key={n.id} className="bg-muted/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("text-[9px] font-bold uppercase", catColors[n.category] ?? "text-teal-500")}>
                  {n.category}
                </span>
                <span className="flex-1" />
                <span className="text-[9px] text-muted-foreground">{relDate(n.date, ar)}</span>
                {n.author_name && <span className="text-[9px] text-muted-foreground">· {n.author_name}</span>}
              </div>
              <p className="text-xs text-foreground leading-relaxed line-clamp-3">{n.content}</p>
            </div>
          );
        })}
      </Section>

      {/* ── Monthly trend ─────────────────────────────────────────────────── */}
      {(fin.monthly as any[])?.length > 0 && (
        <Section icon={BarChart3} title={ar?"الاتجاه الشهري":"Månatlig trend"}
                 color="bg-cyan-500" defaultOpen={false}
                 explainTitleAr="الاتجاه الشهري" explainTitleSv="Månatlig trend"
                 explainAr="مقارنة الدخل والمصاريف والربح شهراً بشهر لآخر 6 أشهر. يساعدك على رؤية هل مزرعتك تتحسن أم تتراجع مع الوقت."
                 explainSv="Jämförelse av inkomster, kostnader och vinst månad för månad de senaste 6 månaderna.">
          <div className="space-y-1.5">
            {((fin.monthly as any[]) ?? []).slice(0, 6).map((m: any, i: number) => {
              const inc = Number(m.income);
              const exp = Number(m.expense);
              const prof = Number(m.profit);
              return (
                <div key={i} className="bg-muted/20 rounded-lg p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-foreground">{m.month}</span>
                    <span className={cn("text-xs font-bold", prof >= 0 ? "text-emerald-600" : "text-red-500")}>
                      {prof >= 0 ? "+" : ""}{money(prof, lang)}
                    </span>
                  </div>
                  <div className="flex gap-1.5 text-[9px]">
                    <span className="text-emerald-600">↑ {money(inc, lang)}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-red-500">↓ {money(exp, lang)}</span>
                    <span className="text-muted-foreground ms-auto">×{m.tx_count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 py-3 text-center">
        <Brain className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-[10px] text-muted-foreground">
          {ar
            ? `آخر تحديث: ${new Date(state.timestamp).toLocaleTimeString("ar-IQ")} · تحديث تلقائي كل 5 ث`
            : `Senast uppdaterat: ${new Date(state.timestamp).toLocaleTimeString("sv-SE")} · Auto-uppdatering var 5:e sek`}
        </p>
      </div>
    </div>
  );
}
