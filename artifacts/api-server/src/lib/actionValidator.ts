/**
 * actionValidator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 *  STRICT validation of parsed actions before they are committed to the DB.
 *  Every action goes through:
 *    1. Range checks (numerical bounds)
 *    2. Logic checks (cross-field consistency)
 *    3. Duplicate checks (vs recent DB rows)
 *    4. Business rule checks (hatching biology, finance sanity)
 *
 *  Output: per-action issue list (errors block save; warnings are advisory).
 *  Bilingual AR/SV messages.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { db, transactionsTable, hatchingCyclesTable, flocksTable, tasksTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { ExtractedAction } from "./noteSmartParser";

export type IssueSeverity = "error" | "warning" | "info";
export interface ValidationIssue {
  severity: IssueSeverity;
  code: string;
  ar: string;
  sv: string;
  field?: string;
}
export interface ValidatedAction {
  index: number;
  action: ExtractedAction;
  issues: ValidationIssue[];
  blocking: boolean;
  /** Sanitized data (after coercion / clamping) — what would actually be inserted. */
  normalized: Record<string, any>;
}
export interface ValidationReport {
  actions: ValidatedAction[];
  totalActions: number;
  totalErrors: number;
  totalWarnings: number;
  canCommit: boolean;
}

// ─── Range constants (single source of truth) ───────────────────────────────
const RANGES = {
  amount:         { min: 1,    max: 100_000_000 },     // IQD
  eggsSet:        { min: 1,    max: 50_000 },
  birdCount:      { min: 1,    max: 200_000 },
  ageDays:        { min: 0,    max: 730 },
  temperature:    { min: 30,   max: 45,   optMin: 37.5, optMax: 37.8, lockMin: 36.8, lockMax: 37.2 },
  humidity:       { min: 10,   max: 100,  incMin: 50,   incMax: 55,   lockMin: 70,   lockMax: 75 },
  taskTitleLen:   { min: 3,    max: 200 },
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function toNum(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function isValidISODate(s: any): boolean {
  if (typeof s !== "string") return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(s);
}
function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

// ─── Per-action validators ──────────────────────────────────────────────────
async function validateTransaction(d: Record<string, any>): Promise<{ issues: ValidationIssue[]; normalized: Record<string, any> }> {
  const issues: ValidationIssue[] = [];
  const norm: Record<string, any> = { ...d };

  // type
  if (d.type !== "income" && d.type !== "expense") {
    issues.push({ severity: "error", code: "tx_type_invalid", ar: "نوع المعاملة يجب أن يكون دخل أو مصروف", sv: "Transaktionstyp måste vara inkomst eller utgift", field: "type" });
  }

  // amount
  const amt = toNum(d.amount);
  if (amt === null) {
    issues.push({ severity: "error", code: "tx_amount_missing", ar: "المبلغ مفقود", sv: "Beloppet saknas", field: "amount" });
  } else if (amt < RANGES.amount.min) {
    issues.push({ severity: "error", code: "tx_amount_too_low", ar: `المبلغ يجب أن يكون ≥ ${RANGES.amount.min}`, sv: `Beloppet måste vara ≥ ${RANGES.amount.min}`, field: "amount" });
  } else if (amt > RANGES.amount.max) {
    issues.push({ severity: "error", code: "tx_amount_too_high", ar: `المبلغ يبدو غير منطقي (> ${RANGES.amount.max.toLocaleString()})`, sv: `Beloppet verkar orimligt (> ${RANGES.amount.max.toLocaleString()})`, field: "amount" });
  } else {
    norm.amount = Math.round(amt);
  }

  // date
  const date = d.date ?? todayISO();
  if (!isValidISODate(date)) {
    issues.push({ severity: "error", code: "tx_date_invalid", ar: "التاريخ غير صالح", sv: "Ogiltigt datum", field: "date" });
  } else {
    const diff = daysBetween(date, todayISO());
    if (diff > 1) {
      issues.push({ severity: "warning", code: "tx_date_future", ar: `التاريخ في المستقبل (+${diff} يوم) — تأكد`, sv: `Datum i framtiden (+${diff} dagar) — bekräfta`, field: "date" });
    } else if (diff < -90) {
      issues.push({ severity: "warning", code: "tx_date_old", ar: `التاريخ قديم جداً (${Math.abs(diff)} يوم مضى)`, sv: `Mycket gammalt datum (${Math.abs(diff)} dagar sedan)`, field: "date" });
    }
    norm.date = date;
  }

  // category
  if (!d.category) {
    issues.push({ severity: "warning", code: "tx_category_missing", ar: "الفئة غير محددة — سيتم استخدام «أخرى»", sv: "Kategori saknas — använder ”Övrigt”", field: "category" });
    norm.category = "other";
  }

  // duplicate check
  if (amt && date && d.category) {
    try {
      const dup = await db.execute(sql`
        SELECT id FROM transactions
        WHERE date = ${date}
          AND type = ${d.type}
          AND category = ${d.category}
          AND amount = ${String(Math.round(amt))}
        LIMIT 1
      `);
      if (dup.rows.length > 0) {
        issues.push({ severity: "warning", code: "tx_duplicate", ar: "⚠️ معاملة مماثلة موجودة (نفس التاريخ والمبلغ والفئة) — قد يكون تكرار", sv: "⚠️ Liknande transaktion finns redan (samma datum, belopp, kategori) — möjlig dubblett" });
      }
    } catch { /* non-fatal */ }
  }

  return { issues, normalized: norm };
}

async function validateHatchingCycle(d: Record<string, any>): Promise<{ issues: ValidationIssue[]; normalized: Record<string, any> }> {
  const issues: ValidationIssue[] = [];
  const norm: Record<string, any> = { ...d };

  // eggsSet
  const eggs = toNum(d.eggsSet);
  if (eggs === null || eggs < RANGES.eggsSet.min) {
    issues.push({ severity: "error", code: "hc_eggs_invalid", ar: `عدد البيض يجب أن يكون ≥ ${RANGES.eggsSet.min}`, sv: `Antal ägg måste vara ≥ ${RANGES.eggsSet.min}`, field: "eggsSet" });
  } else if (eggs > RANGES.eggsSet.max) {
    issues.push({ severity: "error", code: "hc_eggs_too_high", ar: `عدد البيض يبدو غير منطقي (> ${RANGES.eggsSet.max})`, sv: `Antal ägg verkar orimligt (> ${RANGES.eggsSet.max})`, field: "eggsSet" });
  } else {
    norm.eggsSet = Math.round(eggs);
  }

  // startDate
  if (!isValidISODate(d.startDate)) {
    issues.push({ severity: "error", code: "hc_date_invalid", ar: "تاريخ البدء غير صالح", sv: "Ogiltigt startdatum", field: "startDate" });
  } else {
    const diff = daysBetween(d.startDate, todayISO());
    if (diff > 1) {
      issues.push({ severity: "warning", code: "hc_date_future", ar: `تاريخ البدء في المستقبل (+${diff} يوم)`, sv: `Startdatum i framtiden (+${diff} dagar)`, field: "startDate" });
    }
  }

  // temperature
  const t = toNum(d.temperature);
  if (t !== null) {
    if (t < RANGES.temperature.min || t > RANGES.temperature.max) {
      issues.push({ severity: "error", code: "hc_temp_oob", ar: `حرارة غير منطقية (${t}°C)`, sv: `Orimlig temperatur (${t}°C)`, field: "temperature" });
    } else if (t < RANGES.temperature.optMin || t > RANGES.temperature.optMax) {
      issues.push({ severity: "warning", code: "hc_temp_suboptimal", ar: `الحرارة ${t}°C خارج المثالي 37.5–37.8°C — تحذير`, sv: `Temperatur ${t}°C utanför optimalt 37.5–37.8°C`, field: "temperature" });
    }
  }

  // humidity
  const h = toNum(d.humidity);
  if (h !== null) {
    if (h < RANGES.humidity.min || h > RANGES.humidity.max) {
      issues.push({ severity: "error", code: "hc_humid_oob", ar: `رطوبة غير منطقية (${h}%)`, sv: `Orimlig luftfuktighet (${h}%)`, field: "humidity" });
    } else if (h < RANGES.humidity.incMin || h > RANGES.humidity.incMax) {
      issues.push({ severity: "warning", code: "hc_humid_suboptimal", ar: `الرطوبة ${h}% خارج نطاق الحضانة 50–55%`, sv: `Luftfuktighet ${h}% utanför 50–55%`, field: "humidity" });
    }
  }

  return { issues, normalized: norm };
}

async function validateHatchingResult(d: Record<string, any>): Promise<{ issues: ValidationIssue[]; normalized: Record<string, any> }> {
  const issues: ValidationIssue[] = [];
  const norm: Record<string, any> = { ...d };
  const hatched = toNum(d.eggsHatched);
  const set = toNum(d.eggsSet);

  if (hatched === null || hatched < 0) {
    issues.push({ severity: "error", code: "hr_hatched_invalid", ar: "عدد الكتاكيت الناجحة غير صالح", sv: "Antal kläckta kycklingar ogiltigt", field: "eggsHatched" });
  }
  if (hatched !== null && set !== null && hatched > set) {
    issues.push({ severity: "error", code: "hr_hatched_gt_set", ar: `الكتاكيت (${hatched}) أكبر من البيض الموضوع (${set}) — مستحيل`, sv: `Kycklingar (${hatched}) > lagda ägg (${set}) — omöjligt` });
  }
  // Verify there is an active cycle to update
  try {
    const active = await db.execute(sql`
      SELECT id FROM hatching_cycles WHERE status IN ('incubating','hatching') ORDER BY id DESC LIMIT 1
    `);
    if (active.rows.length === 0) {
      issues.push({ severity: "warning", code: "hr_no_active_cycle", ar: "لا توجد دورة تفقيس نشطة لتحديثها", sv: "Ingen aktiv kläckcykel att uppdatera" });
    }
  } catch { /* non-fatal */ }

  return { issues, normalized: norm };
}

async function validateFlock(d: Record<string, any>): Promise<{ issues: ValidationIssue[]; normalized: Record<string, any> }> {
  const issues: ValidationIssue[] = [];
  const norm: Record<string, any> = { ...d };
  const count = toNum(d.count);
  const age = toNum(d.ageDays);

  if (count === null || count < RANGES.birdCount.min) {
    issues.push({ severity: "error", code: "fl_count_invalid", ar: `عدد الطيور يجب أن يكون ≥ ${RANGES.birdCount.min}`, sv: `Antal fåglar måste vara ≥ ${RANGES.birdCount.min}`, field: "count" });
  } else if (count > RANGES.birdCount.max) {
    issues.push({ severity: "error", code: "fl_count_too_high", ar: `العدد يبدو غير منطقي (> ${RANGES.birdCount.max.toLocaleString()})`, sv: `Antalet verkar orimligt (> ${RANGES.birdCount.max.toLocaleString()})`, field: "count" });
  } else {
    norm.count = Math.round(count);
  }
  if (age !== null && (age < RANGES.ageDays.min || age > RANGES.ageDays.max)) {
    issues.push({ severity: "warning", code: "fl_age_oob", ar: `العمر غير معتاد (${age} يوم)`, sv: `Ovanlig ålder (${age} dagar)`, field: "ageDays" });
  }
  if (!d.name || String(d.name).trim().length < 2) {
    issues.push({ severity: "warning", code: "fl_name_missing", ar: "اسم القطيع قصير — سيتم توليد اسم تلقائي", sv: "Flocknamn saknas — auto-genererat" });
  }
  return { issues, normalized: norm };
}

async function validateTask(d: Record<string, any>): Promise<{ issues: ValidationIssue[]; normalized: Record<string, any> }> {
  const issues: ValidationIssue[] = [];
  const norm: Record<string, any> = { ...d };
  const title = String(d.title ?? "").trim();
  if (title.length < RANGES.taskTitleLen.min) {
    issues.push({ severity: "error", code: "tk_title_short", ar: `عنوان المهمة قصير جداً (≥ ${RANGES.taskTitleLen.min} حرف)`, sv: `Uppgiftens titel för kort (≥ ${RANGES.taskTitleLen.min} tecken)`, field: "title" });
  } else if (title.length > RANGES.taskTitleLen.max) {
    norm.title = title.substring(0, RANGES.taskTitleLen.max);
    issues.push({ severity: "info", code: "tk_title_truncated", ar: "العنوان طويل — تم اختصاره", sv: "Titel förkortad" });
  } else {
    norm.title = title;
  }
  if (d.dueDate && !isValidISODate(d.dueDate)) {
    issues.push({ severity: "warning", code: "tk_date_invalid", ar: "تاريخ الاستحقاق غير صالح — سيُحذف", sv: "Ogiltigt förfallodatum — tas bort", field: "dueDate" });
    norm.dueDate = null;
  }
  return { issues, normalized: norm };
}

// ─── Public API ─────────────────────────────────────────────────────────────
export async function validateActions(actions: ExtractedAction[]): Promise<ValidationReport> {
  const out: ValidatedAction[] = [];
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    let result: { issues: ValidationIssue[]; normalized: Record<string, any> };
    try {
      switch (a.type) {
        case "transaction":     result = await validateTransaction(a.data); break;
        case "hatching_cycle":  result = await validateHatchingCycle(a.data); break;
        case "hatching_result": result = await validateHatchingResult(a.data); break;
        case "flock":           result = await validateFlock(a.data); break;
        case "task":            result = await validateTask(a.data); break;
        default:                result = { issues: [{ severity: "error", code: "unknown_type", ar: "نوع غير معروف", sv: "Okänd typ" }], normalized: a.data };
      }
    } catch (err: any) {
      result = { issues: [{ severity: "error", code: "validator_crash", ar: `خطأ داخلي في التحقق: ${err?.message ?? "?"}`, sv: `Internt valideringsfel: ${err?.message ?? "?"}` }], normalized: a.data };
    }
    const blocking = result.issues.some(x => x.severity === "error");
    out.push({ index: i, action: a, issues: result.issues, blocking, normalized: result.normalized });
  }

  const totalErrors = out.reduce((s, x) => s + x.issues.filter(i => i.severity === "error").length, 0);
  const totalWarnings = out.reduce((s, x) => s + x.issues.filter(i => i.severity === "warning").length, 0);

  return {
    actions: out,
    totalActions: out.length,
    totalErrors,
    totalWarnings,
    canCommit: out.length > 0 && totalErrors === 0,
  };
}
