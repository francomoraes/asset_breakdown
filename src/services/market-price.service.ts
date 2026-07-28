import YahooFinance from "yahoo-finance2";
import { formatYahooTicker } from "../utils/format-yahoo-ticker";
import { AppDataSource } from "../config/data-source";
import { config } from "../config/environment";
import { PriceCache } from "../models/price-cache";
import { ensureDataSource } from "../utils/ensure-data-source";
import { logger } from "../utils/logger";
import { runYahooTask } from "../utils/yahoo-concurrency";
import { getBRLtoUSDRate } from "../utils/get-brl-to-usd-rate";
import { isCryptoTicker } from "../utils/is-crypto-ticker";
import { coinGeckoProvider } from "./coingecko.service";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

function isFresh(updatedAt: Date): boolean {
  const cacheDate = new Date(updatedAt);
  const now = new Date();
  const diffHours = (now.getTime() - cacheDate.getTime()) / (1000 * 60 * 60);
  return diffHours < config.marketPriceTtlHours;
}

async function fetchQuoteCents(symbol: string): Promise<number> {
  const quote: any = await runYahooTask(() => yahooFinance.quote(symbol));
  const marketPrice = Array.isArray(quote)
    ? quote[0]?.regularMarketPrice
    : quote?.regularMarketPrice;

  if (marketPrice == null) throw new Error("Cotação não encontrada");
  return Math.round(Number(marketPrice) * 100);
}

function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("Too Many Requests") ||
    errorMsg.includes("HTTPError") ||
    error?.name === "HTTPError" ||
    error?.cause?.code === "ERR_BODY_PARSE_FAILURE"
  );
}

class YahooProvider {
  async getPriceCents(ticker: string, currency?: string): Promise<number> {
    await ensureDataSource();

    const formattedTicker = formatYahooTicker(ticker);
    const repo = AppDataSource.getRepository(PriceCache);
    const cacheCurrency = currency ?? "USD";

    const cached = await repo.findOneBy({ ticker, currency: cacheCurrency });

    if (cached && isFresh(cached.updatedAt)) {
      logger.info(
        `Cotação encontrada no cache para ${formattedTicker}: ${cached.value} cents`,
      );
      return cached.value;
    }

    try {
      const cents = await fetchQuoteCents(formattedTicker);

      await repo.save(
        repo.create({
          ticker,
          currency: cacheCurrency,
          value: cents,
          updatedAt: new Date(),
        }),
      );

      logger.info(
        `Cotação salva/atualizada para ${formattedTicker}: ${cents} cents`,
      );
      return cents;
    } catch (error: any) {
      const errorMsg = error?.message || String(error);

      if (isRateLimitError(error)) {
        if (cached) {
          const hoursAgo = Math.floor(
            (Date.now() - cached.updatedAt.getTime()) / (1000 * 60 * 60),
          );
          logger.info(
            `Rate limit do Yahoo Finance. Usando cotação em cache (${hoursAgo}h atrás) para ${formattedTicker}`,
          );
          return cached.value;
        }
        logger.warn(
          `Rate limit do Yahoo Finance atingido para ${formattedTicker} e sem cache disponível`,
        );
        throw new Error(
          `Cotação temporariamente indisponível devido a rate limiting. Tente novamente em alguns minutos.`,
        );
      }

      const tickerUpper = ticker.toUpperCase();
      if (
        formattedTicker === tickerUpper &&
        !tickerUpper.includes(".") &&
        !tickerUpper.includes("-")
      ) {
        try {
          const lseTicker = `${tickerUpper}.L`;
          const cents = await fetchQuoteCents(lseTicker);

          await repo.save(
            repo.create({
              ticker,
              currency: cacheCurrency,
              value: cents,
              updatedAt: new Date(),
            }),
          );
          logger.info(
            `Cotação encontrada via LSE fallback (${lseTicker}): ${cents} cents`,
          );
          return cents;
        } catch {
          logger.warn(`Fallback LSE também falhou para ${ticker}`);
        }
      }

      logger.error(`Erro ao buscar cotação para ${formattedTicker}:`, errorMsg);
      if (cached) {
        logger.warn(`Usando cache antigo para ${formattedTicker}`);
        return cached.value;
      }

      throw new Error(`Erro ao buscar dados para ${formattedTicker}`);
    }
  }

