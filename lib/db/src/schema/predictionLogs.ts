import { pgTable, serial, text, numeric, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const predictionLogsTable = pgTable("prediction_logs", {
  id: serial("id").primaryKey(),
  engineVersion: text("engine_version").notNull().default("2.0"),
  analysisType: text("analysis_type").notNull(),
  inputHash: text("input_hash").notNull(),
  predictedHatchRate: numeric("predicted_hatch_rate", { precision: 6, scale: 3 }),
  predictedRiskScore: integer("predicted_risk_score"),
  confidenceScore: integer("confidence_score"),
  actualHatchRate: numeric("actual_hatch_rate", { precision: 6, scale: 3 }),
  actualRiskMaterialized: text("actual_risk_materialized"),
  predictionError: numeric("prediction_error", { precision: 6, scale: 3 }),
  featuresSnapshot: jsonb("features_snapshot"),
  modelMetrics: jsonb("model_metrics"),
  dataQualityScore: integer("data_quality_score"),
  anomaliesDetected: jsonb("anomalies_detected"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPredictionLogSchema = createInsertSchema(predictionLogsTable).omit({ id: true, createdAt: true });
export type InsertPredictionLog = z.infer<typeof insertPredictionLogSchema>;
export type PredictionLog = typeof predictionLogsTable.$inferSelect;
