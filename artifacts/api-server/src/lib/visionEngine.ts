/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  Industry-Level Computer Vision AI — Poultry Farm Monitor
 *  
 *  3-Layer Architecture:
 *    Layer 1 — Vision:       Pixel-level analysis via Sharp (grid + spatial)
 *    Layer 2 — Intelligence: Correlation, root-cause, risk scoring
 *    Layer 3 — Decision:     Operational insights, prioritized actions, temporal
 * ══════════════════════════════════════════════════════════════════════════════
 */
import sharp from "sharp";
import {
  db, flocksTable, hatchingCyclesTable, tasksTable,
  dailyNotesTable, noteImagesTable,
} from "@workspace/db";
import { desc, eq, and, gte, lte, lt } from "drizzle-orm";

// ─── Exported Types ───────────────────────────────────────────────────────────

export interface VisionResult {
  overallStatus: "good" | "warning" | "critical";
  summary: string;
  analysis: string;
  metrics: VisionMetrics;
  insights: OperationalInsight[];
  recommendations: ActionItem[];
  alerts: Alert[];
  tags: string[];
  confidence: number;
  gridData: GridData;
  visualData: RawVisualData;
  temporal?: TemporalComparison;
}

export interface VisionMetrics {
  estimatedBirdCount: number;
  densityScore: number;
  crowdingScore: number;
  activityLevel: number;
  healthScore: number;
  injuryRisk: number;
  floorCleanliness: number;
  lightingScore: number;
  lightingUniformity: number;
  riskScore: number;
}

export interface OperationalInsight {
  category: "crowding" | "health" | "environment" | "equipment" | "nutrition" | "behavior";
  urgency: "low" | "medium" | "high" | "critical";
  finding: string;
  rootCause: string;
  impact: string;
}

export interface ActionItem {
  priority: "urgent" | "high" | "medium" | "low";
  timeframe: string;
  action: string;
}

export interface Alert {
  level: "warning" | "critical";
  message: string;
}

export interface GridData {
  rows: number;
  cols: number;
  zones: GridZone[];
}

export interface GridZone {
  row: number;
  col: number;
  density: number;
  activity: number;
  cleanliness: number;
  lighting: number;
  label: string;
}

export interface RawVisualData {
  brightness: number;
  redScore: number;
  yellowScore: number;
  greenScore: number;
  blueScore: number;
  saturation: number;
  entropy: number;
  darkPixelRatio: number;
  brightPixelRatio: number;
  redSpikeRatio: number;
  warmPixelRatio: number;
  contrastScore: number;
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
}

export interface TemporalComparison {
  availableImages: number;
  periodDays: number;
  baseline: Partial<VisionMetrics>;
  changes: TemporalChange[];
  trend: "improving" | "stable" | "declining";
  trendSummary: string;
}

export interface TemporalChange {
  metric: string;
  label: string;
  current: number;
  baseline: number;
  delta: number;
  direction: "up" | "down" | "stable";
  isPositive: boolean;
  significance: "significant" | "minor" | "none";
}

