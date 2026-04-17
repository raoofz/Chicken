/**
 * مختبر المزرعة الذكية — Smart Farm Intelligence Lab
 * Comprehensive farm analysis, expansion plans, and bilingual expert advisor chat.
 * Fully deterministic — no external AI needed.
 */
import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Brain, FlaskConical, TrendingUp, Target, ChevronRight,
  Send, RotateCcw, Sparkles, Layers, Lightbulb, CalendarDays,
  Bird, Egg, DollarSign, Activity, CheckSquare, Leaf,
  AlertTriangle, ShieldCheck, Info, ThumbsUp,
  Thermometer, Droplets, Wind, BookOpen, Wrench,
  BarChart3, ArrowUpRight, Clock, Star, Users, Zap,
} from "lucide-react";
import { ExplainTip } from "@/components/ExplainTip";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch(path: string) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (!r.ok) throw new Error("Error");
  return r.json();
}

// ─── Types ─────────────────────────────────────────────────────────────────────
type TabKey = "scan" | "plans" | "advisor";
type ChatMsg = { role: "user" | "advisor"; text: string; topicIcon?: string };

interface DashboardSummary {
  totalFlocks: number; totalChickens: number; totalEggsIncubating: number;
  activeHatchingCycles: number; tasksCompletedToday: number; tasksDueToday: number;
  goalsCompleted: number; totalGoals: number; overallHatchRate: number;
}
interface TxRow { type: "income" | "expense"; amount: string; date: string; category: string; }

interface FarmScores {
  score: number; grade: string;
  financialScore: number; productionScore: number; operationsScore: number; goalsScore: number;
  income: number; expense: number; profit: number; margin: number | null;
  riskLevel: "low" | "medium" | "high"; trend: "up" | "down" | "stable"; confidence: number;
}

function computeFarmScores(summary: DashboardSummary, txs: TxRow[]): FarmScores {
  const income = txs.filter(t => t.type === "income").reduce((s,t) => s + Number(t.amount), 0);
  const expense = txs.filter(t => t.type === "expense").reduce((s,t) => s + Number(t.amount), 0);
  const profit = income - expense;
  const margin = income > 0 ? (profit / income) * 100 : null;

  // Financial score (40 pts): based on margin, profit, data presence
  let finScore = 20; // base
  if (income > 0) finScore += 20;
  if (margin !== null && margin >= 20) finScore += 40;
  else if (margin !== null && margin >= 10) finScore += 25;
  else if (margin !== null && margin >= 0) finScore += 10;
  finScore = Math.min(100, finScore);

  // Production score (30 pts): based on chickens, hatch rate
  let prodScore = 30; // base
  if (summary.totalChickens > 0) prodScore += 20;
  if (summary.overallHatchRate >= 80) prodScore += 30;
  else if (summary.overallHatchRate >= 65) prodScore += 15;
  prodScore = Math.min(100, prodScore);

  // Operations score (20 pts): task completion
  const taskRate = summary.tasksDueToday > 0 ? (summary.tasksCompletedToday / summary.tasksDueToday) * 100 : 50;
  const opsScore = Math.min(100, Math.round(40 + taskRate * 0.6));

  // Goals score (10 pts)
  const goalsScore = summary.totalGoals > 0 ? Math.min(100, Math.round((summary.goalsCompleted / summary.totalGoals) * 100)) : 50;

  const score = Math.round(finScore * 0.35 + prodScore * 0.30 + opsScore * 0.20 + goalsScore * 0.15);
  const grade = score >= 80 ? "excellent" : score >= 60 ? "good" : score >= 40 ? "fair" : "poor";

  const riskLevel: "low"|"medium"|"high" = profit < 0 ? "high" : (margin !== null && margin < 10) ? "medium" : "low";
  const trend: "up"|"down"|"stable" = profit > 0 ? "up" : profit < 0 ? "down" : "stable";

  return { score, grade, financialScore: finScore, productionScore: prodScore, operationsScore: opsScore, goalsScore, income, expense, profit, margin, riskLevel, trend, confidence: 70 };
}

// ─── Knowledge Base ─────────────────────────────────────────────────────────
// 14 topic areas × bilingual expert responses. Context-aware (uses farm data).

type KBTopic = {
  id: string; icon: any;
  titleAr: string; titleSv: string;
  keywords: string[];
  getResponseAr: (ctx: FarmCtx) => string;
  getResponseSv: (ctx: FarmCtx) => string;
};

interface FarmCtx {
  chickens: number; flocks: number; hatchRate: number; activeHatching: number;
  income: number; expense: number; profit: number; margin: number | null;
  score: number; riskLevel: string; trend: string;
}

function n(num: number) { return num.toLocaleString("ar-IQ"); }

