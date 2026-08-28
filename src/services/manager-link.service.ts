import { In, Repository } from "typeorm";
import { AppDataSource } from "config/data-source";
import { ManagerClientLink, LinkStatus, RevokeReason } from "models/manager-client-link";
import { ManagerClientHistory, HistoryCycleStatus } from "models/manager-client-history";
import { User } from "models/user";
import { UserRole } from "enums/role.enum";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "errors/app-error";
import {
  calculateInvestorWealthCents,
  calculateInvestorWealthCentsBulk,
} from "./manager-dashboard.service";
import { summaryService } from "./summary.service";
import { wealthHistoryService } from "./wealth-history.service";
import { fixedIncomeAssetService } from "./fixed-income-asset.service";
import { getBRLtoUSDRate } from "utils/get-brl-to-usd-rate";
import { RiskProfile } from "enums/risk-profile.enum";

type ClientSortBy =
  | "name"
  | "activatedAt"
  | "wealth"
  | "adherenceIndex"
  | "monthlyVariation";

type ClientScope = "mine" | "all";

type ClientBaseRow = {
  investorId: number;
  investorName: string;
  investorEmail: string;
  activatedAt: Date | null;
  linkId: number | null;
  linkStatus: LinkStatus | null;
  riskProfile: RiskProfile | null;
};

type ClientListItem = ClientBaseRow & {
  currentWealthCents: number;
  adherenceIndexPp: number | null;
  monthlyVariationPct: number | null;
};

const DEFAULT_MANAGER_LIMIT = 10;
const UNIQUE_VIOLATION_CODE = "23505";

export class ManagerLinkService {
  constructor(
    private linkRepo: Repository<ManagerClientLink>,
    private historyRepo: Repository<ManagerClientHistory>,
    private userRepo: Repository<User>,
  ) {}

  async createLink({
    investorId,
    managerId,
    requestedByUserId,
  }: {
    investorId: number;
    managerId: number;
    requestedByUserId: number;
  }) {
    if (investorId === managerId) {
      throw new BadRequestError("Cannot link to yourself", "SELF_LINK_NOT_ALLOWED");
    }

    const investor = await this.userRepo.findOne({ where: { id: investorId } });
    if (!investor || investor.role !== UserRole.INVESTOR) {
      throw new NotFoundError("Investor not found", "INVESTOR_NOT_FOUND");
    }

    const manager = await this.userRepo.findOne({ where: { id: managerId } });
    if (
      !manager ||
      (manager.role !== UserRole.MANAGER && manager.role !== UserRole.ADMIN)
    ) {
      throw new NotFoundError("Manager not found", "MANAGER_NOT_FOUND");
    }

    const limit = manager.managerClientLimit ?? DEFAULT_MANAGER_LIMIT;

    return this.linkRepo.manager.transaction(async (txManager) => {
      const activeLink = await txManager.findOne(ManagerClientLink, {
        where: { investorId, managerId, status: LinkStatus.ACTIVE },
      });
      if (activeLink) {
        throw new ConflictError("Active link already exists", "ACTIVE_LINK_EXISTS");
      }

      const activeCount = await txManager.count(ManagerClientLink, {
        where: { managerId, status: LinkStatus.ACTIVE },
      });
      if (activeCount >= limit) {
        throw new ConflictError("Manager has reached client limit", "MANAGER_CLIENT_LIMIT_REACHED");
      }

      const now = new Date();
      const link = txManager.create(ManagerClientLink, {
        investorId,
        managerId,
        status: LinkStatus.ACTIVE,
        requestedByUserId,
        activatedAt: now,
      });

      let saved: ManagerClientLink;
      try {
        saved = await txManager.save(link);
      } catch (error) {
        if (
          error instanceof Error &&
          (error as { code?: string }).code === UNIQUE_VIOLATION_CODE
        ) {
          throw new ConflictError("Active link already exists", "ACTIVE_LINK_EXISTS");
        }
        throw error;
      }

      const wealthCents = await calculateInvestorWealthCents(investorId);
      const history = txManager.create(ManagerClientHistory, {
        investorId,
        managerId,
        linkId: saved.id!,
        status: HistoryCycleStatus.ACTIVE,
        cycleStartAt: now,
        initialWealthCents: wealthCents,
        currentWealthCents: wealthCents,
      });
      await txManager.save(history);

      return saved;
    });
  }

