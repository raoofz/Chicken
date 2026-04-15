/**
 * Vision Engine — Real pixel-level image analysis for poultry farm monitoring
 * Uses Sharp to read actual image data (RGB histograms, channels, brightness, entropy)
 * and cross-references with live farm data from the database.
 */
import sharp from "sharp";
import { db, flocksTable, hatchingCyclesTable, tasksTable, goalsTable, dailyNotesTable, noteImagesTable } from "@workspace/db";
import { desc, eq, and, gte } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VisionResult {
  analysis: string;
  tags: string[];
  alerts: { level: "warning" | "critical"; message: string }[];
  confidence: number;
  visualData: VisualData;
}

export interface VisualData {
  brightness: number;       // 0-100 (overall luminance)
  redScore: number;         // 0-100 (red dominance)
  greenScore: number;       // 0-100 (green presence)
  blueScore: number;        // 0-100 (blue presence)
  yellowScore: number;      // 0-100 (warm yellow/orange tones)
  saturation: number;       // 0-100 (color richness)
  entropy: number;          // 0-100 (image complexity/detail)
  darkPixelRatio: number;   // 0-100 (% of very dark pixels)
  brightPixelRatio: number; // 0-100 (% of very bright pixels)
  redSpikeRatio: number;    // 0-100 (% of strongly red pixels — blood indicator)
  contrastScore: number;    // 0-100 (std deviation of luminance)
  width: number;
  height: number;
  fileSize: number;         // bytes
  mimeType: string;
}

// ─── Main Analysis Entry Point ────────────────────────────────────────────────

export async function analyzeImage(
  imageBuffer: Buffer,
  mimeType: string,
  fileSize: number,
  imageDate: string,
  category: string,
  caption: string
): Promise<VisionResult> {
  const visual = await extractVisualFeatures(imageBuffer, mimeType, fileSize);
  const farmCtx = await loadFarmContext(imageDate);
  return buildFarmAnalysis(visual, farmCtx, category, caption, imageDate);
}

// ─── Visual Feature Extraction via Sharp ─────────────────────────────────────

