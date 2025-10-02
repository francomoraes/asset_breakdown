import {
  createAssetClass,
  deleteAssetClass,
  getAssetClasses,
  updateAssetClass,
} from "../controllers/asset-class.controller";
import { Router } from "express";

const router = Router();

router.get("/", getAssetClasses);
router.post("/", createAssetClass);
router.patch("/:id", updateAssetClass);
router.delete("/:id", deleteAssetClass);

export default router;
