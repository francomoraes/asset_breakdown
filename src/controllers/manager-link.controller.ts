import { Request, Response } from "express";
import { managerLinkService } from "services/manager-link.service";
import { managerHistoryService } from "services/manager-history.service";
import { CreateLinkDto } from "dtos/manager.dto";
import { UserRole } from "enums/role.enum";
import { ForbiddenError } from "errors/app-error";
import { getAuthenticatedUserId } from "utils/get-authenticated-user-id";
import { handleZodError } from "utils/handle-zod-error";

export const createLink = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const callerId = getAuthenticatedUserId(req);

  const result = CreateLinkDto.safeParse(req.body);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const { targetUserId, asRole } = result.data;

  if (asRole === "manager" && req.user?.role === UserRole.INVESTOR) {
    throw new ForbiddenError(
      "Investors cannot request to manage another account",
      "FORBIDDEN",
    );
  }

  const { investorId, managerId } =
    asRole === "investor"
      ? { investorId: callerId, managerId: targetUserId }
      : { investorId: targetUserId, managerId: callerId };

  const link = await managerLinkService.createLink({
    investorId,
    managerId,
    requestedByUserId: callerId,
  });

  res.status(201).json({
    link: {
      id: link.id,
      investorId: link.investorId,
      managerId: link.managerId,
      status: link.status,
      createdAt: link.createdAt,
    },
  });
};

export const getMyLinks = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const investorId = getAuthenticatedUserId(req);
  const data = await managerLinkService.getMyLinks({ investorId });
  res.json({ data });
};

export const getMyHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const investorId = getAuthenticatedUserId(req);
  const data = await managerHistoryService.getInvestorHistory({ investorId });
  res.json({ data });
};

export const getPendingApprovals = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const data = await managerLinkService.getPendingApprovals({ userId });
  res.json({ data });
};

export const getSentRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const managerId = getAuthenticatedUserId(req);
  const data = await managerLinkService.getSentRequests({ managerId });
  res.json({ data });
};

export const approveLink = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const callerId = getAuthenticatedUserId(req);
  const linkId = Number(req.params.linkId);

  const link = await managerLinkService.approveLink({ linkId, callerId });

  res.json({
    link: { id: link.id, status: link.status, activatedAt: link.activatedAt },
  });
};

export const rejectLink = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const callerId = getAuthenticatedUserId(req);
  const linkId = Number(req.params.linkId);

  const link = await managerLinkService.rejectLink({ linkId, callerId });

  res.json({
    link: { id: link.id, status: link.status, rejectedAt: link.rejectedAt },
  });
};

export const revokeLink = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const callerId = getAuthenticatedUserId(req);
  const linkId = Number(req.params.linkId);

  const link = await managerLinkService.revokeLink({ linkId, callerId });

  res.json({
    link: {
      id: link.id,
      status: link.status,
      revokedAt: link.revokedAt,
      revokeReason: link.revokeReason,
    },
  });
};
