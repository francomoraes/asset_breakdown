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

export const getAssets = async (req: Request, res: Response) => {
  try {
    const assetRepository = AppDataSource.getRepository(Asset);
    const assets = await assetRepository.find();
    res.status(200).json(assets);
  } catch (error) {
    console.error("Erro ao buscar ativos:", error);
    res.status(500).json({ error: "Erro ao buscar ativos" });
  }
};

export const getAssetsByUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const parsed = userIdParamsSchema.safeParse(req.params);

  if (!parsed.success)
    return handleZodError(res, parsed.error, "Erro ao validar o ID do usuário");

  const { userId } = parsed.data;

  try {
    const assetRepository = AppDataSource.getRepository(Asset);
    const assets = await assetRepository.find({
      where: { userId },
      relations: {
        type: {
          assetClass: true,
        },
      },
      order: {
        id: "ASC",
      },
    });

    if (assets.length === 0) {
      res.status(404).json({
        error: "Nenhum ativo encontrado para este usuário",
      });
      return;
    }

    res.status(200).json(assets);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar ativos do usuário" });
  }
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

  try {
    const assetRepository = AppDataSource.getRepository(Asset);
    const asset = await assetRepository.findOneBy({ id: Number(id) });

    if (!asset) {
      res.status(404).json({ error: "Ativo não encontrado" });
      return;
    }

    let currentPriceCents = 0;

    try {
      currentPriceCents = await getMarketPriceCents(ticker);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errorMessage });
      return;
    }

    const {
      investedValueCents,
      currentValueCents,
      resultCents,
      returnPercentage,
    } = calculateDerivedFields(quantity, averagePriceCents, currentPriceCents);

    Object.assign(asset, {
      type,
      ticker,
      quantity,
      averagePriceCents,
      currentPriceCents,
      investedValueCents,
      currentValueCents,
      resultCents,
      returnPercentage,
      portfolioPercentage: 0,
      institution,
      currency,
    });

    await assetRepository.save(asset);

    await recalculatePortfolio();

    res.status(200).json(asset);
  } catch (error) {
    console.error("Erro ao atualizar ativo:", error);
    res.status(500).json({ error: "Erro ao atualizar ativo" });
  }
};

export const deleteAsset = async (
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

  try {
    const assetRepository = AppDataSource.getRepository(Asset);
    const asset = await assetRepository.findOneBy({ id: Number(id) });

    if (!asset) {
      res.status(404).json({ error: "Ativo não encontrado" });
      return;
    }

    await assetRepository.remove(asset);

    await recalculatePortfolio();

    res.status(200).json({ message: `Ativo deletado`, deleted: asset });
  } catch (error) {
    console.error("Erro ao deletar ativo:", error);
    res.status(500).json({ error: "Erro ao deletar ativo" });
  }
};

