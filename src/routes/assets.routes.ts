import express from "express";
import {
  buyAsset,
  createAsset,
  deleteAsset,
  getAssets,
  updateAsset,
} from "../controllers/assets.controller";

const router = express.Router();
router.get("/assets", getAssets);
router.post("/assets", createAsset);
router.put("/assets/:id", updateAsset);
router.delete("/assets/:id", deleteAsset);
router.post("/assets/:ticker/buy", buyAsset);

export default router;
