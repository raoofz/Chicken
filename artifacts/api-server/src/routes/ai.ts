import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, flocksTable, hatchingCyclesTable, tasksTable, goalsTable, dailyNotesTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import OpenAI from "openai";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "للمديرين فقط" });
    return;
  }
  next();
}

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

router.post("/ai/analyze", requireAdmin, async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const [flocks, hatchingCycles, tasks, goals, notes] = await Promise.all([
      db.select().from(flocksTable),
      db.select().from(hatchingCyclesTable),
      db.select().from(tasksTable),
      db.select().from(goalsTable),
      db.select().from(dailyNotesTable).orderBy(sql`${dailyNotesTable.date} DESC`).limit(20),
    ]);

    const activeCycles = hatchingCycles.filter(c => c.status === "incubating" || c.status === "hatching");
    const completedCycles = hatchingCycles.filter(c => c.status === "completed" && c.eggsHatched != null);
    const pendingTasks = tasks.filter(t => !t.completed);
    const todayTasks = tasks.filter(t => t.dueDate === today);
    const completedGoals = goals.filter(g => g.completed);

    let overallHatchRate = 0;
    if (completedCycles.length > 0) {
      const totalSet = completedCycles.reduce((a, c) => a + c.eggsSet, 0);
      const totalHatched = completedCycles.reduce((a, c) => a + (c.eggsHatched ?? 0), 0);
      overallHatchRate = totalSet > 0 ? Math.round((totalHatched / totalSet) * 100) : 0;
    }

    const farmData = {
      flocks: flocks.map(f => ({
        name: f.name, breed: f.breed, count: f.count, ageDays: f.ageDays, purpose: f.purpose, notes: f.notes,
      })),
      hatchingCycles: hatchingCycles.map(c => ({
        batchName: c.batchName, eggsSet: c.eggsSet, eggsHatched: c.eggsHatched, status: c.status,
        temperature: c.temperature ? Number(c.temperature) : null,
        humidity: c.humidity ? Number(c.humidity) : null,
        eggDate: c.eggDate, expectedHatchDate: c.expectedHatchDate,
      })),
      tasks: tasks.map(t => ({
        title: t.title, completed: t.completed, dueDate: t.dueDate, priority: t.priority, category: t.category,
      })),
      goals: goals.map(g => ({
        title: g.title, targetValue: g.targetValue, currentValue: g.currentValue, unit: g.unit, completed: g.completed, deadline: g.deadline,
      })),
      recentNotes: notes.map(n => ({
        content: n.content, date: n.date, category: n.category,
      })),
      summary: {
        totalFlocks: flocks.length,
        totalChickens: flocks.reduce((a, f) => a + f.count, 0),
        activeCycles: activeCycles.length,
        completedCycles: completedCycles.length,
        overallHatchRate,
        pendingTasks: pendingTasks.length,
        todayTasks: todayTasks.length,
        completedGoals: completedGoals.length,
        totalGoals: goals.length,
      },
    };

    const systemPrompt = `أنت مستشار ذكي لإدارة مزارع الدواجن والتفقيس. تحلل بيانات المزرعة وتقدم تقريراً شاملاً.

ردك يجب أن يكون بصيغة JSON فقط بالهيكل التالي:
{
  "alerts": [
    { "type": "danger|warning|info", "title": "عنوان التنبيه", "description": "وصف مفصل" }
  ],
  "sections": [
    {
      "tag": "🌡️ تحليل الفقاسة|🐔 صحة القطعان|✅ المهام|🎯 الأهداف|📝 المذكرات|📊 التوقعات",
      "title": "عنوان القسم",
      "content": "تحليل مفصل بفقرات واضحة"
    }
  ],
  "topPriority": "أهم شيء يجب فعله الآن",
  "stats": {
    "chickens": 0,
    "hatchRate": "0%",
    "activeCycles": 0,
    "tasksDone": "0/0",
    "goals": "0/0",
    "urgentItems": 0
  }
}

قواعد مهمة:
- رد بالعربية فقط
- كن دقيقاً ومحدداً بناءً على الأرقام الفعلية
- إذا كانت درجة الحرارة أو الرطوبة خارج النطاق المثالي، أعط تنبيه danger
- حلل المذكرات اليومية وابحث عن أنماط أو مشاكل متكررة
- أعط توقعات بناءً على البيانات الحالية
- رد بـ JSON فقط بدون أي نص إضافي`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `بيانات المزرعة:\n${JSON.stringify(farmData, null, 2)}` },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      res.status(500).json({ error: "لم يتم الحصول على رد من الذكاء الاصطناعي" });
      return;
    }

    const analysis = JSON.parse(content);
    res.json({ analysis, rawData: farmData.summary, timestamp: new Date().toISOString() });
  } catch (err: any) {
    logger.error({ err }, "AI analysis failed");
    res.status(500).json({ error: "فشل التحليل: " + (err?.message ?? "خطأ غير معروف") });
  }
});

export default router;
