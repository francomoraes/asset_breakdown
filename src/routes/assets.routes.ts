import express from "express";
import {
  createAsset,
  deleteAsset,
  exportAssetCsv,
  getAssetsByUser,
  refreshMarketPrices,
  retryAssetPrice,
  clearPriceCache,
  updateAsset,
} from "../controllers/assets.controller";
import { refreshLimiter } from "../middlewares/rate-limit";
import { requireOwnPortfolioWriteAllowed } from "../middlewares/require-own-portfolio-write-allowed.middleware";

const router = express.Router();
router.get("/", getAssetsByUser);
router.get("/export", exportAssetCsv);
router.get(
  "/refresh-market-prices",
  requireOwnPortfolioWriteAllowed,
  refreshLimiter,
  refreshMarketPrices,
);
router.delete("/price-cache", clearPriceCache);
router.post("/", requireOwnPortfolioWriteAllowed, createAsset);
router.post(
  "/:id/retry-price",
  requireOwnPortfolioWriteAllowed,
  retryAssetPrice,
);
router.put("/:id", requireOwnPortfolioWriteAllowed, updateAsset);
router.delete("/:id", requireOwnPortfolioWriteAllowed, deleteAsset);

export default router;
