import { Request, Response } from "express";
import { parse } from "fast-csv";
import fs from "fs";

import { Asset } from "../models/asset";
import { AppDataSource } from "../config/data-source";
import { csvAssetSchema } from "../dtos/csv.dto";
import { getAuthenticatedUserId } from "../utils/get-authenticated-user-id";
import { getMarketPriceCents } from "../utils/get-market-price";
import { AssetType } from "models/asset-type";
import { Institution } from "models/institution";

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
  await assetRepository.delete({ userId });

  const assetTypeRepository = AppDataSource.getRepository(AssetType);
  const institutionRepository = AppDataSource.getRepository(Institution);

  const assets: Asset[] = [];
  let totalCurrentValue = 0;
  const rows: any[] = [];
  const stream = fs.createReadStream(file.path);

  const parser = parse({ headers: true, trim: true })
    .on("error", (error) => res.status(400).json({ error }))
    .on("data", (row) => rows.push(row))
    .on("end", async () => {
      try {
        for (const row of rows) {
          const validation = csvAssetSchema.safeParse(row);

          if (!validation.success) {
            return res.status(400).json({
              error: "Erro ao validar linhas do CSV",
              row,
              issues: validation.error.format(),
            });
          }

          const {
            type,
            ticker,
            quantity: quantityStr,
            averagePrice: averagePriceStr,
            institutionName,
            currency,
          } = validation.data;

          const quantity = Number(quantityStr);
          const averagePrice = toCents(
            Number(averagePriceStr.replace(",", ".")),
          );
          const investedValue = Math.round(quantity * averagePrice);

          let currentPriceCents = 0;

          try {
            currentPriceCents = await getMarketPriceCents(ticker);
          } catch (error) {
            throw new Error(
              `Error fetching market price for ${ticker}: ${error}`,
            );
          }

          const currentValue = Math.round(quantity * currentPriceCents);
          const result = currentValue - investedValue;

          const assetType = await assetTypeRepository.findOneBy({ name: type });

          if (!assetType) {
            return res.status(400).json({
              error: `Asset type "${type}" not found`,
            });
          }

          const assetInstitution = await institutionRepository.findOneBy({
            name: institutionName,
          });

          if (!assetInstitution) {
            return res.status(400).json({
              error: `Institution ${institutionName} not found`,
            });
          }

          const assetInfo = {
            userId,
            type: assetType,
            ticker,
            quantity,
            averagePriceCents: averagePrice,
            currentPriceCents,
            investedValueCents: investedValue,
            currentValueCents: currentValue,
            resultCents: result,
            returnPercentage: Number(
              ((result / investedValue) * 100).toFixed(2),
            ),
            institution: assetInstitution,
            currency: currency,
            portfolioPercentage: 0,
          };

          const asset = assetRepository.create(assetInfo);

          assets.push(asset);
          totalCurrentValue += currentValue;
        }

        for (const asset of assets) {
          if (totalCurrentValue === 0) {
            asset.portfolioPercentage = 0;
          } else if (asset.currentValueCents === 0) {
            asset.portfolioPercentage = 0;
          } else {
            asset.portfolioPercentage = Number(
              ((asset.currentValueCents / totalCurrentValue) * 100).toFixed(2),
            );
          }
        }

        await assetRepository.save(assets);

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
