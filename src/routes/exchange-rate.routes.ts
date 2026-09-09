import { Router } from "express";
import { getExchangeRate } from "../controllers/exchange-rate.controller";

const router = Router();

router.get("/", getExchangeRate);

export default router;
