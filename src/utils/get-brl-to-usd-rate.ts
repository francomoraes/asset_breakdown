import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

export async function getBRLtoUSDRate(): Promise<number> {
  const quote: any = await yahooFinance.quote("USDBRL=X");

  const rate = quote?.regularMarketPrice;

  if (!rate) {
    throw new Error("Cotação USD/BRL não encontrada");
  }

  return 1 / rate;
}
