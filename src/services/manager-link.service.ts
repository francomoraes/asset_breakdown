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

export class ManagerLinkService {
  constructor(
    private linkRepo: Repository<ManagerClientLink>,
    private historyRepo: Repository<ManagerClientHistory>,
    private userRepo: Repository<User>,
  ) {}

  async createLink({ investorId, managerId }: { investorId: number; managerId: number }) {
    if (investorId === managerId) {
      throw new BadRequestError("Cannot link to yourself", "SELF_LINK_NOT_ALLOWED");
    }

    const manager = await this.userRepo.findOne({ where: { id: managerId } });

    if (
      !manager ||
      (manager.role !== UserRole.MANAGER && manager.role !== UserRole.ADMIN)
    ) {
      throw new NotFoundError("Manager not found", "MANAGER_NOT_FOUND");
    }

    const pendingLink = await this.linkRepo.findOne({
      where: { investorId, managerId, status: LinkStatus.PENDING },
    });
    if (pendingLink) {
      throw new ConflictError("Pending link already exists", "PENDING_LINK_EXISTS");
    }

    const activeLink = await this.linkRepo.findOne({
      where: { investorId, managerId, status: LinkStatus.ACTIVE },
    });
    if (activeLink) {
      throw new ConflictError("Active link already exists", "ACTIVE_LINK_EXISTS");
    }

    const activeCount = await this.linkRepo.count({
      where: { managerId, status: LinkStatus.ACTIVE },
    });
    const limit = manager.managerClientLimit ?? DEFAULT_MANAGER_LIMIT;
    if (activeCount >= limit) {
      throw new ConflictError("Manager has reached client limit", "MANAGER_CLIENT_LIMIT_REACHED");
    }

    const link = this.linkRepo.create({
      investorId,
      managerId,
      status: LinkStatus.PENDING,
      requestedByUserId: investorId,
    });

    await this.linkRepo.save(link);
    return link;
  }

  async approveLink({ linkId, callerId }: { linkId: number; callerId: number }) {
    const link = await this.linkRepo.findOne({ where: { id: linkId } });

    if (!link) {
      throw new NotFoundError("Link not found", "NOT_FOUND");
    }

    if (link.managerId !== callerId) {
      throw new ForbiddenError("Forbidden", "FORBIDDEN");
    }

    if (link.status !== LinkStatus.PENDING) {
      throw new ConflictError("Link is not pending", "INVALID_STATUS_TRANSITION");
    }

    const manager = await this.userRepo.findOneBy({ id: link.managerId });
    if (!manager) {
      throw new NotFoundError("Manager not found", "NOT_FOUND");
    }

    if (manager.role !== UserRole.MANAGER && manager.role !== UserRole.ADMIN) {
      throw new BadRequestError("Manager no longer has eligible role", "MANAGER_NOT_ELIGIBLE");
    }

    const activeCount = await this.linkRepo.count({
      where: { managerId: link.managerId, status: LinkStatus.ACTIVE },
    });
    const limit = manager.managerClientLimit ?? DEFAULT_MANAGER_LIMIT;
    if (activeCount >= limit) {
      throw new ConflictError("Manager has reached client limit", "MANAGER_CLIENT_LIMIT_REACHED");
    }

    link.status = LinkStatus.ACTIVE;
    link.activatedAt = new Date();
    link.respondedByUserId = callerId;
    await this.linkRepo.save(link);

    const wealthCents = await calculateInvestorWealthCents(link.investorId);
    const history = this.historyRepo.create({
      investorId: link.investorId,
      managerId: link.managerId,
      linkId: link.id!,
      status: HistoryCycleStatus.ACTIVE,
      cycleStartAt: new Date(),
      initialWealthCents: wealthCents,
      currentWealthCents: wealthCents,
    });
    await this.historyRepo.save(history);

    return link;
  }

  async rejectLink({ linkId, callerId }: { linkId: number; callerId: number }) {
    const link = await this.linkRepo.findOne({ where: { id: linkId } });

    if (!link) {
      throw new NotFoundError("Link not found", "NOT_FOUND");
    }

    if (link.managerId !== callerId) {
      throw new ForbiddenError("Forbidden", "FORBIDDEN");
    }

    if (link.status !== LinkStatus.PENDING) {
      throw new ConflictError("Link is not pending", "INVALID_STATUS_TRANSITION");
    }

    link.status = LinkStatus.REJECTED;
    link.rejectedAt = new Date();
    link.respondedByUserId = callerId;
    await this.linkRepo.save(link);

    return link;
  }

  async revokeLink({ linkId, callerId }: { linkId: number; callerId: number }) {
    const link = await this.linkRepo.findOne({ where: { id: linkId } });

    if (!link) {
      throw new NotFoundError("Link not found", "NOT_FOUND");
    }

    const isInvestor = link.investorId === callerId;
    const isManager = link.managerId === callerId;

    if (!isInvestor && !isManager) {
      throw new ForbiddenError("Forbidden", "FORBIDDEN");
    }

    if (
      link.status === LinkStatus.REJECTED ||
      link.status === LinkStatus.REVOKED
    ) {
      throw new ConflictError("Link cannot be revoked", "INVALID_STATUS_TRANSITION");
    }

    if (isManager && link.status !== LinkStatus.ACTIVE) {
      throw new ConflictError("Manager can only revoke active links", "INVALID_STATUS_TRANSITION");
    }

    const wasActive = link.status === LinkStatus.ACTIVE;

    link.status = LinkStatus.REVOKED;
    link.revokedAt = new Date();
    link.revokeReason = isInvestor
      ? RevokeReason.MANUAL_BY_INVESTOR
      : RevokeReason.MANUAL_BY_MANAGER;
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

  async getPendingLinks({ managerId }: { managerId: number }) {
    const links = await this.linkRepo.find({
      where: { managerId, status: LinkStatus.PENDING },
      relations: ["investor"],
      order: { createdAt: "ASC" },
    });

    return links.map((link) => ({
      id: link.id,
      investorId: link.investorId,
      investorName: link.investor.name,
      investorEmail: link.investor.email,
      createdAt: link.createdAt,
    }));
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
