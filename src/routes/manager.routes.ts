import { Router } from "express";
import { requireRole } from "middlewares/require-role.middleware";
import { resolveEffectiveUserId } from "middlewares/resolve-effective-user.middleware";
import {
  getDashboard,
  getInvestorAssets,
  getInvestorFixedIncomeAssets,
  getInvestorProfile,
  getInvestorSummary,
  getInvestorWealthHistory,
  listActiveClients,
  listManagers,
  updateInvestorTargetPercentage,
} from "controllers/manager.controller";
import { UserRole } from "enums/role.enum";

const router = Router();

const managerOrAdmin = requireRole(UserRole.MANAGER, UserRole.ADMIN);

router.get("/", listManagers);
router.get("/me/clients", managerOrAdmin, listActiveClients);
router.get("/me/dashboard", managerOrAdmin, getDashboard);

router.get(
  "/me/clients/:investorId/profile",
  managerOrAdmin,
  resolveEffectiveUserId,
  getInvestorProfile,
);
router.get(
  "/me/clients/:investorId/summary",
  managerOrAdmin,
  resolveEffectiveUserId,
  getInvestorSummary,
);
router.get(
  "/me/clients/:investorId/assets",
  managerOrAdmin,
  resolveEffectiveUserId,
  getInvestorAssets,
);
router.get(
  "/me/clients/:investorId/fixed-income-assets",
  managerOrAdmin,
  resolveEffectiveUserId,
  getInvestorFixedIncomeAssets,
);
router.get(
  "/me/clients/:investorId/wealth-history",
  managerOrAdmin,
  resolveEffectiveUserId,
  getInvestorWealthHistory,
);
router.patch(
  "/me/clients/:investorId/asset-types/:assetTypeId/target-percentage",
  managerOrAdmin,
  resolveEffectiveUserId,
  updateInvestorTargetPercentage,
);

export default router;
