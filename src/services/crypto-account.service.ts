import { Repository } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { MercadoBitcoinAccount } from "../models/mercado-bitcoin-account";
import { Asset } from "../models/asset";
import { Institution } from "models/institution";
import { AssetType } from "../models/asset-type";
import { AssetSource } from "enums/asset-source.enum";
import { ConnectedAccountStatus } from "enums/connected-account-status.enum";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../errors/app-error";
import { encrypt, decrypt } from "../utils/crypto-credentials";
import {
  mercadoBitcoinService,
  ProviderBalance,
} from "./mercado-bitcoin.service";
import { marketPriceService } from "./market-price.service";
import { calculateDerivedFields } from "../utils/calculate-derived-fields";
import { recalculatePortfolio } from "../utils/recalculate-portfolio";
import { logger } from "../utils/logger";

// Guard em memória contra sync concorrente da mesma conta (decisão 5.14) — não
// sobrevive a restart, de propósito: se o processo reiniciar no meio de um
// sync, o Set é recriado vazio e a conta nunca fica presa em "syncing".
const syncingAccounts = new Set<number>();

interface StoredCredentials {
  apiKey: string;
  apiSecret: string;
}

function decryptCredentials(account: MercadoBitcoinAccount): StoredCredentials {
  const json = decrypt({
    ciphertext: account.credentialsEncrypted,
    iv: account.iv,
    authTag: account.authTag,
  });
  return JSON.parse(json) as StoredCredentials;
}

function encryptCredentials(apiKey: string, apiSecret: string) {
  const encrypted = encrypt(JSON.stringify({ apiKey, apiSecret }));
  return {
    credentialsEncrypted: encrypted.ciphertext,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
  };
}

export class CryptoAccountService {
  constructor(
    private accountRepo: Repository<MercadoBitcoinAccount>,
    private assetRepo: Repository<Asset>,
    private institutionRepo: Repository<Institution>,
    private assetTypeRepo: Repository<AssetType>,
  ) {}

  async listAccounts(userId: number): Promise<MercadoBitcoinAccount[]> {
    return this.accountRepo.find({ where: { userId }, order: { id: "ASC" } });
  }

  private async validateOwnership({
    userId,
    institutionId,
    assetType,
  }: {
    userId: number;
    institutionId: number;
    assetType: string;
  }): Promise<{ institution: Institution; type: AssetType }> {
    const institution = await this.institutionRepo.findOne({
      where: { id: institutionId, userId },
    });

    if (!institution) {
      throw new NotFoundError(
        `Institution with id ${institutionId} not found`,
        "INSTITUTION_NOT_FOUND",
      );
    }

    const type = await this.assetTypeRepo.findOneBy({
      name: assetType,
      userId,
    });

    if (!type) {
      throw new NotFoundError(
        `Asset type ${assetType} not found`,
        "ASSET_TYPE_NOT_FOUND",
      );
    }

    return { institution, type };
  }

  private async upsertAssetsFromBalances({
    userId,
    account,
    institution,
    type,
    balances,
  }: {
    userId: number;
    account: MercadoBitcoinAccount;
    institution: Institution;
    type: AssetType;
    balances: ProviderBalance[];
  }): Promise<void> {
    const existingAssets = await this.assetRepo.find({
      where: { connectedAccountId: account.id },
    });
    const existingByTicker = new Map(
      existingAssets.map((asset) => [asset.ticker, asset]),
    );
    const balanceTickers = new Set(balances.map((b) => b.ticker));

    // Tickers que sumiram do provider entre syncs (usuário vendeu/sacou) são
    // removidos — o sync reflete o estado atual real da conta.
    const assetsToDelete = existingAssets.filter(
      (asset) => !balanceTickers.has(asset.ticker),
    );
    if (assetsToDelete.length > 0) {
      await this.assetRepo.remove(assetsToDelete);
    }

    const assetsToSave: Asset[] = [];

    for (const balance of balances) {
      const existing = existingByTicker.get(balance.ticker);

      let currentPriceCents: number;
      let priceUnavailable = false;

      try {
        currentPriceCents = await marketPriceService.getPriceCents(
          balance.ticker,
          "USD",
        );
      } catch (error: any) {
        // Mesmo padrão de degradação graciosa de AssetService.createAsset/
        // updateAsset — provider de preço fora do ar não deve derrubar o sync
        // inteiro, só marcar o ativo como priceUnavailable.
        priceUnavailable = true;
        currentPriceCents = existing?.currentPriceCents ?? 0;
        logger.warn(
          `Preço indisponível para ${balance.ticker} durante sync da conta ${account.id}: ${error?.message || error}`,
        );
      }

      if (existing) {
        const { investedValueCents, currentValueCents, resultCents, returnPercentage } =
          calculateDerivedFields(
            balance.quantity,
            existing.averagePriceCents,
            currentPriceCents,
          );

        Object.assign(existing, {
          quantity: balance.quantity,
          currentPriceCents,
          investedValueCents,
          currentValueCents,
          resultCents,
          returnPercentage,
          priceUnavailable,
        });

        assetsToSave.push(existing);
      } else {
        const { investedValueCents, currentValueCents, resultCents, returnPercentage } =
          calculateDerivedFields(
            balance.quantity,
            currentPriceCents,
            currentPriceCents,
          );

        assetsToSave.push(
          this.assetRepo.create({
            userId,
            type,
            institution,
            ticker: balance.ticker,
            quantity: balance.quantity,
            averagePriceCents: currentPriceCents,
            currentPriceCents,
            investedValueCents,
            currentValueCents,
            resultCents,
            returnPercentage,
            portfolioPercentage: 0,
            currency: "USD",
            priceUnavailable,
            source: AssetSource.MERCADO_BITCOIN,
            connectedAccountId: account.id,
          }),
        );
      }
    }

    if (assetsToSave.length > 0) {
      await this.assetRepo.save(assetsToSave);
    }
  }

