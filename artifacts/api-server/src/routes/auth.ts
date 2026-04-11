import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) {
    res.status(400).json({ error: "يرجى إدخال اسم المستخدم وكلمة المرور" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (!user) {
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    return;
  }
  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.name = user.name;
  res.json({ id: user.id, username: user.username, name: user.name, role: user.role });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.post("/auth/change-password", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "غير مسجل الدخول" });
    return;
  }
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "يرجى إدخال كلمة المرور الحالية والجديدة" });
    return;
  }
  if (newPassword.length < 4) {
    res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) {
    res.status(404).json({ error: "المستخدم غير موجود" });
    return;
  }
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "كلمة المرور الحالية غير صحيحة" });
    return;
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.id, req.session.userId));
  res.json({ ok: true, message: "تم تغيير كلمة المرور بنجاح" });
});

router.get("/auth/me", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "غير مسجل الدخول" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) {
    res.status(401).json({ error: "المستخدم غير موجود" });
    return;
  }
  res.json({ id: user.id, username: user.username, name: user.name, role: user.role });
});

export default router;
