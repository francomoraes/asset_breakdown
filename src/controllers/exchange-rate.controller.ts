import { Request, Response } from "express";
import { getBRLtoUSDRate } from "../utils/get-brl-to-usd-rate";
import { AppDataSource } from "../config/data-source";
import { ExchangeRateCache } from "../models/exchange-rate-cache";

export const getExchangeRate = async (_req: Request, res: Response) => {
  const brlToUsdRate = await getBRLtoUSDRate();
  const usdToBrlRate = 1 / brlToUsdRate;

  const cached = await AppDataSource.getRepository(ExchangeRateCache).findOneBy({
    pair: "USD_BRL",
  });

  res.json({
    usdToBrl: Number(usdToBrlRate.toFixed(4)),
    updatedAt: (cached?.updatedAt ?? new Date()).toISOString(),
  });
};
