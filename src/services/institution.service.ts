import { AppDataSource } from "../config/data-source";
import { ConflictError, NotFoundError } from "../errors/app-error";
import { Institution } from "../models/institution";
import { Asset } from "../models/asset";
import { Repository } from "typeorm";
import { operationLogService } from "./operation-log.service";
import { OperationLogAction } from "enums/operation-log-action.enum";
import { OperationLogActorRole } from "enums/operation-log-actor-role.enum";

type Actor = {
  actorUserId: number;
  actorEmail: string;
  actorRole: OperationLogActorRole;
};

export class InstitutionService {
  constructor(private institutionRepo: Repository<Institution>) {}

  async createInstitution({
    userId,
    name,
    actorUserId,
    actorEmail,
    actorRole,
  }: { userId: number; name: string } & Actor) {
    const existingInstitution = await this.institutionRepo.findOne({
      where: { name, userId },
    });

    if (existingInstitution) {
      throw new ConflictError(
        "Institution already exists",
        "INSTITUTION_ALREADY_EXISTS",
      );
    }

    const institution = this.institutionRepo.create({
      name,
      userId,
    });

    await this.institutionRepo.save(institution);

    await operationLogService.log({
      clientId: userId,
      actorUserId,
      actorEmail,
      actorRole,
      action: OperationLogAction.INSTITUTION_CREATED,
      entityType: "Institution",
      entityId: institution.id,
      afterValue: { name: institution.name },
    });

    return institution;
  }

  async getInstitutions({ userId }: { userId: number }) {
    const institutions = await this.institutionRepo.find({
      where: { userId },
      order: { name: "ASC" },
    });

    return institutions;
  }

  async getInstitutionById({ id, userId }: { id: string; userId: number }) {
    const institution = await this.institutionRepo.findOne({
      where: { id: Number(id), userId },
    });
    if (!institution) {
      throw new NotFoundError("Institution not found", "INSTITUTION_NOT_FOUND");
    }
    return institution;
  }

  async updateInstitution({
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
    const institution = await this.institutionRepo.findOne({
      where: { id: Number(id), userId },
    });

    if (!institution) {
      throw new NotFoundError("Institution not found", "INSTITUTION_NOT_FOUND");
    }

    const before = { name: institution.name };

    if (name !== undefined) institution.name = name;
    await this.institutionRepo.save(institution);

    await operationLogService.log({
      clientId: userId,
      actorUserId,
      actorEmail,
      actorRole,
      action: OperationLogAction.INSTITUTION_UPDATED,
      entityType: "Institution",
      entityId: institution.id,
      beforeValue: before,
      afterValue: { name: institution.name },
    });

    return institution;
  }

  async deleteInstitution({
    id,
    userId,
    actorUserId,
    actorEmail,
    actorRole,
  }: { id: string; userId: number } & Actor) {
    const institution = (await this.institutionRepo.findOne({
      where: { id: Number(id), userId },
    })) as Institution;

    if (!institution) {
      throw new NotFoundError("Institution not found", "INSTITUTION_NOT_FOUND");
    }

    const assetsRepo = AppDataSource.getRepository(Asset);
    const institutionAssets = await assetsRepo.find({
      where: { institution: { id: institution.id }, userId },
    });

    if (institutionAssets.length > 0) {
      throw new ConflictError(
        "Cannot delete institution with associated assets",
        "INSTITUTION_HAS_ASSETS",
      );
    }

    await this.institutionRepo.delete({
      id: Number(id),
      userId,
    });

    await operationLogService.log({
      clientId: userId,
      actorUserId,
      actorEmail,
      actorRole,
      action: OperationLogAction.INSTITUTION_DELETED,
      entityType: "Institution",
      entityId: institution.id,
      beforeValue: { name: institution.name },
    });

    return institution;
  }
}

export const institutionService = new InstitutionService(
  AppDataSource.getRepository(Institution),
);
