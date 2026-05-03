import { useEffect, useState, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Thermometer, Droplets, Wind, AlertTriangle, CheckCircle2, RefreshCw, MapPin, Clock, FlaskConical, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiPath } from "@/lib/api";

const MOSUL_LAT = 36.3354;
const MOSUL_LON = 43.1188;

const WEATHER_CODES: Record<number, { ar: string; sv: string; icon: string }> = {
  0:  { ar: "صافٍ",           sv: "Klart",              icon: "☀️" },
  1:  { ar: "صافٍ جزئياً",    sv: "Mestadels klart",    icon: "🌤️" },
  2:  { ar: "غائم جزئياً",    sv: "Delvis molnigt",     icon: "⛅" },
  3:  { ar: "غائم",           sv: "Mulet",              icon: "☁️" },
  45: { ar: "ضباب",           sv: "Dimma",              icon: "🌫️" },
  48: { ar: "ضباب جليدي",     sv: "Isimma",             icon: "🌫️" },
  51: { ar: "رذاذ خفيف",      sv: "Lätt duggregn",      icon: "🌦️" },
  61: { ar: "مطر خفيف",       sv: "Lätt regn",          icon: "🌧️" },
  63: { ar: "مطر معتدل",      sv: "Måttligt regn",      icon: "🌧️" },
  65: { ar: "مطر غزير",       sv: "Kraftigt regn",      icon: "⛈️" },
  80: { ar: "زخات مطر",       sv: "Regnskurar",         icon: "🌦️" },
  95: { ar: "عاصفة رعدية",    sv: "Åskstorm",           icon: "⛈️" },
};

interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  apparentTemp: number;
  weatherCode: number;
  updatedAt: Date;
}

interface CycleSummary {
  optimalTemp: number;
  optimalHumid1: number;
  bestRate: number;
  cycleCount: number;
  source: "history" | "standard";
}

interface Alert {
  level: "warning" | "critical" | "ok" | "info";
  messageAr: string;
  messageSv: string;
}

// Incubation targets based on real performance data:
// Days 1–18  →  50–55% (midpoint 52%)
// Days 18–21 →  70–75% (midpoint 72%) — CRITICAL for final hatch
const BASE_HUMID_INCUB   = 52;  // days 1-18
const BASE_HUMID_LOCKDOWN = 72;  // days 18-21

function calibrateFromCycles(cycles: any[]): CycleSummary {
  const completed = cycles
    .filter(c => c.status === "completed" && c.eggsHatched != null && c.eggsSet > 0)
    .map(c => ({
      rate: c.eggsHatched / c.eggsSet,
      temp: c.temperature ?? null,
      humidity: c.humidity ?? null,
    }))
    .sort((a, b) => b.rate - a.rate);

  const withSettings = completed.filter(c => c.temp != null && c.humidity != null);
  const top = withSettings.slice(0, Math.min(2, withSettings.length));

  if (top.length === 0) {
    return { optimalTemp: 37.5, optimalHumid1: BASE_HUMID_INCUB, bestRate: 0, cycleCount: completed.length, source: "standard" };
  }

  const avgTemp = top.reduce((s, c) => s + c.temp!, 0) / top.length;
  // History shows what was USED — we still recommend 52% as target for days 1-18
  // (user used 55% and got 53%; lower slightly and push lockdown to 72% for improvement)
  const bestRate = Math.round(completed[0].rate * 100);
  const recordedHumid = Math.round(top.reduce((s, c) => s + c.humidity!, 0) / top.length);

  return {
    optimalTemp: Math.round(avgTemp * 10) / 10,
    // If recorded humidity > 55, recommend the correct target (52), not what they used
    optimalHumid1: recordedHumid > 55 ? BASE_HUMID_INCUB : recordedHumid,
    bestRate,
    cycleCount: completed.length,
    source: "history",
  };
}

// Adjust incubation phase humidity (days 1-18) for outdoor conditions
function adjustIncubHumidForOutdoor(baseHumid: number, outdoorHumid: number): number {
  if (outdoorHumid >= 80) return Math.max(42, baseHumid - Math.round((outdoorHumid - 65) * 0.35));
  if (outdoorHumid >= 70) return Math.max(46, baseHumid - Math.round((outdoorHumid - 65) * 0.25));
  if (outdoorHumid <= 30) return Math.min(58, baseHumid + Math.round((35 - outdoorHumid) * 0.25));
  if (outdoorHumid <= 40) return Math.min(56, baseHumid + Math.round((40 - outdoorHumid) * 0.15));
  return baseHumid;
}

