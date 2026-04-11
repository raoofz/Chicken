import { Router, type IRouter } from "express";
import { db, flocksTable, hatchingCyclesTable, tasksTable, goalsTable, dailyNotesTable, activityLogsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

function getDaysSince(dateStr: string): number {
  const start = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

router.post("/ai/analyze", async (req, res) => {
  try {
    const lang = req.body?.lang === "sv" ? "sv" : "ar";
    const today = getTodayStr();
    const [flocks, hatchingCycles, allTasks, goals, notes, logs] = await Promise.all([
      db.select().from(flocksTable),
      db.select().from(hatchingCyclesTable).orderBy(desc(hatchingCyclesTable.createdAt)).limit(20),
      db.select().from(tasksTable).orderBy(desc(tasksTable.createdAt)).limit(100),
      db.select().from(goalsTable),
      db.select().from(dailyNotesTable).orderBy(desc(dailyNotesTable.createdAt)).limit(50),
      db.select().from(activityLogsTable).orderBy(desc(activityLogsTable.createdAt)).limit(30),
    ]);

    const todayTasks = allTasks.filter(t => t.dueDate === today);
    const overdueTasks = allTasks.filter(t => t.dueDate && t.dueDate < today && !t.completed);
    const pendingTasks = allTasks.filter(t => !t.completed);
    const totalChickens = flocks.reduce((s, f) => s + f.count, 0);

    const activeCycles = hatchingCycles.filter(c => c.status === "incubating" || c.status === "hatching");
    const completedCycles = hatchingCycles.filter(c => c.status === "completed" && c.eggsHatched != null);

    const hatchRates = completedCycles.map(c => ({
      batch: c.batchName,
      rate: Math.round((c.eggsHatched! / c.eggsSet) * 100),
      eggsSet: c.eggsSet,
      eggsHatched: c.eggsHatched,
    }));

    const avgHatchRate = hatchRates.length
      ? Math.round(hatchRates.reduce((s, r) => s + r.rate, 0) / hatchRates.length)
      : 0;

    const cycleAlerts = activeCycles.map(c => {
      const days = getDaysSince(c.startDate);
      const daysLeft = getDaysUntil(c.expectedHatchDate);
      const isLockdown = days >= 18;
      const alert = lang === "sv"
        ? (daysLeft <= 0 ? "⚠️ Försenad kläckning" : daysLeft <= 3 ? "🔥 Mycket nära kläckning" : isLockdown ? "🔒 Låsningsfas" : "✅ Inkubation")
        : (daysLeft <= 0 ? "⚠️ تجاوز موعد الفقس" : daysLeft <= 3 ? "🔥 قريب جداً من الفقس" : isLockdown ? "🔒 مرحلة الإقفال" : "✅ تحضين");
      return {
        batch: c.batchName,
        eggsSet: c.eggsSet,
        dayNumber: days,
        daysLeft,
        phase: lang === "sv"
          ? (isLockdown ? "Låsning (18-21)" : "Inkubation (1-18)")
          : (isLockdown ? "إقفال (18-21)" : "تحضين (1-18)"),
        alertLevel: alert,
        temp1: c.temperature ? Number(c.temperature) : null,
        humidity1: c.humidity ? Number(c.humidity) : null,
        temp2: c.lockdownTemperature ? Number(c.lockdownTemperature) : null,
        humidity2: c.lockdownHumidity ? Number(c.lockdownHumidity) : null,
        tempOk: c.temperature ? (Number(c.temperature) >= 37.0 && Number(c.temperature) <= 38.5) : null,
        humidityOk: c.humidity ? (Number(c.humidity) >= 45 && Number(c.humidity) <= 65) : null,
      };
    });

    const goalProgress = goals.map(g => ({
      title: g.title,
      progress: Math.round((g.currentValue / g.targetValue) * 100),
      current: g.currentValue,
      target: g.targetValue,
      unit: g.unit,
      category: g.category,
      completed: g.completed,
      deadline: g.deadline,
      daysLeft: g.deadline ? getDaysUntil(g.deadline) : null,
    }));

    const flockDetails = flocks.map(f => ({
      name: f.name,
      breed: f.breed,
      count: f.count,
      ageDays: f.ageDays,
      purpose: f.purpose,
      notes: f.notes,
      ageCategory: lang === "sv"
        ? (f.ageDays <= 7 ? "Kycklingar" : f.ageDays <= 21 ? "Unga" : f.ageDays <= 35 ? "Mellanstora" : "Vuxna")
        : (f.ageDays <= 7 ? "كتاكيت" : f.ageDays <= 21 ? "صغار" : f.ageDays <= 35 ? "متوسطة" : "كبار"),
    }));

    const notesSummary = notes.slice(0, 20).map(n => ({
      date: n.date,
      content: n.content,
      category: n.category,
    }));

    const recentLogs = logs.slice(0, 15).map(l => ({
      date: l.date,
      title: l.title,
      category: l.category,
    }));

    const taskBreakdown = {
      total: allTasks.length,
      completed: allTasks.filter(t => t.completed).length,
      pending: pendingTasks.length,
      overdue: overdueTasks.length,
      overdueItems: overdueTasks.slice(0, 5).map(t => ({ title: t.title, category: t.category, priority: t.priority })),
      todayTotal: todayTasks.length,
      todayCompleted: todayTasks.filter(t => t.completed).length,
      byPriority: {
        high: pendingTasks.filter(t => t.priority === "high").length,
        medium: pendingTasks.filter(t => t.priority === "medium").length,
        low: pendingTasks.filter(t => t.priority === "low").length,
      },
    };

    const dataSnapshot = {
      currentDate: today,
      farm: { totalChickens, totalFlocks: flocks.length },
      flocks: flockDetails,
      hatchingCycles: {
        active: cycleAlerts,
        completed: hatchRates,
        avgHatchRate,
        totalEggsActive: activeCycles.reduce((s, c) => s + c.eggsSet, 0),
      },
      tasks: taskBreakdown,
      goals: { total: goals.length, completed: goals.filter(g => g.completed).length, details: goalProgress },
      recentNotes: notesSummary,
      recentActivity: recentLogs,
    };

    const systemPromptAr = `أنت خبير متخصص في علم الدواجن وإدارة مزارع الدجاج والفقاسات. 
لديك معرفة عميقة بـ:
- أمراض الدواجن وأعراضها وطرق الوقاية
- درجات الحرارة والرطوبة المثالية للتفقيس
- دورات التغذية والتطعيم
- مؤشرات أداء المزرعة وكيفية تحسينها
- التنبؤ بالمشاكل قبل حدوثها

مهمتك: تحليل بيانات هذه المزرعة بدقة علمية عالية واللغة العربية الفصيحة.
اقرأ المذكرات اليومية بعناية — فيها معلومات مهمة جداً.
ابحث عن الأنماط: ما الروتين الناجح الذي يتكرر؟ ما الذي أدى إلى نتائج جيدة؟

قدم تحليلك بهذا التنسيق الإلزامي (استخدم هذه العناوين بالضبط):

## 🚨 تنبيهات عاجلة
قائمة بكل مشكلة تحتاج تدخلاً فورياً (إن وُجدت). إذا لم توجد، اكتب "لا تنبيهات عاجلة".

## 🌡️ تحليل الفقاسة
تحليل دقيق لكل دورة نشطة: درجة الحرارة، الرطوبة، عدد الأيام، هل المعاملات مثالية؟

## 🐔 تحليل القطعان
تقييم صحة وأداء كل قطيع. ما أعمار الدجاج؟ هل هناك قطيع يحتاج انتباهاً؟

## 📊 تحليل الأداء العام
نسب الفقس، إنجاز المهام، تقدم الأهداف. هل الأرقام جيدة أم تحتاج تحسين؟

## 🔮 توقعات الأسبوعين القادمين
ماذا سيحدث؟ متى تُفقس الدفعات؟ ما الذي يجب الاستعداد له؟

## 📅 خطة الغد — ماذا تفعل غداً؟
هذا القسم الأهم. بناءً على:
1. المهام المجدولة لغد
2. أيام دورات التفقيس (هل تقترب من الإقفال أو الفقس؟)
3. الأنماط الناجحة من المذكرات (إذا نجح شيء من قبل، اقترح تكراره)
قدم قائمة مرتبة بأولوية بكل ما يجب فعله غداً، مع السبب والوقت المقترح.

## ⚡ خطة العمل الفورية (أولويات الأسبوع)
قائمة مرتبة بالأهمية لهذا الأسبوع.

## 🔄 الأنماط الناجحة — كرر هذا الأسلوب!
بناءً على المذكرات اليومية، ما هي الخطوات أو الإجراءات التي أدت إلى نتائج جيدة؟
إذا كان هناك روتين ناجح (مثل وقت تغذية معين، درجة حرارة محددة، إجراء أدى لنسبة فقس عالية) — اذكره بوضوح واقترح الاستمرار به.

## 💰 نصائح لزيادة الربحية
اقتراحات عملية وقابلة للتطبيق لتحسين إنتاجية المزرعة وربحيتها.

## ❤️ الصحة الوقائية
ما الأمراض والمشاكل التي يجب الحذر منها بناءً على الوضع الحالي؟

كن محدداً جداً، استشهد بأرقام من البيانات، لا تكن عاماً.`;

    const systemPromptSv = `Du är en expert inom fjäderfävetenskap och hantering av höns- och kläckningsanläggningar.
Du har djup kunskap om:
- Fjäderfäsjukdomar, symtom och förebyggande åtgärder
- Optimala temperaturer och luftfuktighet för kläckning
- Utfodring och vaccinationsscheman
- Gårdens prestationsindikatorer och förbättringsstrategier
- Förutsägelse av problem innan de uppstår

Din uppgift: Analysera denna gårds data med hög vetenskaplig precision på svenska.
Läs de dagliga anteckningarna noggrant — de innehåller mycket viktig information.
Leta efter mönster: Vilka framgångsrika rutiner upprepas? Vad ledde till goda resultat?

Presentera din analys i detta obligatoriska format (använd exakt dessa rubriker):

## 🚨 تنبيهات عاجلة
Lista alla problem som kräver omedelbar åtgärd (om sådana finns). Om inga finns, skriv "Inga brådskande varningar".

## 🌡️ تحليل الفقاسة
Detaljerad analys av varje aktiv cykel: temperatur, luftfuktighet, antal dagar, är parametrarna optimala?

## 🐔 تحليل القطعان
Utvärdering av varje flocks hälsa och prestation. Hur gamla är hönsen? Behöver någon flock uppmärksamhet?

## 📊 تحليل الأداء العام
Kläckningsfrekvenser, uppgiftsslutförande, målframsteg. Är siffrorna bra eller behöver de förbättras?

## 🔮 توقعات الأسبوعين القادمين
Vad kommer att hända? När kläcks batcherna? Vad behöver förberedas?

## 📅 خطة الغد — ماذا تفعل غداً؟
Den viktigaste sektionen. Baserat på:
1. Schemalagda uppgifter för imorgon
2. Inkubationscykeldagar (närmar sig låsning eller kläckning?)
3. Framgångsrika mönster från anteckningar (om något fungerade tidigare, föreslå att upprepa det)
Ge en prioriterad lista med allt som ska göras imorgon, med anledning och föreslagen tid.

## ⚡ خطة العمل الفورية (أولويات الأسبوع)
Prioriterad lista för denna vecka.

## 🔄 الأنماط الناجحة — كرر هذا الأسلوب!
Baserat på dagliga anteckningar, vilka steg eller åtgärder ledde till goda resultat?
Om det finns en framgångsrik rutin (som en specifik utfodringstid, specifik temperatur, åtgärd som ledde till hög kläckningsfrekvens) — nämn den tydligt och föreslå att fortsätta med den.

## 💰 نصائح لزيادة الربحية
Praktiska och genomförbara förslag för att förbättra gårdens produktivitet och lönsamhet.

## ❤️ الصحة الوقائية
Vilka sjukdomar och problem bör man vara uppmärksam på baserat på nuvarande situation?

Var mycket specifik, hänvisa till siffror från datan, var inte allmän.`;

    const systemPrompt = lang === "sv" ? systemPromptSv : systemPromptAr;

    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    const userPromptAr = `اليوم: ${today}
غداً: ${tomorrow}
بيانات المزرعة الكاملة:
${JSON.stringify(dataSnapshot, null, 2)}

تعليمات خاصة:
- في قسم "خطة الغد": اذكر بدقة ما يجب فعله يوم ${tomorrow}، مع مراعاة أي دفعات تقترب من الإقفال أو الفقس
- في قسم "الأنماط الناجحة": اقرأ المذكرات بعمق وابحث عن ما نجح سابقاً، خاصةً إذا كانت نسب الفقس جيدة أو الدجاج بصحة جيدة
- إذا كانت المذكرات قليلة: اقترح ما يجب تسجيله لبناء نمط ناجح
- إذا كانت أي دفعة في مرحلة الإقفال (اليوم 18-21)، أنبه بشكل خاص في خطة الغد
- إذا كانت درجة الحرارة أو الرطوبة خارج النطاق المثالي، أنبه بشكل واضح.`;

    const userPromptSv = `Idag: ${today}
Imorgon: ${tomorrow}
Komplett gårdsdata:
${JSON.stringify(dataSnapshot, null, 2)}

Särskilda instruktioner:
- I avsnittet "Morgondagens plan": Ange exakt vad som ska göras den ${tomorrow}, med hänsyn till batcher som närmar sig låsning eller kläckning
- I avsnittet "Framgångsmönster": Läs anteckningarna noggrant och leta efter vad som fungerade tidigare, särskilt om kläckningsfrekvenserna var bra eller hönsen var friska
- Om anteckningarna är få: Föreslå vad som bör dokumenteras för att bygga framgångsrika mönster
- Om någon batch är i låsningsfas (dag 18-21), varna särskilt i morgondagens plan
- Om temperatur eller luftfuktighet är utanför optimalt intervall, varna tydligt.`;

    const userPrompt = lang === "sv" ? userPromptSv : userPromptAr;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const fallbackMsg = lang === "sv" ? "Systemet kunde inte genomföra analysen" : "لم يتمكن النظام من إجراء التحليل";
    const analysis = completion.choices[0]?.message?.content ?? fallbackMsg;

    const urgentAlerts = cycleAlerts.filter(c => c.daysLeft <= 3 || c.daysLeft <= 0 || c.tempOk === false || c.humidityOk === false);
    const summary = {
      totalChickens,
      avgHatchRate,
      urgentCount: urgentAlerts.length + overdueTasks.length,
      activeCyclesCount: activeCycles.length,
      tasksDone: `${taskBreakdown.completed}/${taskBreakdown.total}`,
      goalsProgress: `${goals.filter(g => g.completed).length}/${goals.length}`,
    };

    res.json({ analysis, dataSnapshot, summary, generatedAt: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "AI analysis failed");
    res.status(500).json({ error: "فشل في إجراء التحليل", details: String(err) });
  }
});

export default router;
