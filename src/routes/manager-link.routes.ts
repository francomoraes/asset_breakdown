import { Router } from "express";
import {
  approveLink,
  createLink,
  getMyHistory,
  getMyLinks,
  getPendingApprovals,
  getSentRequests,
  rejectLink,
  revokeLink,
} from "controllers/manager-link.controller";

const router = Router();

router.post("/", createLink);
router.get("/me", getMyLinks);
router.get("/me/history", getMyHistory);
router.get("/pending", getPendingApprovals);
router.get("/sent", getSentRequests);
router.patch("/:linkId/approve", approveLink);
router.patch("/:linkId/reject", rejectLink);
router.patch("/:linkId/revoke", revokeLink);

export default router;
