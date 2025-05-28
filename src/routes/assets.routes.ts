import express from "express";
import {
  buyAsset,
  // createAsset,
  deleteAsset,
  getAssets,
  sellAsset,
  updateAsset,
} from "controllers/assets.controller";

const router = express.Router();
router.get("/assets", getAssets);
// router.post("/assets", createAsset); // Removido pois a função buyAsset já cria o ativo
router.put("/assets/:id", updateAsset);
router.delete("/assets/:id", deleteAsset);
router.post("/assets/:ticker/buy", buyAsset);
router.put("/assets/:ticker/sell", sellAsset);

export default router;
