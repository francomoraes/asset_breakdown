import { z } from "zod";

export const UpdateUserRoleDto = z.object({
  role: z.enum(["investor", "manager", "admin"]),
});

export const UpdateManagerClientLimitDto = z.object({
  limit: z.number().int().min(1).max(500),
});

export const CreateLinkDto = z.object({
  managerId: z.number().int().positive(),
});

export const ListManagersQueryDto = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  itemsPerPage: z.coerce.number().int().min(1).max(100).default(20),
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
  sortBy: z.enum(["name", "activatedAt"]).default("name"),
  order: z.enum(["ASC", "DESC"]).default("ASC"),
});

export const UpdateTargetPercentageDto = z.object({
  targetPercentage: z.number().min(0).max(100),
});
