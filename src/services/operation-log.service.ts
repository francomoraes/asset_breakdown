import { Repository } from "typeorm";
import { AppDataSource } from "config/data-source";
import { OperationLog } from "models/operation-log";
import { OperationLogAction } from "enums/operation-log-action.enum";
import { OperationLogActorRole } from "enums/operation-log-actor-role.enum";
import { PaginatedResponseDto } from "dtos/pagination.dto";
import { logger } from "utils/logger";

export class OperationLogService {
  constructor(private operationLogRepo: Repository<OperationLog>) {}

  async log({
    clientId,
    actorUserId,
    actorEmail,
    actorRole,
    action,
    entityType,
    entityId,
    beforeValue,
    afterValue,
  }: {
    clientId: number;
    actorUserId: number | null;
    actorEmail: string;
    actorRole: OperationLogActorRole;
    action: OperationLogAction;
    entityType?: string;
    entityId?: number;
    beforeValue?: Record<string, unknown>;
    afterValue?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const entry = this.operationLogRepo.create({
        clientId,
        actorUserId,
        actorEmail,
        actorRole,
        action,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        beforeValue: beforeValue ?? null,
        afterValue: afterValue ?? null,
      });
      await this.operationLogRepo.save(entry);
    } catch (error) {
      // Log é auditoria, não deve derrubar a operação principal que já foi
      // salva com sucesso (decisão 4.3 de .docs/historico-de-operacoes.md).
      logger.error("Falha ao gravar OperationLog", error);
    }
  }

  async getLogs({
    clientId,
    page = 1,
    itemsPerPage = 20,
    action,
  }: {
    clientId: number;
    page?: number;
    itemsPerPage?: number;
    action?: OperationLogAction;
  }): Promise<PaginatedResponseDto<OperationLog>> {
    const where = action ? { clientId, action } : { clientId };

    const totalItems = await this.operationLogRepo.count({ where });
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const validPage = Math.min(Math.max(page, 1), totalPages || 1);

    const data = await this.operationLogRepo.find({
      where,
      order: { createdAt: "DESC" },
      skip: (validPage - 1) * itemsPerPage,
      take: itemsPerPage,
    });

    return {
      data,
      meta: {
        totalItems,
        currentPage: validPage,
        itemsPerPage,
        totalPages,
        hasNextPage: validPage < totalPages,
        hasPreviousPage: validPage > 1,
      },
    };
  }
}

export const operationLogService = new OperationLogService(
  AppDataSource.getRepository(OperationLog),
);
