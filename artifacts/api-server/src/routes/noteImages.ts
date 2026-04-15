/**
 * Note Images API
 * — Upload, store & serve farm photos
 * — Industry-level CV analysis via visionEngine
 * — Daily/weekly report aggregation
 * — Temporal comparison
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { db, noteImagesTable, flocksTable } from "@workspace/db";
import { desc, eq, and, gte, lte } from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage";
import { analyzeImage } from "../lib/visionEngine";
import { Readable } from "stream";

const router: IRouter = Router();
const storage = new ObjectStorageService();

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];

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
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── GET /notes/images/report — daily or weekly aggregate ────────────────────
router.get("/notes/images/report", requireAuth, async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || "weekly";
    const endDate = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    const end = new Date(endDate);
    const start = new Date(endDate);
    if (period === "daily") {
      start.setDate(start.getDate() - 1);
    } else {
      start.setDate(start.getDate() - 6);
    }
    const startStr = start.toISOString().slice(0, 10);

    const rows = await db.select().from(noteImagesTable)
      .where(and(gte(noteImagesTable.date, startStr), lte(noteImagesTable.date, endDate), eq(noteImagesTable.analysisStatus, "done")))
      .orderBy(noteImagesTable.date);

    const analyzed = rows.filter(r => r.visualMetrics !== null);

    if (analyzed.length === 0) {
      res.json({ period, startDate: startStr, endDate, imageCount: rows.length, analyzedCount: 0, summary: null, dailyBreakdown: [] });
      return;
    }

    const metrics = analyzed.map(r => r.visualMetrics as Record<string, number>);

    const avg = (key: string) => {
      const vals = metrics.map(m => m[key]).filter(v => typeof v === "number");
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    };
    const trend = (key: string) => {
      const vals = metrics.map(m => m[key]).filter(v => typeof v === "number");
      if (vals.length < 2) return "stable";
      const first = vals.slice(0, Math.ceil(vals.length / 2));
      const last = vals.slice(Math.floor(vals.length / 2));
      const firstAvg = first.reduce((a, b) => a + b, 0) / first.length;
      const lastAvg = last.reduce((a, b) => a + b, 0) / last.length;
      const diff = lastAvg - firstAvg;
      return diff > 5 ? "up" : diff < -5 ? "down" : "stable";
    };

    // Group by date
    const byDate: Record<string, { riskScore: number[]; activityLevel: number[]; healthScore: number[]; imageCount: number }> = {};
    for (const row of analyzed) {
      if (!byDate[row.date]) byDate[row.date] = { riskScore: [], activityLevel: [], healthScore: [], imageCount: 0 };
      const m = row.visualMetrics as Record<string, number>;
      byDate[row.date].riskScore.push(m.riskScore ?? 0);
      byDate[row.date].activityLevel.push(m.activityLevel ?? 0);
      byDate[row.date].healthScore.push(m.healthScore ?? 0);
      byDate[row.date].imageCount++;
    }

    const dailyBreakdown = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({
      date,
      imageCount: d.imageCount,
      avgRisk: Math.round(d.riskScore.reduce((a, b) => a + b, 0) / d.riskScore.length),
      avgActivity: Math.round(d.activityLevel.reduce((a, b) => a + b, 0) / d.activityLevel.length),
      avgHealth: Math.round(d.healthScore.reduce((a, b) => a + b, 0) / d.healthScore.length),
    }));

    const overallRisk = avg("riskScore");
    const summary = {
      overallRisk,
      overallStatus: overallRisk >= 65 ? "critical" : overallRisk >= 35 ? "warning" : "good",
      avgActivityLevel: avg("activityLevel"),
      avgHealthScore: avg("healthScore"),
      avgCrowdingScore: avg("crowdingScore"),
      avgFloorCleanliness: avg("floorCleanliness"),
      avgLightingScore: avg("lightingScore"),
      riskTrend: trend("riskScore"),
      activityTrend: trend("activityLevel"),
      healthTrend: trend("healthScore"),
    };

    res.json({ period, startDate: startStr, endDate, imageCount: rows.length, analyzedCount: analyzed.length, summary, dailyBreakdown });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── GET /notes/images/:id ────────────────────────────────────────────────────
router.get("/notes/images/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.select().from(noteImagesTable).where(eq(noteImagesTable.id, id));
    if (!row) { res.status(404).json({ error: "الصورة غير موجودة" }); return; }
    res.json(row);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── POST /notes/images/upload-url ───────────────────────────────────────────
router.post("/notes/images/upload-url", requireAuth, async (req: Request, res: Response) => {
  try {
    const { contentType = "image/jpeg" } = req.body;
    if (!ALLOWED_TYPES.includes(contentType)) {
      res.status(400).json({ error: "نوع ملف غير مدعوم" }); return;
    }
    const uploadURL = await storage.getObjectEntityUploadURL();
    const objectPath = storage.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath, contentType });
  } catch (err: any) { res.status(500).json({ error: "فشل الحصول على رابط الرفع: " + err.message }); }
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
      date,
      category: category ?? "general",
      caption: caption ?? null,
      noteId: noteId ?? null,
      authorId: req.session.userId ?? null,
      authorName: req.session.name ?? null,
      analysisStatus: "pending",
    }).returning();

    runVisionAnalysis(row.id, objectPath, { mimeType: mimeType ?? "image/jpeg", date, category, caption: caption ?? "" }).catch(console.error);
    res.json({ id: row.id, message: "تم حفظ الصورة وجارٍ تحليلها..." });
  } catch (err: any) { res.status(500).json({ error: "فشل حفظ الصورة: " + err.message }); }
});

// ─── POST /notes/images/:id/analyze ──────────────────────────────────────────
router.post("/notes/images/:id/analyze", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.select().from(noteImagesTable).where(eq(noteImagesTable.id, id));
    if (!row) { res.status(404).json({ error: "الصورة غير موجودة" }); return; }
    await runVisionAnalysis(id, row.imageUrl, { mimeType: row.mimeType, date: row.date, category: row.category, caption: row.caption ?? "" });
    const [updated] = await db.select().from(noteImagesTable).where(eq(noteImagesTable.id, id));
    res.json(updated);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── DELETE /notes/images/:id ─────────────────────────────────────────────────
router.delete("/notes/images/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.session.role !== "admin") { res.status(403).json({ error: "للمديرين فقط" }); return; }
    await db.delete(noteImagesTable).where(eq(noteImagesTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err: any) { res.status(500).json({ error: err.message }); }
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
  } catch { res.status(404).json({ error: "الصورة غير موجودة" }); }
});

// ─── Vision Analysis Runner ───────────────────────────────────────────────────

interface ImageCtx { mimeType: string | null; date: string; category: string; caption: string; }

async function runVisionAnalysis(imageId: number, objectPath: string, ctx: ImageCtx) {
  try {
    await db.update(noteImagesTable).set({ analysisStatus: "analyzing" }).where(eq(noteImagesTable.id, imageId));

    const normalizedPath = objectPath.startsWith("/objects/") ? objectPath : `/objects/${objectPath}`;
    const file = await storage.getObjectEntityFile(normalizedPath);
    const [[imageBuffer], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
    const mimeType = (metadata.contentType as string) || ctx.mimeType || "image/jpeg";
    const fileSize = Number(metadata.size ?? imageBuffer.length);

    const result = await analyzeImage(
      imageBuffer, mimeType, fileSize,
      ctx.date, ctx.category, ctx.caption, imageId,
    );

    await db.update(noteImagesTable).set({
      aiAnalysis: result.analysis,
      aiTags: result.tags,
      aiAlerts: result.alerts,
      aiConfidence: result.confidence,
      visualMetrics: { ...result.metrics, gridData: result.gridData } as any,
      riskScore: result.metrics.riskScore,
      analysisStatus: "done",
    }).where(eq(noteImagesTable.id, imageId));

    console.log(`[CV-AI] ✓ image ${imageId} | risk=${result.metrics.riskScore} activity=${result.metrics.activityLevel} crowding=${result.metrics.crowdingScore} confidence=${result.confidence}%`);

  } catch (err: any) {
    console.error(`[CV-AI] ✗ image ${imageId}:`, err.message);
    await db.update(noteImagesTable).set({
      aiAnalysis: `فشل التحليل: ${err.message}`,
      analysisStatus: "failed",
    }).where(eq(noteImagesTable.id, imageId));
  }
}

export default router;
