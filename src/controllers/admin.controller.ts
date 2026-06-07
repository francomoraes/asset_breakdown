import { Request, Response } from "express";
import { roleManagementService } from "services/role-management.service";
import { ListUsersQueryDto, UpdateManagerClientLimitDto, UpdateUserRoleDto } from "dtos/manager.dto";
import { UserRole } from "enums/role.enum";
import { handleZodError } from "utils/handle-zod-error";
import { AppDataSource } from "config/data-source";
import { User } from "models/user";
import { ILike } from "typeorm";

export const listUsers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = ListUsersQueryDto.safeParse(req.query);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const { search, page, itemsPerPage } = result.data;
  const userRepo = AppDataSource.getRepository(User);

  const where = search
    ? [
        { name: ILike(`%${search}%`) },
        { email: ILike(`%${search}%`) },
      ]
    : {};

  const [users, total] = await userRepo.findAndCount({
    where,
    select: ["id", "name", "email", "role", "managerClientLimit"],
    order: { name: "ASC" },
    skip: (page - 1) * itemsPerPage,
    take: itemsPerPage,
  });

  res.json({ data: users, meta: { total, page, itemsPerPage } });
};

export const updateUserRole = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const targetUserId = Number(req.params.userId);

  const result = UpdateUserRoleDto.safeParse(req.body);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const user = await roleManagementService.updateRole({
    targetUserId,
    newRole: result.data.role as UserRole,
  });

  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
};

export const updateManagerClientLimit = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const managerId = Number(req.params.managerId);

  const result = UpdateManagerClientLimitDto.safeParse(req.body);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const user = await roleManagementService.updateClientLimit({
    managerId,
    limit: result.data.limit,
  });

  res.json({ user: { id: user.id, managerClientLimit: user.managerClientLimit } });
};