  async revokeLink({
    linkId,
    callerId,
    callerRole,
  }: {
    linkId: number;
    callerId: number;
    callerRole: UserRole;
  }) {
    const link = await this.linkRepo.findOne({ where: { id: linkId } });

    if (!link) {
      throw new NotFoundError("Link not found", "NOT_FOUND");
    }

    const isOwnerManager = link.managerId === callerId;
    if (callerRole !== UserRole.ADMIN && !isOwnerManager) {
      throw new ForbiddenError("Forbidden", "FORBIDDEN");
    }

    if (
      link.status === LinkStatus.REJECTED ||
      link.status === LinkStatus.REVOKED
    ) {
      throw new ConflictError("Link cannot be revoked", "INVALID_STATUS_TRANSITION");
    }

    const wasActive = link.status === LinkStatus.ACTIVE;

    link.status = LinkStatus.REVOKED;
    link.revokedAt = new Date();
    link.revokeReason = RevokeReason.MANUAL_BY_MANAGER;
    await this.linkRepo.save(link);

    if (wasActive) {
      await this.closeHistoryCycle(link.id!, link.investorId);
    }

    return link;
  }

  async closeHistoryCycle(linkId: number, investorId: number): Promise<void> {
    const history = await this.historyRepo.findOne({
      where: { linkId, status: HistoryCycleStatus.ACTIVE },
    });
    if (!history) return;

    const wealthCents = await calculateInvestorWealthCents(investorId);
    history.status = HistoryCycleStatus.CLOSED;
    history.cycleEndAt = new Date();
    history.finalWealthCents = wealthCents;
    history.currentWealthCents = null;
    await this.historyRepo.save(history);
  }

  async getMyLinks({ investorId }: { investorId: number }) {
    const links = await this.linkRepo.find({
      where: { investorId },
      relations: ["manager"],
      order: { createdAt: "DESC" },
    });

    return links.map((link) => ({
      id: link.id,
      investorId: link.investorId,
      managerId: link.managerId,
      managerName: link.manager.name,
      managerEmail: link.manager.email,
      status: link.status,
      activatedAt: link.activatedAt,
      rejectedAt: link.rejectedAt,
      revokedAt: link.revokedAt,
      revokeReason: link.revokeReason,
      createdAt: link.createdAt,
    }));
  }

