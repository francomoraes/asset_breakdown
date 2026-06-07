import { Repository } from "typeorm";
import { AppDataSource } from "config/data-source";
import { ManagerClientHistory } from "models/manager-client-history";

export class ManagerHistoryService {
  constructor(private historyRepo: Repository<ManagerClientHistory>) {}

  async getInvestorHistory({ investorId }: { investorId: number }) {
    const histories = await this.historyRepo.find({
      where: { investorId },
      relations: ["manager"],
      order: { cycleStartAt: "DESC" },
    });

    return histories.map((h) => ({
      managerId: h.managerId,
      managerName: h.manager.name,
      status: h.status,
      cycleStartAt: h.cycleStartAt,
      cycleEndAt: h.cycleEndAt,
      initialWealthCents: Number(h.initialWealthCents),
      currentWealthCents:
        h.currentWealthCents !== null ? Number(h.currentWealthCents) : null,
      finalWealthCents:
        h.finalWealthCents !== null ? Number(h.finalWealthCents) : null,
    }));
  }
}

export const managerHistoryService = new ManagerHistoryService(
  AppDataSource.getRepository(ManagerClientHistory),
);
