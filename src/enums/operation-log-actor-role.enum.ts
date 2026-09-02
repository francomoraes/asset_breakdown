import { UserRole } from "enums/role.enum";

// "system" é exclusivo de gravações automáticas sem request HTTP (cronjob de
// patrimônio, decisão 4.7 de .docs/historico-de-operacoes.md) — union com
// UserRole em vez de um enum próprio pra aceitar req.user!.role direto nos
// controllers, sem cast (enums TS são nominais entre si).
export type OperationLogActorRole = UserRole | "system";

export const OPERATION_LOG_ACTOR_ROLES: OperationLogActorRole[] = [
  ...Object.values(UserRole),
  "system",
];
