import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import {
  db,
  inventoryItemsTable,
  inventoryMovementsTable,
  transactionsTable,
  medicineRecordsTable,
  paymentsTable,
} from "@workspace/db";
import { logger } from "../lib/logger.js";
import { recomputeInvoice } from "./invoices.js";

/**
 * OPERATIONS LAYER — event-driven, atomic.
 *
 * Every endpoint here is a single business event that runs inside one
 * db.transaction and is the SOLE writer of its side effects. Callers do not
 * compose lower-level primitives. This guarantees that inventory, finance, and
 * batch costing stay in sync — no partial writes, no double-booking.
 *
 * Design rules:
 *   • Financial truth lives in the `transactions` table only.
 *   • Inventory truth lives in `inventory_items.quantity_on_hand`, derived
 *     from `inventory_movements`.
 *   • Batch cost = SUM(transactions.amount WHERE batch_id = ? AND type='expense').
 *   • Categories distinguish *purchase* (cash outlay) from *usage*
 *     (consumption allocated to a batch). UIs that show batch P&L should
 *     filter by usage categories to avoid mixing flows; the existing
 *     finance-cost endpoint already groups by category.
 */
const router: IRouter = Router();

async function lockItem(tx: any, itemId: number) {
  const r = await tx.execute(sql`
    SELECT id, name, category, unit,
           quantity_on_hand::numeric AS qty,
           unit_cost::numeric        AS unit_cost
      FROM inventory_items
     WHERE id = ${itemId}
       FOR UPDATE`);
  if (r.rows.length === 0) throw new Error("Item not found");
  const row = r.rows[0] as any;
  return {
    id: Number(row.id),
    name: String(row.name),
    category: String(row.category),
    unit: String(row.unit),
    qty: Number(row.qty),
    unitCost: Number(row.unit_cost),
  };
}

// ─── 1) Inventory purchase ──────────────────────────────────────────────────
// Buy feed/medicine/equipment → +inventory, +expense.
router.post("/operations/inventory-purchase", async (req, res) => {
  try {
    const { itemId, quantity, unitCost, date, supplier, notes } = req.body;
    if (!itemId || quantity === undefined || unitCost === undefined || !date) {
      res.status(400).json({ error: "itemId, quantity, unitCost, date are required" });
      return;
    }
    const qty = Number(quantity);
    const cost = Number(unitCost);
    if (!(qty > 0) || !(cost >= 0)) {
      res.status(400).json({ error: "quantity must be > 0, unitCost must be ≥ 0" });
      return;
    }
    const total = +(qty * cost).toFixed(2);

    const result = await db.transaction(async (tx) => {
      const item = await lockItem(tx, Number(itemId));
      const category = item.category === "feed"     ? "feed_purchase"
                     : item.category === "medicine" ? "medicine_purchase"
                                                    : "supplies_purchase";

      const [txRow] = await tx.insert(transactionsTable).values({
        date,
        type: "expense",
        category,
        domain: "operations",
        description: `شراء ${item.name} × ${qty} ${item.unit}${supplier ? ` — ${supplier}` : ""}`,
        amount: String(total),
        authorId: req.session.userId,
        flockId: null,
        batchId: null,
      }).returning();

      const [mv] = await tx.insert(inventoryMovementsTable).values({
        itemId: item.id,
        type: "in",
        quantity: String(qty),
        unitCost: String(cost),
        totalCost: String(total),
        date,
        transactionId: txRow.id,
        referenceType: "purchase",
        notes: notes || supplier || null,
      }).returning();

      const newQty = item.qty + qty;
      await tx.update(inventoryItemsTable).set({
        quantityOnHand: String(newQty),
        unitCost: String(cost),
        updatedAt: new Date(),
      }).where(eq(inventoryItemsTable.id, item.id));

      return { transaction: txRow, movement: mv, newQuantity: newQty };
    });

    res.status(201).json(result);
  } catch (e: any) {
    logger.error({ err: e }, "[ops/purchase] failed");
    const code = e.message === "Item not found" ? 404 : 500;
    res.status(code).json({ error: e.message });
  }
});

