/**
 * Invoices + Payments router.
 * On every payment add/delete the invoice's paid_amount, remaining_amount and
 * status are recomputed inside a single DB transaction so the row is always
 * internally consistent.
 *   status: 'unpaid' (paid=0) | 'partial' (0 < paid < total) | 'paid' (paid >= total)
 */
import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, invoicesTable, paymentsTable } from "@workspace/db";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

function computeStatus(paid: number, total: number): "unpaid" | "partial" | "paid" {
  if (paid <= 0) return "unpaid";
  if (paid >= total) return "paid";
  return "partial";
}

/**
 * Recompute paid_amount / remaining_amount / status for an invoice.
 * Locks the invoice row with SELECT … FOR UPDATE so concurrent payment writes
 * for the same invoice serialize and never overwrite each other's totals.
 * Caller MUST be inside a db.transaction.
 */
export async function recomputeInvoice(tx: any, invoiceId: number) {
  // Acquire row lock first → blocks until any concurrent recompute on this
  // invoice has committed.
  const invRow = await tx.execute(
    sql`SELECT total_amount::numeric AS total FROM invoices WHERE id = ${invoiceId} FOR UPDATE`
  );
  if (invRow.rows.length === 0) throw new Error("Invoice not found");
  const total = Number((invRow.rows[0] as any).total ?? 0);

  const sumRow = await tx.execute(
    sql`SELECT COALESCE(SUM(amount::numeric),0) AS paid FROM payments WHERE invoice_id = ${invoiceId}`
  );
  const paid = Number((sumRow.rows[0] as any)?.paid ?? 0);
  const remaining = Math.max(0, total - paid);
  const status = computeStatus(paid, total);
  await tx.update(invoicesTable).set({
    paidAmount:      String(paid),
    remainingAmount: String(remaining),
    status,
  }).where(eq(invoicesTable.id, invoiceId));
  return { paid, remaining, status, total };
}

// ─── Invoices ─────────────────────────────────────────────────────────────────
router.get("/invoices", async (_req, res) => {
  try {
    const rows = await db.select().from(invoicesTable).orderBy(desc(invoicesTable.issueDate));
    res.json(rows);
  } catch (e: any) {
    logger.error({ err: e }, "[invoices] GET failed");
    res.status(500).json({ error: e.message });
  }
});

router.get("/invoices/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
    if (!invoice) { res.status(404).json({ error: "Not found" }); return; }
    const payments = await db.select().from(paymentsTable)
      .where(eq(paymentsTable.invoiceId, id))
      .orderBy(desc(paymentsTable.date));
    res.json({ invoice, payments });
  } catch (e: any) {
    logger.error({ err: e }, "[invoices] GET one failed");
    res.status(500).json({ error: e.message });
  }
});

router.post("/invoices", async (req, res) => {
  try {
    const { customerName, totalAmount, issueDate, dueDate, notes } = req.body;
    if (!customerName || totalAmount === undefined || !issueDate) {
      res.status(400).json({ error: "customerName, totalAmount, issueDate are required" });
      return;
    }
    const [row] = await db.insert(invoicesTable).values({
      customerName,
      totalAmount:     String(totalAmount),
      paidAmount:      "0",
      remainingAmount: String(totalAmount),
      status:          "unpaid",
      issueDate,
      dueDate:         dueDate || null,
      notes:           notes || null,
    }).returning();
    logger.info({ id: row.id, customerName, totalAmount }, "[invoices] created");
    res.status(201).json(row);
  } catch (e: any) {
    logger.error({ err: e }, "[invoices] POST failed");
    res.status(500).json({ error: e.message });
  }
});

router.delete("/invoices/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(invoicesTable).where(eq(invoicesTable.id, id));
    res.status(204).send();
  } catch (e: any) {
    logger.error({ err: e }, "[invoices] DELETE failed");
    res.status(500).json({ error: e.message });
  }
});

// ─── Payments ─────────────────────────────────────────────────────────────────
router.post("/payments", async (req, res) => {
  try {
    const { invoiceId, amount, date, method, notes } = req.body;
    if (!invoiceId || amount === undefined || !date) {
      res.status(400).json({ error: "invoiceId, amount, date are required" });
      return;
    }
    if (Number(amount) <= 0) {
      res.status(400).json({ error: "amount must be positive" });
      return;
    }

    const result = await db.transaction(async (tx) => {
      // Lock the invoice row first — serializes concurrent payments and lets
      // us safely check for overpayment using a fresh SUM().
      const lockRow = await tx.execute(
        sql`SELECT total_amount::numeric AS total FROM invoices WHERE id = ${Number(invoiceId)} FOR UPDATE`
      );
      if (lockRow.rows.length === 0) throw new Error("Invoice not found");
      const total = Number((lockRow.rows[0] as any).total);
      const sumRow = await tx.execute(
        sql`SELECT COALESCE(SUM(amount::numeric),0) AS paid FROM payments WHERE invoice_id = ${Number(invoiceId)}`
      );
      const currentPaid = Number((sumRow.rows[0] as any).paid);
      if (currentPaid + Number(amount) > total + 0.005) throw new Error("Overpayment");

      const [payment] = await tx.insert(paymentsTable).values({
        invoiceId: Number(invoiceId),
        amount:    String(amount),
        date,
        method:    method || null,
        notes:     notes || null,
      }).returning();

      const totals = await recomputeInvoice(tx, Number(invoiceId));
      return { payment, ...totals };
    });

    logger.info({ invoiceId, amount, status: result.status }, "[payments] recorded");
    res.status(201).json(result);
  } catch (e: any) {
    logger.error({ err: e }, "[payments] POST failed");
    let code = 500;
    if (e.message === "Invoice not found") code = 404;
    else if (e.message === "Overpayment")  code = 400;
    res.status(code).json({ error: e.message === "Overpayment"
      ? "المبلغ يتجاوز المتبقي على الفاتورة"
      : e.message });
  }
});

router.delete("/payments/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.transaction(async (tx) => {
      const [p] = await tx.select().from(paymentsTable).where(eq(paymentsTable.id, id));
      if (!p) return;
      await tx.delete(paymentsTable).where(eq(paymentsTable.id, id));
      await recomputeInvoice(tx, p.invoiceId);
    });
    res.status(204).send();
  } catch (e: any) {
    logger.error({ err: e }, "[payments] DELETE failed");
    res.status(500).json({ error: e.message });
  }
});

export default router;
