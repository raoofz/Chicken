/**
 * noteSmartParser.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Analyzes Arabic farm notes and extracts structured data.
 * Fully bilingual: generates names/descriptions in Arabic or Swedish.
 * ─────────────────────────────────────────────────────────────────────────────
 */

type Lang = "ar" | "sv";

// ── Bilingual labels ───────────────────────────────────────────────────────
const L = {
  ar: {
    hatchingCycle:  "🥚 دورة تفقيس جديدة",
    hatchResult:    "🐣 نتيجة تفقيس",
    expense:        "💸 مصروف",
    income:         "💰 دخل",
    newFlock:       "🐔 قطيع جديد",
    newTask:        "📋 مهمة جديدة",
    egg:            "بيضة",
    temp:           "حرارة",
    humid:          "رطوبة",
    dateLabel:      "التاريخ",
    dinar:          "دينار",
    category:       "فئة",
    chick:          "كتكوت",
    age:            "عمر",
    day:            "يوم",
    batchPrefix:    "دفعة",
    flockPrefix:    "قطيع",
    from:           "من",
    percent:        "%",
    nodata:         "لم يُكتشف بيانات منظمة — تم حفظ الملاحظة فقط.",
    detected:       (n: number) => `تم اكتشاف وإضافة ${n} عنصر`,
    cats: {
      feed:         "علف",
      medicine:     "أدوية",
      electricity:  "كهرباء",
      labor:        "عمالة",
      maintenance:  "صيانة",
      equipment:    "معدات",
      other:        "أخرى",
      chick_sale:   "بيع كتاكيت",
      egg_sale:     "بيع بيض",
    },
    breed:          "محلي",
    purpose:        "meat",
  },
  sv: {
    hatchingCycle:  "🥚 Ny kläckcykel",
    hatchResult:    "🐣 Kläckresultat",
    expense:        "💸 Utgift",
    income:         "💰 Inkomst",
    newFlock:       "🐔 Ny flock",
    newTask:        "📋 Ny uppgift",
    egg:            "ägg",
    temp:           "temp",
    humid:          "fukt",
    dateLabel:      "datum",
    dinar:          "dinar",
    category:       "kategori",
    chick:          "kyckling",
    age:            "ålder",
    day:            "dag",
    batchPrefix:    "Omgång",
    flockPrefix:    "Flock",
    from:           "av",
    percent:        "%",
    nodata:         "Inga strukturerade data hittades — anteckning sparad.",
    detected:       (n: number) => `${n} element identifierade och sparade`,
    cats: {
      feed:         "Foder",
      medicine:     "Medicin",
      electricity:  "El",
      labor:        "Arbetskraft",
      maintenance:  "Underhåll",
      equipment:    "Utrustning",
      other:        "Övrigt",
      chick_sale:   "Kycklingförsäljning",
      egg_sale:     "Äggförsäljning",
    },
    breed:          "Lokal",
    purpose:        "meat",
  },
};

