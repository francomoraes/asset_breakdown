import { describe, it, expect, vi } from "vitest";

vi.mock("../utils/get-brl-to-usd-rate", () => ({
  getBRLtoUSDRate: vi.fn().mockResolvedValue(0.2),
}));

vi.mock("./fixed-income-asset.service", () => ({
  fixedIncomeAssetService: { refreshValues: vi.fn().mockResolvedValue(undefined) },
}));

import { SummaryService } from "./summary.service";
import { getBRLtoUSDRate } from "../utils/get-brl-to-usd-rate";
import { fixedIncomeAssetService } from "./fixed-income-asset.service";

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
    const fakeAssetTypeRepo = { find: vi.fn().mockResolvedValue([]) };
    return new SummaryService(
      fakeAssetRepo as any,
      fakeFixedIncomeRepo as any,
      fakeTransactionRepo as any,
      fakeAssetTypeRepo as any,
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

describe("SummaryService.getSummary — conversão de câmbio no total/actualPercentage", () => {
  it("converte linha USD para BRL antes de somar total e calcular actualPercentage", async () => {
    // mockReset: true (vitest.config) zera a implementação dos mocks a cada
    // teste — precisa reconfigurar aqui, o default do factory não sobrevive.
    (getBRLtoUSDRate as any).mockResolvedValue(0.2);
    (fixedIncomeAssetService.refreshValues as any).mockResolvedValue(undefined);

    const chainable = (rows: any[]) => ({
      leftJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      addGroupBy: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue(rows),
    });

    const fakeAssetRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(
        chainable([
          {
            assetClassName: "Ações",
            assetTypeName: "RV",
            currency: "BRL",
            totalValueCents: "10000",
            totalResultCents: "0",
            targetPercentage: "0.5",
          },
        ]),
      ),
    };
    const fakeFixedIncomeRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(
        chainable([
          {
            assetClassName: "Renda Fixa",
            assetTypeName: "RF",
            currency: "USD",
            totalValueCents: "1000", // 1000 USD cents * usdToBrlRate(5) = 5000 BRL cents
            totalResultCents: "0",
            targetPercentage: "0.5",
          },
        ]),
      ),
    };
    const fakeTransactionRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(chainable([])),
    };
    const fakeAssetTypeRepo = { find: vi.fn().mockResolvedValue([]) };

    const service = new SummaryService(
      fakeAssetRepo as any,
      fakeFixedIncomeRepo as any,
      fakeTransactionRepo as any,
      fakeAssetTypeRepo as any,
    );

    const result = await service.getSummary({ userId: USER_ID });

    // total correto = 10000 (BRL) + 5000 (USD já convertido) = 15000
    const brlRow = result.data.find((d) => d.currency === "BRL")!;
    const usdRow = result.data.find((d) => d.currency === "USD")!;

    expect(brlRow.actualPercentage).toBeCloseTo(10000 / 15000, 4);
    expect(usdRow.actualPercentage).toBeCloseTo(5000 / 15000, 4);
    // totalValueCents da linha continua no valor bruto/nativo — só o
    // percentual é que precisa da conversão, exibição por linha não muda.
    expect(usdRow.totalValueCents).toBe(1000);
  });
});

describe("SummaryService.getAdherence", () => {
  function makeAdherenceService({
    types,
    assetRows = [],
    fixedIncomeRows = [],
  }: {
    types: any[];
    assetRows?: any[];
    fixedIncomeRows?: any[];
  }) {
    const chainable = (rows: any[]) => ({
      leftJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue(rows),
    });

    const fakeAssetRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(chainable(assetRows)),
    };
    const fakeFixedIncomeRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(chainable(fixedIncomeRows)),
    };
    const fakeTransactionRepo = {};
    const fakeAssetTypeRepo = { find: vi.fn().mockResolvedValue(types) };

    return new SummaryService(
      fakeAssetRepo as any,
      fakeFixedIncomeRepo as any,
      fakeTransactionRepo as any,
      fakeAssetTypeRepo as any,
    );
  }

  it("tipo sem posição atual entra no índice com desvio = target, não some da soma", async () => {
    const types = [
      { id: 1, name: "RV", userId: USER_ID, targetPercentage: 0.5, assetClass: { id: 10, name: "Classe A" } },
      { id: 2, name: "RF", userId: USER_ID, targetPercentage: 0.5, assetClass: { id: 11, name: "Classe B" } },
    ];
    // só o tipo 1 (RV) tem posição — tipo 2 (RF) fica de fora das linhas de
    // alocação, mas ainda assim precisa aparecer no índice com desvio de 50pp.
    const assetRows = [{ userId: USER_ID, typeId: 1, currency: "BRL", cents: "1000" }];

    const service = makeAdherenceService({ types, assetRows });

    const result = await service.getAdherence(USER_ID, 5);

    const rv = result.byType.find((t) => t.assetTypeId === 1)!;
    const rf = result.byType.find((t) => t.assetTypeId === 2)!;

    expect(rv.actualPercentage).toBe(1);
    expect(rv.deviationPp).toBe(50);
    expect(rf.actualPercentage).toBe(0);
    expect(rf.deviationPp).toBe(50);
    expect(result.totalPp).toBe(100);
  });

  it("cliente sem nenhum AssetType cadastrado → totalPp null (não 0)", async () => {
    const service = makeAdherenceService({ types: [] });

    const result = await service.getAdherence(USER_ID, 5);

    expect(result.totalPp).toBeNull();
    expect(result.byType).toEqual([]);
  });
});
