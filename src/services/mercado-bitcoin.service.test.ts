import { describe, it, expect, vi, afterEach } from "vitest";
import {
  MercadoBitcoinAuthError,
  mercadoBitcoinService,
} from "./mercado-bitcoin.service";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => body,
  } as Response;
}

describe("MercadoBitcoinService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("conecta, descobre a conta e busca saldos filtrando BRL e zerados", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "token-123" }))
      .mockResolvedValueOnce(
        jsonResponse([
          { id: "acc-1", currency: "BRL", name: "default", type: "default" },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          { symbol: "BTC", available: "0.5", on_hold: "0", total: "0.5" },
          { symbol: "BRL", available: "100", on_hold: "0", total: "100" },
          { symbol: "ETH", available: "0", on_hold: "0", total: "0" },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await mercadoBitcoinService.connectAndFetchInitialBalances(
      "key",
      "secret",
    );

    expect(result.externalAccountId).toBe("acc-1");
    expect(result.balances).toEqual([{ ticker: "BTC", quantity: 0.5 }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("lança MercadoBitcoinAuthError quando o token é rejeitado (401)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({}, 401));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      mercadoBitcoinService.connectAndFetchInitialBalances(
        "bad-key",
        "bad-secret",
      ),
    ).rejects.toBeInstanceOf(MercadoBitcoinAuthError);
  });

  it("retorna lista vazia quando a resposta de saldos é vazia", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "token-123" }))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const balances = await mercadoBitcoinService.fetchBalancesForAccount(
      "key",
      "secret",
      "acc-1",
    );

    expect(balances).toEqual([]);
  });

  it("propaga erro em resposta de saldos malformada (não é array)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "token-123" }))
      .mockResolvedValueOnce(jsonResponse({ unexpected: "shape" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      mercadoBitcoinService.fetchBalancesForAccount("key", "secret", "acc-1"),
    ).rejects.toThrow();
  });

  it("fetchBalancesForAccount pula a redescoberta de conta (só token + balances)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "token-123" }))
      .mockResolvedValueOnce(
        jsonResponse([
          { symbol: "ETH", available: "2", on_hold: "0", total: "2" },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const balances = await mercadoBitcoinService.fetchBalancesForAccount(
      "key",
      "secret",
      "acc-1",
    );

    expect(balances).toEqual([{ ticker: "ETH", quantity: 2 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
