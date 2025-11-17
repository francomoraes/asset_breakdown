import {
  CreateAssetClassDto,
  DeleteAssetClassDto,
  UpdateAssetClassDto,
} from "../dtos/asset-class.dto";

import { Request, Response } from "express";
import { assetClassService } from "../services/asset-class.service";
import { handleZodError } from "../utils/handle-zod-error";
import { getAuthenticatedUserId } from "../utils/get-authenticated-user-id";

export const createAssetClass = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const result = CreateAssetClassDto.safeParse({
    name: req.body.name,
  });

  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const { name } = result.data;

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
  const userId = getAuthenticatedUserId(req);

  const assetClasses = await assetClassService.getAssetClasses({ userId });

  res.json(assetClasses);
};

export const getAssetClassById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const { id } = req.params;

  const assetClass = await assetClassService.getAssetClassById({
    id,
    userId,
  });

  res.json(assetClass);
};

export const updateAssetClass = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const dtoData = {
    id: req.params.id,
    name: req.body.name,
  };

  const result = UpdateAssetClassDto.safeParse(dtoData);

  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const { id, name } = result.data;

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
  const userId = getAuthenticatedUserId(req);

  const parsedParams = DeleteAssetClassDto.safeParse({
    id: req.params.id,
  });

  if (!parsedParams.success) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  const { id } = parsedParams.data;

  const assetClass = await assetClassService.deleteAssetClass({
    id,
    userId,
  });

  res.json({
    message: `Asset class ${assetClass.name} deleted successfully`,
  });
};
