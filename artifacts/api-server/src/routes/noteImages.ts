/**
 * Note Images API
 * Handles farm photo upload, storage, and AI vision analysis
 * Uses OpenAI GPT-4 Vision via Replit AI Integrations
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { db, noteImagesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage";
import OpenAI from "openai";
import { Readable } from "stream";

const router: IRouter = Router();
const storage = new ObjectStorageService();

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];
const MAX_SIZE_MB = 10;

// ─── Middleware ───────────────────────────────────────────────────────────────
function requireAuth(req: Request, res: Response, next: any) {
  if (!req.session.userId) { res.status(401).json({ error: "غير مسجل الدخول" }); return; }
  next();
}

// ─── GET /notes/images — List images (with optional date filter) ─────────────
router.get("/notes/images", requireAuth, async (req: Request, res: Response) => {
  try {
    const date = req.query.date as string | undefined;
    let query = db.select().from(noteImagesTable).orderBy(desc(noteImagesTable.createdAt)).limit(200);
    const rows = await query;
    const filtered = date ? rows.filter(r => r.date === date) : rows;
    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /notes/images/:id — Get single image ─────────────────────────────────
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

// ─── POST /notes/images/upload-url — Get presigned upload URL ────────────────
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

// ─── POST /notes/images/save — Save image record after upload ────────────────
router.post("/notes/images/save", requireAuth, async (req: Request, res: Response) => {
  try {
    const { objectPath, originalName, mimeType, date, category = "general", caption, noteId } = req.body ?? {};
    const body = { objectPath, originalName, mimeType, date, category, caption, noteId };
    if (!objectPath || !date) { res.status(400).json({ error: "objectPath و date مطلوبان" }); return; }

    const [row] = await db.insert(noteImagesTable).values({
      imageUrl: body.objectPath,
      originalName: body.originalName ?? "صورة",
      mimeType: body.mimeType ?? "image/jpeg",
      date: body.date,
      category: body.category ?? "general",
      caption: body.caption ?? null,
      noteId: body.noteId ?? null,
      authorId: req.session.userId ?? null,
      authorName: req.session.name ?? null,
      analysisStatus: "pending",
    }).returning();

    // Trigger AI analysis async (don't block the response)
    analyzeImageAsync(row.id, body.objectPath).catch(console.error);

    res.json({ id: row.id, message: "تم حفظ الصورة وجارٍ التحليل..." });
  } catch (err: any) {
    res.status(500).json({ error: "فشل حفظ الصورة: " + err.message });
  }
});

// ─── POST /notes/images/:id/analyze — Re-analyze an image ──────────────────
router.post("/notes/images/:id/analyze", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.select().from(noteImagesTable).where(eq(noteImagesTable.id, id));
    if (!row) { res.status(404).json({ error: "الصورة غير موجودة" }); return; }
    await analyzeImageAsync(id, row.imageUrl);
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

// ─── AI Vision Analysis ───────────────────────────────────────────────────────
async function analyzeImageAsync(imageId: number, objectPath: string) {
  try {
    // Update status to analyzing
    await db.update(noteImagesTable)
      .set({ analysisStatus: "analyzing" })
      .where(eq(noteImagesTable.id, imageId));

    // Build the public URL for the image
    const imageUrl = buildImageAccessUrl(objectPath);

    const systemPrompt = `أنت خبير متخصص في إدارة مزارع الدواجن والتفقيس. مهمتك تحليل صور المزرعة وتقديم تقرير دقيق ومفيد.

قواعد التحليل:
- ركّز على ما يظهر في الصورة فعلياً
- اكتشف أي مشاكل أو مخاوف محتملة
- قدّم توصيات عملية وقابلة للتنفيذ
- استخدم اللغة العربية البسيطة التي يفهمها العمال
- لا تخترع معلومات غير مرئية في الصورة`;

    const userPrompt = `حلّل هذه الصورة من مزرعة الدواجن. قدّم تقريراً يتضمن:

1. **ما تراه**: صف محتويات الصورة بإيجاز (طيور، بيض، حاضنة، معدات...)
2. **الحالة الصحية**: هل الطيور/البيض/الحاضنة في حالة جيدة؟
3. **تنبيهات**: أي مشاكل واضحة (كثافة عالية، طيور مريضة، درجة حرارة خاطئة، نقص ماء/علف...)
4. **توصية فورية**: ما الذي يجب فعله الآن؟

أجب بتنسيق JSON:
{
  "ما_أراه": "وصف قصير",
  "الحالة": "ممتاز | جيد | تحتاج انتباه | خطر",
  "التحليل": "تحليل مفصل بـ 2-3 جمل",
  "تنبيهات": ["تنبيه 1", "تنبيه 2"],
  "التوصية": "ماذا تفعل الآن",
  "العلامات": ["طيور", "حاضنة", "بيض", ...أي علامات مناسبة],
  "الثقة": 85
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1000,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "high" },
            },
            { type: "text", text: userPrompt },
          ],
        },
      ],
    });

    const rawContent = response.choices[0]?.message?.content ?? "{}";

    // Parse the JSON response
    let parsed: any = {};
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch { parsed = { التحليل: rawContent }; }

    // Build human-readable analysis
    const analysis = [
      parsed["ما_أراه"] ? `📷 **ما أراه:** ${parsed["ما_أراه"]}` : "",
      parsed["الحالة"] ? `✅ **الحالة:** ${parsed["الحالة"]}` : "",
      parsed["التحليل"] ? `\n${parsed["التحليل"]}` : "",
      parsed["التوصية"] ? `\n💡 **التوصية:** ${parsed["التوصية"]}` : "",
    ].filter(Boolean).join("\n");

    const alerts = (parsed["تنبيهات"] ?? []).map((msg: string) => {
      const isUrgent = msg.includes("خطر") || msg.includes("مرض") || msg.includes("ميت") || msg.includes("طارئ");
      return { level: isUrgent ? "critical" : "warning", message: msg };
    });

    const tags = parsed["العلامات"] ?? [];
    const confidence = Number(parsed["الثقة"] ?? 75);

    await db.update(noteImagesTable).set({
      aiAnalysis: analysis,
      aiTags: tags,
      aiAlerts: alerts,
      aiConfidence: confidence,
      analysisStatus: "done",
    }).where(eq(noteImagesTable.id, imageId));

  } catch (err: any) {
    console.error("[vision] analysis failed:", err.message);
    await db.update(noteImagesTable).set({
      aiAnalysis: "فشل التحليل التلقائي — يمكنك إعادة المحاولة",
      analysisStatus: "failed",
    }).where(eq(noteImagesTable.id, imageId));
  }
}

function buildImageAccessUrl(objectPath: string): string {
  // objectPath is like /objects/uuid — we serve it via our own API
  const path = objectPath.startsWith("/objects/") ? objectPath.replace("/objects/", "") : objectPath;
  // Use localhost for server-side access since we can't hit the proxy from inside the container
  return `http://localhost:${process.env.PORT ?? 8080}/api/notes/images/file/${path}`;
}

export default router;
