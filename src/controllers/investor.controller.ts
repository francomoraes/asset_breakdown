import { Request, Response } from "express";
import { AppDataSource } from "config/data-source";
import { User } from "models/user";
import { ListManagersQueryDto } from "dtos/manager.dto";
import { getAuthenticatedUserId } from "utils/get-authenticated-user-id";
import { handleZodError } from "utils/handle-zod-error";
import { UserRole } from "enums/role.enum";
import { ILike, Not } from "typeorm";

export const listInvestors = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = ListManagersQueryDto.safeParse(req.query);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const callerId = getAuthenticatedUserId(req);
  const { search, page, itemsPerPage } = result.data;
  const userRepo = AppDataSource.getRepository(User);

  const where = search
    ? [
        { id: Not(callerId), role: UserRole.INVESTOR, name: ILike(`%${search}%`) },
        { id: Not(callerId), role: UserRole.INVESTOR, email: ILike(`%${search}%`) },
      ]
    : { id: Not(callerId), role: UserRole.INVESTOR };

  const [investors, total] = await userRepo.findAndCount({
    where,
    select: ["id", "name", "email", "role"],
    order: { name: "ASC" },
    skip: (page - 1) * itemsPerPage,
    take: itemsPerPage,
  });

  res.json({ data: investors, meta: { total, page, itemsPerPage } });
};
