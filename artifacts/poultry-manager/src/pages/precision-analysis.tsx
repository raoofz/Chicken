/**
 * صفحة المسح الشامل للمزرعة
 * تعرض كل شيء دفعة واحدة بشكل احترافي
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Bird, Egg, ClipboardList, BookOpen, Target,
  AlertTriangle, CheckCircle2, XCircle, Clock,
  Thermometer, Droplets, TrendingUp, TrendingDown, Minus,
  Shield, RefreshCw, Loader2, ChevronDown, ChevronUp,
  Zap, Activity, Star, Calendar, Users,
  ArrowRight, Bell,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FarmScan {
  scannedAt: string;
  healthScore: number;
  flocks: { total: number; list: FLock[] };
  cycles: { total: number; active: number; completed: number; avgHatchRate: number | null; list: Cycle[] };
  tasks: { total: number; overdue: number; today: number; completed: number; pending: number; list: Task[] };
  notes: { total: number; streak: number; recent: Note[] };
  goals: { total: number; completed: number; list: Goal[] };
  alerts: Alert[];
  precision: Precision | null;
}
interface FLock { id: number; name: string; breed: string | null; count: number; age: number | null; purpose: string | null; }
interface Cycle { id: number; name: string; status: string; statusLabel: string; eggsSet: number; eggsHatched: number | null; hatchRate: number | null; hatchLabel: string | null; startDate: string | null; daysRunning: number | null; temperature: number | null; humidity: number | null; tempStatus: "good" | "warn" | "bad" | null; humidStatus: "good" | "warn" | "bad" | null; breed: string | null; }
interface Task { id: number; title: string; completed: boolean; dueDate: string | null; priority: string; category: string | null; isOverdue: boolean; isToday: boolean; daysOverdue: number; statusLabel: string; statusType: "overdue" | "today" | "upcoming" | "done"; }
interface Note { id: number; date: string; content: string; author: string | null; }
interface Goal { id: number; title: string; completed: boolean; targetValue: number | null; currentValue: number | null; unit: string | null; progress: number | null; dueDate: string | null; }
interface Alert { level: "critical" | "warning" | "info"; message: string; category: string; }
interface Precision { riskLevel: string; riskScore: number; failureProbability: number; nextHatchRate: number | null; trend: string; confidence: number; primaryCause: string; dataQualityScore: number; }

// ─── Scan steps ───────────────────────────────────────────────────────────────
const SCAN_STEPS = [
  { key: "flocks",  icon: Users,         label: "القطعان",           delay: 300  },
  { key: "cycles",  icon: Egg,           label: "دورات التفقيس",     delay: 600  },
  { key: "tasks",   icon: ClipboardList, label: "المهام",            delay: 900  },
  { key: "notes",   icon: BookOpen,      label: "الملاحظات اليومية", delay: 1200 },
  { key: "goals",   icon: Target,        label: "الأهداف",           delay: 1500 },
  { key: "alerts",  icon: Bell,          label: "التنبيهات",         delay: 1800 },
  { key: "ai",      icon: Zap,           label: "التحليل الذكي",     delay: 2100 },
];

// ─── Mini helpers ─────────────────────────────────────────────────────────────
const Ring = ({ score, size = 100 }: { score: number; size?: number }) => {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth="10" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={circ}
          style={{ strokeDashoffset: offset, transition: "stroke-dashoffset 1.2s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black" style={{ color }}>{score}</span>
        <span className="text-[10px] text-gray-400 font-medium">صحة المزرعة</span>
      </div>
    </div>
  );
};

const Bar = ({ value, max = 100, color = "#f59e0b" }: { value: number; max?: number; color?: string }) => (
  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
    <div className="h-full rounded-full transition-all duration-700"
      style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color }} />
  </div>
);

function Section({ title, icon: Icon, color, children, defaultOpen = true }: {
  title: string; icon: any; color: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + "20" }}>
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
          <span className="font-bold text-gray-800 text-sm">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function FarmScanPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scan, setScan] = useState<FarmScan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(-1);
  const [lastAt, setLastAt] = useState<string | null>(null);
  const fpRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchScan = useCallback(async (silent = false) => {
    if (!silent) { setScanning(true); setScanStep(0); setScan(null); }
    try {
      // Animate through scan steps
      if (!silent) {
        for (let i = 0; i < SCAN_STEPS.length; i++) {
          await new Promise(r => setTimeout(r, 320));
          setScanStep(i);
        }
        await new Promise(r => setTimeout(r, 300));
      }
      const res = await fetch("/api/ai/farm-scan", { credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      const data: FarmScan = await res.json();
      setScan(data);
      setLastAt(new Date().toLocaleTimeString("ar-SA"));
      if (silent) toast({ title: "🔄 تحديث تلقائي", description: "تم تحديث بيانات المزرعة" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message });
    } finally { setScanning(false); setScanStep(-1); }
  }, [toast]);

  const checkFingerprint = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/fingerprint", { credentials: "include" });
      if (!res.ok) return;
      const { fingerprint } = await res.json();
      if (fpRef.current && fingerprint !== fpRef.current) {
        fpRef.current = fingerprint;
        await fetchScan(true);
      } else if (!fpRef.current) { fpRef.current = fingerprint; }
    } catch { /* silent */ }
  }, [fetchScan]);

  useEffect(() => {
    fetchScan(false);
    timerRef.current = setInterval(checkFingerprint, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 gap-2" dir="rtl">
        <Shield className="h-5 w-5" />للمديرين فقط
      </div>
    );
  }

  // ── SCANNING SCREEN ──────────────────────────────────────────────────────────
  if (scanning) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex flex-col items-center justify-center p-8" dir="rtl">
        <div className="w-full max-w-sm">
          {/* Logo area */}
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-200 mb-4">
              <Activity className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-2xl font-black text-gray-900">مسح المزرعة</h1>
            <p className="text-gray-400 text-sm mt-1">جارٍ فحص كل البيانات...</p>
          </div>

          {/* Scan steps */}
          <div className="space-y-3">
            {SCAN_STEPS.map((step, i) => {
              const Icon = step.icon;
              const done = i < scanStep;
              const active = i === scanStep;
              return (
                <div key={step.key}
                  className={cn("flex items-center gap-3 px-5 py-3.5 rounded-2xl border transition-all duration-500",
                    done ? "bg-green-50 border-green-200" :
                    active ? "bg-amber-50 border-amber-300 shadow-sm" :
                    "bg-white border-gray-100 opacity-50"
                  )}>
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
                    done ? "bg-green-500" : active ? "bg-amber-500" : "bg-gray-100")}>
                    {done
                      ? <CheckCircle2 className="h-5 w-5 text-white" />
                      : active
                        ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                        : <Icon className="h-4 w-4 text-gray-300" />
                    }
                  </div>
                  <span className={cn("font-semibold text-sm",
                    done ? "text-green-700" : active ? "text-amber-700" : "text-gray-300")}>
                    {step.label}
                  </span>
                  {done && <span className="mr-auto text-xs text-green-500 font-medium">✓ تم</span>}
                  {active && <span className="mr-auto text-xs text-amber-500 font-medium animate-pulse">جارٍ الفحص...</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── EMPTY STATE ────────────────────────────────────────────────────────────
  if (!scan) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4" dir="rtl">
        <button onClick={() => fetchScan(false)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 py-3 rounded-2xl shadow-lg shadow-amber-200 transition-all active:scale-95">
          <Activity className="h-5 w-5" />ابدأ مسح المزرعة
        </button>
      </div>
    );
  }

  // ── MAIN DASHBOARD ────────────────────────────────────────────────────────
  const { flocks, cycles, tasks, notes, goals, alerts, precision } = scan;
  const criticalAlerts = alerts.filter(a => a.level === "critical");
  const warningAlerts = alerts.filter(a => a.level === "warning");
  const infoAlerts = alerts.filter(a => a.level === "info");

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* ── HEADER BAR ── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-black text-gray-900">مسح شامل للمزرعة</h1>
            {lastAt && <p className="text-xs text-gray-400">آخر تحديث: {lastAt} · تلقائي كل 30 ث</p>}
          </div>
          <button onClick={() => fetchScan(false)}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm shadow-amber-200 transition-all">
            <RefreshCw className="h-3.5 w-3.5" />مسح الآن
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ── HEALTH SCORE + QUICK STATS ── */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-3xl p-5 text-white shadow-xl shadow-amber-200">
          <div className="flex items-center gap-5">
            <div className="bg-white/20 rounded-2xl p-1">
              <Ring score={scan.healthScore} size={90} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-black leading-tight mb-1">
                {scan.healthScore >= 80 ? "🟢 المزرعة بحالة ممتازة" :
                 scan.healthScore >= 60 ? "🟡 المزرعة تحتاج اهتماماً" :
                 scan.healthScore >= 40 ? "🟠 توجد مشاكل تحتاج تدخلاً" :
                 "🔴 وضع حرج — تصرف الآن"}
              </div>
              <p className="text-white/80 text-xs">
                {new Date(scan.scannedAt).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })}
              </p>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {[
                  { n: tasks.overdue, label: "مهام متأخرة", warn: tasks.overdue > 0 },
                  { n: cycles.active, label: "دورة نشطة", warn: false },
                  { n: notes.streak, label: "أيام توثيق", warn: notes.streak === 0 },
                ].map((s, i) => (
                  <div key={i} className={cn("rounded-xl px-2 py-2 text-center", s.warn ? "bg-red-500/30" : "bg-white/15")}>
                    <div className="text-xl font-black">{s.n}</div>
                    <div className="text-[10px] text-white/80 leading-tight">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── CRITICAL ALERTS ── */}
        {criticalAlerts.length > 0 && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 space-y-2">
            <div className="flex items-center gap-2 text-red-700 font-bold text-sm mb-2">
              <AlertTriangle className="h-4 w-4" />تنبيهات عاجلة ({criticalAlerts.length})
            </div>
            {criticalAlerts.map((a, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm text-red-800 bg-white rounded-xl p-3 border border-red-100 shadow-sm">
                <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                {a.message}
              </div>
            ))}
          </div>
        )}
        {warningAlerts.length > 0 && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-700 font-bold text-sm mb-2">
              <AlertTriangle className="h-4 w-4" />تحذيرات ({warningAlerts.length})
            </div>
            {warningAlerts.map((a, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm text-amber-800 bg-white rounded-xl p-3 border border-amber-100 shadow-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                {a.message}
              </div>
            ))}
          </div>
        )}

        {/* ── TASKS ── */}
        <Section title={`المهام — ${tasks.overdue > 0 ? `⚠️ ${tasks.overdue} متأخرة` : `${tasks.pending} قادمة`}`}
          icon={ClipboardList} color="#f59e0b">
          {/* Summary row */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { n: tasks.overdue, label: "متأخرة", bg: "bg-red-100", text: "text-red-700" },
              { n: tasks.today,   label: "اليوم",  bg: "bg-amber-100", text: "text-amber-700" },
              { n: tasks.pending, label: "قادمة",  bg: "bg-blue-100", text: "text-blue-700" },
              { n: tasks.completed, label: "مكتملة", bg: "bg-green-100", text: "text-green-700" },
            ].map((s, i) => (
              <div key={i} className={cn("rounded-xl py-2 px-1 text-center", s.bg)}>
                <div className={cn("text-xl font-black", s.text)}>{s.n}</div>
                <div className={cn("text-[10px] font-medium", s.text)}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Task list */}
          {tasks.list.length === 0 ? (
            <div className="text-center py-4 text-gray-400 text-sm">لا توجد مهام مسجلة</div>
          ) : (
            <div className="space-y-2">
              {tasks.list.map(t => (
                <div key={t.id} className={cn("flex items-center gap-3 rounded-xl px-3.5 py-3 border",
                  t.statusType === "overdue" ? "bg-red-50 border-red-200" :
                  t.statusType === "today" ? "bg-amber-50 border-amber-200" :
                  t.statusType === "done" ? "bg-gray-50 border-gray-100" : "bg-white border-gray-100"
                )}>
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                    t.statusType === "overdue" ? "bg-red-500" :
                    t.statusType === "today" ? "bg-amber-500" :
                    t.statusType === "done" ? "bg-green-500" : "bg-blue-400"
                  )}>
                    {t.statusType === "done" ? <CheckCircle2 className="h-4 w-4 text-white" /> :
                     t.statusType === "overdue" ? <XCircle className="h-4 w-4 text-white" /> :
                     t.statusType === "today" ? <Clock className="h-4 w-4 text-white" /> :
                     <ArrowRight className="h-4 w-4 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-sm font-semibold truncate", t.completed && "line-through text-gray-400")}>{t.title}</div>
                    {t.dueDate && <div className="text-xs text-gray-400">{t.dueDate}</div>}
                  </div>
                  <span className={cn("text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0",
                    t.statusType === "overdue" ? "bg-red-100 text-red-700" :
                    t.statusType === "today" ? "bg-amber-100 text-amber-700" :
                    t.statusType === "done" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                  )}>
                    {t.statusLabel}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── HATCHING CYCLES ── */}
        <Section title={`دورات التفقيس — ${cycles.active} نشطة · ${cycles.completed} مكتملة`}
          icon={Egg} color="#8b5cf6">
          {cycles.avgHatchRate != null && (
            <div className="flex items-center gap-3 mb-4 bg-purple-50 rounded-xl p-3 border border-purple-100">
              <Star className="h-5 w-5 text-purple-500" />
              <div>
                <div className="text-sm font-bold text-purple-800">متوسط نسبة الفقس: {cycles.avgHatchRate}%</div>
                <div className="text-xs text-purple-500">
                  {cycles.avgHatchRate >= 75 ? "أداء ممتاز" : cycles.avgHatchRate >= 65 ? "أداء مقبول" : "أداء يحتاج تحسين"}
                </div>
              </div>
            </div>
          )}

          {cycles.list.length === 0 ? (
            <div className="text-center py-4 text-gray-400 text-sm">لا توجد دورات تفقيس</div>
          ) : (
            <div className="space-y-3">
              {cycles.list.map(c => (
                <div key={c.id} className={cn("rounded-2xl border p-4",
                  c.status === "completed" ? "bg-gray-50 border-gray-100" :
                  c.status === "hatching" ? "bg-emerald-50 border-emerald-200" : "bg-purple-50 border-purple-200"
                )}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-bold text-sm text-gray-900">{c.name}</div>
                      {c.breed && <div className="text-xs text-gray-400">{c.breed}</div>}
                    </div>
                    <span className={cn("text-xs font-bold px-2.5 py-1 rounded-lg",
                      c.status === "completed" ? "bg-gray-200 text-gray-600" :
                      c.status === "hatching" ? "bg-emerald-500 text-white" : "bg-purple-500 text-white"
                    )}>{c.statusLabel}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-white rounded-xl p-2.5 border text-center">
                      <div className="text-xs text-gray-400 mb-0.5">البيض المحضون</div>
                      <div className="text-lg font-black text-gray-800">{c.eggsSet}</div>
                    </div>
                    {c.hatchRate != null ? (
                      <div className={cn("rounded-xl p-2.5 border text-center",
                        c.hatchRate >= 75 ? "bg-green-50 border-green-200" :
                        c.hatchRate >= 65 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"
                      )}>
                        <div className="text-xs text-gray-400 mb-0.5">نسبة الفقس</div>
                        <div className={cn("text-lg font-black",
                          c.hatchRate >= 75 ? "text-green-700" : c.hatchRate >= 65 ? "text-yellow-700" : "text-red-700"
                        )}>{c.hatchRate}%</div>
                      </div>
                    ) : c.daysRunning != null ? (
                      <div className="bg-white rounded-xl p-2.5 border text-center">
                        <div className="text-xs text-gray-400 mb-0.5">أيام منذ البداية</div>
                        <div className="text-lg font-black text-gray-800">{c.daysRunning}</div>
                      </div>
                    ) : null}
                  </div>

                  {/* Temp + Humidity */}
                  {(c.temperature != null || c.humidity != null) && (
                    <div className="grid grid-cols-2 gap-2">
                      {c.temperature != null && (
                        <div className={cn("flex items-center gap-2 rounded-xl p-2.5 border",
                          c.tempStatus === "good" ? "bg-green-50 border-green-200" :
                          c.tempStatus === "warn" ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"
                        )}>
                          <Thermometer className={cn("h-4 w-4 flex-shrink-0",
                            c.tempStatus === "good" ? "text-green-600" : c.tempStatus === "warn" ? "text-yellow-600" : "text-red-600")} />
                          <div>
                            <div className="text-xs text-gray-500">الحرارة</div>
                            <div className={cn("font-black text-sm",
                              c.tempStatus === "good" ? "text-green-700" : c.tempStatus === "warn" ? "text-yellow-700" : "text-red-700"
                            )}>{c.temperature}°C</div>
                          </div>
                          <span className={cn("mr-auto text-xs font-bold",
                            c.tempStatus === "good" ? "text-green-600" : c.tempStatus === "warn" ? "text-yellow-600" : "text-red-600"
                          )}>{c.tempStatus === "good" ? "✓ ممتاز" : c.tempStatus === "warn" ? "⚠ حدود" : "✗ خطأ"}</span>
                        </div>
                      )}
                      {c.humidity != null && (
                        <div className={cn("flex items-center gap-2 rounded-xl p-2.5 border",
                          c.humidStatus === "good" ? "bg-blue-50 border-blue-200" :
                          c.humidStatus === "warn" ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"
                        )}>
                          <Droplets className={cn("h-4 w-4 flex-shrink-0",
                            c.humidStatus === "good" ? "text-blue-600" : c.humidStatus === "warn" ? "text-yellow-600" : "text-red-600")} />
                          <div>
                            <div className="text-xs text-gray-500">الرطوبة</div>
                            <div className={cn("font-black text-sm",
                              c.humidStatus === "good" ? "text-blue-700" : c.humidStatus === "warn" ? "text-yellow-700" : "text-red-700"
                            )}>{c.humidity}%</div>
                          </div>
                          <span className={cn("mr-auto text-xs font-bold",
                            c.humidStatus === "good" ? "text-blue-600" : c.humidStatus === "warn" ? "text-yellow-600" : "text-red-600"
                          )}>{c.humidStatus === "good" ? "✓ ممتاز" : c.humidStatus === "warn" ? "⚠ حدود" : "✗ خطأ"}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── FLOCKS ── */}
        <Section title={`القطعان — ${flocks.total} قطيع`} icon={Users} color="#06b6d4" defaultOpen={flocks.total > 0}>
          {flocks.list.length === 0 ? (
            <div className="text-center py-4 text-gray-400 text-sm">لا توجد قطعان مسجلة</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {flocks.list.map(f => (
                <div key={f.id} className="bg-cyan-50 border border-cyan-200 rounded-2xl p-3.5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500 flex items-center justify-center">
                      <Bird className="h-4 w-4 text-white" />
                    </div>
                    <div className="font-bold text-sm text-gray-800 truncate">{f.name}</div>
                  </div>
                  {f.breed && <div className="text-xs text-gray-500 mb-1">النوع: {f.breed}</div>}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded font-bold">{f.count} طير</span>
                    {f.age && <span className="text-gray-400">{f.age} أسبوع</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── NOTES ── */}
        <Section title={`الملاحظات — ${notes.total} ملاحظة · سلسلة ${notes.streak} يوم`}
          icon={BookOpen} color="#10b981">
          {notes.streak > 0 ? (
            <div className="flex items-center gap-2 mb-4 bg-emerald-50 rounded-xl p-3 border border-emerald-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <div className="text-sm text-emerald-700">
                <strong>{notes.streak} يوم</strong> متواصل من التوثيق — ممتاز!
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-4 bg-red-50 rounded-xl p-3 border border-red-100">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <div className="text-sm text-red-700">لم تُسجَّل ملاحظة اليوم — سجّل ما حدث الآن</div>
            </div>
          )}
          {notes.recent.length === 0 ? (
            <div className="text-center py-3 text-gray-400 text-sm">لا توجد ملاحظات بعد</div>
          ) : (
            <div className="space-y-2">
              {notes.recent.map(n => (
                <div key={n.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{n.date}</span>
                    {n.author && <span className="text-xs text-gray-400">{n.author}</span>}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{n.content || "—"}</p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── GOALS ── */}
        {goals.total > 0 && (
          <Section title={`الأهداف — ${goals.completed}/${goals.total} مكتمل`}
            icon={Target} color="#f97316">
            <div className="space-y-3">
              {goals.list.map(g => (
                <div key={g.id} className={cn("rounded-xl border p-3.5",
                  g.completed ? "bg-green-50 border-green-200" : "bg-white border-gray-100")}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-800">{g.title}</span>
                    {g.completed
                      ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                      : g.dueDate && <span className="text-xs text-gray-400">{g.dueDate}</span>}
                  </div>
                  {g.progress != null && !g.completed && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{g.currentValue} / {g.targetValue} {g.unit ?? ""}</span>
                        <span>{g.progress}%</span>
                      </div>
                      <Bar value={g.progress} color={g.progress >= 75 ? "#22c55e" : g.progress >= 40 ? "#f59e0b" : "#ef4444"} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── AI PRECISION SUMMARY ── */}
        {precision && (
          <Section title="التحليل الذكي — ملخص" icon={Zap} color="#6366f1">
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Risk */}
              <div className={cn("rounded-2xl p-4 text-center border",
                precision.riskLevel === "critical" ? "bg-red-50 border-red-200" :
                precision.riskLevel === "high" ? "bg-orange-50 border-orange-200" :
                precision.riskLevel === "medium" ? "bg-yellow-50 border-yellow-200" : "bg-green-50 border-green-200"
              )}>
                <div className={cn("text-3xl font-black",
                  precision.riskLevel === "critical" ? "text-red-600" :
                  precision.riskLevel === "high" ? "text-orange-600" :
                  precision.riskLevel === "medium" ? "text-yellow-600" : "text-green-600"
                )}>{precision.riskScore}</div>
                <div className="text-xs text-gray-500 mt-0.5">مستوى الخطر /100</div>
                <div className={cn("text-xs font-bold mt-1",
                  precision.riskLevel === "critical" ? "text-red-600" :
                  precision.riskLevel === "high" ? "text-orange-600" :
                  precision.riskLevel === "medium" ? "text-yellow-600" : "text-green-600"
                )}>
                  {precision.riskLevel === "critical" ? "🔴 حرج" : precision.riskLevel === "high" ? "🟠 مرتفع" : precision.riskLevel === "medium" ? "🟡 متوسط" : "🟢 منخفض"}
                </div>
              </div>

              {/* Next hatch rate */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-center">
                <div className="text-3xl font-black text-indigo-700">
                  {precision.nextHatchRate?.toFixed(0) ?? "—"}%
                </div>
                <div className="text-xs text-gray-500 mt-0.5">توقع الفقس القادم</div>
                <div className="flex items-center justify-center gap-1 mt-1">
                  {precision.trend === "improving" ? <TrendingUp className="h-3.5 w-3.5 text-green-500" /> :
                   precision.trend === "declining" ? <TrendingDown className="h-3.5 w-3.5 text-red-500" /> :
                   <Minus className="h-3.5 w-3.5 text-gray-400" />}
                  <span className="text-xs text-gray-500">
                    {precision.trend === "improving" ? "في تحسّن" : precision.trend === "declining" ? "في تراجع" : "مستقر"}
                  </span>
                </div>
              </div>
            </div>

            {/* Primary cause + confidence */}
            <div className="space-y-2">
              <div className="bg-white border border-gray-100 rounded-xl p-3 flex items-start gap-2">
                <Activity className="h-4 w-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs text-gray-400">السبب الرئيسي</div>
                  <div className="text-sm font-bold text-gray-800">{precision.primaryCause}</div>
                </div>
              </div>
              <div className="bg-white border border-gray-100 rounded-xl p-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>مستوى الثقة بالتحليل</span>
                  <span className="font-bold text-indigo-600">{precision.confidence}%</span>
                </div>
                <Bar value={precision.confidence}
                  color={precision.confidence >= 70 ? "#22c55e" : precision.confidence >= 40 ? "#f59e0b" : "#ef4444"} />
              </div>
            </div>
          </Section>
        )}

        {/* ── INFO ALERTS ── */}
        {infoAlerts.length > 0 && (
          <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 space-y-2">
            <div className="flex items-center gap-2 text-blue-600 font-bold text-xs mb-1">
              <Bell className="h-3.5 w-3.5" />ملاحظات
            </div>
            {infoAlerts.map((a, i) => (
              <div key={i} className="text-xs text-blue-700 flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>{a.message}
              </div>
            ))}
          </div>
        )}

        <div className="text-center text-xs text-gray-300 pb-4">
          {new Date(scan.scannedAt).toLocaleString("ar-SA")} — بصمة المزرعة
        </div>
      </div>
    </div>
  );
}
