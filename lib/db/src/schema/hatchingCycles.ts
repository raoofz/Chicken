import { pgTable, serial, text, integer, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hatchingCyclesTable = pgTable("hatching_cycles", {
  id: serial("id").primaryKey(),
  batchName: text("batch_name").notNull(),
  eggsSet: integer("eggs_set").notNull(),
  eggsHatched: integer("eggs_hatched"),
  startDate: date("start_date").notNull(),
  expectedHatchDate: date("expected_hatch_date").notNull(),
  actualHatchDate: date("actual_hatch_date"),
  status: text("status").notNull().default("incubating"),
  temperature: numeric("temperature", { precision: 5, scale: 2 }),
  humidity: numeric("humidity", { precision: 5, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHatchingCycleSchema = createInsertSchema(hatchingCyclesTable).omit({ id: true, createdAt: true });
export type InsertHatchingCycle = z.infer<typeof insertHatchingCycleSchema>;
export type HatchingCycle = typeof hatchingCyclesTable.$inferSelect;
