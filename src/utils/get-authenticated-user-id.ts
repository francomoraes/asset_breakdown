import { UnauthorizedError } from "../errors/app-error";
import { Request } from "express";

export const getAuthenticatedUserId = (req: Request): number => {
  if (!req.user?.userId) {
    throw new UnauthorizedError("User not authorized");
  }
  return Number(req.user.userId);
};
