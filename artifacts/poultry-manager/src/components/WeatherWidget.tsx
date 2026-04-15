import { useEffect, useState, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Thermometer, Droplets, Wind, AlertTriangle, CheckCircle2, RefreshCw, MapPin, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const MOSUL_LAT = 36.3354;
const MOSUL_LON = 43.1188;

const WEATHER_CODES: Record<number, { ar: string; sv: string; icon: string }> = {
  0: { ar: "صافٍ", sv: "Klart", icon: "☀️" },
  1: { ar: "صافٍ جزئياً", sv: "Mestadels klart", icon: "🌤️" },
  2: { ar: "غائم جزئياً", sv: "Delvis molnigt", icon: "⛅" },
  3: { ar: "غائم", sv: "Mulet", icon: "☁️" },
  45: { ar: "ضباب", sv: "Dimma", icon: "🌫️" },
  48: { ar: "ضباب جليدي", sv: "Isimma", icon: "🌫️" },
  51: { ar: "رذاذ خفيف", sv: "Lätt duggregn", icon: "🌦️" },
  61: { ar: "مطر خفيف", sv: "Lätt regn", icon: "🌧️" },
  63: { ar: "مطر معتدل", sv: "Måttligt regn", icon: "🌧️" },
  65: { ar: "مطر غزير", sv: "Kraftigt regn", icon: "⛈️" },
  80: { ar: "زخات مطر", sv: "Regnskurar", icon: "🌦️" },
  95: { ar: "عاصفة رعدية", sv: "Åskstorm", icon: "⛈️" },
};

interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  apparentTemp: number;
  weatherCode: number;
  updatedAt: Date;
}

interface Alert {
  level: "warning" | "critical" | "ok";
  messageAr: string;
  messageSv: string;
}

function analyzeIncubationAlerts(weather: WeatherData): Alert[] {
  const alerts: Alert[] = [];
  if (weather.temperature >= 40) {
    alerts.push({ level: "critical", messageAr: "⚠️ حرارة خارجية حرجة (+٤٠°م) — خطر ارتفاع حرارة الفقاسة، افحصها فوراً", messageSv: "⚠️ Kritisk utomhustemperatur (+40°C) — risk för överhettning i kläckmaskinen!" });
  } else if (weather.temperature >= 35) {
    alerts.push({ level: "warning", messageAr: "🌡️ حرارة خارجية مرتفعة (٣٥°م+) — راقب حرارة الفقاسة بكثرة", messageSv: "🌡️ Hög utomhustemperatur (35°C+) — övervaka kläckmaskinens temperatur noga" });
  }
  if (weather.humidity < 30) {
    alerts.push({ level: "warning", messageAr: "💧 رطوبة خارجية منخفضة جداً — أضف ماء أكثر في الفقاسة للحفاظ على ٥٥٪", messageSv: "💧 Mycket låg utomhusfuktighet — lägg till mer vatten i kläckmaskinen för att hålla 55%" });
  } else if (weather.humidity > 80) {
    alerts.push({ level: "warning", messageAr: "💦 رطوبة خارجية مرتفعة — قد ترتفع رطوبة الفقاسة، قلل الماء قليلاً", messageSv: "💦 Hög utomhusfuktighet — kläckmaskinens fuktighet kan stiga, minska vattnet lite" });
  }
  if (weather.windSpeed > 10) {
    alerts.push({ level: "warning", messageAr: "💨 رياح قوية — تأكد من إغلاق نوافذ غرفة الفقاسة جيداً", messageSv: "💨 Starka vindar — se till att kläckrummets fönster är ordentligt stängda" });
  }
  if (alerts.length === 0) {
    alerts.push({ level: "ok", messageAr: "✅ الطقس مناسب — ظروف الفقاسة ضمن المعدل الطبيعي", messageSv: "✅ Vädret är lämpligt — kläckförhållandena inom normala gränser" });
  }
  return alerts;
}

export function WeatherWidget() {
  const { t, lang } = useLanguage();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(0);

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

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 60000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  useEffect(() => {
    const tick = setInterval(() => setSecondsAgo(s => s + 1), 1000);
    return () => clearInterval(tick);
  }, [weather]);

  const wDesc = weather ? (WEATHER_CODES[weather.weatherCode] ?? { ar: "غير معروف", sv: "Okänt", icon: "🌡️" }) : null;
  const alerts = weather ? analyzeIncubationAlerts(weather) : [];

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
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchWeather} disabled={loading}>
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
            <Button variant="outline" size="sm" onClick={fetchWeather} className="h-7 text-xs">{t("weather.retry")}</Button>
          </div>
        )}

        {weather && wDesc && (
          <>
            {/* Main weather display */}
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

            {/* Optimal incubation reference */}
            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2.5 space-y-1.5 border border-amber-200/50">
              <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">{t("weather.incubation")}</p>
              <div className="grid grid-cols-3 gap-1.5 text-[9px]">
                <div className="text-center bg-white dark:bg-black/20 rounded p-1.5">
                  <div className="font-bold text-amber-700">37.5°C</div>
                  <div className="text-muted-foreground">{t("weather.incub.temp")}</div>
                </div>
                <div className="text-center bg-white dark:bg-black/20 rounded p-1.5">
                  <div className="font-bold text-blue-600">55%</div>
                  <div className="text-muted-foreground">{t("weather.incub.humid1")}</div>
                </div>
                <div className="text-center bg-white dark:bg-black/20 rounded p-1.5">
                  <div className="font-bold text-blue-600">65%</div>
                  <div className="text-muted-foreground">{t("weather.incub.humid2")}</div>
                </div>
              </div>
            </div>

            {/* Alerts */}
            <div className="space-y-1.5">
              {alerts.map((alert, i) => (
                <div key={i} className={cn(
                  "flex items-start gap-2 rounded-lg p-2 text-xs",
                  alert.level === "critical" && "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200/50",
                  alert.level === "warning" && "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200/50",
                  alert.level === "ok" && "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50",
                )}>
                  {alert.level === "ok"
                    ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  }
                  <span>{lang === "ar" ? alert.messageAr : alert.messageSv}</span>
                </div>
              ))}
            </div>

            {/* Updated time */}
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
