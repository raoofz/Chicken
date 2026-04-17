import { useState, useEffect, useCallback, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Thermometer, Droplets, Wind, AlertTriangle, CheckCircle2,
  RefreshCw, Brain, ChevronDown, ChevronUp, Clock,
  ShieldAlert, ShieldCheck, Shield, Zap, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
const REFRESH_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

// ─── Types ─────────────────────────────────────────────────────────────────────

type DecisionStatus = "danger" | "warning" | "good";

interface DecisionFactor {
  id: string;
  category: string;
  status: DecisionStatus;
  urgency: string;
  titleAr: string;
  titleSv: string;
  reasonAr: string;
  reasonSv: string;
  impactAr: string;
  impactSv: string;
  adviceAr: string;
  adviceSv: string;
  value?: string;
}

interface DecisionReport {
  generatedAt: string;
  overallStatus: DecisionStatus;
  overallScore: number;
  weather: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    apparentTemp: number;
    weatherIcon: string;
    weatherLabelAr: string;
    weatherLabelSv: string;
    fetchedAt: string;
  };
  factors: DecisionFactor[];
  summaryAr: string;
  summarySv: string;
  dangerCount: number;
  warningCount: number;
  goodCount: number;
}

// ─── Status Helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DecisionStatus, {
  bg: string; border: string; text: string; badgeBg: string;
  icon: typeof ShieldAlert; labelAr: string; labelSv: string;
}> = {
  danger:  {
    bg: "bg-red-50",    border: "border-red-200",  text: "text-red-700",
    badgeBg: "bg-red-100 text-red-700 border-red-200",
    icon: ShieldAlert,  labelAr: "خطر", labelSv: "Fara",
  },
  warning: {
    bg: "bg-amber-50",  border: "border-amber-200", text: "text-amber-700",
    badgeBg: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Shield,       labelAr: "تحذير", labelSv: "Varning",
  },
  good: {
    bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700",
    badgeBg: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: ShieldCheck,   labelAr: "جيد", labelSv: "Bra",
  },
};

const CATEGORY_ICON: Record<string, typeof Thermometer> = {
  temperature: Thermometer,
  humidity: Droplets,
  wind: Wind,
  incubator_temp: Thermometer,
  incubator_humidity: Droplets,
  flock: Activity,
};

// ─── Factor Card ───────────────────────────────────────────────────────────────

