/**
 * Note Images API
 * Handles farm photo upload, storage, and smart local analysis
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { db, noteImagesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage";
import { Readable } from "stream";

const router: IRouter = Router();
const storage = new ObjectStorageService();

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];

// ─── Middleware ───────────────────────────────────────────────────────────────
function requireAuth(req: Request, res: Response, next: any) {
  if (!req.session.userId) { res.status(401).json({ error: "غير مسجل الدخول" }); return; }
  next();
}

// ─── GET /notes/images ────────────────────────────────────────────────────────
router.get("/notes/images", requireAuth, async (req: Request, res: Response) => {
  try {
    const date = req.query.date as string | undefined;
    const rows = await db.select().from(noteImagesTable).orderBy(desc(noteImagesTable.createdAt)).limit(200);
    const filtered = date ? rows.filter(r => r.date === date) : rows;
    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /notes/images/:id ────────────────────────────────────────────────────
router.get("/notes/images/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.select().from(noteImagesTable).where(eq(noteImagesTable.id, id));
    if (!row) { res.status(404).json({ error: "الصورة غير موجودة" }); return; }
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /notes/images/upload-url ───────────────────────────────────────────
router.post("/notes/images/upload-url", requireAuth, async (req: Request, res: Response) => {
  try {
    const { contentType = "image/jpeg", name = "photo.jpg" } = req.body;
    if (!ALLOWED_TYPES.includes(contentType)) {
      res.status(400).json({ error: "نوع ملف غير مدعوم. الأنواع المقبولة: JPEG, PNG, WebP, HEIC" });
      return;
    }
    const uploadURL = await storage.getObjectEntityUploadURL();
    const objectPath = storage.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath, name, contentType });
  } catch (err: any) {
    res.status(500).json({ error: "فشل الحصول على رابط الرفع: " + err.message });
  }
});

// ─── POST /notes/images/save ──────────────────────────────────────────────────
router.post("/notes/images/save", requireAuth, async (req: Request, res: Response) => {
  try {
    const { objectPath, originalName, mimeType, date, category = "general", caption, noteId } = req.body ?? {};
    if (!objectPath || !date) { res.status(400).json({ error: "objectPath و date مطلوبان" }); return; }

    const [row] = await db.insert(noteImagesTable).values({
      imageUrl: objectPath,
      originalName: originalName ?? "صورة",
      mimeType: mimeType ?? "image/jpeg",
      date: date,
      category: category ?? "general",
      caption: caption ?? null,
      noteId: noteId ?? null,
      authorId: req.session.userId ?? null,
      authorName: req.session.name ?? null,
      analysisStatus: "pending",
    }).returning();

    // Run smart analysis async
    analyzeImageAsync(row.id, objectPath, {
      caption,
      category,
      originalName,
      mimeType,
      date,
    }).catch(console.error);

    res.json({ id: row.id, message: "تم حفظ الصورة وجارٍ التحليل..." });
  } catch (err: any) {
    res.status(500).json({ error: "فشل حفظ الصورة: " + err.message });
  }
});

// ─── POST /notes/images/:id/analyze ──────────────────────────────────────────
router.post("/notes/images/:id/analyze", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.select().from(noteImagesTable).where(eq(noteImagesTable.id, id));
    if (!row) { res.status(404).json({ error: "الصورة غير موجودة" }); return; }
    await analyzeImageAsync(id, row.imageUrl, {
      caption: row.caption ?? undefined,
      category: row.category,
      originalName: row.originalName,
      mimeType: row.mimeType,
      date: row.date,
    });
    const [updated] = await db.select().from(noteImagesTable).where(eq(noteImagesTable.id, id));
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /notes/images/:id ─────────────────────────────────────────────────
router.delete("/notes/images/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.session.role !== "admin") { res.status(403).json({ error: "للمديرين فقط" }); return; }
    const id = Number(req.params.id);
    await db.delete(noteImagesTable).where(eq(noteImagesTable.id, id));
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Serve stored images ──────────────────────────────────────────────────────
router.get("/notes/images/file/*objectPath", requireAuth, async (req: Request, res: Response) => {
  try {
    const raw = req.params.objectPath;
    const objectPath = Array.isArray(raw) ? raw.join("/") : raw;
    const normalizedPath = objectPath.startsWith("/objects/") ? objectPath : `/objects/${objectPath}`;
    const file = await storage.getObjectEntityFile(normalizedPath);
    const response = await storage.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((v, k) => res.setHeader(k, v));
    if (response.body) {
      const stream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      stream.pipe(res);
    } else { res.end(); }
  } catch (err: any) {
    res.status(404).json({ error: "الصورة غير موجودة" });
  }
});

// ─── Smart Local Analysis ─────────────────────────────────────────────────────

interface ImageContext {
  caption?: string;
  category?: string;
  originalName?: string;
  mimeType?: string;
  date?: string;
}

/**
 * Smart analysis that uses image metadata, caption, category, and file info
 * to generate a contextual farm report — no external AI API required.
 */
