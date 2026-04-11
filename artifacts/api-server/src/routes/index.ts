import { Router, type IRouter } from "express";
import healthRouter from "./health";
import flocksRouter from "./flocks";
import hatchingCyclesRouter from "./hatchingCycles";
import tasksRouter from "./tasks";
import goalsRouter from "./goals";
import activityLogsRouter from "./activityLogs";
import dashboardRouter from "./dashboard";
import authRouter from "./auth";
import dailyNotesRouter from "./dailyNotes";
import aiAnalysisRouter from "./aiAnalysis";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(flocksRouter);
router.use(hatchingCyclesRouter);
router.use(tasksRouter);
router.use(goalsRouter);
router.use(activityLogsRouter);
router.use(dashboardRouter);
router.use(dailyNotesRouter);
router.use(aiAnalysisRouter);

export default router;
