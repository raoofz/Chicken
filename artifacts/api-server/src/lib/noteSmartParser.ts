/**
 * noteSmartParser.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Analyzes Arabic farm notes and extracts structured data:
 *   - Hatching cycles (eggs set, temperature, humidity, date)
 *   - Financial transactions (expense / income + category + amount)
 *   - Flock updates (new birds, age, count)
 *   - Task creation (action items detected from text)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Arabic digit normalization ─────────────────────────────────────────────
function normalizeNums(text: string): string {
  return text.replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

// ── Extract first number from a string ────────────────────────────────────
function extractNum(text: string): number | null {
  const m = normalizeNums(text).match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

// ── Find a number near a keyword (within ±50 chars) ────────────────────────
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
  // Patterns: DD/MM/YYYY or DD-MM-YYYY or YYYY-MM-DD
  const patterns = [
    /(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/,
    /(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/,
    /(\d{1,2})[/\-](\d{1,2})[/\-](\d{2})(?!\d)/,
  ];
  for (const p of patterns) {
    const m = norm.match(p);
    if (m) {
      // Determine if it's YYYY-MM-DD or DD-MM-YYYY
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
  // "50000 دينار" / "50 الف دينار" / "50,000" / "50000"
  const patterns = [
    // Explicit dinar mention
    /(\d[\d,]*(?:\.\d+)?)\s*(?:الف|آلاف)\s*(?:دينار|د\.?ع)/i,
    /(\d[\d,]*(?:\.\d+)?)\s*(?:دينار|د\.?ع)/i,
    // "بـ 50000" / "ب50000"
    /بـ?\s*(\d[\d,]*(?:\.\d+)?)/,
    // Large number before ريال/ل.ع/IQD
    /(\d[\d,]*(?:\.\d+)?)\s*(?:ريال|IQD|iqd)/i,
    // Patterns like "الف دينار" → 1000
    /الف(?:\s*دينار)?/i,
  ];

  for (const p of patterns) {
    const m = norm.match(p);
    if (m) {
      if (m[0].includes("الف")) {
        // "50 الف" → look for number before
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

// ── Detect expense category from text ────────────────────────────────────
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

// ── Detect income category from text ─────────────────────────────────────
function detectIncomeCategory(text: string): string {
  if (/كتكوت|فرخ|صوص|دجاج صغير/i.test(text)) return "chick_sale";
  if (/بيض|بيضة/i.test(text)) return "egg_sale";
  if (/دجاج|فروج|دجاجة/i.test(text)) return "chick_sale";
  return "other";
}

// ── Extract chicken count from text ──────────────────────────────────────
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

// ── Extract egg count from text ───────────────────────────────────────────
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
    /(\d{2}(?:\.\d+)?)\s*°?[cCCc]/,
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
    /عمر\s*يوم/i, // عمر يوم → 1 day
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

// ─────────────────────────────────────────────────────────────────────────────
// Main parser
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractedAction {
  type: "hatching_cycle" | "hatching_result" | "transaction" | "flock" | "task";
  confidence: number; // 0–1
  description: string; // Human-readable summary in Arabic
  data: Record<string, any>;
}

export interface ParseResult {
  actions: ExtractedAction[];
  summary: string;
  inputText: string;
}

export function parseNote(text: string, date: string): ParseResult {
  const actions: ExtractedAction[] = [];
  const t = text.trim();

  // ── 1. HATCHING CYCLE — setting eggs ─────────────────────────────────────
  const isSettingEggs = /وضعنا|حطينا|وضعت|ادخلنا|ادخلت|وضع|نضع/.test(t) && /بيض|بيضة|بيضه/.test(t);
  if (isSettingEggs) {
    const eggsSet = extractEggCount(t);
    const temp = extractTemperature(t);
    const humidity = extractHumidity(t);
    const startDate = extractDate(t) ?? date;
    if (eggsSet && eggsSet > 0) {
      // Calculate expected dates
      const sd = new Date(startDate);
      const expectedHatch = new Date(sd.getTime() + 21 * 86400000).toISOString().split("T")[0];
      const lockdown = new Date(sd.getTime() + 18 * 86400000).toISOString().split("T")[0];
      actions.push({
        type: "hatching_cycle",
        confidence: temp ? 0.95 : 0.85,
        description: `🥚 دورة تفقيس جديدة: ${eggsSet} بيضة${temp ? ` — حرارة ${temp}°C` : ""}${humidity ? ` — رطوبة ${humidity}%` : ""} — التاريخ: ${startDate}`,
        data: {
          batchName: `دفعة ${startDate}`,
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
  const isHatchResult = /فقسنا|فقس|خرج|طلع|حصلنا(?:\s+على)?/.test(t) && /بيض|بيضة|كتكوت|فرخ|صوص/.test(t);
  if (isHatchResult && !isSettingEggs) {
    const hatched = extractChickenCount(t) ?? extractEggCount(t);
    const set = numNear(t, /من\s+\d+|وضعنا\s+\d+/i) ?? extractEggCount(t);
    if (hatched && hatched > 0) {
      actions.push({
        type: "hatching_result",
        confidence: 0.82,
        description: `🐣 نتيجة تفقيس: ${hatched} كتكوت${set ? ` من ${set} بيضة (${Math.round((hatched / set) * 100)}%)` : ""}`,
        data: { eggsHatched: hatched, eggsSet: set, actualHatchDate: date },
      });
    }
  }

  // ── 3. FINANCIAL — EXPENSE ────────────────────────────────────────────────
  const isExpense = /اشتر(?:ينا|يت|ينا)|دفع(?:نا|ت)|صرف(?:نا|ت)|شرين|مصروف|شرينا/.test(t);
  if (isExpense) {
    const amount = extractAmount(t);
    const category = detectExpenseCategory(t);
    const qty = extractChickenCount(t) ?? extractNum(normalizeNums(t).replace(/amount/g, ""));
    if (amount && amount > 0) {
      const catLabels: Record<string, string> = {
        feed: "علف", medicine: "أدوية", electricity: "كهرباء",
        labor: "عمالة", maintenance: "صيانة", equipment: "معدات", other: "أخرى",
      };
      actions.push({
        type: "transaction",
        confidence: 0.9,
        description: `💸 مصروف: ${amount.toLocaleString("ar-IQ")} دينار — فئة: ${catLabels[category] ?? "أخرى"}`,
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
  const isIncome = /بعنا|بعت|بعيت|اشتر(?:ى|وا) منا|باعوا|دخل|ربح/.test(t) && !isExpense;
  if (isIncome) {
    const amount = extractAmount(t);
    const category = detectIncomeCategory(t);
    const qty = extractChickenCount(t);
    if (amount && amount > 0) {
      const catLabels: Record<string, string> = {
        chick_sale: "بيع كتاكيت", egg_sale: "بيع بيض", other: "أخرى",
      };
      actions.push({
        type: "transaction",
        confidence: 0.88,
        description: `💰 دخل: ${amount.toLocaleString("ar-IQ")} دينار — ${catLabels[category] ?? "أخرى"}`,
        data: {
          type: "income",
          date,
          category,
          description: t.substring(0, 120),
          amount,
          quantity: qty ?? null,
          unit: qty ? "كتكوت" : null,
          notes: null,
        },
      });
    }
  }

  // ── 5. FLOCK — new birds ──────────────────────────────────────────────────
  const isNewFlock = /وصل(?:نا|ت)?|جاء(?:نا|ت)?|اشتر(?:ينا|يت)(?!\s*علف)/.test(t) && /كتكوت|فرخ|صوص|دجاج(?:ة)?/.test(t);
  if (isNewFlock) {
    const count = extractChickenCount(t);
    const ageDays = extractAgeDays(t);
    if (count && count > 0) {
      actions.push({
        type: "flock",
        confidence: 0.85,
        description: `🐔 قطيع جديد: ${count} كتكوت${ageDays != null ? ` — عمر ${ageDays} يوم` : ""}`,
        data: {
          name: `قطيع ${date}`,
          breed: "محلي",
          count,
          ageDays: ageDays ?? 1,
          purpose: "meat",
          notes: t.substring(0, 200),
        },
      });
    }
  }

  // ── 6. TASK — action items ────────────────────────────────────────────────
  const isTask = /يجب|لازم|ضروري|اذكر|لا تنسَ?ى?|تذكير|فحص|غدًا|غدا|الاسبوع|قريب/.test(t);
  if (isTask && t.length > 10) {
    // Extract what needs to be done
    const taskTitle = t
      .replace(/^(?:يجب|لازم|ضروري|لا تنسى?|اذكر)\s*/i, "")
      .split(/[\.\n]/)[0]
      .trim()
      .substring(0, 80);

    // Determine due date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const isNextWeek = /الاسبوع|هذا الاسبوع/.test(t);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const dueDate = isNextWeek ? nextWeek.toISOString().split("T")[0] : tomorrowStr;

    actions.push({
      type: "task",
      confidence: 0.75,
      description: `📋 مهمة جديدة: ${taskTitle}`,
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
  const types = actions.map(a => a.type);
  let summary = "تم تحليل الملاحظة.";
  if (actions.length === 0) {
    summary = "لم يُكتشف بيانات منظمة — تم حفظ الملاحظة فقط.";
  } else {
    const typeNames: Record<string, string> = {
      hatching_cycle: "دورة تفقيس",
      hatching_result: "نتيجة تفقيس",
      transaction: "معاملة مالية",
      flock: "قطيع جديد",
      task: "مهمة",
    };
    const unique = [...new Set(types)].map(t => typeNames[t] ?? t);
    summary = `تم اكتشاف وإضافة: ${unique.join("، ")} (${actions.length} عنصر)`;
  }

  return { actions, summary, inputText: t };
}