  async getActiveClients({
    managerId,
    scope = "mine",
    activeOnly = false,
    page = 1,
    itemsPerPage = 20,
    sortBy = "name",
    order = "ASC" as "ASC" | "DESC",
    search,
  }: {
    managerId: number;
    scope?: ClientScope;
    activeOnly?: boolean;
    page?: number;
    itemsPerPage?: number;
    sortBy?: ClientSortBy;
    order?: "ASC" | "DESC";
    search?: string;
  }) {
    const allRows =
      scope === "all"
        ? await this.getAllInvestorRows(managerId, search)
        : await this.getMyLinkedInvestorRows(managerId, search);

    const rows = activeOnly
      ? allRows.filter((row) => row.linkStatus === LinkStatus.ACTIVE)
      : allRows;

    if (rows.length === 0) {
      return {
        data: [],
        meta: {
          totalItems: 0,
          currentPage: page,
          itemsPerPage,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    }

    const investorIds = rows.map((row) => row.investorId);

    // refreshValues rodado uma única vez por cliente antes das 3 queries em
    // lote abaixo — cada uma delas assume que os preços já estão atualizados
    // e não chama refreshValues por conta própria (decisão 4.6).
    await Promise.all(
      investorIds.map((id) => fixedIncomeAssetService.refreshValues(id)),
    );

    const brlToUsdRate = await getBRLtoUSDRate();
    const usdToBrlRate = 1 / brlToUsdRate;

    const [wealthByUser, adherenceByUser] = await Promise.all([
      calculateInvestorWealthCentsBulk(investorIds),
      summaryService.getAdherenceBulk(investorIds, usdToBrlRate),
    ]);

    const variationByUser = await wealthHistoryService.getMonthlyVariationBulk(
      investorIds,
      wealthByUser,
    );

    const enriched: ClientListItem[] = rows.map((row) => ({
      ...row,
      currentWealthCents: wealthByUser.get(row.investorId) ?? 0,
      adherenceIndexPp: adherenceByUser.get(row.investorId) ?? null,
      monthlyVariationPct: variationByUser.get(row.investorId) ?? null,
    }));

    const sorted = this.sortClients(enriched, sortBy, order);
    const totalItems = sorted.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const validPage = Math.min(Math.max(page, 1), totalPages || 1);
    const start = (validPage - 1) * itemsPerPage;
    const data = sorted.slice(start, start + itemsPerPage);

    return {
      data,
      meta: {
        totalItems,
        currentPage: validPage,
        itemsPerPage,
        totalPages,
        hasNextPage: validPage < totalPages,
        hasPreviousPage: validPage > 1,
      },
    };
  }

  private async getMyLinkedInvestorRows(
    managerId: number,
    search?: string,
  ): Promise<ClientBaseRow[]> {
    const qb = this.linkRepo
      .createQueryBuilder("link")
      .leftJoinAndSelect("link.investor", "investor")
      .where("link.managerId = :managerId", { managerId })
      .orderBy("link.createdAt", "DESC");

    if (search) {
      qb.andWhere(
        "(LOWER(investor.name) LIKE :search OR LOWER(investor.email) LIKE :search)",
        { search: `%${search.toLowerCase()}%` },
      );
    }

    const links = await qb.getMany();

    // Um investidor pode ter vários links históricos com o mesmo gestor
    // (revogado e depois recriado) — sem o filtro por status ACTIVE, o mais
    // recente (createdAt DESC) já reflete o vínculo atual, ativo ou não,
    // então basta manter o primeiro encontrado por investidor.
    const latestByInvestor = new Map<number, (typeof links)[number]>();
    for (const link of links) {
      if (!latestByInvestor.has(link.investorId)) {
        latestByInvestor.set(link.investorId, link);
      }
    }

    return Array.from(latestByInvestor.values()).map((link) => ({
      investorId: link.investorId,
      investorName: link.investor.name,
      investorEmail: link.investor.email,
      activatedAt: link.activatedAt,
      linkId: link.id!,
      linkStatus: link.status,
      riskProfile: link.investor.riskProfile,
    }));
  }

  // scope "all" é admin-only (garantido no controller) — lista todo
  // investidor da plataforma, com o vínculo do próprio admin (se existir)
  // pra decidir, no front, entre "Ver carteira"/"Encerrar vínculo" (já
  // cliente do admin) ou "Adicionar Cliente" (ainda não vinculado).
  private async getAllInvestorRows(
    managerId: number,
    search?: string,
  ): Promise<ClientBaseRow[]> {
    const qb = this.userRepo
      .createQueryBuilder("investor")
      .where("investor.role = :role", { role: UserRole.INVESTOR });

    if (search) {
      qb.andWhere(
        "(LOWER(investor.name) LIKE :search OR LOWER(investor.email) LIKE :search)",
        { search: `%${search.toLowerCase()}%` },
      );
    }

    const investors = await qb.getMany();
    const investorIds = investors.map((investor) => investor.id!);

    const links = investorIds.length
      ? await this.linkRepo.find({
          where: { investorId: In(investorIds), managerId },
          order: { createdAt: "DESC" },
        })
      : [];

    // Mesmo caso de múltiplos links históricos por investidor descrito em
    // getMyLinkedInvestorRows — aqui também o mais recente é o que reflete
    // o vínculo atual com este gestor/admin.
    const linkByInvestorId = new Map<number, (typeof links)[number]>();
    for (const link of links) {
      if (!linkByInvestorId.has(link.investorId)) {
        linkByInvestorId.set(link.investorId, link);
      }
    }

    return investors.map((investor) => {
      const link = linkByInvestorId.get(investor.id!);
      return {
        investorId: investor.id!,
        investorName: investor.name,
        investorEmail: investor.email,
        activatedAt: link?.activatedAt ?? null,
        linkId: link?.id ?? null,
        linkStatus: link?.status ?? null,
        riskProfile: investor.riskProfile,
      };
    });
  }

  private sortClients(
    clients: ClientListItem[],
    sortBy: ClientSortBy,
    order: "ASC" | "DESC",
  ): ClientListItem[] {
    const dir = order === "ASC" ? 1 : -1;

    // null sempre vai pro fim, nas duas direções — "sem dado" não é "pior"
    // nem "melhor" que um valor real, só não deve embaralhar o resto da lista.
    const compareNullable = (a: number | null, b: number | null) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return (a - b) * dir;
    };

    const sorted = [...clients];
    switch (sortBy) {
      case "activatedAt":
        sorted.sort((a, b) => {
          const aTime = a.activatedAt ? new Date(a.activatedAt).getTime() : null;
          const bTime = b.activatedAt ? new Date(b.activatedAt).getTime() : null;
          return compareNullable(aTime, bTime);
        });
        break;
      case "wealth":
        sorted.sort(
          (a, b) => (a.currentWealthCents - b.currentWealthCents) * dir,
        );
        break;
      case "adherenceIndex":
        sorted.sort((a, b) =>
          compareNullable(a.adherenceIndexPp, b.adherenceIndexPp),
        );
        break;
      case "monthlyVariation":
        sorted.sort((a, b) =>
          compareNullable(a.monthlyVariationPct, b.monthlyVariationPct),
        );
        break;
      case "name":
      default:
        sorted.sort(
          (a, b) => a.investorName.localeCompare(b.investorName) * dir,
        );
        break;
    }
    return sorted;
  }
}

export const managerLinkService = new ManagerLinkService(
  AppDataSource.getRepository(ManagerClientLink),
  AppDataSource.getRepository(ManagerClientHistory),
  AppDataSource.getRepository(User),
);
