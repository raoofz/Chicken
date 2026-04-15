import { pgTable, serial, text, integer, numeric, date, timestamp } from "drizzle-orm/pg-core";

export const productionLogsTable = pgTable("production_logs", {
  id: serial("id").primaryKey(),
  flockId: integer("flock_id"),
  date: date("date").notNull(),
  eggsCollected: integer("eggs_collected").notNull().default(0),
  eggsBroken: integer("eggs_broken").default(0),
  eggsWeight: numeric("eggs_weight", { precision: 8, scale: 2 }),
  notes: text("notes"),
  authorId: integer("author_id"),
  authorName: text("author_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ProductionLog = typeof productionLogsTable.$inferSelect;
export type InsertProductionLog = typeof productionLogsTable.$inferInsert;
