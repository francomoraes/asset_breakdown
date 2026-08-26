import { Router } from "express";
import { requireRole } from "middlewares/require-role.middleware";
import { UserRole } from "enums/role.enum";
import {
  createLink,
  getMyHistory,
  getMyLinks,
  revokeLink,
} from "controllers/manager-link.controller";

const router = Router();

const managerOrAdmin = requireRole(UserRole.MANAGER, UserRole.ADMIN);

router.post("/", managerOrAdmin, createLink);
router.get("/me", getMyLinks);
router.get("/me/history", getMyHistory);
router.patch("/:linkId/revoke", managerOrAdmin, revokeLink);

export default router;
