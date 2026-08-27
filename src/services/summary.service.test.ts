import { describe, it, expect, vi } from "vitest";

vi.mock("../utils/get-brl-to-usd-rate", () => ({
  getBRLtoUSDRate: vi.fn().mockResolvedValue(0.2),
}));

vi.mock("./fixed-income-asset.service", () => ({
  fixedIncomeAssetService: { refreshValues: vi.fn().mockResolvedValue(undefined) },
}));

import { SummaryService } from "./summary.service";

const USER_ID = 1;

describe("SummaryService.getCashFlow", () => {
  function makeService(rawRows: any[]) {
    const fakeAssetRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([]),
      }),
    };
    const fakeFixedIncomeRepo = fakeAssetRepo;
    const fakeTransactionRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        addGroupBy: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue(rawRows),
      }),
    };
    return new SummaryService(
      fakeAssetRepo as any,
      fakeFixedIncomeRepo as any,
      fakeTransactionRepo as any,
    );
  }

  it("soma compras/vendas/proventos numa única moeda sem conversão", async () => {
    const service = makeService([
      { type: "buy", currency: "BRL", total: "10000" },
      { type: "sell", currency: "BRL", total: "3000" },
      { type: "dividend", currency: "BRL", total: "500" },
    ]);

    const result = await service.getCashFlow({ userId: USER_ID, usdToBrlRate: 5 });

    expect(result.netContributionCents).toBe(10000 - 500 - 3000);
    expect(result.unreinvestedDividendsCents).toBe(0);
  });

  it("converte transações em USD para BRL antes de somar (não mistura moedas cruas)", async () => {
    const service = makeService([
      { type: "buy", currency: "BRL", total: "10000" },
      { type: "buy", currency: "USD", total: "1000" }, // 1000 USD cents * 5 = 5000 BRL cents
    ]);

    const result = await service.getCashFlow({ userId: USER_ID, usdToBrlRate: 5 });

    expect(result.netContributionCents).toBe(10000 + 5000);
  });

  it("proventos maiores que compras geram proventos não reinvestidos, sem ficar negativo", async () => {
    const service = makeService([
      { type: "buy", currency: "BRL", total: "1000" },
      { type: "dividend", currency: "BRL", total: "1500" },
    ]);

    const result = await service.getCashFlow({ userId: USER_ID, usdToBrlRate: 5 });

    expect(result.unreinvestedDividendsCents).toBe(500);
    expect(result.netContributionCents).toBe(0);
    expect(result.totalDividendsCents).toBe(1500);
  });
});
