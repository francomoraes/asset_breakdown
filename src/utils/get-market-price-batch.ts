import YahooFinance from "yahoo-finance2";
import { formatYahooTicker, CRYPTO_BASE_TICKERS } from "./format-yahoo-ticker";
import { AppDataSource } from "../config/data-source";
import { config } from "../config/environment";
import { PriceCache } from "../models/price-cache";
import { ensureDataSource } from "../utils/ensure-data-source";
import { logger } from "../utils/logger";
import { runYahooTask } from "../utils/yahoo-concurrency";
import { getBRLtoUSDRate } from "../utils/get-brl-to-usd-rate";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

function isFresh(updatedAt: Date): boolean {
  const cacheDate = new Date(updatedAt);
  const now = new Date();
  const diffHours = (now.getTime() - cacheDate.getTime()) / (1000 * 60 * 60);
  return diffHours < config.marketPriceTtlHours;
}

export async function getMarketPriceCentsBatch(
  tickers: string[],
  currencyMap?: Map<string, string>,
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
      const formatted = formatYahooTicker(ticker, currencyMap?.get(ticker));
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

      // Yahoo Finance sometimes appends "=X" to currency/crypto pair symbols in the response
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

    // Fallback: for crypto tickers in non-USD currency that got no price, try fetching
    // in USD and converting. This handles cases where e.g. "BTC-BRL" is not available
    // via the Yahoo Finance API but "BTC-USD" is.
    if (currencyMap) {
      const cryptoFallbacks: Array<{ original: string; usdTicker: string }> =
        [];

      for (const [, original] of tickerMap) {
        if (results.has(original)) continue;
        const currency = currencyMap.get(original);
        if (
          currency &&
          currency !== "USD" &&
          CRYPTO_BASE_TICKERS.has(original.toUpperCase())
        ) {
          cryptoFallbacks.push({
            original,
            usdTicker: `${original.toUpperCase()}-USD`,
          });
        }
      }

      if (cryptoFallbacks.length > 0) {
        logger.info(
          `Fallback USD para crypto sem cotação: ${cryptoFallbacks.map((f) => f.usdTicker).join(", ")}`,
        );
        try {
          const usdSymbols = cryptoFallbacks.map((f) => f.usdTicker);
          const usdQuotes: any = await runYahooTask(() =>
            yahooFinance.quote(usdSymbols),
          );
          const usdQuotesArray = Array.isArray(usdQuotes)
            ? usdQuotes
            : [usdQuotes];

          const brlToUsdRate = await getBRLtoUSDRate();
          const usdToBrlRate = 1 / brlToUsdRate;

          const fallbackCacheEntries: PriceCache[] = [];
          for (const quote of usdQuotesArray) {
            if (!quote?.regularMarketPrice) continue;

            const usdSymbol = (quote.symbol ?? "").toUpperCase();
            const fallback = cryptoFallbacks.find(
              (f) => f.usdTicker === usdSymbol,
            );
            if (!fallback) continue;

            const currency = currencyMap.get(fallback.original) ?? "USD";
            const usdPriceCents = Math.round(
              Number(quote.regularMarketPrice) * 100,
            );
            const finalPriceCents =
              currency === "BRL"
                ? Math.round(usdPriceCents * usdToBrlRate)
                : usdPriceCents;

            results.set(fallback.original, finalPriceCents);
            logger.info(
              `Fallback USD: ${fallback.original} = ${finalPriceCents} cents ${currency} (via ${usdSymbol}, usdToBrl=${usdToBrlRate.toFixed(4)})`,
            );

            fallbackCacheEntries.push(
              repo.create({
                ticker: fallback.original,
                value: finalPriceCents,
                updatedAt: new Date(),
              }),
            );
          }

          if (fallbackCacheEntries.length > 0) {
            await repo.save(fallbackCacheEntries);
          }
        } catch (fallbackError: any) {
          logger.warn(
            `Erro no fallback USD para crypto: ${fallbackError?.message}`,
          );
        }
      }
    }

    return results;
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    const isRateLimitError =
      errorMsg.includes("Too Many Requests") ||
      errorMsg.includes("HTTPError") ||
      error?.name === "HTTPError" ||
      error?.cause?.code === "ERR_BODY_PARSE_FAILURE";

    // Se é erro de rate limiting, retornar valores cacheados disponíveis
    if (isRateLimitError) {
      logger.info(
        "Rate limit do Yahoo Finance. Usando cotações em cache disponíveis.",
      );

      // Para tickers que não foram buscados ainda, tentar pegar do cache antigo
      for (const formattedTicker of tickersToFetch) {
        const originalTicker = tickerMap.get(formattedTicker);
        if (originalTicker && !results.has(originalTicker)) {
          const cached = await repo.findOneBy({ ticker: originalTicker });
          if (cached) {
            logger.info(`Usando cache para ${originalTicker}`);
            results.set(originalTicker, cached.value);
          }
        }
      }

      return results;
    }

    // Para outros erros, logar
    logger.error(`Erro ao buscar cotações em batch:`, errorMsg);
    throw new Error(`Erro ao buscar dados para ${tickersToFetch.join(", ")}`);
  }
}
