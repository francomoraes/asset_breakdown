import { Request, Response } from "express";
import { handleZodError } from "../utils/handle-zod-error";
import { assetService } from "../services/asset.service";

import {
  BuyAssetDto,
  DeleteAssetDto,
  SellAssetDto,
  UpdateAssetDto,
} from "../dtos/asset.dto";
import { getAuthenticatedUserId } from "../utils/get-authenticated-user-id";
import { PaginationQueryDto } from "dtos/pagination.dto";

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
  });

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

export const buyAsset = async (req: Request, res: Response): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const dtoData = {
    ticker: req.params.ticker,
    quantity: req.body.quantity,
    priceCents: req.body.priceCents,
    type: req.body.type,
    institutionId: req.body.institutionId,
    currency: req.body.currency,
  };

  const result = BuyAssetDto.safeParse(dtoData);

  if (!result.success) return handleZodError(res, result, 409);

  const {
    ticker,
    quantity: newQuantity,
    priceCents: newPriceCents,
    type,
    institutionId,
    currency,
  } = result.data;

  const asset = await assetService.buyAsset({
    userId,
    ticker,
    newQuantity,
    newPriceCents,
    type,
    institutionId,
    currency,
  });

  res.json(asset);
};

export const sellAsset = async (req: Request, res: Response): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const dtoData = {
    ticker: req.params.ticker,
    quantity: req.body.quantity,
    priceCents: req.body.priceCents,
  };

  const result = SellAssetDto.safeParse(dtoData);

  if (!result.success) return handleZodError(res, result.error, 409);

  // Por enquanto, sellPriceCents não é usado, mas será necessário
  // quando implementarmos histórico ou cálculo de lucro consolidado
  const {
    ticker,
    quantity: sellQuantity,
    // priceCents: sellPriceCents
  } = result.data;

  const asset = await assetService.sellAsset({
    userId,
    ticker,
    sellQuantity,
  });

  res.json({
    message: "Ativo vendido com sucesso",
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

  res.json({
    message: "Market prices refreshed",
    ...result,
  });
};
