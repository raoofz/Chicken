/**
 * CHICKENS AI ENGINE — Isolated Intelligence Layer for Flocks Module
 * ─────────────────────────────────────────────────────────────────────────────
 * Modules:
 *  1. Semantic Parser  — Arabic NLP: understand free-text flock notes
 *  2. Health Engine    — compute health_score, risk_score, performance_index
 *  3. Anomaly Engine   — detect spikes, degradations, abnormal patterns
 *  4. Decision Engine  — prioritised actions + confidence threshold logic
 *  5. Predictive Engine— risk forecasts, trend extrapolation
 *  6. Confidence Engine— data coverage scoring + fail-safe guarding
 *  7. Timeline Manager — persist structured events for pattern detection
 *
 * Design rules (aligned with existing architecture):
 *  ✔ Fully deterministic — no external AI calls, no network
 *  ✔ Additive only — never writes to other modules' tables
 *  ✔ Fail-safe — returns requiresClarification when data is thin
 *  ✔ Bilingual output — every string has ar + sv
 */

import { pool } from "@workspace/db";
import { logger } from "../logger.js";

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface FlockData {
  id: number;
  name: string;
  breed: string;
  count: number;
  ageDays: number;
  purpose: string;
  healthStatus: string;
  feedConsumptionKg: number | null;
  dailyEggTarget: number | null;
  notes: string | null;
  createdAt: string;
}

export interface ProductionSnapshot {
  date: string;
  eggCount: number;
}

export interface HealthSnapshot {
  date: string;
  status: string;
  symptoms: string | null;
  treatment: string | null;
  notes: string | null;
}

export interface ParsedEvent {
  type: "mortality" | "health_change" | "intervention" | "behavioral" | "environmental" | "feeding" | "observation";
  subtype: string;
  value?: number | string;
  severity: "critical" | "high" | "medium" | "low" | "positive";
  signalAr: string;
  signalSv: string;
  confidence: number;
}

export interface ParseResult {
  events: ParsedEvent[];
  overallConfidence: number;
  requiresClarification: boolean;
  clarificationAr: string | null;
  clarificationSv: string | null;
  summaryAr: string;
  summarySv: string;
}

export interface FlockDecision {
  priority: 1 | 2 | 3;
  urgency: "now" | "today" | "this_week";
  titleAr: string;
  titleSv: string;
  actionAr: string;
  actionSv: string;
  reasonAr: string;
  reasonSv: string;
  confidence: number;
}

export interface FlockPrediction {
  type: "mortality_risk" | "production_decline" | "health_deterioration" | "feed_shortage";
  probabilityPct: number;
  horizon: "24h" | "48h" | "7d";
  descriptionAr: string;
  descriptionSv: string;
  preventionAr: string;
  preventionSv: string;
}

export interface FlockIntelligenceResult {
  flockId: number;
  flockName: string;
  generatedAt: string;

  // ── Scores (0-100) ────────────────────────────────────────────
  healthScore: number;
  riskScore: number;
  performanceIndex: number;
  dataQuality: "excellent" | "good" | "limited" | "none";

  // ── Confidence ────────────────────────────────────────────────
  confidence: number;   // 0-100
  requiresClarification: boolean;
  clarificationAr: string | null;
  clarificationSv: string | null;

  // ── Anomalies ─────────────────────────────────────────────────
  anomalies: Array<{
    severity: "critical" | "high" | "medium";
    titleAr: string;
    titleSv: string;
    detailAr: string;
    detailSv: string;
  }>;

  // ── Decisions ─────────────────────────────────────────────────
  decisions: FlockDecision[];

  // ── Predictions ───────────────────────────────────────────────
  predictions: FlockPrediction[];

  // ── Narrative ─────────────────────────────────────────────────
  summaryAr: string;
  summarySv: string;

