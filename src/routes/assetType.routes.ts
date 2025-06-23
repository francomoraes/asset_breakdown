import {
  listAssetTypes,
  updateAssetType,
} from "controllers/assetType.controller";
import { Router } from "express";

const router = Router();

router.get("/asset-type/:userId", listAssetTypes);
router.patch("/asset-type/:id", updateAssetType);

export default router;
