import { Router, type IRouter } from "express";
import {
  buildBalanceSheetReport,
  buildCashFlowReport,
  buildProfitAndLossReport,
} from "../modules/accounting/accounting.reports.js";

const router: IRouter = Router();

router.get("/accounting/reports/profit-loss", async (_req, res) => {
  res.json(await buildProfitAndLossReport());
});

router.get("/accounting/reports/balance-sheet", async (_req, res) => {
  res.json(await buildBalanceSheetReport());
});

router.get("/accounting/reports/cash-flow", async (_req, res) => {
  res.json(await buildCashFlowReport());
});

export default router;
