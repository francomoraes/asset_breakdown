import { Repository } from "typeorm";
import { AppDataSource } from "config/data-source";
import { User } from "models/user";
import { UserRole } from "enums/role.enum";
import { ManagerClientLink, LinkStatus, RevokeReason } from "models/manager-client-link";
import { BadRequestError, NotFoundError } from "errors/app-error";
import { managerLinkService } from "./manager-link.service";

export class RoleManagementService {
  constructor(
    private userRepo: Repository<User>,
    private linkRepo: Repository<ManagerClientLink>,
  ) {}

  async updateRole({
    targetUserId,
    newRole,
  }: {
    targetUserId: number;
    newRole: UserRole;
  }) {
    const user = await this.userRepo.findOne({ where: { id: targetUserId } });

    if (!user) {
      throw new NotFoundError("User not found", "NOT_FOUND");
    }

    const previousRole = user.role;
    user.role = newRole;
    await this.userRepo.save(user);

    const wasManagerEligible =
      previousRole === UserRole.MANAGER || previousRole === UserRole.ADMIN;
    const isNoLongerManagerEligible = newRole === UserRole.INVESTOR;

    if (wasManagerEligible && isNoLongerManagerEligible) {
      await this.revokeAllLinksForManager({ managerId: targetUserId });
    }

    return user;
  }

  async updateClientLimit({
    managerId,
    limit,
  }: {
    managerId: number;
    limit: number;
  }) {
    const user = await this.userRepo.findOne({ where: { id: managerId } });

    if (!user) {
      throw new NotFoundError("Manager not found", "NOT_FOUND");
    }

    if (user.role !== UserRole.MANAGER && user.role !== UserRole.ADMIN) {
      throw new BadRequestError("User does not have manager role", "NOT_A_MANAGER");
    }

    user.managerClientLimit = limit;
    await this.userRepo.save(user);

    return user;
  }

  private async revokeAllLinksForManager({ managerId }: { managerId: number }) {
    const links = await this.linkRepo.find({
      where: [
        { managerId, status: LinkStatus.ACTIVE },
        { managerId, status: LinkStatus.PENDING },
      ],
    });

    for (const link of links) {
      const wasActive = link.status === LinkStatus.ACTIVE;

      link.status = LinkStatus.REVOKED;
      link.revokedAt = new Date();
      link.revokeReason = RevokeReason.ROLE_REMOVED;
      await this.linkRepo.save(link);

      if (wasActive) {
        await managerLinkService.closeHistoryCycle(link.id!, link.investorId);
      }
    }
  }
}

export const roleManagementService = new RoleManagementService(
  AppDataSource.getRepository(User),
  AppDataSource.getRepository(ManagerClientLink),
);
