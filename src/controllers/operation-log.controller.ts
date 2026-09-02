import { Request, Response } from "express";
import { operationLogService } from "services/operation-log.service";
import { OperationLogListQueryDto } from "dtos/operation-log.dto";
import { getAuthenticatedUserId } from "utils/get-authenticated-user-id";
import { handleZodError } from "utils/handle-zod-error";

export const getMyOperationLogs = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const clientId = getAuthenticatedUserId(req);

  const result = OperationLogListQueryDto.safeParse(req.query);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const logs = await operationLogService.getLogs({ clientId, ...result.data });
  res.json(logs);
};
