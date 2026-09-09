import { AppDataSource } from "../config/data-source";
import { Asset } from "../models/asset";
import { FixedIncomeAsset } from "../models/fixed-income-asset";
import { AssetTransaction } from "../models/asset-transaction";
import { AssetType } from "../models/asset-type";
import {
  ManagerClientHistory,
  HistoryCycleStatus,
} from "../models/manager-client-history";
import { In, Repository } from "typeorm";
import { getBRLtoUSDRate } from "../utils/get-brl-to-usd-rate";
import { fixedIncomeAssetService } from "./fixed-income-asset.service";

type AdherenceByType = {
  assetTypeId: number;
  assetTypeName: string;
  assetClassId: number;
  assetClassName: string;
  targetPercentage: number;
  actualPercentage: number;
  deviationPp: number;
};

type AdherenceByClass = {
  assetClassId: number;
  assetClassName: string;
  targetPercentage: number;
  actualPercentage: number;
  deviationPp: number;
};

export type AdherenceResult = {
  byType: AdherenceByType[];
  byClass: AdherenceByClass[];
  totalPp: number | null;
};

export class SummaryService {
  constructor(
    private assetRepo: Repository<Asset>,
    private fixedIncomeRepo: Repository<FixedIncomeAsset>,
    private transactionRepo: Repository<AssetTransaction>,
    private assetTypeRepo: Repository<AssetType>,
    private managerClientHistoryRepo: Repository<ManagerClientHistory>,
  ) {}

  async getCashFlow({
    userId,
    usdToBrlRate,
  }: {
    userId: number;
    usdToBrlRate: number;
  }) {
    // Join com Asset só para ler a moeda de cada transação (AssetTransaction não
    // denormaliza currency) — sem isso, compra em USD e venda em BRL seriam
    // somadas como se fossem a mesma unidade.
    const totals = await this.transactionRepo
      .createQueryBuilder("t")
      .innerJoin("t.asset", "asset")
      .select("t.type", "type")
      .addSelect("asset.currency", "currency")
      .addSelect("SUM(t.totalAmountCents)", "total")
      .where("t.userId = :userId", { userId })
      .groupBy("t.type")
      .addGroupBy("asset.currency")
      .getRawMany();

    const sumInBRL = (type: string) =>
      totals
        .filter((r) => r.type === type)
        .reduce((acc, r) => {
          const totalCents = Number(r.total);
          const totalBRL =
            r.currency === "USD"
              ? Math.round(totalCents * usdToBrlRate)
              : totalCents;
          return acc + totalBRL;
        }, 0);

    return {
      totalPurchasesCents: sumInBRL("buy"),
      totalDividendsCents: sumInBRL("dividend"),
    };
  }

  private async getInitialWealth({
    userId,
    actingManagerId,
    currentTotalCents,
  }: {
    userId: number;
    actingManagerId?: number;
    currentTotalCents: number;
  }) {
    if (!actingManagerId) {
      return {
        initialWealthCents: null,
        absoluteVariationCents: null,
        percentageVariation: null,
      };
    }

    const activeHistory = await this.managerClientHistoryRepo.findOne({
      where: {
        investorId: userId,
        managerId: actingManagerId,
        status: HistoryCycleStatus.ACTIVE,
      },
    });

    if (!activeHistory) {
      return {
        initialWealthCents: null,
        absoluteVariationCents: null,
        percentageVariation: null,
      };
    }

    const initialWealthCents = Number(activeHistory.initialWealthCents);
    const absoluteVariationCents = currentTotalCents - initialWealthCents;
    const percentageVariation =
      initialWealthCents > 0
        ? Number(((absoluteVariationCents / initialWealthCents) * 100).toFixed(2))
        : 0;

    return { initialWealthCents, absoluteVariationCents, percentageVariation };
  }

