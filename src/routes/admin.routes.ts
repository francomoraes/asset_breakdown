import { Router } from "express";
import { requireRole } from "middlewares/require-role.middleware";
import {
  getAdminDashboard,
  listUsers,
  updateManagerClientLimit,
  updateUserRole,
} from "controllers/admin.controller";
import { UserRole } from "enums/role.enum";

const router = Router();

router.get("/dashboard", requireRole(UserRole.ADMIN), getAdminDashboard);
router.get("/users", requireRole(UserRole.ADMIN), listUsers);
router.patch("/users/:userId/role", requireRole(UserRole.ADMIN), updateUserRole);
router.patch(
  "/managers/:managerId/client-limit",
  requireRole(UserRole.ADMIN),
  updateManagerClientLimit,
);

export default router;
