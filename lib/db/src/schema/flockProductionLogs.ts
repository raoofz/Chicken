import { pgTable, serial, integer, date, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { flocksTable } from "./flocks";

export const flockProductionLogsTable = pgTable("flock_production_logs", {
  id:       serial("id").primaryKey(),
  flockId:  integer("flock_id").notNull().references(() => flocksTable.id, { onDelete: "cascade" }),
  date:     date("date").notNull(),
  eggCount: integer("egg_count").notNull(),
  notes:    text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFlockProductionLogSchema = createInsertSchema(flockProductionLogsTable)
  .omit({ id: true, createdAt: true });
export type InsertFlockProductionLog = z.infer<typeof insertFlockProductionLogSchema>;
export type FlockProductionLog = typeof flockProductionLogsTable.$inferSelect;
