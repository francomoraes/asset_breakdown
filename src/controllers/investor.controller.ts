import { Request, Response } from "express";
import { AppDataSource } from "config/data-source";
import { User } from "models/user";
import { ManagerClientLink, LinkStatus } from "models/manager-client-link";
import { ListInvestorsQueryDto } from "dtos/manager.dto";
import { getAuthenticatedUserId } from "utils/get-authenticated-user-id";
import { handleZodError } from "utils/handle-zod-error";
import { UserRole } from "enums/role.enum";
import { And, ILike, In, Not } from "typeorm";

export const listInvestors = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = ListInvestorsQueryDto.safeParse(req.query);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const callerId = getAuthenticatedUserId(req);
  const callerRole = req.user!.role;
  const { search, page, itemsPerPage, excludeManagerId } = result.data;
  const userRepo = AppDataSource.getRepository(User);
  const linkRepo = AppDataSource.getRepository(ManagerClientLink);

  // Manager só pode filtrar contra si mesmo (é o único vínculo que ele pode
  // criar); admin escolhe o gestor-alvo explicitamente via query param.
  const effectiveExcludeManagerId =
    callerRole === UserRole.ADMIN ? excludeManagerId : callerId;

  let excludedInvestorIds: number[] = [];
  if (effectiveExcludeManagerId) {
    const linkedRows = await linkRepo.find({
      where: { managerId: effectiveExcludeManagerId, status: LinkStatus.ACTIVE },
      select: ["investorId"],
    });
    excludedInvestorIds = linkedRows.map((l) => l.investorId);
  }

  const idFilter = excludedInvestorIds.length
    ? And(Not(callerId), Not(In(excludedInvestorIds)))
    : Not(callerId);

  const where = search
    ? [
        { id: idFilter, role: UserRole.INVESTOR, name: ILike(`%${search}%`) },
        { id: idFilter, role: UserRole.INVESTOR, email: ILike(`%${search}%`) },
      ]
    : { id: idFilter, role: UserRole.INVESTOR };

  const [investors, total] = await userRepo.findAndCount({
    where,
    select: ["id", "name", "email", "role"],
    order: { name: "ASC" },
    skip: (page - 1) * itemsPerPage,
    take: itemsPerPage,
  });

  const investorIds = investors.map((i) => i.id);
  const activeLinks = investorIds.length
    ? await linkRepo.find({
        where: { investorId: In(investorIds), status: LinkStatus.ACTIVE },
        relations: ["manager"],
      })
    : [];

  const managersByInvestor = new Map<
    number,
    { id: number; name: string; email: string }[]
  >();
  for (const link of activeLinks) {
    const list = managersByInvestor.get(link.investorId) ?? [];
    list.push({
      id: link.manager.id!,
      name: link.manager.name,
      email: link.manager.email,
    });
    managersByInvestor.set(link.investorId, list);
  }

  const data = investors.map((investor) => ({
    id: investor.id!,
    name: investor.name,
    email: investor.email,
    role: investor.role,
    currentManagers: managersByInvestor.get(investor.id!) ?? [],
  }));

  res.json({ data, meta: { total, page, itemsPerPage } });
};
