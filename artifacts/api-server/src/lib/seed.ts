import { db, usersTable } from "@workspace/db";
import bcrypt from "bcryptjs";

export async function seedUsers() {
  const existing = await db.select().from(usersTable);
  if (existing.length > 0) return;

  const adminHash = await bcrypt.hash("admin123", 10);
  const workerHash = await bcrypt.hash("worker123", 10);

  await db.insert(usersTable).values([
    { username: "admin", passwordHash: adminHash, name: "المدير", role: "admin" },
    { username: "worker", passwordHash: workerHash, name: "العامل", role: "worker" },
  ]);
}
