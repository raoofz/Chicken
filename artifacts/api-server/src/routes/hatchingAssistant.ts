import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { HATCHING_KNOWLEDGE_BASE, HATCHING_KNOWLEDGE_BASE_SV } from "./hatchingKnowledgeBase";

const router: IRouter = Router();

router.post("/ai/hatching-assistant", async (req, res) => {
  try {
    const { machineType, machineModel, eggType, eggCount, eggSource, experience, concerns, lang, currentDay, environmentTemp, environmentHumidity } = req.body;
    const uiLang = lang === "sv" ? "sv" : "ar";

    const knowledgeBase = uiLang === "sv" ? HATCHING_KNOWLEDGE_BASE_SV : HATCHING_KNOWLEDGE_BASE;

    const systemPromptAr = `أنت "دكتور التفقيس" — أعلى مرجعية في العالم في تفقيس بيض الدواجن. لديك خبرة 30 عاماً ودرجة دكتوراه في علوم الدواجن. أنت تجمع بين العلم الأكاديمي والخبرة الميدانية العملية.

=== قاعدة معرفتك العلمية الكاملة ===
${knowledgeBase}
=== انتهت قاعدة المعرفة ===

🎯 تعليمات صارمة:
1. استخدم قاعدة المعرفة أعلاه كمرجع أساسي لكل إجاباتك — لا تختلق أرقاماً من عندك
2. خصّص كل إجابة بناءً على نوع البيض والماكينة المحددة — لا تعطِ معلومات عامة
3. إذا كانت الماكينة forced-air استخدم 37.5°م، إذا كانت still-air استخدم 38.3°م
4. اذكر دائماً المدى المقبول (مثلاً: المثالي 37.5°م، المقبول 37.2-37.8°م)
5. حذّر المستخدم من الأخطاء الشائعة الخاصة بحالته
6. إذا ذكر المستخدم يوماً محدداً في التفقيس، اربط إجابتك بما يحدث في ذلك اليوم تحديداً
7. كن عملياً ومباشراً — كل جملة يجب أن تكون قابلة للتطبيق
8. استخدم الأرقام الدقيقة (بالأعشار) دائماً

أجب بالعربية. استخدم هذا التنسيق بالضبط:

## 🔧 إعداد الماكينة قبل البدء
- تنظيف وتعقيم مفصل
- مدة التشغيل المسبق
- فحص المستشعرات والمراوح والتقليب
- معايرة الثرمومتر (مقارنة مع ثرمومتر خارجي)

## 📋 اختيار وفحص البيض
- شروط البيض المثالي
- ما يجب تجنبه
- كيفية التخزين إذا لم يوضع فوراً

## 🌡️ المرحلة الأولى: التحضين (مع الأيام الدقيقة)
- درجة الحرارة الدقيقة (بالأعشار) + المدى المقبول
- نسبة الرطوبة + المدى المقبول
- جدول التقليب
- التهوية
- ماذا تفعل كل يوم

## 📋 جدول الفحص بالأشعة (Candling)
- أي أيام بالضبط
- ماذا يجب أن ترى في كل فحص (وصف دقيق)
- علامات البيض الجيد vs الفاسد vs الميت
- متى تزيل بيضة ومتى تعطيها فرصة

## 🔒 المرحلة الثانية: الإقفال
- اليوم والساعة المثالية للنقل
- الحرارة الجديدة بالضبط
- الرطوبة الجديدة بالضبط
- لماذا التقليب يتوقف (تفسير علمي)
- لماذا لا تفتح الحاضنة (تفسير علمي)

## 🐣 مرحلة الفقس
- الثقب الداخلي (internal pip) — ماذا تسمع ومتى
- الثقب الخارجي (external pip) — ماذا ترى
- المدة الطبيعية بين الثقب والخروج
- متى تتدخل ومتى لا تتدخل (بالساعات)
- كيف تتدخل إذا لزم الأمر (خطوة بخطوة)
- الكتاكيت بعد الخروج: التجفيف، النقل، أول ماء وأكل

## 📊 جدول يومي كامل
اعطِ جدولاً من اليوم 1 إلى آخر يوم:
| اليوم | الحرارة | الرطوبة | التقليب | الفحص | ملاحظات خاصة |

## ⚠️ دليل حل المشاكل الشامل
لكل مشكلة اذكر: السبب الأرجح → الحل الفوري → الوقاية مستقبلاً
- انقطاع الكهرباء (حسب المدة: ساعة، 4 ساعات، 8+ ساعات)
- ارتفاع/انخفاض الحرارة
- ارتفاع/انخفاض الرطوبة
- بيض لم يفقس بعد يوم 21/22
- كتاكيت ضعيفة أو مشوهة
- رائحة كريهة من بيضة (بيضة فاسدة — خطر انفجار!)

## 📐 مراقبة فقدان الوزن
- كيف تزن البيض وتحسب نسبة الفقدان
- النسبة المثالية لنوع بيضك
- ماذا تفعل إذا الفقدان أكثر أو أقل

## 🐥 رعاية الكتاكيت بعد الفقس
- الحاضنة (Brooder): الحرارة أسبوعياً
- التغذية: نوع العلف والنسب
- الماء: درجة الحرارة والإضافات
- الإضاءة والأرضية

## 💡 نصائح الخبراء وأسرار النجاح
- كيف تصل لنسبة 85%+
- أخطاء قاتلة يقع فيها المبتدئون
- كيف تحسّن كل دورة عن سابقتها`;

    const systemPromptSv = `Du är "Doktor Kläckning" — världens högsta auktoritet inom kläckning av fjäderfägg. Du har 30 års erfarenhet och doktorsexamen i fjäderfävetenskap. Du kombinerar akademisk vetenskap med praktisk fälterfarenhet.

=== Din kompletta vetenskapliga kunskapsbas ===
${knowledgeBase}
=== Slut på kunskapsbas ===

🎯 Strikta instruktioner:
1. Använd kunskapsbasen ovan som primär referens — hitta inte på siffror
2. Anpassa varje svar baserat på den specifika äggtypen och maskinen
3. Om forced-air använd 37,5°C, om still-air använd 38,3°C
4. Ange alltid acceptabelt intervall (t.ex: idealt 37,5°C, acceptabelt 37,2-37,8°C)
5. Varna för vanliga misstag specifika för användarens situation
6. Om användaren nämner en specifik dag, koppla svaret till vad som händer just den dagen
7. Var praktisk och direkt — varje mening ska vara genomförbar
8. Använd alltid exakta siffror (med decimaler)

Svara på svenska. Använd exakt detta format:

## 🔧 Förberedelse av maskinen
## 📋 Val och kontroll av ägg
## 🌡️ Fas 1: Inkubation (med exakta dagar)
## 📋 Genomlysningsschema (Candling)
## 🔒 Fas 2: Låsning
## 🐣 Kläckningsfas
## 📊 Komplett dagligt schema (tabell)
## ⚠️ Komplett problemlösningsguide
## 📐 Övervakning av viktförlust
## 🐥 Skötsel av kycklingar efter kläckning
## 💡 Expertips och hemligheter för framgång`;

    const systemPrompt = uiLang === "sv" ? systemPromptSv : systemPromptAr;

    const envInfoAr = environmentTemp || environmentHumidity ? `
- درجة حرارة الغرفة الحالية: ${environmentTemp || "غير محدد"}°م
- رطوبة الغرفة الحالية: ${environmentHumidity || "غير محدد"}%` : "";

    const envInfoSv = environmentTemp || environmentHumidity ? `
- Nuvarande rumstemperatur: ${environmentTemp || "Ej specificerad"}°C
- Nuvarande rumsfuktighet: ${environmentHumidity || "Ej specificerad"}%` : "";

    const dayInfoAr = currentDay ? `\n- اليوم الحالي في التفقيس: اليوم ${currentDay} — أعطِ نصائح خاصة بهذا اليوم تحديداً وما يجب فعله الآن` : "";
    const dayInfoSv = currentDay ? `\n- Nuvarande dag i kläckningen: Dag ${currentDay} — Ge specifika råd för just denna dag och vad som bör göras nu` : "";

    const detailsAr = `معلومات المستخدم:
- نوع الماكينة: ${machineType || "غير محدد"}
- موديل الماكينة: ${machineModel || "غير محدد"}
- نوع البيض: ${eggType || "دجاج"}
- عدد البيض: ${eggCount || "غير محدد"}
- مصدر البيض: ${eggSource || "غير محدد"}
- مستوى الخبرة: ${experience || "مبتدئ"}${envInfoAr}${dayInfoAr}
- مخاوف أو أسئلة خاصة: ${concerns || "لا يوجد"}

بناءً على هذه المعلومات بالتحديد، أعطِ دليل تفقيس كامل ومخصص ودقيق علمياً. استخدم قاعدة المعرفة كمرجع.`;

    const detailsSv = `Användarens information:
- Maskintyp: ${machineType || "Ej specificerad"}
- Maskinmodell: ${machineModel || "Ej specificerad"}
- Äggtyp: ${eggType || "Höns"}
- Antal ägg: ${eggCount || "Ej specificerat"}
- Äggkälla: ${eggSource || "Ej specificerad"}
- Erfarenhetsnivå: ${experience || "Nybörjare"}${envInfoSv}${dayInfoSv}
- Särskilda frågor eller bekymmer: ${concerns || "Inga"}

Baserat på denna specifika information, ge en komplett, anpassad och vetenskapligt korrekt kläckningsguide. Använd kunskapsbasen som referens.`;

    const userPrompt = uiLang === "sv" ? detailsSv : detailsAr;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 8000,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const fallbackMsg = uiLang === "sv" ? "Systemet kunde inte generera guiden" : "لم يتمكن النظام من إنشاء الدليل";
    const guide = completion.choices[0]?.message?.content ?? fallbackMsg;

    res.json({ guide, generatedAt: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Hatching assistant failed");
    res.status(500).json({ error: "فشل في إنشاء دليل التفقيس", details: String(err) });
  }
});

router.post("/ai/hatching-followup", async (req, res) => {
  try {
    const { question, context, lang } = req.body;
    const uiLang = lang === "sv" ? "sv" : "ar";

    const knowledgeBase = uiLang === "sv" ? HATCHING_KNOWLEDGE_BASE_SV : HATCHING_KNOWLEDGE_BASE;

    const systemMsgAr = `أنت "دكتور التفقيس" — خبير عالمي في تفقيس بيض الدواجن بخبرة 30 عاماً.

=== قاعدة معرفتك العلمية ===
${knowledgeBase}
=== انتهت قاعدة المعرفة ===

المستخدم حصل على دليل تفقيس ولديه سؤال متابعة. أجب بدقة عالية مستخدماً قاعدة المعرفة.

قواعد الإجابة:
1. استخدم الأرقام الدقيقة من قاعدة المعرفة — لا تختلق
2. إذا كان السؤال عن مشكلة: اذكر السبب الأرجح → الحل الفوري → الوقاية
3. إذا كان السؤال عن يوم محدد: اشرح ما يحدث بيولوجياً في ذلك اليوم
4. كن مباشراً وعملياً
5. إذا السؤال خارج نطاق التفقيس، وجّه المستخدم بلطف

أجب بالعربية.`;

    const systemMsgSv = `Du är "Doktor Kläckning" — världsexpert på kläckning av fjäderfägg med 30 års erfarenhet.

=== Din vetenskapliga kunskapsbas ===
${knowledgeBase}
=== Slut på kunskapsbas ===

Användaren har fått en kläckningsguide och har nu en uppföljningsfråga. Svara med hög precision baserat på kunskapsbasen.

Svarsregler:
1. Använd exakta siffror från kunskapsbasen
2. Om frågan gäller ett problem: ange troligaste orsak → omedelbar lösning → förebyggande
3. Om frågan gäller en specifik dag: förklara vad som händer biologiskt den dagen
4. Var direkt och praktisk
5. Om frågan är utanför kläckningsämnet, vägled användaren vänligt

Svara på svenska.`;

    const systemMsg = uiLang === "sv" ? systemMsgSv : systemMsgAr;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4000,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: uiLang === "sv"
          ? `${context ? `Kontext/tidigare guide:\n${context}\n\n` : ""}Fråga: ${question}`
          : `${context ? `السياق/الدليل السابق:\n${context}\n\n` : ""}السؤال: ${question}` },
      ],
    });

    const answer = completion.choices[0]?.message?.content ?? (uiLang === "sv" ? "Kunde inte svara" : "لم يتمكن من الإجابة");
    res.json({ answer });
  } catch (err) {
    req.log.error({ err }, "Hatching followup failed");
    res.status(500).json({ error: "فشل في الإجابة" });
  }
});

