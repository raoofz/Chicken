import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health";
import flocksRouter from "./flocks";
import hatchingCyclesRouter from "./hatchingCycles";
import tasksRouter from "./tasks";
import goalsRouter from "./goals";
import activityLogsRouter from "./activityLogs";
import dashboardRouter from "./dashboard";
import authRouter from "./auth";
import dailyNotesRouter from "./dailyNotes";
import aiRouter from "./ai";
import diagnosticsRouter from "./diagnostics";
import storageRouter from "./storage";
import noteImagesRouter from "./noteImages";
import transactionsRouter from "./transactions";
import analyticsRouter from "./analytics";
import brainRouter from "./brain";
import validationRouter from "./validation";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ error: "غير مسجل الدخول" });
    return;
  }
  next();
}

router.use(authRouter);
router.use(healthRouter);
// Server-time is public (no auth) — must be registered before requireAuth
router.get("/server-time", (_req, res) => {
  const now = new Date();
  res.json({ serverTime: now.toISOString(), timestamp: now.getTime() });
});

router.use(requireAuth);
router.use(flocksRouter);
router.use(hatchingCyclesRouter);
router.use(tasksRouter);
router.use(goalsRouter);
router.use(activityLogsRouter);
router.use(dashboardRouter);
router.use(dailyNotesRouter);
router.use(aiRouter);
router.use(diagnosticsRouter);
router.use(storageRouter);
router.use(noteImagesRouter);
router.use(transactionsRouter);
router.use(analyticsRouter);
router.use(brainRouter);
router.use(validationRouter);

export default router;