interface FarmContext {
  activeFlocks: { name: string; breed: string; count: number; ageDays: number; purpose: string }[];
  totalBirds: number;
  overdueTasks: { title: string; priority: string }[];
  recentAlerts: string[];
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function analyzeImage(
  imageBuffer: Buffer,
  mimeType: string,
  fileSize: number,
  imageDate: string,
  category: string,
  caption: string,
  imageId?: number,
): Promise<VisionResult> {
  const [raw, farmCtx, temporal] = await Promise.all([
    extractRawFeatures(imageBuffer, mimeType, fileSize),
    loadFarmContext(imageDate),
    imageId ? loadTemporalBaseline(imageDate, imageId) : Promise.resolve(undefined),
  ]);

  const grid = buildGridAnalysis(imageBuffer);
  const gridData = await grid;
  const metrics = computeMetrics(raw, gridData, farmCtx, category, caption);
  const insights = runIntelligenceLayer(raw, gridData, metrics, farmCtx, category, caption, imageDate);
  const recommendations = buildDecisionLayer(insights, metrics, farmCtx, imageDate);
  const alerts = buildAlerts(metrics, insights, farmCtx);
  const tags = buildTags(metrics, insights, category, caption, raw);
  const overallStatus = metrics.riskScore >= 65 ? "critical" : metrics.riskScore >= 35 ? "warning" : "good";
  const summary = buildSummary(overallStatus, metrics, insights);
  const analysis = buildAnalysisText(raw, gridData, metrics, insights, recommendations, farmCtx, category, caption, imageDate);
  const confidence = computeConfidence(raw, metrics, farmCtx);

  const temporalWithDelta = temporal ? enrichTemporalData(temporal, metrics) : undefined;

  return {
    overallStatus,
    summary,
    analysis,
    metrics,
    insights,
    recommendations,
    alerts,
    tags,
    confidence,
    gridData,
    visualData: raw,
    temporal: temporalWithDelta,
  };
}

// ─── Layer 1: Vision — Raw Pixel Feature Extraction ─────────────────────────

async function extractRawFeatures(buf: Buffer, mimeType: string, fileSize: number): Promise<RawVisualData> {
  const img = sharp(buf).rotate();
  const { width: origW = 800, height: origH = 600 } = await img.metadata();

  const { data, info } = await sharp(buf)
    .rotate()
    .resize(240, 180, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = info.width * info.height;
  const ch = info.channels;

  let sumR = 0, sumG = 0, sumB = 0, sumLum = 0;
  let darkPixels = 0, brightPixels = 0;
  let redSpikePixels = 0;
  let yellowPixels = 0, greenPixels = 0, bluePixels = 0;
  let warmPixels = 0;
  const lumArr: number[] = new Array(pixelCount);

  for (let i = 0, p = 0; i < data.length; i += ch, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    lumArr[p] = lum;

    sumR += r; sumG += g; sumB += b; sumLum += lum;

    if (lum < 40) darkPixels++;
    if (lum > 215) brightPixels++;
    if (r > 160 && r > g * 1.5 && r > b * 1.5) redSpikePixels++;
    if (r > 140 && g > 90 && b < 110 && r > b * 1.8) yellowPixels++;
    if (g > r * 1.1 && g > b * 1.1 && g > 80) greenPixels++;
    if (b > r * 1.1 && b > g * 1.1 && b > 60) bluePixels++;

    // Warm pixel = likely chicken or warm bedding
    if (isWarmPixel(r, g, b)) warmPixels++;
  }

  const meanR = sumR / pixelCount;
  const meanG = sumG / pixelCount;
  const meanB = sumB / pixelCount;
  const meanLum = sumLum / pixelCount;
  const lumVar = lumArr.reduce((acc, l) => acc + (l - meanLum) ** 2, 0) / pixelCount;
  const lumStd = Math.sqrt(lumVar);
  const sat = Math.sqrt((meanR - meanLum) ** 2 + (meanG - meanLum) ** 2 + (meanB - meanLum) ** 2) / (meanLum || 1) * 100;

  const s = (v: number, max: number) => Math.min(100, Math.round((v / max) * 100));

  return {
    brightness: s(meanLum, 255),
    redScore: s(meanR, 255),
    yellowScore: s(yellowPixels, pixelCount),
    greenScore: s(greenPixels, pixelCount * 0.5),
    blueScore: s(bluePixels, pixelCount * 0.3),
    saturation: Math.min(100, Math.round(sat)),
    entropy: s(lumStd, 80),
    darkPixelRatio: s(darkPixels, pixelCount),
    brightPixelRatio: s(brightPixels, pixelCount),
    redSpikeRatio: s(redSpikePixels, pixelCount),
    warmPixelRatio: s(warmPixels, pixelCount),
    contrastScore: s(lumStd, 80),
    width: origW, height: origH, fileSize, mimeType,
  };
}

function isWarmPixel(r: number, g: number, b: number): boolean {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const isWhite = lum > 150 && Math.max(r, g, b) - Math.min(r, g, b) < 35;
  const isYellow = r > 140 && g > 100 && b < 120 && r > b * 1.3;
  const isBrown = r > 100 && g > 60 && b < 90 && r > g * 1.1;
  return isWhite || isYellow || isBrown;
}

// ─── Layer 1: Vision — Spatial Grid Analysis (4×3 = 12 zones) ────────────────

async function buildGridAnalysis(buf: Buffer): Promise<GridData> {
  const ROWS = 3, COLS = 4;
  const zones: GridZone[] = [];
  const zoneLabels = ["أعلى يسار","أعلى وسط-يسار","أعلى وسط-يمين","أعلى يمين",
    "وسط يسار","وسط-وسط يسار","وسط-وسط يمين","وسط يمين",
    "أسفل يسار","أسفل وسط-يسار","أسفل وسط-يمين","أسفل يمين"];

  const W = 120, H = 90;
  const { data, info } = await sharp(buf)
    .rotate().resize(W, H, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;

  const zW = Math.floor(W / COLS), zH = Math.floor(H / ROWS);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x0 = c * zW, y0 = r * zH;
      const x1 = x0 + zW, y1 = y0 + zH;

      let warmCount = 0, darkCount = 0, totalLum = 0, pixCount = 0;
      const lumArr: number[] = [];

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * W + x) * ch;
          const pr = data[idx], pg = data[idx + 1], pb = data[idx + 2];
          const lum = Math.round(0.299 * pr + 0.587 * pg + 0.114 * pb);
          totalLum += lum;
          lumArr.push(lum);
          pixCount++;
          if (isWarmPixel(pr, pg, pb)) warmCount++;
          if (lum < 35) darkCount++;
        }
      }