function FactorCard({ factor, lang }: { factor: DecisionFactor; lang: "ar" | "sv" }) {
  const [open, setOpen] = useState(factor.status === "danger");
  const cfg = STATUS_CONFIG[factor.status];
  const Icon = CATEGORY_ICON[factor.category] ?? Activity;
  const StatusIcon = cfg.icon;

  return (
    <div className={cn("rounded-xl border transition-all duration-200", cfg.bg, cfg.border)}>
      <button
        className="w-full flex items-center justify-between p-3 text-start"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", cfg.badgeBg)}>
            <StatusIcon className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className={cn("text-sm font-semibold leading-snug truncate", cfg.text)}>
              {lang === "ar" ? factor.titleAr : factor.titleSv}
            </p>
            {factor.value && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Icon className="w-3 h-3" />
                {factor.value}
              </p>
            )}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" />
               : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className={cn("px-3 pb-3 space-y-2 border-t pt-2.5", cfg.border)}>
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {lang === "ar" ? "السبب" : "Orsak"}
            </p>
            <p className="text-xs leading-relaxed">{lang === "ar" ? factor.reasonAr : factor.reasonSv}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {lang === "ar" ? "التأثير المتوقع" : "Förväntad påverkan"}
            </p>
            <p className="text-xs leading-relaxed">{lang === "ar" ? factor.impactAr : factor.impactSv}</p>
          </div>
          <div className={cn("rounded-lg p-2.5 border", cfg.bg, cfg.border)}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
              {lang === "ar" ? "النصيحة العملية" : "Praktiskt råd"}
            </p>
            <p className="text-xs font-medium leading-relaxed">
              {lang === "ar" ? factor.adviceAr : factor.adviceSv}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function DecisionPanel() {
  const { lang } = useLanguage();
  const [report, setReport] = useState<DecisionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsToNext, setSecondsToNext] = useState(REFRESH_INTERVAL_MS / 1000);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<DecisionReport>("/api/ai/decision");
      setReport(data);
      setLastFetch(new Date());
      setSecondsToNext(REFRESH_INTERVAL_MS / 1000);
    } catch (e: any) {
      setError(e?.message ?? "خطأ في التحميل");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
    timerRef.current = setInterval(fetchReport, REFRESH_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchReport]);

  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setSecondsToNext(s => Math.max(0, s - 1));
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [lastFetch]);

  const overallCfg = report ? STATUS_CONFIG[report.overallStatus] : null;
  const OverallIcon = overallCfg?.icon ?? Brain;

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <Card className="border-none shadow-sm overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-violet-500/10 to-purple-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold">
                {lang === "ar" ? "نظام القرار الذكي" : "Beslutssystem"}
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">
                {lang === "ar" ? "تحليل + تقييم + نصيحة تشغيلية" : "Analys + bedömning + driftsråd"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchReport} disabled={loading}>
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-3">

        {/* Loading */}
        {loading && !report && (
          <div className="py-8 text-center space-y-2 animate-pulse">
            <Brain className="w-8 h-8 mx-auto text-violet-500/50" />
            <p className="text-sm text-muted-foreground">
              {lang === "ar" ? "جاري تحليل بيانات المزرعة والطقس..." : "Analyserar gårdsdata och väder..."}
            </p>
          </div>
        )}

        {/* Error */}
        {error && !report && (
          <div className="py-4 text-center space-y-2">
            <AlertTriangle className="w-6 h-6 mx-auto text-destructive" />
            <p className="text-xs text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchReport} className="h-7 text-xs">
              {lang === "ar" ? "إعادة المحاولة" : "Försök igen"}
            </Button>
          </div>
        )}

        {report && overallCfg && (
          <>
            {/* Weather strip */}
            <div className="flex items-center justify-between bg-sky-50 rounded-xl px-3 py-2 border border-sky-100">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{report.weather.weatherIcon}</span>
                <div>
                  <p className="text-sm font-bold">{report.weather.temperature}°C</p>
                  <p className="text-[10px] text-muted-foreground">
                    {lang === "ar" ? report.weather.weatherLabelAr : report.weather.weatherLabelSv}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Droplets className="w-3 h-3 text-blue-400" />{report.weather.humidity}%</span>
                <span className="flex items-center gap-1"><Wind className="w-3 h-3 text-slate-400" />{report.weather.windSpeed}m/s</span>
              </div>
            </div>

            {/* Overall status */}
            <div className={cn("rounded-xl p-3 border space-y-2", overallCfg.bg, overallCfg.border)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <OverallIcon className={cn("w-5 h-5", overallCfg.text)} />
                  <span className={cn("text-sm font-bold", overallCfg.text)}>
                    {lang === "ar"
                      ? `الحالة العامة: ${overallCfg.labelAr}`
                      : `Allmän status: ${overallCfg.labelSv}`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", overallCfg.badgeBg)}>
                    {report.overallScore}/100
                  </span>
                </div>
              </div>

              {/* Counters */}
              <div className="flex gap-2">
                {report.dangerCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 font-medium flex items-center gap-1">
                    <ShieldAlert className="w-2.5 h-2.5" />{report.dangerCount} {lang === "ar" ? "حرج" : "kritisk"}
                  </span>
                )}
                {report.warningCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-medium flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5" />{report.warningCount} {lang === "ar" ? "تحذير" : "varning"}
                  </span>
                )}
                {report.goodCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5" />{report.goodCount} {lang === "ar" ? "جيد" : "bra"}
                  </span>
                )}
              </div>

              {/* Summary */}
              <p className="text-xs leading-relaxed">
                {lang === "ar" ? report.summaryAr : report.summarySv}
              </p>
            </div>

            {/* Factor list */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground px-1">
                {lang === "ar" ? "تفاصيل التحليل" : "Analysdetaljer"}
              </p>
              {report.factors.map(f => (
                <FactorCard key={f.id} factor={f} lang={lang} />
              ))}
            </div>

            {/* Live update indicator */}
            <div className="flex items-center justify-between text-[9px] text-muted-foreground px-1 pt-1 border-t">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse inline-block" />
                {lang === "ar" ? "يتحدث تلقائياً" : "Uppdateras automatiskt"}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                <span>
                  {lang === "ar" ? "التالي: " : "Nästa: "}
                  <span className="font-mono font-bold">{formatCountdown(secondsToNext)}</span>
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
