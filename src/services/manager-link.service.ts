import { Repository } from "typeorm";
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
import { calculateInvestorWealthCents } from "./manager-dashboard.service";

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
    page = 1,
    itemsPerPage = 20,
    sortBy = "name",
    order = "ASC" as "ASC" | "DESC",
    search,
  }: {
    managerId: number;
    page?: number;
    itemsPerPage?: number;
    sortBy?: "name" | "activatedAt";
    order?: "ASC" | "DESC";
    search?: string;
  }) {
    const qb = this.linkRepo
      .createQueryBuilder("link")
      .leftJoinAndSelect("link.investor", "investor")
      .where("link.managerId = :managerId AND link.status = :status", {
        managerId,
        status: LinkStatus.ACTIVE,
      });

    if (search) {
      qb.andWhere(
        "(LOWER(investor.name) LIKE :search OR LOWER(investor.email) LIKE :search)",
        { search: `%${search.toLowerCase()}%` },
      );
    }

    if (sortBy === "name") {
      qb.orderBy("investor.name", order);
    } else {
      qb.orderBy("link.activatedAt", order);
    }

    const total = await qb.getCount();
    const links = await qb
      .skip((page - 1) * itemsPerPage)
      .take(itemsPerPage)
      .getMany();

    const data = await Promise.all(
      links.map(async (link) => ({
        investorId: link.investorId,
        investorName: link.investor.name,
        investorEmail: link.investor.email,
        activatedAt: link.activatedAt,
        currentWealthCents: await calculateInvestorWealthCents(link.investorId),
        linkId: link.id,
        riskProfile: link.investor.riskProfile,
      })),
    );

    return { data, meta: { total, page, itemsPerPage } };
  }
}

export const managerLinkService = new ManagerLinkService(
  AppDataSource.getRepository(ManagerClientLink),
  AppDataSource.getRepository(ManagerClientHistory),
  AppDataSource.getRepository(User),
);
