import {
  createAssetType,
  deleteAssetType,
  getAssetTypes,
  updateAssetType,
} from "../controllers/asset-type.controller";
import { Router } from "express";

const router = Router();

router.get("/", getAssetTypes);
router.post("/", createAssetType);
router.patch("/:id", updateAssetType);
router.delete("/:id", deleteAssetType);

export default router;