  // ── Auto-action flag ──────────────────────────────────────────
  autoSuggest: boolean;   // true when confidence >= 80
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SEMANTIC PARSER — Arabic NLP for flock notes
// ─────────────────────────────────────────────────────────────────────────────

const MORTALITY_PATTERNS = [
  { re: /(?:مات|نفق|هلك|وجد.*ميت|وجدنا.*ميت)\D*(\d+)/i,        label: "confirmed_death" },
  { re: /(\d+)\s*(?:دجاج|فرخ|طائر|حبة)\s*(?:مات|نفق|هلك|ميت)/i, label: "confirmed_death" },
  { re: /(?:وفاة|خسارة|نفوق)\s*(\d+)/i,                          label: "confirmed_death" },
  { re: /(?:مات|نفق|هلك)\s*(?:بعض|كثير|عدد)/i,                  label: "unknown_count_death" },
];

const HEALTH_BAD_PATTERNS = [
  { re: /لا\s*يأكل|رافض.*علف|يرفض.*أكل/i,       sub: "not_eating",         sev: "high"     as const },
  { re: /لا\s*يشرب|رافض.*ماء/i,                 sub: "not_drinking",       sev: "high"     as const },
  { re: /لا\s*يتحرك|لا\s*يقوم|خامل\s*جداً/i,   sub: "immobile",           sev: "critical" as const },
  { re: /مريض|مريضة|إصابة\s*بمرض/i,             sub: "sick",               sev: "high"     as const },
  { re: /مرض\s*منتشر|وباء|انتشار/i,             sub: "epidemic_risk",      sev: "critical" as const },
  { re: /إسهال|تقيؤ|قياء/i,                     sub: "gastrointestinal",   sev: "high"     as const },
  { re: /تنفس\s*صعب|صعوبة\s*تنفس|لهاث/i,       sub: "respiratory",        sev: "critical" as const },
  { re: /ضعيف|ضعيفة|خامل|خاملة/i,              sub: "lethargy",           sev: "medium"   as const },
  { re: /تعب|إجهاد|منهك/i,                      sub: "fatigue",            sev: "medium"   as const },
  { re: /ريش\s*(?:متساقط|سقط|ينزل)/i,          sub: "feather_loss",       sev: "medium"   as const },
  { re: /عيون\s*(?:مغمضة|متورمة|مريضة)/i,      sub: "eye_issue",          sev: "high"     as const },
  { re: /تورم|ورم/i,                            sub: "swelling",           sev: "high"     as const },
  { re: /لا\s*ينتج|توقف.*إنتاج|إنتاج.*صفر/i,  sub: "production_stop",    sev: "high"     as const },
];

const HEALTH_GOOD_PATTERNS = [
  { re: /نشيط|نشيطة|حيوي|حيوية/i,              sub: "active" },
  { re: /يأكل\s*بشهية|أكل\s*جيد|شهية\s*ممتازة/i, sub: "eating_well" },
  { re: /تحسّن|تحسن|أفضل|تعافى/i,             sub: "improving" },
  { re: /ممتاز|بصحة\s*جيدة|سليم/i,            sub: "excellent_health" },
  { re: /إنتاج\s*ممتاز|إنتاج\s*عالٍ/i,        sub: "high_production" },
];

const INTERVENTION_PATTERNS = [
  { re: /نظفت|تنظيف|عقّم|تعقيم/i,             sub: "cleaning",    sev: "positive" as const },
  { re: /علاج|دواء|أعطي.*دواء|وضعت.*دواء/i,   sub: "treatment",   sev: "positive" as const },
  { re: /تطعيم|لقاح|طعّم/i,                   sub: "vaccination",  sev: "positive" as const },
  { re: /فحص|كشف|فحصنا|بيطري/i,              sub: "examination",  sev: "positive" as const },
  { re: /عزل|فصل\s*القطيع|حجر\s*صحي/i,        sub: "isolation",   sev: "medium"   as const },
];

const ENV_PATTERNS = [
  { re: /حرارة\s*(?:عالية|شديدة|مرتفعة)|درجة\s*حرارة\s*عالية/i,  sub: "high_temp",       sev: "high" as const },
  { re: /حرارة\s*(?:منخفضة|باردة|شديدة\s*البرود)/i,               sub: "low_temp",        sev: "high" as const },
  { re: /تهوية\s*(?:سيئة|ضعيفة|معدومة)/i,                         sub: "poor_ventilation",sev: "high" as const },
  { re: /رطوبة\s*(?:عالية|زائدة)/i,                                sub: "high_humidity",   sev: "medium" as const },
  { re: /انقطاع\s*(?:كهرباء|تيار)|بدون\s*كهرباء/i,                sub: "power_outage",    sev: "critical" as const },
];

export function parseFlockNote(text: string): ParseResult {
  if (!text || text.trim().length < 3) {
    return {
      events: [], overallConfidence: 0, requiresClarification: true,
      clarificationAr: "النص قصير جداً — يرجى توضيح الحالة",
      clarificationSv: "Texten är för kort — beskriv tillståndet mer",
      summaryAr: "نص غير كافٍ للتحليل",
      summarySv: "Otillräcklig text för analys",
    };
  }

  const events: ParsedEvent[] = [];

  // ── Mortality ──────────────────────────────────────────────────────────────
  for (const { re, label } of MORTALITY_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const count = label === "unknown_count_death" ? null : parseInt(m[1] ?? m[2] ?? "0", 10);
      const isCritical = count == null || count >= 5;
      events.push({
        type: "mortality", subtype: label,
        value: count ?? "unknown",
        severity: isCritical ? "critical" : count! >= 2 ? "high" : "medium",
        signalAr: count ? `نفوق ${count} طائر` : "نفوق غير محدد العدد",
        signalSv: count ? `${count} fåglar döda` : "Okänt antal döda",
        confidence: count ? 0.9 : 0.6,
      });
      break;
    }
  }

