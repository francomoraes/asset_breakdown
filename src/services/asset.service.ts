import { AppDataSource } from "../config/data-source";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../errors/app-error";
import { Parser } from "json2csv";
import { Asset } from "../models/asset";
import { AssetType } from "../models/asset-type";
import { Repository } from "typeorm";
import { calculateDerivedFields } from "../utils/calculate-derived-fields";
import { getMarketPriceCents } from "../utils/get-market-price";
import { recalculatePortfolio } from "../utils/recalculate-portfolio";

type UpdateAssetData = {
  id: number;
  type: string;
  ticker: string;
  quantity: number;
  averagePriceCents: number;
  institution?: string;
  currency?: string;
};

export class AssetService {
  constructor(
    private assetRepo: Repository<Asset>,
    private assetTypeRepo: Repository<AssetType>,
  ) {}

  async getAsset() {
    const assets = await this.assetRepo.find();
    return assets;
  }

  async getAssetsByUser({ userId }: { userId: number }) {
    const assets = await this.assetRepo.find({
      where: { userId },
      relations: {
        type: {
          assetClass: true,
        },
      },
      order: {
        id: "ASC",
      },
    });

    return assets;
  }

  async getAssetById(id: number) {
    const asset = await this.assetRepo.findOneBy({ id });
    if (!asset) {
      throw new NotFoundError(`Asset ${id} not found`);
    }
    return asset;
  }

  async updateAsset(data: UpdateAssetData & { requestUserId: number }) {
    const { requestUserId, ...updateData } = data;

    const existingAsset = await this.assetRepo.findOne({
      where: { id: Number(updateData.id), userId: requestUserId },
    });

    if (!existingAsset) {
      throw new NotFoundError(`Asset ${updateData.id} not found`);
    }

    let currentPriceCents = 0;

    try {
      currentPriceCents = await getMarketPriceCents(updateData.ticker);
    } catch (error) {
      throw new Error(
        `Error fetching market price for ${updateData.ticker}: ${error}`,
      );
    }

    const { ticker, quantity, averagePriceCents, institution, currency, type } =
      updateData;

    const {
      investedValueCents,
      currentValueCents,
      resultCents,
      returnPercentage,
    } = calculateDerivedFields(quantity, averagePriceCents, currentPriceCents);

    const assetTypeRepository = this.assetTypeRepo;
    const assetType = await assetTypeRepository.findOneBy({ name: type });

    if (!assetType) {
      throw new NotFoundError(`Asset type ${type} not found`);
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
      institution,
      currency,
    });

    await this.assetRepo.save(existingAsset);

