import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./coingecko.service", () => ({
  coinGeckoProvider: {
    getPriceCents: vi.fn(),
    getPricesCents: vi.fn(),
  },
}));

vi.mock("../utils/ensure-data-source", () => ({
  ensureDataSource: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../utils/yahoo-concurrency", () => ({
  runYahooTask: (task: () => Promise<any>) => task(),
}));

vi.mock("../utils/get-brl-to-usd-rate", () => ({
  getBRLtoUSDRate: vi.fn().mockResolvedValue(0.2),
}));

const { quoteMock, fakeRepo } = vi.hoisted(() => ({
  quoteMock: vi.fn(),
  fakeRepo: {
    findOneBy: vi.fn(),
    create: vi.fn((data: any) => data),
    save: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("yahoo-finance2", () => ({
  default: class {
    quote = quoteMock;
  },
}));

vi.mock("../config/data-source", () => ({
  AppDataSource: {
    getRepository: vi.fn(() => fakeRepo),
  },
}));

import { marketPriceService } from "./market-price.service";
import { coinGeckoProvider } from "./coingecko.service";
import { getBRLtoUSDRate } from "../utils/get-brl-to-usd-rate";

describe("MarketPriceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeRepo.findOneBy.mockResolvedValue(null);
    (getBRLtoUSDRate as any).mockResolvedValue(0.2);
  });

  it("roteia ticker crypto para o CoinGeckoProvider", async () => {
    (coinGeckoProvider.getPriceCents as any).mockResolvedValue(500000);

    const cents = await marketPriceService.getPriceCents("BTC", "USD");

    expect(coinGeckoProvider.getPriceCents).toHaveBeenCalledWith("BTC");
    expect(quoteMock).not.toHaveBeenCalled();
    expect(cents).toBe(500000);
  });

  it("roteia ticker não-crypto para o YahooProvider", async () => {
    quoteMock.mockResolvedValue({
      regularMarketPrice: 38.5,
      symbol: "PETR4.SA",
    });

    const cents = await marketPriceService.getPriceCents("PETR4", "BRL");

    expect(coinGeckoProvider.getPriceCents).not.toHaveBeenCalled();
    expect(quoteMock).toHaveBeenCalled();
    expect(cents).toBe(3850);
  });

  it("converte USD para BRL na leitura para tickers crypto (decisão 5.9)", async () => {
    (coinGeckoProvider.getPriceCents as any).mockResolvedValue(100000);

    const cents = await marketPriceService.getPriceCents("BTC", "BRL");

    // usdToBrlRate = 1 / 0.2 = 5 => 100000 * 5 = 500000
    expect(cents).toBe(500000);
  });

  it("cacheia por (ticker, currency) — mesmo ticker em moedas diferentes não colide", async () => {
    fakeRepo.findOneBy.mockImplementation(async ({ ticker, currency }: any) => {
      if (ticker === "AAPL" && currency === "USD") {
        return { value: 19000, updatedAt: new Date() };
      }
      if (ticker === "AAPL" && currency === "BRL") {
        return { value: 95000, updatedAt: new Date() };
      }
      return null;
    });

    const usdCents = await marketPriceService.getPriceCents("AAPL", "USD");
    const brlCents = await marketPriceService.getPriceCents("AAPL", "BRL");

    expect(usdCents).toBe(19000);
    expect(brlCents).toBe(95000);
  });
});
