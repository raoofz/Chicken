import { pgTable, serial, text, integer, date, timestamp } from "drizzle-orm/pg-core";

export const mortalityLogsTable = pgTable("mortality_logs", {
  id: serial("id").primaryKey(),
  flockId: integer("flock_id"),
  date: date("date").notNull(),
  count: integer("count").notNull(),
  cause: text("cause"),
  symptoms: text("symptoms"),
  actionTaken: text("action_taken"),
  notes: text("notes"),
  authorId: integer("author_id"),
  authorName: text("author_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MortalityLog = typeof mortalityLogsTable.$inferSelect;
export type InsertMortalityLog = typeof mortalityLogsTable.$inferInsert;