    await recalculatePortfolio();

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
      throw new NotFoundError(`Asset ${id} not found`);
    }

    await this.assetRepo.delete({
      id: Number(id),
      userId: requestUserId,
    });
    await recalculatePortfolio();

    return existingAsset;
  }

  async buyAsset({
    userId,
    ticker,
    newQuantity,
    newPriceCents,
    type,
    institution,
    currency,
  }: {
    userId: number;
    ticker: string;
    newQuantity: number;
    newPriceCents: number;
    type?: string;
    institution?: string;
    currency?: string;
  }) {
    let asset = await this.assetRepo.findOneBy({ ticker });
    const assetTypeRepository = this.assetTypeRepo;

    if (!asset) {
      try {
        const currentPriceCents = await getMarketPriceCents(ticker);

        const {
          investedValueCents,
          currentValueCents,
          resultCents,
          returnPercentage,
        } = calculateDerivedFields(
          newQuantity,
          newPriceCents,
          currentPriceCents,
        );

        const assetType = await assetTypeRepository.findOneBy({
          name: type,
        });

        if (!assetType) {
          throw new NotFoundError(`Asset type ${type} not found`);
        }

        asset = this.assetRepo.create({
          userId,
          type: assetType,
          ticker,
          quantity: newQuantity,
          averagePriceCents: newPriceCents,
          currentPriceCents,
          investedValueCents,
          currentValueCents,
          resultCents,
          returnPercentage,
          portfolioPercentage: 0,
          institution,
          currency,
        });

        await this.assetRepo.save(asset);

        await recalculatePortfolio();

        return asset;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new Error(`Error buying asset ${ticker}: ${errorMessage}`);
      }
    }

    const totalQuantity = +Math.round(+asset.quantity + newQuantity);

    const newAveragePriceCents = Math.round(
      (+asset.quantity * asset.averagePriceCents +
        newQuantity * newPriceCents) /
        totalQuantity,
    );

    asset.quantity = +totalQuantity;
    asset.averagePriceCents = newAveragePriceCents;
    asset.investedValueCents = totalQuantity * newAveragePriceCents;

    let currentPriceCents;

    try {
      currentPriceCents = await getMarketPriceCents(ticker);
      asset.currentPriceCents = currentPriceCents;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Error buying asset ${ticker}: ${errorMessage}`);
    }

    const { currentValueCents, resultCents, returnPercentage } =
      calculateDerivedFields(
        totalQuantity,
        newAveragePriceCents,
        currentPriceCents,
      );

    asset.currentValueCents = currentValueCents;
    asset.resultCents = resultCents;
    asset.returnPercentage = returnPercentage;
    asset.portfolioPercentage = 0;

    await this.assetRepo.save(asset);

    await recalculatePortfolio();
  }

  async sellAsset({
    userId,
    ticker,
    sellQuantity,
  }: {
    userId: number;
    ticker: string;
    sellQuantity: number;
  }) {
    const asset = await this.assetRepo.findOne({ where: { ticker, userId } });

    if (!asset) {
      throw new NotFoundError(`Asset ${ticker} not found`);
    }

    if (sellQuantity > asset.quantity) {
      throw new ConflictError(
        `Cannot sell more than available quantity for ${ticker}`,
      );
    }

    const totalQuantity = Math.round(asset.quantity - sellQuantity);

    if (totalQuantity === 0) {
      await this.assetRepo.remove(asset);
      await recalculatePortfolio();
      return {
        message: "Asset sold and removed from portfolio",
        asset,
      };
    }

    asset.quantity = totalQuantity;
    let currentPriceCents = 0;

    try {
      currentPriceCents = await getMarketPriceCents(ticker);
      asset.currentPriceCents = currentPriceCents;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Error selling asset ${ticker}: ${errorMessage}`);
    }

    const {
      investedValueCents,
      currentValueCents,
      resultCents,
      returnPercentage,
    } = calculateDerivedFields(
      totalQuantity,
      asset.averagePriceCents,
      currentPriceCents,
    );

    asset.investedValueCents = investedValueCents;
    asset.currentValueCents = currentValueCents;
    asset.resultCents = resultCents;
    asset.returnPercentage = returnPercentage;
    asset.portfolioPercentage = 0;

    await this.assetRepo.save(asset);

    await recalculatePortfolio();

    return asset;
  }

  async exportAssetsToCsv({ userId }: { userId: number }) {
    const assets = await this.assetRepo.find({
      where: { userId },
      relations: {
        type: {
          assetClass: true,
        },
      },
      order: { id: "ASC" },
    });

    const data = assets.map((asset) => ({
      ticker: asset.ticker,
      quantity: asset.quantity,
      averagePriceCents: asset.averagePriceCents,
      currentPriceCents: asset.currentPriceCents,
      investedValueCents: asset.investedValueCents,
      currentValueCents: asset.currentValueCents,
      resultCents: asset.resultCents,
      returnPercentage: asset.returnPercentage,
      institution: asset.institution,
      currency: asset.currency,
      type: asset.type.name,
      class: asset.type.assetClass.name,
    }));

    const parser = new Parser();
    const csv = parser.parse(data);

    return csv;
  }
}

export const assetService = new AssetService(
  AppDataSource.getRepository(Asset),
  AppDataSource.getRepository(AssetType),
);
