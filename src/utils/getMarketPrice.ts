import yahooFinance from "yahoo-finance2";
import { formatYahooTicker } from "./formatYahooTicker";

export async function getMarketPriceCents(ticker: string): Promise<number> {
  const formattedTicker = formatYahooTicker(ticker);

  try {
    const quote: any = await yahooFinance.quote(formattedTicker);
    const marketPrice = Array.isArray(quote)
      ? quote[0]?.regularMarketPrice
      : quote?.regularMarketPrice;

    if (marketPrice == null) throw new Error("Cotação não encontrada");

    return Math.round(Number(marketPrice) * 100);
  } catch (error) {
    console.error(`Erro ao buscar cotação para ${formattedTicker}:`, error);
    throw new Error(`Erro ao buscar dados para ${formattedTicker}`);
  }
}