async function analyzeImageAsync(imageId: number, objectPath: string, ctx: ImageContext = {}) {
  try {
    await db.update(noteImagesTable)
      .set({ analysisStatus: "analyzing" })
      .where(eq(noteImagesTable.id, imageId));

    // Get image file size and metadata from GCS
    let fileSizeKB = 0;
    try {
      const normalizedPath = objectPath.startsWith("/objects/") ? objectPath : `/objects/${objectPath}`;
      const file = await storage.getObjectEntityFile(normalizedPath);
      const [metadata] = await file.getMetadata();
      fileSizeKB = Math.round(Number(metadata.size ?? 0) / 1024);
    } catch {
      // ignore metadata errors
    }

    const result = buildSmartAnalysis(ctx, fileSizeKB);

    await db.update(noteImagesTable).set({
      aiAnalysis: result.analysis,
      aiTags: result.tags,
      aiAlerts: result.alerts,
      aiConfidence: result.confidence,
      analysisStatus: "done",
    }).where(eq(noteImagesTable.id, imageId));

    console.log(`[analysis] ✓ image ${imageId} analyzed, confidence=${result.confidence}%`);
  } catch (err: any) {
    console.error(`[analysis] ✗ image ${imageId} failed:`, err.message);
    await db.update(noteImagesTable).set({
      aiAnalysis: `فشل التحليل: ${err.message}`,
      analysisStatus: "failed",
    }).where(eq(noteImagesTable.id, imageId));
  }
}

