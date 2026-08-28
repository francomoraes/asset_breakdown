import { Router } from "express";
import { listInvestors } from "controllers/investor.controller";

const router = Router();

router.get("/", listInvestors);

export default router;