  async getSummary({
    userId,
    actingManagerId,
  }: {
    userId: number;
    actingManagerId?: number;
  }) {
    await fixedIncomeAssetService.refreshValues(userId);

    // Taxa de câmbio buscada antes de agregar — total e actualPercentage
    // precisam converter posições em USD pra BRL antes de somar, senão cents
    // de moedas diferentes são somados como se fossem a mesma unidade (bug
    // histórico, corrigido aqui).
    const brlToUsdRate = await getBRLtoUSDRate();
    const usdToBrlRate = 1 / brlToUsdRate;

    // Buscar summary de Assets regulares
    const rawSummary = await this.assetRepo
      .createQueryBuilder("asset")
      .leftJoin("asset.type", "type")
      .leftJoin("type.assetClass", "class")
      .select([
        `class.name AS "assetClassName"`,
        `type.name AS "assetTypeName"`,
        `asset.currency AS "currency"`,
        `SUM(asset.currentValueCents) AS "totalValueCents"`,
        `SUM(asset.resultCents) AS "totalResultCents"`,
        `type.targetPercentage AS "targetPercentage"`,
      ])
      .where("asset.userId = :userId", { userId })
      .groupBy("class.name, type.name, asset.currency, type.targetPercentage")
      .getRawMany();

    // Buscar summary de Fixed Income Assets
    const rawFixedIncomeSummary = await this.fixedIncomeRepo
      .createQueryBuilder("fixedIncome")
      .leftJoin("fixedIncome.type", "type")
      .leftJoin("type.assetClass", "class")
      .select([
        `class.name AS "assetClassName"`,
        `type.name AS "assetTypeName"`,
        `fixedIncome.currency AS "currency"`,
        `SUM(fixedIncome.currentValueCents) AS "totalValueCents"`,
        `SUM(fixedIncome.resultCents) AS "totalResultCents"`,
        `type.targetPercentage AS "targetPercentage"`,
      ])
      .where("fixedIncome.userId = :userId", { userId })
      .groupBy(
        "class.name, type.name, fixedIncome.currency, type.targetPercentage",
      )
      .getRawMany();

    // Combinar ambos os resultados
    const combinedSummary = [...rawSummary, ...rawFixedIncomeSummary];

    // Agrupar por classe/tipo/moeda (caso haja duplicatas)
    const groupedMap = new Map<string, any>();
    for (const item of combinedSummary) {
      const key = `${item.assetClassName}|${item.assetTypeName}|${item.currency}`;
      if (groupedMap.has(key)) {
        const existing = groupedMap.get(key);
        existing.totalValueCents =
          Number(existing.totalValueCents) + Number(item.totalValueCents);
        existing.totalResultCents =
          Number(existing.totalResultCents) + Number(item.totalResultCents);
      } else {
        groupedMap.set(key, { ...item });
      }
    }

    const mergedSummary = Array.from(groupedMap.values());

    // Total em BRL — cada linha convertida antes de somar (ver comentário acima).
    const total = mergedSummary.reduce((acc, item) => {
      const cents = Number(item.totalValueCents);
      const brlCents =
        item.currency === "USD" ? Math.round(cents * usdToBrlRate) : cents;
      return acc + brlCents;
    }, 0);

    const summary = mergedSummary.map((item) => {
      const cents = Number(item.totalValueCents);
      const brlCents =
        item.currency === "USD" ? Math.round(cents * usdToBrlRate) : cents;
      const actualPercentage =
        total > 0 ? Number((brlCents / total).toFixed(4)) : 0;

      return {
        ...item,
        totalValueCents: cents,
        totalResultCents: Number(item.totalResultCents),
        targetPercentage: Number(item.targetPercentage),
        actualPercentage,
      };
    });

    const totalPnlCents = summary.reduce((acc, item) => {
      const resultBRL =
        item.currency === "USD"
          ? Math.round(item.totalResultCents * usdToBrlRate)
          : item.totalResultCents;
      return acc + resultBRL;
    }, 0);

    const cashFlow = await this.getCashFlow({ userId, usdToBrlRate });
    const adherence = await this.getAdherence(userId, usdToBrlRate);
    const initialWealth = await this.getInitialWealth({
      userId,
      actingManagerId,
      currentTotalCents: total,
    });

    return {
      data: summary,
      exchangeRate: {
        usdToBrl: Number(usdToBrlRate.toFixed(4)),
        brlToUsd: Number(brlToUsdRate.toFixed(4)),
      },
      totalPnlCents,
      cashFlow,
      adherence,
      ...initialWealth,
    };
  }

