import { Request, Response } from "express";
import { parse } from "fast-csv";
import fs from "fs";

import { Asset } from "../models/asset";
import { AppDataSource } from "../config/data-source";
import { csvAssetSchema } from "../dtos/csv.dto";
import { getAuthenticatedUserId } from "../utils/get-authenticated-user-id";
import { getMarketPriceCentsBatch } from "../utils/get-market-price-batch";
import { AssetType } from "models/asset-type";
import { Institution } from "models/institution";
import { recalculatePortfolio } from "../utils/recalculate-portfolio";
import { calculateDerivedFields } from "../utils/calculate-derived-fields";

function toCents(value: number): number {
  return Math.round(value * 100);
}

export const uploadCsv = async (req: Request, res: Response): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const file = req.file;

  if (!file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const assetRepository = AppDataSource.getRepository(Asset);
  const assetTypeRepository = AppDataSource.getRepository(AssetType);
  const institutionRepository = AppDataSource.getRepository(Institution);

  const assets: Asset[] = [];
  const rows: any[] = [];
  const stream = fs.createReadStream(file.path);

  const parser = parse({ headers: true, trim: true })
    .on("error", (error) => res.status(400).json({ error }))
    .on("data", (row) => rows.push(row))
    .on("end", async () => {
      try {
        const validatedRows = [];
        for (const row of rows) {
          const validation = csvAssetSchema.safeParse(row);

          if (!validation.success) {
            return res.status(400).json({
              error: "Erro ao validar linhas do CSV",
              row,
              issues: validation.error.format(),
            });
          }

          validatedRows.push(validation.data);
        }

        const allTickers = validatedRows.map((r) => r.ticker);
        const pricesMap = await getMarketPriceCentsBatch(allTickers);

        for (const row of validatedRows) {
          const {
            type,
            ticker,
            quantity: quantityStr,
            averagePrice: averagePriceStr,
            institutionName,
            currency,
          } = row;

          const quantity = Number(quantityStr);
          const averagePriceCents = toCents(
            Number(averagePriceStr.replace(",", ".")),
          );

          const currentPriceCents = pricesMap.get(ticker);

          if (!currentPriceCents) {
            return res.status(400).json({
              error: `Market price not found for ticker ${ticker}`,
            });
          }

          const assetType = await assetTypeRepository.findOne({
            where: { name: type, userId },
          });

          if (!assetType) {
            return res.status(400).json({
              error: `Asset type "${type}" not found for this user`,
            });
          }

          const assetInstitution = await institutionRepository.findOne({
            where: { name: institutionName, userId },
          });

          if (!assetInstitution) {
            return res.status(400).json({
              error: `Institution "${institutionName}" not found for this user`,
            });
          }

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

          let existingAsset = await assetRepository.findOne({
            where: { ticker, userId },
          });

          if (existingAsset) {
            Object.assign(existingAsset, {
              type: assetType,
              quantity,
              averagePriceCents,
              currentPriceCents,
              investedValueCents,
              currentValueCents,
              resultCents,
              returnPercentage,
              institution: assetInstitution,
              currency,
              portfolioPercentage: 0,
            });
            assets.push(existingAsset);
          } else {
            const newAsset = assetRepository.create({
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
              institution: assetInstitution,
              currency,
              portfolioPercentage: 0,
            });
            assets.push(newAsset);
          }
        }

        await assetRepository.save(assets);

        await recalculatePortfolio(userId);

        try {
          fs.unlinkSync(file.path);
        } catch (error) {
          console.error("Error deleting temporary file:", error);
        }

        res
          .status(201)
          .json({ message: "CSV file processed successfully", assets });
      } catch (error) {
        console.error("Error processing CSV file:", error);
        return res.status(500).json({ error: "Internal server error" });
      }
    });

  stream.pipe(parser);
};
