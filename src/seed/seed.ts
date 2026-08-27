import { AppDataSource } from "../config/data-source";
import { AssetClass } from "../models/asset-class";
import { AssetType } from "../models/asset-type";
import { Asset } from "../models/asset";
import { AssetTransaction } from "../models/asset-transaction";
import { AssetTransactionType } from "../enums/asset-transaction-type.enum";
import { normalizeDate } from "../utils/normalize-date";
import { FixedIncomeAsset } from "../models/fixed-income-asset";
import { WealthHistory } from "../models/wealth-history";
import { User } from "../models/user";
import { UserRole } from "../enums/role.enum";
import { ManagerClientLink, LinkStatus, RevokeReason } from "../models/manager-client-link";
import { ManagerClientHistory, HistoryCycleStatus } from "../models/manager-client-history";
import { marketPriceService } from "../services/market-price.service";
import { calculateDerivedFields } from "../utils/calculate-derived-fields";
import { recalculatePortfolio } from "../utils/recalculate-portfolio";
import { ensureDataSource } from "../utils/ensure-data-source";
import { PriceCache } from "../models/price-cache";
import { Institution } from "models/institution";
import { getBRLtoUSDRate } from "../utils/get-brl-to-usd-rate";
import bcrypt from "bcrypt";

AppDataSource.initialize()
  .then(async () => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Seed cannot run in production. Aborting.");
    }

    await ensureDataSource();

    const shouldReset = process.argv.includes("--reset");
    const shouldClearPriceCache = process.argv.includes("--clear-price-cache");

    if (shouldReset) {
      console.log("🧨 Resetando banco com TRUNCATE CASCADE...");

      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();

      await queryRunner.query(`
        TRUNCATE TABLE "manager_client_history" RESTART IDENTITY CASCADE;
        TRUNCATE TABLE "manager_client_link" RESTART IDENTITY CASCADE;
        TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;
        TRUNCATE TABLE "asset" RESTART IDENTITY CASCADE;
        TRUNCATE TABLE "fixed_income_asset" RESTART IDENTITY CASCADE;
        TRUNCATE TABLE "asset_type" RESTART IDENTITY CASCADE;
        TRUNCATE TABLE "asset_class" RESTART IDENTITY CASCADE;
        TRUNCATE TABLE "institution" RESTART IDENTITY CASCADE;
      `);

      await queryRunner.release();
    }

    // ─── Usuários ─────────────────────────────────────────────────────────────

    const userRepository = AppDataSource.getRepository(User);
    const seedUsersData = [
      { email: "admin@test.com",      password: "Admin123!",   name: "Admin User",     locale: "pt-br", role: UserRole.ADMIN,     managerClientLimit: null, selfServiceEnabled: false },
      { email: "user@test.com",       password: "User123!",    name: "Regular User",   locale: "pt-br", role: UserRole.INVESTOR,  managerClientLimit: null, selfServiceEnabled: false },
      { email: "manager1@test.com",   password: "Manager123!", name: "Manager One",    locale: "pt-br", role: UserRole.MANAGER,   managerClientLimit: null, selfServiceEnabled: false },
      { email: "manager2@test.com",   password: "Manager123!", name: "Manager Two",    locale: "pt-br", role: UserRole.MANAGER,   managerClientLimit: 5,    selfServiceEnabled: false },
      { email: "investor2@test.com",  password: "User123!",    name: "Investor Two",   locale: "pt-br", role: UserRole.INVESTOR,  managerClientLimit: null, selfServiceEnabled: true },
    ];

    const seedUsers: User[] = [];

    for (const userData of seedUsersData) {
      let user = await userRepository.findOneBy({ email: userData.email });

      if (!user) {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        user = userRepository.create({
          email: userData.email,
          password: hashedPassword,
          name: userData.name,
          locale: userData.locale,
          role: userData.role,
          managerClientLimit: userData.managerClientLimit,
          selfServiceEnabled: userData.selfServiceEnabled,
        });
        await userRepository.save(user);
        console.log(`✅ User created: ${userData.email} (${userData.role})`);
      } else {
        user.role = userData.role;
        user.managerClientLimit = userData.managerClientLimit;
        user.selfServiceEnabled = userData.selfServiceEnabled;
        await userRepository.save(user);
        console.log(`ℹ️ User already exists: ${userData.email}`);
      }

      seedUsers.push(user);
    }

    if (shouldClearPriceCache) {
      console.log("🧨 Limpando cache de preços...");
      await AppDataSource.getRepository(PriceCache).clear();
    }

    // ─── Portfólio de cada usuário ────────────────────────────────────────────

    const assetClassRepository = AppDataSource.getRepository(AssetClass);
    const assetTypeRepository = AppDataSource.getRepository(AssetType);
    const institutionsRepository = AppDataSource.getRepository(Institution);
    const assetRepository = AppDataSource.getRepository(Asset);
    const fixedIncomeAssetRepository = AppDataSource.getRepository(FixedIncomeAsset);
    const wealthHistoryRepository = AppDataSource.getRepository(WealthHistory);

    const assetClassNames = [
      "Renda Fixa",
      "Mercado Imobiliário",
      "Stocks",
      "Metais / Commodities",
      "Criptomoedas",
    ];

    const assetTypeDefinitions = [
      { name: "Pós-fixado",    class: "Renda Fixa",            targetPercentage: 0.05 },
      { name: "Inflação",      class: "Renda Fixa",            targetPercentage: 0.05 },
      { name: "Pré-fixado",    class: "Renda Fixa",            targetPercentage: 0.05 },
      { name: "Bonds Curtos",  class: "Renda Fixa",            targetPercentage: 0.05 },
      { name: "Caixa BRL",     class: "Renda Fixa",            targetPercentage: 0.05 },
      { name: "Reits",         class: "Mercado Imobiliário",   targetPercentage: 0.05 },
      { name: "FIIs",          class: "Mercado Imobiliário",   targetPercentage: 0.05 },
      { name: "Stocks",        class: "Stocks",                targetPercentage: 0.05 },
      { name: "Ouro",          class: "Metais / Commodities",  targetPercentage: 0.05 },
      { name: "Prata",         class: "Metais / Commodities",  targetPercentage: 0.05 },
      { name: "Caixa Cripto",  class: "Criptomoedas",          targetPercentage: 0.05 },
      { name: "Bitcoin",       class: "Criptomoedas",          targetPercentage: 0.05 },
      { name: "Altcoin",       class: "Criptomoedas",          targetPercentage: 0.40 },
    ];

    // Create asset classes and types for all users
    for (const user of seedUsers) {
      if (user.role === UserRole.MANAGER) continue;

      for (const name of assetClassNames) {
        const existing = await assetClassRepository.findOneBy({ name, userId: user.id });
        if (!existing) {
          const newClass = assetClassRepository.create({ name, userId: user.id });
          await assetClassRepository.save(newClass);
        }
      }

      for (const { name, class: className, targetPercentage } of assetTypeDefinitions) {
        const assetClass = await assetClassRepository.findOneBy({ name: className, userId: user.id });
        if (!assetClass) continue;

        const existing = await assetTypeRepository.findOneBy({ name, userId: user.id });
        if (!existing) {
          const newType = assetTypeRepository.create({ name, targetPercentage, assetClass, userId: user.id });
          await assetTypeRepository.save(newType);
        }
      }
    }

    console.log("✅ Asset classes e types criados para todos os usuários");

    // ─── Instituições para cada usuário ───────────────────────────────────────

    const institutionNames = ["Avenue", "XP Investimentos", "Binance", "Mercado Bitcoin"];

    for (const user of seedUsers) {
      if (user.role === UserRole.MANAGER) continue;

      for (const name of institutionNames) {
        const existing = await institutionsRepository.findOneBy({ name, userId: user.id });
        if (!existing) {
          await institutionsRepository.save(institutionsRepository.create({ name, userId: user.id }));
        }
      }
    }

    console.log("✅ Instituições criadas para todos os usuários");

    // ─── Ativos com preço de mercado ───────────────────────────────────────────

    const mainUser = seedUsers[1]; // user@test.com
    const investor2User = seedUsers[4]; // investor2@test.com
    const avenuMainUser = await institutionsRepository.findOneBy({ name: "Avenue", userId: mainUser.id });
    const xpMainUser = await institutionsRepository.findOneBy({ name: "XP Investimentos", userId: mainUser.id });
    const binanceMainUser = await institutionsRepository.findOneBy({ name: "Binance", userId: mainUser.id });
    const avenueInvestor2 = await institutionsRepository.findOneBy({ name: "Avenue", userId: investor2User.id });

    const seedAssets = [
      { type: "Bonds Curtos", ticker: "SHV",     quantity: 23.28, averagePrice: 110.35, currency: "USD", institution: avenuMainUser!.name },
      { type: "Ouro",         ticker: "IAU",     quantity: 70.0,  averagePrice: 35.56,  currency: "USD", institution: avenuMainUser!.name },
      { type: "Prata",        ticker: "SLV",     quantity: 66.0,  averagePrice: 20.92,  currency: "USD", institution: avenuMainUser!.name },
      { type: "Reits",        ticker: "VNQ",     quantity: 16.44, averagePrice: 83.64,  currency: "USD", institution: avenuMainUser!.name },
      { type: "Stocks",       ticker: "SPY",     quantity: 0.5,   averagePrice: 376.51, currency: "USD", institution: avenuMainUser!.name },
      { type: "Stocks",       ticker: "EWZ",     quantity: 8.07,  averagePrice: 31.6,   currency: "USD", institution: avenuMainUser!.name },
      { type: "Inflação",     ticker: "B5P211",  quantity: 121.0, averagePrice: 88.66,  currency: "BRL", institution: xpMainUser!.name },
      { type: "Inflação",     ticker: "JURO11",  quantity: 171.0, averagePrice: 104.78, currency: "BRL", institution: xpMainUser!.name },
      { type: "Pós-fixado",   ticker: "CDII11",  quantity: 146.0, averagePrice: 106.02, currency: "BRL", institution: xpMainUser!.name },
      { type: "Altcoin",      ticker: "ETH-USD", quantity: 0.36,  averagePrice: 2485.73,currency: "USD", institution: binanceMainUser!.name },
      { type: "Bitcoin",      ticker: "BTC-USD", quantity: 0.04,  averagePrice: 40930.03,currency:"USD", institution: binanceMainUser!.name },
      { type: "FIIs",         ticker: "TRXF11",  quantity: 10.0,  averagePrice: 97.62,  currency: "BRL", institution: xpMainUser!.name },
      { type: "FIIs",         ticker: "RECR11",  quantity: 15.0,  averagePrice: 84.46,  currency: "BRL", institution: xpMainUser!.name },
      { type: "Stocks",       ticker: "SPGP",    quantity: 0.68,  averagePrice: 94.7,   currency: "USD", institution: avenuMainUser!.name },
    ];

    // investor2 reaproveita tickers já buscados no batch acima (IAU, VNQ) —
    // dá posição em mais de uma AssetClass além de renda fixa, útil pra testar
    // o índice de aderência num segundo cliente, sem precisar de outro fetch.
    const investor2Assets = [
      { type: "Ouro",  ticker: "IAU", quantity: 30.0, averagePrice: 36.10, currency: "USD", institution: avenueInvestor2!.name },
      { type: "Reits", ticker: "VNQ", quantity: 8.0,  averagePrice: 82.30, currency: "USD", institution: avenueInvestor2!.name },
    ];

    console.log("🔍 Buscando preços em batch...");
    const allTickers = seedAssets.map((a) => a.ticker);
    const seedCurrencyMap = new Map(
      seedAssets.map((a) => [a.ticker, a.currency]),
    );
    const pricesMap = await marketPriceService.getPricesCentsBatch(
      allTickers,
      seedCurrencyMap,
    );
    console.log(`✅ ${pricesMap.size} preços obtidos`);

    async function saveSeedAssets(
      user: User,
      assets: { type: string; ticker: string; quantity: number; averagePrice: number; currency: string; institution: string }[],
    ) {
      for (const { ticker, type, quantity, averagePrice, currency, institution } of assets) {
        const assetType = await assetTypeRepository.findOneBy({ name: type, userId: user.id });
        if (!assetType) { console.warn(`Asset type ${type} not found for ${user.email}`); continue; }

        const assetInstitution = await institutionsRepository.findOneBy({ name: institution, userId: user.id });
        if (!assetInstitution) { console.warn(`Institution ${institution} not found for ${user.email}`); continue; }

        const currentPriceCents = pricesMap.get(ticker);
        if (!currentPriceCents) { console.warn(`⚠️ Preço não encontrado para ${ticker}, pulando...`); continue; }

        const averagePriceCents = Math.round(averagePrice * 100);
        const { investedValueCents, currentValueCents, resultCents, returnPercentage } =
          calculateDerivedFields(quantity, averagePriceCents, currentPriceCents);

        const existing = await assetRepository.findOneBy({ ticker, userId: user.id });
        if (!existing) {
          await assetRepository.save(
            assetRepository.create({
              ticker, quantity, averagePriceCents, currentPriceCents,
              investedValueCents, currentValueCents, resultCents, returnPercentage,
              portfolioPercentage: 0, institution: assetInstitution, currency,
              type: assetType, userId: user.id,
            }),
          );
          console.log(`✅ Ativo criado: ${ticker} (${user.email})`);
        } else {
          console.log(`ℹ️ Ativo já existe: ${ticker} (${user.email})`);
        }
      }
    }

    await saveSeedAssets(mainUser, seedAssets);
    await saveSeedAssets(investor2User, investor2Assets);

    // ─── AssetTransaction de exemplo (compras, vendas, proventos) ─────────────
    // Histórico ilustrativo pra exercitar cashFlow (aporte líquido, proventos
    // não reinvestidos) — não reconcilia matematicamente com quantity/
    // averagePriceCents do Asset (que já vem "pronto" de seedAssets acima),
    // então não usar essas transações pra validar a posição atual do ativo.

    const transactionRepository = AppDataSource.getRepository(AssetTransaction);

    type TxSeed = {
      type: AssetTransactionType;
      date: string;
      quantity: number | null;
      unitPriceCents: number | null;
      feesCents: number;
      totalAmountCents: number;
    };

    const transactionsByTickerForMainUser: Record<string, TxSeed[]> = {
      TRXF11: [
        { type: AssetTransactionType.BUY, date: "2025-03-10", quantity: 10, unitPriceCents: 9762, feesCents: 0, totalAmountCents: 97620 },
        { type: AssetTransactionType.DIVIDEND, date: "2025-08-10", quantity: null, unitPriceCents: null, feesCents: 0, totalAmountCents: 4500 },
      ],
      CDII11: [
        { type: AssetTransactionType.BUY, date: "2024-11-15", quantity: 50, unitPriceCents: 10500, feesCents: 0, totalAmountCents: 525000 },
        { type: AssetTransactionType.BUY, date: "2025-04-15", quantity: 30, unitPriceCents: 10800, feesCents: 0, totalAmountCents: 324000 },
        { type: AssetTransactionType.DIVIDEND, date: "2025-06-15", quantity: null, unitPriceCents: null, feesCents: 0, totalAmountCents: 12000 },
      ],
      B5P211: [
        { type: AssetTransactionType.BUY, date: "2024-09-05", quantity: 40, unitPriceCents: 8600, feesCents: 0, totalAmountCents: 344000 },
        { type: AssetTransactionType.DIVIDEND, date: "2025-05-05", quantity: null, unitPriceCents: null, feesCents: 0, totalAmountCents: 8000 },
      ],
      SPY: [
        { type: AssetTransactionType.BUY, date: "2024-09-20", quantity: 0.2, unitPriceCents: 37800, feesCents: 199, totalAmountCents: 7560 },
        { type: AssetTransactionType.SELL, date: "2025-03-10", quantity: 0.1, unitPriceCents: 40500, feesCents: 199, totalAmountCents: 4050 },
        { type: AssetTransactionType.DIVIDEND, date: "2025-06-20", quantity: null, unitPriceCents: null, feesCents: 0, totalAmountCents: 1800 },
      ],
      "BTC-USD": [
        { type: AssetTransactionType.BUY, date: "2024-12-01", quantity: 0.01, unitPriceCents: 4200000, feesCents: 500, totalAmountCents: 42000 },
        { type: AssetTransactionType.BUY, date: "2025-04-15", quantity: 0.015, unitPriceCents: 4500000, feesCents: 750, totalAmountCents: 67500 },
      ],
    };

    const transactionsByTickerForInvestor2: Record<string, TxSeed[]> = {
      IAU: [
        { type: AssetTransactionType.BUY, date: "2025-01-20", quantity: 15, unitPriceCents: 3550, feesCents: 0, totalAmountCents: 53250 },
      ],
      VNQ: [
        { type: AssetTransactionType.BUY, date: "2024-10-05", quantity: 5, unitPriceCents: 8100, feesCents: 99, totalAmountCents: 40500 },
        { type: AssetTransactionType.DIVIDEND, date: "2025-07-05", quantity: null, unitPriceCents: null, feesCents: 0, totalAmountCents: 2200 },
      ],
    };

    async function saveSeedTransactions(
      user: User,
      transactionsByTicker: Record<string, TxSeed[]>,
    ) {
      for (const [ticker, txs] of Object.entries(transactionsByTicker)) {
        const asset = await assetRepository.findOneBy({ ticker, userId: user.id });
        if (!asset) { console.warn(`Asset ${ticker} not found for ${user.email}`); continue; }

        const existingTransactions = await transactionRepository.count({
          where: { assetId: asset.id },
        });
        if (existingTransactions > 0) {
          console.log(`ℹ️ AssetTransaction de ${ticker} já existem (${user.email})`);
          continue;
        }

        await transactionRepository.save(
          txs.map((tx) =>
            transactionRepository.create({
              assetId: asset.id!,
              userId: user.id,
              type: tx.type,
              date: normalizeDate(new Date(tx.date)),
              quantity: tx.quantity,
              unitPriceCents: tx.unitPriceCents,
              feesCents: tx.feesCents,
              totalAmountCents: tx.totalAmountCents,
            }),
          ),
        );

        const dividendsCentsAccumulated = txs
          .filter((tx) => tx.type === AssetTransactionType.DIVIDEND)
          .reduce((sum, tx) => sum + tx.totalAmountCents, 0);

        if (dividendsCentsAccumulated > 0) {
          const derived = calculateDerivedFields(
            asset.quantity,
            asset.averagePriceCents,
            asset.currentPriceCents,
            dividendsCentsAccumulated,
          );
          await assetRepository.update(asset.id!, { dividendsCentsAccumulated, ...derived });
        }

        console.log(`✅ AssetTransaction criadas para ${ticker} (${user.email})`);
      }
    }

    await saveSeedTransactions(mainUser, transactionsByTickerForMainUser);
    await saveSeedTransactions(investor2User, transactionsByTickerForInvestor2);

    // ─── Renda fixa para todos os usuários ────────────────────────────────────

    type FIAssetDef = {
      description: string;
      startDate: Date;
      maturityDate: Date;
      interestRate: number;
      investedValueCents: number;
      currency: string;
      institution: string;
      type: string;
    };

    const fiByUser: Record<string, FIAssetDef[]> = {
      "user@test.com": [
        { description: "CDB XP 100% CDI",       startDate: new Date("2024-01-15"), maturityDate: new Date("2026-01-15"), interestRate: 13.65, investedValueCents: 1000000, currency: "BRL", institution: "XP Investimentos", type: "Pós-fixado" },
        { description: "Tesouro IPCA+ 2029",     startDate: new Date("2023-06-10"), maturityDate: new Date("2029-05-15"), interestRate: 6.5,   investedValueCents: 500000,  currency: "BRL", institution: "XP Investimentos", type: "Inflação" },
        { description: "LCI Banco XP",           startDate: new Date("2024-03-20"), maturityDate: new Date("2026-03-20"), interestRate: 11.2,  investedValueCents: 1500000, currency: "BRL", institution: "XP Investimentos", type: "Pós-fixado" },
        { description: "Tesouro Prefixado 2027", startDate: new Date("2024-01-05"), maturityDate: new Date("2027-01-01"), interestRate: 12.0,  investedValueCents: 800000,  currency: "BRL", institution: "XP Investimentos", type: "Pré-fixado" },
        { description: "CDB Banco Inter 110%",   startDate: new Date("2024-02-10"), maturityDate: new Date("2025-02-10"), interestRate: 15.0,  investedValueCents: 300000,  currency: "BRL", institution: "XP Investimentos", type: "Pós-fixado" },
      ],
      "investor2@test.com": [
        { description: "CDB Investor2 100% CDI", startDate: new Date("2024-01-15"), maturityDate: new Date("2026-01-15"), interestRate: 13.65, investedValueCents: 1500000, currency: "BRL", institution: "XP Investimentos", type: "Pós-fixado" },
        { description: "Tesouro IPCA Investor2", startDate: new Date("2023-06-10"), maturityDate: new Date("2029-05-15"), interestRate: 6.5,   investedValueCents: 1000000, currency: "BRL", institution: "XP Investimentos", type: "Inflação" },
        { description: "LCI Investor2 XP",       startDate: new Date("2024-03-20"), maturityDate: new Date("2026-03-20"), interestRate: 11.2,  investedValueCents: 800000,  currency: "BRL", institution: "XP Investimentos", type: "Pós-fixado" },
      ],
    };

    for (const user of seedUsers) {
      const userFiAssets = fiByUser[user.email] ?? [];

      for (const fiAsset of userFiAssets) {
        const assetType = await assetTypeRepository.findOneBy({ name: fiAsset.type, userId: user.id });
        if (!assetType) { console.warn(`Asset type ${fiAsset.type} not found for ${user.email}`); continue; }

        const assetInstitution = await institutionsRepository.findOneBy({ name: fiAsset.institution, userId: user.id });
        if (!assetInstitution) { console.warn(`Institution ${fiAsset.institution} not found for ${user.email}`); continue; }

        const now = new Date();
        const calcDate = now > fiAsset.maturityDate ? fiAsset.maturityDate : now;
        const daysElapsed = Math.floor((calcDate.getTime() - fiAsset.startDate.getTime()) / (1000 * 60 * 60 * 24));
        const dailyRate = Math.pow(1 + fiAsset.interestRate / 100, 1 / 365) - 1;
        const currentValueCents = Math.round(fiAsset.investedValueCents * Math.pow(1 + dailyRate, daysElapsed));
        const resultCents = currentValueCents - fiAsset.investedValueCents;
        const returnPercentage = fiAsset.investedValueCents > 0
          ? Number(((resultCents / fiAsset.investedValueCents) * 100).toFixed(2))
          : 0;

        const existing = await fixedIncomeAssetRepository.findOne({ where: { description: fiAsset.description, userId: user.id } });

        if (!existing) {
          await fixedIncomeAssetRepository.save(
            fixedIncomeAssetRepository.create({
              description: fiAsset.description,
              startDate: fiAsset.startDate,
              maturityDate: fiAsset.maturityDate,
              interestRate: fiAsset.interestRate,
              investedValueCents: fiAsset.investedValueCents,
              currentValueCents,
              resultCents,
              returnPercentage,
              portfolioPercentage: 0,
              institution: assetInstitution,
              type: assetType,
              currency: fiAsset.currency,
              userId: user.id,
            }),
          );
          console.log(`✅ FI asset criado: ${fiAsset.description} (${user.email})`);
        } else {
          console.log(`ℹ️ FI asset já existe: ${fiAsset.description} (${user.email})`);
        }
      }
    }

    // ─── Wealth history ───────────────────────────────────────────────────────

    // Base values per user (BRL cents, monthly for 20 meses a partir de
    // 2024-01) — inclui alguns meses de queda de propósito (não só
    // crescimento monotônico), pra "Evolução Patrimonial" ficar mais realista.
    const wealthHistoryByUser: Record<string, number[]> = {
      "user@test.com":      [5000000, 5250000, 5550000, 5800000, 6100000, 6400000, 6700000, 6950000, 7250000, 7600000, 7950000, 8300000, 8600000, 8950000, 8700000, 8500000, 8900000, 9300000, 9150000, 9600000],
      "investor2@test.com": [3000000, 3100000, 3200000, 3350000, 3500000, 3650000, 3800000, 3950000, 4100000, 4250000, 4400000, 4550000, 4700000, 4850000, 4750000, 4900000, 5100000, 4950000, 5250000, 5500000],
    };

    const wealthDates = [
      "2024-01-01","2024-02-01","2024-03-01","2024-04-01","2024-05-01","2024-06-01","2024-07-01",
      "2024-08-01","2024-09-01","2024-10-01","2024-11-01","2024-12-01","2025-01-01","2025-02-01",
      "2025-03-01","2025-04-01","2025-05-01","2025-06-01","2025-07-01","2025-08-01",
    ];

    for (const user of seedUsers) {
      const wealthValues = wealthHistoryByUser[user.email];
      if (!wealthValues) continue;

      for (let i = 0; i < wealthDates.length; i++) {
        const normalizedDate = normalizeDate(wealthDates[i]!);

        const existing = await wealthHistoryRepository.findOne({ where: { userId: user.id, date: normalizedDate } });
        if (!existing) {
          await wealthHistoryRepository.save(
            wealthHistoryRepository.create({ userId: user.id, date: normalizedDate, totalWealthCents: wealthValues[i] }),
          );
        }
      }
    }

    console.log("✅ Wealth history criado para todos os usuários");

    // ─── Portfolio recalculation ───────────────────────────────────────────────

    for (const user of seedUsers) {
      await recalculatePortfolio(user.id!);
    }

    console.log("✅ Portfolios recalculados");

    // ─── Calcular patrimônio atual para o seed de history ─────────────────────

    async function calcWealthForSeed(userId: number): Promise<number> {
      const fiAssets = await fixedIncomeAssetRepository.find({ where: { userId } });
      const assets = await assetRepository.find({ where: { userId } });

      const brlFi = fiAssets.filter((a) => a.currency === "BRL").reduce((s, a) => s + a.currentValueCents, 0);
      const brlAssets = assets.filter((a) => a.currency === "BRL").reduce((s, a) => s + a.currentValueCents, 0);
      const usdFi = fiAssets.filter((a) => a.currency === "USD").reduce((s, a) => s + a.currentValueCents, 0);
      const usdAssets = assets.filter((a) => a.currency === "USD").reduce((s, a) => s + a.currentValueCents, 0);

      let usdToBrl = 5.7; // fallback
      try {
        const brlToUsd = await getBRLtoUSDRate();
        usdToBrl = 1 / brlToUsd;
      } catch {
        console.warn("⚠️ Não foi possível obter taxa de câmbio, usando 5.7");
      }

      return brlFi + brlAssets + Math.round((usdFi + usdAssets) * usdToBrl);
    }

    // ─── Vínculos (manager_client_link) ───────────────────────────────────────

    const linkRepository = AppDataSource.getRepository(ManagerClientLink);
    const historyRepository = AppDataSource.getRepository(ManagerClientHistory);

    const [admin, userMain, manager1, manager2, investor2] = seedUsers as User[];

    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const fourMonthsAgo = new Date(now);
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    type LinkSeed = {
      investorId: number;
      managerId: number;
      status: LinkStatus;
      requestedByUserId: number;
      respondedByUserId: number | null;
      activatedAt: Date | null;
      revokedAt: Date | null;
      revokeReason: RevokeReason | null;
      createdAt: Date;
    };

    const linksToSeed: LinkSeed[] = [
      {
        investorId: userMain!.id!, managerId: manager1!.id!, status: LinkStatus.ACTIVE,
        requestedByUserId: userMain!.id!, respondedByUserId: manager1!.id!,
        activatedAt: sixMonthsAgo, revokedAt: null, revokeReason: null,
        createdAt: new Date(sixMonthsAgo.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        investorId: investor2!.id!, managerId: manager1!.id!, status: LinkStatus.ACTIVE,
        requestedByUserId: investor2!.id!, respondedByUserId: manager1!.id!,
        activatedAt: threeMonthsAgo, revokedAt: null, revokeReason: null,
        createdAt: new Date(threeMonthsAgo.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        investorId: userMain!.id!, managerId: manager2!.id!, status: LinkStatus.ACTIVE,
        requestedByUserId: manager2!.id!, respondedByUserId: null,
        activatedAt: yesterday, revokedAt: null, revokeReason: null,
        createdAt: yesterday,
      },
      {
        investorId: investor2!.id!, managerId: manager2!.id!, status: LinkStatus.REVOKED,
        requestedByUserId: investor2!.id!, respondedByUserId: manager2!.id!,
        activatedAt: new Date(fourMonthsAgo.getTime() + 2 * 24 * 60 * 60 * 1000),
        revokedAt: fourMonthsAgo, revokeReason: RevokeReason.MANUAL_BY_INVESTOR,
        createdAt: new Date(fourMonthsAgo.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
    ];

    const savedLinks: ManagerClientLink[] = [];

    for (const linkData of linksToSeed) {
      const existing = await linkRepository.findOne({
        where: {
          investorId: linkData.investorId,
          managerId: linkData.managerId,
          status: linkData.status,
        },
      });

      if (!existing) {
        const link = linkRepository.create({
          investorId: linkData.investorId,
          managerId: linkData.managerId,
          status: linkData.status,
          requestedByUserId: linkData.requestedByUserId,
          respondedByUserId: linkData.respondedByUserId,
          activatedAt: linkData.activatedAt,
          revokedAt: linkData.revokedAt,
          revokeReason: linkData.revokeReason,
        });
        const saved = await linkRepository.save(link);
        await linkRepository.query(
          `UPDATE "manager_client_link" SET "createdAt" = $1 WHERE id = $2`,
          [linkData.createdAt, saved.id],
        );
        saved.createdAt = linkData.createdAt;
        savedLinks.push(saved);
        console.log(`✅ Link criado: investor=${linkData.investorId} → manager=${linkData.managerId} (${linkData.status})`);
      } else {
        savedLinks.push(existing);
        console.log(`ℹ️ Link já existe: investor=${linkData.investorId} → manager=${linkData.managerId} (${linkData.status})`);
      }
    }

    // ─── Histórico de vínculos (manager_client_history) ───────────────────────

    const wealthUserMain = await calcWealthForSeed(userMain!.id!);
    const wealthInvestor2 = await calcWealthForSeed(investor2!.id!);

    // ─── Snapshot do mês atual ─────────────────────────────────────────────
    // WealthHistory acima só vai até 2025-08 fixo — sem um registro no
    // início do mês corrente, "Variação mensal" (índice de aderência,
    // .docs/indice-aderencia.md) sempre mostra "—" até alguém rodar o cron
    // manualmente. Insere direto um snapshot com um delta proposital do
    // patrimônio atual: um cliente sobe (variação positiva), outro cai
    // (negativa) — dá pra ver as duas cores sem precisar rodar o job.
    const beginningOfCurrentMonth = normalizeDate(
      new Date(now.getFullYear(), now.getMonth(), 1),
    );
    const currentMonthSnapshots = [
      { userId: userMain!.id!, snapshotCents: Math.round(wealthUserMain * 0.9) },   // ~+11% no mês
      { userId: investor2!.id!, snapshotCents: Math.round(wealthInvestor2 * 1.08) }, // ~-7% no mês
    ];

    for (const { userId, snapshotCents } of currentMonthSnapshots) {
      const existing = await wealthHistoryRepository.findOne({
        where: { userId, date: beginningOfCurrentMonth },
      });
      if (!existing) {
        await wealthHistoryRepository.save(
          wealthHistoryRepository.create({
            userId,
            date: beginningOfCurrentMonth,
            totalWealthCents: snapshotCents,
          }),
        );
        console.log(`✅ Snapshot do mês atual criado (userId=${userId})`);
      } else {
        console.log(`ℹ️ Snapshot do mês atual já existe (userId=${userId})`);
      }
    }

    const [linkUserMainMgr1, linkInvestor2Mgr1, linkUserMainMgr2, linkInvestor2Mgr2Revoked] = savedLinks;

    type HistorySeed = {
      linkId: number;
      investorId: number;
      managerId: number;
      status: HistoryCycleStatus;
      cycleStartAt: Date;
      cycleEndAt: Date | null;
      initialWealthCents: number;
      finalWealthCents: number | null;
      currentWealthCents: number | null;
    };

    const historiesToSeed: HistorySeed[] = [
      {
        linkId: linkUserMainMgr1!.id!,
        investorId: userMain!.id!, managerId: manager1!.id!,
        status: HistoryCycleStatus.ACTIVE,
        cycleStartAt: sixMonthsAgo, cycleEndAt: null,
        initialWealthCents: 5_000_000,
        finalWealthCents: null,
        currentWealthCents: wealthUserMain,
      },
      {
        linkId: linkInvestor2Mgr1!.id!,
        investorId: investor2!.id!, managerId: manager1!.id!,
        status: HistoryCycleStatus.ACTIVE,
        cycleStartAt: threeMonthsAgo, cycleEndAt: null,
        initialWealthCents: 3_500_000,
        finalWealthCents: null,
        currentWealthCents: wealthInvestor2,
      },
      {
        linkId: linkUserMainMgr2!.id!,
        investorId: userMain!.id!, managerId: manager2!.id!,
        status: HistoryCycleStatus.ACTIVE,
        cycleStartAt: yesterday, cycleEndAt: null,
        initialWealthCents: wealthUserMain,
        finalWealthCents: null,
        currentWealthCents: wealthUserMain,
      },
      {
        linkId: linkInvestor2Mgr2Revoked!.id!,
        investorId: investor2!.id!, managerId: manager2!.id!,
        status: HistoryCycleStatus.CLOSED,
        cycleStartAt: new Date(fourMonthsAgo.getTime() + 2 * 24 * 60 * 60 * 1000),
        cycleEndAt: fourMonthsAgo,
        initialWealthCents: 3_000_000,
        finalWealthCents: 3_800_000,
        currentWealthCents: null,
      },
    ];

    for (const h of historiesToSeed) {
      const existing = await historyRepository.findOne({
        where: { linkId: h.linkId, investorId: h.investorId, managerId: h.managerId },
      });

      if (!existing) {
        await historyRepository.save(
          historyRepository.create({
            linkId: h.linkId,
            investorId: h.investorId,
            managerId: h.managerId,
            status: h.status,
            cycleStartAt: h.cycleStartAt,
            cycleEndAt: h.cycleEndAt,
            initialWealthCents: h.initialWealthCents,
            finalWealthCents: h.finalWealthCents,
            currentWealthCents: h.currentWealthCents,
          }),
        );
        console.log(`✅ History criado: investor=${h.investorId} manager=${h.managerId} (${h.status})`);
      } else {
        console.log(`ℹ️ History já existe: investor=${h.investorId} manager=${h.managerId}`);
      }
    }

    console.log("\n🎉 Seed concluído com sucesso!");
    await AppDataSource.destroy();
  })
  .catch((err) => {
    console.error("Error during Data Source initialization:", err);
  });
