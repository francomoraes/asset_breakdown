import { Repository } from "typeorm";
import { AppDataSource } from "config/data-source";
import { ManagerClientLink, LinkStatus } from "models/manager-client-link";
import { ManagerClientHistory, HistoryCycleStatus } from "models/manager-client-history";
import { Asset } from "models/asset";
import { FixedIncomeAsset } from "models/fixed-income-asset";
import { User } from "models/user";
import { UserRole } from "enums/role.enum";
import { getBRLtoUSDRate } from "utils/get-brl-to-usd-rate";
import { fixedIncomeAssetService } from "./fixed-income-asset.service";

type DashboardScope = "mine" | "all";

async function getExchangeRateField(): Promise<{ usdToBrl: number }> {
  const brlToUsdRate = await getBRLtoUSDRate();
  return { usdToBrl: Number((1 / brlToUsdRate).toFixed(4)) };
}

export async function calculateInvestorWealthCents(userId: number): Promise<number> {
  await fixedIncomeAssetService.refreshValues(userId);

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

// Versão em lote de calculateInvestorWealthCents — mesma conta, mas com 2
// queries agrupadas por usuário em vez de N chamadas individuais (decisão 4.3
// da spec de índice de aderência: elimina o N+1 na lista de clientes do gestor).
export async function calculateInvestorWealthCentsBulk(
  userIds: number[],
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (userIds.length === 0) return result;

  await Promise.all(userIds.map((id) => fixedIncomeAssetService.refreshValues(id)));

  const assetRepo = AppDataSource.getRepository(Asset);
  const fiRepo = AppDataSource.getRepository(FixedIncomeAsset);

  const assetsByUserAndCurrency = await assetRepo
    .createQueryBuilder("asset")
    .select("asset.userId", "userId")
    .addSelect("asset.currency", "currency")
    .addSelect("SUM(asset.currentValueCents)", "total")
    .where("asset.userId IN (:...userIds)", { userIds })
    .groupBy("asset.userId, asset.currency")
    .getRawMany<{ userId: string; currency: string; total: string }>();

  const fiByUserAndCurrency = await fiRepo
    .createQueryBuilder("fi")
    .select("fi.userId", "userId")
    .addSelect("fi.currency", "currency")
    .addSelect("SUM(fi.currentValueCents)", "total")
    .where("fi.userId IN (:...userIds)", { userIds })
    .groupBy("fi.userId, fi.currency")
    .getRawMany<{ userId: string; currency: string; total: string }>();

  const brlToUsdRate = await getBRLtoUSDRate();
  const usdToBrlRate = 1 / brlToUsdRate;

  for (const row of [...assetsByUserAndCurrency, ...fiByUserAndCurrency]) {
    const userId = Number(row.userId);
    const total = Number(row.total ?? 0);
    const totalBrl = row.currency === "USD" ? Math.round(total * usdToBrlRate) : total;
    result.set(userId, (result.get(userId) ?? 0) + totalBrl);
  }

  for (const userId of userIds) {
    if (!result.has(userId)) result.set(userId, 0);
  }

  return result;
}

export class ManagerDashboardService {
  constructor(
    private linkRepo: Repository<ManagerClientLink>,
    private historyRepo: Repository<ManagerClientHistory>,
    private userRepo: Repository<User>,
  ) {}

  async getDashboard({
    managerId,
    scope = "mine",
  }: {
    managerId: number;
    scope?: DashboardScope;
  }) {
    if (scope === "all") {
      return this.getAllInvestorsDashboard();
    }

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
      exchangeRate: await getExchangeRateField(),
    };
  }

  // scope "all" é admin-only (garantido no controller) — mesmas 5 métricas,
  // só o filtro muda: todo investidor da plataforma em vez de só os
  // vinculados ao admin. "Patrimônio inicial" passa a somar os ciclos ativos
  // de TODOS os gestores (não só os do admin) — investidor sem nenhum
  // vínculo/histórico entra com 0 aqui, então seu patrimônio atual conta
  // inteiro como "variação absoluta"; é uma simplificação aceitável já que
  // essa tela é mais de descoberta/gestão do que de rentabilidade.
  private async getAllInvestorsDashboard() {
    const investors = await this.userRepo.find({
      where: { role: UserRole.INVESTOR },
      select: ["id", "name"],
    });
    const investorIds = investors.map((investor) => investor.id!);

    const activeHistories = await this.historyRepo.find({
      where: { status: HistoryCycleStatus.ACTIVE },
    });
    const totalInitialWealthCents = activeHistories.reduce(
      (sum, h) => sum + Number(h.initialWealthCents),
      0,
    );

    const wealthByInvestor = await calculateInvestorWealthCentsBulk(investorIds);
    const totalWealthUnderManagementCents = Array.from(
      wealthByInvestor.values(),
    ).reduce((sum, v) => sum + v, 0);

    const absoluteVariationCents =
      totalWealthUnderManagementCents - totalInitialWealthCents;
    const percentageVariation =
      totalInitialWealthCents > 0
        ? Number(
            ((absoluteVariationCents / totalInitialWealthCents) * 100).toFixed(2),
          )
        : 0;

    const topInvestors = investors
      .map((investor) => ({
        investorId: investor.id!,
        name: investor.name,
        currentWealthCents: wealthByInvestor.get(investor.id!) ?? 0,
      }))
      .sort((a, b) => b.currentWealthCents - a.currentWealthCents)
      .slice(0, 5);

    return {
      activeClientsCount: investors.length,
      totalWealthUnderManagementCents,
      totalInitialWealthCents,
      absoluteVariationCents,
      percentageVariation,
      topInvestors,
      exchangeRate: await getExchangeRateField(),
    };
  }
}

export const managerDashboardService = new ManagerDashboardService(
  AppDataSource.getRepository(ManagerClientLink),
  AppDataSource.getRepository(ManagerClientHistory),
  AppDataSource.getRepository(User),
);
