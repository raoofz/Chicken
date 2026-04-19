import { pgTable, serial, text, numeric, date, timestamp, integer } from "drizzle-orm/pg-core";

/**
 * Unified financial ledger.
 * Domain separation is enforced at the application layer via farmDomains.ts.
 * The `domain` column is the authoritative partition key for analytics queries —
 * always derived from `category` via categoryToDomain() and stored on write.
 */
export const transactionsTable = pgTable("transactions", {
  id:          serial("id").primaryKey(),
  date:        date("date").notNull(),
  type:        text("type").notNull(),          // 'income' | 'expense'
  category:    text("category").notNull(),      // see EXPENSE_CATEGORIES / INCOME_CATEGORIES in farmDomains.ts
  domain:      text("domain"),                  // Single Source of Truth domain partition: feed|egg|health|operational|income|general
  description: text("description").notNull(),
  amount:      numeric("amount",   { precision: 12, scale: 2 }).notNull(),
  quantity:    numeric("quantity", { precision: 10, scale: 2 }),
  unit:        text("unit"),
  notes:       text("notes"),
  authorId:    integer("author_id"),
  authorName:  text("author_name"),
  flockId:     integer("flock_id"),    // optional production link → cost-per-flock analysis
  batchId:     integer("batch_id"),    // optional batch link → cost-per-batch analysis
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

export type Transaction       = typeof transactionsTable.$inferSelect;
export type InsertTransaction = typeof transactionsTable.$inferInsert;
