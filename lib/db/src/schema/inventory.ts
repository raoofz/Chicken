import { pgTable, serial, integer, text, numeric, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const inventoryItemsTable = pgTable("inventory_items", {
  id:             serial("id").primaryKey(),
  sku:            text("sku"),
  name:           text("name").notNull(),
  category:       text("category").notNull(),
  unit:           text("unit").notNull(),
  quantityOnHand: numeric("quantity_on_hand", { precision: 14, scale: 3 }).notNull().default("0"),
  unitCost:       numeric("unit_cost",        { precision: 12, scale: 2 }).notNull().default("0"),
  reorderLevel:   numeric("reorder_level",    { precision: 14, scale: 3 }).notNull().default("0"),
  notes:          text("notes"),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
});

export const inventoryMovementsTable = pgTable("inventory_movements", {
  id:            serial("id").primaryKey(),
  itemId:        integer("item_id").notNull(),
  type:          text("type").notNull(),
  quantity:      numeric("quantity",  { precision: 14, scale: 3 }).notNull(),
  unitCost:      numeric("unit_cost", { precision: 12, scale: 2 }),
  totalCost:     numeric("total_cost",{ precision: 14, scale: 2 }),
  date:          date("date").notNull(),
  flockId:       integer("flock_id"),
  batchId:       integer("batch_id"),
  transactionId: integer("transaction_id"),
  referenceType: text("reference_type"),
  referenceId:   integer("reference_id"),
  notes:         text("notes"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
});

export const insertInventoryItemSchema     = createInsertSchema(inventoryItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInventoryMovementSchema = createInsertSchema(inventoryMovementsTable).omit({ id: true, createdAt: true });

export type InventoryItem         = typeof inventoryItemsTable.$inferSelect;
export type InsertInventoryItem   = z.infer<typeof insertInventoryItemSchema>;
export type InventoryMovement     = typeof inventoryMovementsTable.$inferSelect;
export type InsertInventoryMovement = z.infer<typeof insertInventoryMovementSchema>;