  async getAdherence(
    userId: number,
    usdToBrlRate: number,
  ): Promise<AdherenceResult> {
    const types = await this.assetTypeRepo.find({ where: { userId } });

    if (types.length === 0) {
      return { byType: [], byClass: [], totalPp: null };
    }

    const valueByUserAndType = await this.getAllocationByTypeId(
      [userId],
      usdToBrlRate,
    );

    return this.buildAdherence(types, valueByUserAndType.get(userId) ?? new Map());
  }

  async getAdherenceBulk(
    userIds: number[],
    usdToBrlRate: number,
  ): Promise<Map<number, number | null>> {
    const result = new Map<number, number | null>();
    if (userIds.length === 0) return result;

    const types = await this.assetTypeRepo.find({
      where: { userId: In(userIds) },
    });

    const typesByUser = new Map<number, AssetType[]>();
    for (const type of types) {
      const list = typesByUser.get(type.userId) ?? [];
      list.push(type);
      typesByUser.set(type.userId, list);
    }

    const valueByUserAndType = await this.getAllocationByTypeId(
      userIds,
      usdToBrlRate,
    );

    for (const userId of userIds) {
      const userTypes = typesByUser.get(userId) ?? [];
      if (userTypes.length === 0) {
        result.set(userId, null);
        continue;
      }
      const { totalPp } = this.buildAdherence(
        userTypes,
        valueByUserAndType.get(userId) ?? new Map(),
      );
      result.set(userId, totalPp);
    }

    return result;
  }

  // Alocação real por AssetType, já convertida pra BRL, agrupada por usuário —
  // reaproveitada tanto pelo detalhe (um userId) quanto pela lista de clientes
  // (vários userIds de uma vez, decisão 4.3 da spec). Não chama refreshValues:
  // isso é responsabilidade de quem chama (getSummary já chamou; getAdherenceBulk
  // espera que o caller tenha chamado uma vez por userId antes, decisão 4.6).
  private async getAllocationByTypeId(
    userIds: number[],
    usdToBrlRate: number,
  ): Promise<Map<number, Map<number, number>>> {
    const rawAsset = await this.assetRepo
      .createQueryBuilder("asset")
      .leftJoin("asset.type", "type")
      .select("asset.userId", "userId")
      .addSelect("type.id", "typeId")
      .addSelect("asset.currency", "currency")
      .addSelect("SUM(asset.currentValueCents)", "cents")
      .where("asset.userId IN (:...userIds)", { userIds })
      .groupBy("asset.userId, type.id, asset.currency")
      .getRawMany();

    const rawFixedIncome = await this.fixedIncomeRepo
      .createQueryBuilder("fixedIncome")
      .leftJoin("fixedIncome.type", "type")
      .select("fixedIncome.userId", "userId")
      .addSelect("type.id", "typeId")
      .addSelect("fixedIncome.currency", "currency")
      .addSelect("SUM(fixedIncome.currentValueCents)", "cents")
      .where("fixedIncome.userId IN (:...userIds)", { userIds })
      .groupBy("fixedIncome.userId, type.id, fixedIncome.currency")
      .getRawMany();

    const result = new Map<number, Map<number, number>>();
    for (const row of [...rawAsset, ...rawFixedIncome]) {
      const userId = Number(row.userId);
      const typeId = Number(row.typeId);
      const cents = Number(row.cents);
      const brlCents =
        row.currency === "USD" ? Math.round(cents * usdToBrlRate) : cents;

      const userMap = result.get(userId) ?? new Map<number, number>();
      userMap.set(typeId, (userMap.get(typeId) ?? 0) + brlCents);
      result.set(userId, userMap);
    }

    return result;
  }