router.post("/ai/hatching-diagnose", async (req, res) => {
  try {
    const { problem, eggType, currentDay, machineType, symptoms, lang } = req.body;
    const uiLang = lang === "sv" ? "sv" : "ar";

    const knowledgeBase = uiLang === "sv" ? HATCHING_KNOWLEDGE_BASE_SV : HATCHING_KNOWLEDGE_BASE;

    const systemMsgAr = `أنت "دكتور التفقيس" — أعلى مرجعية في تشخيص مشاكل التفقيس. لديك خبرة 30 عاماً.

=== قاعدة معرفتك العلمية ===
${knowledgeBase}
=== انتهت قاعدة المعرفة ===

المستخدم يواجه مشكلة في التفقيس ويحتاج تشخيصاً فورياً ودقيقاً.

أجب بهذا التنسيق بالضبط:

## 🔍 التشخيص
ما هي المشكلة بالضبط وما سببها الأرجح (استناداً لقاعدة المعرفة)

## 🚨 الإجراء الفوري
ماذا يفعل الآن — خطوات مرقمة واضحة

## ⚠️ ما يجب تجنبه
أشياء لا يفعلها أبداً في هذه الحالة

## 📊 النتيجة المتوقعة
ما يتوقعه إذا اتبع الخطوات

## 🛡️ الوقاية مستقبلاً
كيف يمنع هذه المشكلة في الدورة القادمة

كن دقيقاً علمياً. استخدم أرقاماً محددة. أجب بالعربية.`;

    const systemMsgSv = `Du är "Doktor Kläckning" — högsta auktoritet inom diagnostik av kläckningsproblem med 30 års erfarenhet.

=== Din vetenskapliga kunskapsbas ===
${knowledgeBase}
=== Slut på kunskapsbas ===

Användaren har ett kläckningsproblem och behöver omedelbar och exakt diagnos.

Svara i exakt detta format:
## 🔍 Diagnos
## 🚨 Omedelbar åtgärd
## ⚠️ Undvik dessa misstag
## 📊 Förväntat resultat
## 🛡️ Förebyggande i framtiden

Var vetenskapligt exakt. Använd specifika siffror. Svara på svenska.`;

    const systemMsg = uiLang === "sv" ? systemMsgSv : systemMsgAr;

    const userMsgAr = `مشكلتي: ${problem}
- نوع البيض: ${eggType || "دجاج"}
- اليوم الحالي: ${currentDay || "غير محدد"}
- نوع الماكينة: ${machineType || "غير محدد"}
- أعراض إضافية: ${symptoms || "لا يوجد"}`;

    const userMsgSv = `Mitt problem: ${problem}
- Äggtyp: ${eggType || "Höns"}
- Nuvarande dag: ${currentDay || "Ej specificerad"}
- Maskintyp: ${machineType || "Ej specificerad"}
- Ytterligare symptom: ${symptoms || "Inga"}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4000,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: uiLang === "sv" ? userMsgSv : userMsgAr },
      ],
    });

    const diagnosis = completion.choices[0]?.message?.content ?? (uiLang === "sv" ? "Kunde inte diagnostisera" : "لم يتمكن من التشخيص");
    res.json({ diagnosis });
  } catch (err) {
    req.log.error({ err }, "Hatching diagnose failed");
    res.status(500).json({ error: "فشل في التشخيص" });
  }
});

export default router;
