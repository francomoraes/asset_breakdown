import {
  getOverviewByCurrency,
  getSummary,
} from "../controllers/summary.controller";
import { Router } from "express";

const router = Router();

router.get("/", getSummary);
router.get("/overview", getOverviewByCurrency);

export default router;
