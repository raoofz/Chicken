import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

router.post("/ai/hatching-assistant", async (req, res) => {
  try {
    const { machineType, machineModel, eggType, eggCount, eggSource, experience, concerns, lang } = req.body;
    const uiLang = lang === "sv" ? "sv" : "ar";

    const systemPromptAr = `أنت خبير عالمي في تفقيس الدواجن بخبرة 30 عاماً. مهمتك إعطاء المستخدم دليل تفقيس كامل ودقيق 100% بحيث إذا اتبعه حرفياً تنجح العملية بدون مشاكل.

أجب بالعربية الواضحة. كن عملياً ومباشراً — لا تنظير، فقط خطوات قابلة للتطبيق.

استخدم هذا التنسيق الإلزامي بالضبط:

## 🔧 إعداد الماكينة قبل البدء
- كيف تجهز الماكينة (التنظيف، التعقيم، التشغيل المسبق)
- المدة اللازمة للتشغيل المسبق
- فحص المستشعرات والمراوح

## 🌡️ المرحلة الأولى: التحضين (اليوم 1-18)
- درجة الحرارة الدقيقة (بالأعشار)
- نسبة الرطوبة الدقيقة
- عدد مرات التقليب يومياً ومواعيدها
- التهوية
- جدول يومي مفصل

## 📋 جدول الفحص بالشمعة (Candling)
- متى تفحص (أي أيام بالضبط)
- ماذا تبحث عنه في كل فحص
- كيف تميز البيض الجيد من الفاسد
- صور ذهنية لما يجب أن تراه

## 🔒 المرحلة الثانية: الإقفال (اليوم 18-21)
- متى بالضبط تنقل للإقفال (اليوم والساعة المثالية)
- درجة الحرارة الجديدة (بالأعشار)
- نسبة الرطوبة الجديدة
- توقف التقليب — لماذا ومتى بالضبط
- لا تفتح الماكينة — لماذا هذا حرج

## 🐣 مرحلة الفقس (اليوم 19-21)
- العلامات الأولى للفقس
- كم تنتظر قبل التدخل
- متى تتدخل ومتى لا تتدخل
- ماذا تفعل بالكتاكيت فور خروجها
- التجفيف والنقل

## ⚠️ المشاكل الشائعة وحلولها
- انقطاع الكهرباء — ماذا تفعل
- ارتفاع/انخفاض الحرارة
- ارتفاع/انخفاض الرطوبة
- بيض لم يفقس — الأسباب المحتملة
- كتاكيت ضعيفة — ماذا تفعل

## 📊 جدول يومي كامل (21 يوم)
اعطِ جدولاً يومياً من اليوم 1 إلى 21 يوضح:
| اليوم | الحرارة | الرطوبة | التقليب | ملاحظات |

## 💡 نصائح ذهبية
- أسرار من الخبراء
- أخطاء قاتلة يجب تجنبها
- كيف تحصل على نسبة فقس 85%+

مهم جداً: خصص إجاباتك بناءً على نوع الماكينة ونوع البيض المحدد. لا تعطِ معلومات عامة.`;

    const systemPromptSv = `Du är en världsexpert på kläckning av fjäderfä med 30 års erfarenhet. Din uppgift är att ge användaren en komplett och 100% exakt kläckningsguide som, om den följs exakt, leder till framgångsrik kläckning utan problem.

Svara på svenska. Var praktisk och direkt — inga teorier, bara genomförbara steg.

Använd detta obligatoriska format exakt:

## 🔧 Förberedelse av maskinen
- Hur du förbereder maskinen (rengöring, desinfektion, förkörning)
- Tid för förkörning
- Kontroll av sensorer och fläktar

## 🌡️ Fas 1: Inkubation (dag 1-18)
- Exakt temperatur (med decimaler)
- Exakt luftfuktighet
- Antal vändningar per dag och tider
- Ventilation
- Detaljerat dagligt schema

## 📋 Genomlysningsschema (Candling)
- När du kontrollerar (exakt vilka dagar)
- Vad du letar efter vid varje kontroll
- Hur du skiljer bra ägg från dåliga
- Mentala bilder av vad du bör se

## 🔒 Fas 2: Låsning (dag 18-21)
- Exakt när du överför till låsning (dag och idealisk tid)
- Ny temperatur (med decimaler)
- Ny luftfuktighet
- Stopp av vändning — varför och exakt när
- Öppna inte maskinen — varför detta är kritiskt

## 🐣 Kläckningsfas (dag 19-21)
- Första tecknen på kläckning
- Hur länge du väntar innan du ingriper
- När du ingriper och när du inte gör det
- Vad du gör med kycklingarna direkt efter kläckning
- Torkning och överföring

## ⚠️ Vanliga problem och lösningar
- Strömavbrott — vad du gör
- Hög/låg temperatur
- Hög/låg luftfuktighet
- Ägg som inte kläcktes — möjliga orsaker
- Svaga kycklingar — vad du gör

## 📊 Komplett dagligt schema (21 dagar)
Ge ett dagligt schema från dag 1 till 21 som visar:
| Dag | Temperatur | Luftfuktighet | Vändning | Anteckningar |

## 💡 Gyllene tips
- Hemligheter från experter
- Fatala misstag att undvika
- Hur du uppnår en kläckningsfrekvens på 85%+

Mycket viktigt: Anpassa dina svar baserat på den specifika maskintypen och äggtypen. Ge inte allmän information.`;

    const systemPrompt = uiLang === "sv" ? systemPromptSv : systemPromptAr;

    const detailsAr = `معلومات المستخدم:
- نوع الماكينة: ${machineType || "غير محدد"}
- موديل الماكينة: ${machineModel || "غير محدد"}
- نوع البيض: ${eggType || "دجاج"}
- عدد البيض: ${eggCount || "غير محدد"}
- مصدر البيض: ${eggSource || "غير محدد"}
- مستوى الخبرة: ${experience || "مبتدئ"}
- مخاوف أو أسئلة خاصة: ${concerns || "لا يوجد"}

بناءً على هذه المعلومات بالتحديد، أعطِ دليل تفقيس كامل ومخصص. إذا كانت الماكينة أوتوماتيكية اذكر ذلك وعدّل التعليمات. إذا كانت يدوية وضّح التقليب اليدوي.`;

    const detailsSv = `Användarens information:
- Maskintyp: ${machineType || "Ej specificerad"}
- Maskinmodell: ${machineModel || "Ej specificerad"}
- Äggtyp: ${eggType || "Höns"}
- Antal ägg: ${eggCount || "Ej specificerat"}
- Äggkälla: ${eggSource || "Ej specificerad"}
- Erfarenhetsnivå: ${experience || "Nybörjare"}
- Särskilda frågor eller bekymmer: ${concerns || "Inga"}

Baserat på denna specifika information, ge en komplett och anpassad kläckningsguide. Om maskinen är automatisk, nämn det och justera instruktionerna. Om den är manuell, förklara manuell vändning.`;

    const userPrompt = uiLang === "sv" ? detailsSv : detailsAr;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 6000,
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

    const systemMsg = uiLang === "sv"
      ? `Du är en expert på kläckning av fjäderfä. Användaren har fått en kläckningsguide och har nu en uppföljningsfråga. Svara kort, direkt och praktiskt på svenska. Referera till guiden som redan givits om det är relevant.`
      : `أنت خبير في تفقيس الدواجن. المستخدم حصل على دليل تفقيس ولديه سؤال متابعة. أجب بشكل مختصر ومباشر وعملي بالعربية. ارجع للدليل الذي أُعطي إذا كان ذلك مناسباً.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2000,
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: `${context ? `السياق:\n${context}\n\n` : ""}السؤال: ${question}` },
      ],
    });

    const answer = completion.choices[0]?.message?.content ?? (uiLang === "sv" ? "Kunde inte svara" : "لم يتمكن من الإجابة");
    res.json({ answer });
  } catch (err) {
    req.log.error({ err }, "Hatching followup failed");
    res.status(500).json({ error: "فشل في الإجابة" });
  }
});

export default router;