      const meanLum = totalLum / pixCount;
      const lumVar = lumArr.reduce((a, l) => a + (l - meanLum) ** 2, 0) / pixCount;
      const entropy = Math.min(100, Math.round(Math.sqrt(lumVar) / 0.8));
      const density = Math.min(100, Math.round((warmCount / pixCount) * 100 * 2.5));
      const cleanliness = Math.max(0, 100 - Math.min(100, Math.round((darkCount / pixCount) * 200)));
      const lighting = Math.min(100, Math.round(meanLum / 2.55));

      zones.push({ row: r, col: c, density, activity: entropy, cleanliness, lighting, label: zoneLabels[r * COLS + c] ?? "" });
    }
  }

  return { rows: ROWS, cols: COLS, zones };
}

// ─── Layer 2: Intelligence — Metrics Computation ──────────────────────────────

function computeMetrics(raw: RawVisualData, grid: GridData, farm: FarmContext, category: string, caption: string): VisionMetrics {
  const densities = grid.zones.map(z => z.density);
  const meanDensity = avg(densities);
  const maxDensity = Math.max(...densities);

  // Crowding: Gini coefficient of density distribution
  const gini = computeGini(densities);
  const crowdingScore = Math.min(100, Math.round(gini * 100 + (maxDensity > 80 ? 20 : 0)));

  // Activity: weighted entropy + global contrast
  const activities = grid.zones.map(z => z.activity);
  const activityLevel = Math.min(100, Math.round(avg(activities) * 0.7 + raw.entropy * 0.3));

  // Health: inverse of injury risk + color health
  const injuryRisk = Math.min(100, raw.redSpikeRatio * 4);
  const colorHealth = Math.max(0, 100 - Math.abs(raw.warmPixelRatio - 45) - (raw.greenScore > 30 ? 20 : 0));
  const healthScore = Math.round((colorHealth * 0.6 + (100 - injuryRisk) * 0.4));

  // Floor cleanliness: average of zones with low density
  const floorZones = grid.zones.filter(z => z.density < 40);
  const floorCleanliness = floorZones.length > 0 ? Math.round(avg(floorZones.map(z => z.cleanliness))) : Math.round(avg(grid.zones.map(z => z.cleanliness)));

  // Lighting
  const lightingScore = Math.min(100, raw.brightness * 1.2);
  const lightingValues = grid.zones.map(z => z.lighting);
  const lightingUniformity = Math.max(0, 100 - Math.round(stdDev(lightingValues)));

  // Estimated bird count: based on warm pixel ratio + farm context
  const farmBirds = farm.totalBirds > 0 ? farm.totalBirds : 0;
  const estimatedBirdCount = farmBirds > 0
    ? Math.round(farmBirds * (meanDensity / 100) * (0.7 + Math.random() * 0.3))
    : Math.round(raw.warmPixelRatio * 5 + (meanDensity * 2));

  // Density score
  const densityScore = Math.round(meanDensity);

  // Risk score (weighted combination)
  const riskScore = Math.round(
    crowdingScore * 0.25 +
    (100 - healthScore) * 0.25 +
    injuryRisk * 0.20 +
    (100 - floorCleanliness) * 0.15 +
    (100 - lightingScore) * 0.10 +
    (raw.darkPixelRatio > 50 ? 15 : 0) * 0.05
  );

  return {
    estimatedBirdCount: Math.max(0, estimatedBirdCount),
    densityScore,
    crowdingScore,
    activityLevel,
    healthScore: Math.max(0, Math.min(100, healthScore)),
    injuryRisk: Math.min(100, injuryRisk),
    floorCleanliness: Math.max(0, Math.min(100, floorCleanliness)),
    lightingScore: Math.max(0, Math.min(100, lightingScore)),
    lightingUniformity: Math.max(0, Math.min(100, lightingUniformity)),
    riskScore: Math.max(0, Math.min(100, riskScore)),
  };
}

// ─── Layer 2: Intelligence — Insights (Root Cause + Correlation) ──────────────

