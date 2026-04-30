import express from "express";
import {
  createAsset,
  deleteAsset,
  exportAssetCsv,
  getAssets,
  getAssetsByUser,
  refreshMarketPrices,
  clearPriceCache,
  updateAsset,
} from "../controllers/assets.controller";
import { refreshLimiter } from "../middlewares/rate-limit";

const router = express.Router();
router.get("/", getAssetsByUser);
router.get("/export", exportAssetCsv);
router.get("/refresh-market-prices", refreshLimiter, refreshMarketPrices);
router.delete("/price-cache", clearPriceCache);
router.post("/", createAsset);
router.put("/:id", updateAsset);
router.delete("/:id", deleteAsset);

export default router;
