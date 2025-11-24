import { AppDataSource } from "../config/data-source";
import { ConflictError, NotFoundError } from "../errors/app-error";
import { Institution } from "../models/institution";
import { Asset } from "../models/asset";
import { Repository } from "typeorm";

export class InstitutionService {
  constructor(private institutionRepo: Repository<Institution>) {}

  async createInstitution({ userId, name }: { userId: number; name: string }) {
    const existingInstitution = await this.institutionRepo.findOne({
      where: { name, userId },
    });

    if (existingInstitution) {
      throw new ConflictError("Institution already exists");
    }

    const institution = this.institutionRepo.create({
      name,
      userId,
    });

    await this.institutionRepo.save(institution);

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
      throw new NotFoundError("Institution not found");
    }
    return institution;
  }

  async updateInstitution({
    id,
    userId,
    name,
  }: {
    id: string;
    userId: number;
    name: string;
  }) {
    const institution = await this.institutionRepo.findOne({
      where: { id: Number(id), userId },
    });

    if (!institution) {
      throw new NotFoundError("Institution not found");
    }

    if (name !== undefined) institution.name = name;
    await this.institutionRepo.save(institution);
    return institution;
  }

  async deleteInstitution({ id, userId }: { id: string; userId: number }) {
    const institution = (await this.institutionRepo.findOne({
      where: { id: Number(id), userId },
    })) as Institution;

    if (!institution) {
      throw new NotFoundError("Institution not found");
    }

    const assetsRepo = AppDataSource.getRepository(Asset);
    const institutionAssets = await assetsRepo.find({
      where: { institution: { id: institution.id }, userId },
    });

    if (institutionAssets.length > 0) {
      throw new ConflictError(
        "Cannot delete institution with associated assets",
      );
    }

    await this.institutionRepo.delete({
      id: Number(id),
      userId,
    });

    return institution;
  }
}

export const institutionService = new InstitutionService(
  AppDataSource.getRepository(Institution),
);
