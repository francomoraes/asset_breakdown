import { NextFunction, Request, Response } from "express";
import { AppDataSource } from "config/data-source";
import { User } from "models/user";
import { UserRole } from "enums/role.enum";
import { ForbiddenError } from "errors/app-error";

export const requireOwnPortfolioWriteAllowed = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  if (req.effectiveUserId !== undefined) {
    next();
    return;
  }

  const { userId, role } = req.user!;

  if (role === UserRole.MANAGER || role === UserRole.ADMIN) {
    throw new ForbiddenError(
      "Managers cannot own a portfolio",
      "MANAGER_CANNOT_OWN_PORTFOLIO",
    );
  }

  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({
    where: { id: userId },
    select: ["id", "selfServiceEnabled"],
  });

  if (!user?.selfServiceEnabled) {
    throw new ForbiddenError(
      "Your manager has control of your portfolio right now",
      "AUTONOMY_REQUIRED",
    );
  }

  next();
};
