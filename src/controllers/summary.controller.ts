import { Request, Response } from "express";
import { summaryService } from "../services/summary.service";
import { handleZodError } from "../utils/handle-zod-error";

import { getAuthenticatedUserId } from "utils/get-authenticated-user-id";

export const getSummary = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);

  const summary = await summaryService.getSummary({ userId });
  res.json(summary);
};

export const getOverviewByCurrency = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);

  const overview = await summaryService.getOverviewByCurrency({ userId });
  res.json(overview);
};
