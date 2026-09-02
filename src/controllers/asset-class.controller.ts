import {
  CreateAssetClassDto,
  DeleteAssetClassDto,
  UpdateAssetClassDto,
} from "../dtos/asset-class.dto";

import { Request, Response } from "express";
import { assetClassService } from "../services/asset-class.service";
import { handleZodError } from "../utils/handle-zod-error";
import { getEffectiveUserId } from "../utils/get-effective-user-id";
import { getAuthenticatedUserId } from "../utils/get-authenticated-user-id";

export const createAssetClass = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getEffectiveUserId(req);
  const actorUserId = getAuthenticatedUserId(req);
  const actorEmail = req.user!.email;
  const actorRole = req.user!.role;

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
    actorUserId,
    actorEmail,
    actorRole,
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
  const userId = getEffectiveUserId(req);

  const assetClasses = await assetClassService.getAssetClasses({ userId });

  res.json(assetClasses);
};

export const getAssetClassById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getEffectiveUserId(req);
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
  const userId = getEffectiveUserId(req);
  const actorUserId = getAuthenticatedUserId(req);
  const actorEmail = req.user!.email;
  const actorRole = req.user!.role;

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
    actorUserId,
    actorEmail,
    actorRole,
  });

  res.json({ message: "Asset class updated successfully", assetClass });
};

export const deleteAssetClass = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getEffectiveUserId(req);
  const actorUserId = getAuthenticatedUserId(req);
  const actorEmail = req.user!.email;
  const actorRole = req.user!.role;

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
    actorUserId,
    actorEmail,
    actorRole,
  });

  res.json({
    message: `Asset class ${assetClass.name} deleted successfully`,
  });
};
