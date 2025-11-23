import { Request, Response } from "express";
import { assetTypeService } from "../services/asset-type.service";
import { handleZodError } from "../utils/handle-zod-error";
import {
  CreateAssetTypeDto,
  DeleteAssetTypeDto,
  UpdateAssetTypeDto,
} from "../dtos/asset-type.dto";

import { getAuthenticatedUserId } from "../utils/get-authenticated-user-id";
import { ConflictError, NotFoundError } from "../errors/app-error";

export const createAssetType = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const dtoData = {
    name: req.body.name,
    targetPercentage: req.body.targetPercentage,
    assetClassId: req.body.assetClassId,
  };

  const result = CreateAssetTypeDto.safeParse(dtoData);

  if (!result.success) {
    return handleZodError(res, result.error, 409);
  }

  const { name, targetPercentage, assetClassId } = result.data;

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
  const userId = getAuthenticatedUserId(req);

  const assetTypes = await assetTypeService.getAssetTypes({ userId });

  res.json(assetTypes);
};

export const getAssetTypeById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const id = req.params.id;
  const assetType = await assetTypeService.getAssetTypeById({ id, userId });

  if (!assetType) {
    throw new NotFoundError("Asset type not found");
  }
  res.json(assetType);
};

export const updateAssetType = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const dtoData = {
    id: req.params.id,
    name: req.body.name,
    targetPercentage: req.body.targetPercentage,
    assetClassId: req.body.assetClassId,
  };

  const result = UpdateAssetTypeDto.safeParse(dtoData);

  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const { id, name, targetPercentage, assetClassId } = result.data;

  const assetType = await assetTypeService.updateAssetType({
    id,
    name: name || "",
    targetPercentage: targetPercentage || 0,
    assetClassId: assetClassId,
    userId,
  });
  res.json({ message: "Asset type updated successfully", assetType });
};

export const deleteAssetType = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const dtoData = {
    id: req.params.id,
  };

  const result = DeleteAssetTypeDto.safeParse(dtoData);

  if (!result.success) return handleZodError(res, result.error, 409);

  const { id } = result.data;

  const assetTypeExists = await assetTypeService.getAssetTypeById({
    id,
    userId,
  });
  if (!assetTypeExists) {
    throw new NotFoundError("Asset type not found");
  }

  const assetTypeHasAssets = await assetTypeService.getAssetsByAssetType({
    id,
    userId,
  });

  if (assetTypeHasAssets.length > 0) {
    throw new ConflictError("Cannot delete asset type with associated assets");
  }

  const assetType = await assetTypeService.deleteAssetType({ id, userId });

  res.json({ message: `Asset type ${assetType.name} deleted successfully` });
};
