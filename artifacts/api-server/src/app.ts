import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { authMiddleware } from "./middlewares/authMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { runMigrations } from "./lib/migrate";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

async function ensureDbConnection() {
  try {
    await db.execute(sql`SELECT 1`);
  } catch (err) {
    logger.warn({ err }, "DB wake-up ping failed, retrying...");
    await new Promise(r => setTimeout(r, 2000));
    try {
      await db.execute(sql`SELECT 1`);
      logger.info("DB wake-up retry succeeded");
    } catch (err2) {
      logger.error({ err: err2 }, "DB wake-up retry also failed");
    }
  }
}

ensureDbConnection()
  .then(() => runMigrations())
  .catch(err => logger.error({ err }, "DB init failed"));

app.use("/api", router);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err && typeof err === "object" && "issues" in err && Array.isArray((err as any).issues)) {
    const issues = (err as any).issues as Array<{ path: string[]; message: string }>;
    const messages = issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
    logger.warn({ err }, "Validation error");
    res.status(400).json({ error: "بيانات غير صحيحة", details: messages });
    return;
  }
  logger.error({ err }, "Unhandled error");
  const isDatabaseError = err instanceof Error && (
    err.message.includes("endpoint has been disabled") ||
    err.message.includes("Failed query") ||
    err.message.includes("ECONNREFUSED") ||
    err.message.includes("connection")
  );
  if (isDatabaseError) {
    res.status(503).json({ error: "خطأ في الاتصال بقاعدة البيانات. يرجى المحاولة بعد قليل" });
    return;
  }
  res.status(500).json({ error: "حدث خطأ في السيرفر. يرجى المحاولة مرة أخرى" });
});

export default app;