// Adjust lockdown phase humidity (days 18-21) for outdoor conditions
// More conservative — lockdown moisture is critical for final hatch
function adjustLockdownHumidForOutdoor(outdoorHumid: number): number {
  if (outdoorHumid >= 80) return 68; // very humid outside — slightly lower lockdown target
  if (outdoorHumid >= 72) return 70; // aim for lower end of 70-75 range
  if (outdoorHumid <= 30) return 74; // very dry outside — push to upper end
  return BASE_HUMID_LOCKDOWN;        // 72 in normal conditions
}

function buildAlerts(weather: WeatherData, calibrated: CycleSummary, adjustedIncub: number, adjustedLockdown: number): Alert[] {
  const alerts: Alert[] = [];
  const outdoorH = weather.humidity;
  const outdoorT = weather.temperature;

  if (outdoorT >= 40) {
    alerts.push({ level: "critical", messageAr: "⚠️ حرارة خارجية حرجة (+40°م) — خطر ارتفاع حرارة الفقاسة، افحصها فوراً!", messageSv: "⚠️ Kritisk utomhustemperatur — risk för överhettning i kläckmaskinen!" });
  } else if (outdoorT >= 35) {
    alerts.push({ level: "warning", messageAr: "🌡️ حرارة خارجية مرتفعة (35°م+) — راقب حرارة الفقاسة كل ساعة", messageSv: "🌡️ Hög utomhustemperatur — övervaka kläckmaskinens temperatur noga" });
  }

  if (outdoorH >= 80) {
    alerts.push({ level: "warning", messageAr: `💦 رطوبة خارجية مرتفعة جداً (${outdoorH}٪) — قلل الماء بشكل ملحوظ. استهدف ${adjustedIncub}٪ (أيام 1-18) و${adjustedLockdown}٪ (أيام 18-21)`, messageSv: `💦 Mycket hög utomhusfuktighet (${outdoorH}%) — minska vattnet kraftigt: sikta ${adjustedIncub}% (dag 1-18) och ${adjustedLockdown}% (dag 18-21)` });
  } else if (outdoorH >= 70) {
    alerts.push({ level: "warning", messageAr: `💧 رطوبة خارجية مرتفعة (${outdoorH}٪) — خفف الماء. استهدف ${adjustedIncub}٪ في الإدخال و${adjustedLockdown}٪ في الهاتشر`, messageSv: `💧 Hög utomhusfuktighet (${outdoorH}%) — minska vattnet: ${adjustedIncub}% (inkubation) och ${adjustedLockdown}% (lockdown)` });
  } else if (outdoorH <= 30) {
    alerts.push({ level: "warning", messageAr: `🏜️ رطوبة خارجية منخفضة جداً (${outdoorH}٪) — أضف ماء أكثر. استهدف ${adjustedIncub}٪ إدخال و${adjustedLockdown}٪ هاتشر`, messageSv: `🏜️ Mycket låg utomhusfuktighet (${outdoorH}%) — tillsätt mer vatten: sikta ${adjustedIncub}% och ${adjustedLockdown}%` });
  } else if (outdoorH <= 40) {
    alerts.push({ level: "info", messageAr: `💧 رطوبة منخفضة قليلاً (${outdoorH}٪) — راقب مستوى الماء. استهدف ${adjustedIncub}٪ إدخال، ${adjustedLockdown}٪ هاتشر`, messageSv: `💧 Något låg utomhusfuktighet (${outdoorH}%) — håll koll på vattennivån` });
  }

  if (weather.windSpeed > 10) {
    alerts.push({ level: "warning", messageAr: "💨 رياح قوية — أغلق نوافذ غرفة الفقاسة جيداً", messageSv: "💨 Starka vindar — stäng kläckrummets fönster ordentligt" });
  }

  if (alerts.length === 0) {
    if (calibrated.source === "history" && calibrated.bestRate < 60) {
      alerts.push({ level: "info", messageAr: `📊 الطقس مناسب — أفضل نسبة مزرعتك ${calibrated.bestRate}٪. لتجاوز 75٪: ارفع رطوبة الهاتشر (أيام 18-21) إلى ${adjustedLockdown}٪ وحافظ على التقليب المنتظم`, messageSv: `📊 Vädret lämpligt — bästa kläckgrad ${calibrated.bestRate}%. Höj lockdown-fuktigheten till ${adjustedLockdown}% för att nå 75%+` });
    } else {
      alerts.push({ level: "ok", messageAr: "✅ الطقس مناسب — ظروف الفقاسة ضمن النطاق الجيد", messageSv: "✅ Vädret är lämpligt — kläckförhållandena inom goda gränser" });
    }
  }

  return alerts;
}

