import { Router } from "express";
import { requireRole } from "middlewares/require-role.middleware";
import { resolveEffectiveUserId } from "middlewares/resolve-effective-user.middleware";
import {
  getDashboard,
  getInvestorProfile,
  getInvestorSummary,
  listActiveClients,
  listManagers,
  updateClientAutonomy,
  updateInvestorTargetPercentage,
} from "controllers/manager.controller";
import { UserRole } from "enums/role.enum";
import assetRoutes from "routes/assets.routes";
import assetTypeRoutes from "routes/asset-type.routes";
import assetClassRoutes from "routes/asset-class.routes";
import fixedIncomeAssetRoutes from "routes/fixed-income-asset.routes";
import institutionRoutes from "routes/institution.routes";
import wealthHistoryRoutes from "routes/wealth-history.routes";

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
router.patch(
  "/me/clients/:investorId/asset-types/:assetTypeId/target-percentage",
  managerOrAdmin,
  resolveEffectiveUserId,
  updateInvestorTargetPercentage,
);
router.patch(
  "/me/clients/:investorId/autonomy",
  managerOrAdmin,
  resolveEffectiveUserId,
  updateClientAutonomy,
);

router.use(
  "/me/clients/:investorId/assets",
  managerOrAdmin,
  resolveEffectiveUserId,
  assetRoutes,
);
router.use(
  "/me/clients/:investorId/asset-types",
  managerOrAdmin,
  resolveEffectiveUserId,
  assetTypeRoutes,
);
router.use(
  "/me/clients/:investorId/asset-classes",
  managerOrAdmin,
  resolveEffectiveUserId,
  assetClassRoutes,
);
router.use(
  "/me/clients/:investorId/fixed-income-assets",
  managerOrAdmin,
  resolveEffectiveUserId,
  fixedIncomeAssetRoutes,
);
router.use(
  "/me/clients/:investorId/institutions",
  managerOrAdmin,
  resolveEffectiveUserId,
  institutionRoutes,
);
router.use(
  "/me/clients/:investorId/wealth-history",
  managerOrAdmin,
  resolveEffectiveUserId,
  wealthHistoryRoutes,
);

export default router;
