import express from "express";
import {
  getWealthHistory,
  createWealthHistory,
  updateWealthHistory,
  deleteWealthHistory,
  getMarketIndicesHistory,
} from "../controllers/wealth-history.controller";

const router = express.Router();

router.get("/", getWealthHistory);
router.get("/market-indices", getMarketIndicesHistory);
router.post("/", createWealthHistory);
router.put("/:id", updateWealthHistory);
router.delete("/:id", deleteWealthHistory);

export default router;