// ── Arabic digit normalization ─────────────────────────────────────────────
function normalizeNums(text: string): string {
  return text.replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

// ── Find a number near a keyword (within ±range chars) ────────────────────
function numNear(text: string, keyword: RegExp, range = 60): number | null {
  const norm = normalizeNums(text);
  const m = norm.match(keyword);
  if (!m || m.index == null) return null;
  const slice = norm.substring(Math.max(0, m.index - range), m.index + range);
  const nums = [...slice.matchAll(/\d+(?:\.\d+)?/g)].map(n => Number(n[0]));
  return nums.length ? nums[0] : null;
}

// ── Extract a date from Arabic text ───────────────────────────────────────
function extractDate(text: string): string | null {
  const norm = normalizeNums(text);
  const patterns = [
    /(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/,
    /(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/,
    /(\d{1,2})[/\-](\d{1,2})[/\-](\d{2})(?!\d)/,
  ];
  for (const p of patterns) {
    const m = norm.match(p);
    if (m) {
      if (m[1].length === 4) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
      const year = m[3].length === 2 ? `20${m[3]}` : m[3];
      return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
  }
  return null;
}

// ── Find amount in Iraqi Dinars ───────────────────────────────────────────
function extractAmount(text: string): number | null {
  const norm = normalizeNums(text);
  const patterns = [
    /(\d[\d,]*(?:\.\d+)?)\s*(?:الف|آلاف)\s*(?:دينار|د\.?ع)/i,
    /(\d[\d,]*(?:\.\d+)?)\s*(?:دينار|د\.?ع)/i,
    /بـ?\s*(\d[\d,]*(?:\.\d+)?)/,
    /(\d[\d,]*(?:\.\d+)?)\s*(?:ريال|IQD|iqd)/i,
    /الف(?:\s*دينار)?/i,
  ];
  for (const p of patterns) {
    const m = norm.match(p);
    if (m) {
      if (m[0].includes("الف")) {
        const numMatch = norm.match(/(\d[\d,]*)\s*(?:الف|آلاف)/);
        if (numMatch) return Number(numMatch[1].replace(/,/g, "")) * 1000;
        return 1000;
      }
      const raw = m[1]?.replace(/,/g, "") ?? m[0];
      const n = Number(raw);
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return null;
}

// ── Detect expense category ────────────────────────────────────────────────
function detectExpenseCategory(text: string): string {
  const map: Array<[RegExp, string]> = [
    [/علف|غذاء|اكل|طعام|سمسم|ذرة|قمح|حبوب/i, "feed"],
    [/دواء|دوا|مضاد|تطعيم|لقاح|مرض|بيطر|علاج/i, "medicine"],
    [/كهرباء|طاقة|شمسي|بطاري|فاتورة كهرب/i, "electricity"],
    [/عامل|راتب|اجر|اجور|يد عامل/i, "labor"],
    [/صيانة|اصلاح|تصليح|قطعة|شبك|سقف/i, "maintenance"],
    [/معدة|ادات|آلة|ماكينة|جهاز|مضخة|مروحة/i, "equipment"],
  ];
  for (const [pattern, cat] of map) {
    if (pattern.test(text)) return cat;
  }
  return "other";
}

// ── Detect income category ─────────────────────────────────────────────────
function detectIncomeCategory(text: string): string {
  if (/كتكوت|فرخ|صوص|دجاج صغير/i.test(text)) return "chick_sale";
  if (/بيض|بيضة/i.test(text)) return "egg_sale";
  if (/دجاج|فروج|دجاجة/i.test(text)) return "chick_sale";
  return "other";
}

// ── Extract chicken count ──────────────────────────────────────────────────
function extractChickenCount(text: string): number | null {
  const norm = normalizeNums(text);
  const patterns = [
    /(\d+)\s*(?:كتكوت|فرخ|صوص|رأس|دجاج(?:ة)?)/i,
    /(?:كتكوت|فرخ|صوص|رأس|دجاج(?:ة)?)\s*(\d+)/i,
    /(\d+)\s*طير/i,
  ];
  for (const p of patterns) {
    const m = norm.match(p);
    if (m) return Number(m[1]);
  }
  return null;
}

// ── Extract egg count ──────────────────────────────────────────────────────
function extractEggCount(text: string): number | null {
  const norm = normalizeNums(text);
  const patterns = [
    /(\d+)\s*(?:بيضة|بيضه|بيض)/i,
    /(?:بيضة|بيضه|بيض)\s*(\d+)/i,
  ];
  for (const p of patterns) {
    const m = norm.match(p);
    if (m) return Number(m[1]);
  }
  return null;
}

// ── Extract temperature ────────────────────────────────────────────────────
function extractTemperature(text: string): number | null {
  const norm = normalizeNums(text);
  const patterns = [
    /حرار[ةه]\s*[:=]?\s*(\d{2}(?:\.\d+)?)/i,
    /(\d{2}(?:\.\d+)?)\s*درج[ةه]/i,
    /(\d{2}(?:\.\d+)?)\s*°?[cC]/,
    /temp[eratur]*\s*[:=]?\s*(\d{2}(?:\.\d+)?)/i,
  ];
  for (const p of patterns) {
    const m = norm.match(p);
    if (m) {
      const v = Number(m[1]);
      if (v >= 30 && v <= 45) return v;
    }
  }
  return null;
}

// ── Extract humidity ───────────────────────────────────────────────────────
function extractHumidity(text: string): number | null {
  const norm = normalizeNums(text);
  const patterns = [
    /رطوب[ةه]\s*[:=]?\s*(\d{1,3}(?:\.\d+)?)\s*%?/i,
    /(\d{1,3})\s*%\s*رطوب/i,
    /humid\s*[:=]?\s*(\d{1,3})/i,
  ];
  for (const p of patterns) {
    const m = norm.match(p);
    if (m) {
      const v = Number(m[1]);
      if (v >= 10 && v <= 100) return v;
    }
  }
  return null;
}

// ── Extract age in days ────────────────────────────────────────────────────
function extractAgeDays(text: string): number | null {
  const norm = normalizeNums(text);
  const patterns = [
    /عمر[هها]?\s*(\d+)\s*(?:يوم|يومًا|يوما)/i,
    /(\d+)\s*يوم\s*(?:عمر)?/i,
    /عمر\s*يوم/i,
  ];
  for (const p of patterns) {
    const m = norm.match(p);
    if (m) {
      if (m[0].includes("عمر يوم")) return 1;
      return Number(m[1]);
    }
  }
  return null;
}

// ── Format amount with thousands separator ────────────────────────────────
function fmtAmt(n: number, lang: Lang): string {
  return lang === "ar"
    ? `${n.toLocaleString("ar-IQ")} ${L.ar.dinar}`
    : `${n.toLocaleString("sv-SE")} ${L.sv.dinar}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main parser
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractedAction {
  type: "hatching_cycle" | "hatching_result" | "transaction" | "flock" | "task";
  confidence: number;
  description: string;
  data: Record<string, any>;
}

export interface ParseResult {
  actions: ExtractedAction[];
  summary: string;
  inputText: string;
}

export function parseNote(text: string, date: string, lang: Lang = "ar"): ParseResult {
  const l = L[lang];
  const actions: ExtractedAction[] = [];
  const t = text.trim();

  // ── 1. HATCHING CYCLE — setting eggs ────────────────────────────────────
  const isSettingEggs =
    /وضعنا|حطينا|وضعت|ادخلنا|ادخلت|وضع|نضع/.test(t) && /بيض|بيضة|بيضه/.test(t);
  if (isSettingEggs) {
    const eggsSet = extractEggCount(t);
    const temp = extractTemperature(t);
    const humidity = extractHumidity(t);
    const startDate = extractDate(t) ?? date;
    if (eggsSet && eggsSet > 0) {
      const sd = new Date(startDate);
      const expectedHatch = new Date(sd.getTime() + 21 * 86400000).toISOString().split("T")[0];
      const lockdown    = new Date(sd.getTime() + 18 * 86400000).toISOString().split("T")[0];

      const desc = lang === "ar"
        ? `${l.hatchingCycle}: ${eggsSet} ${l.egg}${temp ? ` — ${l.temp} ${temp}°C` : ""}${humidity ? ` — ${l.humid} ${humidity}%` : ""} — ${l.dateLabel}: ${startDate}`
        : `${l.hatchingCycle}: ${eggsSet} ${l.egg}${temp ? ` — ${l.temp} ${temp}°C` : ""}${humidity ? ` — ${l.humid} ${humidity}%` : ""} — ${l.dateLabel}: ${startDate}`;

      actions.push({
        type: "hatching_cycle",
        confidence: temp ? 0.95 : 0.85,
        description: desc,
        data: {
          batchName: `${l.batchPrefix} ${startDate}`,
          eggsSet,
          startDate,
          expectedHatchDate: expectedHatch,
          lockdownDate: lockdown,
          status: "incubating",
          temperature: temp ?? 37.5,
          humidity: humidity ?? 55,
          notes: t,
        },
      });
    }
  }

  // ── 2. HATCHING RESULT — eggs hatched ────────────────────────────────────
  const isHatchResult =
    /فقسنا|فقس|خرج|طلع|حصلنا(?:\s+على)?/.test(t) &&
    /بيض|بيضة|كتكوت|فرخ|صوص/.test(t);
  if (isHatchResult && !isSettingEggs) {
    const hatched = extractChickenCount(t) ?? extractEggCount(t);
    const set = numNear(t, /من\s+\d+|وضعنا\s+\d+/i) ?? extractEggCount(t);
    if (hatched && hatched > 0) {
      const desc = lang === "ar"
        ? `${l.hatchResult}: ${hatched} ${l.chick}${set ? ` ${l.from} ${set} ${l.egg} (${Math.round((hatched / set) * 100)}${l.percent})` : ""}`
        : `${l.hatchResult}: ${hatched} ${l.chick}${set ? ` ${l.from} ${set} ${l.egg} (${Math.round((hatched / set) * 100)}${l.percent})` : ""}`;
      actions.push({
        type: "hatching_result",
        confidence: 0.82,
        description: desc,
        data: { eggsHatched: hatched, eggsSet: set, actualHatchDate: date },
      });
    }
  }

  // ── 3. FINANCIAL — EXPENSE ────────────────────────────────────────────────
  const isExpense =
    /اشتر(?:ينا|يت|ينا)|دفع(?:نا|ت)|صرف(?:نا|ت)|شرين|مصروف|شرينا/.test(t);
  if (isExpense) {
    const amount = extractAmount(t);
    const category = detectExpenseCategory(t);
    const qty = extractChickenCount(t);
    if (amount && amount > 0) {
      actions.push({
        type: "transaction",
        confidence: 0.9,
        description: `${l.expense}: ${fmtAmt(amount, lang)} — ${l.category}: ${l.cats[category as keyof typeof l.cats] ?? l.cats.other}`,
        data: {
          type: "expense",
          date,
          category,
          description: t.substring(0, 120),
          amount,
          quantity: qty ?? null,
          unit: null,
          notes: null,
        },
      });
    }
  }

  // ── 4. FINANCIAL — INCOME ─────────────────────────────────────────────────
  const isIncome =
    /بعنا|بعت|بعيت|اشتر(?:ى|وا) منا|باعوا|دخل|ربح/.test(t) && !isExpense;
  if (isIncome) {
    const amount = extractAmount(t);
    const category = detectIncomeCategory(t);
    const qty = extractChickenCount(t);
    if (amount && amount > 0) {
      actions.push({
        type: "transaction",
        confidence: 0.88,
        description: `${l.income}: ${fmtAmt(amount, lang)} — ${l.cats[category as keyof typeof l.cats] ?? l.cats.other}`,
        data: {
          type: "income",
          date,
          category,
          description: t.substring(0, 120),
          amount,
          quantity: qty ?? null,
          unit: qty ? l.chick : null,
          notes: null,
        },
      });
    }
  }

  // ── 5. FLOCK — new birds ──────────────────────────────────────────────────
  const isNewFlock =
    /وصل(?:نا|ت)?|جاء(?:نا|ت)?|اشتر(?:ينا|يت)(?!\s*علف)/.test(t) &&
    /كتكوت|فرخ|صوص|دجاج(?:ة)?/.test(t);
  if (isNewFlock) {
    const count = extractChickenCount(t);
    const ageDays = extractAgeDays(t);
    if (count && count > 0) {
      const desc = lang === "ar"
        ? `${l.newFlock}: ${count} ${l.chick}${ageDays != null ? ` — ${l.age} ${ageDays} ${l.day}` : ""}`
        : `${l.newFlock}: ${count} ${l.chick}${ageDays != null ? ` — ${l.age} ${ageDays} ${l.day}` : ""}`;
      actions.push({
        type: "flock",
        confidence: 0.85,
        description: desc,
        data: {
          name: `${l.flockPrefix} ${date}`,
          breed: l.breed,
          count,
          ageDays: ageDays ?? 1,
          purpose: l.purpose,
          notes: t.substring(0, 200),
        },
      });
    }
  }

  // ── 6. TASK — action items ────────────────────────────────────────────────
  const isTask =
    /يجب|لازم|ضروري|اذكر|لا تنسَ?ى?|تذكير|فحص|غدًا|غدا|الاسبوع|قريب/.test(t) &&
    t.length > 10;
  if (isTask) {
    const taskTitle = t
      .replace(/^(?:يجب|لازم|ضروري|لا تنسى?|اذكر)\s*/i, "")
      .split(/[\.\n]/)[0]
      .trim()
      .substring(0, 80);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isNextWeek = /الاسبوع|هذا الاسبوع/.test(t);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const dueDate = isNextWeek
      ? nextWeek.toISOString().split("T")[0]
      : tomorrow.toISOString().split("T")[0];

    actions.push({
      type: "task",
      confidence: 0.75,
      description: `${l.newTask}: ${taskTitle}`,
      data: {
        title: taskTitle,
        description: t.substring(0, 300),
        category: "health",
        priority: /عاجل|فوري|حرج/.test(t) ? "critical" : "medium",
        completed: false,
        dueDate,
      },
    });
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  let summary: string;
  if (actions.length === 0) {
    summary = l.nodata;
  } else {
    summary = l.detected(actions.length);
  }

  return { actions, summary, inputText: t };
}
