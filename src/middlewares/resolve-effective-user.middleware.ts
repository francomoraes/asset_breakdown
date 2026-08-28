import { NextFunction, Request, Response } from "express";
import { AppDataSource } from "config/data-source";
import { ManagerClientLink, LinkStatus } from "models/manager-client-link";
import { ForbiddenError } from "errors/app-error";
import { UserRole } from "enums/role.enum";

export const resolveEffectiveUserId = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const investorId = Number(req.params.investorId);

  if (req.user!.role === UserRole.ADMIN) {
    req.effectiveUserId = investorId;
    next();
    return;
  }

  const managerId = req.user!.userId;

  const linkRepo = AppDataSource.getRepository(ManagerClientLink);
  const link = await linkRepo.findOne({
    where: { managerId, investorId, status: LinkStatus.ACTIVE },
  });

  if (!link) {
    throw new ForbiddenError("No active link with this investor", "NO_ACTIVE_LINK");
  }

  req.effectiveUserId = investorId;
  next();
};
