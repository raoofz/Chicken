import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const noteImagesTable = pgTable("note_images", {
  id: serial("id").primaryKey(),
  noteId: integer("note_id"),
  date: text("date").notNull(),
  imageUrl: text("image_url").notNull(),
  originalName: text("original_name"),
  mimeType: text("mime_type"),
  category: text("category").notNull().default("general"),
  caption: text("caption"),
  authorId: integer("author_id"),
  authorName: text("author_name"),
  aiAnalysis: text("ai_analysis"),
  aiTags: jsonb("ai_tags"),
  aiAlerts: jsonb("ai_alerts"),
  aiConfidence: integer("ai_confidence"),
  visualMetrics: jsonb("visual_metrics"),
  riskScore: integer("risk_score"),
  analysisStatus: text("analysis_status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type NoteImage = typeof noteImagesTable.$inferSelect;
export type InsertNoteImage = typeof noteImagesTable.$inferInsert;