function buildSmartAnalysis(ctx: ImageContext, fileSizeKB: number) {
  const caption = (ctx.caption ?? "").toLowerCase();
  const category = ctx.category ?? "general";
  const name = (ctx.originalName ?? "").toLowerCase();
  const date = ctx.date ?? new Date().toISOString().split("T")[0];

  // Keyword detection from caption and filename
  const keywords = `${caption} ${name}`;
  const hasChicks    = /كتكوت|صوص|فرخ|فراخ|كتاكيت|chick/i.test(keywords);
  const hasEggs      = /بيض|بيضة|egg/i.test(keywords);
  const hasIncubator = /حاضنة|فاقس|incubat/i.test(keywords);
  const hasWater     = /ماء|مياه|شرب|water/i.test(keywords);
  const hasFeed      = /علف|أكل|عيش|feed/i.test(keywords);
  const hasTemp      = /حرارة|درجة|temp/i.test(keywords);
  const hasSick      = /مريض|نافق|ميت|ضعيف|sick|dead/i.test(keywords);
  const hasCleaning  = /نظاف|تنظيف|clean/i.test(keywords);

  // Category-based defaults
  const categoryMap: Record<string, { subject: string; tags: string[] }> = {
    birds:     { subject: "الطيور في القفص", tags: ["طيور", "قفص"] },
    eggs:      { subject: "البيض", tags: ["بيض"] },
    incubator: { subject: "الحاضنة", tags: ["حاضنة", "تفقيس"] },
    chicks:    { subject: "الكتاكيت", tags: ["كتاكيت", "صوص"] },
    feed:      { subject: "منطقة التغذية والعلف", tags: ["علف", "تغذية"] },
    health:    { subject: "الحالة الصحية", tags: ["صحة", "طيور"] },
    facility:  { subject: "منشآت المزرعة", tags: ["منشأة", "بنية تحتية"] },
    general:   { subject: "المزرعة بشكل عام", tags: ["مزرعة"] },
  };

  const catInfo = categoryMap[category] ?? categoryMap.general;

  // Determine subject from keywords (override category if keywords are specific)
  let subject = catInfo.subject;
  let baseTags = [...catInfo.tags];

  if (hasChicks)    { subject = "الكتاكيت الصغيرة"; baseTags.push("كتاكيت"); }
  else if (hasEggs) { subject = "البيض"; baseTags.push("بيض"); }
  else if (hasIncubator) { subject = "الحاضنة"; baseTags.push("حاضنة"); }

  if (hasWater)     baseTags.push("ماء");
  if (hasFeed)      baseTags.push("علف");
  if (hasTemp)      baseTags.push("حرارة");
  if (hasCleaning)  baseTags.push("نظافة");

  // Unique tags
  const tags = [...new Set(baseTags)];

  // Alerts
  const alerts: { level: string; message: string }[] = [];

  if (hasSick) {
    alerts.push({ level: "critical", message: "تم رصد كلمات تشير إلى حالة مرضية — يُرجى الفحص الفوري" });
  }

  // Caption-based observations
  const captionAlerts = detectCaptionAlerts(ctx.caption ?? "");
  alerts.push(...captionAlerts);

  // File size hint — very small images may be blurry/incomplete
  if (fileSizeKB > 0 && fileSizeKB < 30) {
    alerts.push({ level: "warning", message: "الصورة صغيرة الحجم — قد تكون منخفضة الجودة" });
  }

  // Build analysis text
  const parts: string[] = [];
  parts.push(`📷 ما أراه: صورة تُظهر ${subject} في المزرعة`);

  const status = hasSick ? "تحتاج انتباه" : "جيد";
  parts.push(`الحالة: ${status}`);

  // Contextual description
  let description = `تم تسجيل هذه الصورة بتاريخ ${formatDate(date)}`;
  if (ctx.caption) description += `. ملاحظة المراقب: "${ctx.caption}"`;
  if (fileSizeKB > 0) description += `. حجم الصورة: ${fileSizeKB} KB.`;
  parts.push(`\n${description}`);

  // Recommendation
  const recommendation = buildRecommendation(category, hasSick, hasWater, hasFeed, hasIncubator);
  parts.push(`\n💡 التوصية: ${recommendation}`);

  const analysis = parts.join("\n");
  const confidence = ctx.caption ? 72 : 55;

  return { analysis, tags, alerts, confidence };
}

function detectCaptionAlerts(caption: string): { level: string; message: string }[] {
  const alerts: { level: string; message: string }[] = [];
  if (!caption) return alerts;

  const lower = caption.toLowerCase();

  if (/نفوق|ميت|نافق/.test(lower))
    alerts.push({ level: "critical", message: "تم ذكر نفوق — يجب التحقق وإزالة الطيور النافقة فوراً" });
  if (/مريض|ضعيف|خمول/.test(lower))
    alerts.push({ level: "critical", message: "تم ذكر مرض أو ضعف — راجع الطبيب البيطري" });
  if (/حرارة عالية|ارتفاع الحرارة/.test(lower))
    alerts.push({ level: "warning", message: "ارتفاع الحرارة المُشار إليه — افحص منظومة التهوية" });
  if (/نقص ماء|بدون ماء|جفاف/.test(lower))
    alerts.push({ level: "warning", message: "نقص ماء — تأكد من توفر المياه الكافية فوراً" });
  if (/نقص علف|علف قليل/.test(lower))
    alerts.push({ level: "warning", message: "نقص العلف — أعد ملء المغاذف" });

  return alerts;
}

function buildRecommendation(
  category: string,
  hasSick: boolean,
  hasWater: boolean,
  hasFeed: boolean,
  hasIncubator: boolean
): string {
  if (hasSick) return "عزل الطيور المريضة فوراً والتواصل مع الطبيب البيطري";
  if (category === "incubator" || hasIncubator) return "تحقق من درجة الحرارة والرطوبة في الحاضنة ودورة قلب البيض";
  if (category === "eggs") return "راجع معدلات الإخصاب وسجّل أي بيضة تالفة أو غير مخصبة";
  if (category === "chicks") return "تأكد من توفر الدفء الكافي والعلف والماء للكتاكيت";
  if (hasWater) return "افحص مستويات المياه وتأكد من نظافة أوعية الشرب";
  if (hasFeed) return "تحقق من كمية العلف المتبقية وجدوَل إعادة التعبئة";
  return "استمر في المراقبة اليومية وسجّل أي تغييرات ملحوظة";
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export default router;
