import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../utils/recalculate-portfolio", () => ({
  recalculatePortfolio: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../utils/recalculate-asset-position", () => ({
  recalculateAssetPosition: vi.fn().mockResolvedValue({
    quantity: 10,
    averagePriceCents: 1000,
    dividendsCentsAccumulated: 0,
  }),
}));

vi.mock("./market-price.service", () => ({
  marketPriceService: {
    getPriceCents: vi.fn().mockResolvedValue(1000),
  },
}));

import { AssetTransactionService } from "./asset-transaction.service";
import { NotFoundError } from "errors/app-error";
import { recalculateAssetPosition } from "../utils/recalculate-asset-position";
import { marketPriceService } from "./market-price.service";

const USER_ID = 1;
const ASSET_ID = 42;

describe("AssetTransactionService", () => {
  let fakeTxManager: {
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let fakeTransactionRepo: any;
  let service: AssetTransactionService;
  let nextId: number;

  const existingAsset = { id: ASSET_ID, userId: USER_ID, currentPriceCents: 1000 };

  beforeEach(() => {
    nextId = 100;
    vi.mocked(recalculateAssetPosition).mockResolvedValue({
      quantity: 10,
      averagePriceCents: 1000,
      dividendsCentsAccumulated: 0,
    });
    vi.mocked(marketPriceService.getPriceCents).mockResolvedValue(1000);
    fakeTxManager = {
      findOne: vi.fn(),
      create: vi.fn((_entity: unknown, data: any) => ({ ...data })),
      save: vi.fn(async (data: any) => ({ id: data.id ?? nextId++, ...data })),
      remove: vi.fn(async (data: any) => data),
      update: vi.fn().mockResolvedValue(undefined),
    };
    fakeTransactionRepo = {
      manager: {
        transaction: vi.fn(async (cb: any) => cb(fakeTxManager)),
      },
    };
    service = new AssetTransactionService(fakeTransactionRepo);
  });

  describe("createTransaction", () => {
    it("com assetId de um ativo existente aplica a transação a ele", async () => {
      fakeTxManager.findOne.mockResolvedValueOnce(existingAsset); // resolveAsset

      const transaction = await service.createTransaction({
        userId: USER_ID,
        assetId: ASSET_ID,
        type: "buy",
        date: "2026-01-01",
        quantity: 10,
        unitPriceCents: 1000,
      });

      expect(transaction.assetId).toBe(ASSET_ID);
      expect(fakeTxManager.update).toHaveBeenCalledWith(
        expect.anything(),
        { id: ASSET_ID },
        expect.objectContaining({ quantity: 10, averagePriceCents: 1000 }),
      );
    });

    it("assetId de um ativo que não existe (ou não é do usuário) → NotFoundError ASSET_NOT_FOUND", async () => {
      fakeTxManager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.createTransaction({
          userId: USER_ID,
          assetId: 999,
          type: "buy",
          date: "2026-01-01",
          quantity: 10,
          unitPriceCents: 1000,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("via ticker: reaproveita o Asset quando já existe (find-or-create)", async () => {
      fakeTxManager.findOne.mockResolvedValueOnce(existingAsset); // find existing by ticker+institution

      const transaction = await service.createTransaction({
        userId: USER_ID,
        ticker: "PETR4",
        assetTypeName: "Ações",
        institutionId: 1,
        currency: "BRL",
        type: "buy",
        date: "2026-01-01",
        quantity: 10,
        unitPriceCents: 1000,
      });

      expect(transaction.assetId).toBe(ASSET_ID);
      expect(fakeTxManager.findOne).toHaveBeenCalledTimes(1);
    });

    it("via ticker: cria o Asset quando não existe, reaproveitando AssetType/Institution", async () => {
      fakeTxManager.findOne
        .mockResolvedValueOnce(null) // não existe Asset com esse ticker+instituição
        .mockResolvedValueOnce({ id: 5, name: "Ações", userId: USER_ID }) // AssetType
        .mockResolvedValueOnce({ id: 1, name: "XP", userId: USER_ID }); // Institution

      const transaction = await service.createTransaction({
        userId: USER_ID,
        ticker: "VALE3",
        assetTypeName: "Ações",
        institutionId: 1,
        currency: "BRL",
        type: "buy",
        date: "2026-01-01",
        quantity: 10,
        unitPriceCents: 1000,
      });

      expect(fakeTxManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ ticker: "VALE3", quantity: 0, averagePriceCents: 0 }),
      );
      expect(transaction).toBeDefined();
    });

    it("tipo dividend não envia quantity/unitPriceCents para a transação salva", async () => {
      fakeTxManager.findOne.mockResolvedValueOnce(existingAsset);

      await service.createTransaction({
        userId: USER_ID,
        assetId: ASSET_ID,
        type: "dividend",
        date: "2026-01-01",
        totalAmountCents: 500,
      });

      expect(fakeTxManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          quantity: null,
          unitPriceCents: null,
          totalAmountCents: 500,
        }),
      );
    });
  });

  describe("updateTransaction", () => {
    it("atualiza a transação e recalcula o Asset associado", async () => {
      fakeTxManager.findOne
        .mockResolvedValueOnce({ id: 10, assetId: ASSET_ID, userId: USER_ID })
        .mockResolvedValueOnce(existingAsset);

      const transaction = await service.updateTransaction({
        userId: USER_ID,
        transactionId: 10,
        type: "buy",
        date: "2026-01-02",
        quantity: 20,
        unitPriceCents: 900,
      });

      expect(transaction.quantity).toBe(20);
      expect(fakeTxManager.update).toHaveBeenCalled();
    });

    it("transactionId inexistente (ou de outro usuário) → NotFoundError TRANSACTION_NOT_FOUND", async () => {
      fakeTxManager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.updateTransaction({
          userId: USER_ID,
          transactionId: 999,
          type: "buy",
          date: "2026-01-01",
          quantity: 1,
          unitPriceCents: 100,
        }),
      ).rejects.toMatchObject({ code: "TRANSACTION_NOT_FOUND" });
    });
  });

  describe("deleteTransaction", () => {
    it("remove a transação e recalcula o Asset associado", async () => {
      fakeTxManager.findOne
        .mockResolvedValueOnce({ id: 10, assetId: ASSET_ID, userId: USER_ID })
        .mockResolvedValueOnce(existingAsset);

      await service.deleteTransaction({ userId: USER_ID, transactionId: 10 });

      expect(fakeTxManager.remove).toHaveBeenCalled();
      expect(fakeTxManager.update).toHaveBeenCalled();
    });

    it("transactionId inexistente → NotFoundError TRANSACTION_NOT_FOUND", async () => {
      fakeTxManager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.deleteTransaction({ userId: USER_ID, transactionId: 999 }),
      ).rejects.toMatchObject({ code: "TRANSACTION_NOT_FOUND" });
    });
  });
});
