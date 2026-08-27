import { AppDataSource } from "../config/data-source";
import { NotFoundError, ConflictError } from "../errors/app-error";
import { WealthHistory } from "../models/wealth-history";
import { Repository } from "typeorm";
import { normalizeDate } from "../utils/normalize-date";

function formatDateBR(isoDate: string): string {
  return isoDate.split("-").reverse().join("/");
}

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

    return await this.wealthHistoryRepo.save(wealthHistory);
  }

  async updateWealthHistory(
    userId: number,
    id: number,
    updates: { date?: Date | string; totalWealthCents?: number },
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

    return await this.wealthHistoryRepo.save(wealthHistory);
  }

  async deleteWealthHistory(userId: number, id: number): Promise<void> {
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
  }

  async saveMonthlyWealthSnapshot(
    userId: number,
    totalWealthCents: number,
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
      );
    }
  }

}

export const wealthHistoryService = new WealthHistoryService(
  AppDataSource.getRepository(WealthHistory),
);
