import express from "express";
import {
  createFixedIncomeAsset,
  deleteFixedIncomeAsset,
  getFixedIncomeAssetsByUser,
  updateFixedIncomeAsset,
} from "../controllers/fixed-income-asset.controller";
import { requireOwnPortfolioWriteAllowed } from "../middlewares/require-own-portfolio-write-allowed.middleware";

const router = express.Router();

router.get("/", getFixedIncomeAssetsByUser);
router.post("/", requireOwnPortfolioWriteAllowed, createFixedIncomeAsset);
router.put("/:id", requireOwnPortfolioWriteAllowed, updateFixedIncomeAsset);
router.delete(
  "/:id",
  requireOwnPortfolioWriteAllowed,
  deleteFixedIncomeAsset,
);

export default router;
