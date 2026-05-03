import { pool } from "@workspace/db";
import { logger } from "./logger";

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);

    // Fix 1: Rename age_weeks → age_days in flocks if needed
    const { rows: flocksColumns } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'flocks' AND column_name = 'age_weeks'
    `);
    if (flocksColumns.length > 0) {
      await client.query(`ALTER TABLE flocks RENAME COLUMN age_weeks TO age_days`);
      logger.info("Migration: renamed flocks.age_weeks → age_days");
    }

    // Fix 2: Add set_time to hatching_cycles if missing
    const missingHatchingCols = [
      { col: "set_time", def: "TEXT" },
      { col: "lockdown_date", def: "DATE" },
      { col: "lockdown_time", def: "TEXT" },
      { col: "lockdown_temperature", def: "NUMERIC(5,2)" },
      { col: "lockdown_humidity", def: "NUMERIC(5,2)" },
    ];
    for (const { col, def } of missingHatchingCols) {
      const { rows } = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'hatching_cycles' AND column_name = $1
      `, [col]);
      if (rows.length === 0) {
        await client.query(`ALTER TABLE hatching_cycles ADD COLUMN "${col}" ${def}`);
        logger.info(`Migration: added hatching_cycles.${col}`);
      }
    }

    // Fix 3: Create prediction_logs table for self-monitoring
    await client.query(`
      CREATE TABLE IF NOT EXISTS prediction_logs (
        id SERIAL PRIMARY KEY,
        engine_version TEXT NOT NULL DEFAULT '2.0',
        analysis_type TEXT NOT NULL,
        input_hash TEXT NOT NULL,
        predicted_hatch_rate NUMERIC(6,3),
        predicted_risk_score INTEGER,
        confidence_score INTEGER,
        actual_hatch_rate NUMERIC(6,3),
        actual_risk_materialized TEXT,
        prediction_error NUMERIC(6,3),
        features_snapshot JSONB,
        model_metrics JSONB,
        data_quality_score INTEGER,
        anomalies_detected JSONB,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Fix 4: Create note_images table for farm photo observations
    await client.query(`
      CREATE TABLE IF NOT EXISTS note_images (
        id SERIAL PRIMARY KEY,
        note_id INTEGER,
        date TEXT NOT NULL,
        image_url TEXT NOT NULL,
        original_name TEXT,
        mime_type TEXT,
        category TEXT NOT NULL DEFAULT 'general',
        caption TEXT,
        author_id INTEGER,
        author_name TEXT,
        ai_analysis TEXT,
        ai_tags JSONB,
        ai_alerts JSONB,
        ai_confidence INTEGER,
        analysis_status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS image_feedback (
        id SERIAL PRIMARY KEY,
        image_id INTEGER NOT NULL REFERENCES note_images(id) ON DELETE CASCADE,
        user_id INTEGER,
        user_name TEXT,
        corrected_bird_count INTEGER,
        corrected_health_score INTEGER,
        corrected_risk_level TEXT,
        confidence_rating INTEGER,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_image_feedback_image_id ON image_feedback (image_id);
      CREATE INDEX IF NOT EXISTS idx_image_feedback_created_at ON image_feedback (created_at DESC);
    `);

    // Fix 5: Chickens AI Engine — flock_events table (event timeline)
    await client.query(`
      CREATE TABLE IF NOT EXISTS flock_events (
        id           SERIAL PRIMARY KEY,
        flock_id     INTEGER NOT NULL,
        event_type   TEXT NOT NULL,
        subtype      TEXT NOT NULL DEFAULT '',
        severity     TEXT NOT NULL DEFAULT 'medium',
        payload      JSONB NOT NULL DEFAULT '{}',
        confidence   INTEGER NOT NULL DEFAULT 50,
        created_at   TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_flock_events_flock_id ON flock_events (flock_id);
      CREATE INDEX IF NOT EXISTS idx_flock_events_created_at ON flock_events (created_at DESC);
    `);

    // Fix 6: Chickens AI Engine — intelligence scores in flocks table
    const intelligenceCols = [
      { col: "health_score",       def: "INTEGER" },
      { col: "risk_score",         def: "INTEGER" },
      { col: "performance_index",  def: "INTEGER" },
      { col: "last_analyzed_at",   def: "TIMESTAMP" },
    ];
    for (const { col, def } of intelligenceCols) {
      const { rows } = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'flocks' AND column_name = $1
      `, [col]);
      if (rows.length === 0) {
        await client.query(`ALTER TABLE flocks ADD COLUMN "${col}" ${def}`);
        logger.info(`Migration: added flocks.${col}`);
      }
    }

    logger.info("Migrations complete");
  } catch (err) {
    logger.error({ err }, "Migration failed");
  } finally {
    client.release();
  }
}
