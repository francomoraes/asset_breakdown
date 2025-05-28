import { AppDataSource } from "config/data-source";
import { Request, Response } from "express";
import { Asset } from "models/Asset";
import { getBRLtoUSDRate } from "utils/getBRLtoUSDRate";

export const getSummary = async (req: Request, res: Response) => {
  const userId = req.params.userId;

  try {
    const rawSummary = await AppDataSource.getRepository(Asset)
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

    res.json(summary);
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export async function getOverviewByCurrency(req: Request, res: Response) {
  const { userId } = req.params;

  try {
    const rawResult = await AppDataSource.getRepository(Asset)
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
        currency === "USD" ? totalCents : totalCents * brlToUsdRate;

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
      percentage: Number((row.totalInUSD / totalPortfolioInUSD).toFixed(4)),
    }));

    res.json(withPercentages);
  } catch (error) {
    console.error("Erro ao calcular overview por moeda:", error);
    res.status(500).json({ error: "Erro ao calcular overview por moeda" });
  }
}