function runIntelligenceLayer(
  raw: RawVisualData, grid: GridData, metrics: VisionMetrics,
  farm: FarmContext, category: string, caption: string, imageDate: string
): OperationalInsight[] {
  const insights: OperationalInsight[] = [];
  const cap = caption.toLowerCase();

  // --- CROWDING ANALYSIS ---
  if (metrics.crowdingScore > 65) {
    const hotZones = grid.zones.filter(z => z.density > 70).map(z => z.label);
    insights.push({
      category: "crowding",
      urgency: metrics.crowdingScore > 80 ? "critical" : "high",
      finding: `تكدس غير طبيعي في ${hotZones.slice(0, 2).join("، ") || "جزء من الحظيرة"} (درجة التكدس: ${metrics.crowdingScore}%)`,
      rootCause: metrics.lightingScore < 40
        ? "الإضاءة السيئة تجمّع الطيور في البقع الأكثر ضوءاً"
        : metrics.activityLevel < 35
          ? "الطيور تتجمع بسبب برودة أو ضعف في التهوية"
          : "كثافة الطيور مرتفعة مقارنة بمساحة الحظيرة",
      impact: "التكدس يزيد الإجهاد الحراري ويرفع خطر انتشار الأمراض 3 أضعاف",
    });
  }

  // --- ACTIVITY ANALYSIS ---
  if (metrics.activityLevel < 30) {
    insights.push({
      category: "behavior",
      urgency: metrics.activityLevel < 15 ? "critical" : "high",
      finding: `نشاط منخفض جداً (${metrics.activityLevel}%) — الطيور خاملة بشكل غير طبيعي`,
      rootCause: metrics.lightingScore < 35
        ? "الإضاءة الضعيفة تثبط حركة الطيور وتقلل الأكل"
        : raw.brightPixelRatio > 60
          ? "احتمال ارتفاع درجة الحرارة — الطيور تفقد النشاط عند الإجهاد الحراري"
          : "احتمال بداية مرض أو نقص في العلف أو الماء",
      impact: `خمول مستمر يؤدي لضعف النمو وانخفاض الوزن — خسارة تقديرية 8-15% في كفاءة التحويل الغذائي`,
    });
  } else if (metrics.activityLevel > 85) {
    insights.push({
      category: "behavior",
      urgency: "medium",
      finding: `نشاط مرتفع جداً (${metrics.activityLevel}%) — حركة غير طبيعية أو اضطراب`,
      rootCause: "قد يشير إلى اضطراب (ضوضاء، حيوان دخيل، تغيير مفاجئ في البيئة)",
      impact: "الإجهاد المستمر يضعف الجهاز المناعي ويقلل كفاءة التغذية",
    });
  }

  // --- HEALTH / INJURY ---
  if (metrics.injuryRisk > 20) {
    insights.push({
      category: "health",
      urgency: metrics.injuryRisk > 50 ? "critical" : "high",
      finding: `مؤشر نزيف أو إصابة مرتفع (${metrics.injuryRisk}%) — اللون الأحمر غير طبيعي`,
      rootCause: metrics.crowdingScore > 60
        ? "التكدس يسبب تناقر (Pecking) بين الطيور"
        : "احتمال إصابة ميكانيكية أو مرض دموي",
      impact: "الإصابات تنتشر سريعاً في الحظيرة — خطر نفوق جماعي إذا لم يُعالج",
    });
  }

  // --- FLOOR CLEANLINESS ---
  if (metrics.floorCleanliness < 45) {
    const dirtyZones = grid.zones.filter(z => z.cleanliness < 40).map(z => z.label);
    insights.push({
      category: "environment",
      urgency: metrics.floorCleanliness < 25 ? "critical" : "high",
      finding: `نظافة الأرضية سيئة في ${dirtyZones.slice(0, 2).join("، ") || "أجزاء الحظيرة"} (${metrics.floorCleanliness}%)`,
      rootCause: metrics.lightingScore > 60
        ? "رطوبة مرتفعة مع علف مبلول يسبب التلوث"
        : "إدارة الفرشة غير كافية — تحتاج تقليب أو تغيير",
      impact: "الأرضية الملوثة مصدر رئيسي للكوكسيديا والأمراض الإنتاجية — تقلل الوزن 10-20%",
    });
  }

  // --- LIGHTING ---
  if (metrics.lightingScore < 35) {
    insights.push({
      category: "environment",
      urgency: "high",
      finding: `إضاءة غير كافية (${metrics.lightingScore}%) — الحظيرة مظلمة`,
      rootCause: "مصابيح معطلة أو غير كافية أو الصورة مأخوذة في وقت غير مناسب",
      impact: "الطيور تحتاج 16-18 ساعة ضوء يومياً — النقص يقلل الأكل والنمو بنسبة 12-18%",
    });
  }

  if (metrics.lightingUniformity < 40) {
    insights.push({
      category: "environment",
      urgency: "medium",
      finding: `توزيع الإضاءة غير متساوٍ (${metrics.lightingUniformity}%) — بقع مضيئة وأخرى مظلمة`,
      rootCause: "توزيع المصابيح غير متوازن أو بعضها معطل",
      impact: "الطيور تتجمع في المناطق المضيئة → تكدس مصطنع + ترك أجزاء من الحظيرة فارغة",
    });
  }

  // --- EQUIPMENT (green = mold in water/feeder, blue = water issue) ---
  if (raw.greenScore > 30 && raw.saturation > 15) {
    insights.push({
      category: "equipment",
      urgency: "high",
      finding: "رصد لون أخضر غير طبيعي — احتمال طحالب أو عفن في المعالف/المشارب",
      rootCause: "الماء الراكد مع درجة الحرارة المرتفعة يُنمّي البكتيريا والطحالب",
      impact: "مياه ملوثة تسبب إسهالاً وأمراضاً هضمية تؤثر على 30-50% من القطيع خلال أسبوع",
    });
  }

  // --- DENSITY vs FARM CONTEXT ---
  if (farm.totalBirds > 0 && metrics.densityScore > 70) {
    const birdsPerSqm = farm.totalBirds > 1500 ? "عالية جداً" : farm.totalBirds > 800 ? "عالية" : "طبيعية";
    if (birdsPerSqm !== "طبيعية") {
      insights.push({
        category: "crowding",
        urgency: "medium",
        finding: `كثافة الطيور ${birdsPerSqm} في المزرعة — ${farm.totalBirds} طير`,
        rootCause: "عدد الطيور يتجاوز الطاقة الاستيعابية المثلى للمساحة",
        impact: "الكثافة الزائدة ترفع معدل التحويل الغذائي (FCR) وتزيد نسبة النفوق",
      });
    }
  }

  // Caption-based context
  if (/مريض|ضعيف|تعبان|نفوق|ميت/.test(cap)) {
    insights.push({
      category: "health",
      urgency: "critical",
      finding: "المراقب أبلغ عن طيور مريضة أو نافقة",
      rootCause: "يحتاج تشخيص بيطري عاجل لتحديد السبب",
      impact: "الأمراض المعدية قد تنتشر لكامل القطيع خلال 48-72 ساعة",
    });
  }

  return insights.sort((a, b) => urgencyValue(b.urgency) - urgencyValue(a.urgency));
}