// ─── 2) Feed usage ──────────────────────────────────────────────────────────
// Use feed for a batch → -inventory, +expense (batch-tagged).
router.post("/operations/feed-usage", async (req, res) => {
  try {
    const { itemId, quantity, date, batchId, flockId, notes } = req.body;
    if (!itemId || quantity === undefined || !date) {
      res.status(400).json({ error: "itemId, quantity, date are required" });
      return;
    }
    const qty = Number(quantity);
    if (!(qty > 0)) {
      res.status(400).json({ error: "quantity must be > 0" });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const item = await lockItem(tx, Number(itemId));
      if (item.category !== "feed") throw new Error("Item is not feed");
      if (item.qty < qty) throw new Error("Insufficient stock");

      const total = +(qty * item.unitCost).toFixed(2);

      const [txRow] = await tx.insert(transactionsTable).values({
        date,
        type: "expense",
        category: "feed",
        domain: "operations",
        description: `استهلاك علف: ${item.name} × ${qty} ${item.unit}`,
        amount: String(total),
        authorId: req.session.userId,
        flockId: flockId ? Number(flockId) : null,
        batchId: batchId ? Number(batchId) : null,
      }).returning();

      const [mv] = await tx.insert(inventoryMovementsTable).values({
        itemId: item.id,
        type: "out",
        quantity: String(qty),
        unitCost: String(item.unitCost),
        totalCost: String(total),
        date,
        flockId: flockId ? Number(flockId) : null,
        batchId: batchId ? Number(batchId) : null,
        transactionId: txRow.id,
        referenceType: "feed_usage",
        notes: notes || null,
      }).returning();

      const newQty = item.qty - qty;
      await tx.update(inventoryItemsTable).set({
        quantityOnHand: String(newQty),
        updatedAt: new Date(),
      }).where(eq(inventoryItemsTable.id, item.id));

      return { transaction: txRow, movement: mv, newQuantity: newQty, cost: total };
    });

    res.status(201).json(result);
  } catch (e: any) {
    logger.error({ err: e }, "[ops/feed-usage] failed");
    const map: Record<string, [number, string]> = {
      "Item not found":      [404, "الصنف غير موجود"],
      "Item is not feed":    [400, "هذا الصنف ليس علفاً"],
      "Insufficient stock":  [400, "الكمية المتاحة غير كافية"],
    };
    const [code, msg] = map[e.message] ?? [500, e.message];
    res.status(code).json({ error: msg });
  }
});

// ─── 3) Medicine usage ──────────────────────────────────────────────────────
// Use medicine on a batch → -inventory, +expense (batch-tagged) + medicine_record.
router.post("/operations/medicine-usage", async (req, res) => {
  try {
    const { itemId, quantity, date, batchId, flockId, dosage, notes } = req.body;
    if (!itemId || quantity === undefined || !date) {
      res.status(400).json({ error: "itemId, quantity, date are required" });
      return;
    }
    const qty = Number(quantity);
    if (!(qty > 0)) {
      res.status(400).json({ error: "quantity must be > 0" });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const item = await lockItem(tx, Number(itemId));
      if (item.category !== "medicine") throw new Error("Item is not medicine");
      if (item.qty < qty) throw new Error("Insufficient stock");

      const total = +(qty * item.unitCost).toFixed(2);

      const [txRow] = await tx.insert(transactionsTable).values({
        date,
        type: "expense",
        category: "medicine",
        domain: "health",
        description: `دواء: ${item.name} × ${qty} ${item.unit}`,
        amount: String(total),
        authorId: req.session.userId,
        flockId: flockId ? Number(flockId) : null,
        batchId: batchId ? Number(batchId) : null,
      }).returning();

      const [med] = await tx.insert(medicineRecordsTable).values({
        date,
        flockId: flockId ? Number(flockId) : null,
        batchId: batchId ? Number(batchId) : null,
        medicineName: item.name,
        dosage: dosage || null,
        cost: String(total),
        transactionId: txRow.id,
        notes: notes || null,
      }).returning();

      const [mv] = await tx.insert(inventoryMovementsTable).values({
        itemId: item.id,
        type: "out",
        quantity: String(qty),
        unitCost: String(item.unitCost),
        totalCost: String(total),
        date,
        flockId: flockId ? Number(flockId) : null,
        batchId: batchId ? Number(batchId) : null,
        transactionId: txRow.id,
        referenceType: "medicine_usage",
        referenceId: med.id,
        notes: notes || null,
      }).returning();

      const newQty = item.qty - qty;
      await tx.update(inventoryItemsTable).set({
        quantityOnHand: String(newQty),
        updatedAt: new Date(),
      }).where(eq(inventoryItemsTable.id, item.id));

      return { transaction: txRow, medicineRecord: med, movement: mv, newQuantity: newQty, cost: total };
    });

    res.status(201).json(result);
  } catch (e: any) {
    logger.error({ err: e }, "[ops/medicine-usage] failed");
    const map: Record<string, [number, string]> = {
      "Item not found":         [404, "الصنف غير موجود"],
      "Item is not medicine":   [400, "هذا الصنف ليس دواءً"],
      "Insufficient stock":     [400, "الكمية المتاحة غير كافية"],
    };
    const [code, msg] = map[e.message] ?? [500, e.message];
    res.status(code).json({ error: msg });
  }
});

