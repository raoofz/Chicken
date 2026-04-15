import { pgTable, serial, text, integer, numeric, date, timestamp } from "drizzle-orm/pg-core";

export const waterLogsTable = pgTable("water_logs", {
  id: serial("id").primaryKey(),
  flockId: integer("flock_id"),
  date: date("date").notNull(),
  quantityLiters: numeric("quantity_liters", { precision: 8, scale: 2 }).notNull(),
  waterTemp: numeric("water_temp", { precision: 5, scale: 1 }),
  addedSupplements: text("added_supplements"),
  notes: text("notes"),
  authorId: integer("author_id"),
  authorName: text("author_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type WaterLog = typeof waterLogsTable.$inferSelect;
export type InsertWaterLog = typeof waterLogsTable.$inferInsert;
