import { pgTable, serial, text, integer, numeric, date, timestamp } from "drizzle-orm/pg-core";

export const environmentLogsTable = pgTable("environment_logs", {
  id: serial("id").primaryKey(),
  flockId: integer("flock_id"),
  date: date("date").notNull(),
  temperatureC: numeric("temperature_c", { precision: 5, scale: 1 }).notNull(),
  humidityPct: numeric("humidity_pct", { precision: 5, scale: 1 }),
  ventilation: text("ventilation"),
  lightHours: numeric("light_hours", { precision: 4, scale: 1 }),
  ammoniaLevel: text("ammonia_level"),
  notes: text("notes"),
  authorId: integer("author_id"),
  authorName: text("author_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type EnvironmentLog = typeof environmentLogsTable.$inferSelect;
export type InsertEnvironmentLog = typeof environmentLogsTable.$inferInsert;