  private buildAdherence(
    types: AssetType[],
    valueByTypeId: Map<number, number>,
  ): AdherenceResult {
    const totalBRL = Array.from(valueByTypeId.values()).reduce(
      (acc, v) => acc + v,
      0,
    );

    const byType: AdherenceByType[] = types.map((type) => {
      const actualValueBRL = valueByTypeId.get(type.id!) ?? 0;
      const actualPercentage = totalBRL > 0 ? actualValueBRL / totalBRL : 0;
      const targetPercentage = Number(type.targetPercentage);
      const deviationPp = Math.abs(
        actualPercentage * 100 - targetPercentage * 100,
      );

      return {
        assetTypeId: type.id!,
        assetTypeName: type.name,
        assetClassId: type.assetClass.id!,
        assetClassName: type.assetClass.name,
        targetPercentage,
        actualPercentage: Number(actualPercentage.toFixed(4)),
        deviationPp: Number(deviationPp.toFixed(2)),
      };
    });

    const byClassMap = new Map<number, AdherenceByClass>();
    for (const t of byType) {
      const existing = byClassMap.get(t.assetClassId);
      if (existing) {
        existing.targetPercentage += t.targetPercentage;
        existing.actualPercentage += t.actualPercentage;
      } else {
        byClassMap.set(t.assetClassId, {
          assetClassId: t.assetClassId,
          assetClassName: t.assetClassName,
          targetPercentage: t.targetPercentage,
          actualPercentage: t.actualPercentage,
          deviationPp: 0,
        });
      }
    }

    // Desvio da classe vem do target/actual já agregados (não da soma dos
    // desvios de cada tipo) — tipos com desvios em direções opostas dentro
    // da mesma classe se cancelam no nível da classe, então somar em módulo
    // superestimava o desvio exibido (ex.: meta 62%, real 61.9%, mas
    // aparecia 0.6pp em vez de 0.1pp).
    const byClass = Array.from(byClassMap.values()).map((c) => ({
      ...c,
      deviationPp: Number(
        Math.abs(c.actualPercentage * 100 - c.targetPercentage * 100).toFixed(2),
      ),
    }));

    const totalPp = Number(
      byType.reduce((acc, t) => acc + t.deviationPp, 0).toFixed(2),
    );

    return { byType, byClass, totalPp };
  }

  async getOverviewByCurrency({ userId }: { userId: number }) {
    await fixedIncomeAssetService.refreshValues(userId);

    // Buscar assets regulares
    const rawResult = await this.assetRepo
      .createQueryBuilder("asset")
      .select(`asset.currency`, "currency")
      .addSelect(`SUM(asset.currentValueCents)`, `totalCents`)
      .where("asset.userId = :userId", { userId })
      .groupBy("asset.currency")
      .getRawMany();

    // Buscar fixed income assets
    const rawFixedIncomeResult = await this.fixedIncomeRepo
      .createQueryBuilder("fixedIncome")
      .select(`fixedIncome.currency`, "currency")
      .addSelect(`SUM(fixedIncome.currentValueCents)`, `totalCents`)
      .where("fixedIncome.userId = :userId", { userId })
      .groupBy("fixedIncome.currency")
      .getRawMany();

    // Combinar e agrupar por moeda
    const combinedByCurrency = new Map<string, number>();
    [...rawResult, ...rawFixedIncomeResult].forEach((row) => {
      const currency = row.currency;
      const amount = Number(row.totalCents);
      combinedByCurrency.set(
        currency,
        (combinedByCurrency.get(currency) || 0) + amount,
      );
    });

    const mergedResult = Array.from(combinedByCurrency.entries()).map(
      ([currency, totalCents]) => ({ currency, totalCents }),
    );

    const brlToUsdRate = await getBRLtoUSDRate();

    const converted = mergedResult.map((row) => {
      const totalCents = row.totalCents;
      const currency = row.currency;

      const totalInUSD =
        currency === "USD" ? totalCents : Math.round(totalCents * brlToUsdRate);

      return {
        currency,
        totalCents,
        totalInUSD,
      };
    });

    const totalPortfolioInUSD = converted.reduce(
      (acc, row) => acc + row.totalInUSD,
      0,
    );

    const withPercentages = converted.map((row) => ({
      currency: row.currency,
      totalCents: row.totalCents,
      percentage:
        totalPortfolioInUSD > 0
          ? Number((row.totalInUSD / totalPortfolioInUSD).toFixed(4))
          : 0,
      totalInUSD: row.totalInUSD,
    }));

    return withPercentages;
  }
}

export const summaryService = new SummaryService(
  AppDataSource.getRepository(Asset),
  AppDataSource.getRepository(FixedIncomeAsset),
  AppDataSource.getRepository(AssetTransaction),
  AppDataSource.getRepository(AssetType),
  AppDataSource.getRepository(ManagerClientHistory),
);
