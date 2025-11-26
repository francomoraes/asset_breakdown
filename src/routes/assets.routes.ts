import express from "express";
import {
  buyAsset,
  deleteAsset,
  exportAssetCsv,
  getAssets,
  getAssetsByUser,
  refreshMarketPrices,
  sellAsset,
  updateAsset,
} from "../controllers/assets.controller";

const router = express.Router();
router.get("/", getAssetsByUser);
router.get("/export", exportAssetCsv);
router.get("/refresh-market-prices", refreshMarketPrices);
router.put("/:id", updateAsset);
router.delete("/:id", deleteAsset);
router.post("/:ticker/buy", buyAsset);
router.put("/:ticker/sell", sellAsset);

export default router;
