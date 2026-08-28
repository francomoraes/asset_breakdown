import { Request } from "express";
import { getAuthenticatedUserId } from "./get-authenticated-user-id";

export const getEffectiveUserId = (req: Request): number => {
  return req.effectiveUserId ?? getAuthenticatedUserId(req);
};
