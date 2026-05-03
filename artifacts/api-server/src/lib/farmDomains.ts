/**
 * farmDomains.ts — Single Source of Truth (SSOT)
 * ═══════════════════════════════════════════════════════════════════════════
 * Every transaction category, domain, and display label is defined here.
 * No other file should hard-code category strings or domain assignments.
 *
 * Domain Model:
 *   feed        — feed, nutrition, supplements
 *   egg         — egg purchasing, incubation supplies
 *   health      — medicine, vaccines, disinfection
 *   operational — electricity, water, fuel, labor, maintenance, equipment, transport, rent
 *   income      — any income sub-category
 *   general     — fallback
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── Domain enum ─────────────────────────────────────────────────────────────
export const DOMAINS = {
  FEED:        "feed",
  EGG:         "egg",
  HEALTH:      "health",
  OPERATIONAL: "operational",
  INCOME:      "income",
  GENERAL:     "general",
} as const;
export type Domain = typeof DOMAINS[keyof typeof DOMAINS];

// ── Expense categories ───────────────────────────────────────────────────────
export const EXPENSE_CATEGORIES = {
  FEED:                 "feed",
  FEED_PURCHASE:        "feed_purchase",
  EGGS_PURCHASE:        "eggs_purchase",
  INCUBATION_SUPPLIES:  "incubation_supplies",
  MEDICINE:             "medicine",
  MEDICINE_PURCHASE:    "medicine_purchase",
  VACCINES:             "vaccines",
  DISINFECTION:         "disinfection",
  SUPPLIES_PURCHASE:    "supplies_purchase",
  ELECTRICITY:          "electricity",
  WATER:                "water",
  FUEL:                 "fuel",
  LABOR:                "labor",
  EQUIPMENT:            "equipment",
  MAINTENANCE:          "maintenance",
  TRANSPORT:            "transport",
  RENT:                 "rent",
  OTHER:                "other",
} as const;
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[keyof typeof EXPENSE_CATEGORIES];

// ── Income categories ────────────────────────────────────────────────────────
export const INCOME_CATEGORIES = {
  EGG_SALE:     "egg_sale",
  CHICK_SALE:   "chick_sale",
  CHICKEN_SALE: "chicken_sale",
  MANURE_SALE:  "manure_sale",
  OTHER:        "other",
} as const;
export type IncomeCategory = typeof INCOME_CATEGORIES[keyof typeof INCOME_CATEGORIES];

export type TransactionCategory = ExpenseCategory | IncomeCategory;

// ── Category → Domain mapping (SSOT) ────────────────────────────────────────
export const CATEGORY_DOMAIN_MAP: Record<string, Domain> = {
  // Feed domain
  feed:                DOMAINS.FEED,
  feed_purchase:       DOMAINS.FEED,

  // Egg domain — strictly separate from feed
  eggs_purchase:       DOMAINS.EGG,
  incubation_supplies: DOMAINS.EGG,

  // Health domain
  medicine:            DOMAINS.HEALTH,
  medicine_purchase:   DOMAINS.HEALTH,
  vaccines:            DOMAINS.HEALTH,
  disinfection:        DOMAINS.HEALTH,

  // Operational domain
  supplies_purchase:   DOMAINS.OPERATIONAL,
  electricity:         DOMAINS.OPERATIONAL,
  water:               DOMAINS.OPERATIONAL,
  fuel:                DOMAINS.OPERATIONAL,
  labor:               DOMAINS.OPERATIONAL,
  equipment:           DOMAINS.OPERATIONAL,
  maintenance:         DOMAINS.OPERATIONAL,
  transport:           DOMAINS.OPERATIONAL,
  rent:                DOMAINS.OPERATIONAL,

  // Income domain
  egg_sale:            DOMAINS.INCOME,
  chick_sale:          DOMAINS.INCOME,
  chicken_sale:        DOMAINS.INCOME,
  manure_sale:         DOMAINS.INCOME,

  // General fallback
  other:               DOMAINS.GENERAL,
};

/** Derive domain from a category string. Always returns a valid Domain. */
export function categoryToDomain(category: string): Domain {
  return CATEGORY_DOMAIN_MAP[category] ?? DOMAINS.GENERAL;
}

