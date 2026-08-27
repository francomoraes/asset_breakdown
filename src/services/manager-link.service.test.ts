import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./manager-dashboard.service", () => ({
  calculateInvestorWealthCents: vi.fn().mockResolvedValue(100_000),
  calculateInvestorWealthCentsBulk: vi.fn(),
}));

vi.mock("./summary.service", () => ({
  summaryService: { getAdherenceBulk: vi.fn() },
}));

vi.mock("./wealth-history.service", () => ({
  wealthHistoryService: { getMonthlyVariationBulk: vi.fn() },
}));

vi.mock("./fixed-income-asset.service", () => ({
  fixedIncomeAssetService: { refreshValues: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("utils/get-brl-to-usd-rate", () => ({
  getBRLtoUSDRate: vi.fn().mockResolvedValue(0.2),
}));

import { ManagerLinkService } from "./manager-link.service";
import { calculateInvestorWealthCentsBulk } from "./manager-dashboard.service";
import { summaryService } from "./summary.service";
import { wealthHistoryService } from "./wealth-history.service";
import { LinkStatus, RevokeReason } from "models/manager-client-link";
import { HistoryCycleStatus } from "models/manager-client-history";
import { UserRole } from "enums/role.enum";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "errors/app-error";

const INVESTOR_ID = 1;
const MANAGER_ID = 2;
const OTHER_MANAGER_ID = 3;
const ADMIN_ID = 4;

const investor = { id: INVESTOR_ID, role: UserRole.INVESTOR, managerClientLimit: null };
const manager = { id: MANAGER_ID, role: UserRole.MANAGER, managerClientLimit: 10 };

describe("ManagerLinkService", () => {
  let fakeTxManager: {
    findOne: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let fakeLinkRepo: any;
  let fakeHistoryRepo: any;
  let fakeUserRepo: any;
  let service: ManagerLinkService;
  let nextId: number;

  beforeEach(() => {
    nextId = 100;
    fakeTxManager = {
      findOne: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn((_entity: unknown, data: any) => ({ ...data })),
      save: vi.fn(async (data: any) => ({ id: data.id ?? nextId++, ...data })),
    };
    fakeLinkRepo = {
      findOne: vi.fn(),
      save: vi.fn(async (data: any) => ({ id: data.id ?? nextId++, ...data })),
      manager: {
        transaction: vi.fn(async (cb: any) => cb(fakeTxManager)),
      },
    };
    fakeHistoryRepo = {
      findOne: vi.fn(),
      save: vi.fn(async (data: any) => ({ id: data.id ?? nextId++, ...data })),
    };
    fakeUserRepo = {
      findOne: vi.fn(async ({ where: { id } }: any) => {
        if (id === INVESTOR_ID) return investor;
        if (id === MANAGER_ID) return manager;
        return null;
      }),
    };
    service = new ManagerLinkService(fakeLinkRepo, fakeHistoryRepo, fakeUserRepo);
  });

  describe("createLink", () => {
    it("manager cria vínculo pra si — nasce ACTIVE com ciclo de histórico junto (decisão 4.3)", async () => {
      const link = await service.createLink({
        investorId: INVESTOR_ID,
        managerId: MANAGER_ID,
        requestedByUserId: MANAGER_ID,
      });

      expect(link.status).toBe(LinkStatus.ACTIVE);
      expect(link.activatedAt).toBeInstanceOf(Date);
      expect(fakeTxManager.save).toHaveBeenCalledTimes(2); // link + history cycle
    });

    it("admin cria vínculo informando um managerId diferente do próprio id", async () => {
      const link = await service.createLink({
        investorId: INVESTOR_ID,
        managerId: MANAGER_ID,
        requestedByUserId: ADMIN_ID,
      });

      expect(link.managerId).toBe(MANAGER_ID);
      expect(link.requestedByUserId).toBe(ADMIN_ID);
    });

    it("rejeita vínculo do investidor consigo mesmo", async () => {
      await expect(
        service.createLink({
          investorId: INVESTOR_ID,
          managerId: INVESTOR_ID,
          requestedByUserId: INVESTOR_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestError);
    });

    it("investorId inexistente ou sem role investor → NotFoundError", async () => {
      await expect(
        service.createLink({
          investorId: 999,
          managerId: MANAGER_ID,
          requestedByUserId: MANAGER_ID,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("managerId inexistente ou sem role manager/admin → NotFoundError", async () => {
      await expect(
        service.createLink({
          investorId: INVESTOR_ID,
          managerId: 999,
          requestedByUserId: 999,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("já existe vínculo ACTIVE pro mesmo par → ConflictError", async () => {
      fakeTxManager.findOne.mockResolvedValueOnce({ id: 1, status: LinkStatus.ACTIVE });

      await expect(
        service.createLink({
          investorId: INVESTOR_ID,
          managerId: MANAGER_ID,
          requestedByUserId: MANAGER_ID,
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("managerClientLimit atingido → ConflictError", async () => {
      fakeTxManager.count.mockResolvedValueOnce(manager.managerClientLimit);

      await expect(
        service.createLink({
          investorId: INVESTOR_ID,
          managerId: MANAGER_ID,
          requestedByUserId: MANAGER_ID,
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("race condition (constraint única do banco, código 23505) vira ConflictError", async () => {
      const dbError = Object.assign(new Error("duplicate key"), { code: "23505" });
      fakeTxManager.save.mockRejectedValueOnce(dbError);

      await expect(
        service.createLink({
          investorId: INVESTOR_ID,
          managerId: MANAGER_ID,
          requestedByUserId: MANAGER_ID,
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("revokeLink", () => {
    it("manager dono do vínculo revoga com sucesso e fecha o ciclo de histórico se estava ACTIVE", async () => {
      const link = {
        id: 10,
        investorId: INVESTOR_ID,
        managerId: MANAGER_ID,
        status: LinkStatus.ACTIVE,
      };
      fakeLinkRepo.findOne.mockResolvedValue(link);
      fakeHistoryRepo.findOne.mockResolvedValue({
        id: 1,
        linkId: 10,
        status: HistoryCycleStatus.ACTIVE,
      });

      const result = await service.revokeLink({
        linkId: 10,
        callerId: MANAGER_ID,
        callerRole: UserRole.MANAGER,
      });

      expect(result.status).toBe(LinkStatus.REVOKED);
      expect(result.revokeReason).toBe(RevokeReason.MANUAL_BY_MANAGER);
      expect(fakeHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: HistoryCycleStatus.CLOSED }),
      );
    });

    it("manager que não é dono do vínculo → ForbiddenError", async () => {
      fakeLinkRepo.findOne.mockResolvedValue({
        id: 10,
        investorId: INVESTOR_ID,
        managerId: MANAGER_ID,
        status: LinkStatus.ACTIVE,
      });

      await expect(
        service.revokeLink({
          linkId: 10,
          callerId: OTHER_MANAGER_ID,
          callerRole: UserRole.MANAGER,
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("admin revoga vínculo de qualquer gestor (gestor global)", async () => {
      fakeLinkRepo.findOne.mockResolvedValue({
        id: 10,
        investorId: INVESTOR_ID,
        managerId: MANAGER_ID,
        status: LinkStatus.ACTIVE,
      });
      fakeHistoryRepo.findOne.mockResolvedValue(null);

      const result = await service.revokeLink({
        linkId: 10,
        callerId: ADMIN_ID,
        callerRole: UserRole.ADMIN,
      });

      expect(result.status).toBe(LinkStatus.REVOKED);
    });

    it("vínculo já REVOKED → ConflictError", async () => {
      fakeLinkRepo.findOne.mockResolvedValue({
        id: 10,
        investorId: INVESTOR_ID,
        managerId: MANAGER_ID,
        status: LinkStatus.REVOKED,
      });

      await expect(
        service.revokeLink({
          linkId: 10,
          callerId: MANAGER_ID,
          callerRole: UserRole.MANAGER,
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("vínculo inexistente → NotFoundError", async () => {
      fakeLinkRepo.findOne.mockResolvedValue(null);

      await expect(
        service.revokeLink({
          linkId: 999,
          callerId: MANAGER_ID,
          callerRole: UserRole.MANAGER,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("getActiveClients", () => {
    function makeLink(investorId: number, name: string) {
      return {
        id: investorId + 1000,
        investorId,
        investor: { name, email: `${name}@test.com`, riskProfile: null },
        activatedAt: new Date("2026-01-01"),
      };
    }

    function mockLinks(links: ReturnType<typeof makeLink>[]) {
      fakeLinkRepo.createQueryBuilder = vi.fn().mockReturnValue({
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(links),
      });
    }

    it("ordena por índice de aderência DESC, com null sempre no fim", async () => {
      const links = [
        makeLink(1, "A"),
        makeLink(2, "B"),
        makeLink(3, "C"),
      ];
      mockLinks(links);

      (calculateInvestorWealthCentsBulk as any).mockResolvedValue(
        new Map([[1, 1000], [2, 2000], [3, 3000]]),
      );
      (summaryService.getAdherenceBulk as any).mockResolvedValue(
        new Map([[1, 10], [2, null], [3, 25]]),
      );
      (wealthHistoryService.getMonthlyVariationBulk as any).mockResolvedValue(
        new Map([[1, 1], [2, 2], [3, 3]]),
      );

      const result = await service.getActiveClients({
        managerId: MANAGER_ID,
        sortBy: "adherenceIndex",
        order: "DESC",
      });

      expect(result.data.map((c) => c.investorId)).toEqual([3, 1, 2]);
    });

    it("ordena por variação mensal ASC, com null sempre no fim", async () => {
      const links = [makeLink(1, "A"), makeLink(2, "B"), makeLink(3, "C")];
      mockLinks(links);

      (calculateInvestorWealthCentsBulk as any).mockResolvedValue(
        new Map([[1, 1000], [2, 2000], [3, 3000]]),
      );
      (summaryService.getAdherenceBulk as any).mockResolvedValue(
        new Map([[1, 1], [2, 2], [3, 3]]),
      );
      (wealthHistoryService.getMonthlyVariationBulk as any).mockResolvedValue(
        new Map([[1, 5], [2, null], [3, -2]]),
      );

      const result = await service.getActiveClients({
        managerId: MANAGER_ID,
        sortBy: "monthlyVariation",
        order: "ASC",
      });

      expect(result.data.map((c) => c.investorId)).toEqual([3, 1, 2]);
    });

    it("ordena por patrimônio DESC", async () => {
      const links = [makeLink(1, "A"), makeLink(2, "B"), makeLink(3, "C")];
      mockLinks(links);

      (calculateInvestorWealthCentsBulk as any).mockResolvedValue(
        new Map([[1, 1000], [2, 3000], [3, 2000]]),
      );
      (summaryService.getAdherenceBulk as any).mockResolvedValue(new Map());
      (wealthHistoryService.getMonthlyVariationBulk as any).mockResolvedValue(new Map());

      const result = await service.getActiveClients({
        managerId: MANAGER_ID,
        sortBy: "wealth",
        order: "DESC",
      });

      expect(result.data.map((c) => c.investorId)).toEqual([2, 3, 1]);
    });

    it("sem vínculos ativos → retorna lista vazia sem chamar as queries em lote", async () => {
      mockLinks([]);

      const result = await service.getActiveClients({ managerId: MANAGER_ID });

      expect(result).toEqual({ data: [], meta: { total: 0, page: 1, itemsPerPage: 20 } });
      expect(calculateInvestorWealthCentsBulk).not.toHaveBeenCalled();
    });
  });
});
