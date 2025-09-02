import {
  createAssetClass,
  deleteAssetClass,
  getAssetClasses,
  updateAssetClass,
} from "../controllers/asset-class.controller";
import { Router } from "express";

const router = Router();

router.get("/asset-class/:userId", getAssetClasses);
router.post("/asset-class/:userId", createAssetClass);
router.patch("/asset-class/:userId/:id", updateAssetClass);
router.delete("/asset-class/:userId/:id", deleteAssetClass);

export default router;