const KB: KBTopic[] = [
  {
    id: "feeding", icon: Leaf,
    titleAr: "التغذية والعلف", titleSv: "Utfodring & Foder",
    keywords: ["علف","اكل","غذاء","تغذية","فودر","حبوب","بروتين","سعرات","كمية العلف","وجبة","طعام","feed","foder","protein","mat","utfodring"],
    getResponseAr: (ctx) => `🌾 **خبير التغذية الزراعية**

**الاحتياج اليومي للعلف (مزرعتك: ${n(ctx.chickens)} طير):**

🔹 **فترة البداية (1-21 يوم):**
   • 15-20 غرام/طير/يوم — علف ابتداء بروتين 22-24%
   • تأكد من توفر الماء النظيف 24/7
   • أضف فيتامين C وإلكتروليت في الماء أول 3 أيام

🔹 **فترة النمو (22-35 يوم):**
   • 80-100 غرام/طير/يوم — علف نمو بروتين 19-21%
   • ${ctx.chickens} طير × 90غ = ~${n(Math.round(ctx.chickens * 90))} غرام/يوم = ${n(Math.round(ctx.chickens * 90 / 1000))} كغ/يوم

🔹 **فترة التسمين (36+ يوم):**
   • 120-150 غرام/طير/يوم — علف نهاية بروتين 17-18%
   • ${ctx.chickens} طير × 130غ = ~${n(Math.round(ctx.chickens * 130))} غرام/يوم = ${n(Math.round(ctx.chickens * 130 / 1000))} كغ/يوم

⚡ **نصائح تحسين الكفاءة:**
   • قسّم التغذية على 3-4 وجبات — يزيد الاستفادة 15%
   • اضبط الإضاءة 23 ساعة/يوم في الأسبوع الأول
   • مياه باردة في الصيف = أكل أفضل وزن أسرع
   • نسبة تحويل العلف المثالية: 1.8-2.0 كغ علف/كغ لحم`,
    getResponseSv: (ctx) => `🌾 **Expert på fjäderfänäring**

**Dagsbehov av foder (din gård: ${n(ctx.chickens)} fåglar):**

🔹 **Startfas (1-21 dagar):**
   • 15-20 g/fågel/dag — Startfoder protein 22-24%
   • Säkerställ rent vatten dygnet runt
   • Tillsätt C-vitamin och elektrolyter första 3 dagarna

🔹 **Tillväxtfas (22-35 dagar):**
   • 80-100 g/fågel/dag — Tillväxtfoder protein 19-21%
   • ${ctx.chickens} fåglar × 90g = ~${n(Math.round(ctx.chickens * 90))} g/dag

🔹 **Slutgödningsfas (36+ dagar):**
   • 120-150 g/fågel/dag — Slutfoder protein 17-18%
   • ${ctx.chickens} fåglar × 130g = ~${n(Math.round(ctx.chickens * 130))} g/dag

⚡ **Effektivitetstips:**
   • Dela fodergivan 3-4 gånger/dag — ökar utnyttjandet med 15%
   • FCR-mål: 1,8-2,0 kg foder per kg kött`,
  },
  {
    id: "health", icon: Activity,
    titleAr: "الصحة والأمراض", titleSv: "Hälsa & Sjukdomar",
    keywords: ["مرض","صحة","علاج","دواء","تطعيم","لقاح","نفوق","ميت","سعال","عطاس","إسهال","كوكسي","نيوكاسل","مارك","سالمونيلا","sjuk","hälsa","vaccin","behandling","döda","hosta"],
    getResponseAr: (ctx) => `🏥 **دليل الصحة الزراعية الشامل**

**أهم أمراض الدواجن والوقاية منها:**

🔴 **أمراض تتطلب تدخلاً فورياً:**
   • **نيوكاسل (ND):** سعال + عطاس + التواء الرقبة → وقف الحركة + إخطار بيطري فوري
   • **إنفلونزا الطيور (AI):** نفوق مفاجئ جماعي + إفرازات → عزل فوري + إبلاغ السلطات
   • **مارك:** شلل الأرجل + تورم العيون → لا علاج، التطعيم وقائي فقط

🟡 **أمراض قابلة للعلاج:**
   • **كوكسيديا:** إسهال دموي → أمبرول 0.024% في الماء 5 أيام
   • **التهاب الجهاز التنفسي المزمن (CRD):** طرطشة + صفير → تيلوزين 0.5غ/لتر 5 أيام
   • **التهاب الأمعاء النخري:** نفوق مفاجئ + قرح الأمعاء → لينكومايسين 2غ/لتر

✅ **برنامج التطعيم الإلزامي:**
   • اليوم 1: مارك (في المفقس)
   • اليوم 7: H120 نيوكاسل — غمس
   • اليوم 14: IB/ND — رذاذ
   • اليوم 21: غمبورو — ماء
   • اليوم 35: ND/IB تقوية — رذاذ

⚠️ **مراقبة يومية إلزامية:**
   • عدد الوفيات (طبيعي: <0.5%/أسبوع)
   • استهلاك الماء (تراجع 20%+ = تحذير)
   • استهلاك العلف (تراجع 15%+ = فحص فوري)`,
    getResponseSv: (ctx) => `🏥 **Komplett fjäderfähälsoguide**

**Viktiga sjukdomar och förebyggande åtgärder:**

🔴 **Sjukdomar som kräver omedelbar åtgärd:**
   • **Newcastle (ND):** Hosta + nysningar + halsvridning → Stoppa förflyttning + veterinärkontakt omedelbart
   • **Fågelinfluensa (AI):** Plötslig massdöd → Isolering + myndighetskontakt
   • **Marek:** Lammade ben + ögonskador → Inget botemedel — förebyggande vaccination

🟡 **Behandlingsbara sjukdomar:**
   • **Koccidios:** Blodigt diarré → Amprol 0.024% i vatten 5 dagar
   • **CRD:** Väsande andning → Tylosin 0.5g/liter 5 dagar

✅ **Obligatoriskt vaccinationsprogram:**
   • Dag 1: Marek (i kläckmaskin)
   • Dag 7: H120 Newcastle — doppning
   • Dag 14: IB/ND — spray
   • Dag 21: Gumboro — vatten
   • Dag 35: ND/IB booster — spray`,
  },
  {
    id: "hatching", icon: Egg,
    titleAr: "التفقيس والحضانة", titleSv: "Kläckning & Ruvning",
    keywords: ["تفقيس","حضانة","بيض","حرارة","رطوبة","قلب","شمعة","جنين","فقس","حاضنة","مفقس","kläck","ruvning","ägg","temperatur","luftfuktighet","embryo","inkubator"],
    getResponseAr: (ctx) => `🥚 **دليل التفقيس الاحترافي**\n${ctx.activeHatching > 0 ? `\n📊 لديك حالياً ${ctx.activeHatching} دورة تفقيس نشطة | معدل التفقيس الإجمالي: ${ctx.hatchRate}%\n` : ""}
**المعايير المثلى للحضانة:**

🌡️ **الحرارة:**
   • 1-18 يوم: 37.8°C (100°F) ± 0.3°C
   • 19-21 يوم (فترة الإفراخ): 37.2°C (99°F)
   • مشكلة شائعة: تفاوت الحرارة في الحاضنة ← ضع ثرموميتر في عدة نقاط

💧 **الرطوبة:**
   • 1-18 يوم: 55-60% رطوبة نسبية
   • 19-21 يوم: 65-70% (اجعل القشرة طرية للكسر)
   • تأثير كل 5% زيادة رطوبة: يزيد حجم الفرخ ويقلل فقدان الوزن

🔄 **قلب البيض:**
   • كل ساعتين على الأقل حتى اليوم 18
   • زاوية 45° يساراً ويميناً
   • أوقف القلب تماماً من اليوم 18

🕯️ **الشمعدة (فحص التطور):**
   • اليوم 7: وريد دموي يبدو = خصب ✅ | بيضة صافية = غير خصب ❌
   • اليوم 14: جنين واضح = صحي ✅
   • اليوم 18: بيضة مظلمة تقريباً = جاهز للإفراخ ✅

📈 **معدلات التفقيس المرجعية:**
   • ممتاز: > 85%
   • جيد: 70-85%
   • مقبول: 55-70%
   • ضعيف: < 55% — راجع درجة الحرارة والرطوبة وعمر البيض`,
    getResponseSv: (ctx) => `🥚 **Professionell kläckningsguide**\n${ctx.activeHatching > 0 ? `\n📊 Du har för närvarande ${ctx.activeHatching} aktiva kläckningscykler | Kläckningsgrad: ${ctx.hatchRate}%\n` : ""}
**Optimala inkubationsparametrar:**

🌡️ **Temperatur:**
   • Dag 1-18: 37,8°C ± 0,3°C
   • Dag 19-21 (kläckningsfas): 37,2°C

💧 **Luftfuktighet:**
   • Dag 1-18: 55-60% relativ luftfuktighet
   • Dag 19-21: 65-70%

🔄 **Vändning av ägg:**
   • Var 2:a timme till dag 18
   • Vinkel 45° vänster/höger
   • Stoppa vändning helt från dag 18

📈 **Referensvärden för kläckningsgrad:**
   • Utmärkt: > 85%
   • Bra: 70-85%
   • Godkänt: 55-70%
   • Svagt: < 55% — kontrollera temperatur, luftfuktighet och äggens ålder`,
  },
  {
    id: "finance_tips", icon: DollarSign,
    titleAr: "تحسين الربحية", titleSv: "Förbättra lönsamheten",
    keywords: ["ربح","مال","خسارة","تكلفة","سعر","بيع","دخل","مصروف","اقتصاد","استثمار","profit","vinst","kostnad","pris","ekonomi","intäkt"],
    getResponseAr: (ctx) => {
      const profitStatus = ctx.profit >= 0 ? `تربح ${n(ctx.profit)} د.ع` : `خسارة ${n(Math.abs(ctx.profit))} د.ع`;
      return `💰 **استراتيجية الربحية المتقدمة**\n\n📊 **وضع مزرعتك الحالي:** ${profitStatus}${ctx.margin !== null ? ` | هامش: ${ctx.margin.toFixed(1)}%` : ""}\n\n**أعمدة الربحية الـ 5:**\n\n🔹 **1. تحسين معدل التحويل الغذائي (FCR):**\n   • الهدف: 1.8 كغ علف / 1 كغ لحم\n   • كل 0.1 تحسن في FCR = وفر ~8% تكاليف العلف\n   • الحل: تحسين جودة العلف + برنامج إضاءة صحيح\n\n🔹 **2. تقليل نسبة النفوق:**\n   • كل 1% تقليل = ${n(Math.round(ctx.chickens * 0.01))} طير محفوظ (قيمة تقديرية)\n   • الهدف: نفوق < 3% طوال الدورة\n   • الحل: تطعيم مبكر + تهوية جيدة + كثافة مناسبة\n\n🔹 **3. رفع سعر البيع:**\n   • بيع مباشر للمطاعم = +20-35% على سعر الجملة\n   • تسليم في عيد الأضحى والمناسبات = +40-60%\n   • تسميان مبكر (35 يوم) للأسواق الخاصة\n\n🔹 **4. خفض تكاليف الطاقة:**\n   • LED بدل مصابيح عادية = وفر 65% طاقة\n   • تعزيز عزل السقف = خفض تكاليف تدفئة/تبريد 30%\n\n🔹 **5. التنويع:**\n   • تكبير + دجاج بياض = دخل ثابت من البيض\n   • إنتاج كتاكيت للبيع = ربح إضافي من كل دورة`;
    },
    getResponseSv: (ctx) => {
      const profitStatus = ctx.profit >= 0 ? `Vinst på ${n(ctx.profit)} IQD` : `Förlust på ${n(Math.abs(ctx.profit))} IQD`;
      return `💰 **Avancerad lönsamhetsstrategi**\n\n📊 **Din gårds nuläge:** ${profitStatus}${ctx.margin !== null ? ` | Marginal: ${ctx.margin.toFixed(1)}%` : ""}\n\n**5 lönsamhetspelare:**\n\n🔹 **1. Förbättra foderkonvertering (FCR):**\n   • Mål: 1,8 kg foder / 1 kg kött\n   • Varje 0,1 FCR-förbättring = ~8% lägre foderkostnader\n\n🔹 **2. Minska dödligheten:**\n   • Varje 1% minskning = ${n(Math.round(ctx.chickens * 0.01))} sparade fåglar\n   • Mål: Dödlighet < 3% under hela omgången\n\n🔹 **3. Höja försäljningspriset:**\n   • Direktförsäljning till restauranger = +20-35% jmf grossistpris\n   • Leveranser under högtider = +40-60%\n\n🔹 **4. Sänk energikostnader:**\n   • LED istället för glödlampor = 65% energibesparing\n\n🔹 **5. Diversifiera:**\n   • Lägg till värphöns = stabila inkomster från ägg`;
    },
  },
  {
    id: "expansion", icon: ArrowUpRight,
    titleAr: "التوسع والنمو", titleSv: "Expansion & Tillväxt",
    keywords: ["توسع","نمو","زيادة","جديد","مشروع","بناء","سعة","استثمار","خطة","مستقبل","expand","tillväxt","bygga","investering","plan","framtid","skala"],
    getResponseAr: (ctx) => `🚀 **دليل التوسع الاستراتيجي**\n\n📊 **تحليل قابليتك للتوسع:**\n   • الطيور الحالية: ${n(ctx.chickens)} | الدرجة الإجمالية: ${ctx.score}/100\n   • ${ctx.score >= 70 ? "✅ وضعك ممتاز للتوسع" : ctx.score >= 50 ? "⚠️ تحسين الأداء الحالي أولاً قبل التوسع" : "❌ ركز على إصلاح الأساسيات قبل أي توسع"}\n\n**مراحل التوسع المُوصى بها:**\n\n🔹 **المرحلة 1 — تعظيم السعة الحالية (0-30 يوم):**\n   • رفع الكثافة من 8 إلى 10 طيور/م² (بزيادة التهوية)\n   • استهداف معدل تفقيس > 85%\n   • تحقيق نفوق < 3%\n\n🔹 **المرحلة 2 — توسع متوازن (2-6 أشهر):**\n   • إضافة قسم جديد بطاقة ${n(Math.round(ctx.chickens * 0.5))} طير (50% زيادة)\n   • الاستثمار الأولي: ~${n(Math.round(ctx.chickens * 0.5 * 15000))} د.ع تقديرياً\n   • عائد متوقع: ربح إضافي ${n(Math.round(ctx.chickens * 0.5 * 5000))} د.ع/دورة\n\n🔹 **المرحلة 3 — تنويع الإنتاج (6-18 شهر):**\n   • خط إنتاج بيض: 500 دجاجة بياض = ~400 بيضة/يوم\n   • محطة تفقيس مستقلة: 10,000 بيضة/دورة\n   • عقود توريد مع المطاعم والمستشفيات\n\n⚡ **العوامل الحاسمة للنجاح:**\n   • لا توسع مع نسبة نفوق > 5%\n   • احتاطي مالي = 3 دورات على الأقل\n   • فريق عمل: إضافة عامل لكل 2000 طير إضافي`,
    getResponseSv: (ctx) => `🚀 **Strategisk expansionsguide**\n\n📊 **Din expansionsberedskap:**\n   • Nuvarande fåglar: ${n(ctx.chickens)} | Totalpoäng: ${ctx.score}/100\n   • ${ctx.score >= 70 ? "✅ Utmärkt läge för expansion" : ctx.score >= 50 ? "⚠️ Förbättra nuvarande prestanda först" : "❌ Fokusera på grundläggande förbättringar"}\n\n**Rekommenderade expansionsfaser:**\n\n🔹 **Fas 1 — Maximera befintlig kapacitet (0-30 dagar):**\n   • Öka beläggning från 8 till 10 fåglar/m² (med ökad ventilation)\n\n🔹 **Fas 2 — Balanserad expansion (2-6 månader):**\n   • Tillsätt ny sektion med ${n(Math.round(ctx.chickens * 0.5))} fåglar (+50%)\n\n🔹 **Fas 3 — Diversifiera (6-18 månader):**\n   • Värphönsproduktion: 500 hönor = ~400 ägg/dag\n   • Eget kläckeri: 10 000 ägg/omgång`,
  },
  {
    id: "ventilation", icon: Wind,
    titleAr: "التهوية والبيئة", titleSv: "Ventilation & Miljö",
    keywords: ["تهوية","هواء","حرارة","برودة","حار","بارد","صيف","شتاء","امونيا","غاز","ضباب","رائحة","ventilation","luft","värme","kyla","sommar","vinter","ammoniak"],
    getResponseAr: () => `💨 **نظام التهوية المثالي للدواجن**\n\n**المعايير البيئية الحرجة:**\n\n🌡️ **درجة الحرارة الداخلية المثلى:**\n   • 1-7 أيام: 32-34°C\n   • 8-14 يوم: 28-30°C\n   • 15-21 يوم: 24-26°C\n   • 22+ يوم: 20-22°C\n   • قياس: ارتفاع 15سم فوق الطير\n\n💧 **الرطوبة الداخلية:**\n   • المثالية: 60-70%\n   • فوق 80%: خطر كوكسيديا + مشاكل تنفسية\n   • تحت 40%: جفاف + غبار + التهاب مجاري هوائية\n\n🔬 **مستويات الأمونيا (NH₃):**\n   • < 10 ppm: آمن تماماً ✅\n   • 10-25 ppm: يسبب ضعف نمو ⚠️\n   • > 25 ppm: خطر صحي حرج — افتح الشبابيك فوراً ❌\n\n⚡ **حلول الصيف الحار (درجات مثل الموصل):**\n   • نظام ضباب (fogging) كل 2 ساعة في الظهيرة\n   • مراوح نفق (tunnel ventilation) من الشرق للغرب\n   • تقليل الكثافة 20% في القيظ الشديد\n   • إضافة فيتامين C 300 غرام/طن علف لمقاومة الإجهاد الحراري\n\n❄️ **حلول الشتاء البارد:**\n   • مصادر تدفئة احتياطية مع ثرموستات\n   • إغلاق الفتحات مع الإبقاء على تهوية أدنى 0.5 م/ثانية\n   • ستائر بلاستيكية للمداخل`,
    getResponseSv: () => `💨 **Optimalt ventilationssystem för fjäderfä**\n\n**Kritiska miljöparametrar:**\n\n🌡️ **Optimal inomhustemperatur:**\n   • Dag 1-7: 32-34°C\n   • Dag 8-14: 28-30°C\n   • Dag 15-21: 24-26°C\n   • Dag 22+: 20-22°C\n\n💧 **Inomhusluftsf uktighet:**\n   • Optimal: 60-70%\n   • Över 80%: Risk för koccidios + andningsproblem\n\n🔬 **Ammoniakhalten (NH₃):**\n   • < 10 ppm: Säkert ✅\n   • 10-25 ppm: Tillväxthämmande ⚠️\n   • > 25 ppm: Kritisk hälsorisk ❌\n\n⚡ **Sommarens värmelösningar:**\n   • Dimningssystem var 2:a timme\n   • Tunnelventilation öst-väst\n   • Tillsätt C-vitamin 300 g/ton foder mot värmestress`,
  },
  {
    id: "lighting", icon: Zap,
    titleAr: "برنامج الإضاءة", titleSv: "Ljusprogram",
    keywords: ["ضوء","إضاءة","نور","ساعة","تيمر","برنامج","darkness","light","ljus","belysning","timer","program","dimmer"],
    getResponseAr: () => `💡 **برنامج الإضاءة الاحترافي**\n\n**الجدول الأمثل:**\n\n| العمر | ساعات الضوء | الشدة |\n|-------|------------|-------|\n| 1-3 أيام | 23 ساعة | 20-40 lux |\n| 4-7 أيام | 20 ساعة | 10-20 lux |\n| 8-21 يوم | 18 ساعة | 5-10 lux |\n| 22+ يوم | 16-18 ساعة | 5-10 lux |\n\n**القاعدة الذهبية:**\n   • الإضاءة القوية في البداية: تحفز الأكل والحركة\n   • تقليل تدريجي: يقلل التوتر والتحطيم\n   • ساعات ظلام مريحة: ترسيخ النوم + نمو هرموني أسرع\n\n💡 **أنواع المصابيح:**\n   • LED دافئ (2700K): الأفضل للتسمين\n   • ضوء أحمر: يقلل التحطيم في دجاج البياض\n   • تجنب الأزرق والأخضر في التسمين\n\n📉 **وفر الطاقة:**\n   • LED مقارنة بالمصابيح العادية: توفير 65-80%\n   • تحكم إلكتروني (dimmer + timer): توفير إضافي 20%`,
    getResponseSv: () => `💡 **Professionellt ljusprogram**\n\n**Optimalt schema:**\n\n| Ålder | Ljustimmar | Intensitet |\n|-------|-----------|------------|\n| Dag 1-3 | 23 timmar | 20-40 lux |\n| Dag 4-7 | 20 timmar | 10-20 lux |\n| Dag 8-21 | 18 timmar | 5-10 lux |\n| Dag 22+ | 16-18 timmar | 5-10 lux |\n\n**Gyllene regel:**\n   • Starkt ljus i början stimulerar ätande och rörelse\n   • Gradvis minskning minskar stress\n   • Mörker möjliggör sömn och hormonell tillväxt\n\n💡 **Lampval:**\n   • Varmt LED (2700K): Bäst för slaktkyckling\n   • Rött ljus: Minskar fjäderplockning i värphöns\n\n📉 **Energibesparing:**\n   • LED jämfört med glödlampor: 65-80% besparing`,
  },
  {
    id: "water", icon: Droplets,
    titleAr: "إدارة المياه", titleSv: "Vattenhantering",
    keywords: ["ماء","مياه","شرب","خزان","نظافة","تنقية","سلائق","واتر","water","vatten","dricka","tanke","rengöring","nipple"],
    getResponseAr: (ctx) => `💧 **دليل إدارة المياه الشامل**\n\n**الاحتياج اليومي للمياه:**\n   • ${n(ctx.chickens)} طير × 0.25 لتر/طير/يوم = ${n(Math.round(ctx.chickens * 0.25))} لتر/يوم في الطقس المعتدل\n   • في الصيف الحار: ضاعف الكمية → ${n(Math.round(ctx.chickens * 0.5))} لتر/يوم\n\n**معدل ماء/علف:** 2:1 (لترين ماء لكل كغ علف)\n\n**معايير جودة الماء:**\n   • pH: 6.5-7.5 (حيادي)\n   • كلور حر: 0.2-1 ppm\n   • TDS: < 1000 mg/L\n   • تشوه العلف بالبكتيريا يبدأ عند > 100 CFU/mL\n\n**برنامج تنظيف الخطوط:**\n   • يومياً: فحص وضغط ماء\n   • أسبوعياً: تنظيف بحمض الستريك 1%\n   • بين الدورات: تعقيم شامل بالكلور 200 ppm × ساعة\n\n**أنظمة السقايات:**\n   • نيبل (nipple): أنظف وأكثر كفاءة — نيبل لكل 8-10 طيور\n   • مساقي كوب: سهلة لكن تحتاج تنظيف يومي\n   • تجنب المساقي المفتوحة تماماً`,
    getResponseSv: (ctx) => `💧 **Komplett vattenhanteringsguide**\n\n**Dagsbehov av vatten:**\n   • ${n(ctx.chickens)} fåglar × 0,25 l/fågel/dag = ${n(Math.round(ctx.chickens * 0.25))} liter/dag i normalt väder\n   • Under sommarvärme: Fördubbla → ${n(Math.round(ctx.chickens * 0.5))} liter/dag\n\n**Vattenförhållande vatten/foder:** 2:1\n\n**Vattenkvalitetskrav:**\n   • pH: 6,5-7,5 (neutralt)\n   • Fritt klor: 0,2-1 ppm\n   • TDS: < 1000 mg/L\n\n**Rengöringsschema för ledningar:**\n   • Dagligen: Kontrollera flöde och tryck\n   • Veckovis: Rengör med citronsyra 1%\n   • Mellan omgångar: Desinficera med 200 ppm klor i 1 timme`,
  },
  {
    id: "records", icon: BookOpen,
    titleAr: "السجلات والإدارة", titleSv: "Dokumentation & Hantering",
    keywords: ["سجل","بيانات","ادارة","توثيق","تقرير","إحصاء","record","data","dokumentation","rapport","statistik","hantering"],
    getResponseAr: () => `📋 **نظام السجلات الزراعي الاحترافي**\n\n**السجلات اليومية الإلزامية:**\n\n📊 **سجل الإنتاج اليومي:**\n   • عدد الطيور الصباحي\n   • عدد الوفيات (مع السبب)\n   • كمية العلف المستهلكة\n   • كمية الماء المستهلكة\n   • درجة الحرارة (صباح + مساء)\n   • الرطوبة النسبية\n\n💰 **سجل التكاليف:**\n   • تكلفة العلف/كغ\n   • فاتورة الكهرباء\n   • رواتب العمال\n   • الأدوية والمطاعيم\n\n📈 **مؤشرات الأداء الأسبوعية:**\n   • معدل التحويل الغذائي (FCR)\n   • نسبة الوفيات الأسبوعية\n   • معدل النمو اليومي\n   • وزن عينة (10% من القطيع)\n\n✅ **لماذا التوثيق حاسم؟**\n   • يُمكّن التشخيص المبكر للمشكلات\n   • أساس الحصول على قروض/دعم حكومي\n   • يرفع قيمة مزرعتك للمستثمرين\n   • يسمح بالمقارنة بين الدورات وتحسين الأداء`,
    getResponseSv: () => `📋 **Professionellt dokumentationssystem**\n\n**Obligatoriska dagliga register:**\n\n📊 **Daglig produktionslogg:**\n   • Antal fåglar på morgonen\n   • Antal dödsfall (med orsak)\n   • Förbrukad fodermängd\n   • Vattenförbrukning\n   • Temperatur (morgon + kväll)\n\n💰 **Kostnadsregister:**\n   • Foderpris/kg\n   • Elräkning\n   • Löner\n   • Mediciner och vacciner\n\n📈 **Veckovisa KPI:er:**\n   • Foderkonvertering (FCR)\n   • Veckodödlighet\n   • Daglig viktuppgång\n   • Viktprov (10% av flocken)`,
  },
  {
    id: "market", icon: BarChart3,
    titleAr: "التسويق والمبيعات", titleSv: "Marknadsföring & Försäljning",
    keywords: ["سوق","بيع","تسويق","عميل","سعر","زبون","مطعم","بائع","توزيع","market","sälj","marknad","kund","pris","restaurang","distributör"],
    getResponseAr: (ctx) => `🏪 **استراتيجية التسويق المتكاملة**\n\n**قنوات البيع بحسب ربحيتها:**\n\n| القناة | السعر المتوقع | الجهد المطلوب |\n|--------|--------------|---------------|\n| بيع مباشر للمستهلك | الأعلى +35% | عالٍ |\n| عقود مطاعم وفنادق | +20-25% | متوسط |\n| جزارين ومحلات لحوم | +10-15% | منخفض |\n| تجار الجملة | السعر الرسمي | الأدنى |\n\n**استراتيجية بناء العقود:**\n   • ابدأ بمطعم واحد محلي — ثق بالجودة\n   • مدة العقد المثلى: 3-6 أشهر قابلة للتجديد\n   • نظام الدفع: 50% مقدم + 50% عند التسليم\n   • ضمانات الجودة: شهادة بيطرية + صحة غذائية\n\n**توقيت البيع الذكي:**\n   • رمضان: طلب مرتفع 40-60% — جهّز من قبل بشهر\n   • الأعياد: ارفع السعر 20-30%\n   • الصيف: تحدي الحرارة — قلل الدورات أو وسّع التبريد\n\n**تطوير العلامة التجارية:**\n   • اسم مميز لمزرعتك\n   • شهادات جودة وبيطرية\n   • صفحة واتساب للعملاء الدائمين`,
    getResponseSv: (ctx) => `🏪 **Integrerad marknadsföringsstrategi**\n\n**Försäljningskanaler efter lönsamhet:**\n\n| Kanal | Förväntat pris | Insats |\n|-------|---------------|--------|\n| Direktförsäljning | Högst +35% | Hög |\n| Restaurangkontrakt | +20-25% | Medel |\n| Slaktare | +10-15% | Låg |\n| Grossister | Grundpris | Lägst |\n\n**Strategi för kontraktsbyggande:**\n   • Börja med en lokal restaurang\n   • Optimal kontraktstid: 3-6 månader, förnybart\n   • Betalningssystem: 50% i förskott + 50% vid leverans`,
  },
  {
    id: "workforce", icon: Users,
    titleAr: "إدارة العمالة", titleSv: "Personalhantering",
    keywords: ["عامل","موظف","مشرف","راتب","دوام","مسؤولية","شفت","تدريب","staff","personal","anställd","lön","skift","utbildning","ansvar"],
    getResponseAr: (ctx) => `👷 **دليل إدارة كوادر المزرعة**\n\n**الهيكل التنظيمي المثالي:**\n\n🔹 **حتى 2000 طير:** عامل واحد + صاحب العمل (نصف دوام)\n🔹 **2000-5000 طير:** عاملان دوام كامل (${n(ctx.chickens)} طير حالياً → ${ctx.chickens > 2000 ? "تحتاج عاملين" : "عامل كافٍ"})\n🔹 **5000-10000 طير:** 3 عمال + مشرف\n🔹 **+10000 طير:** 4 عمال + مشرف + مدير مزرعة\n\n**مهام كل وردية:**\n\n🌅 **صباح (6:00 AM):**\n   • عد الطيور وتسجيل النفوق\n   • تشغيل الإضاءة والتهوية\n   • توزيع العلف والماء\n   • فحص البيئة (حرارة، رطوبة، NH₃)\n\n🌆 **مساء (5:00 PM):**\n   • دورة تفتيش ثانية\n   • جرعات دواء إن وجدت\n   • تنظيف المساقي\n   • تسجيل اليومية\n\n📝 **نصائح الاحتفاظ بالكوادر:**\n   • حوافز: مكافأة على انخفاض الوفيات دون الهدف\n   • تدريب شهري: رفع المهارة = رفع الكفاءة\n   • بيئة عمل آمنة: معدات وقائية ومياه شرب`,
    getResponseSv: (ctx) => `👷 **Guide för personalhantering**\n\n**Optimal organisationsstruktur:**\n\n🔹 **Upp till 2 000 fåglar:** En anställd + ägaren\n🔹 **2 000-5 000 fåglar:** Två heltidsanställda\n🔹 **5 000-10 000 fåglar:** 3 anställda + teamledare\n\n**Uppgifter per skift:**\n\n🌅 **Morgon (06:00):**\n   • Räkna fåglar och registrera dödsfall\n   • Starta belysning och ventilation\n   • Distribuera foder och vatten\n   • Kontrollera miljöparametrar\n\n🌆 **Kväll (17:00):**\n   • Andra inspektionsrunda\n   • Medicinering vid behov\n   • Rengör vattenautomater\n   • Fyll i dagslogg`,
  },
  {
    id: "seasons", icon: Thermometer,
    titleAr: "إدارة الفصول", titleSv: "Säsongshantering",
    keywords: ["صيف","شتاء","فصل","موسم","حر","برد","حرارة","تغير","جو","طقس","climate","säsong","sommar","vinter","värme","kyla","väder"],
    getResponseAr: () => `🌤️ **الدليل الموسمي الشامل — موصل العراق**\n\n☀️ **الصيف (يونيو - سبتمبر) — أكثر التحديات:**\n   • درجات تصل لـ 50°C — خطر حقيقي للإجهاد الحراري\n   • تقليل الكثافة 20-25%\n   • جدول الإضاءة: نشاط فجر ومساء (تجنب الظهيرة)\n   • نظام تبريد: مراوح نفق + ضباب\n   • زيادة التهوية × 3 مقارنة بالشتاء\n   • إضافة فيتامين C + إلكتروليت في الماء\n\n❄️ **الشتاء (ديسمبر - فبراير):**\n   • قد تنخفض لـ 5°C ليلاً\n   • تدفئة بالغاز أو كهرباء مع ثرموستات\n   • تقليل التهوية لكن الحفاظ على 0.5 م/ثانية حداً أدنى\n   • أغطية بلاستيكية على الفتحات\n   • مراقبة الرطوبة (ارتفاعها في الشتاء → مشاكل تنفسية)\n\n🍂 **الربيع/الخريف (الأفضل للإنتاج):**\n   • معدل تحويل غذائي أفضل\n   • نفوق أقل\n   • ربحية أعلى بـ 15-25%\n   • ابدأ أكبر دوراتك في هذه الفصول`,
    getResponseSv: () => `🌤️ **Fullständig säsongsguide**\n\n☀️ **Sommar (juni-september) — Störst utmaning:**\n   • Temperaturer upp till 50°C — verklig värmestressrisk\n   • Minska beläggning med 20-25%\n   • Ljusschema: Aktivitet gryning och kväll (undvik middagsvärmen)\n   • Kylsystem: Tunnelfläktar + dimning\n   • Öka ventilationen × 3 jämfört med vinter\n\n❄️ **Vinter (december-februari):**\n   • Kan sjunka till 5°C på natten\n   • Uppvärmning med gas eller el med termostat\n   • Håll miniventilation 0,5 m/s\n\n🍂 **Vår/Höst (bäst för produktion):**\n   • Bättre foderkonvertering\n   • Lägre dödlighet\n   • 15-25% högre lönsamhet\n   • Starta dina största omgångar dessa säsonger`,
  },
  {
    id: "goals_plan", icon: Target,
    titleAr: "تحديد الأهداف والتخطيط", titleSv: "Målsättning & Planering",
    keywords: ["هدف","خطة","تخطيط","نجاح","استراتيجية","مستقبل","أولوية","تطوير","mål","plan","planering","framgång","strategi","framtid","prioritet"],
    getResponseAr: (ctx) => `🎯 **منهجية وضع الأهداف الزراعية**\n\n**نموذج SMART لمزرعتك:**\n\n📌 **الأهداف المقترحة بناءً على وضعك (درجة ${ctx.score}/100):**\n\n${ctx.score < 60 ? `🔴 **أهداف عاجلة (30 يوم):**\n   • تقليل النفوق إلى < 3%\n   • تسجيل جميع المعاملات المالية\n   • تحقيق 90%+ إنجاز المهام اليومية` : `🟢 **أهداف تطويرية (90 يوم):**\n   • رفع هامش الربح إلى 25%+\n   • توسيع الطاقة الإنتاجية 30%\n   • بناء شبكة عملاء دائمين`}\n\n**مؤشرات النجاح الحرجة (KPI):**\n   • FCR هدف: ≤ 1.9\n   • نفوق هدف: < 3%\n   • هامش ربح هدف: > 20%\n   • معدل تفقيس هدف: > 80%\n   • إنجاز المهام: > 90%\n\n**جدول المراجعة:**\n   • يومياً: تسجيل المؤشرات الأساسية\n   • أسبوعياً: مراجعة الأداء مقابل الأهداف\n   • شهرياً: تعديل الخطة وفق النتائج\n   • كل دورة: تقييم شامل وخطة الدورة القادمة`,
    getResponseSv: (ctx) => `🎯 **Metodologi för jordbruksmål**\n\n**SMART-modell för din gård:**\n\n📌 **Föreslagna mål baserade på ditt nuläge (poäng ${ctx.score}/100):**\n\n${ctx.score < 60 ? `🔴 **Brådskande mål (30 dagar):**\n   • Minska dödlighet till < 3%\n   • Registrera alla finansiella transaktioner\n   • Uppnå 90%+ fullförande av dagliga uppgifter` : `🟢 **Utvecklingsmål (90 dagar):**\n   • Höj vinstmarginalen till 25%+\n   • Öka produktionskapaciteten med 30%\n   • Bygg ett nätverk av fasta kunder`}\n\n**KPI-mål:**\n   • FCR: ≤ 1,9\n   • Dödlighet: < 3%\n   • Vinstmarginal: > 20%\n   • Kläckningsgrad: > 80%`,
  },
];

