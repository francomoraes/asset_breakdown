import { AppDataSource } from "../config/data-source";
import { NotFoundError, ConflictError } from "../errors/app-error";
import { WealthHistory } from "../models/wealth-history";
import { Repository } from "typeorm";

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
    date: Date,
    totalWealthCents: number,
  ): Promise<WealthHistory> {
    // Check if entry already exists for this date
    const existing = await this.wealthHistoryRepo.findOne({
      where: {
        userId,
        date: this.normalizeDate(date),
      },
    });

    if (existing) {
      throw new ConflictError(
        `Já existe um registro de patrimônio para a data ${date.toLocaleDateString(
          "pt-BR",
        )}`,
      );
    }

    const wealthHistory = this.wealthHistoryRepo.create({
      userId,
      date: this.normalizeDate(date),
      totalWealthCents,
    });

    return await this.wealthHistoryRepo.save(wealthHistory);
  }

  async updateWealthHistory(
    userId: number,
    id: number,
    updates: { date?: Date; totalWealthCents?: number },
  ): Promise<WealthHistory> {
    const wealthHistory = await this.wealthHistoryRepo.findOne({
      where: { id, userId },
    });

    if (!wealthHistory) {
      throw new NotFoundError("Registro de patrimônio não encontrado");
    }

    if (updates.date) {
      const normalizedDate = this.normalizeDate(updates.date);
      const existing = await this.wealthHistoryRepo.findOne({
        where: {
          userId,
          date: normalizedDate,
          id: { $ne: id } as any,
        } as any,
      });

      if (existing) {
        throw new ConflictError(
          `Já existe um registro de patrimônio para a data ${normalizedDate.toLocaleDateString(
            "pt-BR",
          )}`,
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
      throw new NotFoundError("Registro de patrimônio não encontrado");
    }

    await this.wealthHistoryRepo.remove(wealthHistory);
  }

  async saveMonthlyWealthSnapshot(
    userId: number,
    totalWealthCents: number,
  ): Promise<void> {
    const today = new Date();
    const beginningOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

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

  private normalizeDate(date: Date): Date {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
}

export const wealthHistoryService = new WealthHistoryService(
  AppDataSource.getRepository(WealthHistory),
);
