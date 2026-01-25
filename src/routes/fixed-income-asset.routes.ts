import express from "express";
import {
  createFixedIncomeAsset,
  deleteFixedIncomeAsset,
  getFixedIncomeAssetsByUser,
  updateFixedIncomeAsset,
} from "../controllers/fixed-income-asset.controller";

const router = express.Router();

router.get("/", getFixedIncomeAssetsByUser);
router.post("/", createFixedIncomeAsset);
router.put("/:id", updateFixedIncomeAsset);
router.delete("/:id", deleteFixedIncomeAsset);

export default router;
