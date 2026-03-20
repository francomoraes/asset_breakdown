import express from "express";
import {
  createAsset,
  deleteAsset,
  exportAssetCsv,
  getAssets,
  getAssetsByUser,
  refreshMarketPrices,
  updateAsset,
} from "../controllers/assets.controller";
import { refreshLimiter } from "../middlewares/rate-limit";

const router = express.Router();
router.get("/", getAssetsByUser);
router.get("/export", exportAssetCsv);
router.get("/refresh-market-prices", refreshLimiter, refreshMarketPrices);
router.post("/", createAsset);
router.put("/:id", updateAsset);
router.delete("/:id", deleteAsset);

export default router;
