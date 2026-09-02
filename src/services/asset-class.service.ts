import { AppDataSource } from "../config/data-source";
import { ConflictError, NotFoundError } from "../errors/app-error";
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

export class AssetClassService {
  constructor(private assetClassRepo: Repository<AssetClass>) {}

  async createAssetClass({
    userId,
    name,
    actorUserId,
    actorEmail,
    actorRole,
  }: { userId: number; name: string } & Actor) {
    const existingAssetClass = await this.assetClassRepo.findOne({
      where: { name, userId },
    });

    if (existingAssetClass) {
      throw new ConflictError(
        "Asset class already exists",
        "ASSET_CLASS_ALREADY_EXISTS",
      );
    }

    const assetClass = this.assetClassRepo.create({
      name,
      userId,
    });

    await this.assetClassRepo.save(assetClass);

    await operationLogService.log({
      clientId: userId,
      actorUserId,
      actorEmail,
      actorRole,
      action: OperationLogAction.ASSET_CLASS_CREATED,
      entityType: "AssetClass",
      entityId: assetClass.id,
      afterValue: { name: assetClass.name },
    });

    return assetClass;
  }

  async getAssetClasses({ userId }: { userId: number }) {
    const assetClasses = await this.assetClassRepo.find({
      where: { userId },
      order: { name: "ASC" },
    });

    return assetClasses;
  }

  async getAssetClassById({ id, userId }: { id: string; userId: number }) {
    const assetClass = await this.assetClassRepo.findOne({
      where: { id: Number(id), userId },
    });
    if (!assetClass) {
      throw new NotFoundError("Asset class not found", "ASSET_CLASS_NOT_FOUND");
    }
    return assetClass;
  }

  async updateAssetClass({
    id,
    userId,
    name,
    actorUserId,
    actorEmail,
    actorRole,
  }: {
    id: string;
    userId: number;
    name: string;
  } & Actor) {
    const assetClass = await this.assetClassRepo.findOne({
      where: { id: Number(id), userId },
    });

    if (!assetClass) {
      throw new NotFoundError("Asset class not found", "ASSET_CLASS_NOT_FOUND");
    }

    const before = { name: assetClass.name };

    if (name !== undefined) assetClass.name = name;
    await this.assetClassRepo.save(assetClass);

    await operationLogService.log({
      clientId: userId,
      actorUserId,
      actorEmail,
      actorRole,
      action: OperationLogAction.ASSET_CLASS_UPDATED,
      entityType: "AssetClass",
      entityId: assetClass.id,
      beforeValue: before,
      afterValue: { name: assetClass.name },
    });

    return assetClass;
  }

  async deleteAssetClass({
    id,
    userId,
    actorUserId,
    actorEmail,
    actorRole,
  }: { id: string; userId: number } & Actor) {
    const assetClass = await this.assetClassRepo.findOne({
      where: { id: Number(id), userId },
    });

    if (!assetClass) {
      throw new NotFoundError("Asset class not found", "ASSET_CLASS_NOT_FOUND");
    }

    const assetTypesRepo = AppDataSource.getRepository(AssetType);
    const assetTypeCount = await assetTypesRepo.count({
      where: { assetClass: { id: Number(id) }, userId },
    });

    if (assetTypeCount > 0) {
      throw new ConflictError(
        "Cannot delete asset class with associated asset types",
        "ASSET_CLASS_HAS_ASSET_TYPES",
      );
    }

    await this.assetClassRepo.delete({
      id: Number(id),
      userId,
    });

    await operationLogService.log({
      clientId: userId,
      actorUserId,
      actorEmail,
      actorRole,
      action: OperationLogAction.ASSET_CLASS_DELETED,
      entityType: "AssetClass",
      entityId: assetClass.id,
      beforeValue: { name: assetClass.name },
    });

    return assetClass;
  }
}

export const assetClassService = new AssetClassService(
  AppDataSource.getRepository(AssetClass),
);
