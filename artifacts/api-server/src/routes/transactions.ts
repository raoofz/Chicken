import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { db, transactionsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/transactions", async (req, res) => {
  try {
    const { type, from, to, category } = req.query as Record<string, string>;
    const conditions = [];
    if (type && (type === "income" || type === "expense")) conditions.push(eq(transactionsTable.type, type));
    if (from) conditions.push(gte(transactionsTable.date, from));
    if (to) conditions.push(lte(transactionsTable.date, to));
    if (category) conditions.push(eq(transactionsTable.category, category));

    const rows = await db.select().from(transactionsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(transactionsTable.date));
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/transactions/summary", async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        type,
        category,
        TO_CHAR(date::date, 'YYYY-MM') as month,
        SUM(amount::numeric) as total,
        COUNT(*) as count
      FROM transactions
      GROUP BY type, category, month
      ORDER BY month DESC, type
    `);
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/transactions", async (req, res) => {
  try {
    const { date, type, category, description, amount, quantity, unit, notes } = req.body;
    if (!date || !type || !category || !description || !amount) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    if (!["income", "expense"].includes(type)) {
      res.status(400).json({ error: "Invalid type" });
      return;
    }
    const user = await db.execute(sql`SELECT username FROM users WHERE id = ${req.session.userId}`);
    const authorName = (user.rows[0] as any)?.username ?? null;

    const [row] = await db.insert(transactionsTable).values({
      date, type, category, description,
      amount: String(amount),
      quantity: quantity ? String(quantity) : null,
      unit: unit || null,
      notes: notes || null,
      authorId: req.session.userId,
      authorName,
    }).returning();
    res.status(201).json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/transactions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { date, type, category, description, amount, quantity, unit, notes } = req.body;
    const [row] = await db.update(transactionsTable).set({
      ...(date && { date }),
      ...(type && { type }),
      ...(category && { category }),
      ...(description && { description }),
      ...(amount !== undefined && { amount: String(amount) }),
      ...(quantity !== undefined && { quantity: quantity ? String(quantity) : null }),
      ...(unit !== undefined && { unit }),
      ...(notes !== undefined && { notes }),
    }).where(eq(transactionsTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/transactions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(transactionsTable).where(eq(transactionsTable.id, id));
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
