import { Router } from "express";
import { requireRole } from "middlewares/require-role.middleware";
import { listUsers, updateManagerClientLimit, updateUserRole } from "controllers/admin.controller";
import { UserRole } from "enums/role.enum";

const router = Router();

router.get("/users", requireRole(UserRole.ADMIN), listUsers);
router.patch("/users/:userId/role", requireRole(UserRole.ADMIN), updateUserRole);
router.patch(
  "/managers/:managerId/client-limit",
  requireRole(UserRole.ADMIN),
  updateManagerClientLimit,
);

export default router;
