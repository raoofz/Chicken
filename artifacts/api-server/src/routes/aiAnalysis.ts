import { Router, type IRouter } from "express";
import { db, flocksTable, hatchingCyclesTable, tasksTable, goalsTable, dailyNotesTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

router.post("/ai/analyze", async (req, res) => {
  try {
    const [flocks, hatchingCycles, tasks, goals, notes] = await Promise.all([
      db.select().from(flocksTable),
      db.select().from(hatchingCyclesTable).orderBy(desc(hatchingCyclesTable.createdAt)).limit(10),
      db.select().from(tasksTable).limit(50),
      db.select().from(goalsTable),
      db.select().from(dailyNotesTable).orderBy(desc(dailyNotesTable.createdAt)).limit(30),
    ]);

    const totalChickens = flocks.reduce((s, f) => s + f.count, 0);
    const completedTasks = tasks.filter(t => t.completed).length;
    const completedGoals = goals.filter(g => g.completed).length;
    const avgHatchRate = hatchingCycles.length
      ? hatchingCycles
          .filter(c => c.eggsHatched != null && c.eggsSet > 0)
          .reduce((s, c) => s + (c.eggsHatched! / c.eggsSet) * 100, 0) /
        Math.max(1, hatchingCycles.filter(c => c.eggsHatched != null).length)
      : 0;

    const dataSnapshot = {
      totalChickens,
      totalFlocks: flocks.length,
      flocks: flocks.map(f => ({
        name: f.name, breed: f.breed, count: f.count, ageWeeks: f.ageWeeks, purpose: f.purpose, notes: f.notes,
      })),
      hatchingCycles: hatchingCycles.map(c => ({
        batchName: c.batchName, eggsSet: c.eggsSet, eggsHatched: c.eggsHatched,
        status: c.status, startDate: c.startDate, notes: c.notes,
      })),
      taskStats: { total: tasks.length, completed: completedTasks, pending: tasks.length - completedTasks },
      goalStats: { total: goals.length, completed: completedGoals },
      avgHatchRate: Math.round(avgHatchRate),
      recentNotes: notes.map(n => ({ date: n.date, content: n.content, category: n.category })),
    };

    const systemPrompt = `أنت مستشار متخصص في إدارة مزارع الدواجن. مهمتك تحليل بيانات المزرعة وتقديم رؤى وحلول عملية باللغة العربية. 
كن دقيقاً وعملياً واذكر أرقاماً محددة. قدم تحليلك في هيئة أقسام منظمة.`;

    const userPrompt = `حلل بيانات مزرعة الدواجن التالية وقدم:
1. تقييم الوضع الراهن
2. نقاط القوة والضعف  
3. مشاكل محتملة مع حلولها
4. توصيات لزيادة الأرباح
5. خطة عمل للأسبوعين القادمين

بيانات المزرعة:
${JSON.stringify(dataSnapshot, null, 2)}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const analysis = completion.choices[0]?.message?.content ?? "لم يتمكن النظام من إجراء التحليل";
    res.json({ analysis, dataSnapshot, generatedAt: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "AI analysis failed");
    res.status(500).json({ error: "فشل في إجراء التحليل" });
  }
});

export default router;
