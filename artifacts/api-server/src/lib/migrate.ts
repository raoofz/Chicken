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

    logger.info("Migrations complete");
  } catch (err) {
    logger.error({ err }, "Migration failed");
  } finally {
    client.release();
  }
}
