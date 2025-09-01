import { Request, Response } from "express";
import { handleZodError } from "../utils/handleZodError";
import { assetService } from "../services/assetService";
import { UserIdParamDto } from "dtos/params.dto";
import {
  BuyAssetDto,
  DeleteAssetDto,
  SellAssetDto,
  UpdateAssetDto,
} from "dtos/asset.dto";

export const getAssets = async (req: Request, res: Response) => {
  const assets = await assetService.getAsset();
  res.json(assets);
};

export const getAssetsByUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const paramsCheck = UserIdParamDto.safeParse(req.params);

  if (!paramsCheck.success) {
    return handleZodError(res, paramsCheck.error);
  }

  const { userId } = paramsCheck.data;

  const assets = await assetService.getAssetsByUser({ userId });

  res.json(assets);
};

export const updateAsset = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const dtoData = {
    id: req.params.id,
    type: req.params.type,
    ticker: req.params.ticker,
    quantity: req.params.quantity,
    averagePriceCents: req.params.averagePriceCents,
    institution: req.params.institution,
    currency: req.params.currency,
  };

  const result = UpdateAssetDto.safeParse(dtoData);
  if (!result.success) return handleZodError(res, result.error, 409);

  const {
    id,
    type,
    ticker,
    quantity,
    averagePriceCents,
    institution,
    currency,
  } = result.data;

  const asset = await assetService.updateAsset({
    id: Number(id),
    type,
    ticker,
    quantity,
    averagePriceCents,
    institution,
    currency,
  });

  res.json({ message: `Asset ${ticker} updated successfully`, asset });
};

export const deleteAsset = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const dtoData = {
    id: req.params.id,
    userId: req.params.userId,
  };

  const result = DeleteAssetDto.safeParse(dtoData);

  if (!result.success) return handleZodError(res, result.error, 409);

  const { id, userId } = result.data;

  const asset = await assetService.deleteAsset({ id, userId });

  res.json({ message: `Asset deleted`, deleted: asset });
};

export const buyAsset = async (req: Request, res: Response): Promise<void> => {
  const dtoData = {
    ticker: req.params.ticker,
    quantity: req.body.quantity,
    priceCents: req.body.priceCents,
    type: req.body.type,
    institution: req.body.institution,
    currency: req.body.currency,
  };

  const result = BuyAssetDto.safeParse(dtoData);

  if (!result.success) return handleZodError(res, result.error, 409);

  const {
    ticker,
    quantity: newQuantity,
    priceCents: newPriceCents,
    type,
    institution,
    currency,
  } = result.data;

  const asset = await assetService.buyAsset({
    ticker,
    newQuantity,
    newPriceCents,
    type,
    institution,
    currency,
  });

  res.json(asset);
};

export const sellAsset = async (req: Request, res: Response): Promise<void> => {
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
  const paramsCheck = UserIdParamDto.safeParse(req.params);

  if (!paramsCheck.success) {
    return handleZodError(res, paramsCheck.error);
  }

  const { userId } = paramsCheck.data;

  const csv = await assetService.exportAssetsToCsv({ userId });

  res.header("Content-Type", "text/csv");
  res.attachment("assets.csv");
  res.send(csv);
};
