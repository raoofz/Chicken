import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { db, transactionsTable } from "@workspace/db";
import {
  categoryToDomain,
  validateCategoryDomainConsistency,
} from "../lib/farmDomains.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

router.get("/transactions", async (req, res) => {
  try {
    const { type, from, to, category, domain } = req.query as Record<string, string>;
    const conditions = [];
    if (type && (type === "income" || type === "expense")) conditions.push(eq(transactionsTable.type, type));
    if (from)     conditions.push(gte(transactionsTable.date, from));
    if (to)       conditions.push(lte(transactionsTable.date, to));
    if (category) conditions.push(eq(transactionsTable.category, category));
    if (domain)   conditions.push(eq(transactionsTable.domain, domain));

    const rows = await db.select().from(transactionsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(transactionsTable.date));
    res.json(rows);
  } catch (e: any) {
    logger.error({ err: e }, "[transactions] GET list failed");
    res.status(500).json({ error: e.message });
  }
});

router.get("/transactions/summary", async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        type,
        category,
        domain,
        TO_CHAR(date::date, 'YYYY-MM') as month,
        SUM(amount::numeric) as total,
        COUNT(*) as count
      FROM transactions
      GROUP BY type, category, domain, month
      ORDER BY month DESC, type
    `);
    res.json(result.rows);
  } catch (e: any) {
    logger.error({ err: e }, "[transactions] GET summary failed");
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
      res.status(400).json({ error: "Invalid type: must be 'income' or 'expense'" });
      return;
    }

    // ── SSOT domain integrity check ──────────────────────────────────────────
    const domainError = validateCategoryDomainConsistency(type as "income" | "expense", category);
    if (domainError) {
      logger.warn({ type, category, domainError }, "[transactions] domain integrity violation rejected");
      res.status(400).json({ error: domainError });
      return;
    }

    const user = await db.execute(sql`SELECT username FROM users WHERE id = ${req.session.userId}`);
    const authorName = (user.rows[0] as any)?.username ?? null;
    const derivedDomain = categoryToDomain(category);

    const [row] = await db.insert(transactionsTable).values({
      date,
      type,
      category,
      domain: derivedDomain,   // SSOT — always derived server-side, never trusted from client
      description,
      amount:   String(amount),
      quantity: quantity ? String(quantity) : null,
      unit:     unit || null,
      notes:    notes || null,
      authorId:   req.session.userId,
      authorName,
    }).returning();

    logger.info(
      { id: row.id, type, category, domain: derivedDomain, amount: String(amount) },
      "[transactions] created",
    );
    res.status(201).json(row);
  } catch (e: any) {
    logger.error({ err: e }, "[transactions] POST failed");
    res.status(500).json({ error: e.message });
  }
});

router.put("/transactions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { date, type, category, description, amount, quantity, unit, notes } = req.body;

    // If category is being updated, re-derive domain and re-validate
    const updateDomain = category ? categoryToDomain(category) : undefined;
    if (type && category) {
      const domainError = validateCategoryDomainConsistency(type as "income" | "expense", category);
      if (domainError) {
        logger.warn({ id, type, category, domainError }, "[transactions] PUT domain integrity violation rejected");
        res.status(400).json({ error: domainError });
        return;
      }
    }

    const [row] = await db.update(transactionsTable).set({
      ...(date        && { date }),
      ...(type        && { type }),
      ...(category    && { category, domain: updateDomain }),
      ...(description && { description }),
      ...(amount      !== undefined && { amount: String(amount) }),
      ...(quantity    !== undefined && { quantity: quantity ? String(quantity) : null }),
      ...(unit        !== undefined && { unit }),
      ...(notes       !== undefined && { notes }),
    }).where(eq(transactionsTable.id, id)).returning();

    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    logger.info({ id, category, domain: updateDomain }, "[transactions] updated");
    res.json(row);
  } catch (e: any) {
    logger.error({ err: e }, "[transactions] PUT failed");
    res.status(500).json({ error: e.message });
  }
});

router.delete("/transactions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(transactionsTable).where(eq(transactionsTable.id, id));
    logger.info({ id }, "[transactions] deleted");
    res.status(204).send();
  } catch (e: any) {
    logger.error({ err: e }, "[transactions] DELETE failed");
    res.status(500).json({ error: e.message });
  }
});

export default router;