  // ── Health — bad ───────────────────────────────────────────────────────────
  for (const { re, sub, sev } of HEALTH_BAD_PATTERNS) {
    if (re.test(text)) {
      const labels: Record<string, { ar: string; sv: string }> = {
        not_eating:       { ar: "رفض الأكل", sv: "Äter inte" },
        not_drinking:     { ar: "رفض الشرب", sv: "Dricker inte" },
        immobile:         { ar: "عدم الحركة (حرج)", sv: "Rörelseoförmåga (kritisk)" },
        sick:             { ar: "مرض ظاهر", sv: "Synlig sjukdom" },
        epidemic_risk:    { ar: "خطر وباء", sv: "Epideririsk" },
        gastrointestinal: { ar: "اضطراب هضمي", sv: "Mag-tarmproblem" },
        respiratory:      { ar: "صعوبة تنفس", sv: "Andningssvårigheter" },
        lethargy:         { ar: "خمول وضعف", sv: "Letargi och svaghet" },
        fatigue:          { ar: "إجهاد", sv: "Utmattning" },
        feather_loss:     { ar: "تساقط الريش", sv: "Fjädertapp" },
        eye_issue:        { ar: "مشكلة في العيون", sv: "Ögonproblem" },
        swelling:         { ar: "تورم", sv: "Svullnad" },
        production_stop:  { ar: "توقف الإنتاج", sv: "Produktionsstopp" },
      };
      const l = labels[sub] ?? { ar: sub, sv: sub };
      events.push({
        type: "health_change", subtype: sub, severity: sev,
        signalAr: l.ar, signalSv: l.sv, confidence: 0.85,
      });
    }
  }

  // ── Health — good ──────────────────────────────────────────────────────────
  for (const { re, sub } of HEALTH_GOOD_PATTERNS) {
    if (re.test(text)) {
      const labels: Record<string, { ar: string; sv: string }> = {
        active:           { ar: "نشاط ملحوظ", sv: "Märkbar aktivitet" },
        eating_well:      { ar: "شهية جيدة", sv: "God aptit" },
        improving:        { ar: "تحسّن في الحالة", sv: "Förbättring" },
        excellent_health: { ar: "حالة صحية ممتازة", sv: "Utmärkt hälsotillstånd" },
        high_production:  { ar: "إنتاج مرتفع", sv: "Hög produktion" },
      };
      const l = labels[sub] ?? { ar: sub, sv: sub };
      events.push({
        type: "observation", subtype: sub, severity: "positive",
        signalAr: l.ar, signalSv: l.sv, confidence: 0.8,
      });
    }
  }

  // ── Interventions ──────────────────────────────────────────────────────────
  for (const { re, sub, sev } of INTERVENTION_PATTERNS) {
    if (re.test(text)) {
      const labels: Record<string, { ar: string; sv: string }> = {
        cleaning:    { ar: "تنظيف وتعقيم", sv: "Rengöring och desinfektion" },
        treatment:   { ar: "علاج دوائي", sv: "Medicinsk behandling" },
        vaccination: { ar: "تطعيم", sv: "Vaccination" },
        examination: { ar: "فحص طبي", sv: "Veterinärundersökning" },
        isolation:   { ar: "عزل القطيع", sv: "Isolering av flock" },
      };
      const l = labels[sub] ?? { ar: sub, sv: sub };
      events.push({
        type: "intervention", subtype: sub, severity: sev,
        signalAr: l.ar, signalSv: l.sv, confidence: 0.9,
      });
    }
  }

  // ── Environment ───────────────────────────────────────────────────────────
  for (const { re, sub, sev } of ENV_PATTERNS) {
    if (re.test(text)) {
      const labels: Record<string, { ar: string; sv: string }> = {
        high_temp:         { ar: "ارتفاع درجة الحرارة", sv: "Hög temperatur" },
        low_temp:          { ar: "انخفاض درجة الحرارة", sv: "Låg temperatur" },
        poor_ventilation:  { ar: "تهوية ضعيفة", sv: "Dålig ventilation" },
        high_humidity:     { ar: "رطوبة مرتفعة", sv: "Hög luftfuktighet" },
        power_outage:      { ar: "انقطاع الكهرباء", sv: "Strömavbrott" },
      };
      const l = labels[sub] ?? { ar: sub, sv: sub };
      events.push({
        type: "environmental", subtype: sub, severity: sev,
        signalAr: l.ar, signalSv: l.sv, confidence: 0.85,
      });
    }
  }

  // ── Confidence ────────────────────────────────────────────────────────────
  const avgEventConf = events.length > 0
    ? events.reduce((s, e) => s + e.confidence, 0) / events.length
    : 0;

  const hasEnoughSignals = events.length >= 1;
  const overallConfidence = hasEnoughSignals ? Math.min(0.95, avgEventConf) : 0.2;

  // ── Clarification ─────────────────────────────────────────────────────────
  let requiresClarification = false;
  let clarificationAr: string | null = null;
  let clarificationSv: string | null = null;

