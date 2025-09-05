import { AppDataSource } from "../config/data-source";
import { ConflictError, NotFoundError } from "../errors/app-error";
import { Asset } from "../models/asset";
import { AssetClass } from "../models/asset-class";
import { AssetType } from "../models/asset-type";
import { Repository } from "typeorm";

export class AssetTypeService {
  constructor(
    private assetRepo: Repository<Asset>,
    private assetTypeRepo: Repository<AssetType>,
    private assetClassRepo: Repository<AssetClass>,
  ) {}

  async createAssetType({
    assetClassId,
    name,
    targetPercentage,
    userId,
  }: {
    userId: number;
    name: string;
    assetClassId: number;
    targetPercentage: number;
  }) {
    const existingAssetType = await this.assetTypeRepo.findOne({
      where: { name, userId },
    });

    if (existingAssetType) {
      throw new ConflictError("Asset type already exists");
    }

    const assetClass = await this.assetClassRepo.findOne({
      where: { id: Number(assetClassId), userId },
    });

    if (!assetClass) {
      throw new NotFoundError("Asset class not found");
    }

    const assetType = this.assetTypeRepo.create({
      name: name.trim(),
      targetPercentage,
      assetClass,
      userId,
    });

    await this.assetTypeRepo.save(assetType);

    return assetType;
  }

  async getAssetTypes({ userId }: { userId: number }) {
    const assetTypes = await this.assetTypeRepo.find({
      where: { userId },
      order: { id: "ASC" },
    });

    return assetTypes;
  }

  async getAssetTypeById({ id, userId }: { id: string; userId: number }) {
    const assetType = await this.assetTypeRepo.findOne({
      where: { id: Number(id), userId },
    });

    return assetType;
  }

  async getAssetsByAssetType({ id, userId }: { id: string; userId: number }) {
    const assets = await this.assetRepo.find({
      where: { type: { id: Number(id) }, userId },
    });

    return assets;
  }

  async updateAssetType({
    id,
    name,
    targetPercentage,
    userId,
  }: {
    id: string;
    name: string;
    targetPercentage: number;
    userId: number;
  }) {
    const assetType = await this.assetTypeRepo.findOne({
      where: { id: Number(id), userId },
    });

    if (!assetType) {
      throw new NotFoundError("Asset type not found");
    }

    if (name !== undefined) assetType.name = name;
    if (targetPercentage !== undefined)
      assetType.targetPercentage = Number(targetPercentage);

    await this.assetTypeRepo.save(assetType);

    return assetType;
  }

  async deleteAssetType({ id, userId }: { id: string; userId: number }) {
    const assetType = await this.assetTypeRepo.findOne({
      where: { id: Number(id), userId },
    });

    if (!assetType) {
      throw new NotFoundError("Asset type not found");
    }

    const assets = await this.assetRepo.find({
      where: { type: { id: Number(id) }, userId },
    });

    if (assets.length > 0) {
      throw new ConflictError("Cannot delete asset type with existing assets");
    }

    await this.assetTypeRepo.delete({
      id: Number(id),
      userId,
    });

    return assetType;
  }
}

export const assetTypeService = new AssetTypeService(
  AppDataSource.getRepository(Asset),
  AppDataSource.getRepository(AssetType),
  AppDataSource.getRepository(AssetClass),
);
