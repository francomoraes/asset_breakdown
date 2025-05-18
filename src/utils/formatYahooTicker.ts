export function formatYahooTicker(ticker: string): string {
  if (/^[A-Z]{4}\d{1,2}$/.test(ticker)) {
    // ex: PETR4, VALE3, ITUB11 etc.
    return `${ticker}.SA`;
  }

  return ticker.toUpperCase();
}
