import { getSummary } from "controllers/summaryController";
import { Router } from "express";

const router = Router();

router.get("/summary/:userId", getSummary);

export default router;