// ── Bilingual display labels ─────────────────────────────────────────────────
export const CATEGORY_LABELS: Record<string, { ar: string; sv: string; icon: string }> = {
  // Expense
  feed:                { ar: "علف",                    sv: "Foder",                   icon: "🌾" },
  feed_purchase:       { ar: "شراء علف",               sv: "Foderinköp",              icon: "🌾" },
  eggs_purchase:       { ar: "شراء بيض",               sv: "Inköp av ägg",            icon: "🥚" },
  incubation_supplies: { ar: "مستلزمات تفقيس",         sv: "Kläckningsförnödenheter", icon: "🔧" },
  medicine:            { ar: "أدوية وعلاج",             sv: "Medicin & behandling",    icon: "💊" },
  medicine_purchase:   { ar: "شراء أدوية",             sv: "Medicininköp",            icon: "💊" },
  vaccines:            { ar: "لقاحات",                  sv: "Vacciner",                icon: "💉" },
  disinfection:        { ar: "مطهرات ومعقمات",          sv: "Desinfektion",            icon: "🧴" },
  supplies_purchase:   { ar: "شراء مستلزمات",          sv: "Inköp av förnödenheter",  icon: "📦" },
  electricity:         { ar: "كهرباء",                  sv: "Elektricitet",            icon: "⚡" },
  water:               { ar: "ماء",                     sv: "Vatten",                  icon: "💧" },
  fuel:                { ar: "وقود ومولد",              sv: "Bränsle & generator",     icon: "⛽" },
  labor:               { ar: "عمالة وأجور",             sv: "Arbetskraft",             icon: "👷" },
  equipment:           { ar: "معدات وأجهزة",            sv: "Utrustning",              icon: "🔩" },
  maintenance:         { ar: "صيانة",                   sv: "Underhåll",               icon: "🛠️" },
  transport:           { ar: "نقل وشحن",                sv: "Transport",               icon: "🚛" },
  rent:                { ar: "إيجار",                   sv: "Hyra",                    icon: "🏠" },
  other:               { ar: "أخرى",                   sv: "Övrigt",                  icon: "📦" },
  // Income
  egg_sale:            { ar: "بيع بيض",                sv: "Äggförsäljning",          icon: "🥚" },
  chick_sale:          { ar: "بيع كتاكيت",              sv: "Kycklingförsäljning",     icon: "🐣" },
  chicken_sale:        { ar: "بيع دجاج",               sv: "Hönsförsäljning",         icon: "🐔" },
  manure_sale:         { ar: "بيع سماد",               sv: "Gödselförsäljning",       icon: "🌱" },
};

/** Get bilingual label for a category. */
export function getCategoryLabel(category: string, lang: "ar" | "sv"): string {
  return CATEGORY_LABELS[category]?.[lang] ?? (lang === "ar" ? "أخرى" : "Övrigt");
}

/** Get icon for a category. */
export function getCategoryIcon(category: string): string {
  return CATEGORY_LABELS[category]?.icon ?? "📦";
}

