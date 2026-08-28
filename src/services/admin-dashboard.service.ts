import { Repository } from "typeorm";
import { AppDataSource } from "config/data-source";
import { ManagerClientLink, LinkStatus } from "models/manager-client-link";
import { ManagerClientHistory, HistoryCycleStatus } from "models/manager-client-history";
import { calculateInvestorWealthCents } from "services/manager-dashboard.service";

export class AdminDashboardService {
  constructor(
    private linkRepo: Repository<ManagerClientLink>,
    private historyRepo: Repository<ManagerClientHistory>,
  ) {}

  async getGlobalDashboard() {
    const activeLinks = await this.linkRepo.find({
      where: { status: LinkStatus.ACTIVE },
      relations: ["investor", "manager"],
    });

    const activeHistories = await this.historyRepo.find({
      where: { status: HistoryCycleStatus.ACTIVE },
    });
    const initialWealthByManagerId = new Map<number, number>();
    for (const history of activeHistories) {
      initialWealthByManagerId.set(
        history.managerId,
        (initialWealthByManagerId.get(history.managerId) ?? 0) +
          Number(history.initialWealthCents),
      );
    }

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
      .map(([managerId, links]) => {
        const totalWealthCents = links.reduce(
          (sum, link) => sum + (wealthByInvestorId.get(link.investorId) ?? 0),
          0,
        );
        const totalInitialWealthCents = initialWealthByManagerId.get(managerId) ?? 0;
        const absoluteVariationCents = totalWealthCents - totalInitialWealthCents;
        const percentageVariation =
          totalInitialWealthCents > 0
            ? Number(
                ((absoluteVariationCents / totalInitialWealthCents) * 100).toFixed(2),
              )
            : 0;

        return {
          managerId,
          managerName: links[0].manager.name,
          managerEmail: links[0].manager.email,
          activeClientsCount: links.length,
          totalWealthCents,
          totalInitialWealthCents,
          absoluteVariationCents,
          percentageVariation,
        };
      })
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
  AppDataSource.getRepository(ManagerClientHistory),
);
