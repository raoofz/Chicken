import { pgTable, serial, integer, text, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { flocksTable } from "./flocks";

/**
 * feed_records — precise purchase records for feed
 * Each record represents one feed purchase event.
 * Can be linked to a transactions row (optional) for unified accounting.
 */
export const feedRecordsTable = pgTable("feed_records", {
  id:           serial("id").primaryKey(),
  date:         date("date").notNull(),
  feedType:     text("feed_type").notNull(),   // starter | grower | layer | finisher | broiler | mixed
  brand:        text("brand"),
  quantityKg:   numeric("quantity_kg",  { precision: 10, scale: 2 }).notNull(),
  pricePerKg:   numeric("price_per_kg", { precision: 8,  scale: 2 }).notNull(),
  totalCost:    numeric("total_cost",   { precision: 12, scale: 2 }).notNull(),
  supplier:     text("supplier"),
  transactionId: integer("transaction_id"),   // optional link to transactions table
  notes:        text("notes"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

/**
 * feed_record_allocations — per-flock allocation of each feed purchase
 * A single feed purchase can be split across multiple flocks.
 */
export const feedRecordAllocationsTable = pgTable("feed_record_allocations", {
  id:           serial("id").primaryKey(),
  feedRecordId: integer("feed_record_id").notNull().references(() => feedRecordsTable.id, { onDelete: "cascade" }),
  flockId:      integer("flock_id").notNull().references(() => flocksTable.id, { onDelete: "cascade" }),
  quantityKg:   numeric("quantity_kg", { precision: 10, scale: 2 }).notNull(),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

export const insertFeedRecordSchema = createInsertSchema(feedRecordsTable).omit({ id: true, createdAt: true });
export const insertFeedRecordAllocationSchema = createInsertSchema(feedRecordAllocationsTable).omit({ id: true, createdAt: true });

export type FeedRecord = typeof feedRecordsTable.$inferSelect;
export type InsertFeedRecord = z.infer<typeof insertFeedRecordSchema>;
export type FeedRecordAllocation = typeof feedRecordAllocationsTable.$inferSelect;
export type InsertFeedRecordAllocation = z.infer<typeof insertFeedRecordAllocationSchema>;
