import { pgTable, serial, integer, text, numeric, date, timestamp } from "drizzle-orm/pg-core";

/**
 * invoices — accounts receivable.
 * remaining_amount and status are recomputed in a transaction whenever a
 * payment is added/deleted (see api-server/routes/invoices.ts).
 *   status: 'unpaid' | 'partial' | 'paid'
 */
export const invoicesTable = pgTable("invoices", {
  id:              serial("id").primaryKey(),
  customerName:    text("customer_name").notNull(),
  totalAmount:     numeric("total_amount",     { precision: 14, scale: 2 }).notNull(),
  paidAmount:      numeric("paid_amount",      { precision: 14, scale: 2 }).notNull().default("0"),
  remainingAmount: numeric("remaining_amount", { precision: 14, scale: 2 }).notNull(),
  status:          text("status").notNull().default("unpaid"),
  issueDate:       date("issue_date").notNull(),
  dueDate:         date("due_date"),
  notes:           text("notes"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
});

export const paymentsTable = pgTable("payments", {
  id:        serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  amount:    numeric("amount", { precision: 14, scale: 2 }).notNull(),
  date:      date("date").notNull(),
  method:    text("method"),
  notes:     text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Invoice = typeof invoicesTable.$inferSelect;
export type InsertInvoice = typeof invoicesTable.$inferInsert;
export type Payment = typeof paymentsTable.$inferSelect;
export type InsertPayment = typeof paymentsTable.$inferInsert;
