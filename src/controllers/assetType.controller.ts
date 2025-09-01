import { Request, Response } from "express";
import { assetTypeService } from "../services/assetTypeService";
import { handleZodError } from "../utils/handleZodError";
import {
  CreateAssetTypeDto,
  DeleteAssetTypeDto,
  UpdateAssetTypeDto,
} from "dtos/assetType.dto";
import { UserIdParamDto } from "dtos/params.dto";

export const createAssetType = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const dtoData = {
    userId: req.params.userId,
    name: req.body.name,
    targetPercentage: req.body.targetPercentage,
    assetClassId: req.body.assetClassId,
  };

  const result = CreateAssetTypeDto.safeParse(dtoData);

  if (!result.success) {
    return handleZodError(res, result.error, 409);
  }

  const { userId, name, targetPercentage, assetClassId } = result.data;

  const assetType = await assetTypeService.createAssetType({
    assetClassId,
    name: name.trim(),
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
  const paramsCheck = UserIdParamDto.safeParse(req.params);

  if (!paramsCheck.success) {
    return handleZodError(res, paramsCheck.error);
  }

  const { userId } = paramsCheck.data;

  const assetTypes = await assetTypeService.getAssetTypes({ userId });

  res.json(assetTypes);
};

export const updateAssetType = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const dtoData = {
    id: req.params.id,
    userId: req.params.userId,
    name: req.body.name,
    targetPercentage: req.body.targetPercentage,
  };

  const result = UpdateAssetTypeDto.safeParse(dtoData);

  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const { id, userId, name, targetPercentage } = result.data;

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
  const dtoData = {
    id: req.params.id,
    userId: req.params.userId,
  };

  const result = DeleteAssetTypeDto.safeParse(dtoData);

  if (!result.success) return handleZodError(res, result.error, 409);

  const { id, userId } = result.data;

  const assetType = await assetTypeService.deleteAssetType({ id, userId });

  res.json({ message: `Asset type ${assetType.name} deleted successfully` });
};
