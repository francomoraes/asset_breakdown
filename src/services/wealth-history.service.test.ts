import { describe, it, expect, vi } from "vitest";

import { WealthHistoryService } from "./wealth-history.service";

const USER_A = 1;
const USER_B = 2;
const USER_C = 3;

describe("WealthHistoryService.getMonthlyVariationBulk", () => {
  function makeService(snapshots: { userId: number; totalWealthCents: number }[]) {
    const fakeRepo = {
      find: vi.fn().mockResolvedValue(snapshots),
    };
    return new WealthHistoryService(fakeRepo as any);
  }

  it("cliente sem snapshot do mês atual → null, não 0", async () => {
    const service = makeService([{ userId: USER_A, totalWealthCents: 1000 }]);

    const result = await service.getMonthlyVariationBulk(
      [USER_A, USER_B],
      new Map([[USER_A, 1100], [USER_B, 500]]),
    );

    expect(result.get(USER_A)).toBe(10); // (1100-1000)/1000 * 100
    expect(result.get(USER_B)).toBeNull();
  });

  it("snapshot anterior com valor 0 → variação 0, não null (é um dado real, não ausência de dado)", async () => {
    const service = makeService([{ userId: USER_C, totalWealthCents: 0 }]);

    const result = await service.getMonthlyVariationBulk(
      [USER_C],
      new Map([[USER_C, 500]]),
    );

    expect(result.get(USER_C)).toBe(0);
  });

  it("lista de userIds vazia → mapa vazio, sem consultar o repositório", async () => {
    const fakeRepo = { find: vi.fn() };
    const service = new WealthHistoryService(fakeRepo as any);

    const result = await service.getMonthlyVariationBulk([], new Map());

    expect(result.size).toBe(0);
    expect(fakeRepo.find).not.toHaveBeenCalled();
  });
});
