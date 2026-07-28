import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// --- Mocks de infraestrutura (DB e APIs externas) --------------------------
// A ideia é exercitar de verdade as rotas/controllers/services/DTOs deste
// projeto via HTTP (supertest), só isolando o que é I/O externo genuíno:
// Postgres (não há banco de teste dedicado) e as APIs da Mercado
// Bitcoin/CoinGecko.

vi.mock("../src/config/data-source", () => {
  function createFakeRepo() {
    return {
      find: vi.fn(),
      findOne: vi.fn(),
      findOneBy: vi.fn(),
      findBy: vi.fn(),
      create: vi.fn((data: any) => ({ ...data })),
      save: vi.fn(async (entity: any) => entity),
      delete: vi.fn(async () => ({ affected: 1 })),
      remove: vi.fn(async (entity: any) => entity),
      count: vi.fn(async () => 0),
    };
  }

  const repos: Record<string, any> = {};
  function getOrCreate(name: string) {
    if (!repos[name]) repos[name] = createFakeRepo();
    return repos[name];
  }

  return {
    AppDataSource: {
      isInitialized: true,
      initialize: vi.fn().mockResolvedValue(undefined),
      getRepository: vi.fn((entity: any) => getOrCreate(entity?.name ?? "unknown")),
    },
    __getFakeRepo: getOrCreate,
  };
});

vi.mock("../src/services/auth.service", () => ({
  authService: {
    validateToken: vi.fn(async (token: string) => {
      if (token === "token-user-1") {
        return { userId: 1, email: "u1@test.com", name: "U1", role: "investor" };
      }
      if (token === "token-user-2") {
        return { userId: 2, email: "u2@test.com", name: "U2", role: "investor" };
      }
      throw new Error("invalid token");
    }),
  },
}));

vi.mock("../src/services/mercado-bitcoin.service", () => ({
  mercadoBitcoinService: {
    connectAndFetchInitialBalances: vi.fn(),
    fetchBalancesForAccount: vi.fn(),
  },
  MercadoBitcoinAuthError: class MercadoBitcoinAuthError extends Error {},
}));

vi.mock("../src/services/market-price.service", () => ({
  marketPriceService: {
    getPriceCents: vi.fn().mockResolvedValue(500000),
    getPricesCentsBatch: vi.fn().mockResolvedValue(new Map()),
  },
}));

