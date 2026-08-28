import { z } from "zod";
import { passwordSchema } from "./auth.dto";
import { RiskProfile } from "enums/risk-profile.enum";

export const CreateUserDto = z
  .object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: passwordSchema,
    role: z.enum(["investor", "manager", "admin"]),
  })
  .strict();

export const UpdateUserRoleDto = z.object({
  role: z.enum(["investor", "manager", "admin"]),
});

export const UpdateManagerClientLimitDto = z.object({
  limit: z.number().int().min(1).max(500),
});

export const CreateLinkDto = z.object({
  investorId: z.number().int().positive(),
  managerId: z.number().int().positive().optional(),
});

export const ListManagersQueryDto = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  itemsPerPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const ListInvestorsQueryDto = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  itemsPerPage: z.coerce.number().int().min(1).max(100).default(20),
  excludeManagerId: z.coerce.number().int().positive().optional(),
});

export const ListUsersQueryDto = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  itemsPerPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const ListActiveClientsQueryDto = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  itemsPerPage: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(["name", "activatedAt", "wealth", "adherenceIndex", "monthlyVariation"])
    .default("name"),
  order: z.enum(["ASC", "DESC"]).default("ASC"),
  // "all" só tem efeito quando o caller é admin (forçado de volta pra "mine"
  // no controller pra qualquer outro role) — lista todo investidor da
  // plataforma, não só os vinculados ao caller.
  scope: z.enum(["mine", "all"]).default("mine"),
  // z.coerce.boolean() faz Boolean(valor) — "false" (string) é truthy e
  // viraria true, quebrando o filtro sempre que o parâmetro está presente
  // na query (que é sempre, já que o front manda o valor mesmo quando false).
  activeOnly: z.preprocess(
    (v) => (typeof v === "string" ? v === "true" : v),
    z.boolean().default(false),
  ),
});

export const GetDashboardQueryDto = z.object({
  // "all" só tem efeito quando o caller é admin (forçado de volta pra "mine"
  // no controller pra qualquer outro role), mesma regra de ListActiveClientsQueryDto.
  scope: z.enum(["mine", "all"]).default("mine"),
});

export const UpdateTargetPercentageDto = z.object({
  targetPercentage: z.number().min(0).max(100),
});

export const UpdateAutonomyDto = z.object({
  enabled: z.boolean(),
});

export const UpdateRiskProfileDto = z.object({
  riskProfile: z.nativeEnum(RiskProfile),
});