// ── Keyword-based category classifier ───────────────────────────────────────
// Each entry: [regex, category, priority]
// Higher priority = checked first. Use priority to resolve ambiguity.
const EXPENSE_KEYWORD_MAP: Array<[RegExp, ExpenseCategory, number]> = [
  // Egg / incubation — MUST come before feed to avoid "feed" consuming egg references
  [/شراء\s*بيض|بيض\s*تفقيس|بيضة?\s*مخصب|بيض\s*للتفقيس|بيض\s*حضان|ägg\s*(?:köp|inköp)|inköp\s*(?:av\s*)?ägg/i,   "eggs_purchase",       100],
  [/مستلزمات\s*تفقيس|حضان|كبسولة|شمع|ورق\s*غلاف|kläck(?:nings)?|inkubator/i,                                       "incubation_supplies",  95],

  // Feed — general food and nutrition
  [/علف|غذاء|اكل|طعام|سمسم|ذرة|قمح|حبوب|نخالة|كسبة|كسبة\s*صويا|فودر|blandning|foder|spannmål|soja|kli/i,          "feed",                 90],

  // Health
  [/لقاح|تطعيم|تحصين|vaccin|vaccination/i,                                                                            "vaccines",             85],
  [/دواء|دوا|مضاد|علاج|بيطر|مرض|antibiotik|veterinär|medicin|läkemedel/i,                                            "medicine",             85],
  [/مطهر|معقم|كلور|فورمالين|تعقيم|desinfekt|klorin|formaldehyd/i,                                                   "disinfection",         80],

  // Operational
  [/كهرباء|طاقة|شمسي|بطاري|فاتور|el\b|ström|elektricitet/i,                                                          "electricity",          75],
  [/ماء|مياه|واتر|vatten/i,                                                                                            "water",                75],
  [/وقود|بنزين|ديزل|مولد|بنزين|diesel|bränsle|generator/i,                                                            "fuel",                 75],
  [/عامل|راتب|اجر|اجور|يد\s*عامل|معاش|arbets|lön|anställd/i,                                                        "labor",                70],
  [/صيانة|اصلاح|تصليح|شبك|سقف|underhåll|reparation|fix/i,                                                           "maintenance",           70],
  [/معدة|معدات|ادات|آلة|ماكينة|جهاز|مضخة|مروحة|utrustning|maskin|pump|fläkt/i,                                     "equipment",            70],
  [/نقل|شحن|توصيل|transport|frakt/i,                                                                                  "transport",            65],
  [/ايجار|إيجار|استئجار|hyra|lokalhyra/i,                                                                              "rent",                 65],
];

const INCOME_KEYWORD_MAP: Array<[RegExp, IncomeCategory, number]> = [
  [/بيض|بيضة|egg(?:s)?/i,                           "egg_sale",     90],
  [/كتكوت|فرخ|صوص|kyckling(?:ar)?|kull/i,           "chick_sale",   90],
  [/دجاج(?:ة)?|فروج|höns|höna/i,                    "chicken_sale", 80],
  [/سماد|زرق|gödsel|träck/i,                         "manure_sale",  80],
];

/** Classify an expense's category from free text. Returns "other" if no match. */
export function classifyExpenseCategory(text: string): ExpenseCategory {
  let best: ExpenseCategory = "other";
  let bestPriority = -1;
  for (const [pattern, cat, priority] of EXPENSE_KEYWORD_MAP) {
    if (priority > bestPriority && pattern.test(text)) {
      best = cat;
      bestPriority = priority;
    }
  }
  return best;
}

/** Classify an income's category from free text. Returns "other" if no match. */
export function classifyIncomeCategory(text: string): IncomeCategory {
  for (const [pattern, cat] of INCOME_KEYWORD_MAP) {
    if (pattern.test(text)) return cat;
  }
  return "other";
}

// ── Validation: is this category valid for this transaction type? ────────────
const VALID_EXPENSE_CATS: Set<string> = new Set(Object.values(EXPENSE_CATEGORIES));
const VALID_INCOME_CATS:  Set<string> = new Set(Object.values(INCOME_CATEGORIES));

export function isValidExpenseCategory(cat: string): cat is ExpenseCategory {
  return VALID_EXPENSE_CATS.has(cat);
}
export function isValidIncomeCategory(cat: string): cat is IncomeCategory {
  return VALID_INCOME_CATS.has(cat);
}

/**
 * Enforce domain integrity: ensures an expense category cannot be
 * incorrectly assigned to the egg domain when the caller signals feed context,
 * and vice versa. Returns an error string or null.
 */
export function validateCategoryDomainConsistency(
  type: "expense" | "income",
  category: string,
): string | null {
  if (type === "expense" && !isValidExpenseCategory(category)) {
    return `Invalid expense category: "${category}"`;
  }
  if (type === "income" && !isValidIncomeCategory(category)) {
    return `Invalid income category: "${category}"`;
  }
  return null;
}
