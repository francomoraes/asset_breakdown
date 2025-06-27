import {
  createAssetType,
  deleteAssetType,
  listAssetTypes,
  updateAssetType,
} from "controllers/assetType.controller";
import { Router } from "express";

const router = Router();

router.get("/asset-type/:userId", listAssetTypes);
router.post("/asset-type/:userId", createAssetType);
router.patch("/asset-type/:userId/:id", updateAssetType);
router.delete("/asset-type/:userId/:id", deleteAssetType);

export default router;
