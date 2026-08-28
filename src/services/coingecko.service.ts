import { AppDataSource } from "../config/data-source";
import { config } from "../config/environment";
import { PriceCache } from "../models/price-cache";
import { ensureDataSource } from "../utils/ensure-data-source";
import { logger } from "../utils/logger";
import { ConcurrencyLimiter } from "../utils/concurrency-limiter";

const limiter = new ConcurrencyLimiter(
  Math.max(1, config.coingeckoMaxConcurrency),
);

// Só os ids já verificados contra a documentação oficial da CoinGecko (decisão
// 5.2 da spec) — estender conforme a allowlist de tickers crescer. Ticker sem
// entrada aqui falha limpo (asset fica priceUnavailable, mesmo comportamento
// já existente pra qualquer preço indisponível).
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDC: "usd-coin",
  USDT: "tether",
  WETH: "weth",
};

const USD = "USD";

function isFresh(updatedAt: Date): boolean {
  const cacheDate = new Date(updatedAt);
  const now = new Date();
  const diffHours = (now.getTime() - cacheDate.getTime()) / (1000 * 60 * 60);
  return diffHours < config.marketPriceTtlHours;
}

async function fetchUsdPricesCents(
  tickers: string[],
): Promise<Map<string, number>> {
  const ids = tickers
    .map((ticker) => COINGECKO_IDS[ticker])
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) return new Map();

  const url = `${config.coingeckoApiUrl}/simple/price?ids=${ids.join(",")}&vs_currencies=usd`;

  const response = await limiter.run(() =>
    fetch(url, {
      headers: config.coingeckoApiKey
        ? { "x-cg-demo-api-key": config.coingeckoApiKey }
        : undefined,
    }),
  );

  if (!response.ok) {
    throw new Error(
      `CoinGecko API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as Record<string, { usd?: number }>;

  const idToTicker = new Map(
    tickers
      .filter((ticker) => COINGECKO_IDS[ticker])
      .map((ticker) => [COINGECKO_IDS[ticker], ticker]),
  );

  const result = new Map<string, number>();
  for (const [id, priceData] of Object.entries(data)) {
    const ticker = idToTicker.get(id);
    if (!ticker || priceData?.usd == null) continue;
    result.set(ticker, Math.round(priceData.usd * 100));
  }

  return result;
}

export class CoinGeckoProvider {
  async getPriceCents(ticker: string): Promise<number> {
    const results = await this.getPricesCents([ticker]);
    const cents = results.get(ticker.toUpperCase());
    if (cents === undefined) {
      throw new Error(`Cotação CoinGecko não encontrada para ${ticker}`);
    }
    return cents;
  }

  async getPricesCents(tickers: string[]): Promise<Map<string, number>> {
    await ensureDataSource();
    const repo = AppDataSource.getRepository(PriceCache);
    const results = new Map<string, number>();
    const tickersToFetch: string[] = [];

    for (const rawTicker of tickers) {
      const ticker = rawTicker.toUpperCase();
      const cached = await repo.findOneBy({ ticker, currency: USD });

      if (cached && isFresh(cached.updatedAt)) {
        results.set(ticker, cached.value);
      } else {
        tickersToFetch.push(ticker);
      }
    }

    if (tickersToFetch.length === 0) {
      return results;
    }

    try {
      const fetched = await fetchUsdPricesCents(tickersToFetch);
      const cacheEntries: PriceCache[] = [];

      for (const [ticker, cents] of fetched) {
        results.set(ticker, cents);
        cacheEntries.push(
          repo.create({ ticker, currency: USD, value: cents, updatedAt: new Date() }),
        );
      }

      if (cacheEntries.length > 0) {
        await repo.save(cacheEntries);
      }
    } catch (error: any) {
      logger.error(
        `Erro ao buscar cotações CoinGecko: ${error?.message || error}`,
      );

      for (const ticker of tickersToFetch) {
        if (results.has(ticker)) continue;
        const cached = await repo.findOneBy({ ticker, currency: USD });
        if (cached) {
          logger.warn(`Usando cache antigo (CoinGecko indisponível) para ${ticker}`);
          results.set(ticker, cached.value);
        }
      }
    }

    return results;
  }
}

export const coinGeckoProvider = new CoinGeckoProvider();
