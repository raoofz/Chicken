import { pgTable, serial, text, integer, numeric, date, timestamp } from "drizzle-orm/pg-core";

export const feedLogsTable = pgTable("feed_logs", {
  id: serial("id").primaryKey(),
  flockId: integer("flock_id"),
  date: date("date").notNull(),
  feedType: text("feed_type").notNull(),
  quantityKg: numeric("quantity_kg", { precision: 8, scale: 2 }).notNull(),
  costPerKg: numeric("cost_per_kg", { precision: 8, scale: 2 }),
  totalCost: numeric("total_cost", { precision: 10, scale: 2 }),
  notes: text("notes"),
  authorId: integer("author_id"),
  authorName: text("author_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FeedLog = typeof feedLogsTable.$inferSelect;
export type InsertFeedLog = typeof feedLogsTable.$inferInsert;
