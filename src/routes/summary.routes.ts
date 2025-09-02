import {
  getOverviewByCurrency,
  getSummary,
} from "../controllers/summary.controller";
import { Router } from "express";

const router = Router();

router.get("/summary", getSummary);
router.get("/summary/overview", getOverviewByCurrency);

export default router;
