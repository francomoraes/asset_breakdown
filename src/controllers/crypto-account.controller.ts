import { Request, Response } from "express";
import { MercadoBitcoinAccount } from "../models/mercado-bitcoin-account";
import { cryptoAccountService } from "../services/crypto-account.service";
import { handleZodError } from "../utils/handle-zod-error";
import { getAuthenticatedUserId } from "../utils/get-authenticated-user-id";
import {
  CreateCryptoAccountDto,
  DeleteCryptoAccountDto,
  SyncCryptoAccountDto,
} from "../dtos/crypto-account.dto";

// Nunca inclui credentialsEncrypted/iv/authTag, nem mascarado.
function toCryptoAccountResponse(account: MercadoBitcoinAccount) {
  return {
    id: account.id,
    type: "mercado_bitcoin" as const,
    label: account.label,
    status: account.status,
    lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
    lastSyncError: account.lastSyncError,
    institutionId: account.institutionId,
    assetTypeId: account.assetTypeId,
  };
}

export const createCryptoAccount = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const result = CreateCryptoAccountDto.safeParse(req.body);
  if (!result.success) return handleZodError(res, result.error);

  const account = await cryptoAccountService.createAccount({
    userId,
    label: result.data.label,
    institutionId: result.data.institutionId,
    assetType: result.data.assetType,
    apiKey: result.data.apiKey,
    apiSecret: result.data.apiSecret,
  });

  res.status(201).json({
    message: "Conta Mercado Bitcoin conectada com sucesso",
    account: toCryptoAccountResponse(account),
  });
};

export const getCryptoAccounts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const accounts = await cryptoAccountService.listAccounts(userId);

  res.json(accounts.map(toCryptoAccountResponse));
};

export const syncCryptoAccount = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const result = SyncCryptoAccountDto.safeParse({ id: req.params.id });
  if (!result.success) return handleZodError(res, result.error);

  const account = await cryptoAccountService.syncAccount({
    id: Number(result.data.id),
    requestUserId: userId,
  });

  res.json({
    message: "Sincronização concluída",
    account: toCryptoAccountResponse(account),
  });
};

export const deleteCryptoAccount = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const result = DeleteCryptoAccountDto.safeParse({ id: req.params.id });
  if (!result.success) return handleZodError(res, result.error);

  await cryptoAccountService.deleteAccount({
    id: Number(result.data.id),
    requestUserId: userId,
  });

  res.json({ message: "Conta desconectada com sucesso" });
};
