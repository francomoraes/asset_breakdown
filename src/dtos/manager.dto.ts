import { z } from "zod";
import { passwordSchema } from "./auth.dto";

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
  targetUserId: z.number().int().positive(),
  asRole: z.enum(["investor", "manager"]),
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
