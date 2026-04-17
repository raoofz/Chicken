import { pgTable, serial, integer, date, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { flocksTable } from "./flocks";

export const flockHealthLogsTable = pgTable("flock_health_logs", {
  id:        serial("id").primaryKey(),
  flockId:   integer("flock_id").notNull().references(() => flocksTable.id, { onDelete: "cascade" }),
  date:      date("date").notNull(),
  status:    text("status").notNull(),   // healthy | sick | recovering | quarantine | treated
  symptoms:  text("symptoms"),
  treatment: text("treatment"),
  notes:     text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFlockHealthLogSchema = createInsertSchema(flockHealthLogsTable)
  .omit({ id: true, createdAt: true });
export type InsertFlockHealthLog = z.infer<typeof insertFlockHealthLogSchema>;
export type FlockHealthLog = typeof flockHealthLogsTable.$inferSelect;
