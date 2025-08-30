import { AppDataSource } from "../config/data-source";
import { Asset } from "../models/Asset";
import { Repository } from "typeorm";
import { getBRLtoUSDRate } from "../utils/getBRLtoUSDRate";

export class SummaryService {
  constructor(private assetRepo: Repository<Asset>) {}

  async getSummary({ userId }: { userId: string }) {
    const rawSummary = await this.assetRepo
      .createQueryBuilder("asset")
      .leftJoin("asset.type", "type")
      .leftJoin("type.assetClass", "class")
      .select([
        `class.name AS "assetClassName"`,
        `type.name AS "assetTypeName"`,
        `asset.currency AS "currency"`,
        `SUM(asset.currentValueCents) AS "totalValueCents"`,
        `type.targetPercentage AS "targetPercentage"`,
      ])
      .where("asset.userId = :userId", { userId })
      .groupBy("class.name, type.name, asset.currency, type.targetPercentage")
      .getRawMany();

    const total = rawSummary.reduce(
      (acc, item) => acc + Number(item.totalValueCents),
      0,
    );

    const summary = rawSummary.map((item) => {
      const actualPercentage =
        total > 0
          ? Number((Number(item.totalValueCents) / total).toFixed(4))
          : 0;

      return {
        ...item,
        totalValueCents: Number(item.totalValueCents),
        targetPercentage: Number(item.targetPercentage),
        actualPercentage,
      };
    });

    return summary;
  }

  async getOverviewByCurrency({ userId }: { userId: string }) {
    const rawResult = await this.assetRepo
      .createQueryBuilder("asset")
      .select(`asset.currency`, "currency")
      .addSelect(`SUM(asset.currentValueCents)`, `totalCents`)
      .where("asset.userId = :userId", { userId })
      .groupBy("asset.currency")
      .getRawMany();

    const brlToUsdRate = await getBRLtoUSDRate();

    const converted = rawResult.map((row) => {
      const totalCents = Number(row.totalCents);
      const currency = row.currency;

      const totalInUSD =
        currency === "USD" ? totalCents : Math.round(totalCents * brlToUsdRate);

      return {
        currency,
        totalCents,
        totalInUSD,
      };
    });

    const totalPortfolioInUSD = converted.reduce(
      (acc, row) => acc + row.totalInUSD,
      0,
    );

    const withPercentages = converted.map((row) => ({
      currency: row.currency,
      totalCents: row.totalCents,
      percentage:
        totalPortfolioInUSD > 0
          ? Number((row.totalInUSD / totalPortfolioInUSD).toFixed(4))
          : 0,
      totalInUSD: row.totalInUSD,
    }));

    return withPercentages;
  }
}

export const summaryService = new SummaryService(
  AppDataSource.getRepository(Asset),
);