export function WeatherWidget() {
  const { t, lang } = useLanguage();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [cycles, setCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(0);

  const fetchCycles = useCallback(async () => {
    try {
      const resp = await fetch(apiPath("/hatching-cycles"), { credentials: "include" });
      if (resp.ok) {
        const data = await resp.json();
        setCycles(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent — weather still works without cycle data
    }
  }, []);

  const fetchWeather = useCallback(async () => {
    try {
      setError(false);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${MOSUL_LAT}&longitude=${MOSUL_LON}&current=temperature_2m,relative_humidity_2m,weather_code,apparent_temperature,wind_speed_10m&timezone=Asia%2FBaghdad&wind_speed_unit=ms`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("API error");
      const data = await resp.json();
      const c = data.current;
      setWeather({
        temperature: c.temperature_2m,
        humidity: c.relative_humidity_2m,
        windSpeed: c.wind_speed_10m,
        apparentTemp: c.apparent_temperature,
        weatherCode: c.weather_code,
        updatedAt: new Date(),
      });
      setSecondsAgo(0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchWeather();
    fetchCycles();
  }, [fetchWeather, fetchCycles]);

  useEffect(() => {
    refreshAll();
    const wi = setInterval(fetchWeather, 60_000);
    const ci = setInterval(fetchCycles, 120_000);
    return () => { clearInterval(wi); clearInterval(ci); };
  }, [refreshAll, fetchWeather, fetchCycles]);

  useEffect(() => {
    const tick = setInterval(() => setSecondsAgo(s => s + 1), 1000);
    return () => clearInterval(tick);
  }, [weather]);

  const wDesc = weather ? (WEATHER_CODES[weather.weatherCode] ?? { ar: "غير معروف", sv: "Okänt", icon: "🌡️" }) : null;

  const calibrated = calibrateFromCycles(cycles);
  const adjustedHumid1 = weather ? adjustIncubHumidForOutdoor(calibrated.optimalHumid1, weather.humidity) : calibrated.optimalHumid1;
  const adjustedHumid2 = weather ? adjustLockdownHumidForOutdoor(weather.humidity) : BASE_HUMID_LOCKDOWN;
  const incubChanged   = adjustedHumid1 !== calibrated.optimalHumid1;
  const lockdownChanged = adjustedHumid2 !== BASE_HUMID_LOCKDOWN;
  const humidChanged   = incubChanged || lockdownChanged;
  const alerts = weather ? buildAlerts(weather, calibrated, adjustedHumid1, adjustedHumid2) : [];

  return (
    <Card className="border-none shadow-sm overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-sky-500/10 to-blue-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold">{t("weather.title")}</CardTitle>
              <p className="text-[10px] text-muted-foreground">{lang === "ar" ? "الموصل — إمام غربي" : "Mosul — Imam Al-Gharbi"}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refreshAll} disabled={loading}>
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-3">
        {loading && !weather && (
          <div className="py-4 text-center text-sm text-muted-foreground animate-pulse">{t("weather.loading")}</div>
        )}

        {error && !weather && (
          <div className="py-3 text-center space-y-2">
            <p className="text-xs text-destructive">{t("weather.error")}</p>
            <Button variant="outline" size="sm" onClick={refreshAll} className="h-7 text-xs">{t("weather.retry")}</Button>
          </div>
        )}

        {weather && wDesc && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{wDesc.icon}</span>
                <div>
                  <div className="text-2xl font-bold">{weather.temperature}°C</div>
                  <div className="text-xs text-muted-foreground">{lang === "ar" ? wDesc.ar : wDesc.sv}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right">
                <div className="flex items-center gap-1 text-xs">
                  <Droplets className="w-3 h-3 text-blue-500" />
                  <span className="font-medium">{weather.humidity}%</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <Wind className="w-3 h-3 text-slate-400" />
                  <span className="font-medium">{weather.windSpeed} m/s</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground col-span-2">
                  <Thermometer className="w-3 h-3" />
                  <span>{t("weather.feels")} {weather.apparentTemp}°C</span>
                </div>
              </div>
            </div>

            {/* Smart calibrated incubation targets */}
            <div className={cn(
              "rounded-lg p-2.5 space-y-1.5 border",
              calibrated.source === "history"
                ? "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200/60"
                : "bg-amber-50 dark:bg-amber-950/20 border-amber-200/50"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {calibrated.source === "history"
                    ? <FlaskConical className="w-3 h-3 text-indigo-600" />
                    : <Thermometer className="w-3 h-3 text-amber-600" />
                  }
                  <p className={cn("text-[10px] font-semibold", calibrated.source === "history" ? "text-indigo-700" : "text-amber-700")}>
                    {calibrated.source === "history"
                      ? (lang === "ar" ? `مُعيَّر من ${calibrated.cycleCount} دورات — أفضل نسبة ${calibrated.bestRate}٪` : `Kalibrerat från ${calibrated.cycleCount} omgångar — bästa ${calibrated.bestRate}%`)
                      : t("weather.incubation")
                    }
                  </p>
                </div>
                {humidChanged && (
                  <span className="text-[9px] text-amber-600 font-medium bg-amber-100 px-1.5 py-0.5 rounded-full border border-amber-300">
                    {lang === "ar" ? "معدَّل للطقس" : "Väderanpassat"}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-[9px]">
                <div className="text-center bg-white dark:bg-black/20 rounded p-1.5">
                  <div className="font-bold text-amber-700">{calibrated.optimalTemp}°C</div>
                  <div className="text-muted-foreground">{t("weather.incub.temp")}</div>
                </div>
                <div className={cn("text-center rounded p-1.5", incubChanged ? "bg-amber-100 border border-amber-300" : "bg-white dark:bg-black/20")}>
                  <div className={cn("font-bold", incubChanged ? "text-amber-700" : "text-blue-600")}>
                    {adjustedHumid1}%
                    {incubChanged && <span className="block text-[8px] line-through opacity-50">{calibrated.optimalHumid1}%</span>}
                  </div>
                  <div className="text-muted-foreground">{t("weather.incub.humid1")}</div>
                </div>
                <div className={cn("text-center rounded p-1.5", lockdownChanged ? "bg-amber-100 border border-amber-300" : "bg-emerald-50 border border-emerald-200")}>
                  <div className={cn("font-bold", lockdownChanged ? "text-amber-700" : "text-emerald-700")}>
                    {adjustedHumid2}%
                    {lockdownChanged && <span className="block text-[8px] line-through opacity-50">{BASE_HUMID_LOCKDOWN}%</span>}
                  </div>
                  <div className="text-muted-foreground">{t("weather.incub.humid2")}</div>
                </div>
              </div>

              {calibrated.source === "history" && calibrated.bestRate < 75 && (
                <div className="flex items-center gap-1 text-[9px] text-indigo-600/80">
                  <TrendingUp className="w-2.5 h-2.5" />
                  <span>{lang === "ar" ? `الهدف 75٪ — فجوة ${75 - calibrated.bestRate} نقطة للتحسين` : `Mål 75% — ${75 - calibrated.bestRate} poäng att förbättra`}</span>
                </div>
              )}
            </div>

            {/* Alerts */}
            <div className="space-y-1.5">
              {alerts.map((alert, i) => (
                <div key={i} className={cn(
                  "flex items-start gap-2 rounded-lg p-2 text-xs",
                  alert.level === "critical" && "bg-red-50 dark:bg-red-950/20 text-red-700 border border-red-200/50",
                  alert.level === "warning"  && "bg-amber-50 dark:bg-amber-950/20 text-amber-700 border border-amber-200/50",
                  alert.level === "info"     && "bg-blue-50 dark:bg-blue-950/20 text-blue-700 border border-blue-200/50",
                  alert.level === "ok"       && "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 border border-emerald-200/50",
                )}>
                  {alert.level === "ok"
                    ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  }
                  <span>{lang === "ar" ? alert.messageAr : alert.messageSv}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-1 text-[9px] text-muted-foreground justify-center">
              <Clock className="w-2.5 h-2.5" />
              <span>{t("weather.updated")}: {secondsAgo < 60 ? `${secondsAgo}s` : `${Math.floor(secondsAgo / 60)}m`}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block ms-1" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
