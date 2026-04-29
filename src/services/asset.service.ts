import { AppDataSource } from "../config/data-source";
import { ConflictError, NotFoundError } from "../errors/app-error";
import { Parser } from "json2csv";
import { Asset } from "../models/asset";
import { AssetType } from "../models/asset-type";
import { Repository } from "typeorm";
import { calculateDerivedFields } from "../utils/calculate-derived-fields";
import { getMarketPriceCents } from "../utils/get-market-price";
import { recalculatePortfolio } from "../utils/recalculate-portfolio";
import { Institution } from "models/institution";
import { getMarketPriceCentsBatch } from "utils/get-market-price-batch";
import { ALLOWED_SORT_FIELDS } from "enums/allowedSortFields.enum";
import { PaginatedResponseDto } from "dtos/pagination.dto";
import { FindOptionsOrder } from "typeorm";
import { PriceCache } from "models/price-cache";
import { config } from "config/environment";
import { In } from "typeorm";

type UpdateAssetData = {
  id: number;
  type?: string;
  ticker?: string;
  quantity?: number;
  averagePriceCents?: number;
  institutionId?: number;
  currency?: string;
  manualCurrentPriceCents?: number;
};

export class AssetService {
  constructor(
    private assetRepo: Repository<Asset>,
    private assetTypeRepo: Repository<AssetType>,
    private institutionRepo: Repository<Institution>,
  ) {}

  async getAsset() {
    const assets = await this.assetRepo.find();
    return assets;
  }