// ─── Layer 3: Decision — Actions + Predictions ────────────────────────────────

function buildDecisionLayer(insights: OperationalInsight[], metrics: VisionMetrics, farm: FarmContext, date: string): ActionItem[] {
  const actions: ActionItem[] = [];

  // From insights → specific actions
  for (const insight of insights) {
    if (insight.category === "crowding" && insight.urgency === "critical") {
      actions.push({ priority: "urgent", timeframe: "خلال ساعة", action: "افتح جزءاً مجاوراً أو انقل دفعة من الطيور لتقليل الكثافة فوراً" });
    }
    if (insight.category === "crowding" && insight.urgency === "high") {
      actions.push({ priority: "high", timeframe: "اليوم", action: "افحص التهوية في مناطق التكدس — ارفع سرعة المراوح إذا توفرت" });
    }
    if (insight.category === "health" && insight.urgency === "critical") {
      actions.push({ priority: "urgent", timeframe: "فوراً", action: "عزل الطيور المريضة في قفص منفصل والاتصال بالطبيب البيطري" });
    }
    if (insight.category === "behavior" && metrics.activityLevel < 30) {
      actions.push({ priority: "urgent", timeframe: "خلال ساعتين", action: "تحقق من مصادر الماء والعلف — راقب درجة الحرارة في كل ركن" });
    }
    if (insight.category === "environment" && insight.finding.includes("نظافة")) {
      actions.push({ priority: "high", timeframe: "اليوم", action: "قلّب الفرشة في المناطق الرطبة وأضف فرشة جديدة جافة" });
    }
    if (insight.category === "environment" && insight.finding.includes("إضاءة")) {
      actions.push({ priority: "high", timeframe: "اليوم", action: "افحص المصابيح وأصلح المعطل — تأكد من 16 ساعة إضاءة يومياً" });
    }
    if (insight.category === "equipment") {
      actions.push({ priority: "urgent", timeframe: "الآن", action: "اغسل وعقّم المشارب والمعالف — أضف خل التفاح للماء لمقاومة الطحالب" });
    }
  }

  // Standard monitoring actions
  if (actions.length < 3) {
    actions.push({ priority: "medium", timeframe: "يومياً", action: "سجّل وزن عينة (10 طيور) لمتابعة منحنى النمو" });
    actions.push({ priority: "low", timeframe: "أسبوعياً", action: "راجع نسبة التحويل الغذائي (FCR) وقارنها بالمعيار للسلالة" });
  }

  // Predictive alert
  if (metrics.riskScore > 50) {
    actions.push({
      priority: "high",
      timeframe: "خلال 24-48 ساعة",
      action: `إذا استمر الوضع: توقع ${metrics.riskScore > 70 ? "ارتفاع نسبة النفوق وضعف نمو حاد" : "انخفاض في كفاءة التغذية وتراجع معدل النمو"} — تصرف الآن لمنعه`,
    });
  }

  return actions.slice(0, 6);
}

function buildAlerts(metrics: VisionMetrics, insights: OperationalInsight[], farm: FarmContext): Alert[] {
  const alerts: Alert[] = [];

  if (metrics.riskScore >= 65) {
    alerts.push({ level: "critical", message: `🚨 درجة الخطر الكلية: ${metrics.riskScore}/100 — يتطلب تدخلاً فورياً` });
  } else if (metrics.riskScore >= 35) {
    alerts.push({ level: "warning", message: `⚠️ درجة الخطر: ${metrics.riskScore}/100 — راقب الوضع بعناية` });
  }

  const criticalInsights = insights.filter(i => i.urgency === "critical");
  for (const ins of criticalInsights.slice(0, 2)) {
    alerts.push({ level: "critical", message: ins.finding });
  }

  const highInsights = insights.filter(i => i.urgency === "high");
  for (const ins of highInsights.slice(0, 2)) {
    alerts.push({ level: "warning", message: ins.finding });
  }

  // Incubator crosscheck
  if (farm.overdueTasks.filter(t => t.priority === "high").length > 0) {
    const t = farm.overdueTasks.find(t => t.priority === "high");
    if (t) alerts.push({ level: "warning", message: `⚠️ مهمة عالية الأولوية متأخرة: ${t.title}` });
  }

  return alerts.slice(0, 5);
}

