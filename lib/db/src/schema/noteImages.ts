import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const noteImagesTable = pgTable("note_images", {
  id: serial("id").primaryKey(),
  noteId: integer("note_id"),                      // optional — can be standalone
  date: text("date").notNull(),                    // YYYY-MM-DD
  imageUrl: text("image_url").notNull(),            // GCS object path
  originalName: text("original_name"),
  mimeType: text("mime_type"),
  category: text("category").notNull().default("general"),
  caption: text("caption"),
  authorId: integer("author_id"),
  authorName: text("author_name"),
  aiAnalysis: text("ai_analysis"),                 // AI-generated text analysis
  aiTags: jsonb("ai_tags"),                        // ["birds","incubator","temperature"]
  aiAlerts: jsonb("ai_alerts"),                    // [{level:"warning", message:"..."}]
  aiConfidence: integer("ai_confidence"),           // 0-100
  analysisStatus: text("analysis_status").notNull().default("pending"),  // pending|done|failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type NoteImage = typeof noteImagesTable.$inferSelect;
export type InsertNoteImage = typeof noteImagesTable.$inferInsert;
