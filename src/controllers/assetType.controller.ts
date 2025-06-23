import { AppDataSource } from "config/data-source";
import { Request, Response } from "express";
import { AssetType } from "models/AssetType";
import {
  assetTypeIdParamSchema,
  updateAssetTypeSchema,
} from "schemas/assetType.schema";

export const updateAssetType = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const parsedParams = assetTypeIdParamSchema.safeParse(req.params);
  const parseBody = updateAssetTypeSchema.safeParse(req.body);

  if (!parsedParams.success || !parseBody.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { id } = req.params;
  const { name, targetPercentage } = req.body;

  try {
    const repo = AppDataSource.getRepository(AssetType);
    const assetType = await repo.findOne({ where: { id: Number(id) } });

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
  try {
    const repo = AppDataSource.getRepository(AssetType);
    const assetTypes = await repo.find();

    res.json(assetTypes);
  } catch (error) {
    console.error("Error fetching asset types:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