// ─── 4) Egg sale ────────────────────────────────────────────────────────────
// Sell eggs → +income; optionally attach as a payment to an existing invoice.
router.post("/operations/egg-sale", async (req, res) => {
  try {
    const { date, eggCount, unitPrice, flockId, batchId, customer, invoiceId, notes } = req.body;
    if (!date || eggCount === undefined || unitPrice === undefined) {
      res.status(400).json({ error: "date, eggCount, unitPrice are required" });
      return;
    }
    const count = Number(eggCount);
    const price = Number(unitPrice);
    if (!(count > 0) || !(price >= 0)) {
      res.status(400).json({ error: "eggCount must be > 0, unitPrice must be ≥ 0" });
      return;
    }
    const total = +(count * price).toFixed(2);

    const result = await db.transaction(async (tx) => {
      const [txRow] = await tx.insert(transactionsTable).values({
        date,
        type: "income",
        category: "egg_sales",
        domain: "production",
        description: `بيع بيض: ${count}${customer ? ` — ${customer}` : ""}${notes ? ` — ${notes}` : ""}`,
        amount: String(total),
        authorId: req.session.userId,
        flockId: flockId ? Number(flockId) : null,
        batchId: batchId ? Number(batchId) : null,
      }).returning();

      let invoicePayment: any = null;
      if (invoiceId) {
        // Lock the invoice and validate it can absorb this payment, using
        // the SAME logic as POST /payments to keep status semantics identical.
        const lockRow = await tx.execute(
          sql`SELECT total_amount::numeric AS total FROM invoices WHERE id = ${Number(invoiceId)} FOR UPDATE`
        );
        if (lockRow.rows.length === 0) throw new Error("Invoice not found");
        const totalInv = Number((lockRow.rows[0] as any).total);
        const sumRow = await tx.execute(
          sql`SELECT COALESCE(SUM(amount::numeric),0) AS paid FROM payments WHERE invoice_id = ${Number(invoiceId)}`
        );
        const currentPaid = Number((sumRow.rows[0] as any).paid);
        if (currentPaid + total > totalInv + 0.005) throw new Error("Overpayment");

        const [pay] = await tx.insert(paymentsTable).values({
          invoiceId: Number(invoiceId),
          amount: String(total),
          date,
          method: "egg_sale",
          notes: customer ? `بيع بيض — ${customer}` : "بيع بيض",
        }).returning();

        // Single shared recompute → identical paid/remaining/status across
        // /payments and /operations/egg-sale.
        const totals = await recomputeInvoice(tx, Number(invoiceId));
        invoicePayment = { payment: pay, ...totals };
      }

      return { transaction: txRow, total, invoicePayment };
    });

    res.status(201).json(result);
  } catch (e: any) {
    logger.error({ err: e }, "[ops/egg-sale] failed");
    const map: Record<string, [number, string]> = {
      "Invoice not found": [404, "الفاتورة غير موجودة"],
      "Overpayment":       [400, "المبلغ يتجاوز المتبقي على الفاتورة"],
    };
    const [code, msg] = map[e.message] ?? [500, e.message];
    res.status(code).json({ error: msg });
  }
});

export default router;
