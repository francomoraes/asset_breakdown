import YahooFinance from "yahoo-finance2";
import { formatYahooTicker } from "./format-yahoo-ticker";
import { AppDataSource } from "../config/data-source";
import { config } from "../config/environment";
import { PriceCache } from "../models/price-cache";
import { ensureDataSource } from "../utils/ensure-data-source";
import { logger } from "../utils/logger";
import { runYahooTask } from "../utils/yahoo-concurrency";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

async function fetchQuoteCents(symbol: string): Promise<number> {
  const quote: any = await runYahooTask(() => yahooFinance.quote(symbol));
  const marketPrice = Array.isArray(quote)
    ? quote[0]?.regularMarketPrice
    : quote?.regularMarketPrice;

  if (marketPrice == null) throw new Error("Cotação não encontrada");
  return Math.round(Number(marketPrice) * 100);
}

function isFresh(updatedAt: Date): boolean {
  const cacheDate = new Date(updatedAt);
  const now = new Date();
  const diffHours = (now.getTime() - cacheDate.getTime()) / (1000 * 60 * 60);
  return diffHours < config.marketPriceTtlHours;
}

export async function getMarketPriceCents(
  ticker: string,
  currency?: string,
): Promise<number> {
  await ensureDataSource();

  const formattedTicker = formatYahooTicker(ticker, currency);
  const repo = AppDataSource.getRepository(PriceCache);

  const cached = await repo.findOneBy({ ticker });

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
    const isRateLimitError =
      errorMsg.includes("Too Many Requests") ||
      errorMsg.includes("HTTPError") ||
      error?.name === "HTTPError" ||
      error?.cause?.code === "ERR_BODY_PARSE_FAILURE";

    // Se é erro de rate limiting, usar cache silenciosamente
    if (isRateLimitError) {
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

    // Fallback: tentar London Stock Exchange (.L) para tickers sem sufixo de bolsa
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
          repo.create({ ticker, value: cents, updatedAt: new Date() }),
        );
        logger.info(
          `Cotação encontrada via LSE fallback (${lseTicker}): ${cents} cents`,
        );
        return cents;
      } catch {
        logger.warn(`Fallback LSE também falhou para ${ticker}`);
      }
    }

    // Para outros erros, logar e tentar usar cache
    logger.error(`Erro ao buscar cotação para ${formattedTicker}:`, errorMsg);
    if (cached) {
      logger.warn(`Usando cache antigo para ${formattedTicker}`);
      return cached.value;
    }

    throw new Error(`Erro ao buscar dados para ${formattedTicker}`);
  }
}
