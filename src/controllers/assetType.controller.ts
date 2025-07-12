import { AppDataSource } from "config/data-source";
import { Request, Response } from "express";
import { Asset } from "models/Asset";
import { AssetClass } from "models/AssetClass";
import { AssetType } from "models/AssetType";
import { userIdParamsSchema } from "schemas/asset.schema";
import {
  assetTypeCreateSchema,
  assetTypeIdParamSchema,
  updateAssetTypeSchema,
} from "schemas/assetType.schema";
import { handleZodError } from "utils/handleZodError";

export const updateAssetType = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const parsedParams = assetTypeIdParamSchema
    .merge(userIdParamsSchema)
    .safeParse(req.params);
  const parseBody = updateAssetTypeSchema.safeParse(req.body);

  if (!parsedParams.success || !parseBody.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { id, userId } = req.params;
  const { name, targetPercentage } = req.body;

  try {
    const repo = AppDataSource.getRepository(AssetType);
    const assetType = await repo.findOne({ where: { id: Number(id), userId } });

    if (!assetType) {
      res.status(404).json({ error: "Asset type not found" });
      return;
    }

    if (name !== undefined) assetType.name = name;
    if (targetPercentage !== undefined)
      assetType.targetPercentage = Number(targetPercentage);

    await repo.save(assetType);

    res.json({ message: "Asset type updated successfully", assetType });
  } catch (error) {
    console.error("Error updating asset type:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const listAssetTypes = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const paramsCheck = userIdParamsSchema.safeParse(req.params);
  if (!paramsCheck.success)
    return handleZodError(res, paramsCheck.error, "Invalid user ID");
  const { userId } = paramsCheck.data;

  try {
    const repo = AppDataSource.getRepository(AssetType);
    const assetTypes = await repo.find({
      where: { userId },
      order: { id: "ASC" },
    });

    res.json(assetTypes);
  } catch (error) {
    console.error("Error fetching asset types:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

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

  try {
    const repo = AppDataSource.getRepository(AssetType);

    const existingAssetType = await repo.findOne({
      where: { name, userId },
    });

    if (existingAssetType) {
      res.status(409).json({ error: "Asset type already exists" });
      return;
    }

    const assetClassRepo = AppDataSource.getRepository(AssetClass);
    const assetClass = await assetClassRepo.findOne({
      where: { id: Number(assetClassId), userId },
    });

    if (!assetClass) {
      res.status(404).json({ error: "Asset class not found" });
      return;
    }

    const type = repo.create({
      name,
      targetPercentage,
      assetClass,
      userId,
    });

    await repo.save(type);

    res
      .status(201)
      .json({ message: "Asset type created successfully", assetType: type });
  } catch (error) {
    console.error("Error creating asset type:", error);
    res.status(500).json({ error: "Internal server error" });
  }
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

  try {
    const repo = AppDataSource.getRepository(AssetType);
    const assetType = await repo.findOne({ where: { id: Number(id), userId } });

    if (!assetType) {
      res.status(404).json({ error: "Asset type not found" });
      return;
    }

    const assetsRepo = AppDataSource.getRepository(Asset);
    const assets = await assetsRepo.find({
      where: { type: assetType, userId },
    });

    if (assets.length > 0) {
      res.status(400).json({
        error: "Cannot delete asset type with associated assets",
      });
      return;
    }

    await repo.delete({
      id: Number(id),
      userId,
    });

    res.json({ message: `Asset type ${assetType.name} deleted successfully` });
  } catch (error) {
    console.error("Error deleting asset type:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
