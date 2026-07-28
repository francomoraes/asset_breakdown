import { CRYPTO_BASE_TICKERS } from "./format-yahoo-ticker";

export function isCryptoTicker(ticker: string): boolean {
  return CRYPTO_BASE_TICKERS.has(ticker.toUpperCase());
}
