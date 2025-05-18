import { Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { Asset } from "../models/Asset";
import { recalculatePortfolio } from "../utils/recalculatePortfolio";
import { getMarketPriceCents } from "../utils/getMarketPrice";
import { calculateDerivedFields } from "../utils/calculateDerivedFields";

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

export const createAsset = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { type, ticker, quantity, averagePriceCents, institution, currency } =
      req.body;

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

    const asset = AppDataSource.getRepository(Asset).create({
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

    await AppDataSource.getRepository(Asset).save(asset);

    await recalculatePortfolio();

    res.status(201).json(asset);
  } catch (error) {
    console.error("Erro ao criar ativo:", error);
    res.status(500).json({ error: "Erro ao criar ativo" });
  }
};

export const updateAsset = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { type, ticker, quantity, averagePriceCents, institution, currency } =
      req.body;

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
  try {
    const { id } = req.params;

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
  try {
    const { ticker } = req.params;
    const {
      quantity: newQuantity,
      priceCents: newPriceCents,
      type,
      institution,
      currency,
    } = req.body;

    const assetRepository = AppDataSource.getRepository(Asset);
    let asset = await assetRepository.findOneBy({ ticker });

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

        asset = assetRepository.create({
          type,
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

    // console.log("Asset after buy:", asset);

    await assetRepository.save(asset);

    // console.log("Asset saved after buy:", asset);

    await recalculatePortfolio();

    res.status(200).json(asset);
  } catch (error) {
    console.error("Erro ao comprar ativo:", error);
    res.status(500).json({ error: "Erro ao comprar ativo" });
  }
};
