import { Repository } from "typeorm";
import { AppDataSource } from "config/data-source";
import { ManagerClientLink, LinkStatus } from "models/manager-client-link";
import { ManagerClientHistory, HistoryCycleStatus } from "models/manager-client-history";
import { Asset } from "models/asset";
import { FixedIncomeAsset } from "models/fixed-income-asset";
import { getBRLtoUSDRate } from "utils/get-brl-to-usd-rate";

export async function calculateInvestorWealthCents(userId: number): Promise<number> {
  const assetRepo = AppDataSource.getRepository(Asset);
  const fiRepo = AppDataSource.getRepository(FixedIncomeAsset);

  const assetsByCurrency = await assetRepo
    .createQueryBuilder("asset")
    .select("asset.currency", "currency")
    .addSelect("SUM(asset.currentValueCents)", "total")
    .where("asset.userId = :userId", { userId })
    .groupBy("asset.currency")
    .getRawMany<{ currency: string; total: string }>();

  const fiByCurrency = await fiRepo
    .createQueryBuilder("fi")
    .select("fi.currency", "currency")
    .addSelect("SUM(fi.currentValueCents)", "total")
    .where("fi.userId = :userId", { userId })
    .groupBy("fi.currency")
    .getRawMany<{ currency: string; total: string }>();

  const totalsByCurrency = new Map<string, number>();
  for (const row of [...assetsByCurrency, ...fiByCurrency]) {
    const prev = totalsByCurrency.get(row.currency) ?? 0;
    totalsByCurrency.set(row.currency, prev + Number(row.total ?? 0));
  }

  const brlToUsdRate = await getBRLtoUSDRate();
  const usdToBrlRate = 1 / brlToUsdRate;

  let totalBrl = 0;
  for (const [currency, total] of totalsByCurrency) {
    totalBrl += currency === "USD" ? Math.round(total * usdToBrlRate) : total;
  }

  return totalBrl;
}

export class ManagerDashboardService {
  constructor(
    private linkRepo: Repository<ManagerClientLink>,
    private historyRepo: Repository<ManagerClientHistory>,
  ) {}

  async getDashboard({ managerId }: { managerId: number }) {
    const activeLinks = await this.linkRepo.find({
      where: { managerId, status: LinkStatus.ACTIVE },
      relations: ["investor"],
    });

    const activeHistories = await this.historyRepo.find({
      where: { managerId, status: HistoryCycleStatus.ACTIVE },
    });

    const totalInitialWealthCents = activeHistories.reduce(
      (sum, h) => sum + Number(h.initialWealthCents),
      0,
    );

    const investorWealths = await Promise.all(
      activeLinks.map(async (link) => ({
        investorId: link.investorId,
        name: link.investor.name,
        currentWealthCents: await calculateInvestorWealthCents(link.investorId),
      })),
    );

    const totalWealthUnderManagementCents = investorWealths.reduce(
      (sum, inv) => sum + inv.currentWealthCents,
      0,
    );

    const absoluteVariationCents =
      totalWealthUnderManagementCents - totalInitialWealthCents;
    const percentageVariation =
      totalInitialWealthCents > 0
        ? Number(
            ((absoluteVariationCents / totalInitialWealthCents) * 100).toFixed(2),
          )
        : 0;

    const topInvestors = [...investorWealths]
      .sort((a, b) => b.currentWealthCents - a.currentWealthCents)
      .slice(0, 5)
      .map((inv) => ({
        investorId: inv.investorId,
        name: inv.name,
        currentWealthCents: inv.currentWealthCents,
      }));

    return {
      activeClientsCount: activeLinks.length,
      totalWealthUnderManagementCents,
      totalInitialWealthCents,
      absoluteVariationCents,
      percentageVariation,
      topInvestors,
    };
  }
}

export const managerDashboardService = new ManagerDashboardService(
  AppDataSource.getRepository(ManagerClientLink),
  AppDataSource.getRepository(ManagerClientHistory),
);
