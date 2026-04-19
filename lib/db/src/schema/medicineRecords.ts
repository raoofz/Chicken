import { pgTable, serial, integer, text, numeric, date, timestamp } from "drizzle-orm/pg-core";

export const medicineRecordsTable = pgTable("medicine_records", {
  id:            serial("id").primaryKey(),
  date:          date("date").notNull(),
  flockId:       integer("flock_id"),
  batchId:       integer("batch_id"),
  medicineName:  text("medicine_name").notNull(),
  dosage:        text("dosage"),
  cost:          numeric("cost", { precision: 12, scale: 2 }).notNull(),
  transactionId: integer("transaction_id"),
  notes:         text("notes"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
});

export type MedicineRecord = typeof medicineRecordsTable.$inferSelect;
export type InsertMedicineRecord = typeof medicineRecordsTable.$inferInsert;
