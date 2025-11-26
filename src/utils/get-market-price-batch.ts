import yahooFinance from "yahoo-finance2";
import { formatYahooTicker } from "./format-yahoo-ticker";
import { AppDataSource } from "../config/data-source";
import { PriceCache } from "../models/price-cache";
import { ensureDataSource } from "../utils/ensure-data-source";
import { logger } from "../utils/logger";

const TTL_HOURS = 24;

function isFresh(updatedAt: Date): boolean {
  const cacheDate = new Date(updatedAt);
  const now = new Date();
  const diffHours = (now.getTime() - cacheDate.getTime()) / (1000 * 60 * 60);
  return diffHours < TTL_HOURS;
}

export async function getMarketPriceCentsBatch(
  tickers: string[],
): Promise<Map<string, number>> {
  await ensureDataSource();

  const repo = AppDataSource.getRepository(PriceCache);
  const results = new Map<string, number>();

  const tickersToFetch: string[] = [];
  const tickerMap = new Map<string, string>();

  for (const ticker of tickers) {
    const cached = await repo.findOneBy({ ticker });

    if (cached && isFresh(cached.updatedAt)) {
      logger.info(
        `Cotação encontrada no cache para ${ticker}: ${cached.value} cents`,
      );
      results.set(ticker, cached.value);
    } else {
      const formatted = formatYahooTicker(ticker);
      tickersToFetch.push(formatted);
      tickerMap.set(formatted, ticker);
    }
  }

  if (tickersToFetch.length === 0) {
    logger.info("Todos os preços encontrados no cache");
    return results;
  }

  try {
    logger.info(`Buscando cotações para: ${tickersToFetch.join(", ")}`);

    const quotes: any = await yahooFinance.quote(tickersToFetch);

    const quotesArray = Array.isArray(quotes) ? quotes : [quotes];

    const cacheEntries: PriceCache[] = [];

    for (const quote of quotesArray) {
      if (!quote || quote.regularMarketPrice == null) {
        logger.warn(`Cotação não encontrada para ${quote?.symbol}`);
        continue;
      }

      const formattedTicker = quote.symbol;
      const originalTicker = tickerMap.get(formattedTicker);

      if (!originalTicker) {
        logger.warn(`Ticker não mapeado: ${formattedTicker}`);
        continue;
      }

      const cents = Math.round(Number(quote.regularMarketPrice) * 100);

      results.set(originalTicker, cents);

      cacheEntries.push(
        repo.create({
          ticker: originalTicker,
          value: cents,
          updatedAt: new Date(),
        }),
      );

      logger.info(
        `Cotação obtida para ${originalTicker} (${formattedTicker}): ${cents} cents`,
      );
    }

    if (cacheEntries.length > 0) {
      await repo.save(cacheEntries);
      logger.info(`${cacheEntries.length} cotações salvas no cache`);
    }

    return results;
  } catch (error) {
    logger.error(`Erro ao buscar cotações em batch:`, error);
    throw new Error(`Erro ao buscar dados para ${tickersToFetch.join(", ")}`);
  }
}
