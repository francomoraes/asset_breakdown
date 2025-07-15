import { AppDataSource } from "config/data-source";
import { ConflictError, NotFoundError } from "errors/AppError";
import { AssetClass } from "models/AssetClass";
import { AssetType } from "models/AssetType";
import { Repository } from "typeorm";

export class AssetClassService {
  constructor(private assetClassRepo: Repository<AssetClass>) {}

  async createAssetClass({ userId, name }: { userId: string; name: string }) {
    const existingAssetClass = await this.assetClassRepo.findOne({
      where: { name, userId },
    });

    if (existingAssetClass) {
      throw new ConflictError("Asset class already exists");
    }

    const assetClass = this.assetClassRepo.create({
      name,
      userId,
    });

    await this.assetClassRepo.save(assetClass);

    return assetClass;
  }

  async getAssetClasses({ userId }: { userId: string }) {
    const assetClasses = await this.assetClassRepo.find({
      where: { userId },
      order: { name: "ASC" },
    });

    return assetClasses;
  }

  async updateAssetClass({
    id,
    userId,
    name,
  }: {
    id: string;
    userId: string;
    name: string;
  }) {
    const assetClass = await this.assetClassRepo.findOne({
      where: { id: Number(id), userId },
    });

    if (!assetClass) {
      throw new NotFoundError("Asset class not found");
    }

    if (name !== undefined) assetClass.name = name;
    await this.assetClassRepo.save(assetClass);

    return assetClass;
  }

  async deleteAssetClass({ id, userId }: { id: string; userId: string }) {
    const assetClass = await this.assetClassRepo.findOne({
      where: { id: Number(id), userId },
    });

    if (!assetClass) {
      throw new NotFoundError("Asset class not found");
    }

    const assetTypesRepo = AppDataSource.getRepository(AssetType);
    const assetTypes = await assetTypesRepo.find({
      where: { assetClass, userId },
    });

    if (assetTypes.length > 0) {
      throw new ConflictError(
        "Cannot delete asset class with associated asset types",
      );
    }

    await this.assetClassRepo.delete({
      id: Number(id),
      userId,
    });

    return assetClass;
  }
}

export const assetClassService = new AssetClassService(
  AppDataSource.getRepository(AssetClass),
);
