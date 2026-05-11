import "./env-bootstrap";
import app from "./app";
import { logger } from "./lib/logger";
import { createServer } from "node:net";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { runMigrations } from "./lib/migrate";
import { seedUsers } from "./lib/seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

/**
 * Verify the port is available before binding.
 * Fails fast with a clear message — no forceful process killing.
 */
function checkPort(p: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tester = createServer();
    tester.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(new Error(`Port ${p} is already in use. Stop the conflicting process and restart.`));
      } else {
        reject(err);
      }
    });
    tester.once("listening", () => {
      tester.close(() => resolve());
    });
    tester.listen(p);
  });
}

async function prepareDatabase(): Promise<void> {
  await db.execute(sql`SELECT 1`);
  await runMigrations();
  await seedUsers();
}

checkPort(port)
  .then(() => prepareDatabase())
  .then(() => {
    app.listen(port, () => {
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Could not start server — database preparation or port check failed");
    process.exit(1);
  });
