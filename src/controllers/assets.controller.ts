import { Request, Response } from "express";
import { AppDataSource } from "config/data-source";
import { Asset } from "models/Asset";
import { recalculatePortfolio } from "utils/recalculatePortfolio";
import { getMarketPriceCents } from "utils/getMarketPrice";
import { calculateDerivedFields } from "utils/calculateDerivedFields";
import {
  buyAssetSchema,
  updateAssetSchema,
  assetIdParamsSchema,
  sellAssetSchema,
  tickerParamsSchema,
  userIdParamsSchema,
} from "schemas/asset.schema";
import { Parser } from "json2csv";
import { handleZodError } from "utils/handleZodError";
import { assetService } from "services/assetService";

export const getAssets = async (req: Request, res: Response) => {
  const assets = await assetService.getAsset();
  res.json(assets);
};

export const getAssetsByUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const parsed = userIdParamsSchema.safeParse(req.params);

  if (!parsed.success)
    return handleZodError(res, parsed.error, "Erro ao validar o ID do usuário");

  const { userId } = parsed.data;

  const assets = await assetService.getAssetsByUser({ userId });
  res.json(assets);
};

export const updateAsset = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const paramCheck = assetIdParamsSchema.safeParse(req.params);

  if (!paramCheck.success)
    return handleZodError(
      res,
      paramCheck.error,
      "Erro ao validar o ID do ativo",
    );

  const { id } = paramCheck.data;

  const parsed = updateAssetSchema.safeParse(req.body);

  if (!parsed.success)
    return handleZodError(
      res,
      parsed.error,
      "Erro ao validar os dados do ativo",
    );

  const { type, ticker, quantity, averagePriceCents, institution, currency } =
    parsed.data;

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
  const paramCheck = assetIdParamsSchema.safeParse(req.params);
  if (!paramCheck.success)
    return handleZodError(res, paramCheck.error, "Error validating asset ID");

  const { id } = paramCheck.data;

  const asset = await assetService.deleteAsset({ id: Number(id) });

  res.json({ message: `Asset deleted`, deleted: asset });
};

export const buyAsset = async (req: Request, res: Response): Promise<void> => {
  const paramCheck = tickerParamsSchema.safeParse(req.params);
  if (!paramCheck.success)
    return handleZodError(
      res,
      paramCheck.error,
      "Error validating asset ticker",
    );
  const { ticker } = paramCheck.data;

  const parsed = buyAssetSchema.safeParse(req.body);

  if (!parsed.success)
    return handleZodError(
      res,
      parsed.error,
      "Error validating asset purchase data",
    );

  const {
    quantity: newQuantity,
    priceCents: newPriceCents,
    type,
    institution,
    currency,
  } = parsed.data;

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
  const paramCheck = tickerParamsSchema.safeParse(req.params);
  if (!paramCheck.success)
    return handleZodError(
      res,
      paramCheck.error,
      "Erro ao validar o ID do ativo",
    );

  const { ticker } = paramCheck.data;

  const parsed = sellAssetSchema.safeParse(req.body);
  if (!parsed.success)
    return handleZodError(
      res,
      parsed.error,
      "Erro ao validar os dados de venda do ativo",
    );

  // Por enquanto, sellPriceCents não é usado, mas será necessário
  // quando implementarmos histórico ou cálculo de lucro consolidado
  const {
    quantity: sellQuantity,
    // priceCents: sellPriceCents
  } = parsed.data;

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
  const paramsCheck = userIdParamsSchema.safeParse(req.params);
  if (!paramsCheck.success)
    return handleZodError(
      res,
      paramsCheck.error,
      "Erro ao validar o ID do usuário",
    );

  const { userId } = paramsCheck.data;

  const csv = await assetService.exportAssetsToCsv({ userId });

  res.header("Content-Type", "text/csv");
  res.attachment("assets.csv");
  res.send(csv);
};
