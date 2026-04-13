import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "محاولات كثيرة. يرجى الانتظار 15 دقيقة" },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { error: "طلبات كثيرة. يرجى الانتظار" },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

router.use(apiLimiter);

router.post("/auth/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) {
    res.status(400).json({ error: "يرجى إدخال اسم المستخدم وكلمة المرور" });
    return;
  }
  if (typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }
  if (username.length > 50 || password.length > 128) {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username.trim().toLowerCase()));
    if (!user) {
      logger.warn({ username: username.trim() }, "Failed login attempt - unknown user");
      res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      logger.warn({ username: username.trim(), userId: user.id }, "Failed login attempt - wrong password");
      res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      return;
    }
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.name = user.name;
    logger.info({ username: user.username, userId: user.id, role: user.role }, "Successful login");
    res.json({ id: user.id, username: user.username, name: user.name, role: user.role });
  } catch (err) {
    logger.error({ err }, "Login DB error");
    res.status(503).json({ error: "خطأ في الاتصال بقاعدة البيانات. يرجى المحاولة بعد قليل" });
  }
});

router.post("/auth/logout", (req, res) => {
  const userId = req.session.userId;
  req.session.destroy(() => {
    if (userId) logger.info({ userId }, "User logged out");
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
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }
  if (newPassword.length < 4) {
    res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل" });
    return;
  }
  if (newPassword.length > 128) {
    res.status(400).json({ error: "كلمة المرور طويلة جداً" });
    return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
    if (!user) {
      res.status(404).json({ error: "المستخدم غير موجود" });
      return;
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      logger.warn({ userId: req.session.userId }, "Failed password change - wrong current password");
      res.status(401).json({ error: "كلمة المرور الحالية غير صحيحة" });
      return;
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.id, req.session.userId));
    logger.info({ userId: req.session.userId }, "Password changed successfully");
    res.json({ ok: true, message: "تم تغيير كلمة المرور بنجاح" });
  } catch (err) {
    logger.error({ err }, "Change password DB error");
    res.status(503).json({ error: "خطأ في الاتصال بقاعدة البيانات. يرجى المحاولة بعد قليل" });
  }
});

router.get("/auth/me", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "غير مسجل الدخول" });
    return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
    if (!user) {
      res.status(401).json({ error: "المستخدم غير موجود" });
      return;
    }
    res.json({ id: user.id, username: user.username, name: user.name, role: user.role });
  } catch (err) {
    logger.error({ err }, "Auth me DB error");
    res.status(503).json({ error: "خطأ في الاتصال بقاعدة البيانات" });
  }
});

export default router;
