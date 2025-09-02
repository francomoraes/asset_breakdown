import {
  createAssetType,
  deleteAssetType,
  getAssetTypes,
  updateAssetType,
} from "../controllers/asset-type.controller";
import { Router } from "express";

const router = Router();

router.get("/asset-type", getAssetTypes);
router.post("/asset-type", createAssetType);
router.patch("/asset-type/:id", updateAssetType);
router.delete("/asset-type/:id", deleteAssetType);

export default router;