export const buyAsset = async (req: Request, res: Response): Promise<void> => {
  const paramCheck = tickerParamsSchema.safeParse(req.params);
  if (!paramCheck.success)
    return handleZodError(
      res,
      paramCheck.error,
      "Erro ao validar o ticker do ativo",
    );
  const { ticker } = paramCheck.data;

  const parsed = buyAssetSchema.safeParse(req.body);

  if (!parsed.success)
    return handleZodError(
      res,
      parsed.error,
      "Erro ao validar os dados de compra do ativo",
    );

  const {
    quantity: newQuantity,
    priceCents: newPriceCents,
    type,
    institution,
    currency,
  } = parsed.data;

  try {
    const assetRepository = AppDataSource.getRepository(Asset);
    let asset = await assetRepository.findOneBy({ ticker });
    const assetTypeRepository = AppDataSource.getRepository("AssetType");

    if (!asset) {
      try {
        const currentPriceCents = await getMarketPriceCents(ticker);

        const {
          investedValueCents,
          currentValueCents,
          resultCents,
          returnPercentage,
        } = calculateDerivedFields(
          newQuantity,
          newPriceCents,
          currentPriceCents,
        );

        const assetType = await assetTypeRepository.findOneBy({ name: type });

        if (!assetType) {
          res
            .status(400)
            .json({ error: `Tipo de ativo '${type}' não encontrado.` });
          return;
        }

        asset = assetRepository.create({
          type: assetType,
          ticker,
          quantity: newQuantity,
          averagePriceCents: newPriceCents,
          currentPriceCents,
          investedValueCents,
          currentValueCents,
          resultCents,
          returnPercentage,
          portfolioPercentage: 0,
          institution,
          currency,
        });

        await assetRepository.save(asset);

        await recalculatePortfolio();

        res.status(201).json(asset);
        return;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errorMessage });
        return;
      }
    }

    const totalQuantity = +Math.round(+asset.quantity + newQuantity);

    const newAveragePriceCents = Math.round(
      (+asset.quantity * asset.averagePriceCents +
        newQuantity * newPriceCents) /
        totalQuantity,
    );

    asset.quantity = +totalQuantity;
    asset.averagePriceCents = newAveragePriceCents;
    asset.investedValueCents = totalQuantity * newAveragePriceCents;

    let currentPriceCents;

    try {
      currentPriceCents = await getMarketPriceCents(ticker);
      asset.currentPriceCents = currentPriceCents;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errorMessage });
      return;
    }

    const { currentValueCents, resultCents, returnPercentage } =
      calculateDerivedFields(
        totalQuantity,
        newAveragePriceCents,
        currentPriceCents,
      );

    asset.currentValueCents = currentValueCents;
    asset.resultCents = resultCents;
    asset.returnPercentage = returnPercentage;
    asset.portfolioPercentage = 0;

    await assetRepository.save(asset);

    await recalculatePortfolio();

    res.status(200).json(asset);
  } catch (error) {
    console.error("Erro ao comprar ativo:", error);
    res.status(500).json({ error: "Erro ao comprar ativo" });
  }
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

  try {
    const assetRepository = AppDataSource.getRepository(Asset);
    const asset = await assetRepository.findOneBy({ ticker });

    if (!asset) {
      res.status(404).json({ error: "Ativo não encontrado" });
      return;
    }

    if (sellQuantity > asset.quantity) {
      res.status(400).json({
        error:
          "Quantidade vendida não pode ser maior que a quantidade do ativo",
      });
      return;
    }

    const totalQuantity = Math.round(asset.quantity - sellQuantity);

    if (totalQuantity === 0) {
      await assetRepository.remove(asset);
      await recalculatePortfolio();
      res
        .status(200)
        .json({ message: "Ativo vendido e removido do portfólio", ticker });
      return;
    }

    asset.quantity = totalQuantity;
    let currentPriceCents = 0;

    try {
      currentPriceCents = await getMarketPriceCents(ticker);
      asset.currentPriceCents = currentPriceCents;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errorMessage });
      return;
    }

    const {
      investedValueCents,
      currentValueCents,
      resultCents,
      returnPercentage,
    } = calculateDerivedFields(
      totalQuantity,
      asset.averagePriceCents,
      currentPriceCents,
    );

    asset.investedValueCents = investedValueCents;
    asset.currentValueCents = currentValueCents;
    asset.resultCents = resultCents;
    asset.returnPercentage = returnPercentage;
    asset.portfolioPercentage = 0;

    await assetRepository.save(asset);

    await recalculatePortfolio();

    res.status(200).json({
      message: "Ativo vendido com sucesso",
      asset,
    });
  } catch (error) {
    console.error("Erro ao vender ativo:", error);
    res.status(500).json({ error: "Erro ao vender ativo" });
  }
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

  try {
    const assets = await AppDataSource.getRepository(Asset).find({
      where: { userId },
      relations: {
        type: {
          assetClass: true,
        },
      },
      order: { id: "ASC" },
    });

    const data = assets.map((asset) => ({
      ticker: asset.ticker,
      quantity: asset.quantity,
      averagePriceCents: asset.averagePriceCents,
      currentPriceCents: asset.currentPriceCents,
      investedValueCents: asset.investedValueCents,
      currentValueCents: asset.currentValueCents,
      resultCents: asset.resultCents,
      returnPercentage: asset.returnPercentage,
      institution: asset.institution,
      currency: asset.currency,
      type: asset.type.name,
      class: asset.type.assetClass.name,
    }));

    const parser = new Parser();
    const csv = parser.parse(data);

    res.header("Content-Type", "text/csv");
    res.attachment("assets.csv");
    res.send(csv);
  } catch (error) {
    console.error("Erro ao exportar ativos para CSV:", error);
    res.status(500).json({ error: "Erro ao exportar ativos para CSV" });
  }
};