  if (overallConfidence < 0.6 && events.length === 0) {
    requiresClarification = true;
    clarificationAr = "لم أتمكن من فهم الحالة — هل يمكنك توضيح: عدد الطيور المتضررة، وطبيعة المشكلة؟";
    clarificationSv = "Jag förstod inte tillståndet — kan du klargöra: antal drabbade fåglar och problemets natur?";
  } else if (events.some(e => e.subtype === "unknown_count_death")) {
    requiresClarification = true;
    clarificationAr = "كم عدد الطيور التي نفقت بالتحديد؟";
    clarificationSv = "Hur många fåglar dog exakt?";
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const criticals = events.filter(e => e.severity === "critical");
  const highs     = events.filter(e => e.severity === "high");
  const positives = events.filter(e => e.severity === "positive");

  let summaryAr = "";
  let summarySv = "";

  if (criticals.length > 0) {
    summaryAr = `⚠️ حالة حرجة: ${criticals.map(e => e.signalAr).join("، ")}`;
    summarySv = `⚠️ Kritiskt tillstånd: ${criticals.map(e => e.signalSv).join(", ")}`;
  } else if (highs.length > 0) {
    summaryAr = `تحذير: ${highs.map(e => e.signalAr).join("، ")}`;
    summarySv = `Varning: ${highs.map(e => e.signalSv).join(", ")}`;
  } else if (positives.length > 0 && events.length === positives.length) {
    summaryAr = `✅ وضع إيجابي: ${positives.map(e => e.signalAr).join("، ")}`;
    summarySv = `✅ Positivt läge: ${positives.map(e => e.signalSv).join(", ")}`;
  } else if (events.length > 0) {
    summaryAr = `تم رصد ${events.length} إشارة(ت)`;
    summarySv = `${events.length} signal(er) registrerade`;
  } else {
    summaryAr = "لم يُرصد شيء محدد";
    summarySv = "Inget specifikt registrerat";
  }

  return { events, overallConfidence, requiresClarification, clarificationAr, clarificationSv, summaryAr, summarySv };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CONFIDENCE ENGINE — data coverage scoring
// ─────────────────────────────────────────────────────────────────────────────

function computeDataConfidence(
  prodLogs: ProductionSnapshot[],
  healthLogs: HealthSnapshot[],
  flock: FlockData,
): { confidence: number; dataQuality: "excellent" | "good" | "limited" | "none" } {
  const daysOfProd = prodLogs.length;
  const daysOfHealth = healthLogs.length;

  // Recency — how fresh is the latest production log?
  const latestProd = prodLogs[0]?.date;
  const daysSinceLastProd = latestProd
    ? Math.floor((Date.now() - new Date(latestProd).getTime()) / 86_400_000)
    : 999;

  let score = 0;
  score += Math.min(daysOfProd / 7, 1) * 40;         // up to 40 pts: 7+ days of prod data
  score += Math.min(daysOfHealth / 3, 1) * 20;        // up to 20 pts: 3+ health events
  score += flock.feedConsumptionKg != null ? 15 : 0;   // 15 pts: feed recorded
  score += daysSinceLastProd <= 1 ? 15 : daysSinceLastProd <= 3 ? 8 : 0;  // recency
  score += flock.notes && flock.notes.length > 10 ? 10 : 0; // notes present

  const confidence = Math.round(Math.min(score, 100));
  const dataQuality: "excellent" | "good" | "limited" | "none" =
    confidence >= 80 ? "excellent"
    : confidence >= 55 ? "good"
    : confidence >= 25 ? "limited"
    : "none";

  return { confidence, dataQuality };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. HEALTH ENGINE — scoring
// ─────────────────────────────────────────────────────────────────────────────

function computeScores(
  flock: FlockData,
  prodLogs: ProductionSnapshot[],
  healthLogs: HealthSnapshot[],
  mortalityLast7d: number,
): { healthScore: number; riskScore: number; performanceIndex: number } {
  const mortalityRate = flock.count > 0 ? mortalityLast7d / flock.count : 0;

  // ── Health Score (higher = better) ──────────────────────────────────────
  let healthScore = 100;

  if (flock.healthStatus === "sick")       healthScore -= 35;
  else if (flock.healthStatus === "quarantine") healthScore -= 25;
  else if (flock.healthStatus === "recovering") healthScore -= 12;
  else if (flock.healthStatus === "treated")    healthScore -= 5;

  if (mortalityRate > 0.05)       healthScore -= 40;
  else if (mortalityRate > 0.02)  healthScore -= 25;
  else if (mortalityRate > 0.005) healthScore -= 10;
  else if (mortalityRate > 0)     healthScore -= 5;

  // Recent sick health logs
  const recentSick = healthLogs.slice(0, 5).filter(h => ["sick", "quarantine"].includes(h.status)).length;
  healthScore -= recentSick * 5;

  healthScore = Math.max(0, Math.min(100, healthScore));

  // ── Risk Score (higher = more dangerous) ─────────────────────────────────
  let riskScore = 0;

  if (flock.healthStatus === "sick")       riskScore += 35;
  else if (flock.healthStatus === "quarantine") riskScore += 30;
  else if (flock.healthStatus === "recovering") riskScore += 15;

  if (mortalityRate > 0.05)       riskScore += 40;
  else if (mortalityRate > 0.02)  riskScore += 25;
  else if (mortalityRate > 0.005) riskScore += 12;
  else if (mortalityRate > 0)     riskScore += 6;

  // No production data in 3 days → risk flag for egg-type
  if (flock.purpose === "eggs" || flock.purpose === "mixed") {
    const latestProd = prodLogs[0]?.date;
    const daysSinceProd = latestProd
      ? Math.floor((Date.now() - new Date(latestProd).getTime()) / 86_400_000)
      : 999;
    if (daysSinceProd >= 3) riskScore += 15;
  }

  // Age risk (very old flocks are higher risk)
  if (flock.ageDays > 700)       riskScore += 10;
  else if (flock.ageDays > 500)  riskScore += 5;

  riskScore = Math.max(0, Math.min(100, riskScore));

  // ── Performance Index ─────────────────────────────────────────────────────
  let performanceIndex = 50;  // baseline

  if (flock.purpose === "eggs" || flock.purpose === "mixed") {
    const avgProd7d = prodLogs.slice(0, 7).reduce((s, l) => s + l.eggCount, 0) / Math.max(prodLogs.length, 1);
    const target = flock.dailyEggTarget ?? (flock.count * 0.7);
    const prodRate = target > 0 ? Math.min(avgProd7d / target, 1.2) : 0.5;
    performanceIndex = Math.round(prodRate * 80) + (flock.healthStatus === "healthy" ? 20 : 0);
  } else if (flock.purpose === "meat") {
    // For meat flocks: survival rate is the main metric
    const survivalRate = flock.count > 0 ? Math.max(0, 1 - mortalityRate * 4) : 0;
    performanceIndex = Math.round(survivalRate * 100);
  } else {
    performanceIndex = healthScore;
  }

  performanceIndex = Math.max(0, Math.min(100, performanceIndex));

  return { healthScore, riskScore, performanceIndex };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ANOMALY ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function detectAnomalies(
  flock: FlockData,
  prodLogs: ProductionSnapshot[],
  healthLogs: HealthSnapshot[],
  mortalityLast7d: number,
) {
  const anomalies: FlockIntelligenceResult["anomalies"] = [];

  // ── Mortality spike ────────────────────────────────────────────────────────
  const mortalityRate = flock.count > 0 ? mortalityLast7d / flock.count : 0;
  if (mortalityRate > 0.05) {
    anomalies.push({
      severity: "critical",
      titleAr: "نسبة نفوق خطيرة",
      titleSv: "Kritisk dödlighet",
      detailAr: `${(mortalityRate * 100).toFixed(1)}% من القطيع — يتجاوز الحد الآمن (5%) بكثير`,
      detailSv: `${(mortalityRate * 100).toFixed(1)}% av flocken — överstiger säkerhetsgränsen (5%) kraftigt`,
    });
  } else if (mortalityRate > 0.02) {
    anomalies.push({
      severity: "high",
      titleAr: "ارتفاع معدل النفوق",
      titleSv: "Förhöjd dödlighet",
      detailAr: `${(mortalityRate * 100).toFixed(1)}% من القطيع — يتجاوز المعدل الطبيعي (2%)`,
      detailSv: `${(mortalityRate * 100).toFixed(1)}% av flocken — överstiger normalnivån (2%)`,
    });
  }

  // ── Production drop anomaly ────────────────────────────────────────────────
  if ((flock.purpose === "eggs" || flock.purpose === "mixed") && prodLogs.length >= 4) {
    const recent2 = prodLogs.slice(0, 2).reduce((s, l) => s + l.eggCount, 0) / 2;
    const older5  = prodLogs.slice(2, 7).reduce((s, l) => s + l.eggCount, 0) / Math.max(prodLogs.slice(2, 7).length, 1);
    if (older5 > 0 && recent2 / older5 < 0.6) {
      anomalies.push({
        severity: "high",
        titleAr: "هبوط حاد في الإنتاج",
        titleSv: "Kraftigt produktionsfall",
        detailAr: `الإنتاج انخفض بنسبة ${Math.round((1 - recent2 / older5) * 100)}% مقارنة بالمتوسط السابق`,
        detailSv: `Produktionen minskade med ${Math.round((1 - recent2 / older5) * 100)}% jämfört med tidigare genomsnitt`,
      });
    }
  }

  // ── Status worsening ──────────────────────────────────────────────────────
  if (flock.healthStatus === "sick" || flock.healthStatus === "quarantine") {
    const recentHealthChanges = healthLogs.slice(0, 3).filter(h => ["sick", "quarantine"].includes(h.status));
    if (recentHealthChanges.length >= 2) {
      anomalies.push({
        severity: "critical",
        titleAr: "تدهور صحي متكرر",
        titleSv: "Återkommande hälsoförsämring",
        detailAr: "تم تسجيل أحداث مرضية متعددة مؤخراً — الحالة في تدهور مستمر",
        detailSv: "Flera sjukdomshändelser registrerade nyligen — tillståndet försämras kontinuerligt",
      });
    }
  }

  // ── No production data gap ─────────────────────────────────────────────────
  if ((flock.purpose === "eggs" || flock.purpose === "mixed") && prodLogs.length === 0) {
    anomalies.push({
      severity: "medium",
      titleAr: "لا توجد بيانات إنتاج",
      titleSv: "Inga produktionsdata",
      detailAr: "لم يُسجَّل أي إنتاج — يتعذر تقييم الأداء",
      detailSv: "Ingen produktion registrerad — prestanda kan inte bedömas",
    });
  }

  return anomalies;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. DECISION ENGINE — prioritised actionable decisions
// ─────────────────────────────────────────────────────────────────────────────

function generateDecisions(
  flock: FlockData,
  anomalies: FlockIntelligenceResult["anomalies"],
  healthScore: number,
  riskScore: number,
  mortalityLast7d: number,
  prodLogs: ProductionSnapshot[],
): FlockDecision[] {
  const decisions: FlockDecision[] = [];

  // Critical: high mortality
  if (mortalityLast7d > 0 && flock.count > 0 && mortalityLast7d / flock.count > 0.02) {
    decisions.push({
      priority: 1, urgency: "now",
      titleAr: "نفوق مرتفع — تحقيق فوري",
      titleSv: "Hög dödlighet — omedelbar utredning",
      actionAr: "١. افحص درجة الحرارة والتهوية فوراً\n٢. افصل الطيور الضعيفة والمريضة\n٣. افحص جودة العلف والماء\n٤. اتصل بالطبيب البيطري إذا تجاوز النفوق 5%",
      actionSv: "1. Kontrollera temperatur och ventilation omedelbart\n2. Isolera svaga och sjuka fåglar\n3. Kontrollera foderkvalitet och vatten\n4. Kontakta veterinär om dödligheten överstiger 5%",
      reasonAr: `${mortalityLast7d} طائر نفق خلال 7 أيام (${((mortalityLast7d / flock.count) * 100).toFixed(1)}%)`,
      reasonSv: `${mortalityLast7d} fåglar döda under 7 dagar (${((mortalityLast7d / flock.count) * 100).toFixed(1)}%)`,
      confidence: 90,
    });
  }

  // Critical: sick/quarantine status
  if (flock.healthStatus === "sick" || flock.healthStatus === "quarantine") {
    decisions.push({
      priority: 1, urgency: "now",
      titleAr: "القطيع مريض — تدخل فوري",
      titleSv: "Flocken är sjuk — omedelbar åtgärd",
      actionAr: "١. عزل القطيع المريض عن الأصحاء\n٢. وثّق الأعراض بالتفصيل\n٣. أعطِ الأدوية والإماهة\n٤. استشر طبيباً بيطرياً",
      actionSv: "1. Isolera sjuka från friska fåglar\n2. Dokumentera symptom i detalj\n3. Ge medicin och vätskeersättning\n4. Konsultera veterinär",
      reasonAr: `الحالة الصحية: ${flock.healthStatus}`,
      reasonSv: `Hälsostatus: ${flock.healthStatus}`,
      confidence: 95,
    });
  }

  // High: production anomaly
  const prodAnomalies = anomalies.filter(a => a.titleAr.includes("إنتاج") && a.severity !== "medium");
  if (prodAnomalies.length > 0) {
    decisions.push({
      priority: 2, urgency: "today",
      titleAr: "مراجعة إنتاج البيض",
      titleSv: "Granska äggproduktionen",
      actionAr: "١. قارن الإنتاج بالهدف اليومي\n٢. تحقق من كمية العلف وجودته\n٣. تحقق من الإضاءة والإجهاد الحراري\n٤. راجع سجل الصحة الأخير",
      actionSv: "1. Jämför produktion med dagligt mål\n2. Kontrollera fodermängd och kvalitet\n3. Kontrollera belysning och värmestress\n4. Granska senaste hälsoregistret",
      reasonAr: "انخفاض ملحوظ في معدل إنتاج البيض",
      reasonSv: "Märkbar minskning av äggproduktionen",
      confidence: 80,
    });
  }

  // Medium: health < 60
  if (healthScore < 60 && decisions.filter(d => d.priority === 1).length === 0) {
    decisions.push({
      priority: 2, urgency: "today",
      titleAr: "مراقبة صحية مكثفة",
      titleSv: "Intensiv hälsoövervakning",
      actionAr: "١. راقب الأعراض كل 4 ساعات\n٢. وثّق أي تغيير في السلوك\n٣. حافظ على نظافة المكان\n٤. تأكد من تناسب درجة الحرارة",
      actionSv: "1. Övervaka symptom var 4:e timme\n2. Dokumentera beteendeförändringar\n3. Håll platsen ren\n4. Säkerställ lämplig temperatur",
      reasonAr: `الدرجة الصحية منخفضة: ${healthScore}/100`,
      reasonSv: `Lågt hälsobetyg: ${healthScore}/100`,
      confidence: 75,
    });
  }

  // General monitoring
  decisions.push({
    priority: 3, urgency: "this_week",
    titleAr: "مراجعة دورية اعتيادية",
    titleSv: "Rutinmässig periodisk granskning",
    actionAr: "١. راجع كميات العلف اليومية\n٢. وثّق الإنتاج يومياً\n٣. افحص نظام تصريف المياه\n٤. خطط للتطعيم الدوري",
    actionSv: "1. Granska dagliga fodermängder\n2. Dokumentera produktion dagligen\n3. Kontrollera dräneringssystemet\n4. Planera regelbunden vaccination",
    reasonAr: "صيانة وقائية دورية",
    reasonSv: "Förebyggande rutinunderhåll",
    confidence: 100,
  });

  return decisions;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. PREDICTIVE ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function generatePredictions(
  flock: FlockData,
  prodLogs: ProductionSnapshot[],
  healthLogs: HealthSnapshot[],
  mortalityLast7d: number,
): FlockPrediction[] {
  const predictions: FlockPrediction[] = [];

  const mortalityRate = flock.count > 0 ? mortalityLast7d / flock.count : 0;

  // ── Mortality risk ────────────────────────────────────────────────────────
  if (mortalityRate > 0.01 || flock.healthStatus === "sick") {
    const prob = Math.min(95, Math.round(
      (mortalityRate > 0 ? 40 : 0) +
      (flock.healthStatus === "sick" ? 35 : flock.healthStatus === "quarantine" ? 25 : 0) +
      (healthLogs.slice(0, 3).filter(h => h.status === "sick").length * 10)
    ));
    predictions.push({
      type: "mortality_risk",
      probabilityPct: prob,
      horizon: mortalityRate > 0.03 ? "24h" : "48h",
      descriptionAr: `⚠️ بناءً على النمط الحالي، قد يرتفع النفوق خلال ${mortalityRate > 0.03 ? "24 ساعة" : "48 ساعة"}`,
      descriptionSv: `⚠️ Baserat på nuvarande mönster kan dödligheten öka inom ${mortalityRate > 0.03 ? "24 timmar" : "48 timmar"}`,
      preventionAr: "عزل القطيع + مراقبة مكثفة + استشارة طبيب بيطري",
      preventionSv: "Isolera flocken + intensiv övervakning + kontakta veterinär",
    });
  }

  // ── Production decline ────────────────────────────────────────────────────
  if ((flock.purpose === "eggs" || flock.purpose === "mixed") && prodLogs.length >= 5) {
    const recent3 = prodLogs.slice(0, 3).reduce((s, l) => s + l.eggCount, 0) / 3;
    const prev3   = prodLogs.slice(3, 6).reduce((s, l) => s + l.eggCount, 0) / Math.max(prodLogs.slice(3, 6).length, 1);
    const trend = prev3 > 0 ? (recent3 - prev3) / prev3 : 0;
    if (trend < -0.15) {
      const prob = Math.min(85, Math.round(Math.abs(trend) * 200));
      predictions.push({
        type: "production_decline",
        probabilityPct: prob,
        horizon: "7d",
        descriptionAr: `📉 الإنتاج يتراجع — إذا استمر الاتجاه سيصل إلى ${Math.round(recent3 * (1 + trend * 3))} بيضة/يوم خلال أسبوع`,
        descriptionSv: `📉 Produktionen minskar — om trenden fortsätter når den ${Math.round(recent3 * (1 + trend * 3))} ägg/dag inom en vecka`,
        preventionAr: "مراجعة العلف + إضاءة إضافية + فحص الضغط على القطيع",
        preventionSv: "Granska foder + extra belysning + kontrollera stressnivå",
      });
    }
  }

  return predictions;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. TIMELINE MANAGER — persist events to DB
// ─────────────────────────────────────────────────────────────────────────────

export async function saveFlockEvent(
  flockId: number,
  eventType: string,
  subtype: string,
  severity: string,
  payload: Record<string, unknown>,
  confidence: number,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO flock_events (flock_id, event_type, subtype, severity, payload, confidence)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [flockId, eventType, subtype, severity, JSON.stringify(payload), Math.round(confidence * 100)]
    );
  } catch (err) {
    logger.error({ err }, "Failed to save flock event");
  } finally {
    client.release();
  }
}

export async function getFlockTimeline(flockId: number, limit = 30): Promise<unknown[]> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, event_type, subtype, severity, payload, confidence, created_at
       FROM flock_events WHERE flock_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [flockId, limit]
    );
    return rows;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ORCHESTRATOR — run full intelligence analysis for a flock
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeFlockIntelligence(flockId: number): Promise<FlockIntelligenceResult> {
  const client = await pool.connect();
  try {
    // Load flock
    const { rows: flockRows } = await client.query(
      `SELECT id, name, breed, count, age_days, purpose, health_status,
              feed_consumption_kg, daily_egg_target, notes, created_at
       FROM flocks WHERE id = $1`,
      [flockId]
    );
    if (flockRows.length === 0) throw new Error(`Flock ${flockId} not found`);

    const row = flockRows[0];
    const flock: FlockData = {
      id: row.id, name: row.name, breed: row.breed, count: row.count,
      ageDays: row.age_days, purpose: row.purpose, healthStatus: row.health_status,
      feedConsumptionKg: row.feed_consumption_kg ? Number(row.feed_consumption_kg) : null,
      dailyEggTarget: row.daily_egg_target,
      notes: row.notes, createdAt: row.created_at,
    };

    // Load production logs (last 14 days)
    const { rows: prodRows } = await client.query(
      `SELECT date, egg_count FROM flock_production_logs
       WHERE flock_id = $1 ORDER BY date DESC LIMIT 14`,
      [flockId]
    );
    const prodLogs: ProductionSnapshot[] = prodRows.map(r => ({ date: r.date, eggCount: r.egg_count }));

    // Load health logs (last 10)
    const { rows: healthRows } = await client.query(
      `SELECT date, status, symptoms, treatment, notes FROM flock_health_logs
       WHERE flock_id = $1 ORDER BY date DESC LIMIT 10`,
      [flockId]
    );
    const healthLogs: HealthSnapshot[] = healthRows.map(r => ({
      date: r.date, status: r.status,
      symptoms: r.symptoms, treatment: r.treatment, notes: r.notes,
    }));

    // Load mortality from health logs (sum of "dead" type events in flock_events)
    const { rows: mortalityRows } = await client.query(
      `SELECT COALESCE(SUM((payload->>'value')::int), 0) as total
       FROM flock_events
       WHERE flock_id = $1
         AND event_type = 'mortality'
         AND subtype = 'confirmed_death'
         AND created_at >= NOW() - INTERVAL '7 days'`,
      [flockId]
    );
    const mortalityLast7d = parseInt(mortalityRows[0]?.total ?? "0", 10);

    // ── Run all engines ────────────────────────────────────────────────────
    const { confidence: dataConf, dataQuality } = computeDataConfidence(prodLogs, healthLogs, flock);
    const { healthScore, riskScore, performanceIndex } = computeScores(flock, prodLogs, healthLogs, mortalityLast7d);
    const anomalies = detectAnomalies(flock, prodLogs, healthLogs, mortalityLast7d);
    const decisions = generateDecisions(flock, anomalies, healthScore, riskScore, mortalityLast7d, prodLogs);
    const predictions = generatePredictions(flock, prodLogs, healthLogs, mortalityLast7d);

    // ── Confidence threshold behavior ──────────────────────────────────────
    const requiresClarification = dataConf < 60;
    let clarificationAr: string | null = null;
    let clarificationSv: string | null = null;

    if (requiresClarification) {
      if (prodLogs.length === 0 && (flock.purpose === "eggs" || flock.purpose === "mixed")) {
        clarificationAr = "لا توجد سجلات إنتاج — هل القطيع يبيض؟ يرجى تسجيل إنتاج اليوم";
        clarificationSv = "Inga produktionsloggar — lägger flocken ägg? Registrera dagens produktion";
      } else if (healthLogs.length === 0) {
        clarificationAr = "لا توجد سجلات صحية — ما الحالة الصحية الحالية للقطيع بشكل تفصيلي؟";
        clarificationSv = "Inga hälsologgar — beskriv flockens nuvarande hälsotillstånd i detalj";
      } else {
        clarificationAr = "البيانات محدودة — يرجى تحديث سجلات الإنتاج والصحة للحصول على تحليل أدق";
        clarificationSv = "Begränsade data — uppdatera produktions- och hälsologgar för mer exakt analys";
      }
    }

    // ── Auto-suggest flag ──────────────────────────────────────────────────
    const autoSuggest = dataConf >= 80;

    // ── Narrative summary ──────────────────────────────────────────────────
    const statusLabel = healthScore >= 80 ? { ar: "ممتازة", sv: "utmärkt" }
                       : healthScore >= 60 ? { ar: "جيدة", sv: "bra" }
                       : healthScore >= 40 ? { ar: "متوسطة", sv: "medelmåttig" }
                       : { ar: "ضعيفة", sv: "dålig" };

    const summaryAr = `القطيع "${flock.name}" — الحالة الصحية ${statusLabel.ar} (${healthScore}/100)` +
      (riskScore >= 50 ? ` · خطر مرتفع (${riskScore}/100)` : "") +
      (anomalies.length > 0 ? ` · ${anomalies.length} تشوه(ات) مرصود(ة)` : "");

    const summarySv = `Flock "${flock.name}" — hälsotillstånd ${statusLabel.sv} (${healthScore}/100)` +
      (riskScore >= 50 ? ` · Hög risk (${riskScore}/100)` : "") +
      (anomalies.length > 0 ? ` · ${anomalies.length} anomali(er) registrerade` : "");

    // ── Persist scores to flocks table ────────────────────────────────────
    await client.query(
      `UPDATE flocks SET
         health_score = $1, risk_score = $2, performance_index = $3, last_analyzed_at = NOW()
       WHERE id = $4`,
      [healthScore, riskScore, performanceIndex, flockId]
    );

    // ── Log this analysis event ───────────────────────────────────────────
    await client.query(
      `INSERT INTO flock_events (flock_id, event_type, subtype, severity, payload, confidence)
       VALUES ($1, 'analysis', 'full_intelligence', $2, $3, $4)`,
      [
        flockId,
        riskScore >= 70 ? "critical" : riskScore >= 40 ? "high" : "low",
        JSON.stringify({ healthScore, riskScore, performanceIndex, anomalyCount: anomalies.length }),
        dataConf,
      ]
    );

    return {
      flockId, flockName: flock.name,
      generatedAt: new Date().toISOString(),
      healthScore, riskScore, performanceIndex, dataQuality,
      confidence: dataConf,
      requiresClarification, clarificationAr, clarificationSv,
      anomalies, decisions, predictions,
      summaryAr, summarySv,
      autoSuggest,
    };

  } finally {
    client.release();
  }
}