async function extractVisualFeatures(
  buf: Buffer,
  mimeType: string,
  fileSize: number
): Promise<VisualData> {
  // Resize to manageable size for histogram analysis (keep aspect ratio)
  const img = sharp(buf).rotate(); // auto-orient via EXIF

  const { width: origW = 800, height: origH = 600 } = await img.metadata();

  // Work on a resized 200x200 thumbnail for speed
  const resized = await sharp(buf)
    .rotate()
    .resize(200, 200, { fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;
  const pixelCount = info.width * info.height;
  const channels = info.channels; // 3 = RGB, 4 = RGBA

  // Per-pixel analysis
  let sumR = 0, sumG = 0, sumB = 0;
  let sumLum = 0;
  let darkPixels = 0;      // luminance < 40
  let brightPixels = 0;    // luminance > 215
  let redSpikePixels = 0;  // R > 160 AND R > G*1.5 AND R > B*1.5
  let yellowPixels = 0;    // R > 140 AND G > 100 AND B < 100 AND R > B*1.8
  let greenPixels = 0;     // G > R*1.1 AND G > B*1.1 AND G > 80
  let bluePixels = 0;      // B > R*1.1 AND B > G*1.1 AND B > 60

  const luminances: number[] = [];

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // ITU-R BT.601 luminance
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    luminances.push(lum);

    sumR += r;
    sumG += g;
    sumB += b;
    sumLum += lum;

    if (lum < 40) darkPixels++;
    if (lum > 215) brightPixels++;

    // Blood/injury: strong red dominance
    if (r > 160 && r > g * 1.5 && r > b * 1.5) redSpikePixels++;

    // Healthy chicks/warm bedding: yellow/orange
    if (r > 140 && g > 90 && b < 110 && r > b * 1.8) yellowPixels++;

    // Mold/vegetation: green dominance
    if (g > r * 1.1 && g > b * 1.1 && g > 80) greenPixels++;

    // Water/clean surface: blue dominance
    if (b > r * 1.1 && b > g * 1.1 && b > 60) bluePixels++;
  }

  const meanR = sumR / pixelCount;
  const meanG = sumG / pixelCount;
  const meanB = sumB / pixelCount;
  const meanLum = sumLum / pixelCount;

  // Entropy: standard deviation of luminance (measures image complexity/detail)
  const lumVariance = luminances.reduce((acc, l) => acc + Math.pow(l - meanLum, 2), 0) / pixelCount;
  const lumStdDev = Math.sqrt(lumVariance);

  // Saturation: how colorful vs grey
  const saturation = Math.sqrt(
    Math.pow(meanR - meanLum, 2) + Math.pow(meanG - meanLum, 2) + Math.pow(meanB - meanLum, 2)
  ) / meanLum * 100;

  const scale = (v: number, max: number) => Math.min(100, Math.round((v / max) * 100));

  return {
    brightness: scale(meanLum, 255),
    redScore: scale(meanR, 255),
    greenScore: scale(greenPixels, pixelCount * 0.5),
    blueScore: scale(bluePixels, pixelCount * 0.3),
    yellowScore: scale(yellowPixels, pixelCount),
    saturation: Math.min(100, Math.round(saturation)),
    entropy: scale(lumStdDev, 80),
    darkPixelRatio: scale(darkPixels, pixelCount),
    brightPixelRatio: scale(brightPixels, pixelCount),
    redSpikeRatio: scale(redSpikePixels, pixelCount),
    contrastScore: scale(lumStdDev, 80),
    width: origW,
    height: origH,
    fileSize,
    mimeType,
  };
}

// ─── Farm Context from DB ─────────────────────────────────────────────────────

interface FarmContext {
  activeFlocks: { name: string; breed: string; count: number; ageDays: number; purpose: string }[];
  activeIncubators: { batchName: string; eggsSet: number; status: string; temperature: string | null; humidity: string | null; expectedHatchDate: string; daysLeft: number }[];
  overdueTasks: { title: string; priority: string; category: string }[];
  recentAlerts: string[];
  totalBirds: number;
  totalEggs: number;
}

async function loadFarmContext(imageDate: string): Promise<FarmContext> {
  try {
    const [flocks, cycles, tasks, notes] = await Promise.all([
      db.select().from(flocksTable).orderBy(desc(flocksTable.createdAt)).limit(20),
      db.select().from(hatchingCyclesTable)
        .where(eq(hatchingCyclesTable.status, "incubating"))
        .orderBy(desc(hatchingCyclesTable.createdAt))
        .limit(10),
      db.select().from(tasksTable)
        .where(and(eq(tasksTable.completed, false)))
        .orderBy(tasksTable.dueDate)
        .limit(20),
      db.select().from(dailyNotesTable)
        .orderBy(desc(dailyNotesTable.createdAt))
        .limit(5),
    ]);

    const today = new Date(imageDate);

    const overdueTasks = tasks.filter(t => {
      if (!t.dueDate) return false;
      const excluded = ["فحص درجة حرارة الحاضنة", "وضع علف كل يوم"];
      if (excluded.some(e => t.title.includes(e))) return false;
      return new Date(t.dueDate) < today;
    }).slice(0, 5).map(t => ({ title: t.title, priority: t.priority, category: t.category }));

    const incubatorContexts = cycles.map(c => {
      const expectedDate = new Date(c.expectedHatchDate);
      const daysLeft = Math.round((expectedDate.getTime() - today.getTime()) / 86400000);
      return {
        batchName: c.batchName,
        eggsSet: c.eggsSet ?? 0,
        status: c.status,
        temperature: c.temperature,
        humidity: c.humidity,
        expectedHatchDate: c.expectedHatchDate,
        daysLeft,
      };
    });

    const recentAlerts = notes
      .filter(n => /مريض|نفوق|مشكلة|خطر|عاجل|ضعيف/.test(n.content))
      .map(n => n.content.substring(0, 80));

    const totalBirds = flocks.reduce((s, f) => s + (f.count || 0), 0);
    const totalEggs = cycles.reduce((s, c) => s + (c.eggsSet || 0), 0);

    return {
      activeFlocks: flocks.slice(0, 5).map(f => ({
        name: f.name, breed: f.breed, count: f.count,
        ageDays: f.ageDays, purpose: f.purpose,
      })),
      activeIncubators: incubatorContexts.slice(0, 5),
      overdueTasks,
      recentAlerts,
      totalBirds,
      totalEggs,
    };
  } catch {
    return {
      activeFlocks: [], activeIncubators: [],
      overdueTasks: [], recentAlerts: [],
      totalBirds: 0, totalEggs: 0,
    };
  }
}

// ─── Expert Analysis Engine ───────────────────────────────────────────────────

function buildFarmAnalysis(
  v: VisualData,
  farm: FarmContext,
  category: string,
  caption: string,
  imageDate: string
): VisionResult {
  const alerts: { level: "warning" | "critical"; message: string }[] = [];
  const tags: string[] = [];
  let confidence = 60;

  // ── 1. Identify what's in the image ──────────────────────────────────────
  const contentGuess = identifyContent(v, category, caption);
  tags.push(...contentGuess.tags);
  confidence += contentGuess.confidenceBonus;

  // ── 2. Visual health indicators ───────────────────────────────────────────

  // Blood/injury detection: red spike > 5% of pixels is significant
  if (v.redSpikeRatio > 8) {
    alerts.push({ level: "critical", message: `🩸 رُصد احتمال نزيف أو إصابة (${v.redSpikeRatio}% من البكسلات حمراء بشدة) — افحص الطيور فوراً` });
    tags.push("إصابة محتملة");
    confidence += 15;
  } else if (v.redSpikeRatio > 4) {
    alerts.push({ level: "warning", message: "لون أحمر غير طبيعي في الصورة — تحقق من وجود جروح أو دم" });
  }

  // Darkness: poorly lit environment
  if (v.darkPixelRatio > 60) {
    alerts.push({ level: "warning", message: `إضاءة ضعيفة جداً (${v.darkPixelRatio}% من الصورة مظلمة) — قد يسبب إجهاد الطيور` });
    tags.push("إضاءة ضعيفة");
  } else if (v.brightness < 30) {
    alerts.push({ level: "warning", message: "الصورة مظلمة — تحقق من مصادر الإضاءة في الحظيرة" });
  }

  // Green spike: possible mold/disease
  if (v.greenScore > 35 && contentGuess.hasGreenConcern) {
    alerts.push({ level: "warning", message: "نسبة غير طبيعية من اللون الأخضر — احتمال وجود عفن أو طحالب في المياه/العلف" });
    tags.push("عفن محتمل");
  }

  // Very bright: overexposed or very clean white environment
  if (v.brightPixelRatio > 55) {
    tags.push("إضاءة عالية");
  }

  // Low entropy: possibly empty/sparse area — or good clean environment
  if (v.entropy < 20) {
    tags.push("بيئة موحدة");
  }

  // High entropy: active/crowded area
  if (v.entropy > 70) {
    tags.push("نشاط عالٍ");
  }

  // Warm yellow/orange tones — typical of healthy chicks and clean bedding
  const isWarm = v.yellowScore > 20 && v.redScore > v.blueScore * 1.3;
  if (isWarm) tags.push("ألوان دافئة صحية");

  // Cold/blue tones might indicate moisture problem
  if (v.blueScore > 30 && v.saturation > 20) {
    tags.push("رطوبة أو ماء");
  }

  // ── 3. Farm context integration ───────────────────────────────────────────

  // Overdue tasks warning
  if (farm.overdueTasks.length > 0) {
    const highPriority = farm.overdueTasks.filter(t => t.priority === "high");
    if (highPriority.length > 0) {
      alerts.push({
        level: "warning",
        message: `⚠️ يوجد ${highPriority.length} مهمة عالية الأولوية متأخرة: ${highPriority[0].title}${highPriority.length > 1 ? ` و${highPriority.length - 1} أخرى` : ""}`,
      });
    }
  }

  // Incubator context
  const criticalIncubators = farm.activeIncubators.filter(i => {
    if (i.daysLeft <= 1 && i.daysLeft >= 0) return true; // hatching day!
    const temp = parseFloat(i.temperature ?? "0");
    if (temp > 0 && (temp < 37.2 || temp > 38.0)) return true; // out of range
    const hum = parseFloat(i.humidity ?? "0");
    if (hum > 0 && (hum < 50 || hum > 60)) return true;
    return false;
  });

  if (criticalIncubators.length > 0) {
    const c = criticalIncubators[0];
    if (c.daysLeft <= 1) {
      alerts.push({ level: "warning", message: `🥚 دفعة "${c.batchName}" موعد فقسها اليوم أو غداً (${c.eggsSet} بيضة)` });
      tags.push("موعد فقس قريب");
    } else {
      const temp = parseFloat(c.temperature ?? "0");
      if (temp > 38.0) {
        alerts.push({ level: "critical", message: `🌡️ درجة حرارة الحاضنة "${c.batchName}" مرتفعة: ${temp}°م — يجب التصحيح فوراً` });
      } else if (temp > 0 && temp < 37.2) {
        alerts.push({ level: "critical", message: `🌡️ درجة حرارة الحاضنة "${c.batchName}" منخفضة: ${temp}°م — يجب التصحيح فوراً` });
      }
    }
  }

  // Recent text alerts from daily notes
  if (farm.recentAlerts.length > 0) {
    alerts.push({ level: "warning", message: `📋 تنبيه من الملاحظات الأخيرة: "${farm.recentAlerts[0].substring(0, 60)}..."` });
  }

  // ── 4. Build the analysis text ────────────────────────────────────────────
  const analysis = buildAnalysisText(v, farm, contentGuess, category, caption, imageDate);

  // Unique tags
  const uniqueTags = [...new Set(tags)];

  // Confidence: base + bonuses
  confidence = Math.min(95, Math.max(40, confidence));

  return { analysis, tags: uniqueTags, alerts, confidence, visualData: v };
}

// ─── Content Identification ───────────────────────────────────────────────────

interface ContentGuess {
  subject: string;
  description: string;
  tags: string[];
  confidenceBonus: number;
  hasGreenConcern: boolean;
}

function identifyContent(v: VisualData, category: string, caption: string): ContentGuess {
  const cap = caption.toLowerCase();

  // Category mapping
  const catNames: Record<string, string> = {
    birds: "الطيور في الحظيرة",
    eggs: "بيض",
    incubator: "الحاضنة",
    chicks: "الكتاكيت",
    feed: "منطقة التغذية",
    health: "فحص صحي",
    facility: "منشآت المزرعة",
    general: "المزرعة",
  };

  let subject = catNames[category] ?? "المزرعة";
  const tags: string[] = [subject === "المزرعة" ? "توثيق" : category];

  // Add category-specific tags
  if (category === "birds" || category === "chicks") tags.push("طيور");
  if (category === "eggs" || category === "incubator") tags.push("بيض", "تفقيس");
  if (category === "feed") tags.push("علف");
  if (category === "health") tags.push("صحة");

  // Caption keywords → refine subject
  if (/كتكوت|صوص|فرخ|كتاكيت/i.test(cap)) { subject = "كتاكيت صغيرة"; tags.push("كتاكيت"); }
  else if (/بيض/i.test(cap)) { subject = "بيض"; tags.push("بيض"); }
  else if (/حاضنة|فاقسة/i.test(cap)) { subject = "الحاضنة"; tags.push("حاضنة"); }
  else if (/علف|أكل/i.test(cap)) { subject = "العلف والتغذية"; tags.push("علف"); }
  else if (/ماء|شرب/i.test(cap)) { subject = "مياه الشرب"; tags.push("ماء"); }
  else if (/مريض|ضعيف/i.test(cap)) { tags.push("صحة مقلقة"); }

  // Visual-based identification
  let description = "";
  let confidenceBonus = 0;
  let hasGreenConcern = false;

  // Egg/incubator: typically white/cream uniform with low entropy
  if (v.brightPixelRatio > 30 && v.entropy < 35 && v.saturation < 25) {
    description = "ألوان فاتحة موحدة تشير إلى بيض أو حاضنة نظيفة";
    tags.push("بيئة نظيفة");
    confidenceBonus += 10;
  }
  // Healthy birds: warm yellow-orange-brown tones, medium entropy
  else if (v.yellowScore > 15 && v.brightness > 35 && v.entropy > 30) {
    description = "ألوان دافئة مع تفاصيل كثيرة تشير إلى قطيع نشط في بيئة جيدة";
    tags.push("طيور نشطة");
    confidenceBonus += 12;
  }
  // Feed/bedding: yellow-brown, medium-low entropy
  else if (v.yellowScore > 10 && v.brightness > 25 && v.entropy < 45) {
    description = "ألوان بنية-صفراء تشير إلى علف أو فرشة الحظيرة";
    tags.push("فرشة");
    confidenceBonus += 8;
  }
  // Dark/night: very low brightness
  else if (v.brightness < 25) {
    description = "صورة مظلمة — قد تكون مأخوذة ليلاً أو في بيئة سيئة الإضاءة";
    confidenceBonus += 5;
  }
  // Water/clean floor: blue tones
  else if (v.blueScore > 20 && v.brightness > 40) {
    description = "ألوان باردة تشير إلى ماء أو أسطح نظيفة";
    tags.push("ماء");
    confidenceBonus += 7;
  }
  // Green: vegetation or possible mold
  else if (v.greenScore > 30) {
    description = "نسبة خضراء واضحة — قد تكون نباتات طبيعية أو عفن";
    hasGreenConcern = true;
    confidenceBonus += 8;
  }
  // General
  else {
    description = "بيئة متنوعة الألوان";
    confidenceBonus += 3;
  }

  return { subject, description, tags: [...new Set(tags)], confidenceBonus, hasGreenConcern };
}

// ─── Analysis Text Builder ────────────────────────────────────────────────────

function buildAnalysisText(
  v: VisualData,
  farm: FarmContext,
  content: ContentGuess,
  category: string,
  caption: string,
  imageDate: string
): string {
  const parts: string[] = [];
  const dateStr = formatArabicDate(imageDate);

  // 1. What we see
  parts.push(`📷 ما تُظهره الصورة:`);
  parts.push(`   الموضوع: ${content.subject} — ${content.description}`);
  parts.push(`   الأبعاد: ${v.width}×${v.height} بكسل | الحجم: ${Math.round(v.fileSize/1024)} كيلوبايت`);
  parts.push(``);

  // 2. Visual analysis
  parts.push(`🔬 التحليل البصري للصورة:`);
  parts.push(`   • الإضاءة: ${descBrightness(v.brightness)} (${v.brightness}%)`);
  parts.push(`   • التفاصيل البصرية: ${descEntropy(v.entropy)} (${v.entropy}%)`);
  parts.push(`   • التوزيع اللوني: ${descColorProfile(v)}`);
  if (v.redSpikeRatio > 3) {
    parts.push(`   • ⚠️ نسبة اللون الأحمر الحاد: ${v.redSpikeRatio}% (${v.redSpikeRatio > 6 ? "مرتفعة — تحتاج فحص" : "طبيعية"})`);
  }
  parts.push(``);

  // 3. Farm context
  if (farm.totalBirds > 0 || farm.activeFlocks.length > 0) {
    parts.push(`🐔 بيانات المزرعة الحالية:`);
    if (farm.activeFlocks.length > 0) {
      const flock = farm.activeFlocks[0];
      parts.push(`   • أكبر قطيع: "${flock.name}" — ${flock.count} طير من نوع ${flock.breed} (عمر ${flock.ageDays} يوم)`);
    }
    if (farm.totalBirds > 0) {
      parts.push(`   • إجمالي الطيور: ${farm.totalBirds} طير في ${farm.activeFlocks.length} قطيع`);
    }
    if (farm.activeIncubators.length > 0) {
      const inc = farm.activeIncubators[0];
      const daysInfo = inc.daysLeft > 0 ? `${inc.daysLeft} يوم متبقٍّ` : inc.daysLeft === 0 ? "موعد الفقس اليوم!" : "تأخر الفقس";
      parts.push(`   • حاضنة نشطة: "${inc.batchName}" — ${inc.eggsSet} بيضة (${daysInfo})`);
      if (inc.temperature) parts.push(`     الحرارة: ${parseFloat(inc.temperature).toFixed(1)}°م | الرطوبة: ${inc.humidity ?? "غير مسجلة"}%`);
    }
    parts.push(``);
  }

  // 4. Condition assessment
  const condition = assessCondition(v, farm);
  parts.push(`📊 تقييم الحالة: ${condition.label}`);
  parts.push(`   ${condition.detail}`);
  parts.push(``);

  // 5. Recommendations
  const recs = buildRecommendations(v, farm, category, caption);
  if (recs.length > 0) {
    parts.push(`💡 التوصيات:`);
    recs.forEach((r, i) => parts.push(`   ${i + 1}. ${r}`));
  }

  if (caption) {
    parts.push(``);
    parts.push(`📝 ملاحظة المراقب: "${caption}"`);
  }

  return parts.join("\n");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function descBrightness(b: number): string {
  if (b < 15) return "مظلم جداً";
  if (b < 30) return "مظلم";
  if (b < 45) return "خافت";
  if (b < 65) return "متوسط";
  if (b < 80) return "جيد";
  if (b < 92) return "مضيء جداً";
  return "ساطع (قد يكون مبالغاً)";
}

function descEntropy(e: number): string {
  if (e < 15) return "صورة بسيطة جداً / خالية";
  if (e < 30) return "بيئة هادئة";
  if (e < 50) return "نشاط طبيعي";
  if (e < 70) return "بيئة مزدحمة";
  return "تفاصيل كثيرة جداً";
}

function descColorProfile(v: VisualData): string {
  if (v.saturation < 10) return "رمادي / أبيض وأسود (بيئة محايدة)";
  if (v.yellowScore > 20) return "دافئ (أصفر/برتقالي/بني) — علامة صحة إيجابية للطيور";
  if (v.blueScore > 20) return "بارد (أزرق/رمادي) — ماء أو معدات";
  if (v.greenScore > 20) return "أخضر — نباتات أو بيئة خارجية";
  if (v.redSpikeRatio > 5) return "حمراء بشكل غير طبيعي — يحتاج فحصاً";
  return "متوازن (ألوان متعددة طبيعية)";
}

interface ConditionResult {
  label: string;
  detail: string;
}

function assessCondition(v: VisualData, farm: FarmContext): ConditionResult {
  const problems: string[] = [];

  if (v.redSpikeRatio > 8) problems.push("احتمال نزيف");
  if (v.darkPixelRatio > 60) problems.push("إضاءة سيئة");
  if (farm.overdueTasks.filter(t => t.priority === "high").length > 0) problems.push("مهام متأخرة عالية الأولوية");
  if (farm.activeIncubators.some(i => {
    const t = parseFloat(i.temperature ?? "0");
    return t > 0 && (t < 37.2 || t > 38.0);
  })) problems.push("درجة حرارة حاضنة خارج النطاق");

  if (problems.length === 0 && v.brightness > 35 && v.redSpikeRatio < 3) {
    return { label: "✅ جيد", detail: "لا توجد مؤشرات مقلقة واضحة في الصورة" };
  } else if (problems.length === 1) {
    return { label: "⚠️ يحتاج انتباهاً", detail: `مشكلة محتملة: ${problems[0]}` };
  } else if (problems.length >= 2) {
    return { label: "🔴 يحتاج تدخلاً عاجلاً", detail: `مشاكل متعددة: ${problems.join("، ")}` };
  }
  return { label: "⚠️ يُراقَب", detail: "البيئة تحتاج متابعة مستمرة" };
}

function buildRecommendations(v: VisualData, farm: FarmContext, category: string, caption: string): string[] {
  const recs: string[] = [];
  const cap = caption.toLowerCase();

  if (v.redSpikeRatio > 8) recs.push("افحص جميع الطيور فوراً للكشف عن جروح أو نزيف");
  if (v.darkPixelRatio > 60) recs.push("تحقق من مصادر الإضاءة في الحظيرة — الطيور تحتاج 16 ساعة ضوء يومياً");

  const critIncubators = farm.activeIncubators.filter(i => {
    const t = parseFloat(i.temperature ?? "0");
    return t > 0 && (t < 37.2 || t > 38.0);
  });
  if (critIncubators.length > 0) {
    recs.push(`اضبط درجة حرارة الحاضنة "${critIncubators[0].batchName}" إلى النطاق الصحيح (37.5–38.0°م)`);
  }

  const hatchingSoon = farm.activeIncubators.filter(i => i.daysLeft >= 0 && i.daysLeft <= 3);
  if (hatchingSoon.length > 0) {
    recs.push(`جهّز حضّانة الكتاكيت — دفعة "${hatchingSoon[0].batchName}" ستفقس خلال ${hatchingSoon[0].daysLeft} أيام`);
  }

  if (farm.overdueTasks.length > 0) {
    const highPri = farm.overdueTasks.filter(t => t.priority === "high");
    if (highPri.length > 0) recs.push(`أنجز المهمة المتأخرة: "${highPri[0].title}"`);
  }

  // Category-specific
  if (category === "feed" || /علف|أكل/.test(cap)) recs.push("تحقق من مستوى العلف وجودته — ينبغي التجديد كل يوم");
  if (category === "incubator" || /حاضنة/.test(cap)) recs.push("راجع جدول قلب البيض (3 مرات يومياً كحد أدنى)");
  if (category === "health" || /مريض|ضعيف/.test(cap)) recs.push("عزل أي طير يبدو ضعيفاً وتواصل مع الطبيب البيطري");
  if (/ماء|شرب/.test(cap)) recs.push("تأكد من نظافة أوعية الشرب — اغسلها يومياً لمنع البكتيريا");

  if (recs.length === 0) {
    recs.push("استمر في المراقبة اليومية ووثّق أي تغيير في سلوك الطيور أو مظهرها");
  }

  return recs.slice(0, 4);
}

function formatArabicDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
  } catch { return dateStr; }
}
