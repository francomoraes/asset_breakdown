import {
  createAssetClass,
  deleteAssetClass,
  getAssetClassById,
  getAssetClasses,
  updateAssetClass,
} from "../controllers/asset-class.controller";
import { Router } from "express";

const router = Router();

router.get("/", getAssetClasses);
router.post("/", createAssetClass);
router.get("/:id", getAssetClassById);
router.patch("/:id", updateAssetClass);
router.delete("/:id", deleteAssetClass);

export default router;