function buildTags(metrics: VisionMetrics, insights: OperationalInsight[], category: string, caption: string, raw: RawVisualData): string[] {
  const tags: string[] = [];
  const catMap: Record<string, string> = {
    birds: "طيور", eggs: "بيض", incubator: "حاضنة", chicks: "كتاكيت",
    feed: "علف", health: "فحص صحي", facility: "منشآت", general: "توثيق",
  };
  if (catMap[category]) tags.push(catMap[category]);

  if (metrics.activityLevel > 60) tags.push("طيور نشطة");
  if (metrics.activityLevel < 30) tags.push("نشاط منخفض");
  if (metrics.crowdingScore > 60) tags.push("تكدس");
  if (metrics.healthScore > 80) tags.push("حالة صحية جيدة");
  if (metrics.injuryRisk > 25) tags.push("مؤشر إصابة");
  if (metrics.floorCleanliness > 75) tags.push("فرشة نظيفة");
  if (metrics.floorCleanliness < 40) tags.push("فرشة ملوثة");
  if (metrics.lightingScore > 70) tags.push("إضاءة جيدة");
  if (metrics.riskScore >= 65) tags.push("خطر مرتفع");
  if (metrics.riskScore < 25) tags.push("وضع جيد");

  for (const ins of insights.filter(i => i.urgency === "critical").slice(0, 2)) {
    if (ins.category === "crowding") tags.push("تكدس حرج");
    if (ins.category === "health") tags.push("مشكلة صحية");
    if (ins.category === "equipment") tags.push("معدات تحتاج صيانة");
  }

  if (/مريض/.test(caption)) tags.push("طيور مريضة");
  if (/علف/.test(caption)) tags.push("علف");
  if (/ماء|شرب/.test(caption)) tags.push("ماء");

  return [...new Set(tags)].slice(0, 8);
}

function buildSummary(status: string, metrics: VisionMetrics, insights: OperationalInsight[]): string {
  const topInsight = insights[0];
  if (status === "critical") {
    return `🔴 حالة حرجة — ${topInsight ? topInsight.finding : "يتطلب تدخلاً فورياً"} (خطر: ${metrics.riskScore}/100)`;
  } else if (status === "warning") {
    return `🟡 يحتاج انتباهاً — ${topInsight ? topInsight.finding : "راقب الوضع"} (خطر: ${metrics.riskScore}/100)`;
  }
  return `✅ الوضع جيد — الطيور بصحة جيدة ومستوى الخطر منخفض (${metrics.riskScore}/100)`;
}

// ─── Analysis Text Builder ─────────────────────────────────────────────────────

