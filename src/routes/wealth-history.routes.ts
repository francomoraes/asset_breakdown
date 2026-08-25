import express from "express";
import {
  getWealthHistory,
  createWealthHistory,
  updateWealthHistory,
  deleteWealthHistory,
  getMarketIndicesHistory,
} from "../controllers/wealth-history.controller";
import { marketIndicesLimiter } from "../middlewares/rate-limit";
import { requireOwnPortfolioWriteAllowed } from "../middlewares/require-own-portfolio-write-allowed.middleware";

const router = express.Router();

router.get("/", getWealthHistory);
router.get("/market-indices", marketIndicesLimiter, getMarketIndicesHistory);
router.post("/", requireOwnPortfolioWriteAllowed, createWealthHistory);
router.put("/:id", requireOwnPortfolioWriteAllowed, updateWealthHistory);
router.delete("/:id", requireOwnPortfolioWriteAllowed, deleteWealthHistory);

export default router;
