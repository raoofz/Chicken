import { pgTable, serial, integer, text, date, timestamp } from "drizzle-orm/pg-core";
import { flocksTable } from "./flocks";

export const batchesTable = pgTable("batches", {
  id:           serial("id").primaryKey(),
  name:         text("name").notNull(),
  flockId:      integer("flock_id").references(() => flocksTable.id, { onDelete: "set null" }),
  startDate:    date("start_date").notNull(),
  endDate:      date("end_date"),
  chickenCount: integer("chicken_count").notNull(),
  status:       text("status").notNull().default("active"),
  notes:        text("notes"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

export type Batch = typeof batchesTable.$inferSelect;
export type InsertBatch = typeof batchesTable.$inferInsert;
