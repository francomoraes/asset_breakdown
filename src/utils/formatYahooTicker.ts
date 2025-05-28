export function formatYahooTicker(ticker: string): string {
  ticker = ticker.toUpperCase();

  if (/^[A-Z]{4}\d{1,2}$/.test(ticker)) {
    // ex: PETR4, VALE3, ITUB11 etc.
    return `${ticker}.SA`;
  }

  if (ticker.length === 6 && ticker.endsWith("11")) {
    // ex: ITUB11
    return `${ticker}.SA`;
  }

  return ticker;
}
