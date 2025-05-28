import { AppDataSource } from "config/data-source";
import { Request, Response } from "express";
import { Asset } from "models/Asset";

export async function getSummary(req: Request, res: Response) {
  const userId = req.params.userId;

  try {
    const rawSummary = await AppDataSource.getRepository(Asset)
      .createQueryBuilder("asset")
      .leftJoin("asset.type", "type")
      .leftJoin("type.assetClass", "class")
      .select([
        "class.name AS assetClassName",
        "type.name AS assetTypeName",
        "asset.currency AS currency",
        "SUM(asset.currentValueCents) AS totalValueCents",
        "type.targetPercentage AS targetPercentage",
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
          ? Number(((Number(item.totalValueCents) / total) * 100).toFixed(2))
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
}
