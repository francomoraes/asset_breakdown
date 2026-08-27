import { AppDataSource } from "../config/data-source";
import { Asset } from "../models/asset";
import { FixedIncomeAsset } from "../models/fixed-income-asset";
import { AssetTransaction } from "../models/asset-transaction";
import { Repository } from "typeorm";
import { getBRLtoUSDRate } from "../utils/get-brl-to-usd-rate";
import { fixedIncomeAssetService } from "./fixed-income-asset.service";

export class SummaryService {
  constructor(
    private assetRepo: Repository<Asset>,
    private fixedIncomeRepo: Repository<FixedIncomeAsset>,
    private transactionRepo: Repository<AssetTransaction>,
  ) {}

  async getCashFlow({
    userId,
    usdToBrlRate,
  }: {
    userId: number;
    usdToBrlRate: number;
  }) {
    const totals = await this.transactionRepo
      .createQueryBuilder("t")
      .innerJoin("t.asset", "asset")
      .select("t.type", "type")
      .addSelect("asset.currency", "currency")
      .addSelect("SUM(t.totalAmountCents)", "total")
      .where("t.userId = :userId", { userId })
      .groupBy("t.type")
      .addGroupBy("asset.currency")
      .getRawMany();

    const sumInBRL = (type: string) =>
      totals
        .filter((r) => r.type === type)
        .reduce((acc, r) => {
          const totalCents = Number(r.total);
          const totalBRL =
            r.currency === "USD"
              ? Math.round(totalCents * usdToBrlRate)
              : totalCents;
          return acc + totalBRL;
        }, 0);

    const totalBuys = sumInBRL("buy");
    const totalSells = sumInBRL("sell");
    const totalDividends = sumInBRL("dividend");

    return {
      netContributionCents: Math.max(0, totalBuys - totalSells - totalDividends),
      unreinvestedDividendsCents: Math.max(0, totalDividends - (totalBuys - totalSells)),
      totalDividendsCents: totalDividends,
    };
  }

  async getSummary({ userId }: { userId: number }) {
    await fixedIncomeAssetService.refreshValues(userId);

    // Buscar summary de Assets regulares
    const rawSummary = await this.assetRepo
      .createQueryBuilder("asset")
      .leftJoin("asset.type", "type")
      .leftJoin("type.assetClass", "class")
      .select([
        `class.name AS "assetClassName"`,
        `type.name AS "assetTypeName"`,
        `asset.currency AS "currency"`,
        `SUM(asset.currentValueCents) AS "totalValueCents"`,
        `SUM(asset.resultCents) AS "totalResultCents"`,
        `type.targetPercentage AS "targetPercentage"`,
      ])
      .where("asset.userId = :userId", { userId })
      .groupBy("class.name, type.name, asset.currency, type.targetPercentage")
      .getRawMany();

    // Buscar summary de Fixed Income Assets
    const rawFixedIncomeSummary = await this.fixedIncomeRepo
      .createQueryBuilder("fixedIncome")
      .leftJoin("fixedIncome.type", "type")
      .leftJoin("type.assetClass", "class")
      .select([
        `class.name AS "assetClassName"`,
        `type.name AS "assetTypeName"`,
        `fixedIncome.currency AS "currency"`,
        `SUM(fixedIncome.currentValueCents) AS "totalValueCents"`,
        `SUM(fixedIncome.resultCents) AS "totalResultCents"`,
        `type.targetPercentage AS "targetPercentage"`,
      ])
      .where("fixedIncome.userId = :userId", { userId })
      .groupBy(
        "class.name, type.name, fixedIncome.currency, type.targetPercentage",
      )
      .getRawMany();

    // Combinar ambos os resultados
    const combinedSummary = [...rawSummary, ...rawFixedIncomeSummary];

    // Agrupar por classe/tipo/moeda (caso haja duplicatas)
    const groupedMap = new Map<string, any>();
    for (const item of combinedSummary) {
      const key = `${item.assetClassName}|${item.assetTypeName}|${item.currency}`;
      if (groupedMap.has(key)) {
        const existing = groupedMap.get(key);
        existing.totalValueCents =
          Number(existing.totalValueCents) + Number(item.totalValueCents);
        existing.totalResultCents =
          Number(existing.totalResultCents) + Number(item.totalResultCents);
      } else {
        groupedMap.set(key, { ...item });
      }
    }

    const mergedSummary = Array.from(groupedMap.values());

    const total = mergedSummary.reduce(
      (acc, item) => acc + Number(item.totalValueCents),
      0,
    );

    const summary = mergedSummary.map((item) => {
      const actualPercentage =
        total > 0
          ? Number((Number(item.totalValueCents) / total).toFixed(4))
          : 0;

      return {
        ...item,
        totalValueCents: Number(item.totalValueCents),
        totalResultCents: Number(item.totalResultCents),
        targetPercentage: Number(item.targetPercentage),
        actualPercentage,
      };
    });

    // Buscar taxa de câmbio USD para BRL
    const brlToUsdRate = await getBRLtoUSDRate();
    const usdToBrlRate = 1 / brlToUsdRate;

    const totalPnlCents = summary.reduce((acc, item) => {
      const resultBRL =
        item.currency === "USD"
          ? Math.round(item.totalResultCents * usdToBrlRate)
          : item.totalResultCents;
      return acc + resultBRL;
    }, 0);

    const cashFlow = await this.getCashFlow({ userId, usdToBrlRate });

    return {
      data: summary,
      exchangeRate: {
        usdToBrl: Number(usdToBrlRate.toFixed(4)),
        brlToUsd: Number(brlToUsdRate.toFixed(4)),
      },
      totalPnlCents,
      cashFlow,
    };
  }

  async getOverviewByCurrency({ userId }: { userId: number }) {
    await fixedIncomeAssetService.refreshValues(userId);

    // Buscar assets regulares
    const rawResult = await this.assetRepo
      .createQueryBuilder("asset")
      .select(`asset.currency`, "currency")
      .addSelect(`SUM(asset.currentValueCents)`, `totalCents`)
      .where("asset.userId = :userId", { userId })
      .groupBy("asset.currency")
      .getRawMany();

    // Buscar fixed income assets
    const rawFixedIncomeResult = await this.fixedIncomeRepo
      .createQueryBuilder("fixedIncome")
      .select(`fixedIncome.currency`, "currency")
      .addSelect(`SUM(fixedIncome.currentValueCents)`, `totalCents`)
      .where("fixedIncome.userId = :userId", { userId })
      .groupBy("fixedIncome.currency")
      .getRawMany();

    // Combinar e agrupar por moeda
    const combinedByCurrency = new Map<string, number>();
    [...rawResult, ...rawFixedIncomeResult].forEach((row) => {
      const currency = row.currency;
      const amount = Number(row.totalCents);
      combinedByCurrency.set(
        currency,
        (combinedByCurrency.get(currency) || 0) + amount,
      );
    });

    const mergedResult = Array.from(combinedByCurrency.entries()).map(
      ([currency, totalCents]) => ({ currency, totalCents }),
    );

    const brlToUsdRate = await getBRLtoUSDRate();

    const converted = mergedResult.map((row) => {
      const totalCents = row.totalCents;
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
  AppDataSource.getRepository(FixedIncomeAsset),
  AppDataSource.getRepository(AssetTransaction),
);
