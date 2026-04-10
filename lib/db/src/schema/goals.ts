import { pgTable, serial, text, numeric, boolean, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const goalsTable = pgTable("goals", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  targetValue: numeric("target_value", { precision: 10, scale: 2 }).notNull(),
  currentValue: numeric("current_value", { precision: 10, scale: 2 }).notNull().default("0"),
  unit: text("unit").notNull(),
  category: text("category").notNull().default("other"),
  deadline: date("deadline"),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGoalSchema = createInsertSchema(goalsTable).omit({ id: true, createdAt: true });
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goalsTable.$inferSelect;