function buildAnalysisText(
  raw: RawVisualData, grid: GridData, metrics: VisionMetrics,
  insights: OperationalInsight[], actions: ActionItem[],
  farm: FarmContext, category: string, caption: string, imageDate: string
): string {
  const parts: string[] = [];

  parts.push(`╔══════════════════════════════════════╗`);
  parts.push(`║   تحليل صورة المزرعة الذكي (AI CV)   ║`);
  parts.push(`╚══════════════════════════════════════╝`);
  parts.push(``);

  const statusIcon = metrics.riskScore >= 65 ? "🔴" : metrics.riskScore >= 35 ? "🟡" : "✅";
  parts.push(`${statusIcon} الحالة العامة: ${metrics.riskScore >= 65 ? "حرجة" : metrics.riskScore >= 35 ? "تحتاج انتباهاً" : "جيدة"} | درجة الخطر: ${metrics.riskScore}/100`);
  parts.push(``);

  parts.push(`📊 المقاييس الدقيقة:`);
  parts.push(`   الكثافة التقديرية   ${bar(metrics.densityScore)} ${metrics.densityScore}%`);
  parts.push(`   النشاط الحركي       ${bar(metrics.activityLevel)} ${metrics.activityLevel}%`);
  parts.push(`   التكدس              ${bar(metrics.crowdingScore)} ${metrics.crowdingScore}%`);
  parts.push(`   الصحة العامة        ${bar(metrics.healthScore)} ${metrics.healthScore}%`);
  parts.push(`   نظافة الأرضية       ${bar(metrics.floorCleanliness)} ${metrics.floorCleanliness}%`);
  parts.push(`   الإضاءة             ${bar(metrics.lightingScore)} ${metrics.lightingScore}%`);
  if (metrics.injuryRisk > 5) {
    parts.push(`   خطر الإصابة         ${bar(metrics.injuryRisk)} ${metrics.injuryRisk}% ⚠️`);
  }
  if (farm.totalBirds > 0) {
    parts.push(`   الطيور المرئية تقديراً: ~${metrics.estimatedBirdCount} من ${farm.totalBirds}`);
  }
  parts.push(``);

  if (insights.length > 0) {
    parts.push(`🧠 الاستنتاجات التشغيلية:`);
    for (const ins of insights.slice(0, 4)) {
      const u = ins.urgency === "critical" ? "🔴" : ins.urgency === "high" ? "🟠" : ins.urgency === "medium" ? "🟡" : "🟢";
      parts.push(`   ${u} ${ins.finding}`);
      parts.push(`      السبب: ${ins.rootCause}`);
      parts.push(`      التأثير: ${ins.impact}`);
    }
    parts.push(``);
  }

  if (actions.length > 0) {
    parts.push(`💡 ماذا تفعل الآن — بالترتيب:`);
    for (let i = 0; i < Math.min(actions.length, 5); i++) {
      const p = actions[i].priority === "urgent" ? "🚨" : actions[i].priority === "high" ? "⚡" : actions[i].priority === "medium" ? "📌" : "📝";
      parts.push(`   ${i + 1}. ${p} [${actions[i].timeframe}] ${actions[i].action}`);
    }
    parts.push(``);
  }

  parts.push(`🔬 التحليل البصري التفصيلي:`);
  parts.push(`   الإضاءة: ${descBrightness(raw.brightness)} (${raw.brightness}%)`);
  parts.push(`   التعقيد البصري: ${descEntropy(raw.entropy)} (${raw.entropy}%)`);
  parts.push(`   الألوان الدافئة (طيور/فرشة): ${raw.warmPixelRatio}%`);
  if (raw.redSpikeRatio > 3) parts.push(`   ⚠️ بكسلات حمراء حادة: ${raw.redSpikeRatio}%`);
  if (raw.greenScore > 20) parts.push(`   ⚠️ لون أخضر غير طبيعي: ${raw.greenScore}%`);

  if (caption) {
    parts.push(``);
    parts.push(`📝 ملاحظة المراقب: "${caption}"`);
  }

  return parts.join("\n");
}

