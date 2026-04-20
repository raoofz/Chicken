import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, medicineRecordsTable, transactionsTable } from "@workspace/db";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

router.get("/medicine-records", async (req, res) => {
  try {
    const { flockId, batchId } = req.query as Record<string, string>;
    const conditions = [];
    if (flockId) conditions.push(eq(medicineRecordsTable.flockId, Number(flockId)));
    if (batchId) conditions.push(eq(medicineRecordsTable.batchId, Number(batchId)));
    const rows = await db.select().from(medicineRecordsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(medicineRecordsTable.date));
    res.json(rows);
  } catch (e: any) {
    logger.error({ err: e }, "[medicineRecords] GET failed");
    res.status(500).json({ error: e.message });
  }
});

/**
 * Direct medicine-record write (admin/legacy).
 * Always creates a linked expense transaction in the same db.transaction so
 * the ledger remains the single source of financial truth — no opt-out.
 * For inventory-aware medicine usage, use POST /operations/medicine-usage.
 */
router.post("/medicine-records", async (req, res) => {
  try {
    const { date, flockId, batchId, medicineName, dosage, cost, notes } = req.body;
    if (!date || !medicineName || cost === undefined) {
      res.status(400).json({ error: "date, medicineName, cost are required" });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [txRow] = await tx.insert(transactionsTable).values({
        date,
        type: "expense",
        category: "medicine",
        domain: "health",
        description: `دواء: ${medicineName}`,
        amount: String(cost),
        authorId: req.session.userId,
        flockId: flockId ? Number(flockId) : null,
        batchId: batchId ? Number(batchId) : null,
      }).returning();
      const [row] = await tx.insert(medicineRecordsTable).values({
        date,
        flockId: flockId ? Number(flockId) : null,
        batchId: batchId ? Number(batchId) : null,
        medicineName,
        dosage: dosage || null,
        cost: String(cost),
        transactionId: txRow.id,
        notes: notes || null,
      }).returning();
      return row;
    });

    res.status(201).json(result);
  } catch (e: any) {
    logger.error({ err: e }, "[medicineRecords] POST failed");
    res.status(500).json({ error: e.message });
  }
});

router.delete("/medicine-records/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(medicineRecordsTable).where(eq(medicineRecordsTable.id, id));
    res.status(204).send();
  } catch (e: any) {
    logger.error({ err: e }, "[medicineRecords] DELETE failed");
    res.status(500).json({ error: e.message });
  }
});

export default router;
