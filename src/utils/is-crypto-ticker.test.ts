import { describe, it, expect } from "vitest";
import { isCryptoTicker } from "./is-crypto-ticker";

describe("isCryptoTicker", () => {
  it("reconhece tickers de crypto conhecidos, case-insensitive", () => {
    expect(isCryptoTicker("BTC")).toBe(true);
    expect(isCryptoTicker("btc")).toBe(true);
    expect(isCryptoTicker("ETH")).toBe(true);
  });

  it("não reconhece tickers de ações/FIIs", () => {
    expect(isCryptoTicker("PETR4")).toBe(false);
    expect(isCryptoTicker("SPY")).toBe(false);
  });

  it("não reconhece ticker desconhecido", () => {
    expect(isCryptoTicker("NOTAREALCOIN")).toBe(false);
  });
});
