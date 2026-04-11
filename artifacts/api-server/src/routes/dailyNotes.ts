import { Router, type IRouter } from "express";
import { db, dailyNotesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/notes", async (req, res) => {
  const { date } = req.query as { date?: string };
  let notes;
  if (date) {
    notes = await db.select().from(dailyNotesTable)
      .where(eq(dailyNotesTable.date, date))
      .orderBy(desc(dailyNotesTable.createdAt));
  } else {
    notes = await db.select().from(dailyNotesTable)
      .orderBy(desc(dailyNotesTable.createdAt))
      .limit(100);
  }
  res.json(notes.map(n => ({ ...n, createdAt: n.createdAt.toISOString() })));
});

router.post("/notes", async (req, res) => {
  const { content, date, category, authorName } = req.body as {
    content: string;
    date: string;
    category?: string;
    authorName?: string;
  };
  if (!content || !date) {
    res.status(400).json({ error: "المحتوى والتاريخ مطلوبان" });
    return;
  }
  const [note] = await db.insert(dailyNotesTable).values({
    content,
    date,
    category: category ?? "general",
    authorName: authorName ?? req.session.name ?? "مجهول",
    authorId: req.session.userId,
  }).returning();
  res.status(201).json({ ...note, createdAt: note.createdAt.toISOString() });
});

router.delete("/notes/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(dailyNotesTable).where(eq(dailyNotesTable.id, id));
  res.status(204).send();
});

export default router;
