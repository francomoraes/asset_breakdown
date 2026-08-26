import { describe, it, expect, vi } from "vitest";

vi.mock("./manager-dashboard.service", () => ({
  calculateInvestorWealthCents: vi.fn((investorId: number) =>
    Promise.resolve(investorId * 1_000),
  ),
}));

import { AdminDashboardService } from "./admin-dashboard.service";
import { LinkStatus } from "models/manager-client-link";

const INVESTOR_A = 1;
const INVESTOR_B = 2;
const MANAGER_X = 10;
const MANAGER_Y = 11;

const activeLink = (
  investorId: number,
  managerId: number,
  managerName: string,
) => ({
  investorId,
  managerId,
  status: LinkStatus.ACTIVE,
  manager: { name: managerName, email: `${managerName}@test.com` },
});

describe("AdminDashboardService", () => {
  it("plataforma vazia retorna zeros, não erro", async () => {
    const linkRepo = { find: vi.fn().mockResolvedValue([]) } as any;
    const service = new AdminDashboardService(linkRepo);

    const result = await service.getGlobalDashboard();

    expect(result).toEqual({
      managersCount: 0,
      totalActiveClientsCount: 0,
      totalWealthUnderManagementCents: 0,
      managerRanking: [],
    });
  });

  it("cliente co-gerido não é contado 2x no total da plataforma, mas conta em cada gestor no ranking (decisão 4.2)", async () => {
    const linkRepo = {
      find: vi.fn().mockResolvedValue([
        activeLink(INVESTOR_A, MANAGER_X, "Gestor X"),
        activeLink(INVESTOR_A, MANAGER_Y, "Gestor Y"), // co-gestão: mesmo cliente, 2 gestores
        activeLink(INVESTOR_B, MANAGER_X, "Gestor X"),
      ]),
    } as any;
    const service = new AdminDashboardService(linkRepo);

    const result = await service.getGlobalDashboard();

    // total da plataforma: só INVESTOR_A (1000) + INVESTOR_B (2000), sem duplicar
    expect(result.totalActiveClientsCount).toBe(2);
    expect(result.totalWealthUnderManagementCents).toBe(1_000 + 2_000);
    expect(result.managersCount).toBe(2);

    const managerX = result.managerRanking.find((m) => m.managerId === MANAGER_X);
    const managerY = result.managerRanking.find((m) => m.managerId === MANAGER_Y);

    // Gestor X: INVESTOR_A + INVESTOR_B sob gestão dele
    expect(managerX?.activeClientsCount).toBe(2);
    expect(managerX?.totalWealthCents).toBe(1_000 + 2_000);

    // Gestor Y: só INVESTOR_A, mas conta o wealth completo dele (perspectiva por gestor)
    expect(managerY?.activeClientsCount).toBe(1);
    expect(managerY?.totalWealthCents).toBe(1_000);
  });

  it("ranking vem ordenado por patrimônio sob gestão, decrescente", async () => {
    const linkRepo = {
      find: vi.fn().mockResolvedValue([
        activeLink(INVESTOR_A, MANAGER_X, "Gestor X"), // 1000
        activeLink(INVESTOR_B, MANAGER_Y, "Gestor Y"), // 2000
      ]),
    } as any;
    const service = new AdminDashboardService(linkRepo);

    const result = await service.getGlobalDashboard();

    expect(result.managerRanking.map((m) => m.managerId)).toEqual([
      MANAGER_Y,
      MANAGER_X,
    ]);
  });
});
