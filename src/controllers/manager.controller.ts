import { Request, Response } from "express";
import { managerLinkService } from "services/manager-link.service";
import { managerDashboardService } from "services/manager-dashboard.service";
import { assetTypeService } from "services/asset-type.service";
import { summaryService } from "services/summary.service";
import {
  ListActiveClientsQueryDto,
  ListManagersQueryDto,
  UpdateAutonomyDto,
  UpdateTargetPercentageDto,
} from "dtos/manager.dto";
import { UserRole } from "enums/role.enum";
import { getAuthenticatedUserId } from "utils/get-authenticated-user-id";
import { getEffectiveUserId } from "utils/get-effective-user-id";
import { handleZodError } from "utils/handle-zod-error";
import { AppDataSource } from "config/data-source";
import { User } from "models/user";
import { AssetType } from "models/asset-type";
import { NotFoundError } from "errors/app-error";
import { ILike, Not } from "typeorm";

export const listManagers = async (
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

  const where: any[] = [
    { id: Not(callerId), role: UserRole.MANAGER, ...(search ? { name: ILike(`%${search}%`) } : {}) },
    { id: Not(callerId), role: UserRole.ADMIN, ...(search ? { name: ILike(`%${search}%`) } : {}) },
  ];

  if (search) {
    where.push(
      { id: Not(callerId), role: UserRole.MANAGER, email: ILike(`%${search}%`) },
      { id: Not(callerId), role: UserRole.ADMIN, email: ILike(`%${search}%`) },
    );
  }

  const [managers, total] = await userRepo.findAndCount({
    where,
    select: ["id", "name", "email", "role"],
    order: { name: "ASC" },
    skip: (page - 1) * itemsPerPage,
    take: itemsPerPage,
  });

  res.json({ data: managers, meta: { total, page, itemsPerPage } });
};

export const listActiveClients = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const managerId = getAuthenticatedUserId(req);

  const result = ListActiveClientsQueryDto.safeParse(req.query);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const { page, itemsPerPage, sortBy, order, search } = result.data;

  const response = await managerLinkService.getActiveClients({
    managerId,
    page,
    itemsPerPage,
    sortBy,
    order,
    search,
  });

  res.json(response);
};

export const getInvestorProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const investorId = getEffectiveUserId(req);
  const userRepo = AppDataSource.getRepository(User);
  const assetTypeRepo = AppDataSource.getRepository(AssetType);

  const user = await userRepo.findOne({
    where: { id: investorId },
    select: [
      "id",
      "name",
      "email",
      "locale",
      "profilePictureUrl",
      "selfServiceEnabled",
    ],
  });

  if (!user) {
    throw new NotFoundError("Investor not found", "NOT_FOUND");
  }

  const assetTypes = await assetTypeRepo.find({
    where: { userId: investorId },
  });

  res.json({
    user,
    assetTypes: assetTypes.map((t) => ({
      assetTypeId: t.id,
      assetTypeName: t.name,
      assetClassName: t.assetClass?.name ?? "",
      targetPercentage: Number(t.targetPercentage),
    })),
  });
};

export const getInvestorSummary = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getEffectiveUserId(req);
  const summary = await summaryService.getSummary({ userId });
  res.json(summary);
};

export const updateClientAutonomy = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const investorId = getEffectiveUserId(req);

  const result = UpdateAutonomyDto.safeParse(req.body);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: investorId } });

  if (!user) {
    throw new NotFoundError("Investor not found", "NOT_FOUND");
  }

  user.selfServiceEnabled = result.data.enabled;
  await userRepo.save(user);

  res.json({
    user: { id: user.id, selfServiceEnabled: user.selfServiceEnabled },
  });
};

export const updateInvestorTargetPercentage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getEffectiveUserId(req);
  const assetTypeId = Number(req.params.assetTypeId);

  const result = UpdateTargetPercentageDto.safeParse(req.body);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const assetType = await assetTypeService.updateTargetPercentage({
    userId,
    assetTypeId,
    targetPercentage: result.data.targetPercentage,
  });

  res.json({ assetType: { id: assetType.id, name: assetType.name, targetPercentage: assetType.targetPercentage } });
};

export const getDashboard = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const managerId = getAuthenticatedUserId(req);
  const dashboard = await managerDashboardService.getDashboard({ managerId });
  res.json(dashboard);
};
