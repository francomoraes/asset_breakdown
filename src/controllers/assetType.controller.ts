import { Request, Response } from "express";
import { userIdParamsSchema } from "schemas/asset.schema";
import {
  assetTypeCreateSchema,
  assetTypeIdParamSchema,
  updateAssetTypeSchema,
} from "schemas/assetType.schema";
import { assetTypeService } from "services/assetTypeService";
import { handleZodError } from "utils/handleZodError";

export const createAssetType = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const paramsCheck = userIdParamsSchema.safeParse(req.params);
  const bodyCheck = assetTypeCreateSchema.safeParse(req.body);

  if (!paramsCheck.success)
    return handleZodError(res, paramsCheck.error, "Invalid user ID");

  if (!bodyCheck.success)
    return handleZodError(res, bodyCheck.error, "Invalid asset type data");

  const { userId } = paramsCheck.data;
  const { targetPercentage, assetClassId } = bodyCheck.data;

  const name = bodyCheck.data.name.trim();

  const assetType = await assetTypeService.createAssetType({
    assetClassId,
    name,
    targetPercentage,
    userId,
  });

  res.status(201).json({
    message: "Asset type created successfully",
    assetType,
  });
};

export const getAssetTypes = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const paramsCheck = userIdParamsSchema.safeParse(req.params);
  if (!paramsCheck.success)
    return handleZodError(res, paramsCheck.error, "Invalid user ID");
  const { userId } = paramsCheck.data;

  const assetTypes = await assetTypeService.getAssetTypes({ userId });

  res.json(assetTypes);
};

export const updateAssetType = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const parsedParams = assetTypeIdParamSchema
    .merge(userIdParamsSchema)
    .safeParse(req.params);
  const parsedBody = updateAssetTypeSchema.safeParse(req.body);

  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { id, userId } = parsedParams.data;
  const { name, targetPercentage } = parsedBody.data;

  const assetType = await assetTypeService.updateAssetType({
    id,
    name: name || "",
    targetPercentage: targetPercentage || 0,
    userId,
  });
  res.json({ message: "Asset type updated successfully", assetType });
};

export const deleteAssetType = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const paramsCheck = assetTypeIdParamSchema
    .merge(userIdParamsSchema)
    .safeParse(req.params);

  if (!paramsCheck.success)
    return handleZodError(res, paramsCheck.error, "Invalid asset type ID");

  const { id, userId } = paramsCheck.data;

  const assetType = await assetTypeService.deleteAssetType({ id, userId });

  res.json({ message: `Asset type ${assetType.name} deleted successfully` });
};