// ─── Keyword Matcher ──────────────────────────────────────────────────────────
function matchTopic(input: string, lang: string): KBTopic | null {
  const lower = input.toLowerCase().trim();
  if (!lower) return null;
  let best: { topic: KBTopic; score: number } | null = null;
  for (const topic of KB) {
    let score = 0;
    for (const kw of topic.keywords) {
      if (lower.includes(kw.toLowerCase())) score += kw.length > 4 ? 2 : 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { topic, score };
  }
  return best?.topic ?? null;
}

// ─── Expansion Plan Builder ───────────────────────────────────────────────────
function buildPlans(ctx: FarmCtx, lang: string) {
  const ar = lang === "ar";
  return [
    {
      horizon: ar ? "خطة 30 يوم — تحسين فوري" : "30-dagarsplan — Omedelbar förbättring",
      icon: Clock, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-200 dark:border-amber-800",
      tasks: ar ? [
        `رفع معدل إنجاز المهام اليومية إلى 95%+ (حالياً يؤثر على الدرجة الإجمالية ${ctx.score}/100)`,
        ctx.hatchRate < 80 ? `تحسين معدل التفقيس من ${ctx.hatchRate}% إلى 80%+ — راجع درجة الحرارة والرطوبة` : `الحفاظ على معدل تفقيس ممتاز (${ctx.hatchRate}%)`,
        ctx.profit < 0 ? "تسجيل جميع مصادر الدخل غير المسجلة — هناك فجوة في البيانات المالية" : `ترقية هامش الربح من ${ctx.margin?.toFixed(1) ?? "—"}% إلى 20%+`,
        "تنفيذ برنامج تطعيم كامل إذا لم يكن مُكتملاً",
        "إنشاء سجل يومي إلكتروني للمزرعة (يرفع قيمة مزرعتك)",
        `تحليل أكبر بند مصاريف وإيجاد فرص توفير 10-15%`,
      ] : [
        `Höj slutförande av dagliga uppgifter till 95%+ (påverkar nuvarande poäng ${ctx.score}/100)`,
        ctx.hatchRate < 80 ? `Förbättra kläckningsgrad från ${ctx.hatchRate}% till 80%+ — kontrollera temperatur och luftfuktighet` : `Upprätthåll utmärkt kläckningsgrad (${ctx.hatchRate}%)`,
        ctx.profit < 0 ? "Registrera alla ej registrerade intäktskällor" : `Förbättra vinstmarginal från ${ctx.margin?.toFixed(1) ?? "—"}% till 20%+`,
        "Genomför komplett vaccinationsprogram om inte gjort",
        "Skapa digital daglig logg (ökar gårdens värde)",
        "Analysera den största kostnadsposten och hitta 10-15% besparingar",
      ],
    },
    {
      horizon: ar ? "خطة 90 يوم — تحسين هيكلي" : "90-dagarsplan — Strukturell förbättring",
      icon: CalendarDays, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20",
      border: "border-blue-200 dark:border-blue-800",
      tasks: ar ? [
        `بناء قاعدة عملاء دائمين: 3 مطاعم/محلات بعقود شهرية منتظمة`,
        `زيادة الطاقة الإنتاجية بنسبة 25-30% (من ${n(ctx.chickens)} إلى ${n(Math.round(ctx.chickens * 1.3))} طير)`,
        "تركيب نظام تهوية محسّن ومراوح نفق لخفض النفوق الصيفي",
        "بناء مخزن علف بسعة 30 يوم للشراء الاقتصادي بالجملة",
        "تدريب العمال على السجلات والمؤشرات الأساسية",
        `تحقيق هامش ربح مستدام > 20% عبر كل دورة إنتاج`,
      ] : [
        "Bygg en stam av fasta kunder: 3 restauranger/butiker med månatliga kontrakt",
        `Öka produktionskapaciteten med 25-30% (från ${n(ctx.chickens)} till ${n(Math.round(ctx.chickens * 1.3))} fåglar)`,
        "Installera förbättrat ventilationssystem för att minska sommardödlighet",
        "Bygg ett foderförråd med 30 dagars kapacitet för ekonomiska grossistköp",
        "Utbilda personal i register och nyckeltal",
        "Uppnå konsekvent vinstmarginal > 20% per omgång",
      ],
    },
    {
      horizon: ar ? "خطة 12 شهر — توسع استراتيجي" : "12-månadersplan — Strategisk expansion",
      icon: Star, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/20",
      border: "border-purple-200 dark:border-purple-800",
      tasks: ar ? [
        `تضاعف الطاقة إلى ${n(ctx.chickens * 2)} طير — توسع تدريجي بخطر محدود`,
        "إضافة خط دجاج بياض: 500 دجاجة = ~400 بيضة/يوم = دخل يومي ثابت",
        "محطة تفقيس مستقلة بسعة 5,000-10,000 بيضة — مصدر ربح مضاف",
        "عقود توريد طويلة الأمد مع مستشفيات ومدارس ومطاعم كبرى",
        "تسجيل المزرعة رسمياً + شهادات بيطرية = أسواق أرقى + تصدير محتمل",
        "بناء هوية تجارية قوية (اسم + لوجو + واتساب تجاري + تقييمات)",
        "الاستعداد للحصول على قرض زراعي لتوسعة كبرى (البيانات الإلكترونية تدعم ذلك)",
      ] : [
        `Fördubbla kapaciteten till ${n(ctx.chickens * 2)} fåglar — stegvis expansion med begränsad risk`,
        "Lägg till värphönslinje: 500 hönor = ~400 ägg/dag = stabil dagsinkomst",
        "Eget kläckeri med kapacitet 5 000-10 000 ägg — extra vinstkälla",
        "Långsiktiga leveransavtal med sjukhus, skolor och stora restauranger",
        "Officiell gårdsregistrering + veterinärintyg = Premiummarknader + möjlig export",
        "Bygg en stark varumärkesidentitet",
        "Förbered ansökan om jordbrukslån för storskalig expansion",
      ],
    },
  ];
}

// ─── Dimension Scores ─────────────────────────────────────────────────────────
function getDimensions(data: FarmScores, summary: DashboardSummary, lang: string) {
  const ar = lang === "ar";
  const hatchScore = summary.overallHatchRate >= 80 ? 85 : summary.overallHatchRate >= 65 ? 65 : summary.overallHatchRate > 0 ? 45 : 50;
  return [
    { label: ar ? "الصحة المالية" : "Finansiell hälsa", score: data.financialScore, color: "text-emerald-600", bg: "bg-emerald-500", icon: DollarSign,
      explainTitleAr: "الصحة المالية", explainTitleSv: "Finansiell hälsa",
      explainAr: "تقيس مدى ربحية المزرعة. تحسب من: هامش الربح، حجم الدخل مقارنة بالمصاريف، واستمرارية الربح. 80+ يعني المزرعة مربحة جداً.",
      explainSv: "Mäter gårdens lönsamhet. Beräknas från: vinstmarginal, inkomst vs kostnader, och vinstens kontinuitet. 80+ innebär mycket lönsam gård." },
    { label: ar ? "الإنتاج" : "Produktion", score: data.productionScore, color: "text-blue-600", bg: "bg-blue-500", icon: Bird,
      explainTitleAr: "درجة الإنتاج", explainTitleSv: "Produktionspoäng",
      explainAr: "تقيس حجم الإنتاج: عدد القطعان، إجمالي الطيور، ودورات التفقيس النشطة. كلما زاد الإنتاج وكان منتظماً ارتفعت الدرجة.",
      explainSv: "Mäter produktionsvolym: antal flockar, totalt fåglar och aktiva kläckningscykler. Högre och regelbunden produktion ger högre poäng." },
    { label: ar ? "العمليات" : "Operationer", score: data.operationsScore, color: "text-purple-600", bg: "bg-purple-500", icon: CheckSquare,
      explainTitleAr: "درجة العمليات", explainTitleSv: "Driftspoäng",
      explainAr: "تقيس مدى انتظام تشغيل المزرعة: إنجاز المهام في موعدها، السجلات اليومية المكتملة، وغياب مهام متأخرة. مزرعة منظمة = درجة عالية.",
      explainSv: "Mäter hur regelbunden driften är: uppgifter i tid, dagliga anteckningar och inga försenade uppgifter. Organiserad gård = högt betyg." },
    { label: ar ? "الأهداف" : "Mål", score: data.goalsScore, color: "text-amber-600", bg: "bg-amber-500", icon: Target,
      explainTitleAr: "درجة الأهداف", explainTitleSv: "Målpoäng",
      explainAr: "تقيس مدى تقدمك نحو أهداف المزرعة. وجود أهداف محددة وإنجازها يرفع الدرجة. غياب الأهداف يُخفّض الدرجة.",
      explainSv: "Mäter framsteg mot gårdens mål. Att ha tydliga mål och uppnå dem höjer poängen. Avsaknad av mål sänker poängen." },
    { label: ar ? "معدل التفقيس" : "Kläckningsgrad", score: hatchScore, color: "text-rose-600", bg: "bg-rose-500", icon: Egg,
      explainTitleAr: "معدل التفقيس", explainTitleSv: "Kläckningsgrad",
      explainAr: "تقيس نسبة نجاح التفقيس = (كتاكيت ناجحة ÷ بيض موضوع) × 100. 80%+ ممتاز، 65-79% جيد، أقل من 65% يحتاج مراجعة درجة الحرارة والرطوبة.",
      explainSv: "Mäter kläckningsframgång = (kläckta kycklingar ÷ lagda ägg) × 100. 80%+ utmärkt, 65-79% bra, under 65% kräver granskning av temperatur och luftfuktighet." },
    { label: ar ? "إجمالي الأداء" : "Total prestanda", score: data.score, color: "text-indigo-600", bg: "bg-indigo-500", icon: Activity,
      explainTitleAr: "إجمالي الأداء", explainTitleSv: "Total prestanda",
      explainAr: "الدرجة الإجمالية المحسوبة من متوسط مرجح لجميع الأبعاد الخمسة. تعكس الصورة الكاملة لصحة مزرعتك.",
      explainSv: "Sammanlagd poäng beräknad från viktat genomsnitt av alla fem dimensioner. Återspeglar hela bilden av gårdens hälsa." },
  ];
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function FarmLab() {
  const { t, lang } = useLanguage();
  const isRtl = lang === "ar";
  const [activeTab, setActiveTab] = useState<TabKey>("scan");
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: summary } = useQuery<DashboardSummary>({
    queryKey: ["farm-lab-summary"],
    queryFn: () => apiFetch("/api/dashboard/summary"),
    staleTime: 3 * 60 * 1000,
  });
  const { data: txs = [] } = useQuery<TxRow[]>({
    queryKey: ["farm-lab-txs"],
    queryFn: () => apiFetch("/api/transactions"),
    staleTime: 3 * 60 * 1000,
  });

  const scores = useMemo(() => summary ? computeFarmScores(summary, txs) : null, [summary, txs]);

  const ctx: FarmCtx = useMemo(() => ({
    chickens: summary?.totalChickens ?? 0,
    flocks: summary?.totalFlocks ?? 0,
    hatchRate: summary?.overallHatchRate ?? 0,
    activeHatching: summary?.activeHatchingCycles ?? 0,
    income: scores?.income ?? 0,
    expense: scores?.expense ?? 0,
    profit: scores?.profit ?? 0,
    margin: scores?.margin ?? null,
    score: scores?.score ?? 50,
    riskLevel: scores?.riskLevel ?? "medium",
    trend: scores?.trend ?? "stable",
  }), [summary, scores]);

  const plans = useMemo(() => buildPlans(ctx, lang), [ctx, lang]);
  const dims = useMemo(() => scores && summary ? getDimensions(scores, summary, lang) : [], [scores, summary, lang]);

  // Scroll chat to bottom
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs]);

  // Welcome message on first open
  useEffect(() => {
    if (activeTab === "advisor" && chatMsgs.length === 0) {
      const greet: ChatMsg = {
        role: "advisor",
        topicIcon: "🤖",
        text: lang === "ar"
          ? `مرحباً بك في مستشار المزرعة الذكي! 👋\n\nأنا مختص في:\n🌾 التغذية والعلف\n🥚 التفقيس والحضانة\n🏥 الصحة والأمراض\n💰 الربحية والتسويق\n🚀 التوسع والتطوير\n💨 التهوية والبيئة\n📋 الإدارة والسجلات\n\nاكتب سؤالك بالعربية أو الإنجليزية، أو اختر موضوعاً من الأزرار أدناه`
          : `Välkommen till den smarta gårdsrådgivaren! 👋\n\nJag är specialist på:\n🌾 Utfodring & Foder\n🥚 Kläckning & Ruvning\n🏥 Hälsa & Sjukdomar\n💰 Lönsamhet & Marknadsföring\n🚀 Expansion & Tillväxt\n💨 Ventilation & Miljö\n📋 Dokumentation & Hantering\n\nSkriv din fråga på arabiska eller svenska, eller välj ett ämne från knapparna nedan`,
      };
      setChatMsgs([greet]);
    }
  }, [activeTab]);

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg) return;
    setInput("");
    setChatMsgs(prev => [...prev, { role: "user", text: msg }]);
    setIsTyping(true);

    await new Promise(r => setTimeout(r, 600));

    const topic = matchTopic(msg, lang);
    let response: string;

    if (topic) {
      response = lang === "ar" ? topic.getResponseAr(ctx) : topic.getResponseSv(ctx);
    } else {
      response = lang === "ar"
        ? `لم أفهم سؤالك تماماً 🤔\n\nجرّب أن تسأل عن:\n• **التغذية والعلف** — كميات ومواعيد\n• **الأمراض والصحة** — وقاية وعلاج\n• **التفقيس** — معايير ومعدلات\n• **الربحية** — تحسين وتطوير\n• **التوسع** — خطط ومراحل\n• **التهوية** — بيئة مثالية\n• **المبيعات** — أسواق وعقود\n• **الإضاءة** — برامج ومصابيح\n• **المياه** — إدارة واحتياج\n• **العمالة** — فرق وجداول`
        : `Jag förstod inte riktigt din fråga 🤔\n\nFörsök fråga om:\n• **Utfodring** — mängder och schema\n• **Sjukdomar & Hälsa** — förebyggande och behandling\n• **Kläckning** — parametrar och grad\n• **Lönsamhet** — förbättring och optimering\n• **Expansion** — planer och faser\n• **Ventilation** — optimal miljö\n• **Försäljning** — marknader och kontrakt`;
    }

    setIsTyping(false);
    setChatMsgs(prev => [...prev, { role: "advisor", topicIcon: topic ? "✅" : "ℹ️", text: response }]);
  }

  const gradeColor = scores
    ? scores.score >= 80 ? "text-emerald-600" : scores.score >= 60 ? "text-blue-600" : scores.score >= 40 ? "text-amber-600" : "text-red-600"
    : "text-slate-400";
  const gradeLabel = scores
    ? lang === "ar"
      ? scores.score >= 80 ? "ممتاز" : scores.score >= 60 ? "جيد" : scores.score >= 40 ? "مقبول" : "ضعيف"
      : scores.score >= 80 ? "Utmärkt" : scores.score >= 60 ? "Bra" : scores.score >= 40 ? "Godkänt" : "Svagt"
    : "—";

  const TABS = [
    { key: "scan" as TabKey, icon: FlaskConical, labelAr: "مسح المزرعة", labelSv: "Gårdsskanning" },
    { key: "plans" as TabKey, icon: Layers, labelAr: "خطط التطوير", labelSv: "Utvecklingsplaner" },
    { key: "advisor" as TabKey, icon: Brain, labelAr: "المستشار الذكي", labelSv: "Smart Rådgivare" },
  ];

  return (
    <div className="space-y-5 pb-8" dir={isRtl ? "rtl" : "ltr"}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg flex-shrink-0">
          <FlaskConical className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-black text-foreground">
            {lang === "ar" ? "مختبر المزرعة الذكية" : "Smarta Gårdslaboratoriet"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {lang === "ar"
              ? "تحليل شامل · خطط التوسع · مستشار زراعي متخصص"
              : "Heltäckande analys · Expansionsplaner · Specialiserad gårdsrådgivare"}
          </p>
        </div>
        {scores && (
          <div className="text-center shrink-0">
            <div className={`text-3xl font-black ${gradeColor}`}>{scores.score}</div>
            <div className={`text-[10px] font-semibold ${gradeColor}`}>{gradeLabel}</div>
            <div className="text-[9px] text-muted-foreground">/100</div>
          </div>
        )}
      </div>

      {/* ── Tab Bar ────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <Icon className="w-4 h-4" />
              {lang === "ar" ? tab.labelAr : tab.labelSv}
            </button>
          );
        })}
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: FARM SCAN                                                      */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === "scan" && (
        <div className="space-y-4">
          {!scores ? (
            <Card><CardContent className="py-16 text-center">
              <FlaskConical className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3 animate-pulse" />
              <p className="text-sm text-muted-foreground">{lang === "ar" ? "جاري تحميل بيانات المزرعة..." : "Laddar gårdsdata..."}</p>
            </CardContent></Card>
          ) : (
            <>
              {/* Overall Score Hero */}
              <Card className="border-none shadow-sm overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                <CardContent className="p-5">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="relative w-20 h-20 flex-shrink-0">
                      <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                        <circle cx="18" cy="18" r="15.9" fill="none"
                          stroke={scores.score >= 80 ? "#10b981" : scores.score >= 60 ? "#3b82f6" : scores.score >= 40 ? "#f59e0b" : "#ef4444"}
                          strokeWidth="3" strokeDasharray={`${scores.score} 100`} strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-xl font-black ${gradeColor}`}>{scores.score}</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-lg font-black">{gradeLabel}</p>
                        <ExplainTip
                          titleAr="درجة المزرعة الإجمالية"
                          titleSv="Övergripande gårdspoäng"
                          textAr="درجة من 100 تقيس صحة مزرعتك الكاملة. تحسب من 6 أبعاد: المالية، الإنتاج، العمليات، الأهداف، التفقيس. 80+ ممتاز، 60-79 جيد، 40-59 متوسط، أقل من 40 يحتاج تدخل."
                          textSv="Poäng 0-100 som mäter hela gårdens hälsa. Beräknas från 6 dimensioner: Ekonomi, Produktion, Drift, Mål, Kläckning. 80+ Utmärkt, 60-79 Bra, 40-59 Medel, under 40 kräver åtgärd."
                          size="xs"
                          className="mt-0.5"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{lang === "ar" ? "الدرجة الإجمالية للمزرعة" : "Övergripande gårdspoäng"}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge className={cn("text-[10px]",
                          scores.riskLevel === "low" ? "bg-emerald-100 text-emerald-700" :
                          scores.riskLevel === "medium" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
                          {lang === "ar" ? { low: "خطر منخفض", medium: "خطر متوسط", high: "خطر مرتفع" }[scores.riskLevel] :
                           { low: "Låg risk", medium: "Medelrisk", high: "Hög risk" }[scores.riskLevel]}
                        </Badge>
                        <ExplainTip
                          titleAr="مستوى الخطر"
                          titleSv="Risknivå"
                          textAr="مستوى الخطر الإجمالي للمزرعة. منخفض = المزرعة مستقرة ومربحة. متوسط = هناك تحديات يمكن إدارتها. مرتفع = تحتاج إلى تدخل عاجل لتفادي خسائر."
                          textSv="Övergripande risknivå för gården. Låg = stabil och lönsam. Medel = hanterbara utmaningar. Hög = kräver omedelbar åtgärd för att undvika förluster."
                          size="xs"
                        />
                        <Badge variant="outline" className="text-[10px]">
                          {lang === "ar" ? { up: "اتجاه تصاعدي 📈", down: "اتجاه تنازلي 📉", stable: "مستقر ↔️" }[scores.trend] :
                           { up: "Uppåt 📈", down: "Nedåt 📉", stable: "Stabil ↔️" }[scores.trend]}
                        </Badge>
                        <ExplainTip
                          titleAr="الاتجاه المالي"
                          titleSv="Finansiell trend"
                          textAr="يقيس الاتجاه الأخير للأرباح. تصاعدي = تحسن. تنازلي = تراجع. مستقر = لا تغيير كبير. يُحسب من مقارنة آخر 3 أشهر بالثلاثة الأشهر قبلها."
                          textSv="Mäter den senaste vinstutvecklingen. Uppåt = förbättring. Nedåt = försämring. Stabil = ingen stor förändring. Beräknat från de senaste 3 månaderna jämfört med föregående 3."
                          size="xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 6-Dimension Bars */}
                  <div className="space-y-2.5">
                    {dims.map(d => {
                      const Icon = d.icon;
                      return (
                        <div key={d.label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Icon className={cn("w-3.5 h-3.5", d.color)} />
                              {d.label}
                              <ExplainTip
                                titleAr={d.explainTitleAr}
                                titleSv={d.explainTitleSv}
                                textAr={d.explainAr}
                                textSv={d.explainSv}
                                size="xs"
                              />
                            </span>
                            <span className={cn("text-xs font-bold", d.color)}>{d.score}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all duration-700", d.bg)}
                              style={{ width: `${d.score}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Financial Pulse */}
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    {lang === "ar" ? "النبض المالي" : "Finansiell puls"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: lang === "ar" ? "دخل" : "Inkomst", val: `${(ctx.income/1000).toFixed(0)}k`, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
                      { label: lang === "ar" ? "مصاريف" : "Kostnader", val: `${(ctx.expense/1000).toFixed(0)}k`, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20" },
                      { label: lang === "ar" ? "صافي" : "Netto", val: `${ctx.profit >= 0 ? "+" : ""}${(ctx.profit/1000).toFixed(0)}k`, color: ctx.profit >= 0 ? "text-blue-600" : "text-orange-600", bg: ctx.profit >= 0 ? "bg-blue-50 dark:bg-blue-950/20" : "bg-orange-50 dark:bg-orange-950/20" },
                    ].map(m => (
                      <div key={m.label} className={cn("rounded-xl p-3 text-center", m.bg)}>
                        <p className="text-[10px] text-muted-foreground mb-0.5">{m.label}</p>
                        <p className={cn("text-lg font-black", m.color)}>{m.val}</p>
                        <p className="text-[9px] text-muted-foreground">IQD</p>
                      </div>
                    ))}
                  </div>
                  {ctx.margin !== null && (
                    <div className="mt-3 bg-muted/30 rounded-xl p-2.5 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        {lang === "ar" ? "هامش الربح الصافي" : "Nettovinstmarginal"}
                        <ExplainTip
                          titleAr="هامش الربح الصافي"
                          titleSv="Nettovinstmarginal"
                          textAr="نسبة الربح من إجمالي الدخل. مثال: دخل 1,000,000 وربح 200,000 = هامش 20%. المستهدف: أعلى من 20% ممتاز، 10-20% مقبول، أقل من 10% يحتاج تحسين."
                          textSv="Andel vinst av total inkomst. Ex: inkomst 1 000 000 och vinst 200 000 = marginal 20%. Mål: över 20% utmärkt, 10-20% godkänt, under 10% kräver förbättring."
                          size="xs"
                        />
                      </span>
                      <span className={cn("font-black text-sm", ctx.margin >= 20 ? "text-emerald-600" : ctx.margin >= 0 ? "text-amber-600" : "text-red-600")}>
                        {ctx.margin.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Insights */}
              {(() => {
                const ar = lang === "ar";
                const insights = [
                  scores.profit < 0 && { level: "critical", titleAr: "خسارة مالية ⚠️", titleSv: "Ekonomisk förlust ⚠️", msgAr: `المزرعة تعاني خسارة صافية بمقدار ${Math.abs(scores.profit).toLocaleString()} د.ع. راجع هيكل التكاليف فوراً.`, msgSv: `Gården har en nettoförlust på ${Math.abs(scores.profit).toLocaleString()} IQD. Granska kostnadsstrukturen omedelbart.` },
                  scores.margin !== null && scores.margin < 10 && scores.margin >= 0 && { level: "warning", titleAr: "هامش ربح منخفض", titleSv: "Låg vinstmarginal", msgAr: `هامش الربح ${scores.margin.toFixed(1)}% أقل من الحد الموصى به 15%. يمكن تحسينه بخفض تكاليف العلف.`, msgSv: `Vinstmarginalen ${scores.margin.toFixed(1)}% är under rekommenderade 15%. Kan förbättras genom att sänka foderkostnader.` },
                  (summary?.overallHatchRate ?? 0) >= 80 && { level: "good", titleAr: "معدل تفقيس ممتاز 🐣", titleSv: "Utmärkt kläckningsgrad 🐣", msgAr: `معدل التفقيس ${summary?.overallHatchRate}% يتجاوز المعيار العالمي 75%. أداء رائع!`, msgSv: `Kläckningsgraden ${summary?.overallHatchRate}% överskrider den globala standarden 75%. Utmärkt prestanda!` },
                  (summary?.totalChickens ?? 0) === 0 && { level: "warning", titleAr: "لا توجد قطعان نشطة", titleSv: "Inga aktiva flockar", msgAr: "لا يوجد أي قطيع حالياً. أضف قطعان لتشغيل تحليل الإنتاج.", msgSv: "Inga aktiva flockar för tillfället. Lägg till flockar för att aktivera produktionsanalys." },
                  scores.income === 0 && { level: "info", titleAr: "لا توجد بيانات مالية", titleSv: "Ingen finansiell data", msgAr: "أضف معاملات الدخل والمصروفات لتفعيل التحليل المالي الكامل.", msgSv: "Lägg till inkomst- och utgiftstransaktioner för att aktivera fullständig finansiell analys." },
                  scores.margin !== null && scores.margin >= 20 && { level: "good", titleAr: "أداء مالي قوي 💪", titleSv: "Stark finansiell prestanda 💪", msgAr: `هامش ربح ${scores.margin.toFixed(1)}% يعكس إدارة تكاليف فعّالة. استمر في هذا المستوى.`, msgSv: `Vinstmarginal ${scores.margin.toFixed(1)}% återspeglar effektiv kostnadshantering. Fortsätt på denna nivå.` },
                  scores.score >= 75 && { level: "good", titleAr: "المزرعة تعمل بكفاءة عالية", titleSv: "Gården fungerar med hög effektivitet", msgAr: `الدرجة الإجمالية ${scores.score}/100 تشير إلى أداء ممتاز. أنت في المسار الصحيح!`, msgSv: `Totalpoäng ${scores.score}/100 indikerar utmärkt prestanda. Du är på rätt spår!` },
                ].filter(Boolean);

                if (!insights.length) return null;
                return (
                  <Card className="border-none shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        {ar ? "رؤى ذكية من المزرعة" : "Smarta gårdsinsikter"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4 space-y-2">
                      {insights.slice(0, 5).map((ins, i) => {
                        const cfg = {
                          critical: { bg: "bg-red-50 dark:bg-red-950/20", border: "border-red-200", icon: AlertTriangle, ic: "text-red-500" },
                          warning:  { bg: "bg-amber-50 dark:bg-amber-950/20", border: "border-amber-200", icon: AlertTriangle, ic: "text-amber-500" },
                          good:     { bg: "bg-emerald-50 dark:bg-emerald-950/20", border: "border-emerald-200", icon: ShieldCheck, ic: "text-emerald-500" },
                          info:     { bg: "bg-blue-50 dark:bg-blue-950/20", border: "border-blue-200", icon: Info, ic: "text-blue-500" },
                        }[(ins as any).level] ?? { bg: "bg-muted/30", border: "border-border", icon: Info, ic: "text-muted-foreground" };
                        const Icon = cfg.icon;
                        return (
                          <div key={i} className={cn("rounded-xl border p-3 flex items-start gap-2.5", cfg.bg, cfg.border)}>
                            <Icon className={cn("w-4 h-4 flex-shrink-0 mt-0.5", cfg.ic)} />
                            <div>
                              <p className="text-xs font-semibold">{ar ? (ins as any).titleAr : (ins as any).titleSv}</p>
                              <p className="text-xs text-muted-foreground leading-relaxed">{ar ? (ins as any).msgAr : (ins as any).msgSv}</p>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Top 3 Smart Actions */}
              {(() => {
                const ar = lang === "ar";
                const actions = [
                  scores.profit < 0 && {
                    actionAr: "مراجعة هيكل التكاليف فوراً", actionSv: "Granska kostnadsstrukturen omedelbart",
                    reasonAr: "المزرعة تسجل خسارة صافية حالياً", reasonSv: "Gården registrerar en nettovaluta förlust",
                    impactAr: "تحسين الهامش المالي بنسبة 15-25%", impactSv: "Förbättra finansiell marginal med 15-25%",
                  },
                  scores.financialScore < 60 && {
                    actionAr: "تسجيل جميع الإيرادات والمصروفات", actionSv: "Registrera alla intäkter och utgifter",
                    reasonAr: "البيانات المالية غير مكتملة تعيق التحليل الدقيق", reasonSv: "Ofullständig finansiell data hindrar noggrann analys",
                    impactAr: "رؤية مالية أكثر وضوحاً ودقة", impactSv: "Tydligare och mer exakt finansiell inblick",
                  },
                  (summary?.overallHatchRate ?? 0) < 70 && (summary?.overallHatchRate ?? 0) > 0 && {
                    actionAr: "مراجعة بروتوكول التفقيس", actionSv: "Granska kläckningsprotokollet",
                    reasonAr: `معدل التفقيس ${summary?.overallHatchRate}% أقل من المعيار 75%`, reasonSv: `Kläckningsgraden ${summary?.overallHatchRate}% är under standarden 75%`,
                    impactAr: "رفع معدل التفقيس لـ 80%+", impactSv: "Höj kläckningsgraden till 80%+",
                  },
                  (summary?.totalChickens ?? 0) > 0 && scores.income > 0 && {
                    actionAr: "تتبع معدل التحويل الأعلافي يومياً", actionSv: "Spåra foderkonverteringsgraden dagligen",
                    reasonAr: "تكاليف العلف عادةً 60-70% من التكاليف الكلية", reasonSv: "Foderkostnader utgör vanligtvis 60-70% av totalkostnaderna",
                    impactAr: "خفض التكاليف بنسبة 8-12%", impactSv: "Sänka kostnaderna med 8-12%",
                  },
                  scores.goalsScore < 50 && {
                    actionAr: "تحديث الأهداف والمهام الأسبوعية", actionSv: "Uppdatera mål och veckouppgifter",
                    reasonAr: "معدل إنجاز الأهداف أقل من المستهدف", reasonSv: "Målets slutförandegrad är under målet",
                    impactAr: "تحسين الإنتاجية والانضباط التشغيلي", impactSv: "Förbättra produktivitet och operativ disciplin",
                  },
                  scores.score >= 70 && {
                    actionAr: "التخطيط لتوسعة المزرعة", actionSv: "Planera gårdsexpansion",
                    reasonAr: `الدرجة الإجمالية ${scores.score}/100 تشير إلى جاهزية للتوسع`, reasonSv: `Totalpoäng ${scores.score}/100 indikerar expansionsberedskap`,
                    impactAr: "زيادة الطاقة الإنتاجية بنسبة 30-50%", impactSv: "Öka produktionskapacitet med 30-50%",
                  },
                ].filter(Boolean).slice(0, 3);

                if (!actions.length) return null;
                return (
                  <Card className="border-none shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        {ar ? "أولويات العمل الذكية" : "Smarta arbetsprioriteter"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4 space-y-2">
                      {actions.map((dec, i) => (
                        <div key={i} className="rounded-xl border border-border/60 bg-card p-3 flex items-start gap-3">
                          <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-black flex-shrink-0 mt-0.5", ["bg-red-500","bg-amber-500","bg-blue-500"][i] ?? "bg-gray-500")}>{i+1}</div>
                          <div>
                            <p className="text-xs font-semibold">{ar ? (dec as any).actionAr : (dec as any).actionSv}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{ar ? (dec as any).reasonAr : (dec as any).reasonSv}</p>
                            <p className="text-[10px] text-emerald-600 mt-0.5">{ar ? (dec as any).impactAr : (dec as any).impactSv}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: DEVELOPMENT PLANS                                             */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === "plans" && (
        <div className="space-y-4">
          <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-800/30 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-bold text-indigo-700 dark:text-indigo-400">
                {lang === "ar" ? "خطط مصممة خصيصاً لمزرعتك" : "Planer skräddarsydda för din gård"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {lang === "ar"
                ? `بناءً على درجة أداء ${ctx.score}/100 ومعطيات مزرعتك الحالية — ${n(ctx.chickens)} طير | ربح: ${ctx.profit >= 0 ? "+" : ""}${n(ctx.profit)} د.ع`
                : `Baserat på ditt prestandapoäng ${ctx.score}/100 och din nuvarande gårdsdata — ${n(ctx.chickens)} fåglar | Vinst: ${ctx.profit >= 0 ? "+" : ""}${n(ctx.profit)} IQD`}
            </p>
          </div>

          {plans.map((plan, pi) => {
            const Icon = plan.icon;
            return (
              <Card key={pi} className={cn("border shadow-sm overflow-hidden", plan.border)}>
                <div className={cn("px-5 py-3.5 flex items-center gap-3", plan.bg)}>
                  <Icon className={cn("w-5 h-5 flex-shrink-0", plan.color)} />
                  <h3 className={cn("text-sm font-bold", plan.color)}>{plan.horizon}</h3>
                </div>
                <CardContent className="pt-3 pb-4">
                  <div className="space-y-2">
                    {plan.tasks.map((task, ti) => (
                      <div key={ti} className="flex items-start gap-2.5">
                        <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 mt-0.5", plan.color.replace("text-","bg-"))} style={{minWidth:"1.25rem"}}>
                          {ti + 1}
                        </div>
                        <p className="text-xs text-foreground leading-relaxed">{task}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* CTA */}
          <Card className="border-none shadow-sm bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <ThumbsUp className="w-5 h-5 text-yellow-400" />
                <p className="text-sm font-bold">
                  {lang === "ar" ? "النجاح يبدأ بخطوة واحدة" : "Framgång börjar med ett steg"}
                </p>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                {lang === "ar"
                  ? "استخدم المستشار الذكي لطرح أي سؤال تفصيلي عن أي نقطة من هذه الخطط. المستشار لديه معرفة عميقة بجميع جوانب تربية الدواجن."
                  : "Använd den smarta rådgivaren för att ställa detaljerade frågor om någon punkt i dessa planer. Rådgivaren har djup kunskap om alla aspekter av fjäderfäuppfödning."}
              </p>
              <Button size="sm" className="bg-white text-slate-900 hover:bg-slate-100 text-xs font-semibold gap-1.5"
                onClick={() => setActiveTab("advisor")}>
                <Brain className="w-3.5 h-3.5" />
                {lang === "ar" ? "افتح المستشار الذكي" : "Öppna Smart Rådgivare"}
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: SMART ADVISOR CHAT                                            */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === "advisor" && (
        <div className="space-y-3">
          {/* Topic Quick-Access */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {lang === "ar" ? "اختر موضوعاً سريعاً" : "Välj ett snabbämne"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {KB.slice(0, 8).map(topic => {
                const Icon = topic.icon;
                return (
                  <button key={topic.id}
                    onClick={() => sendMessage(lang === "ar" ? topic.titleAr : topic.titleSv)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/60 hover:bg-muted text-xs font-medium text-foreground transition-colors">
                    <Icon className="w-3 h-3 text-primary" />
                    {lang === "ar" ? topic.titleAr : topic.titleSv}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat Window */}
          <Card className="border-none shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Brain className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold">{lang === "ar" ? "مستشار المزرعة المتخصص" : "Specialiserad Gårdsrådgivare"}</p>
                  <p className="text-[9px] text-emerald-500 font-medium">{lang === "ar" ? "● متاح دائماً" : "● Alltid tillgänglig"}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => { setChatMsgs([]); setActiveTab("scan"); setTimeout(() => setActiveTab("advisor"), 10); }}>
                <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </div>

            {/* Messages */}
            <div className="h-[380px] overflow-y-auto p-4 space-y-3">
              {chatMsgs.map((msg, i) => (
                <div key={i} className={cn("flex gap-2.5", msg.role === "user" ? (isRtl ? "flex-row" : "flex-row-reverse") : "flex-row")}>
                  {msg.role === "advisor" && (
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Brain className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div className={cn("rounded-2xl px-3.5 py-2.5 max-w-[88%] text-xs leading-relaxed whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted/60 text-foreground rounded-bl-sm border border-border/30")}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Brain className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="bg-muted/60 rounded-2xl rounded-bl-sm px-4 py-3 border border-border/30">
                    <div className="flex gap-1">
                      {[0,1,2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border/50 p-3 flex gap-2 bg-background">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder={lang === "ar" ? "اكتب سؤالك هنا... مثال: كم كمية العلف اليومية؟" : "Skriv din fråga här... t.ex. Hur mycket foder per dag?"}
                className="text-xs h-9 border-border/60 bg-muted/30"
                dir={isRtl ? "rtl" : "ltr"}
              />
              <Button size="icon" className="h-9 w-9 flex-shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600 border-none"
                onClick={() => sendMessage()} disabled={!input.trim() || isTyping}>
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>

          {/* More topics */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {lang === "ar" ? "مزيد من الموضوعات" : "Fler ämnen"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {KB.slice(8).map(topic => {
                const Icon = topic.icon;
                return (
                  <button key={topic.id}
                    onClick={() => sendMessage(lang === "ar" ? topic.titleAr : topic.titleSv)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/40 hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                    <Icon className="w-3 h-3" />
                    {lang === "ar" ? topic.titleAr : topic.titleSv}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
