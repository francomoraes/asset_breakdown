import {
  createAssetClass,
  deleteAssetClass,
  getAssetClasses,
  updateAssetClass,
} from "../controllers/asset-class.controller";
import { Router } from "express";

const router = Router();

router.get("/asset-class", getAssetClasses);
router.post("/asset-class", createAssetClass);
router.patch("/asset-class/:id", updateAssetClass);
router.delete("/asset-class/:id", deleteAssetClass);

export default router;
