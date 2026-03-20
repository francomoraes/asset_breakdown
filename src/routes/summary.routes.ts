import {
  getOverviewByCurrency,
  getSummary,
} from "../controllers/summary.controller";
import { Router } from "express";
import { summaryLimiter } from "../middlewares/rate-limit";

const router = Router();

router.get("/", summaryLimiter, getSummary);
router.get("/overview", summaryLimiter, getOverviewByCurrency);

export default router;
