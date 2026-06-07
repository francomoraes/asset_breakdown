import { NextFunction, Request, Response } from "express";
import { UserRole } from "enums/role.enum";
import { ForbiddenError } from "errors/app-error";

export const requireRole = (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
      throw new ForbiddenError("Insufficient permissions");
    }
    next();
  };
