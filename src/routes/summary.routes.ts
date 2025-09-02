import {
  getOverviewByCurrency,
  getSummary,
} from "../controllers/summary.controller";
import { Router } from "express";

const router = Router();

router.get("/summary/:userId", getSummary);
router.get("/summary/:userId/overview", getOverviewByCurrency);

export default router;
