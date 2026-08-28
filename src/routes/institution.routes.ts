import {
  createInstitution,
  deleteInstitution,
  getInstitutionById,
  getInstitutions,
  updateInstitution,
} from "../controllers/institution.controller";
import { Router } from "express";
import { requireOwnPortfolioWriteAllowed } from "../middlewares/require-own-portfolio-write-allowed.middleware";

const router = Router();

router.get("/", getInstitutions);
router.post("/", requireOwnPortfolioWriteAllowed, createInstitution);
router.get("/:id", getInstitutionById);
router.patch("/:id", requireOwnPortfolioWriteAllowed, updateInstitution);
router.delete("/:id", requireOwnPortfolioWriteAllowed, deleteInstitution);

export default router;
