import { AppDataSource } from "../config/data-source";
import { ConflictError, NotFoundError } from "../errors/app-error";
import { Asset } from "../models/asset";
import { AssetClass } from "../models/asset-class";
import { AssetType } from "../models/asset-type";
import { Repository } from "typeorm";
import { operationLogService } from "./operation-log.service";
import { OperationLogAction } from "enums/operation-log-action.enum";
import { OperationLogActorRole } from "enums/operation-log-actor-role.enum";

type Actor = {
  actorUserId: number;
  actorEmail: string;
  actorRole: OperationLogActorRole;
};

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
    actorUserId,
    actorEmail,
    actorRole,
  }: {
    userId: number;
    name: string;
    assetClassId: number;
    targetPercentage: number;
  } & Actor) {
    const existingAssetType = await this.assetTypeRepo.findOne({
      where: { name, userId },
    });

    if (existingAssetType) {
      throw new ConflictError(
        "Asset type already exists",
        "ASSET_TYPE_ALREADY_EXISTS",
      );
    }

    const assetClass = await this.assetClassRepo.findOne({
      where: { id: Number(assetClassId), userId },
    });

    if (!assetClass) {
      throw new NotFoundError("Asset class not found", "ASSET_CLASS_NOT_FOUND");
    }

    const assetType = this.assetTypeRepo.create({
      name: name.trim(),
      targetPercentage,
      assetClass,
      userId,
    });

    await this.assetTypeRepo.save(assetType);

    await operationLogService.log({
      clientId: userId,
      actorUserId,
      actorEmail,
      actorRole,
      action: OperationLogAction.ASSET_TYPE_CREATED,
      entityType: "AssetType",
      entityId: assetType.id,
      afterValue: {
        name: assetType.name,
        targetPercentage: Number(assetType.targetPercentage),
        assetClassId: assetClass.id,
      },
    });

    return assetType;
  }

  async getAssetTypes({ userId }: { userId: number }) {
    const assetTypes = await this.assetTypeRepo.find({
      where: { userId },
      order: { name: "ASC" },
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
    assetClassId,
    userId,
    actorUserId,
    actorEmail,
    actorRole,
  }: {
    id: string;
    name?: string;
    targetPercentage?: number;
    assetClassId?: number;
    userId: number;
  } & Actor) {
    const assetType = await this.assetTypeRepo.findOne({
      where: { id: Number(id), userId },
    });

    if (!assetType) {
      throw new NotFoundError("Asset type not found", "ASSET_TYPE_NOT_FOUND");
    }

    const before = {
      name: assetType.name,
      targetPercentage: Number(assetType.targetPercentage),
      assetClassId: assetType.assetClass?.id,
    };

    if (name !== undefined) assetType.name = name;
    if (targetPercentage !== undefined)
      assetType.targetPercentage = Number(targetPercentage);
    if (assetClassId !== undefined) {
      const assetClass = await this.assetClassRepo.findOne({
        where: { id: Number(assetClassId), userId },
      });

      if (!assetClass) {
        throw new NotFoundError(
          "Asset class not found",
          "ASSET_CLASS_NOT_FOUND",
        );
      }

      assetType.assetClass = assetClass;
    }

    await this.assetTypeRepo.save(assetType);

    await operationLogService.log({
      clientId: userId,
      actorUserId,
      actorEmail,
      actorRole,
      action: OperationLogAction.ASSET_TYPE_UPDATED,
      entityType: "AssetType",
      entityId: assetType.id,
      beforeValue: before,
      afterValue: {
        name: assetType.name,
        targetPercentage: Number(assetType.targetPercentage),
        assetClassId: assetType.assetClass?.id,
      },
    });

    return assetType;
  }

  async deleteAssetType({
    id,
    userId,
    actorUserId,
    actorEmail,
    actorRole,
  }: { id: string; userId: number } & Actor) {
    const assetType = await this.assetTypeRepo.findOne({
      where: { id: Number(id), userId },
    });

    if (!assetType) {
      throw new NotFoundError("Asset type not found", "ASSET_TYPE_NOT_FOUND");
    }

    const assets = await this.assetRepo.find({
      where: { type: { id: Number(id) }, userId },
    });

    if (assets.length > 0) {
      throw new ConflictError(
        "Cannot delete asset type with existing assets",
        "ASSET_TYPE_HAS_ASSETS",
      );
    }

    await this.assetTypeRepo.delete({
      id: Number(id),
      userId,
    });

    await operationLogService.log({
      clientId: userId,
      actorUserId,
      actorEmail,
      actorRole,
      action: OperationLogAction.ASSET_TYPE_DELETED,
      entityType: "AssetType",
      entityId: assetType.id,
      beforeValue: { name: assetType.name },
    });

    return assetType;
  }

  async updateTargetPercentage({
    userId,
    assetTypeId,
    targetPercentage,
    actorUserId,
    actorEmail,
    actorRole,
  }: {
    userId: number;
    assetTypeId: number;
    targetPercentage: number;
  } & Actor) {
    const assetType = await this.assetTypeRepo.findOne({
      where: { id: assetTypeId, userId },
    });

    if (!assetType) {
      throw new NotFoundError("Asset type not found", "ASSET_TYPE_NOT_FOUND");
    }

    const before = {
      targetPercentage: Number(assetType.targetPercentage),
      assetTypeName: assetType.name,
    };

    assetType.targetPercentage = targetPercentage;
    await this.assetTypeRepo.save(assetType);

    await operationLogService.log({
      clientId: userId,
      actorUserId,
      actorEmail,
      actorRole,
      action: OperationLogAction.TARGET_PERCENTAGE_CHANGE,
      entityType: "AssetType",
      entityId: assetType.id,
      beforeValue: before,
      afterValue: {
        targetPercentage: Number(assetType.targetPercentage),
        assetTypeName: assetType.name,
      },
    });

    return assetType;
  }
}

export const assetTypeService = new AssetTypeService(
  AppDataSource.getRepository(Asset),
  AppDataSource.getRepository(AssetType),
  AppDataSource.getRepository(AssetClass),
);
