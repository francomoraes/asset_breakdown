import { ConflictError, NotFoundError } from "errors/AppError";
import { Request, Response } from "express";
import { userIdParamsSchema } from "schemas/asset.schema";
import {
  assetClassCreateSchema,
  assetClassIdParamSchema,
} from "schemas/assetClass.schema";
import { assetClassService } from "services/assetClassService";
import { handleZodError } from "utils/handleZodError";

export const createAssetClass = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const paramsCheck = userIdParamsSchema.safeParse(req.params);
  const bodyCheck = assetClassCreateSchema.safeParse(req.body);

  if (!paramsCheck.success)
    return handleZodError(res, paramsCheck.error, "Invalid user ID");

  if (!bodyCheck.success)
    return handleZodError(res, bodyCheck.error, "Invalid asset class data");

  const { userId } = paramsCheck.data;
  const { name } = bodyCheck.data;

  const assetClass = await assetClassService.createAssetClass({
    userId,
    name,
  });
  res.status(201).json({
    message: "Asset class created successfully",
    assetClass,
  });
};

export const getAssetClasses = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const paramsCheck = userIdParamsSchema.safeParse(req.params);

  if (!paramsCheck.success) {
    return handleZodError(res, paramsCheck.error, "Invalid user ID");
  }

  const { userId } = paramsCheck.data;

  const assetClasses = await assetClassService.getAssetClasses({ userId });

  res.json(assetClasses);
};

export const updateAssetClass = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const parsedParams = assetClassIdParamSchema
    .merge(userIdParamsSchema)
    .safeParse(req.params);
  const parsedBody = assetClassCreateSchema.safeParse(req.body);

  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({
      error: "Invalid parameters or body",
    });
    return;
  }

  const { id, userId } = parsedParams.data;
  const { name } = parsedBody.data;

  const assetClass = await assetClassService.updateAssetClass({
    id,
    userId,
    name,
  });

  res.json({ message: "Asset class updated successfully", assetClass });
};

export const deleteAssetClass = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const parsedParams = assetClassIdParamSchema
    .merge(userIdParamsSchema)
    .safeParse(req.params);

  if (!parsedParams.success) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  const { id, userId } = parsedParams.data;

  const assetClass = await assetClassService.deleteAssetClass({
    id,
    userId,
  });

  res.json({
    message: `Asset class ${assetClass.name} deleted successfully`,
  });
};