  async getPricesCentsBatch(
    tickers: string[],
    currencyMap?: Map<string, string>,
  ): Promise<Map<string, number>> {
    await ensureDataSource();

    const repo = AppDataSource.getRepository(PriceCache);
    const results = new Map<string, number>();

    const tickersToFetch: string[] = [];
    const tickerMap = new Map<string, string>();
    const cacheCurrencyByTicker = new Map<string, string>();

    for (const ticker of tickers) {
      const cacheCurrency = currencyMap?.get(ticker) ?? "USD";
      cacheCurrencyByTicker.set(ticker, cacheCurrency);

      const cached = await repo.findOneBy({ ticker, currency: cacheCurrency });

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

      const quotes: any = await runYahooTask(() =>
        yahooFinance.quote(tickersToFetch),
      );

      const quotesArray = Array.isArray(quotes) ? quotes : [quotes];
      const cacheEntries: PriceCache[] = [];

      for (const quote of quotesArray) {
        if (!quote || quote.regularMarketPrice == null) {
          logger.warn(
            `Cotação não encontrada para ${quote?.symbol} (regularMarketPrice=${quote?.regularMarketPrice})`,
          );
          continue;
        }

        const returnedSymbol = quote.symbol ?? "";
        const normalizedSymbol = returnedSymbol.replace(/=X$/i, "").toUpperCase();
        const originalTicker =
          tickerMap.get(returnedSymbol) ?? tickerMap.get(normalizedSymbol);

        if (!originalTicker) {
          logger.warn(
            `Ticker não mapeado: retornado="${returnedSymbol}", normalizado="${normalizedSymbol}"`,
          );
          continue;
        }

        const cents = Math.round(Number(quote.regularMarketPrice) * 100);

        results.set(originalTicker, cents);

        cacheEntries.push(
          repo.create({
            ticker: originalTicker,
            currency: cacheCurrencyByTicker.get(originalTicker) ?? "USD",
            value: cents,
            updatedAt: new Date(),
          }),
        );

        logger.info(
          `Cotação obtida para ${originalTicker} (${returnedSymbol}): ${cents} cents`,
        );
      }

      if (cacheEntries.length > 0) {
        await repo.save(cacheEntries);
        logger.info(`${cacheEntries.length} cotações salvas no cache`);
      }

      const lseFallbacks: Array<{ original: string; lseTicker: string }> = [];
      for (const [formatted, original] of tickerMap) {
        if (results.has(original)) continue;
        const upper = original.toUpperCase();
        if (formatted === upper && !upper.includes(".") && !upper.includes("-")) {
          lseFallbacks.push({ original, lseTicker: `${upper}.L` });
        }
      }

      if (lseFallbacks.length > 0) {
        logger.info(
          `Fallback LSE para tickers sem cotação: ${lseFallbacks.map((f) => f.lseTicker).join(", ")}`,
        );
        try {
          const lseSymbols = lseFallbacks.map((f) => f.lseTicker);
          const lseQuotes: any = await runYahooTask(() =>
            yahooFinance.quote(lseSymbols),
          );
          const lseQuotesArray = Array.isArray(lseQuotes)
            ? lseQuotes
            : [lseQuotes];

          const lseCacheEntries: PriceCache[] = [];
          for (const quote of lseQuotesArray) {
            if (!quote?.regularMarketPrice) continue;
            const returnedSymbol = (quote.symbol ?? "").toUpperCase();
            const fallback = lseFallbacks.find(
              (f) => f.lseTicker === returnedSymbol,
            );
            if (!fallback) continue;

            const cents = Math.round(Number(quote.regularMarketPrice) * 100);
            results.set(fallback.original, cents);
            logger.info(
              `Fallback LSE: ${fallback.original} (${returnedSymbol}): ${cents} cents`,
            );
            lseCacheEntries.push(
              repo.create({
                ticker: fallback.original,
                currency: cacheCurrencyByTicker.get(fallback.original) ?? "USD",
                value: cents,
                updatedAt: new Date(),
              }),
            );
          }
          if (lseCacheEntries.length > 0) {
            await repo.save(lseCacheEntries);
          }
        } catch (lseError: any) {
          logger.warn(`Erro no fallback LSE: ${lseError?.message}`);
        }
      }

      return results;
    } catch (error: any) {
      const errorMsg = error?.message || String(error);

      if (isRateLimitError(error)) {
        logger.info(
          "Rate limit do Yahoo Finance. Usando cotações em cache disponíveis.",
        );

        for (const formattedTicker of tickersToFetch) {
          const originalTicker = tickerMap.get(formattedTicker);
          if (originalTicker && !results.has(originalTicker)) {
            const cached = await repo.findOneBy({
              ticker: originalTicker,
              currency: cacheCurrencyByTicker.get(originalTicker) ?? "USD",
            });
            if (cached) {
              logger.info(`Usando cache para ${originalTicker}`);
              results.set(originalTicker, cached.value);
            }
          }
        }

        return results;
      }

      logger.error(`Erro ao buscar cotações em batch:`, errorMsg);
      throw new Error(`Erro ao buscar dados para ${tickersToFetch.join(", ")}`);
    }
  }
}

const yahooProvider = new YahooProvider();

async function convertUsdCentsToCurrency(
  usdCents: number,
  currency?: string,
): Promise<number> {
  if (!currency || currency === "USD") return usdCents;

  if (currency === "BRL") {
    const brlToUsdRate = await getBRLtoUSDRate();
    const usdToBrlRate = 1 / brlToUsdRate;
    return Math.round(usdCents * usdToBrlRate);
  }

  return usdCents;
}

class MarketPriceService {
  async getPriceCents(ticker: string, currency?: string): Promise<number> {
    if (isCryptoTicker(ticker)) {
      const usdCents = await coinGeckoProvider.getPriceCents(ticker);
      return convertUsdCentsToCurrency(usdCents, currency);
    }

    return yahooProvider.getPriceCents(ticker, currency);
  }

  async getPricesCentsBatch(
    tickers: string[],
    currencyMap?: Map<string, string>,
  ): Promise<Map<string, number>> {
    const cryptoTickers: string[] = [];
    const nonCryptoTickers: string[] = [];

    for (const ticker of tickers) {
      if (isCryptoTicker(ticker)) {
        cryptoTickers.push(ticker);
      } else {
        nonCryptoTickers.push(ticker);
      }
    }

    const results = new Map<string, number>();

    if (nonCryptoTickers.length > 0) {
      const yahooResults = await yahooProvider.getPricesCentsBatch(
        nonCryptoTickers,
        currencyMap,
      );
      for (const [ticker, cents] of yahooResults) {
        results.set(ticker, cents);
      }
    }

    if (cryptoTickers.length > 0) {
      const usdResults = await coinGeckoProvider.getPricesCents(cryptoTickers);
      for (const ticker of cryptoTickers) {
        const usdCents = usdResults.get(ticker.toUpperCase());
        if (usdCents === undefined) continue;
        const finalCents = await convertUsdCentsToCurrency(
          usdCents,
          currencyMap?.get(ticker),
        );
        results.set(ticker, finalCents);
      }
    }

    return results;
  }
}

export const marketPriceService = new MarketPriceService();
