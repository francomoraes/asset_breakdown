// Known cryptocurrency base tickers that require a currency suffix on Yahoo Finance
export const CRYPTO_BASE_TICKERS = new Set([
  "BTC",
  "ETH",
  "SOL",
  "ADA",
  "XRP",
  "DOGE",
  "AVAX",
  "MATIC",
  "DOT",
  "LINK",
  "LTC",
  "BCH",
  "ATOM",
  "UNI",
  "AAVE",
  "BNB",
  "ALGO",
  "NEAR",
  "ICP",
  "FIL",
  "VET",
  "THETA",
  "EOS",
  "TRX",
  "XLM",
  "XMR",
  "NEO",
  "DASH",
  "ZEC",
  "ETC",
  "COMP",
  "MKR",
  "CRV",
  "SNX",
  "YFI",
  "SUSHI",
  "SAND",
  "MANA",
  "GALA",
  "AXS",
  "ENJ",
  "CHZ",
  "BAT",
  "ZRX",
  "OMG",
]);

export function formatYahooTicker(ticker: string, currency?: string): string {
  if (!ticker) throw new Error("Ticker inválido");

  ticker = ticker.toUpperCase();

  // Already has an exchange/currency suffix (e.g., BTC-USD, PETR4.SA)
  if (ticker.includes("-") || ticker.includes(".")) {
    return ticker;
  }

  if (/^[A-Z]{4}\d{1,2}$/.test(ticker)) {
    // ex: PETR4, VALE3, ITUB11 etc.
    return `${ticker}.SA`;
  }

  if (ticker.length === 6 && ticker.endsWith("11")) {
    // ex: ITUB11
    return `${ticker}.SA`;
  }

  // Known crypto tickers: append currency suffix so Yahoo Finance resolves correctly
  if (currency && CRYPTO_BASE_TICKERS.has(ticker)) {
    return `${ticker}-${currency.toUpperCase()}`;
  }

  return ticker;
}
