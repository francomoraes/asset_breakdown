import { describe, it, expect } from "vitest";
import { CreateAssetTransactionDto } from "./asset-transaction.dto";

const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);
const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

describe("CreateAssetTransactionDto", () => {
  it("aceita assetId sozinho", () => {
    const result = CreateAssetTransactionDto.safeParse({
      assetId: 1,
      type: "buy",
      date: YESTERDAY,
      quantity: 10,
      unitPriceCents: 1000,
    });
    expect(result.success).toBe(true);
  });

  it("aceita o pacote de criação (ticker+institutionId+assetTypeName+currency) sozinho", () => {
    const result = CreateAssetTransactionDto.safeParse({
      ticker: "petr4",
      institutionId: 1,
      assetTypeName: "Ações",
      currency: "BRL",
      type: "buy",
      date: YESTERDAY,
      quantity: 10,
      unitPriceCents: 1000,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita quando assetId e o pacote de criação vêm juntos", () => {
    const result = CreateAssetTransactionDto.safeParse({
      assetId: 1,
      ticker: "PETR4",
      institutionId: 1,
      assetTypeName: "Ações",
      currency: "BRL",
      type: "buy",
      date: YESTERDAY,
      quantity: 10,
      unitPriceCents: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita quando nem assetId nem o pacote de criação são informados", () => {
    const result = CreateAssetTransactionDto.safeParse({
      type: "buy",
      date: YESTERDAY,
      quantity: 10,
      unitPriceCents: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita data futura", () => {
    const result = CreateAssetTransactionDto.safeParse({
      assetId: 1,
      type: "buy",
      date: TOMORROW,
      quantity: 10,
      unitPriceCents: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("dividend não aceita quantity/unitPriceCents", () => {
    const result = CreateAssetTransactionDto.safeParse({
      assetId: 1,
      type: "dividend",
      date: YESTERDAY,
      quantity: 10,
      unitPriceCents: 1000,
      totalAmountCents: 500,
    });
    expect(result.success).toBe(false);
  });

  it("dividend válido só com totalAmountCents", () => {
    const result = CreateAssetTransactionDto.safeParse({
      assetId: 1,
      type: "dividend",
      date: YESTERDAY,
      totalAmountCents: 500,
    });
    expect(result.success).toBe(true);
  });
});
