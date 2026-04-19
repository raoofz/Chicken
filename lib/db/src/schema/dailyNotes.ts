import { pgTable, serial, text, date, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const dailyNotesTable = pgTable("daily_notes", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  date: date("date").notNull(),
  authorId: integer("author_id"),
  authorName: text("author_name"),
  category: text("category").notNull().default("general"),
  goalId: integer("goal_id"),      // FK → goals.id (nullable — links note to a related goal)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDailyNoteSchema = createInsertSchema(dailyNotesTable);
export const selectDailyNoteSchema = createSelectSchema(dailyNotesTable);
export type DailyNote = typeof dailyNotesTable.$inferSelect;
export type InsertDailyNote = typeof dailyNotesTable.$inferInsert;
