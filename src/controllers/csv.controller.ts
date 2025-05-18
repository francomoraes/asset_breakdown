import { Request, Response } from "express";
import { Asset } from "../models/Asset";
import { parse } from "fast-csv";
import yahooFinance from "yahoo-finance2";
import { AppDataSource } from "../config/data-source";
import fs from "fs";

function toCents(value: number): number {
  return value * 100;
}

export const uploadCsv = async (req: Request, res: Response): Promise<void> => {
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const assetRepository = AppDataSource.getRepository(Asset);
  await assetRepository.clear();

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
          const quantity = row.quantity;
          const averagePrice = toCents(row.averagePrice);
          const investedValue = Math.round(quantity * averagePrice);

          let currentPrice = 0;

          try {
            const quote: any = await yahooFinance.quote(row.ticker);
            const marketPrice = Array.isArray(quote)
              ? quote[0]?.regularMarketPrice
              : quote?.regularMarketPrice;
            currentPrice = toCents(marketPrice);
          } catch (error) {
            console.error(`Error fetching data for ticker ${row.ticker}`);
          }

          const currentValue = Math.round(quantity * currentPrice);
          const result = currentValue - investedValue;

          const asset = assetRepository.create({
            type: row.type,
            ticker: row.ticker,
            quantity,
            averagePriceCents: averagePrice,
            currentPriceCents: currentPrice,
            investedValueCents: investedValue,
            currentValueCents: currentValue,
            resultCents: result,
            returnPercentage: Number(
              ((result / investedValue) * 100).toFixed(2),
            ),
            institution: row.institution,
            currency: row.currency,
            portfolioPercentage: 0,
          });

          assets.push(asset);
          totalCurrentValue += currentValue;
        }

        for (const asset of assets) {
          asset.portfolioPercentage = Number(
            ((asset.currentValueCents / totalCurrentValue) * 100).toFixed(2),
          );
        }

        await assetRepository.save(assets);

        fs.unlinkSync(file.path);
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
