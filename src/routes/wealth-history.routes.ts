import express from "express";
import {
  getWealthHistory,
  createWealthHistory,
  updateWealthHistory,
  deleteWealthHistory,
  getMarketIndicesHistory,
} from "../controllers/wealth-history.controller";
import { marketIndicesLimiter } from "../middlewares/rate-limit";

const router = express.Router();

router.get("/", getWealthHistory);
router.get("/market-indices", marketIndicesLimiter, getMarketIndicesHistory);
router.post("/", createWealthHistory);
router.put("/:id", updateWealthHistory);
router.delete("/:id", deleteWealthHistory);

export default router;
