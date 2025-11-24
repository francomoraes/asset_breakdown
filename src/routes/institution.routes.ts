import {
  createInstitution,
  deleteInstitution,
  getInstitutionById,
  getInstitutions,
  updateInstitution,
} from "../controllers/institution.controller";
import { Router } from "express";

const router = Router();

router.get("/", getInstitutions);
router.post("/", createInstitution);
router.get("/:id", getInstitutionById);
router.patch("/:id", updateInstitution);
router.delete("/:id", deleteInstitution);

export default router;
