import { Repository } from "typeorm";
import { AppDataSource } from "config/data-source";
import { ManagerClientLink, LinkStatus } from "models/manager-client-link";
import { calculateInvestorWealthCents } from "services/manager-dashboard.service";

export class AdminDashboardService {
  constructor(private linkRepo: Repository<ManagerClientLink>) {}

  async getGlobalDashboard() {
    const activeLinks = await this.linkRepo.find({
      where: { status: LinkStatus.ACTIVE },
      relations: ["investor", "manager"],
    });

    const wealthByInvestorId = new Map<number, number>();
    for (const investorId of new Set(activeLinks.map((link) => link.investorId))) {
      wealthByInvestorId.set(investorId, await calculateInvestorWealthCents(investorId));
    }

    const totalWealthUnderManagementCents = [...wealthByInvestorId.values()].reduce(
      (sum, cents) => sum + cents,
      0,
    );

    const linksByManagerId = new Map<number, ManagerClientLink[]>();
    for (const link of activeLinks) {
      const links = linksByManagerId.get(link.managerId) ?? [];
      links.push(link);
      linksByManagerId.set(link.managerId, links);
    }

    const managerRanking = [...linksByManagerId.entries()]
      .map(([managerId, links]) => ({
        managerId,
        managerName: links[0].manager.name,
        managerEmail: links[0].manager.email,
        activeClientsCount: links.length,
        totalWealthCents: links.reduce(
          (sum, link) => sum + (wealthByInvestorId.get(link.investorId) ?? 0),
          0,
        ),
      }))
      .sort((a, b) => b.totalWealthCents - a.totalWealthCents);

    return {
      managersCount: linksByManagerId.size,
      totalActiveClientsCount: wealthByInvestorId.size,
      totalWealthUnderManagementCents,
      managerRanking,
    };
  }
}

export const adminDashboardService = new AdminDashboardService(
  AppDataSource.getRepository(ManagerClientLink),
);
