import {
  Between,
  EntityManager,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from "typeorm";
import { AppDataSource } from "../config/data-source";
import { AssetTransaction } from "../models/asset-transaction";
import { Asset } from "../models/asset";
import { AssetType } from "../models/asset-type";
import { Institution } from "models/institution";
import { AssetTransactionType } from "enums/asset-transaction-type.enum";
import { ALLOWED_SORT_FIELDS_ASSET_TRANSACTION } from "enums/allowed-sort-fields-asset-transaction.enum";
import { NotFoundError } from "../errors/app-error";
import { normalizeDate } from "../utils/normalize-date";
import { calculateDerivedFields } from "../utils/calculate-derived-fields";
import { recalculateAssetPosition } from "../utils/recalculate-asset-position";
import { recalculatePortfolio } from "../utils/recalculate-portfolio";
import { marketPriceService } from "./market-price.service";
import { PaginatedResponseDto } from "dtos/pagination.dto";

type OperationFields =
  | {
      type: "buy" | "sell";
      quantity: number;
      unitPriceCents: number;
      feesCents?: number;
    }
  | { type: "dividend"; totalAmountCents: number };

type IdentificationFields = {
  assetId?: number;
  ticker?: string;
  assetTypeName?: string;
  institutionId?: number;
  currency?: string;
};

type CreateTransactionData = OperationFields &
  IdentificationFields & { userId: number; date: string };

type UpdateTransactionData = OperationFields & {
  userId: number;
  transactionId: number;
  date: string;
};

export class AssetTransactionService {
  constructor(private transactionRepo: Repository<AssetTransaction>) {}

  async createTransaction(data: CreateTransactionData): Promise<AssetTransaction> {
    const { userId, type, date, ...rest } = data;

    const transaction = await this.transactionRepo.manager.transaction(
      async (txManager) => {
        const asset = await this.resolveAsset(txManager, userId, rest);

        const fields = this.buildTransactionFields(type, rest);

        const newTransaction = txManager.create(AssetTransaction, {
          assetId: asset.id!,
          userId,
          type: type as AssetTransactionType,
          date: normalizeDate(date),
          ...fields,
        });
        const saved = await txManager.save(newTransaction);

        await this.applyRecalculation(txManager, asset, userId);

        return saved;
      },
    );

    await recalculatePortfolio(userId);
    return transaction;
  }

  async updateTransaction(data: UpdateTransactionData): Promise<AssetTransaction> {
    const { userId, transactionId, type, date, ...rest } = data;

    const transaction = await this.transactionRepo.manager.transaction(
      async (txManager) => {
        const existing = await txManager.findOne(AssetTransaction, {
          where: { id: transactionId, userId },
        });
        if (!existing) {
          throw new NotFoundError(
            `Transaction ${transactionId} not found`,
            "TRANSACTION_NOT_FOUND",
          );
        }

        const asset = await txManager.findOne(Asset, {
          where: { id: existing.assetId },
        });
        if (!asset) {
          throw new NotFoundError(
            `Asset ${existing.assetId} not found`,
            "ASSET_NOT_FOUND",
          );
        }

        const fields = this.buildTransactionFields(type, rest);

        Object.assign(existing, {
          type: type as AssetTransactionType,
          date: normalizeDate(date),
          ...fields,
        });
        const saved = await txManager.save(existing);

        await this.applyRecalculation(txManager, asset, userId);

        return saved;
      },
    );

    await recalculatePortfolio(userId);
    return transaction;
  }

  async deleteTransaction({
    userId,
    transactionId,
  }: {
    userId: number;
    transactionId: number;
  }): Promise<AssetTransaction> {
    const transaction = await this.transactionRepo.manager.transaction(
      async (txManager) => {
        const existing = await txManager.findOne(AssetTransaction, {
          where: { id: transactionId, userId },
        });
        if (!existing) {
          throw new NotFoundError(
            `Transaction ${transactionId} not found`,
            "TRANSACTION_NOT_FOUND",
          );
        }

        const asset = await txManager.findOne(Asset, {
          where: { id: existing.assetId },
        });
        if (!asset) {
          throw new NotFoundError(
            `Asset ${existing.assetId} not found`,
            "ASSET_NOT_FOUND",
          );
        }

        await txManager.remove(existing);
        await this.applyRecalculation(txManager, asset, userId);

        return existing;
      },
    );

    await recalculatePortfolio(userId);
    return transaction;
  }

  async getTransactions({
    userId,
    assetId,
    type,
    dateFrom,
    dateTo,
    currentPage = 1,
    itemsPerPage = 10,
    sortBy = ALLOWED_SORT_FIELDS_ASSET_TRANSACTION.DATE,
    order = "DESC",
    skipPagination = false,
  }: {
    userId: number;
    assetId?: number;
    type?: AssetTransactionType;
    dateFrom?: string;
    dateTo?: string;
    currentPage?: number;
    itemsPerPage?: number;
    sortBy?: ALLOWED_SORT_FIELDS_ASSET_TRANSACTION;
    order?: "ASC" | "DESC";
    skipPagination?: boolean;
  }): Promise<PaginatedResponseDto<AssetTransaction>> {
    const allowedSortFields = Object.values(ALLOWED_SORT_FIELDS_ASSET_TRANSACTION);
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : ALLOWED_SORT_FIELDS_ASSET_TRANSACTION.DATE;

    const where: FindOptionsWhere<AssetTransaction> = { userId };
    if (assetId !== undefined) where.assetId = assetId;
    if (type !== undefined) where.type = type;

    if (dateFrom && dateTo) {
      where.date = Between(normalizeDate(dateFrom), normalizeDate(dateTo));
    } else if (dateFrom) {
      where.date = MoreThanOrEqual(normalizeDate(dateFrom));
    } else if (dateTo) {
      where.date = LessThanOrEqual(normalizeDate(dateTo));
    }

    const totalItems = await this.transactionRepo.count({ where });
    const effectiveItemsPerPage = skipPagination ? totalItems : itemsPerPage;
    const totalPages = Math.ceil(totalItems / effectiveItemsPerPage);
    const validPage = Math.min(Math.max(currentPage, 1), totalPages || 1);
    const hasNextPage = validPage < totalPages;
    const hasPreviousPage = validPage > 1;
    const skip = skipPagination ? 0 : (validPage - 1) * effectiveItemsPerPage;
    const take = effectiveItemsPerPage;

    const [data] = await this.transactionRepo.findAndCount({
      where,
      order: { [safeSortBy]: order } as any,
      skip,
      take,
    });

    return {
      data,
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

  private async resolveAsset(
    txManager: EntityManager,
    userId: number,
    data: IdentificationFields,
  ): Promise<Asset> {
    if (data.assetId !== undefined) {
      const asset = await txManager.findOne(Asset, {
        where: { id: data.assetId, userId },
      });
      if (!asset) {
        throw new NotFoundError(
          `Asset ${data.assetId} not found`,
          "ASSET_NOT_FOUND",
        );
      }
      return asset;
    }

    const ticker = data.ticker!;
    const assetTypeName = data.assetTypeName!;
    const institutionId = data.institutionId!;
    const currency = data.currency!;

    const existingAsset = await txManager.findOne(Asset, {
      where: { ticker, userId, institution: { id: institutionId } },
      relations: ["institution"],
    });
    if (existingAsset) return existingAsset;

    const assetType = await txManager.findOne(AssetType, {
      where: { name: assetTypeName, userId },
    });
    if (!assetType) {
      throw new NotFoundError(
        `Tipo de ativo ${assetTypeName} não encontrado`,
        "ASSET_TYPE_NOT_FOUND",
      );
    }

    const institution = await txManager.findOne(Institution, {
      where: { id: institutionId, userId },
    });
    if (!institution) {
      throw new NotFoundError(
        `Instituição com id ${institutionId} não encontrada`,
        "INSTITUTION_NOT_FOUND",
      );
    }

    let currentPriceCents = 0;
    let priceUnavailable = false;
    try {
      currentPriceCents = await marketPriceService.getPriceCents(ticker, currency);
    } catch {
      priceUnavailable = true;
    }

    const newAsset = txManager.create(Asset, {
      userId,
      type: assetType,
      ticker,
      quantity: 0,
      averagePriceCents: 0,
      currentPriceCents,
      investedValueCents: 0,
      currentValueCents: 0,
      resultCents: 0,
      returnPercentage: 0,
      dividendsCentsAccumulated: 0,
      portfolioPercentage: 0,
      institution,
      currency,
      priceUnavailable,
    });

    return txManager.save(newAsset);
  }

  private buildTransactionFields(type: string, rest: any) {
    if (type === AssetTransactionType.DIVIDEND) {
      return {
        quantity: null,
        unitPriceCents: null,
        feesCents: 0,
        totalAmountCents: rest.totalAmountCents,
      };
    }

    const totalAmountCents = Math.round(rest.quantity * rest.unitPriceCents);
    return {
      quantity: rest.quantity,
      unitPriceCents: rest.unitPriceCents,
      feesCents: rest.feesCents ?? 0,
      totalAmountCents,
    };
  }

  private async applyRecalculation(
    txManager: EntityManager,
    asset: Asset,
    _userId: number,
  ): Promise<void> {
    const { quantity, averagePriceCents, dividendsCentsAccumulated } =
      await recalculateAssetPosition(asset.id!, txManager);

    const {
      investedValueCents,
      currentValueCents,
      resultCents,
      returnPercentage,
    } = calculateDerivedFields(
      quantity,
      averagePriceCents,
      asset.currentPriceCents,
      dividendsCentsAccumulated,
    );

    await txManager.update(
      Asset,
      { id: asset.id },
      {
        quantity,
        averagePriceCents,
        dividendsCentsAccumulated,
        investedValueCents,
        currentValueCents,
        resultCents,
        returnPercentage,
      },
    );
  }
}

export const assetTransactionService = new AssetTransactionService(
  AppDataSource.getRepository(AssetTransaction),
);
