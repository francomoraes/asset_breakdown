import {
  createAssetClass,
  deleteAssetClass,
  getAssetClassById,
  getAssetClasses,
  updateAssetClass,
} from "../controllers/asset-class.controller";
import { Router } from "express";
import { requireOwnPortfolioWriteAllowed } from "../middlewares/require-own-portfolio-write-allowed.middleware";

const router = Router();

router.get("/", getAssetClasses);
router.post("/", requireOwnPortfolioWriteAllowed, createAssetClass);
router.get("/:id", getAssetClassById);
router.patch("/:id", requireOwnPortfolioWriteAllowed, updateAssetClass);
router.delete("/:id", requireOwnPortfolioWriteAllowed, deleteAssetClass);

export default router;
