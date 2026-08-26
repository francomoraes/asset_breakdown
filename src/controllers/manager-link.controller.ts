import { Request, Response } from "express";
import { managerLinkService } from "services/manager-link.service";
import { managerHistoryService } from "services/manager-history.service";
import { CreateLinkDto } from "dtos/manager.dto";
import { UserRole } from "enums/role.enum";
import { BadRequestError } from "errors/app-error";
import { getAuthenticatedUserId } from "utils/get-authenticated-user-id";
import { handleZodError } from "utils/handle-zod-error";

export const createLink = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const callerId = getAuthenticatedUserId(req);
  const callerRole = req.user!.role;

  const result = CreateLinkDto.safeParse(req.body);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const { investorId, managerId: bodyManagerId } = result.data;

  let managerId: number;
  if (callerRole === UserRole.ADMIN) {
    if (!bodyManagerId) {
      throw new BadRequestError(
        "managerId is required when caller is admin",
        "MANAGER_ID_REQUIRED",
      );
    }
    managerId = bodyManagerId;
  } else {
    managerId = callerId;
  }

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
      activatedAt: link.activatedAt,
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

export const revokeLink = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const callerId = getAuthenticatedUserId(req);
  const callerRole = req.user!.role;
  const linkId = Number(req.params.linkId);

  const link = await managerLinkService.revokeLink({
    linkId,
    callerId,
    callerRole,
  });

  res.json({
    link: {
      id: link.id,
      status: link.status,
      revokedAt: link.revokedAt,
      revokeReason: link.revokeReason,
    },
  });
};
