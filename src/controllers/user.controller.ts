import { Request, Response } from "express";
import { roleManagementService } from "services/role-management.service";
import { CreateUserDto } from "dtos/manager.dto";
import { UserRole } from "enums/role.enum";
import { handleZodError } from "utils/handle-zod-error";

export const createUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = CreateUserDto.safeParse(req.body);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const user = await roleManagementService.createUser({
    creatorRole: req.user!.role,
    ...result.data,
    role: result.data.role as UserRole,
  });

  res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
};
