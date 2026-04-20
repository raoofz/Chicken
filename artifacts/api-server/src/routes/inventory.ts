import { Router, type IRouter } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  db,
  inventoryItemsTable,
  inventoryMovementsTable,
} from "@workspace/db";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const VALID_CATEGORIES = ["feed", "medicine", "equipment", "other"] as const;

router.get("/inventory/items", async (req, res) => {
  try {
    const { category } = req.query as Record<string, string>;
    const rows = await db.select().from(inventoryItemsTable)
      .where(category ? eq(inventoryItemsTable.category, category) : undefined)
      .orderBy(desc(inventoryItemsTable.updatedAt));
    res.json(rows);
  } catch (e: any) {
    logger.error({ err: e }, "[inventory] GET items failed");
    res.status(500).json({ error: e.message });
  }
});

/**
 * Create an inventory item. If a non-zero opening quantity is provided,
 * an opening-balance movement is recorded in the same db.transaction so
 * `quantity_on_hand` is always derivable from `inventory_movements`
 * (single-source-of-truth invariant).
 *
 * Note: an opening balance does NOT create a financial transaction —
 * the assumption is the stock already exists and was paid for previously.
 * To register a real purchase, create the item with quantity 0 and then
 * POST /operations/inventory-purchase.
 */
router.post("/inventory/items", async (req, res) => {
  try {
    const { sku, name, category, unit, quantityOnHand, unitCost, reorderLevel, notes } = req.body;
    if (!name || !category || !unit) {
      res.status(400).json({ error: "name, category, unit are required" });
      return;
    }
    if (!VALID_CATEGORIES.includes(category)) {
      res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` });
      return;
    }
    const openingQty = Number(quantityOnHand ?? 0);
    const itemUnitCost = Number(unitCost ?? 0);

    const result = await db.transaction(async (tx) => {
      const [row] = await tx.insert(inventoryItemsTable).values({
        sku: sku || null,
        name,
        category,
        unit,
        quantityOnHand: String(openingQty),
        unitCost:       String(itemUnitCost),
        reorderLevel:   String(reorderLevel ?? 0),
        notes: notes || null,
      }).returning();

      if (openingQty !== 0) {
        await tx.insert(inventoryMovementsTable).values({
          itemId:        row.id,
          type:          "adjustment",
          quantity:      String(openingQty),
          unitCost:      String(itemUnitCost),
          totalCost:     openingQty > 0 ? String((openingQty * itemUnitCost).toFixed(2)) : null,
          date:          new Date().toISOString().slice(0, 10),
          referenceType: "opening_balance",
          notes:         "رصيد افتتاحي / opening balance",
        });
      }
      return row;
    });

    res.status(201).json(result);
  } catch (e: any) {
    logger.error({ err: e }, "[inventory] POST item failed");
    res.status(500).json({ error: e.message });
  }
});

router.put("/inventory/items/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { sku, name, category, unit, reorderLevel, unitCost, notes } = req.body;
    const [row] = await db.update(inventoryItemsTable).set({
      sku: sku ?? null,
      name,
      category,
      unit,
      reorderLevel: reorderLevel !== undefined ? String(reorderLevel) : undefined,
      unitCost:     unitCost     !== undefined ? String(unitCost)     : undefined,
      notes: notes ?? null,
      updatedAt: new Date(),
    }).where(eq(inventoryItemsTable.id, id)).returning();
    res.json(row);
  } catch (e: any) {
    logger.error({ err: e }, "[inventory] PUT item failed");
    res.status(500).json({ error: e.message });
  }
});

router.delete("/inventory/items/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(inventoryItemsTable).where(eq(inventoryItemsTable.id, id));
    res.status(204).send();
  } catch (e: any) {
    logger.error({ err: e }, "[inventory] DELETE item failed");
    res.status(500).json({ error: e.message });
  }
});

router.get("/inventory/movements", async (req, res) => {
  try {
    const { itemId } = req.query as Record<string, string>;
    const rows = await db.select().from(inventoryMovementsTable)
      .where(itemId ? eq(inventoryMovementsTable.itemId, Number(itemId)) : undefined)
      .orderBy(desc(inventoryMovementsTable.date), desc(inventoryMovementsTable.id))
      .limit(500);
    res.json(rows);
  } catch (e: any) {
    logger.error({ err: e }, "[inventory] GET movements failed");
    res.status(500).json({ error: e.message });
  }
});

/**
 * Manual stock adjustment (correction only — e.g. spoilage, inventory count
 * reconciliation). Real business events (purchase, feed/medicine usage,
 * egg sale) MUST go through /operations/* endpoints so finance + inventory
 * + batch costing stay in lock-step.
 *
 * Quantity is signed: positive = add stock, negative = remove stock.
 * No financial transaction is created here; if the adjustment has a cost
 * impact, the caller should record it separately as a transaction.
 */
router.post("/inventory/adjustments", async (req, res) => {
  try {
    const { itemId, quantity, date, notes } = req.body;
    if (!itemId || quantity === undefined || !date) {
      res.status(400).json({ error: "itemId, quantity, date are required" });
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty === 0) {
      res.status(400).json({ error: "quantity must be a non-zero number" });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const itemRow = await tx.execute(
        sql`SELECT id, quantity_on_hand::numeric AS qty
            FROM inventory_items WHERE id = ${Number(itemId)} FOR UPDATE`
      );
      if (itemRow.rows.length === 0) throw new Error("Item not found");
      const currentQty = Number((itemRow.rows[0] as any).qty);
      const newQty = currentQty + qty;
      if (newQty < 0) throw new Error("Insufficient stock");

      const [mv] = await tx.insert(inventoryMovementsTable).values({
        itemId:        Number(itemId),
        type:          "adjustment",
        quantity:      String(qty),
        date,
        referenceType: "adjustment",
        notes:         notes || null,
      }).returning();

      await tx.update(inventoryItemsTable).set({
        quantityOnHand: String(newQty),
        updatedAt: new Date(),
      }).where(eq(inventoryItemsTable.id, Number(itemId)));

      return { movement: mv, newQuantity: newQty };
    });

    res.status(201).json(result);
  } catch (e: any) {
    logger.error({ err: e }, "[inventory] POST adjustment failed");
    const code = e.message === "Item not found" ? 404
              : e.message === "Insufficient stock" ? 400
              : 500;
    const msg = e.message === "Insufficient stock" ? "الكمية المتاحة غير كافية"
              : e.message === "Item not found"    ? "الصنف غير موجود"
              : e.message;
    res.status(code).json({ error: msg });
  }
});

export default router;