vi.mock("../src/utils/recalculate-portfolio", () => ({
  recalculatePortfolio: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/middlewares/rate-limit", () => {
  const passthrough = (_req: any, _res: any, next: any) => next();
  return {
    appLimiter: passthrough,
    authLimiter: passthrough,
    strictLimiter: passthrough,
    refreshLimiter: passthrough,
    marketIndicesLimiter: passthrough,
    summaryLimiter: passthrough,
    cryptoSyncLimiter: passthrough,
  };
});

import { __getFakeRepo } from "../src/config/data-source";
import { mercadoBitcoinService } from "../src/services/mercado-bitcoin.service";
import { config } from "../src/config/environment";
import { AssetSource } from "../src/enums/asset-source.enum";
import { ConnectedAccountStatus } from "../src/enums/connected-account-status.enum";
import { encrypt } from "../src/utils/crypto-credentials";
import app from "../src/app";

const fakeAssetRepo = (__getFakeRepo as any)("Asset");
const fakeAssetTypeRepo = (__getFakeRepo as any)("AssetType");
const fakeInstitutionRepo = (__getFakeRepo as any)("Institution");
const fakeMbAccountRepo = (__getFakeRepo as any)("MercadoBitcoinAccount");

const AUTH_USER_1 = "Bearer token-user-1";
const AUTH_USER_2 = "Bearer token-user-2";

describe("crypto-account routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    config.cryptoMasterKey = Buffer.alloc(32, 7).toString("base64");
    fakeAssetRepo.find.mockResolvedValue([]);
    fakeAssetRepo.save.mockImplementation(async (e: any) => e);
  });

  it("POST /crypto-accounts cria a conta e GET nunca retorna credenciais", async () => {
    fakeInstitutionRepo.findOne.mockResolvedValueOnce({ id: 10, userId: 1, name: "Binance" });
    fakeAssetTypeRepo.findOneBy.mockResolvedValueOnce({ id: 20, userId: 1, name: "Altcoin" });
    (mercadoBitcoinService.connectAndFetchInitialBalances as any).mockResolvedValueOnce({
      externalAccountId: "acc-1",
      balances: [{ ticker: "BTC", quantity: 0.5 }],
    });
    fakeMbAccountRepo.findOneBy.mockResolvedValueOnce(null); // sem duplicata

    let savedAccount: any;
    fakeMbAccountRepo.save.mockImplementationOnce(async (acc: any) => {
      acc.id = 1;
      savedAccount = acc;
      return acc;
    });

    const createRes = await request(app)
      .post("/api/crypto-accounts")
      .set("Authorization", AUTH_USER_1)
      .send({
        type: "mercado_bitcoin",
        institutionId: 10,
        assetType: "Altcoin",
        apiKey: "my-api-key",
        apiSecret: "my-api-secret",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.account).toMatchObject({
      id: 1,
      type: "mercado_bitcoin",
      status: ConnectedAccountStatus.ACTIVE,
      institutionId: 10,
      assetTypeId: 20,
    });
    expect(JSON.stringify(createRes.body)).not.toMatch(
      /credentialsEncrypted|apiKey|apiSecret|authTag/i,
    );

    fakeMbAccountRepo.find.mockResolvedValueOnce([savedAccount]);

    const listRes = await request(app)
      .get("/api/crypto-accounts")
      .set("Authorization", AUTH_USER_1);

    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(1);
    expect(JSON.stringify(listRes.body)).not.toMatch(
      /credentialsEncrypted|apiKey|apiSecret|authTag/i,
    );
  });

  it("acesso a conta conectada de outro usuário retorna 404, não 403", async () => {
    fakeMbAccountRepo.findOne.mockResolvedValueOnce(null); // não pertence ao user 2

    const res = await request(app)
      .delete("/api/crypto-accounts/999")
      .set("Authorization", AUTH_USER_2);

    expect(res.status).toBe(404);
  });

  it("institutionId de outro usuário retorna 404 ao conectar conta", async () => {
    fakeInstitutionRepo.findOne.mockResolvedValueOnce(null); // institution não é do user 1

    const res = await request(app)
      .post("/api/crypto-accounts")
      .set("Authorization", AUTH_USER_1)
      .send({
        type: "mercado_bitcoin",
        institutionId: 999,
        assetType: "Altcoin",
        apiKey: "key",
        apiSecret: "secret",
      });

    expect(res.status).toBe(404);
    expect(mercadoBitcoinService.connectAndFetchInitialBalances).not.toHaveBeenCalled();
  });

  it("duas chamadas concorrentes a POST /:id/sync — a segunda retorna 409 ACCOUNT_SYNC_IN_PROGRESS", async () => {
    const encrypted = encrypt(JSON.stringify({ apiKey: "key", apiSecret: "secret" }));
    const existingAccount = {
      id: 5,
      userId: 1,
      institutionId: 10,
      assetTypeId: 20,
      externalAccountId: "acc-1",
      status: ConnectedAccountStatus.ACTIVE,
      lastSyncedAt: null,
      lastSyncError: null,
      credentialsEncrypted: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
    };
    fakeMbAccountRepo.findOne.mockResolvedValue(existingAccount);
    fakeMbAccountRepo.save.mockImplementation(async (e: any) => e);
    fakeInstitutionRepo.findOneBy.mockResolvedValue({ id: 10, userId: 1, name: "Binance" });
    fakeAssetTypeRepo.findOneBy.mockResolvedValue({ id: 20, userId: 1, name: "Altcoin" });

    // Não dá pra saber de antemão qual dos dois requests vai efetivamente
    // chegar primeiro ao guard e virar o "dono" da sincronização — em vez de
    // depender de qual delas resolve a outra (risco de deadlock), a chamada ao
    // provider simplesmente demora um pouco (setTimeout), tempo suficiente
    // para a segunda chamada (seja ela qual for) bater no guard.
    (mercadoBitcoinService.fetchBalancesForAccount as any).mockReturnValueOnce(
      new Promise((resolve) => setTimeout(() => resolve([]), 50)),
    );

    const [firstResponse, secondResponse] = await Promise.all([
      request(app)
        .post("/api/crypto-accounts/5/sync")
        .set("Authorization", AUTH_USER_1),
      request(app)
        .post("/api/crypto-accounts/5/sync")
        .set("Authorization", AUTH_USER_1),
    ]);

    const statuses = [firstResponse.status, secondResponse.status].sort();
    expect(statuses).toEqual([200, 409]);

    const conflicted =
      firstResponse.status === 409 ? firstResponse : secondResponse;
    expect(conflicted.body.code).toBe("ACCOUNT_SYNC_IN_PROGRESS");
  });

  it("PUT /assets/:id com quantity num asset source=mercado_bitcoin retorna 409 CONNECTED_ASSET_QUANTITY_LOCKED", async () => {
    fakeAssetRepo.findOne.mockResolvedValueOnce({
      id: 42,
      userId: 1,
      ticker: "BTC",
      quantity: 0.5,
      currency: "USD",
      source: AssetSource.MERCADO_BITCOIN,
      connectedAccountId: 5,
    });

    const res = await request(app)
      .put("/api/assets/42")
      .set("Authorization", AUTH_USER_1)
      .send({ quantity: 999 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONNECTED_ASSET_QUANTITY_LOCKED");
  });
});
