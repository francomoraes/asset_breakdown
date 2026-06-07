import { Router } from "express";
import { requireRole } from "middlewares/require-role.middleware";
import {
  approveLink,
  createLink,
  getMyHistory,
  getMyLinks,
  getPendingLinks,
  rejectLink,
  revokeLink,
} from "controllers/manager-link.controller";
import { UserRole } from "enums/role.enum";

const router = Router();

router.post("/", createLink);
router.get("/me", getMyLinks);
router.get("/me/history", getMyHistory);
router.get("/pending", requireRole(UserRole.MANAGER, UserRole.ADMIN), getPendingLinks);
router.patch("/:linkId/approve", requireRole(UserRole.MANAGER, UserRole.ADMIN), approveLink);
router.patch("/:linkId/reject", requireRole(UserRole.MANAGER, UserRole.ADMIN), rejectLink);
router.patch("/:linkId/revoke", revokeLink);

export default router;
