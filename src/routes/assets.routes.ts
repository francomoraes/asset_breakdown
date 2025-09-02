import express from "express";
import {
  buyAsset,
  deleteAsset,
  exportAssetCsv,
  getAssets,
  getAssetsByUser,
  sellAsset,
  updateAsset,
} from "../controllers/assets.controller";

const router = express.Router();
router.get("/assets", getAssetsByUser);
router.get("/assets/export", exportAssetCsv);
router.put("/assets/:id", updateAsset);
router.delete("/assets/:id", deleteAsset);
router.post("/assets/:ticker/buy", buyAsset);
router.put("/assets/:ticker/sell", sellAsset);

export default router;
