import { Router } from "express";
import {
  createCryptoAccount,
  deleteCryptoAccount,
  getCryptoAccounts,
  syncCryptoAccount,
} from "../controllers/crypto-account.controller";
import { cryptoSyncLimiter } from "../middlewares/rate-limit";

const router = Router();

router.get("/", getCryptoAccounts);
router.post("/", createCryptoAccount);
router.post("/:id/sync", cryptoSyncLimiter, syncCryptoAccount);
router.delete("/:id", deleteCryptoAccount);

export default router;
