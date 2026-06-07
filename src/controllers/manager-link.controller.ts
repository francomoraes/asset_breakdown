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

  if (
    req.user?.role === UserRole.MANAGER ||
    req.user?.role === UserRole.ADMIN
  ) {
    throw new ForbiddenError("Managers and admins cannot request links", "FORBIDDEN");
  }

  const result = CreateLinkDto.safeParse(req.body);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const link = await managerLinkService.createLink({
    investorId: callerId,
    managerId: result.data.managerId,
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

export const getPendingLinks = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const managerId = getAuthenticatedUserId(req);
  const data = await managerLinkService.getPendingLinks({ managerId });
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