  async getAssetsByUser({
    userId,
    currentPage = 1,
    itemsPerPage = 10,
    sortBy = ALLOWED_SORT_FIELDS.TICKER,
    order = "ASC",
    skipPagination = false,
  }: {
    userId: number;
    currentPage?: number;
    itemsPerPage?: number;
    sortBy?: ALLOWED_SORT_FIELDS;
    order?: "ASC" | "DESC";
    skipPagination?: boolean;
  }): Promise<PaginatedResponseDto<Asset>> {
    const allowedSortFields = Object.values(ALLOWED_SORT_FIELDS);
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : ALLOWED_SORT_FIELDS.TICKER;

    const totalItems = await this.assetRepo.count({ where: { userId } });
    const effectiveItemsPerPage = skipPagination ? totalItems : itemsPerPage;
    const totalPages = Math.ceil(totalItems / effectiveItemsPerPage);
    const validPage = Math.min(Math.max(currentPage, 1), totalPages || 1);

    const hasNextPage = validPage < totalPages;
    const hasPreviousPage = validPage > 1;

    const skip = skipPagination ? 0 : (validPage - 1) * effectiveItemsPerPage;
    const take = effectiveItemsPerPage;

    const orderBy: FindOptionsOrder<Asset> =
      safeSortBy === ALLOWED_SORT_FIELDS.INSTITUTION
        ? { institution: { name: order } }
        : safeSortBy === ALLOWED_SORT_FIELDS.TYPE
          ? { type: { name: order } }
          : { [safeSortBy]: order };

    const [assets, _] = await this.assetRepo.findAndCount({
      where: { userId },
      relations: {
        type: {
          assetClass: true,
        },
        institution: true,
      },
      order: orderBy,
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
    const asset = await this.assetRepo.findOneBy({ id });
    if (!asset) {
      throw new NotFoundError(`Asset ${id} not found`, "ASSET_NOT_FOUND");
    }
    return asset;
  }

  async updateAsset(data: UpdateAssetData & { requestUserId: number }) {
    const { requestUserId, ...updateData } = data;

    const existingAsset = await this.assetRepo.findOne({
      where: { id: Number(updateData.id), userId: requestUserId },
    });

    if (!existingAsset) {
      throw new NotFoundError(
        `Asset ${updateData.id} not found`,
        "ASSET_NOT_FOUND",
      );
    }

    let currentPriceCents = existingAsset.currentPriceCents;
    let priceUnavailable = existingAsset.priceUnavailable ?? false;

    const newTicker = updateData.ticker || existingAsset.ticker;
    const tickerChanged =
      updateData.ticker && updateData.ticker !== existingAsset.ticker;

    try {
      currentPriceCents = await getMarketPriceCents(newTicker);
      priceUnavailable = false;
    } catch (error: any) {
      if (tickerChanged) {
        throw new Error(
          `Não foi possível buscar o preço para o novo ticker ${newTicker}: ${error?.message || error}`,
        );
      }
      if (updateData.manualCurrentPriceCents !== undefined) {
        currentPriceCents = updateData.manualCurrentPriceCents;
        // keep priceUnavailable = true: API still can't fetch this ticker
      } else {
        console.warn(
          `Aviso: Não foi possível atualizar o preço de mercado para ${newTicker}. Usando preço existente. Erro: ${error?.message || error}`,
        );
      }
    }

    const {
      ticker,
      quantity,
      averagePriceCents,
      institutionId,
      currency,
      type,
    } = updateData;

    const newQuantity = quantity ?? existingAsset.quantity;
    const newAveragePriceCents =
      averagePriceCents ?? existingAsset.averagePriceCents;

    const {
      investedValueCents,
      currentValueCents,
      resultCents,
      returnPercentage,
    } = calculateDerivedFields(
      newQuantity,
      newAveragePriceCents,
      currentPriceCents,
    );

    const assetTypeRepository = this.assetTypeRepo;
    const assetType = await assetTypeRepository.findOneBy({ name: type });

    if (!assetType) {
      throw new NotFoundError(
        `Asset type ${type} not found`,
        "ASSET_TYPE_NOT_FOUND",
      );
    }

    let institutionEntity = existingAsset.institution;
    if (institutionId !== undefined) {
      const foundInstitution = await this.institutionRepo.findOne({
        where: { id: institutionId, userId: requestUserId },
      });

      if (!foundInstitution) {
        throw new NotFoundError(
          `Institution with id ${institutionId} not found`,
          "INSTITUTION_NOT_FOUND",
        );
      }

      institutionEntity = foundInstitution;
    }

    Object.assign(existingAsset, {
      type: assetType,
      ticker,
      quantity,
      averagePriceCents,
      currentPriceCents,
      investedValueCents,
      currentValueCents,
      resultCents,
      returnPercentage,
      portfolioPercentage: 0,
      institution: institutionEntity,
      currency,
      priceUnavailable,
    });

    await this.assetRepo.save(existingAsset);

    await recalculatePortfolio(requestUserId);

    return existingAsset;
  }

  async deleteAsset({
    id,
    requestUserId,
  }: {
    id: string;
    requestUserId: number;
  }) {
    const existingAsset = await this.assetRepo.findOne({
      where: { id: Number(id), userId: requestUserId },
    });

    if (!existingAsset) {
      throw new NotFoundError(`Asset ${id} not found`, "ASSET_NOT_FOUND");
    }

    await this.assetRepo.delete({
      id: Number(id),
      userId: requestUserId,
    });
    await recalculatePortfolio(requestUserId);

    return existingAsset;
  }

  async createAsset({
    userId,
    ticker,
    quantity,
    averagePriceCents,
    type,
    institutionId,
    currency,
  }: {
    userId: number;
    ticker: string;
    quantity: number;
    averagePriceCents: number;
    type: string;
    institutionId: number;
    currency: string;
  }) {
    const existingAsset = await this.assetRepo.findOne({
      where: {
        ticker,
        userId,
        institution: { id: institutionId },
      },
      relations: ["institution"],
    });

    if (existingAsset) {
      throw new ConflictError(
        `Já existe um ativo ${ticker} cadastrado na instituição ${existingAsset.institution.name}. Para alterar a quantidade ou preço médio, edite o ativo existente.`,
        "ASSET_ALREADY_EXISTS_IN_INSTITUTION",
      );
    }

    let currentPriceCents: number;
    let priceUnavailable = false;

    try {
      currentPriceCents = await getMarketPriceCents(ticker);
    } catch {
      currentPriceCents = averagePriceCents;
      priceUnavailable = true;
    }

    try {
      const {
        investedValueCents,
        currentValueCents,
        resultCents,
        returnPercentage,
      } = calculateDerivedFields(
        quantity,
        averagePriceCents,
        currentPriceCents,
      );

      const assetType = await this.assetTypeRepo.findOneBy({
        name: type,
      });

      if (!assetType) {
        throw new NotFoundError(
          `Tipo de ativo ${type} não encontrado`,
          "ASSET_TYPE_NOT_FOUND",
        );
      }

      const institution = await this.institutionRepo.findOne({
        where: { id: institutionId, userId },
      });

      if (!institution) {
        throw new NotFoundError(
          `Instituição com id ${institutionId} não encontrada`,
          "INSTITUTION_NOT_FOUND",
        );
      }

      const newAsset = this.assetRepo.create({
        userId,
        type: assetType,
        ticker,
        quantity,
        averagePriceCents,
        currentPriceCents,
        investedValueCents,
        currentValueCents,
        resultCents,
        returnPercentage,
        portfolioPercentage: 0,
        institution,
        currency,
        priceUnavailable,
      });

      await this.assetRepo.save(newAsset);

      await recalculatePortfolio(userId);

      return newAsset;
    } catch (error) {
      if (error instanceof ConflictError || error instanceof NotFoundError) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao criar ativo ${ticker}: ${errorMessage}`);
    }
  }

  async exportAssetsToCsv({ userId }: { userId: number }) {
    const result = await this.getAssetsByUser({ userId, skipPagination: true });

    const data = result.data.map((asset) => ({
      ticker: asset.ticker,
      quantity: asset.quantity,
      averagePriceCents: asset.averagePriceCents,
      currentPriceCents: asset.currentPriceCents,
      investedValueCents: asset.investedValueCents,
      currentValueCents: asset.currentValueCents,
      resultCents: asset.resultCents,
      returnPercentage: asset.returnPercentage,
      institution: asset.institution.name,
      currency: asset.currency,
      type: asset.type.name,
      class: asset.type.assetClass.name,
    }));

    const parser = new Parser();
    const csv = parser.parse(data);

    return csv;
  }

  async updateUserAssetsPrices(userId: number) {
    const assets = await this.assetRepo.find({ where: { userId } });

    if (!assets.length) {
      throw new NotFoundError(
        `No assets found for user ${userId}`,
        "NO_ASSETS_FOUND",
      );
    }

    const tickers = assets.map((asset) => asset.ticker);
    const uniqueTickers = [...new Set(tickers)];

    const cacheRepo = AppDataSource.getRepository(PriceCache);
    const cachedPrices = await cacheRepo.findBy({
      ticker: In(uniqueTickers),
    });

    const cacheByTicker = new Map(
      cachedPrices.map((entry) => [entry.ticker, entry]),
    );
    const cacheTtlMs = config.marketPriceTtlHours * 60 * 60 * 1000;
    const now = Date.now();

    const hasFreshCacheForAllTickers = uniqueTickers.every((ticker) => {
      const cached = cacheByTicker.get(ticker);
      if (!cached) return false;

      const ageMs = now - new Date(cached.updatedAt).getTime();
      return ageMs < cacheTtlMs;
    });

    let nextYahooCallAt: string | null = null;
    if (hasFreshCacheForAllTickers) {
      const nextRefreshTimestamp = Math.min(
        ...uniqueTickers
          .map((ticker) => cacheByTicker.get(ticker))
          .filter((entry): entry is PriceCache => Boolean(entry))
          .map((entry) => new Date(entry.updatedAt).getTime() + cacheTtlMs),
      );

      if (Number.isFinite(nextRefreshTimestamp)) {
        nextYahooCallAt = new Date(nextRefreshTimestamp).toISOString();
      }
    }

    const results = await getMarketPriceCentsBatch(tickers);

    const assetsToUpdate: Asset[] = [];
    const failedTickers: string[] = [];

    for (const asset of assets) {
      const currentPriceCents = results.get(asset.ticker);

      if (currentPriceCents === undefined) {
        failedTickers.push(asset.ticker);
        continue;
      }

      const {
        currentValueCents,
        investedValueCents,
        resultCents,
        returnPercentage,
      } = calculateDerivedFields(
        asset.quantity,
        asset.averagePriceCents,
        currentPriceCents,
      );

      asset.currentPriceCents = currentPriceCents;
      asset.currentValueCents = currentValueCents;
      asset.investedValueCents = investedValueCents;
      asset.resultCents = resultCents;
      asset.returnPercentage = returnPercentage;

      assetsToUpdate.push(asset);
    }

    if (assetsToUpdate.length > 0) {
      await this.assetRepo.save(assetsToUpdate);
      await recalculatePortfolio(userId);
    }

    return {
      updated: assetsToUpdate.length,
      failed: failedTickers.length,
      failedTickers,
      usedCacheOnly: hasFreshCacheForAllTickers,
      cooldownHours: config.marketPriceTtlHours,
      nextYahooCallAt,
    };
  }
}

export const assetService = new AssetService(
  AppDataSource.getRepository(Asset),
  AppDataSource.getRepository(AssetType),
  AppDataSource.getRepository(Institution),
);
