/**
 * seed.ts — Initial User Seeding
 * ═══════════════════════════════════════════════════════════════════════════
 * Seeds the initial admin/worker accounts ONLY if they don't yet exist.
 * Passwords are read from environment variables; in production a missing
 * env var causes a hard error rather than silently using a weak default.
 *
 * Env vars used:
 *   ADMIN_PASSWORD   — password for admin accounts (required in production)
 *   WORKER_PASSWORD  — password for worker accounts (required in production)
 */

import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logger } from "./logger.js";

const isProd = process.env.NODE_ENV === "production";
const SALT_ROUNDS = 12;

function resolvePassword(envKey: string, fallback: string, role: string): string {
  const val = process.env[envKey];
  if (val && val.trim().length >= 8) {
    return val.trim();
  }
  if (isProd) {
    throw new Error(
      `[SECURITY] ${envKey} must be set to a strong password (≥ 8 chars) before production seeding. ` +
      `Refusing to create ${role} accounts with a weak or missing password.`
    );
  }
  logger.warn(
    { envKey },
    `[SECURITY WARNING] ${envKey} not set or too short — using development fallback. ` +
    `NEVER use this configuration in production.`
  );
  return fallback;
}

const USERS = [
  { username: "yones",  name: "يونس", role: "admin"  as const, envKey: "ADMIN_PASSWORD",  devFallback: "Dev@yones2024!" },
  { username: "raoof",  name: "رؤوف", role: "admin"  as const, envKey: "ADMIN_PASSWORD",  devFallback: "Dev@raoof2024!" },
  { username: "nassar", name: "نصار", role: "admin"  as const, envKey: "ADMIN_PASSWORD",  devFallback: "Dev@nassar2024!" },
  { username: "hoobi",  name: "هوبي", role: "worker" as const, envKey: "WORKER_PASSWORD", devFallback: "Dev@hoobi2024!" },
  { username: "abood",  name: "عبود", role: "worker" as const, envKey: "WORKER_PASSWORD", devFallback: "Dev@abood2024!" },
];

export async function seedUsers() {
  for (const u of USERS) {
    const existing = await db.select().from(usersTable).where(eq(usersTable.username, u.username));
    if (existing.length === 0) {
      const password = resolvePassword(u.envKey, u.devFallback, u.role);
      const hash = await bcrypt.hash(password, SALT_ROUNDS);
      await db.insert(usersTable).values({
        username: u.username,
        passwordHash: hash,
        name: u.name,
        role: u.role,
      });
      logger.info({ username: u.username, role: u.role }, "Seeded user");
    }
  }

  const legacyUsers = ["admin", "worker"];
  for (const old of legacyUsers) {
    await db.delete(usersTable).where(eq(usersTable.username, old));
  }
}
