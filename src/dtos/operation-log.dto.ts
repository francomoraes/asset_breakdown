import { z } from "zod";
import { OperationLogAction } from "enums/operation-log-action.enum";

export const OperationLogListQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  itemsPerPage: z.coerce.number().int().min(1).max(100).default(20),
  action: z.nativeEnum(OperationLogAction).optional(),
});
