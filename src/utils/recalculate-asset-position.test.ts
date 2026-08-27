import { describe, it, expect, vi } from "vitest";
import { recalculateAssetPosition } from "./recalculate-asset-position";
import { AssetTransactionType } from "enums/asset-transaction-type.enum";
import { ConflictError } from "errors/app-error";

const ASSET_ID = 1;

function makeTxManager(transactions: any[]) {
  return { find: vi.fn().mockResolvedValue(transactions) } as any;
}

function tx(overrides: Partial<Record<string, unknown>>) {
  return {
    id: 1,
    assetId: ASSET_ID,
    date: "2026-01-01",
    quantity: null,
    unitPriceCents: null,
    feesCents: 0,
    totalAmountCents: 0,
    ...overrides,
  };
}

describe("recalculateAssetPosition", () => {
  it("compra única define quantity e averagePriceCents", async () => {
    const manager = makeTxManager([
      tx({ id: 1, type: AssetTransactionType.BUY, quantity: 10, unitPriceCents: 1000, totalAmountCents: 10000 }),
    ]);

    const result = await recalculateAssetPosition(ASSET_ID, manager);

    expect(result.quantity).toBe(10);
    expect(result.averagePriceCents).toBe(1000);
    expect(result.dividendsCentsAccumulated).toBe(0);
  });

  it("compra->compra->venda parcial recalcula o custo médio ponderado", async () => {
    const manager = makeTxManager([
      tx({ id: 1, date: "2026-01-01", type: AssetTransactionType.BUY, quantity: 10, unitPriceCents: 1000, totalAmountCents: 10000 }),
      tx({ id: 2, date: "2026-02-01", type: AssetTransactionType.BUY, quantity: 10, unitPriceCents: 2000, totalAmountCents: 20000 }),
      tx({ id: 3, date: "2026-03-01", type: AssetTransactionType.SELL, quantity: 5, unitPriceCents: 2500, totalAmountCents: 12500 }),
    ]);

    const result = await recalculateAssetPosition(ASSET_ID, manager);

    expect(result.averagePriceCents).toBe(1500);
    expect(result.quantity).toBe(15);
  });

  it("venda que excede a quantidade disponível lança INSUFFICIENT_QUANTITY_FOR_SALE", async () => {
    const manager = makeTxManager([
      tx({ id: 1, date: "2026-01-01", type: AssetTransactionType.BUY, quantity: 10, unitPriceCents: 1000, totalAmountCents: 10000 }),
      tx({ id: 2, date: "2026-02-01", type: AssetTransactionType.SELL, quantity: 20, unitPriceCents: 1000, totalAmountCents: 20000 }),
    ]);

    await expect(recalculateAssetPosition(ASSET_ID, manager)).rejects.toBeInstanceOf(
      ConflictError,
    );
    await expect(recalculateAssetPosition(ASSET_ID, manager)).rejects.toMatchObject({
      code: "INSUFFICIENT_QUANTITY_FOR_SALE",
    });
  });

  it("provento acumula em dividendsCentsAccumulated sem alterar quantity/averagePriceCents", async () => {
    const manager = makeTxManager([
      tx({ id: 1, date: "2026-01-01", type: AssetTransactionType.BUY, quantity: 10, unitPriceCents: 1000, totalAmountCents: 10000 }),
      tx({ id: 2, date: "2026-02-01", type: AssetTransactionType.DIVIDEND, totalAmountCents: 500 }),
      tx({ id: 3, date: "2026-03-01", type: AssetTransactionType.DIVIDEND, totalAmountCents: 300 }),
    ]);

    const result = await recalculateAssetPosition(ASSET_ID, manager);

    expect(result.quantity).toBe(10);
    expect(result.averagePriceCents).toBe(1000);
    expect(result.dividendsCentsAccumulated).toBe(800);
  });

  it("taxa de compra aumenta o averagePriceCents efetivo", async () => {
    const manager = makeTxManager([
      tx({ id: 1, date: "2026-01-01", type: AssetTransactionType.BUY, quantity: 10, unitPriceCents: 1000, feesCents: 200, totalAmountCents: 10000 }),
    ]);

    const result = await recalculateAssetPosition(ASSET_ID, manager);

    expect(result.averagePriceCents).toBe(1020);
  });

  it("taxa de venda não aparece em nenhum campo calculado", async () => {
    const manager = makeTxManager([
      tx({ id: 1, date: "2026-01-01", type: AssetTransactionType.BUY, quantity: 10, unitPriceCents: 1000, totalAmountCents: 10000 }),
      tx({ id: 2, date: "2026-02-01", type: AssetTransactionType.SELL, quantity: 5, unitPriceCents: 1000, feesCents: 999, totalAmountCents: 5000 }),
    ]);

    const result = await recalculateAssetPosition(ASSET_ID, manager);

    expect(result.averagePriceCents).toBe(1000);
    expect(result.quantity).toBe(5);
  });

  it("posição zerada após venda total mantém averagePriceCents em 0", async () => {
    const manager = makeTxManager([
      tx({ id: 1, date: "2026-01-01", type: AssetTransactionType.BUY, quantity: 10, unitPriceCents: 1000, totalAmountCents: 10000 }),
      tx({ id: 2, date: "2026-02-01", type: AssetTransactionType.SELL, quantity: 10, unitPriceCents: 1200, totalAmountCents: 12000 }),
    ]);

    const result = await recalculateAssetPosition(ASSET_ID, manager);

    expect(result.quantity).toBe(0);
    expect(result.averagePriceCents).toBe(0);
  });
});
