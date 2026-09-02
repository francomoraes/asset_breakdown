import { Request, Response } from "express";
import { managerLinkService } from "services/manager-link.service";
import { managerDashboardService } from "services/manager-dashboard.service";
import { assetTypeService } from "services/asset-type.service";
import { summaryService } from "services/summary.service";
import {
  GetDashboardQueryDto,
  ListActiveClientsQueryDto,
  ListManagersQueryDto,
  UpdateAutonomyDto,
  UpdateRiskProfileDto,
  UpdateTargetPercentageDto,
} from "dtos/manager.dto";
import { OperationLogListQueryDto } from "dtos/operation-log.dto";
import { UserRole } from "enums/role.enum";
import { getAuthenticatedUserId } from "utils/get-authenticated-user-id";
import { getEffectiveUserId } from "utils/get-effective-user-id";
import { handleZodError } from "utils/handle-zod-error";
import { AppDataSource } from "config/data-source";
import { User } from "models/user";
import { AssetType } from "models/asset-type";
import { NotFoundError } from "errors/app-error";
import { ILike, Not } from "typeorm";
import { operationLogService } from "services/operation-log.service";
import { managerHistoryService } from "services/manager-history.service";
import { OperationLogAction } from "enums/operation-log-action.enum";

export const listManagers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = ListManagersQueryDto.safeParse(req.query);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const callerId = getAuthenticatedUserId(req);
  const callerRole = req.user!.role;
  const { search, page, itemsPerPage } = result.data;
  const userRepo = AppDataSource.getRepository(User);

  // Admin pode se atribuir clientes ("gestor global", decisão 4.5 do PRD),
  // então não se auto-exclui daqui. Manager comum continua sem se ver na
  // própria lista (esse endpoint hoje só alimenta o seletor de gestor do
  // admin, mas mantém o filtro por segurança/consistência caso ganhe outro
  // consumidor).
  const idFilter = callerRole === UserRole.ADMIN ? {} : { id: Not(callerId) };

  const where: any[] = [
    { ...idFilter, role: UserRole.MANAGER, ...(search ? { name: ILike(`%${search}%`) } : {}) },
    { ...idFilter, role: UserRole.ADMIN, ...(search ? { name: ILike(`%${search}%`) } : {}) },
  ];

  if (search) {
    where.push(
      { ...idFilter, role: UserRole.MANAGER, email: ILike(`%${search}%`) },
      { ...idFilter, role: UserRole.ADMIN, email: ILike(`%${search}%`) },
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
  const callerRole = req.user!.role;

  const result = ListActiveClientsQueryDto.safeParse(req.query);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const { page, itemsPerPage, sortBy, order, search, scope, activeOnly } =
    result.data;
  const effectiveScope = callerRole === UserRole.ADMIN ? scope : "mine";

  const response = await managerLinkService.getActiveClients({
    managerId,
    scope: effectiveScope,
    activeOnly,
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
      "riskProfile",
      "riskProfileUpdatedAt",
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
  const actorUserId = getAuthenticatedUserId(req);
  const actorEmail = req.user!.email;
  const actorRole = req.user!.role;

  const result = UpdateAutonomyDto.safeParse(req.body);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: investorId } });

  if (!user) {
    throw new NotFoundError("Investor not found", "NOT_FOUND");
  }

  const before = { selfServiceEnabled: user.selfServiceEnabled };

  user.selfServiceEnabled = result.data.enabled;
  await userRepo.save(user);

  await operationLogService.log({
    clientId: investorId,
    actorUserId,
    actorEmail,
    actorRole,
    action: result.data.enabled
      ? OperationLogAction.AUTONOMY_GRANTED
      : OperationLogAction.AUTONOMY_REVOKED,
    entityType: "User",
    entityId: investorId,
    beforeValue: before,
    afterValue: { selfServiceEnabled: user.selfServiceEnabled },
  });

  res.json({
    user: { id: user.id, selfServiceEnabled: user.selfServiceEnabled },
  });
};

export const updateClientRiskProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const investorId = getEffectiveUserId(req);
  const actorUserId = getAuthenticatedUserId(req);
  const actorEmail = req.user!.email;
  const actorRole = req.user!.role;

  const result = UpdateRiskProfileDto.safeParse(req.body);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: investorId } });

  if (!user) {
    throw new NotFoundError("Investor not found", "NOT_FOUND");
  }

  const before = { riskProfile: user.riskProfile };

  user.riskProfile = result.data.riskProfile;
  user.riskProfileUpdatedAt = new Date();
  user.riskProfileSetByUserId = actorUserId;
  await userRepo.save(user);

  await operationLogService.log({
    clientId: investorId,
    actorUserId,
    actorEmail,
    actorRole,
    action: OperationLogAction.RISK_PROFILE_CHANGED,
    entityType: "User",
    entityId: investorId,
    beforeValue: before,
    afterValue: { riskProfile: user.riskProfile },
  });

  res.json({
    user: {
      id: user.id,
      riskProfile: user.riskProfile,
      riskProfileUpdatedAt: user.riskProfileUpdatedAt,
    },
  });
};

export const updateInvestorTargetPercentage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getEffectiveUserId(req);
  const actorUserId = getAuthenticatedUserId(req);
  const actorEmail = req.user!.email;
  const actorRole = req.user!.role;
  const assetTypeId = Number(req.params.assetTypeId);

  const result = UpdateTargetPercentageDto.safeParse(req.body);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const assetType = await assetTypeService.updateTargetPercentage({
    userId,
    assetTypeId,
    targetPercentage: result.data.targetPercentage,
    actorUserId,
    actorEmail,
    actorRole,
  });

  res.json({ assetType: { id: assetType.id, name: assetType.name, targetPercentage: assetType.targetPercentage } });
};

export const getClientOperationLogs = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const clientId = getEffectiveUserId(req);

  const result = OperationLogListQueryDto.safeParse(req.query);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const logs = await operationLogService.getLogs({ clientId, ...result.data });
  res.json(logs);
};

export const getClientLinkHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const investorId = getEffectiveUserId(req);
  const data = await managerHistoryService.getInvestorHistory({ investorId });
  res.json({ data });
};

export const getDashboard = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = GetDashboardQueryDto.safeParse(req.query);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const managerId = getAuthenticatedUserId(req);
  const callerRole = req.user!.role;
  const effectiveScope = callerRole === UserRole.ADMIN ? result.data.scope : "mine";

  const dashboard = await managerDashboardService.getDashboard({
    managerId,
    scope: effectiveScope,
  });
  res.json(dashboard);
};
