import { describe, it, expect, vi, beforeEach } from "vitest";
import { In } from "typeorm";

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
        actorUserId: MANAGER_ID,
        actorEmail: "manager@test.com",
        actorRole: UserRole.MANAGER,
      });

      expect(link.status).toBe(LinkStatus.ACTIVE);
      expect(link.activatedAt).toBeInstanceOf(Date);
      expect(fakeTxManager.save).toHaveBeenCalledTimes(2); // link + history cycle
    });

    it("admin cria vínculo informando um managerId diferente do próprio id", async () => {
      const link = await service.createLink({
        investorId: INVESTOR_ID,
        managerId: MANAGER_ID,
        actorUserId: ADMIN_ID,
        actorEmail: "admin@test.com",
        actorRole: UserRole.ADMIN,
      });

      expect(link.managerId).toBe(MANAGER_ID);
      expect(link.requestedByUserId).toBe(ADMIN_ID);
    });

    it("rejeita vínculo do investidor consigo mesmo", async () => {
      await expect(
        service.createLink({
          investorId: INVESTOR_ID,
          managerId: INVESTOR_ID,
          actorUserId: INVESTOR_ID,
          actorEmail: "investor@test.com",
          actorRole: UserRole.INVESTOR,
        }),
      ).rejects.toBeInstanceOf(BadRequestError);
    });

    it("investorId inexistente ou sem role investor → NotFoundError", async () => {
      await expect(
        service.createLink({
          investorId: 999,
          managerId: MANAGER_ID,
          actorUserId: MANAGER_ID,
          actorEmail: "manager@test.com",
          actorRole: UserRole.MANAGER,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("managerId inexistente ou sem role manager/admin → NotFoundError", async () => {
      await expect(
        service.createLink({
          investorId: INVESTOR_ID,
          managerId: 999,
          actorUserId: 999,
          actorEmail: "nobody@test.com",
          actorRole: UserRole.MANAGER,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("já existe vínculo ACTIVE pro mesmo par → ConflictError", async () => {
      fakeTxManager.findOne.mockResolvedValueOnce({ id: 1, status: LinkStatus.ACTIVE });

      await expect(
        service.createLink({
          investorId: INVESTOR_ID,
          managerId: MANAGER_ID,
          actorUserId: MANAGER_ID,
          actorEmail: "manager@test.com",
          actorRole: UserRole.MANAGER,
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("managerClientLimit atingido → ConflictError", async () => {
      fakeTxManager.count.mockResolvedValueOnce(manager.managerClientLimit);

      await expect(
        service.createLink({
          investorId: INVESTOR_ID,
          managerId: MANAGER_ID,
          actorUserId: MANAGER_ID,
          actorEmail: "manager@test.com",
          actorRole: UserRole.MANAGER,
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
          actorUserId: MANAGER_ID,
          actorEmail: "manager@test.com",
          actorRole: UserRole.MANAGER,
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
        actorUserId: MANAGER_ID,
        actorEmail: "manager@test.com",
        actorRole: UserRole.MANAGER,
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
          actorUserId: OTHER_MANAGER_ID,
          actorEmail: "other-manager@test.com",
          actorRole: UserRole.MANAGER,
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
        actorUserId: ADMIN_ID,
        actorEmail: "admin@test.com",
        actorRole: UserRole.ADMIN,
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
          actorUserId: MANAGER_ID,
          actorEmail: "manager@test.com",
          actorRole: UserRole.MANAGER,
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("vínculo inexistente → NotFoundError", async () => {
      fakeLinkRepo.findOne.mockResolvedValue(null);

      await expect(
        service.revokeLink({
          linkId: 999,
          actorUserId: MANAGER_ID,
          actorEmail: "manager@test.com",
          actorRole: UserRole.MANAGER,
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
        orderBy: vi.fn().mockReturnThis(),
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

    it("investidor com vínculo revogado continua na lista por padrão, com linkStatus revoked", async () => {
      const links = [
        { ...makeLink(1, "A"), status: LinkStatus.ACTIVE },
        { ...makeLink(2, "B"), status: LinkStatus.REVOKED },
      ];
      mockLinks(links);

      (calculateInvestorWealthCentsBulk as any).mockResolvedValue(new Map());
      (summaryService.getAdherenceBulk as any).mockResolvedValue(new Map());
      (wealthHistoryService.getMonthlyVariationBulk as any).mockResolvedValue(new Map());

      const result = await service.getActiveClients({ managerId: MANAGER_ID });

      expect(result.data.map((c) => c.investorId).sort()).toEqual([1, 2]);
      expect(result.data.find((c) => c.investorId === 2)!.linkStatus).toBe(
        LinkStatus.REVOKED,
      );
    });

    it("activeOnly: true filtra fora os vínculos não ativos", async () => {
      const links = [
        { ...makeLink(1, "A"), status: LinkStatus.ACTIVE },
        { ...makeLink(2, "B"), status: LinkStatus.REVOKED },
      ];
      mockLinks(links);

      (calculateInvestorWealthCentsBulk as any).mockResolvedValue(new Map());
      (summaryService.getAdherenceBulk as any).mockResolvedValue(new Map());
      (wealthHistoryService.getMonthlyVariationBulk as any).mockResolvedValue(new Map());

      const result = await service.getActiveClients({
        managerId: MANAGER_ID,
        activeOnly: true,
      });

      expect(result.data.map((c) => c.investorId)).toEqual([1]);
    });

    it("mesmo investidor com múltiplos links históricos → mantém só o mais recente", async () => {
      const links = [
        { ...makeLink(1, "A"), id: 201, status: LinkStatus.ACTIVE },
        { ...makeLink(1, "A"), id: 200, status: LinkStatus.REVOKED },
      ];
      mockLinks(links);

      (calculateInvestorWealthCentsBulk as any).mockResolvedValue(new Map());
      (summaryService.getAdherenceBulk as any).mockResolvedValue(new Map());
      (wealthHistoryService.getMonthlyVariationBulk as any).mockResolvedValue(new Map());

      const result = await service.getActiveClients({ managerId: MANAGER_ID });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].linkId).toBe(201);
      expect(result.data[0].linkStatus).toBe(LinkStatus.ACTIVE);
    });

    it("sem vínculos ativos → retorna lista vazia sem chamar as queries em lote", async () => {
      mockLinks([]);

      const result = await service.getActiveClients({ managerId: MANAGER_ID });

      expect(result).toEqual({
        data: [],
        meta: {
          totalItems: 0,
          currentPage: 1,
          itemsPerPage: 20,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
      expect(calculateInvestorWealthCentsBulk).not.toHaveBeenCalled();
    });

    it("página exata (10 clientes, itemsPerPage 10) → 1 página, sem próxima/anterior", async () => {
      const links = Array.from({ length: 10 }, (_, i) => makeLink(i + 1, `C${i}`));
      mockLinks(links);

      (calculateInvestorWealthCentsBulk as any).mockResolvedValue(new Map());
      (summaryService.getAdherenceBulk as any).mockResolvedValue(new Map());
      (wealthHistoryService.getMonthlyVariationBulk as any).mockResolvedValue(new Map());

      const result = await service.getActiveClients({
        managerId: MANAGER_ID,
        page: 1,
        itemsPerPage: 10,
      });

      expect(result.data).toHaveLength(10);
      expect(result.meta).toEqual({
        totalItems: 10,
        currentPage: 1,
        itemsPerPage: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it("última página parcial → hasNextPage false, hasPreviousPage true", async () => {
      const links = Array.from({ length: 25 }, (_, i) => makeLink(i + 1, `C${i}`));
      mockLinks(links);

      (calculateInvestorWealthCentsBulk as any).mockResolvedValue(new Map());
      (summaryService.getAdherenceBulk as any).mockResolvedValue(new Map());
      (wealthHistoryService.getMonthlyVariationBulk as any).mockResolvedValue(new Map());

      const result = await service.getActiveClients({
        managerId: MANAGER_ID,
        page: 3,
        itemsPerPage: 10,
      });

      expect(result.data).toHaveLength(5);
      expect(result.meta).toEqual({
        totalItems: 25,
        currentPage: 3,
        itemsPerPage: 10,
        totalPages: 3,
        hasNextPage: false,
        hasPreviousPage: true,
      });
    });

    describe("scope: all (admin — todo investidor da plataforma)", () => {
      function mockAllInvestors(investors: { id: number; name: string; email: string; riskProfile: null }[]) {
        fakeUserRepo.createQueryBuilder = vi.fn().mockReturnValue({
          where: vi.fn().mockReturnThis(),
          andWhere: vi.fn().mockReturnThis(),
          getMany: vi.fn().mockResolvedValue(investors),
        });
      }

      it("investidor sem vínculo com o admin entra com linkId/activatedAt null, investidor vinculado entra com os dados do vínculo", async () => {
        mockAllInvestors([
          { id: 1, name: "Linked", email: "linked@test.com", riskProfile: null },
          { id: 2, name: "Unlinked", email: "unlinked@test.com", riskProfile: null },
        ]);
        fakeLinkRepo.find = vi.fn().mockResolvedValue([
          { id: 555, investorId: 1, activatedAt: new Date("2026-02-01") },
        ]);

        (calculateInvestorWealthCentsBulk as any).mockResolvedValue(new Map());
        (summaryService.getAdherenceBulk as any).mockResolvedValue(new Map());
        (wealthHistoryService.getMonthlyVariationBulk as any).mockResolvedValue(new Map());

        const result = await service.getActiveClients({
          managerId: ADMIN_ID,
          scope: "all",
        });

        const linked = result.data.find((c) => c.investorId === 1)!;
        const unlinked = result.data.find((c) => c.investorId === 2)!;

        expect(linked.linkId).toBe(555);
        expect(linked.activatedAt).toEqual(new Date("2026-02-01"));
        expect(unlinked.linkId).toBeNull();
        expect(unlinked.activatedAt).toBeNull();
        expect(fakeLinkRepo.find).toHaveBeenCalledWith({
          where: { investorId: In([1, 2]), managerId: ADMIN_ID },
          order: { createdAt: "DESC" },
        });
      });

      it("sem nenhum investidor na plataforma → lista vazia sem chamar as queries em lote", async () => {
        mockAllInvestors([]);

        const result = await service.getActiveClients({
          managerId: ADMIN_ID,
          scope: "all",
        });

        expect(result.data).toEqual([]);
        expect(calculateInvestorWealthCentsBulk).not.toHaveBeenCalled();
      });
    });
  });
});
