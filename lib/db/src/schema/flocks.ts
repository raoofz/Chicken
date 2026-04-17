import { pgTable, serial, text, integer, numeric, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const flocksTable = pgTable("flocks", {
  id:                 serial("id").primaryKey(),
  name:               text("name").notNull(),
  breed:              text("breed").notNull(),
  count:              integer("count").notNull(),
  ageDays:            integer("age_days").notNull(),
  birthDate:          date("birth_date"),
  purpose:            text("purpose").notNull(),
  healthStatus:       text("health_status").notNull().default("healthy"),
  feedConsumptionKg:  numeric("feed_consumption_kg", { precision: 8, scale: 2 }),
  dailyEggTarget:     integer("daily_egg_target"),
  notes:              text("notes"),
  createdAt:          timestamp("created_at").defaultNow().notNull(),
});

export const insertFlockSchema = createInsertSchema(flocksTable).omit({ id: true, createdAt: true });
export type InsertFlock = z.infer<typeof insertFlockSchema>;
export type Flock = typeof flocksTable.$inferSelect;
