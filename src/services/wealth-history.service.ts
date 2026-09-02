import { AppDataSource } from "../config/data-source";
import { NotFoundError, ConflictError } from "../errors/app-error";
import { WealthHistory } from "../models/wealth-history";
import { In, Repository } from "typeorm";
import { normalizeDate } from "../utils/normalize-date";
import { operationLogService } from "./operation-log.service";
import { OperationLogAction } from "enums/operation-log-action.enum";
import { OperationLogActorRole } from "enums/operation-log-actor-role.enum";

function formatDateBR(isoDate: string): string {
  return isoDate.split("-").reverse().join("/");
}

export type WealthHistoryActor = {
  userId: number | null;
  email: string;
  role: OperationLogActorRole;
};

export class WealthHistoryService {
  constructor(private wealthHistoryRepo: Repository<WealthHistory>) {}

  async getWealthHistoryByUser(userId: number): Promise<WealthHistory[]> {
    const history = await this.wealthHistoryRepo.find({
      where: { userId },
      order: { date: "ASC" },
    });

    return history;
  }

  async getWealthHistoryByUserAndDateRange(
    userId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<WealthHistory[]> {
    const history = await this.wealthHistoryRepo.find({
      where: {
        userId,
        date: {
          $gte: startDate,
          $lte: endDate,
        } as any,
      },
      order: { date: "ASC" },
    });

    return history;
  }

  async createWealthHistory(
    userId: number,
    date: Date | string,
    totalWealthCents: number,
    actor: WealthHistoryActor,
  ): Promise<WealthHistory> {
    const normalizedDate = normalizeDate(date);

    // Check if entry already exists for this date
    const existing = await this.wealthHistoryRepo.findOne({
      where: {
        userId,
        date: normalizedDate,
      },
    });

    if (existing) {
      throw new ConflictError(
        `Já existe um registro de patrimônio para a data ${formatDateBR(normalizedDate)}`,
        "WEALTH_HISTORY_DATE_CONFLICT",
      );
    }

    const wealthHistory = this.wealthHistoryRepo.create({
      userId,
      date: normalizedDate,
      totalWealthCents,
    });

    const saved = await this.wealthHistoryRepo.save(wealthHistory);

    await operationLogService.log({
      clientId: userId,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: OperationLogAction.WEALTH_HISTORY_CREATED,
      entityType: "WealthHistory",
      entityId: saved.id,
      afterValue: {
        date: saved.date,
        totalWealthCents: Number(saved.totalWealthCents),
      },
    });

    return saved;
  }

  async updateWealthHistory(
    userId: number,
    id: number,
    updates: { date?: Date | string; totalWealthCents?: number },
    actor: WealthHistoryActor,
  ): Promise<WealthHistory> {
    const wealthHistory = await this.wealthHistoryRepo.findOne({
      where: { id, userId },
    });

    if (!wealthHistory) {
      throw new NotFoundError(
        "Registro de patrimônio não encontrado",
        "WEALTH_HISTORY_NOT_FOUND",
      );
    }

    const before = {
      date: wealthHistory.date,
      totalWealthCents: Number(wealthHistory.totalWealthCents),
    };

    if (updates.date) {
      const normalizedDate = normalizeDate(updates.date);
      const existing = await this.wealthHistoryRepo.findOne({
        where: {
          userId,
          date: normalizedDate,
          id: { $ne: id } as any,
        } as any,
      });

      if (existing) {
        throw new ConflictError(
          `Já existe um registro de patrimônio para a data ${formatDateBR(normalizedDate)}`,
          "WEALTH_HISTORY_DATE_CONFLICT",
        );
      }

      wealthHistory.date = normalizedDate;
    }

    if (updates.totalWealthCents !== undefined) {
      wealthHistory.totalWealthCents = updates.totalWealthCents;
    }

    const saved = await this.wealthHistoryRepo.save(wealthHistory);

    await operationLogService.log({
      clientId: userId,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: OperationLogAction.WEALTH_HISTORY_UPDATED,
      entityType: "WealthHistory",
      entityId: saved.id,
      beforeValue: before,
      afterValue: {
        date: saved.date,
        totalWealthCents: Number(saved.totalWealthCents),
      },
    });

    return saved;
  }

  async deleteWealthHistory(
    userId: number,
    id: number,
    actor: WealthHistoryActor,
  ): Promise<void> {
    const wealthHistory = await this.wealthHistoryRepo.findOne({
      where: { id, userId },
    });

    if (!wealthHistory) {
      throw new NotFoundError(
        "Registro de patrimônio não encontrado",
        "WEALTH_HISTORY_NOT_FOUND",
      );
    }

    await this.wealthHistoryRepo.remove(wealthHistory);

    await operationLogService.log({
      clientId: userId,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: OperationLogAction.WEALTH_HISTORY_DELETED,
      entityType: "WealthHistory",
      entityId: id,
      beforeValue: {
        date: wealthHistory.date,
        totalWealthCents: Number(wealthHistory.totalWealthCents),
      },
    });
  }

  async saveMonthlyWealthSnapshot(
    userId: number,
    totalWealthCents: number,
    actor: WealthHistoryActor,
  ): Promise<void> {
    const today = new Date();
    const beginningOfMonth = normalizeDate(
      new Date(today.getFullYear(), today.getMonth(), 1),
    );

    const existing = await this.wealthHistoryRepo.findOne({
      where: {
        userId,
        date: beginningOfMonth,
      },
    });

    if (!existing) {
      await this.createWealthHistory(
        userId,
        beginningOfMonth,
        totalWealthCents,
        actor,
      );
    }
  }

  // Variação mensal = patrimônio atual (já calculado pelo caller, com cotação
  // real) vs. o snapshot do início do mês corrente em WealthHistory (gravado
  // pelo cron mensal). null quando ainda não existe snapshot deste mês
  // (cliente recém-vinculado) — diferente de 0%, que é uma variação real.
  async getMonthlyVariationBulk(
    userIds: number[],
    currentWealthByUser: Map<number, number>,
  ): Promise<Map<number, number | null>> {
    const result = new Map<number, number | null>();
    if (userIds.length === 0) return result;

    const today = new Date();
    const beginningOfMonth = normalizeDate(
      new Date(today.getFullYear(), today.getMonth(), 1),
    );

    const snapshots = await this.wealthHistoryRepo.find({
      where: { userId: In(userIds), date: beginningOfMonth },
    });

    const snapshotByUser = new Map<number, number>();
    for (const snapshot of snapshots) {
      snapshotByUser.set(snapshot.userId, Number(snapshot.totalWealthCents));
    }

    for (const userId of userIds) {
      const previousWealthCents = snapshotByUser.get(userId);
      if (previousWealthCents === undefined) {
        result.set(userId, null);
        continue;
      }
      if (previousWealthCents === 0) {
        result.set(userId, 0);
        continue;
      }
      const currentWealthCents = currentWealthByUser.get(userId) ?? 0;
      const percentageVariation =
        ((currentWealthCents - previousWealthCents) / previousWealthCents) * 100;
      result.set(userId, Number(percentageVariation.toFixed(2)));
    }

    return result;
  }

}

export const wealthHistoryService = new WealthHistoryService(
  AppDataSource.getRepository(WealthHistory),
);
