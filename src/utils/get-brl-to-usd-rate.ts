import YahooFinance from "yahoo-finance2";
import { AppDataSource } from "../config/data-source";
import { config } from "../config/environment";
import { ExchangeRateCache } from "../models/exchange-rate-cache";
import { ensureDataSource } from "./ensure-data-source";
import { logger } from "./logger";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

const USD_BRL_PAIR = "USD_BRL";

function isFresh(updatedAt: Date): boolean {
  const cacheDate = new Date(updatedAt);
  const now = new Date();
  const diffHours = (now.getTime() - cacheDate.getTime()) / (1000 * 60 * 60);
  return diffHours < config.exchangeRateTtlHours;
}

export async function getBRLtoUSDRate(): Promise<number> {
  await ensureDataSource();

  const repo = AppDataSource.getRepository(ExchangeRateCache);
  const cached = await repo.findOneBy({ pair: USD_BRL_PAIR });

  if (cached && isFresh(cached.updatedAt)) {
    logger.info(
      `Taxa BRL/USD em cache (${config.exchangeRateTtlHours}h): ${cached.value}`,
    );
    return cached.value;
  }

  try {
    const quote: any = await yahooFinance.quote("USDBRL=X");

    const rate = quote?.regularMarketPrice;

    if (!rate) {
      throw new Error("Cotação USD/BRL não encontrada");
    }

    const brlToUsd = 1 / rate;

    await repo.save(
      repo.create({
        pair: USD_BRL_PAIR,
        value: brlToUsd,
        updatedAt: new Date(),
      }),
    );

    logger.info(`Taxa BRL/USD atualizada via Yahoo: ${brlToUsd}`);
    return brlToUsd;
  } catch (error: any) {
    const errorMsg = error?.message || String(error);

    if (cached) {
      const hoursAgo = Math.floor(
        (Date.now() - cached.updatedAt.getTime()) / (1000 * 60 * 60),
      );
      logger.warn(
        `Falha ao buscar USD/BRL no Yahoo. Usando cache antigo (${hoursAgo}h): ${errorMsg}`,
      );
      return cached.value;
    }

    throw new Error(`Cotação BRL/USD indisponível: ${errorMsg}`);
  }
}
