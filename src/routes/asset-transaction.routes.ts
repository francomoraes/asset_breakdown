import express from "express";
import {
  createTransaction,
  deleteTransaction,
  getTransactions,
  updateTransaction,
} from "../controllers/asset-transaction.controller";
import { requireOwnPortfolioWriteAllowed } from "../middlewares/require-own-portfolio-write-allowed.middleware";

const router = express.Router();

router.get("/", getTransactions);
router.post("/", requireOwnPortfolioWriteAllowed, createTransaction);
router.put(
  "/:transactionId",
  requireOwnPortfolioWriteAllowed,
  updateTransaction,
);
router.delete(
  "/:transactionId",
  requireOwnPortfolioWriteAllowed,
  deleteTransaction,
);

export default router;
