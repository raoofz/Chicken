/**
 * Decision Logic Layer — Operational Intelligence Engine
 * Converts raw weather + farm data into bilingual decisions, impacts & actionable advice.
 * Pure rule-based, deterministic. No external AI calls.
 */

import { db, hatchingCyclesTable, flocksTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeatherSnapshot {
  temperature: number;        // °C
  humidity: number;           // %
  windSpeed: number;          // m/s
  apparentTemp: number;       // °C
  weatherCode: number;
  weatherLabelAr: string;
  weatherLabelSv: string;
  weatherIcon: string;
  fetchedAt: string;          // ISO
}

export interface IncubatorState {
  cycleId: number;
  batchName: string;
  status: string;
  temperature: number | null;
  humidity: number | null;
  lockdownTemperature: number | null;
  lockdownHumidity: number | null;
  eggsSet: number;
  startDate: string;
}

export type DecisionStatus = "danger" | "warning" | "good";
export type DecisionUrgency = "immediate" | "monitor" | "low";

export interface DecisionFactor {
  id: string;
  category: "temperature" | "humidity" | "wind" | "incubator_temp" | "incubator_humidity" | "flock";
  status: DecisionStatus;
  urgency: DecisionUrgency;
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

export interface DecisionReport {
  generatedAt: string;
  overallStatus: DecisionStatus;
  overallScore: number;         // 0-100 (higher = better)
  weather: WeatherSnapshot;
  incubators: IncubatorState[];
  factors: DecisionFactor[];
  summaryAr: string;
  summarySv: string;
  dangerCount: number;
  warningCount: number;
  goodCount: number;
}

// ─── Weather Labels ───────────────────────────────────────────────────────────

const WEATHER_CODES: Record<number, { ar: string; sv: string; icon: string }> = {
  0:  { ar: "صافٍ",           sv: "Klart",             icon: "☀️" },
  1:  { ar: "صافٍ جزئياً",   sv: "Mestadels klart",   icon: "🌤️" },
  2:  { ar: "غائم جزئياً",   sv: "Delvis molnigt",    icon: "⛅" },
  3:  { ar: "غائم",           sv: "Mulet",             icon: "☁️" },
  45: { ar: "ضباب",           sv: "Dimma",             icon: "🌫️" },
  48: { ar: "ضباب جليدي",    sv: "Isimma",            icon: "🌫️" },
  51: { ar: "رذاذ خفيف",     sv: "Lätt duggregn",     icon: "🌦️" },
  61: { ar: "مطر خفيف",      sv: "Lätt regn",         icon: "🌧️" },
  63: { ar: "مطر معتدل",     sv: "Måttligt regn",     icon: "🌧️" },
  65: { ar: "مطر غزير",      sv: "Kraftigt regn",     icon: "⛈️" },
  80: { ar: "زخات مطر",      sv: "Regnskurar",        icon: "🌦️" },
  95: { ar: "عاصفة رعدية",   sv: "Åskstorm",          icon: "⛈️" },
};

// ─── Weather Fetcher ──────────────────────────────────────────────────────────

const LAT = 36.3354;
const LON = 43.1188;

export async function fetchCurrentWeather(): Promise<WeatherSnapshot> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,weather_code,apparent_temperature,wind_speed_10m&timezone=Asia%2FBaghdad&wind_speed_unit=ms`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) throw new Error(`Open-Meteo error: ${resp.status}`);
  const data = await resp.json() as any;
  const c = data.current;
  const wc = c.weather_code as number;
  const label = WEATHER_CODES[wc] ?? { ar: "غير معروف", sv: "Okänt", icon: "🌡️" };
  return {
    temperature: c.temperature_2m,
    humidity: c.relative_humidity_2m,
    windSpeed: c.wind_speed_10m,
    apparentTemp: c.apparent_temperature,
    weatherCode: wc,
    weatherLabelAr: label.ar,
    weatherLabelSv: label.sv,
    weatherIcon: label.icon,
    fetchedAt: new Date().toISOString(),
  };
}

// ─── Farm Data Fetcher ────────────────────────────────────────────────────────

async function fetchFarmState() {
  const [cycles, flocks] = await Promise.all([
    db.select().from(hatchingCyclesTable).where(
      sql`${hatchingCyclesTable.status} IN ('incubating','hatching')`
    ),
    db.select().from(flocksTable),
  ]);

  const incubators: IncubatorState[] = cycles.map((c: any) => ({
    cycleId: c.id,
    batchName: c.batchName,
    status: c.status,
    temperature: c.temperature ? Number(c.temperature) : null,
    humidity: c.humidity ? Number(c.humidity) : null,
    lockdownTemperature: c.lockdownTemperature ? Number(c.lockdownTemperature) : null,
    lockdownHumidity: c.lockdownHumidity ? Number(c.lockdownHumidity) : null,
    eggsSet: c.eggsSet,
    startDate: c.startDate,
  }));

  return { incubators, totalFlocks: flocks.length };
}

// ─── Rule Evaluators ──────────────────────────────────────────────────────────

function evalExternalTemp(temp: number): DecisionFactor {
  const v = `${temp}°C`;
  if (temp < 5) return {
    id: "ext_temp", category: "temperature", status: "danger", urgency: "immediate",
    titleAr: "🌡️ حرارة خارجية حرجة", titleSv: "🌡️ Kritisk utomhustemperatur",
    reasonAr: `الحرارة الخارجية (${v}) منخفضة جداً — خطر صقيع`,
    reasonSv: `Utomhustemperatur (${v}) extremt låg — frostfara`,
    impactAr: "انخفاض حاد في حرارة الفقاسة عند فتح الباب، خطر على الأجنة",
    impactSv: "Kraftig temperatursänkning i kläckmaskinen vid öppning, risk för embryon",
    adviceAr: "🔴 أغلق جميع النوافذ والأبواب فوراً، لا تفتح الفقاسة إلا عند الضرورة القصوى، افحص الحرارة الداخلية الآن",
    adviceSv: "🔴 Stäng alla fönster och dörrar omedelbart. Öppna inte kläckmaskinen utom vid absolut nödvändighet",
    value: v,
  };
  if (temp < 15) return {
    id: "ext_temp", category: "temperature", status: "warning", urgency: "monitor",
    titleAr: "🌡️ جو بارد", titleSv: "🌡️ Kallt väder",
    reasonAr: `الحرارة الخارجية (${v}) منخفضة — خطر فقدان حرارة الفقاسة`,
    reasonSv: `Utomhustemperatur (${v}) låg — risk för värmeförlust`,
    impactAr: "فتح الفقاسة قد يسبب هبوط مفاجئ في الحرارة الداخلية ويضر بالأجنة",
    impactSv: "Att öppna kläckmaskinen kan orsaka plötslig temperatursänkning som skadar embryon",
    adviceAr: "🟡 قلّل فتح الفقاسة، تأكد من عزل جدران الغرفة، راقب الحرارة الداخلية كل ساعة",
    adviceSv: "🟡 Minimera öppnande av kläckmaskinen. Kontrollera isolering och övervaka interntemperaturen",
    value: v,
  };
  if (temp <= 30) return {
    id: "ext_temp", category: "temperature", status: "good", urgency: "low",
    titleAr: "✅ حرارة خارجية مناسبة", titleSv: "✅ Lämplig utomhustemperatur",
    reasonAr: `الحرارة الخارجية (${v}) ضمن النطاق الأمثل`,
    reasonSv: `Utomhustemperatur (${v}) inom idealiskt område`,
    impactAr: "لا تأثير سلبي على الفقاسة — ظروف مثالية للتفقيس",
    impactSv: "Ingen negativ inverkan på kläckmaskinen — idealiska förhållanden",
    adviceAr: "✅ استمر بالعمل الطبيعي، لا تغيير مطلوب",
    adviceSv: "✅ Fortsätt normalt arbete, ingen åtgärd krävs",
    value: v,
  };
  if (temp <= 38) return {
    id: "ext_temp", category: "temperature", status: "warning", urgency: "monitor",
    titleAr: "🌡️ حر خارجي مرتفع", titleSv: "🌡️ Hög utomhusvärme",
    reasonAr: `الحرارة الخارجية (${v}) مرتفعة — خطر ارتفاع حرارة الفقاسة`,
    reasonSv: `Utomhustemperatur (${v}) hög — risk för överhettning`,
    impactAr: "قد ترتفع حرارة غرفة الفقاسة وتؤثر على جهاز التبريد وتخل بثبات الحرارة الداخلية",
    impactSv: "Kläckrummets temperatur kan stiga och störa intern temperaturstabilitet",
    adviceAr: "🟡 تأكد من عمل مراوح التهوية، أغلق الستائر عن النوافذ المعرضة للشمس، راقب كل ساعتين",
    adviceSv: "🟡 Kontrollera att ventilationsfläktar fungerar. Stäng persienner mot sol. Övervaka varannan timme",
    value: v,
  };
  return {
    id: "ext_temp", category: "temperature", status: "danger", urgency: "immediate",
    titleAr: "🔥 موجة حر شديدة", titleSv: "🔥 Extrem värmebölja",
    reasonAr: `الحرارة الخارجية (${v}) شديدة الارتفاع — حالة طارئة`,
    reasonSv: `Utomhustemperatur (${v}) extremt hög — nödläge`,
    impactAr: "خطر مباشر على الأجنة والقطيع — ارتفاع الحرارة قد يقضي على دفعة بأكملها خلال ساعات",
    impactSv: "Direkt fara för embryon och flocken — överhettning kan förstöra en hel sats på timmar",
    adviceAr: "🔴 فتّش الفقاسة الآن، شغّل جميع وسائل التبريد، ضع مياه مثلجة بالقرب من الأجهزة إذا لزم، ابقَ في الموقع",
    adviceSv: "🔴 Kontrollera kläckmaskinen omedelbart. Aktivera all kylning. Stanna på plats och övervaka kontinuerligt",
    value: v,
  };
}

function evalExternalHumidity(humidity: number): DecisionFactor {
  const v = `${humidity}%`;
  if (humidity < 25) return {
    id: "ext_humidity", category: "humidity", status: "danger", urgency: "immediate",
    titleAr: "💧 جفاف شديد", titleSv: "💧 Extrem torrhet",
    reasonAr: `الرطوبة الخارجية (${v}) منخفضة جداً — جفاف حرج`,
    reasonSv: `Utomhusfuktighet (${v}) extremt låg — kritisk torrhet`,
    impactAr: "ستفقد الفقاسة رطوبتها بسرعة — خطر جفاف البيض وموت الأجنة",
    impactSv: "Kläckmaskinen förlorar fuktighet snabbt — risk för torkning av ägg och embryodöd",
    adviceAr: "🔴 أضف ماءً فوراً لأوعية الفقاسة، افحص الرطوبة الداخلية الآن — يجب أن تكون 50-55٪ (أيام 1-18) أو 70-75٪ (أيام 18-21)",
    adviceSv: "🔴 Tillsätt vatten omedelbart. Kontrollera intern fuktighet nu – bör vara 50-55% (dag 1-18) eller 70-75% (dag 18-21)",
    value: v,
  };
  if (humidity < 40) return {
    id: "ext_humidity", category: "humidity", status: "warning", urgency: "monitor",
    titleAr: "💧 رطوبة خارجية منخفضة", titleSv: "💧 Låg utomhusfuktighet",
    reasonAr: `الرطوبة الخارجية (${v}) أقل من المثالي`,
    reasonSv: `Utomhusfuktighet (${v}) under idealvärdet`,
    impactAr: "قد تنخفض رطوبة الفقاسة تدريجياً مما يؤثر على فقس البيض",
    impactSv: "Kläckmaskinens fuktighet kan sjunka gradvis vilket påverkar kläckningen",
    adviceAr: "🟡 تحقق من مستوى الماء في الفقاسة مرتين يومياً وأضف إذا لزم",
    adviceSv: "🟡 Kontrollera vattennivån i kläckmaskinen två gånger dagligen och fyll på vid behov",
    value: v,
  };
  if (humidity <= 65) return {
    id: "ext_humidity", category: "humidity", status: "good", urgency: "low",
    titleAr: "✅ رطوبة خارجية مثالية", titleSv: "✅ Idealisk utomhusfuktighet",
    reasonAr: `الرطوبة الخارجية (${v}) مناسبة`,
    reasonSv: `Utomhusfuktighet (${v}) lämplig`,
    impactAr: "ظروف الرطوبة جيدة — يمكن الحفاظ على 50-55٪ في الفقاسة بسهولة",
    impactSv: "Goda fuktförhållanden — 50-55% i kläckmaskinen lätt att hålla",
    adviceAr: "✅ لا إجراء مطلوب — تأكد من الحفاظ على 50-55٪ أيام 1-18 و70-75٪ في الهاتشر",
    adviceSv: "✅ Ingen åtgärd krävs — håll 50-55% dag 1-18 och 70-75% i lockdown-fasen",
    value: v,
  };
  if (humidity <= 75) return {
    id: "ext_humidity", category: "humidity", status: "warning", urgency: "monitor",
    titleAr: "💦 رطوبة خارجية مرتفعة", titleSv: "💦 Hög utomhusfuktighet",
    reasonAr: `الرطوبة الخارجية (${v}) مرتفعة — تأثير على ضبط الفقاسة`,
    reasonSv: `Utomhusfuktighet (${v}) hög — påverkar inställning av kläckmaskinen`,
    impactAr: "قد ترتفع رطوبة الفقاسة تجاوز 55٪ — يصعب الحفاظ على الهدف 50-55٪ في أيام 1-18",
    impactSv: "Kläckmaskinens fuktighet kan överstiga 55% — svårt att hålla 50-55% under dag 1-18",
    adviceAr: "🟡 قلل الماء في الفقاسة. استهدف 48-50٪ إدخال بدلاً من 52٪. في الهاتشر استمر بـ 70٪",
    adviceSv: "🟡 Minska vattnet i kläckmaskinen. Sikta 48-50% (dag 1-18), håll 70% i lockdown",
    value: v,
  };
  return {
    id: "ext_humidity", category: "humidity", status: "danger", urgency: "immediate",
    titleAr: "💦 رطوبة خارجية عالية جداً", titleSv: "💦 Extremt hög utomhusfuktighet",
    reasonAr: `الرطوبة الخارجية (${v}) مرتفعة جداً — خطر مرتفع`,
    reasonSv: `Utomhusfuktighet (${v}) extremt hög — hög risk`,
    impactAr: "خطر ارتفاع رطوبة الفقاسة بشكل حاد — يضر الأجنة ويسبب نمو الفطريات والعفن على البيض",
    impactSv: "Risk för kraftig fuktstegring i kläckmaskinen — skadar embryon och orsakar mögeltillväxt på ägg",
    adviceAr: "🔴 خفّض كمية الماء في الفقاسة الآن، تأكد من تهوية الغرفة جيداً لتقليل الرطوبة",
    adviceSv: "🔴 Minska vattenmängden i kläckmaskinen nu. Se till att rummet är välventilerat för att minska fuktigheten",
    value: v,
  };
}

function evalWind(windSpeed: number): DecisionFactor | null {
  const v = `${windSpeed} m/s`;
  if (windSpeed > 15) return {
    id: "wind", category: "wind", status: "danger", urgency: "immediate",
    titleAr: "🌪️ عاصفة قوية", titleSv: "🌪️ Kraftig storm",
    reasonAr: `رياح عاتية (${v}) — خطر مباشر على المباني`,
    reasonSv: `Kraftiga vindar (${v}) — direkt risk för byggnader`,
    impactAr: "احتمال انقطاع التيار الكهربائي أو تلف التهوية مما يوقف الفقاسة",
    impactSv: "Risk för strömavbrott eller ventilationsskador som stoppar kläckmaskinen",
    adviceAr: "🔴 تحقق من استقرار الطاقة، تأكد من إغلاق كل النوافذ والأبواب، جهّز مصدر طاقة احتياطي إن أمكن",
    adviceSv: "🔴 Kontrollera strömstabilitet. Stäng alla fönster och dörrar. Förbered reservkraft om möjligt",
    value: v,
  };
  if (windSpeed > 7) return {
    id: "wind", category: "wind", status: "warning", urgency: "monitor",
    titleAr: "💨 رياح متوسطة", titleSv: "💨 Måttliga vindar",
    reasonAr: `رياح بسرعة (${v}) قد تؤثر على تهوية الغرفة`,
    reasonSv: `Vindar med hastighet (${v}) kan påverka rumsventilationen`,
    impactAr: "قد تتغير درجة حرارة غرفة الفقاسة بسبب تسرب الهواء البارد عبر الفجوات",
    impactSv: "Temperaturen i kläckrummet kan förändras på grund av luftläckage",
    adviceAr: "🟡 تأكد من إحكام إغلاق النوافذ والأبواب وأختام الغرفة",
    adviceSv: "🟡 Kontrollera att fönster, dörrar och rumstätningar är ordentligt stängda",
    value: v,
  };
  return null; // ok — no factor needed
}

function evalIncubatorTemp(inc: IncubatorState): DecisionFactor | null {
  const temp = inc.status === "hatching" ? (inc.lockdownTemperature ?? inc.temperature) : inc.temperature;
  if (temp == null) return null;
  const ideal = 37.5;
  const dev = Math.abs(temp - ideal);
  const v = `${temp}°C`;
  const name = inc.batchName;

  if (dev > 1.5) return {
    id: `incub_temp_${inc.cycleId}`, category: "incubator_temp", status: "danger", urgency: "immediate",
    titleAr: `🔴 حرارة فقاسة "${name}" خارج النطاق`, titleSv: `🔴 Kläckmaskinen "${name}" – temperatur utanför intervall`,
    reasonAr: `الحرارة الداخلية (${v}) تختلف ${dev.toFixed(1)}°C عن المثالي (${ideal}°C)`,
    reasonSv: `Interntemperatur (${v}) avviker ${dev.toFixed(1)}°C från idealet (${ideal}°C)`,
    impactAr: "انحراف حاد يضر الأجنة ويقلل معدل التفقيس — التدخل الفوري ضروري",
    impactSv: "Kraftig avvikelse skadar embryon och minskar kläckningsgraden — omedelbar åtgärd krävs",
    adviceAr: `🔴 اضبط حرارة الفقاسة الآن ليصل إلى ${ideal}°C — تحقق بعد 30 دقيقة`,
    adviceSv: `🔴 Justera kläckmaskinens temperatur nu till ${ideal}°C – kontrollera efter 30 minuter`,
    value: v,
  };
  if (dev > 0.5) return {
    id: `incub_temp_${inc.cycleId}`, category: "incubator_temp", status: "warning", urgency: "monitor",
    titleAr: `🟡 حرارة فقاسة "${name}" تحتاج تعديل`, titleSv: `🟡 Kläckmaskinen "${name}" – temperatur behöver justering`,
    reasonAr: `الحرارة الداخلية (${v}) تنحرف ${dev.toFixed(1)}°C عن المثالي`,
    reasonSv: `Interntemperatur (${v}) avviker ${dev.toFixed(1)}°C från idealet`,
    impactAr: "انحراف طفيف — لن يسبب ضرراً فورياً لكن يجب التصحيح لضمان أفضل نسبة فقس",
    impactSv: "Liten avvikelse – orsakar inte omedelbar skada men bör korrigeras för bästa kläckresultat",
    adviceAr: `🟡 عدّل الضبط بشكل تدريجي ليصل إلى ${ideal}°C وراقب الحرارة خلال الساعة القادمة`,
    adviceSv: `🟡 Justera inställningen gradvis till ${ideal}°C och övervaka temperaturen under nästa timme`,
    value: v,
  };
  return {
    id: `incub_temp_${inc.cycleId}`, category: "incubator_temp", status: "good", urgency: "low",
    titleAr: `✅ حرارة فقاسة "${name}" مثالية`, titleSv: `✅ Kläckmaskinen "${name}" – idealisk temperatur`,
    reasonAr: `الحرارة الداخلية (${v}) قريبة من المثالي (${ideal}°C) — انحراف ${dev.toFixed(1)}°C`,
    reasonSv: `Interntemperatur (${v}) nära idealet (${ideal}°C) – avvikelse ${dev.toFixed(1)}°C`,
    impactAr: "ظروف التفقيس ممتازة — استمر بالمراقبة المعتادة",
    impactSv: "Utmärkta kläckningsförhållanden — fortsätt vanlig övervakning",
    adviceAr: "✅ حافظ على الإعداد الحالي — لا تغيير مطلوب",
    adviceSv: "✅ Behåll nuvarande inställning — ingen ändring krävs",
    value: v,
  };
}

function evalIncubatorHumidity(inc: IncubatorState): DecisionFactor | null {
  const isLockdown = inc.status === "hatching";
  const hum = isLockdown ? (inc.lockdownHumidity ?? inc.humidity) : inc.humidity;
  if (hum == null) return null;
  const ideal = isLockdown ? 72 : 52;  // days 1-18: 50-55% target; days 18-21: 70-75% target
  const dev = Math.abs(hum - ideal);
  const v = `${hum}%`;
  const name = inc.batchName;
  const phaseAr = isLockdown ? "الإقفال (يوم 18-21)" : "الحضانة (يوم 1-18)";
  const phaseSv = isLockdown ? "lockdown (dag 18-21)" : "inkubation (dag 1-18)";

  if (dev > 15) return {
    id: `incub_hum_${inc.cycleId}`, category: "incubator_humidity", status: "danger", urgency: "immediate",
    titleAr: `🔴 رطوبة فقاسة "${name}" خارج النطاق`, titleSv: `🔴 Kläckmaskinen "${name}" – fuktighet utanför intervall`,
    reasonAr: `رطوبة ${phaseAr} (${v}) تنحرف ${dev}% عن المثالي (${ideal}%)`,
    reasonSv: `Fuktighet ${phaseSv} (${v}) avviker ${dev}% från idealet (${ideal}%)`,
    impactAr: hum > ideal ? "رطوبة مفرطة تسبب نمو العفن وتمنع الجنين من التنفس الصحيح" : "جفاف يجعل الجنين يلتصق بالقشرة ويعيق الفقس",
    impactSv: hum > ideal ? "Överdriven fuktighet orsakar mögelväxt och hindrar embryot från att andas ordentligt" : "Torrhet gör att embryot fastnar i skalet och hindrar kläckning",
    adviceAr: hum > ideal ? `🔴 خفّض الماء فوراً — الهدف ${ideal}% للمرحلة الحالية` : `🔴 أضف ماءً فوراً — الهدف ${ideal}% للمرحلة الحالية`,
    adviceSv: hum > ideal ? `🔴 Minska vattnet omedelbart – mål ${ideal}% för nuvarande fas` : `🔴 Tillsätt vatten omedelbart – mål ${ideal}% för nuvarande fas`,
    value: v,
  };
  if (dev > 7) return {
    id: `incub_hum_${inc.cycleId}`, category: "incubator_humidity", status: "warning", urgency: "monitor",
    titleAr: `🟡 رطوبة فقاسة "${name}" تحتاج تعديل`, titleSv: `🟡 Kläckmaskinen "${name}" – fuktighet behöver justering`,
    reasonAr: `رطوبة ${phaseAr} (${v}) تنحرف ${dev}% عن المثالي (${ideal}%)`,
    reasonSv: `Fuktighet ${phaseSv} (${v}) avviker ${dev}% från idealet (${ideal}%)`,
    impactAr: "انحراف معتدل في الرطوبة — قد يؤثر على نسبة الفقس إذا استمر",
    impactSv: "Måttlig fuktighetsavvikelse – kan påverka kläckningsgraden om den fortsätter",
    adviceAr: hum > ideal ? `🟡 قلل كمية الماء قليلاً — اهدف لـ${ideal}%` : `🟡 أضف ماءً تدريجياً — اهدف لـ${ideal}%`,
    adviceSv: hum > ideal ? `🟡 Minska vattenmängden något – sikta på ${ideal}%` : `🟡 Tillsätt vatten gradvis – sikta på ${ideal}%`,
    value: v,
  };
  return {
    id: `incub_hum_${inc.cycleId}`, category: "incubator_humidity", status: "good", urgency: "low",
    titleAr: `✅ رطوبة فقاسة "${name}" مثالية`, titleSv: `✅ Kläckmaskinen "${name}" – idealisk fuktighet`,
    reasonAr: `رطوبة ${phaseAr} (${v}) قريبة من المثالي (${ideal}%) — انحراف ${dev}%`,
    reasonSv: `Fuktighet ${phaseSv} (${v}) nära idealet (${ideal}%) – avvikelse ${dev}%`,
    impactAr: "ظروف الرطوبة ممتازة — لا تأثير سلبي",
    impactSv: "Utmärkta fuktförhållanden — ingen negativ inverkan",
    adviceAr: "✅ حافظ على مستوى الماء الحالي",
    adviceSv: "✅ Behåll nuvarande vattennivå",
    value: v,
  };
}

// ─── Score Calculator ─────────────────────────────────────────────────────────

function calcScore(factors: DecisionFactor[]): number {
  if (factors.length === 0) return 100;
  const weights = { danger: -25, warning: -10, good: 5 };
  const base = 100;
  const penalty = factors.reduce((sum, f) => sum + (weights[f.status] ?? 0), 0);
  return Math.max(0, Math.min(100, base + penalty));
}

// ─── Summary Builder ──────────────────────────────────────────────────────────

function buildSummary(factors: DecisionFactor[], weather: WeatherSnapshot, lang: "ar" | "sv"): string {
  const dangerFactors = factors.filter(f => f.status === "danger");
  const warnFactors   = factors.filter(f => f.status === "warning");

  if (lang === "ar") {
    if (dangerFactors.length > 0) {
      const titles = dangerFactors.map(f => f.titleAr).join("، ");
      return `⚠️ يوجد ${dangerFactors.length} حالة حرجة تستلزم تدخلاً فورياً: ${titles}. الطقس حالياً: ${weather.weatherIcon} ${weather.weatherLabelAr} (${weather.temperature}°C، ${weather.humidity}% رطوبة).`;
    }
    if (warnFactors.length > 0) {
      return `🟡 يوجد ${warnFactors.length} تحذير يستوجب المراقبة. الطقس: ${weather.weatherIcon} ${weather.weatherLabelAr} (${weather.temperature}°C). راقب الأوضاع بانتظام.`;
    }
    return `✅ جميع الظروف ضمن النطاق الطبيعي. الطقس: ${weather.weatherIcon} ${weather.weatherLabelAr} (${weather.temperature}°C، ${weather.humidity}% رطوبة). استمر بالعمل الطبيعي.`;
  } else {
    if (dangerFactors.length > 0) {
      const titles = dangerFactors.map(f => f.titleSv).join(", ");
      return `⚠️ ${dangerFactors.length} kritisk situation kräver omedelbar åtgärd: ${titles}. Aktuellt väder: ${weather.weatherIcon} ${weather.weatherLabelSv} (${weather.temperature}°C, ${weather.humidity}% luftfuktighet).`;
    }
    if (warnFactors.length > 0) {
      return `🟡 ${warnFactors.length} varning kräver övervakning. Väder: ${weather.weatherIcon} ${weather.weatherLabelSv} (${weather.temperature}°C). Övervaka situationen regelbundet.`;
    }
    return `✅ Alla förhållanden inom normalt område. Väder: ${weather.weatherIcon} ${weather.weatherLabelSv} (${weather.temperature}°C, ${weather.humidity}% fuktighet). Fortsätt normalt arbete.`;
  }
}

// ─── Main Engine ──────────────────────────────────────────────────────────────

export async function buildDecisionReport(): Promise<DecisionReport> {
  const [weather, { incubators }] = await Promise.all([
    fetchCurrentWeather(),
    fetchFarmState(),
  ]);

  const factors: DecisionFactor[] = [];

  // External conditions
  factors.push(evalExternalTemp(weather.temperature));
  factors.push(evalExternalHumidity(weather.humidity));
  const windFactor = evalWind(weather.windSpeed);
  if (windFactor) factors.push(windFactor);

  // Per-incubator conditions
  for (const inc of incubators) {
    const tf = evalIncubatorTemp(inc);
    if (tf) factors.push(tf);
    const hf = evalIncubatorHumidity(inc);
    if (hf) factors.push(hf);
  }

  // Sort: danger first, then warning, then good
  const order: Record<DecisionStatus, number> = { danger: 0, warning: 1, good: 2 };
  factors.sort((a, b) => order[a.status] - order[b.status]);

  const dangerCount  = factors.filter(f => f.status === "danger").length;
  const warningCount = factors.filter(f => f.status === "warning").length;
  const goodCount    = factors.filter(f => f.status === "good").length;

  const overallStatus: DecisionStatus =
    dangerCount > 0 ? "danger" :
    warningCount > 0 ? "warning" : "good";

  const overallScore = calcScore(factors);

  const summaryAr = buildSummary(factors, weather, "ar");
  const summarySv = buildSummary(factors, weather, "sv");

  return {
    generatedAt: new Date().toISOString(),
    overallStatus,
    overallScore,
    weather,
    incubators,
    factors,
    summaryAr,
    summarySv,
    dangerCount,
    warningCount,
    goodCount,
  };
}
