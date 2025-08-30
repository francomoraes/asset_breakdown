import { Request, Response } from "express";
import { userIdParamsSchema } from "../schemas/asset.schema";
import { summaryService } from "../services/summaryService";
import { handleZodError } from "../utils/handleZodError";

export const getSummary = async (req: Request, res: Response) => {
  const paramsCheck = userIdParamsSchema.safeParse(req.params);
  if (!paramsCheck.success) return handleZodError(res, paramsCheck.error, 409);

  const { userId } = paramsCheck.data;

  const summary = await summaryService.getSummary({ userId });
  res.json(summary);
};

export const getOverviewByCurrency = async (req: Request, res: Response) => {
  const paramCheck = userIdParamsSchema.safeParse(req.params);
  if (!paramCheck.success) return handleZodError(res, paramCheck.error, 409);
  const { userId } = paramCheck.data;

  const overview = await summaryService.getOverviewByCurrency({ userId });
  res.json(overview);
};
