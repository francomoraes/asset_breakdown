import {
  createAssetType,
  deleteAssetType,
  getAssetTypeById,
  getAssetTypes,
  updateAssetType,
} from "../controllers/asset-type.controller";
import { Router } from "express";
import { requireOwnPortfolioWriteAllowed } from "../middlewares/require-own-portfolio-write-allowed.middleware";

const router = Router();

router.get("/", getAssetTypes);
router.post("/", requireOwnPortfolioWriteAllowed, createAssetType);
router.get("/:id", getAssetTypeById);
router.patch("/:id", requireOwnPortfolioWriteAllowed, updateAssetType);
router.delete("/:id", requireOwnPortfolioWriteAllowed, deleteAssetType);

export default router;