  async createAccount({
    userId,
    label,
    institutionId,
    assetType,
    apiKey,
    apiSecret,
  }: {
    userId: number;
    label?: string;
    institutionId: number;
    assetType: string;
    apiKey: string;
    apiSecret: string;
  }): Promise<MercadoBitcoinAccount> {
    const { institution, type } = await this.validateOwnership({
      userId,
      institutionId,
      assetType,
    });

    let externalAccountId: string;
    let balances: ProviderBalance[];

    try {
      const result = await mercadoBitcoinService.connectAndFetchInitialBalances(
        apiKey,
        apiSecret,
      );
      externalAccountId = result.externalAccountId;
      balances = result.balances;
    } catch (error: any) {
      throw new BadRequestError(
        `Não foi possível conectar à Mercado Bitcoin: ${error?.message || error}`,
        "CRYPTO_ACCOUNT_CONNECTION_FAILED",
      );
    }

    const existingAccount = await this.accountRepo.findOneBy({
      userId,
      externalAccountId,
    });

    if (existingAccount) {
      throw new ConflictError(
        "Esta conta Mercado Bitcoin já está conectada",
        "DUPLICATE_CONNECTED_ACCOUNT",
      );
    }

    const account = this.accountRepo.create({
      userId,
      label: label ?? null,
      institutionId,
      assetTypeId: type.id,
      externalAccountId,
      status: ConnectedAccountStatus.ACTIVE,
      lastSyncedAt: new Date(),
      lastSyncError: null,
      ...encryptCredentials(apiKey, apiSecret),
    });

    await this.accountRepo.save(account);

    await this.upsertAssetsFromBalances({
      userId,
      account,
      institution,
      type,
      balances,
    });

    await recalculatePortfolio(userId);

    return account;
  }

  async deleteAccount({
    id,
    requestUserId,
  }: {
    id: number;
    requestUserId: number;
  }): Promise<MercadoBitcoinAccount> {
    const account = await this.accountRepo.findOne({
      where: { id, userId: requestUserId },
    });

    if (!account) {
      throw new NotFoundError(
        `Crypto account ${id} not found`,
        "CRYPTO_ACCOUNT_NOT_FOUND",
      );
    }

    await this.assetRepo.delete({ connectedAccountId: id });
    await this.accountRepo.delete({ id, userId: requestUserId });
    await recalculatePortfolio(requestUserId);

    return account;
  }

  async syncAccount({
    id,
    requestUserId,
  }: {
    id: number;
    requestUserId: number;
  }): Promise<MercadoBitcoinAccount> {
    const account = await this.accountRepo.findOne({
      where: { id, userId: requestUserId },
    });

    if (!account) {
      throw new NotFoundError(
        `Crypto account ${id} not found`,
        "CRYPTO_ACCOUNT_NOT_FOUND",
      );
    }

    if (syncingAccounts.has(id)) {
      throw new ConflictError(
        "Esta conta já está sincronizando. Tente novamente em instantes.",
        "ACCOUNT_SYNC_IN_PROGRESS",
      );
    }

    syncingAccounts.add(id);

    try {
      const { apiKey, apiSecret } = decryptCredentials(account);

      let balances: ProviderBalance[];

      try {
        balances = await mercadoBitcoinService.fetchBalancesForAccount(
          apiKey,
          apiSecret,
          account.externalAccountId,
        );
      } catch (error: any) {
        account.status = ConnectedAccountStatus.ERROR;
        account.lastSyncError = error?.message || String(error);
        await this.accountRepo.save(account);
        return account;
      }

      const institution = await this.institutionRepo.findOneBy({
        id: account.institutionId,
      });
      const type = await this.assetTypeRepo.findOneBy({
        id: account.assetTypeId,
      });

      if (!institution || !type) {
        throw new NotFoundError(
          "Instituição ou tipo de ativo da conta conectada não encontrados",
          "INSTITUTION_NOT_FOUND",
        );
      }

      await this.upsertAssetsFromBalances({
        userId: requestUserId,
        account,
        institution,
        type,
        balances,
      });

      account.status = ConnectedAccountStatus.ACTIVE;
      account.lastSyncedAt = new Date();
      account.lastSyncError = null;
      await this.accountRepo.save(account);

      await recalculatePortfolio(requestUserId);

      return account;
    } finally {
      syncingAccounts.delete(id);
    }
  }
}

export const cryptoAccountService = new CryptoAccountService(
  AppDataSource.getRepository(MercadoBitcoinAccount),
  AppDataSource.getRepository(Asset),
  AppDataSource.getRepository(Institution),
  AppDataSource.getRepository(AssetType),
);
