import { Request, Response } from "express";
import { handleZodError } from "../utils/handle-zod-error";
import { getEffectiveUserId } from "../utils/get-effective-user-id";
import { assetTransactionService } from "../services/asset-transaction.service";
import {
  AssetTransactionListQueryDto,
  CreateAssetTransactionDto,
  UpdateAssetTransactionDto,
} from "../dtos/asset-transaction.dto";

export const getTransactions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getEffectiveUserId(req);

  const result = AssetTransactionListQueryDto.safeParse(req.query);
  if (!result.success) return handleZodError(res, result.error, 409);

  const transactions = await assetTransactionService.getTransactions({
    userId,
    ...result.data,
    currentPage: result.data.page ?? 1,
  } as Parameters<typeof assetTransactionService.getTransactions>[0]);

  res.json(transactions);
};

export const createTransaction = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getEffectiveUserId(req);

  const result = CreateAssetTransactionDto.safeParse(req.body);
  if (!result.success) return handleZodError(res, result.error, 400);

  const transaction = await assetTransactionService.createTransaction({
    ...result.data,
    userId,
  });

  res.status(201).json({
    message: "Operação lançada com sucesso",
    transaction,
  });
};

export const updateTransaction = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getEffectiveUserId(req);

  const result = UpdateAssetTransactionDto.safeParse(req.body);
  if (!result.success) return handleZodError(res, result.error, 409);

  const transaction = await assetTransactionService.updateTransaction({
    ...result.data,
    userId,
    transactionId: Number(req.params.transactionId),
  });

  res.json({
    message: "Operação atualizada com sucesso",
    transaction,
  });
};

export const deleteTransaction = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getEffectiveUserId(req);

  const transaction = await assetTransactionService.deleteTransaction({
    userId,
    transactionId: Number(req.params.transactionId),
  });

  res.json({ message: "Operação excluída com sucesso", deleted: transaction });
};
