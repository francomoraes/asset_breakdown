import yahooFinance from "yahoo-finance2";
import { formatYahooTicker } from "./formatYahooTicker";
import { AppDataSource } from "config/data-source";
import { PriceCache } from "models/PriceCache";
import { ensureDataSource } from "utils/ensureDataSource";
const TTL_HOURS = 24;

function isFresh(updatedAt: Date): boolean {
  const cacheDate = new Date(updatedAt);
  const now = new Date();
  const diffHours = (now.getTime() - cacheDate.getTime()) / (1000 * 60 * 60);
  return diffHours < TTL_HOURS;
}

export async function getMarketPriceCents(ticker: string): Promise<number> {
  await ensureDataSource();

  const formattedTicker = formatYahooTicker(ticker);
  const repo = AppDataSource.getRepository(PriceCache);

  const cached = await repo.findOneBy({ ticker });

  if (cached && isFresh(cached.updatedAt)) {
    console.log(
      `Cotação encontrada no cache para ${formattedTicker}: ${cached.value} cents`,
    );
    return cached.value;
  }

  try {
    const quote: any = await yahooFinance.quote(formattedTicker);
    const marketPrice = Array.isArray(quote)
      ? quote[0]?.regularMarketPrice
      : quote?.regularMarketPrice;

    if (marketPrice == null) throw new Error("Cotação não encontrada");

    const cents = Math.round(Number(marketPrice) * 100);

    await repo.save(
      repo.create({
        ticker,
        value: cents,
        updatedAt: new Date(),
      }),
    );

    console.log(
      `Cotação salva/atualizada para ${formattedTicker}: ${cents} cents`,
    );
    return cents;
  } catch (error) {
    console.error(`Erro ao buscar cotação para ${formattedTicker}:`, error);
    throw new Error(`Erro ao buscar dados para ${formattedTicker}`);
  }
}
