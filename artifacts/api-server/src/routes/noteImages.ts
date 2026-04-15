/**
 * Note Images API
 * Handles farm photo upload, storage, and pixel-level vision analysis
 * Uses Sharp for real image analysis + live farm data from DB
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { db, noteImagesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage";
import { analyzeImage } from "../lib/visionEngine";
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

    // Trigger full vision analysis async
    runVisionAnalysis(row.id, objectPath, {
      mimeType: mimeType ?? "image/jpeg",
      date,
      category,
      caption: caption ?? "",
    }).catch(console.error);

    res.json({ id: row.id, message: "تم حفظ الصورة وجارٍ تحليلها..." });
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
    await runVisionAnalysis(id, row.imageUrl, {
      mimeType: row.mimeType,
      date: row.date,
      category: row.category,
      caption: row.caption ?? "",
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

// ─── Vision Analysis Runner ───────────────────────────────────────────────────

interface ImageCtx {
  mimeType: string;
  date: string;
  category: string;
  caption: string;
}

async function runVisionAnalysis(imageId: number, objectPath: string, ctx: ImageCtx) {
  try {
    await db.update(noteImagesTable)
      .set({ analysisStatus: "analyzing" })
      .where(eq(noteImagesTable.id, imageId));

    // Download image from GCS
    const normalizedPath = objectPath.startsWith("/objects/") ? objectPath : `/objects/${objectPath}`;
    const file = await storage.getObjectEntityFile(normalizedPath);

    const [[imageBuffer], [metadata]] = await Promise.all([
      file.download(),
      file.getMetadata(),
    ]);

    const mimeType = (metadata.contentType as string) || ctx.mimeType || "image/jpeg";
    const fileSize = Number(metadata.size ?? imageBuffer.length);

    // Run full pixel-level vision analysis + farm context
    const result = await analyzeImage(
      imageBuffer,
      mimeType,
      fileSize,
      ctx.date,
      ctx.category,
      ctx.caption
    );

    await db.update(noteImagesTable).set({
      aiAnalysis: result.analysis,
      aiTags: result.tags,
      aiAlerts: result.alerts,
      aiConfidence: result.confidence,
      analysisStatus: "done",
    }).where(eq(noteImagesTable.id, imageId));

    const criticalCount = result.alerts.filter(a => a.level === "critical").length;
    console.log(
      `[vision] ✓ image ${imageId} analyzed | brightness=${result.visualData.brightness}% ` +
      `redSpike=${result.visualData.redSpikeRatio}% confidence=${result.confidence}% ` +
      `alerts=${result.alerts.length} (${criticalCount} critical)`
    );

  } catch (err: any) {
    console.error(`[vision] ✗ image ${imageId} failed:`, err.message);
    await db.update(noteImagesTable).set({
      aiAnalysis: `فشل التحليل: ${err.message}`,
      analysisStatus: "failed",
    }).where(eq(noteImagesTable.id, imageId));
  }
}

export default router;
