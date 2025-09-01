import { AppDataSource } from "../config/data-source";
import { ConflictError, NotFoundError } from "../errors/AppError";
import { Parser } from "json2csv";
import { Asset } from "../models/Asset";
import { AssetType } from "../models/AssetType";
import { Repository } from "typeorm";
import { calculateDerivedFields } from "../utils/calculateDerivedFields";
import { getMarketPriceCents } from "../utils/getMarketPrice";
import { recalculatePortfolio } from "../utils/recalculatePortfolio";

export class AssetService {
  constructor(
    private assetRepo: Repository<Asset>,
    private assetTypeRepo: Repository<AssetType>,
  ) {}

  async getAsset() {
    const assets = await this.assetRepo.find();
    return assets;
  }

  async getAssetsByUser({ userId }: { userId: string }) {
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

  async updateAsset({
    id,
    type,
    ticker,
    quantity,
    averagePriceCents,
    institution,
    currency,
  }: {
    id: number;
    type: string;
    ticker: string;
    quantity: number;
    averagePriceCents: number;
    institution?: string;
    currency?: string;
  }) {
    const asset = await this.assetRepo.findOneBy({ id: Number(id) });

    if (!asset) {
      throw new NotFoundError(`Asset ${ticker} not found`);
    }

    let currentPriceCents = 0;

    try {
      currentPriceCents = await getMarketPriceCents(ticker);
    } catch (error) {
      throw new Error(`Error fetching market price for ${ticker}: ${error}`);
    }

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

    Object.assign(asset, {
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

    await this.assetRepo.save(asset);

    await recalculatePortfolio();

    return asset;
  }

  async deleteAsset({ id, userId }: { id: string; userId: string }) {
    const asset = await this.assetRepo.findOne({
      where: { id: Number(id), userId },
    });

    if (!asset) {
      throw new NotFoundError(`Asset not found`);
    }

    await this.assetRepo.delete({
      id: Number(id),
      userId,
    });
    await recalculatePortfolio();

    return asset;
  }

  async buyAsset({
    ticker,
    newQuantity,
    newPriceCents,
    type,
    institution,
    currency,
  }: {
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
    ticker,
    sellQuantity,
  }: {
    ticker: string;
    sellQuantity: number;
  }) {
    const asset = await this.assetRepo.findOneBy({ ticker });

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

  async exportAssetsToCsv({ userId }: { userId: string }) {
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
