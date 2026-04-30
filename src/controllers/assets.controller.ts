import { Request, Response } from "express";
import { handleZodError } from "../utils/handle-zod-error";
import { assetService } from "../services/asset.service";

import {
  CreateAssetDto,
  DeleteAssetDto,
  UpdateAssetDto,
} from "../dtos/asset.dto";
import { getAuthenticatedUserId } from "../utils/get-authenticated-user-id";
import { PaginationQueryDto } from "dtos/pagination.dto";
import { AppDataSource } from "../config/data-source";
import { PriceCache } from "../models/price-cache";

export const getAssets = async (req: Request, res: Response) => {
  const assets = await assetService.getAsset();
  res.json(assets);
};

export const getAssetsByUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const paginationParams = PaginationQueryDto.safeParse(req.query);

  if (!paginationParams.success) {
    return handleZodError(res, paginationParams.error, 409);
  }

  const assets = await assetService.getAssetsByUser({
    userId,
    ...paginationParams.data,
    currentPage: paginationParams.data.page ?? 1,
  } as Parameters<typeof assetService.getAssetsByUser>[0]);

  res.json(assets);
};

export const updateAsset = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const result = UpdateAssetDto.safeParse({
    id: req.params.id,
    ...req.body,
  });

  if (!result.success) return handleZodError(res, result.error, 409);

  const asset = await assetService.updateAsset({
    ...result.data,
    id: Number(req.params.id),
    requestUserId: userId,
  });

  res.json({
    message: `Asset ${result.data.ticker} updated successfully`,
    asset,
  });
};

export const deleteAsset = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const result = DeleteAssetDto.safeParse({
    id: req.params.id,
  });

  if (!result.success) return handleZodError(res, result.error, 409);

  const asset = await assetService.deleteAsset({
    id: result.data.id,
    requestUserId: userId,
  });

  res.json({ message: `Asset deleted`, deleted: asset });
};

export const createAsset = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const result = CreateAssetDto.safeParse(req.body);

  if (!result.success) return handleZodError(res, result.error, 400);

  const asset = await assetService.createAsset({
    userId,
    ...result.data,
  });

  res.status(201).json({
    message: `Ativo ${result.data.ticker} adicionado com sucesso`,
    asset,
  });
};

export const exportAssetCsv = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const csv = await assetService.exportAssetsToCsv({ userId: Number(userId) });

  res.header("Content-Type", "text/csv");
  res.attachment("assets.csv");
  res.send(csv);
};

export const refreshMarketPrices = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const result = await assetService.updateUserAssetsPrices(userId);

  const message = result.usedCacheOnly
    ? `Atualizacao em cooldown: usando cache de cotacoes (TTL ${result.cooldownHours}h).`
    : "Market prices refreshed";

  res.json({
    message,
    ...result,
  });
};

export const clearPriceCache = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const repo = AppDataSource.getRepository(PriceCache);
  await repo.clear();
  res.json({ message: "Price cache cleared" });
};
