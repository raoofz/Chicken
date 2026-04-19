import { pgTable, serial, text, date, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Activity log — records of farm operations actually performed.
 * `taskId` optionally links an activity to the task it fulfills,
 * enabling the Daily Operations Center to cross-reference planned vs. done work.
 */
export const activityLogsTable = pgTable("activity_logs", {
  id:          serial("id").primaryKey(),
  title:       text("title").notNull(),
  description: text("description"),
  category:    text("category").notNull().default("other"),
  date:        date("date").notNull(),
  taskId:      integer("task_id"),   // FK → tasks.id (nullable — not all activities relate to a task)
  goalId:      integer("goal_id"),   // FK → goals.id (nullable — links activity to a goal it advances)
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogsTable).omit({ id: true, createdAt: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog       = typeof activityLogsTable.$inferSelect;
