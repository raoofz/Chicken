import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const USERS = [
  { username: "yones", name: "يونس", role: "admin", password: "1234" },
  { username: "raoof", name: "رؤوف", role: "admin", password: "1234" },
  { username: "nassar", name: "نصار", role: "admin", password: "1234" },
  { username: "hoobi", name: "هوبي", role: "worker", password: "1234" },
  { username: "abood", name: "عبود", role: "worker", password: "1234" },
];

export async function seedUsers() {
  for (const u of USERS) {
    const existing = await db.select().from(usersTable).where(eq(usersTable.username, u.username));
    if (existing.length === 0) {
      const hash = await bcrypt.hash(u.password, 10);
      await db.insert(usersTable).values({
        username: u.username,
        passwordHash: hash,
        name: u.name,
        role: u.role,
      });
    }
  }

  const oldUsers = ["admin", "worker"];
  for (const old of oldUsers) {
    await db.delete(usersTable).where(eq(usersTable.username, old));
  }
}