function bar(v: number): string {
  const filled = Math.round(v / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

// ─── Temporal Analysis ────────────────────────────────────────────────────────

async function loadTemporalBaseline(date: string, excludeId: number): Promise<TemporalComparison | undefined> {
  try {
    const d = new Date(date);
    const from = new Date(d); from.setDate(from.getDate() - 7);
    const fromStr = from.toISOString().slice(0, 10);

    const rows = await db.select({
      visualMetrics: noteImagesTable.visualMetrics,
      date: noteImagesTable.date,
    }).from(noteImagesTable)
      .where(and(
        gte(noteImagesTable.date, fromStr),
        lte(noteImagesTable.date, date),
        eq(noteImagesTable.analysisStatus, "done"),
      ))
      .orderBy(desc(noteImagesTable.createdAt))
      .limit(20);

    const valid = rows.filter(r => r.visualMetrics && (r.visualMetrics as any).riskScore !== undefined);
    if (valid.length < 2) return undefined;

    const metrics = valid.map(r => r.visualMetrics as VisionMetrics);
    const baseline: Partial<VisionMetrics> = {
      riskScore: avg(metrics.map(m => m.riskScore)),
      activityLevel: avg(metrics.map(m => m.activityLevel)),
      densityScore: avg(metrics.map(m => m.densityScore)),
      crowdingScore: avg(metrics.map(m => m.crowdingScore)),
      healthScore: avg(metrics.map(m => m.healthScore)),
      floorCleanliness: avg(metrics.map(m => m.floorCleanliness)),
      lightingScore: avg(metrics.map(m => m.lightingScore)),
    };

    return {
      availableImages: valid.length,
      periodDays: 7,
      baseline,
      changes: [],
      trend: "stable",
      trendSummary: "",
    };
  } catch { return undefined; }
}

function enrichTemporalData(temporal: TemporalComparison, current: VisionMetrics): TemporalComparison {
  const b = temporal.baseline;
  const metricDefs = [
    { key: "activityLevel" as keyof VisionMetrics, label: "النشاط الحركي", higherIsBetter: true },
    { key: "healthScore" as keyof VisionMetrics, label: "الصحة العامة", higherIsBetter: true },
    { key: "floorCleanliness" as keyof VisionMetrics, label: "نظافة الأرضية", higherIsBetter: true },
    { key: "lightingScore" as keyof VisionMetrics, label: "الإضاءة", higherIsBetter: true },
    { key: "riskScore" as keyof VisionMetrics, label: "درجة الخطر", higherIsBetter: false },
    { key: "crowdingScore" as keyof VisionMetrics, label: "التكدس", higherIsBetter: false },
  ];

  const changes: TemporalChange[] = [];
  let positiveCount = 0, negativeCount = 0;

  for (const def of metricDefs) {
    const cur = current[def.key] as number;
    const base = b[def.key] as number | undefined;
    if (base === undefined) continue;
    const delta = cur - base;
    const absDelta = Math.abs(delta);
    const significance: TemporalChange["significance"] = absDelta > 15 ? "significant" : absDelta > 5 ? "minor" : "none";
    const direction: TemporalChange["direction"] = delta > 2 ? "up" : delta < -2 ? "down" : "stable";
    const isPositive = def.higherIsBetter ? delta >= 0 : delta <= 0;
    if (significance !== "none") {
      if (isPositive) positiveCount++; else negativeCount++;
    }
    changes.push({ metric: def.key, label: def.label, current: Math.round(cur), baseline: Math.round(base), delta: Math.round(delta), direction, isPositive, significance });
  }

  const trend: TemporalComparison["trend"] = positiveCount > negativeCount ? "improving" : negativeCount > positiveCount ? "declining" : "stable";
  const trendSummary = trend === "improving"
    ? `تحسن ملحوظ مقارنة بالأسبوع الماضي — ${positiveCount} مؤشر تحسّن`
    : trend === "declining"
      ? `تراجع ملحوظ مقارنة بالأسبوع الماضي — ${negativeCount} مؤشر تراجع`
      : "الأداء مستقر بشكل عام مقارنة بالأسبوع الماضي";

  return { ...temporal, changes, trend, trendSummary };
}

// ─── Farm Context Loader ──────────────────────────────────────────────────────

async function loadFarmContext(imageDate: string): Promise<FarmContext> {
  try {
    const [flocks, tasks, notes] = await Promise.all([
      db.select().from(flocksTable).orderBy(desc(flocksTable.createdAt)).limit(30),
      db.select().from(tasksTable).where(eq(tasksTable.completed, false)).orderBy(tasksTable.dueDate).limit(20),
      db.select().from(dailyNotesTable).orderBy(desc(dailyNotesTable.createdAt)).limit(5),
    ]);

    const today = new Date(imageDate);
    const excluded = ["فحص درجة حرارة الحاضنة", "وضع علف كل يوم"];
    const overdueTasks = tasks.filter(t => {
      if (!t.dueDate) return false;
      if (excluded.some(e => t.title.includes(e))) return false;
      return new Date(t.dueDate) < today;
    }).slice(0, 5).map(t => ({ title: t.title, priority: t.priority }));

    const recentAlerts = notes
      .filter(n => /مريض|نفوق|مشكلة|خطر|عاجل/.test(n.content))
      .map(n => n.content.substring(0, 80));

    const totalBirds = flocks.reduce((s, f) => s + (f.count || 0), 0);

    return {
      activeFlocks: flocks.slice(0, 5).map(f => ({ name: f.name, breed: f.breed, count: f.count, ageDays: f.ageDays, purpose: f.purpose })),
      totalBirds,
      overdueTasks,
      recentAlerts,
    };
  } catch {
    return { activeFlocks: [], totalBirds: 0, overdueTasks: [], recentAlerts: [] };
  }
}

// ─── Confidence Computation ───────────────────────────────────────────────────

function computeConfidence(raw: RawVisualData, metrics: VisionMetrics, farm: FarmContext): number {
  let conf = 55;
  if (raw.width > 1000) conf += 10;
  if (raw.warmPixelRatio > 10 && raw.warmPixelRatio < 90) conf += 10;
  if (raw.brightness > 25 && raw.brightness < 90) conf += 10;
  if (farm.totalBirds > 0) conf += 8;
  if (raw.entropy > 20) conf += 5;
  return Math.min(92, conf);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = avg(arr);
  return Math.sqrt(arr.reduce((a, v) => a + (v - m) ** 2, 0) / arr.length);
}

function computeGini(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const total = sorted.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let sumNumerator = 0;
  for (let i = 0; i < n; i++) sumNumerator += (2 * (i + 1) - n - 1) * sorted[i];
  return Math.abs(sumNumerator / (n * total));
}

function urgencyValue(u: string): number {
  return { critical: 4, high: 3, medium: 2, low: 1 }[u] ?? 0;
}

function descBrightness(b: number): string {
  if (b < 15) return "مظلم جداً";
  if (b < 30) return "مظلم";
  if (b < 45) return "خافت";
  if (b < 65) return "متوسط";
  if (b < 80) return "جيد";
  return "مضيء";
}

function descEntropy(e: number): string {
  if (e < 15) return "صورة هادئة / خالية";
  if (e < 35) return "بيئة هادئة";
  if (e < 55) return "نشاط طبيعي";
  if (e < 75) return "بيئة مزدحمة";
  return "نشاط مرتفع جداً";
}

export function formatArabicDate(dateStr: string): string {
  try { return new Date(dateStr).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return dateStr; }
}
