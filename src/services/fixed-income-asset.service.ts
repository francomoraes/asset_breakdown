import { AppDataSource } from "config/data-source";
import { PaginatedResponseDto } from "dtos/pagination.dto";
import { ALLOWED_SORT_FIELDS_FIXED_INCOME } from "enums/allowedSortFieldsFIxedIncome.enum";
import { NotFoundError } from "errors/app-error";
import { AssetType } from "models/asset-type";
import { FixedIncomeAsset } from "models/fixed-income-asset";
import { Institution } from "models/institution";
import { Repository } from "typeorm";

/**
 * Calcula os campos derivados de um ativo de renda fixa
 * Usa juros compostos: M = C * (1 + i)^t
 */
function calculateFixedIncomeFields(
  investedValueCents: number,
  interestRate: number,
  startDate: Date,
  maturityDate: Date,
): {
  currentValueCents: number;
  resultCents: number;
  returnPercentage: number;
} {
  const now = new Date();
  const calculationDate = now > maturityDate ? maturityDate : now;

  // Calcular dias decorridos desde o início
  const daysElapsed = Math.floor(
    (calculationDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Converter taxa anual para taxa diária (juros compostos)
  const dailyRate = Math.pow(1 + interestRate / 100, 1 / 365) - 1;

  // Calcular valor atual com juros compostos
  const currentValueCents = Math.round(
    investedValueCents * Math.pow(1 + dailyRate, daysElapsed),
  );

  const resultCents = currentValueCents - investedValueCents;
  const returnPercentage =
    investedValueCents > 0
      ? Number(((resultCents / investedValueCents) * 100).toFixed(2))
      : 0;

  return {
    currentValueCents,
    resultCents,
    returnPercentage,
  };
}

export class FixedIncomeAssetService {
  constructor(
    private institutionRepo: Repository<Institution>,
    private fixedIncomeAssetRepo: Repository<FixedIncomeAsset>,
    private assetTypeRepo: Repository<AssetType>,
  ) {}

  async getAsset() {
    const assets = await this.fixedIncomeAssetRepo.find();
    return assets;
  }

  async getAssetsByUser({
    userId,
    currentPage = 1,
    itemsPerPage = 10,
    sortBy = ALLOWED_SORT_FIELDS_FIXED_INCOME.DESCRIPTION,
    order = "ASC",
    skipPagination = false,
  }: {
    userId: number;
    currentPage?: number;
    itemsPerPage?: number;
    sortBy?: ALLOWED_SORT_FIELDS_FIXED_INCOME;
    order?: "ASC" | "DESC";
    skipPagination?: boolean;
  }): Promise<PaginatedResponseDto<FixedIncomeAsset>> {
    const allowedSortFields = Object.values(ALLOWED_SORT_FIELDS_FIXED_INCOME);
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : ALLOWED_SORT_FIELDS_FIXED_INCOME.DESCRIPTION;

    const totalItems = await this.fixedIncomeAssetRepo.count({
      where: { userId },
    });
    const effectiveItemsPerPage = skipPagination ? totalItems : itemsPerPage;
    const totalPages = Math.ceil(totalItems / effectiveItemsPerPage);
    const validPage = Math.min(Math.max(currentPage, 1), totalPages || 1);

    const hasNextPage = validPage < totalPages;
    const hasPreviousPage = validPage > 1;

    const skip = skipPagination ? 0 : (validPage - 1) * effectiveItemsPerPage;
    const take = effectiveItemsPerPage;

    const [assets, _] = await this.fixedIncomeAssetRepo.findAndCount({
      where: { userId },
      relations: {
        type: {
          assetClass: true,
        },
        institution: true,
      },
      order: {
        [safeSortBy]: order,
      },
      skip,
      take,
    });

    return {
      data: assets,
      meta: {
        totalItems,
        currentPage: validPage,
        itemsPerPage: effectiveItemsPerPage,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    };
  }

  async getAssetById(id: number) {
    const asset = await this.fixedIncomeAssetRepo.findOneBy({ id });
    if (!asset) {
      throw new NotFoundError("Fixed income asset not found");
    }

    return asset;
  }

  async createAsset(assetData: {
    userId: number;
    description: string;
    startDate: Date;
    maturityDate: Date;
    interestRate: number;
    investedValueCents: number;
    institutionId: number;
    typeId: number;
    currency: string;
  }) {
    const institution = await this.institutionRepo.findOneBy({
      id: assetData.institutionId,
    });

    if (!institution) {
      throw new NotFoundError("Institution not found");
    }

    const assetType = await this.assetTypeRepo.findOneBy({
      id: assetData.typeId,
    });

    if (!assetType) {
      throw new NotFoundError("Asset type not found");
    }

    const { currentValueCents, resultCents, returnPercentage } =
      calculateFixedIncomeFields(
        assetData.investedValueCents,
        assetData.interestRate,
        assetData.startDate,
        assetData.maturityDate,
      );

    const asset = this.fixedIncomeAssetRepo.create({
      userId: assetData.userId,
      description: assetData.description,
      startDate: assetData.startDate,
      maturityDate: assetData.maturityDate,
      interestRate: assetData.interestRate,
      investedValueCents: assetData.investedValueCents,
      currentValueCents,
      resultCents,
      returnPercentage,
      portfolioPercentage: 0,
      institution,
      type: assetType,
      currency: assetData.currency,
    });

    await this.fixedIncomeAssetRepo.save(asset);
    return asset;
  }

  async updateAsset(assetData: Partial<FixedIncomeAsset> & { userId: number }) {
    const { userId, id, ...updateData } = assetData;

    const asset = await this.fixedIncomeAssetRepo.findOne({
      where: { id, userId },
      relations: {
        institution: true,
        type: true,
      },
    });

    if (!asset) {
      throw new NotFoundError("Fixed income asset not found");
    }

    // Atualizar institution se fornecido
    if (updateData?.institution?.id) {
      const institution = await this.institutionRepo.findOneBy({
        id: updateData?.institution?.id,
      });
      if (!institution) {
        throw new NotFoundError("Institution not found");
      }
      asset.institution = institution;
      delete (updateData as any).institutionId;
    }

    // Atualizar type se fornecido
    if ((updateData as any).typeId) {
      const assetType = await this.assetTypeRepo.findOneBy({
        id: (updateData as any).typeId,
      });
      if (!assetType) {
        throw new NotFoundError("Asset type not found");
      }
      asset.type = assetType;
      delete (updateData as any).typeId;
    }

    // Aplicar outras atualizações
    Object.assign(asset, updateData);

    // Recalcular campos derivados se algum campo relevante foi alterado
    if (
      updateData.investedValueCents !== undefined ||
      updateData.interestRate !== undefined ||
      updateData.startDate !== undefined ||
      updateData.maturityDate !== undefined
    ) {
      const { currentValueCents, resultCents, returnPercentage } =
        calculateFixedIncomeFields(
          asset.investedValueCents,
          asset.interestRate,
          asset.startDate,
          asset.maturityDate,
        );

      asset.currentValueCents = currentValueCents;
      asset.resultCents = resultCents;
      asset.returnPercentage = returnPercentage;
    }

    await this.fixedIncomeAssetRepo.save(asset);
    return asset;
  }

  async deleteAsset({ id, userId }: { id: number; userId: number }) {
    const asset = await this.fixedIncomeAssetRepo.findOne({
      where: { id, userId },
    });

    if (!asset) {
      throw new NotFoundError("Fixed income asset not found");
    }

    await this.fixedIncomeAssetRepo.delete({ id, userId });
    return asset;
  }
}

export const fixedIncomeAssetService = new FixedIncomeAssetService(
  AppDataSource.getRepository(Institution),
  AppDataSource.getRepository(FixedIncomeAsset),
  AppDataSource.getRepository(AssetType),
);
