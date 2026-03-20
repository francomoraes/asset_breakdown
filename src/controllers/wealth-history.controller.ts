import { Request, Response } from "express";
import { handleZodError } from "../utils/handle-zod-error";
import { wealthHistoryService } from "../services/wealth-history.service";
import {
  CreateWealthHistoryDto,
  UpdateWealthHistoryDto,
} from "../dtos/wealth-history.dto";
import { getAuthenticatedUserId } from "../utils/get-authenticated-user-id";
import { BCBService } from "../services/bcb.service";
import { IndexType } from "../models/index-rate-cache";
import { marketIndicesService } from "../services/market-indices.service";

const bcbService = new BCBService();

export const getWealthHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const history = await wealthHistoryService.getWealthHistoryByUser(userId);

  res.json(history);
};

export const createWealthHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const result = CreateWealthHistoryDto.safeParse(req.body);

  if (!result.success) {
    return handleZodError(res, result.error, 409);
  }

  const wealthHistory = await wealthHistoryService.createWealthHistory(
    userId,
    new Date(result.data.date),
    result.data.totalWealthCents,
  );

  res.status(201).json({
    message: "Patrimônio histórico criado com sucesso",
    data: wealthHistory,
  });
};

export const updateWealthHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const { id } = req.params;

  const result = UpdateWealthHistoryDto.safeParse(req.body);

  if (!result.success) {
    return handleZodError(res, result.error, 409);
  }

  const updates: any = {};
  if (result.data.date) {
    updates.date = new Date(result.data.date);
  }
  if (result.data.totalWealthCents !== undefined) {
    updates.totalWealthCents = result.data.totalWealthCents;
  }

  const wealthHistory = await wealthHistoryService.updateWealthHistory(
    userId,
    Number(id),
    updates,
  );

  res.json({
    message: "Patrimônio histórico atualizado com sucesso",
    data: wealthHistory,
  });
};

export const deleteWealthHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const { id } = req.params;

  await wealthHistoryService.deleteWealthHistory(userId, Number(id));

  res.json({
    message: "Patrimônio histórico deletado com sucesso",
  });
};

export const getMarketIndicesHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    res.status(400).json({
      message: "startDate e endDate são obrigatórios",
    });
    return;
  }

  const parsedStart = new Date(startDate as string);
  const parsedEnd = new Date(endDate as string);

  if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
    res.status(400).json({
      message: "startDate e endDate devem ser datas válidas",
    });
    return;
  }

  const start =
    parsedStart.getTime() <= parsedEnd.getTime() ? parsedStart : parsedEnd;
  const end =
    parsedStart.getTime() <= parsedEnd.getTime() ? parsedEnd : parsedStart;

  const [cdiResult, ipcaResult, sp500Result] = await Promise.allSettled([
    bcbService.getIndexData(IndexType.CDI, start, end),
    bcbService.getIndexData(IndexType.IPCA, start, end),
    marketIndicesService.getSP500Historical(start, end),
  ]);

  const cdiData = cdiResult.status === "fulfilled" ? cdiResult.value : [];
  const ipcaData = ipcaResult.status === "fulfilled" ? ipcaResult.value : [];
  const sp500Data = sp500Result.status === "fulfilled" ? sp500Result.value : [];

  // Normalize S&P500 to monthly
  const sp500Monthly = marketIndicesService.normalizeToMonthly(sp500Data);

  res.json({
    cdi: cdiData.map((item) => ({
      date: item.date.toISOString().split("T")[0],
      value: item.value,
    })),
    ipca: ipcaData.map((item) => ({
      date: item.date.toISOString().split("T")[0],
      value: item.value,
    })),
    sp500: sp500Monthly,
  });
};
