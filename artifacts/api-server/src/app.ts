import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { seedUsers } from "./lib/seed";

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const secret = process.env["SESSION_SECRET"] ?? "farm-secret-key-2024";
app.use(
  session({
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

seedUsers().catch(err => logger.error({ err }, "Seed users failed"));

app.use("/api", router);

// Global error handler — catches ZodError (detected by .issues array) + generic errors
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err && typeof err === "object" && "issues" in err && Array.isArray((err as any).issues)) {
    const issues = (err as any).issues as Array<{ path: string[]; message: string }>;
    const messages = issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
    logger.warn({ err }, "Validation error");
    res.status(400).json({ error: "بيانات غير صحيحة", details: messages });
    return;
  }
  logger.error({ err }, "Unhandled error");
  const message = err instanceof Error ? err.message : "خطأ في السيرفر";
  res.status(500).json({ error: message });
});

export default app;
