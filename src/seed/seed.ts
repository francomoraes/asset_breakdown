import { AppDataSource } from "../config/data-source";
import { AssetClass } from "../models/asset-class";
import { AssetType } from "../models/asset-type";
import { Asset } from "../models/asset";
import { FixedIncomeAsset } from "../models/fixed-income-asset";
import { getMarketPriceCentsBatch } from "../utils/get-market-price-batch";
import { calculateDerivedFields } from "../utils/calculate-derived-fields";
import { recalculatePortfolio } from "../utils/recalculate-portfolio";
import { ensureDataSource } from "../utils/ensure-data-source";
import { PriceCache } from "../models/price-cache";
import { User } from "../models/user";
import bcrypt from "bcrypt";
import { Institution } from "models/institution";

AppDataSource.initialize()
  .then(async () => {
    await ensureDataSource();

    const shouldReset = process.argv.includes("--reset");
    const shouldClearPriceCache = process.argv.includes("--clear-price-cache");

    if (shouldReset) {
      console.log("🧨 Resetando banco com TRUNCATE CASCADE...");

      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();

      await queryRunner.query(`
        TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;
        TRUNCATE TABLE "asset" RESTART IDENTITY CASCADE;
        TRUNCATE TABLE "fixed_income_asset" RESTART IDENTITY CASCADE;
        TRUNCATE TABLE "asset_type" RESTART IDENTITY CASCADE;
        TRUNCATE TABLE "asset_class" RESTART IDENTITY CASCADE;
        TRUNCATE TABLE "institution" RESTART IDENTITY CASCADE;
      `);

      await queryRunner.release();
    }

    const userRepository = AppDataSource.getRepository(User);
    const seedUsersData = [
      {
        email: "admin@test.com",
        password: "Admin123!",
        name: "Admin User",
        locale: "pt-br",
      },
      {
        email: "user@test.com",
        password: "User123!",
        name: "Regular User",
        locale: "pt-br",
      },
    ];

    const seedUsers: User[] = [];

    for (const userData of seedUsersData) {
      const { email, password, name, locale } = userData;
      let user = await userRepository.findOneBy({ email });

      if (!user) {
        const hashedPassword = await bcrypt.hash(password, 10);
        user = userRepository.create({
          email,
          password: hashedPassword,
          name,
          locale,
        });
        await userRepository.save(user);
        console.log(`User created: ${email}`);
      } else {
        console.log(`User already exists: ${email}`);
      }

      seedUsers.push(user);
    }

    if (shouldClearPriceCache) {
      console.log("🧨 Limpando cache de preços...");

      await AppDataSource.getRepository(PriceCache).clear();
    }

    const assetClassRespository = AppDataSource.getRepository(AssetClass);
    const assetClasses = [
      "Renda Fixa",
      "Mercado Imobiliário",
      "Stocks",
      "Metais / Commodities",
      "Criptomoedas",
    ];

    for (const name of assetClasses) {
      const existing = await assetClassRespository.findOneBy({
        name,
        userId: seedUsers[1].id,
      });
      if (!existing) {
        const newClass = assetClassRespository.create({
          name,
          userId: seedUsers[1].id,
        });
        await assetClassRespository.save(newClass);
        console.log(`Asset Class created: ${name}`);
      } else {
        console.log(`Asset Class already exists: ${name}`);
      }
    }

    const assetTypeRepository = AppDataSource.getRepository(AssetType);
    const assetTypes = [
      // Renda Fixa
      { name: "Pós-fixado", class: "Renda Fixa", targetPercentage: 0.05 },
      { name: "Inflação", class: "Renda Fixa", targetPercentage: 0.05 },
      { name: "Pré-fixado", class: "Renda Fixa", targetPercentage: 0.05 },
      { name: "Bonds Curtos", class: "Renda Fixa", targetPercentage: 0.05 },
      { name: "Caixa BRL", class: "Renda Fixa", targetPercentage: 0.05 },

      // Mercado Imobiliário
      { name: "Reits", class: "Mercado Imobiliário", targetPercentage: 0.05 },
      { name: "FIIs", class: "Mercado Imobiliário", targetPercentage: 0.05 },

      // Ações
      { name: "Stocks", class: "Stocks", targetPercentage: 0.05 },

      // Metais / Commodities
      { name: "Ouro", class: "Metais / Commodities", targetPercentage: 0.05 },
      { name: "Prata", class: "Metais / Commodities", targetPercentage: 0.05 },

      // Criptomoedas
      { name: "Caixa Cripto", class: "Criptomoedas", targetPercentage: 0.05 },
      { name: "Bitcoin", class: "Criptomoedas", targetPercentage: 0.05 },
      { name: "Altcoin", class: "Criptomoedas", targetPercentage: 0.4 },
    ];

    for (const { name, class: className, targetPercentage } of assetTypes) {
      const assetClass = await assetClassRespository.findOneBy({
        name: className,
        userId: seedUsers[1].id,
      });

      if (!assetClass) {
        console.warn(`Class ${className} not found`);
        continue;
      }

      const existing = await assetTypeRepository.findOneBy({
        name,
        userId: seedUsers[1].id,
      });

      if (!existing) {
        const newType = assetTypeRepository.create({
          name,
          targetPercentage,
          assetClass,
          userId: seedUsers[1].id,
        });
        await assetTypeRepository.save(newType);
        console.log(`Asset type created: ${name}`);
      } else {
        console.log(`Asset type already exists: ${name}`);
      }
    }

    const institutionsRepository = AppDataSource.getRepository(Institution);
    const institutionsData = [
      {
        name: "Avenue",
        userId: seedUsers[1].id,
      },
      {
        name: "XP Investimentos",
        userId: seedUsers[1].id,
      },
      {
        name: "Binance",
        userId: seedUsers[1].id,
      },
    ];

    const institutions: Institution[] = [];

    for (const instData of institutionsData) {
      let institution = await institutionsRepository.findOneBy({
        name: instData.name,
        userId: instData.userId,
      });

      if (!institution) {
        institution = institutionsRepository.create(instData);
        await institutionsRepository.save(institution);
        console.log(`Institution created: ${institution.name}`);
      } else {
        console.log(`Institution already exists: ${institution.name}`);
      }

      institutions.push(institution);
    }

    const assetRepository = AppDataSource.getRepository(Asset);
    const seedAssets = [
      {
        type: "Bonds Curtos",
        ticker: "SHV",
        quantity: 23.28,
        averagePrice: 110.35,
        currency: "USD",
        institution: institutions[0].name,
      },
      {
        type: "Ouro",
        ticker: "IAU",
        quantity: 70.0,
        averagePrice: 35.56,
        currency: "USD",
        institution: institutions[0].name,
      },
      {
        type: "Prata",
        ticker: "SLV",
        quantity: 66.0,
        averagePrice: 20.92,
        currency: "USD",
        institution: institutions[0].name,
      },
      {
        type: "Reits",
        ticker: "VNQ",
        quantity: 16.44,
        averagePrice: 83.64,
        currency: "USD",
        institution: institutions[0].name,
      },
      {
        type: "Stocks",
        ticker: "SPY",
        quantity: 0.5,
        averagePrice: 376.51,
        currency: "USD",
        institution: institutions[0].name,
      },
      {
        type: "Stocks",
        ticker: "EWZ",
        quantity: 8.07,
        averagePrice: 31.6,
        currency: "USD",
        institution: institutions[0].name,
      },
      {
        type: "Inflação",
        ticker: "B5P211",
        quantity: 121.0,
        averagePrice: 88.66,
        currency: "BRL",
        institution: institutions[1].name,
      },
      {
        type: "Inflação",
        ticker: "JURO11",
        quantity: 171.0,
        averagePrice: 104.78,
        currency: "BRL",
        institution: institutions[1].name,
      },
      {
        type: "Pós-fixado",
        ticker: "CDII11",
        quantity: 146.0,
        averagePrice: 106.02,
        currency: "BRL",
        institution: institutions[1].name,
      },
      {
        type: "Altcoin",
        ticker: "ETH-USD",
        quantity: 0.36,
        averagePrice: 2485.73,
        currency: "USD",
        institution: institutions[2].name,
      },
      {
        type: "Bitcoin",
        ticker: "BTC-USD",
        quantity: 0.04,
        averagePrice: 40930.03,
        currency: "USD",
        institution: institutions[2].name,
      },
      {
        type: "FIIs",
        ticker: "TRXF11",
        quantity: 10.0,
        averagePrice: 97.62,
        currency: "BRL",
        institution: institutions[1].name,
      },
      {
        type: "FIIs",
        ticker: "RECR11",
        quantity: 15.0,
        averagePrice: 84.46,
        currency: "BRL",
        institution: institutions[1].name,
      },
      {
        type: "Stocks",
        ticker: "SPGP",
        quantity: 0.68,
        averagePrice: 94.7,
        currency: "USD",
        institution: institutions[0].name,
      },
    ];

    // Buscar todos os preços em batch (uma única requisição)
    console.log("🔍 Buscando preços em batch...");
    const allTickers = seedAssets.map((a) => a.ticker);
    const pricesMap = await getMarketPriceCentsBatch(allTickers);
    console.log(`✅ ${pricesMap.size} preços obtidos`);

    for (const {
      ticker,
      type,
      quantity,
      averagePrice,
      currency,
      institution,
    } of seedAssets) {
      const assetType = await assetTypeRepository.findOneBy({
        name: type,
        userId: seedUsers[1].id,
      });

      if (!assetType) {
        console.warn(`Asset type ${type} not found for ticker ${ticker}`);
        continue;
      }

      const assetInstitution = await institutionsRepository.findOneBy({
        name: institution,
        userId: seedUsers[1].id,
      });

      if (!assetInstitution) {
        console.warn(
          `Institution ${institution} not found for ticker ${ticker}`,
        );
        continue;
      }

      const currentPriceCents = pricesMap.get(ticker);

      if (!currentPriceCents) {
        console.warn(`⚠️  Preço não encontrado para ${ticker}, pulando...`);
        continue;
      }

      const averagePriceCents = Math.round(averagePrice * 100);

      const {
        investedValueCents,
        currentValueCents,
        resultCents,
        returnPercentage,
      } = calculateDerivedFields(
        quantity,
        averagePriceCents,
        currentPriceCents,
      );

      const existing = await assetRepository.findOneBy({
        ticker,
        userId: seedUsers[1].id,
      });

      if (!existing) {
        const asset = assetRepository.create({
          ticker,
          quantity,
          averagePriceCents,
          currentPriceCents,
          investedValueCents,
          currentValueCents,
          resultCents,
          returnPercentage,
          portfolioPercentage: 0,
          institution: assetInstitution,
          currency,
          type: assetType,
          userId: seedUsers[1].id,
        });

        await assetRepository.save(asset);
        console.log(`✅ Ativo criado: ${ticker}`);
      } else {
        console.log(`ℹ️ Ativo já existe: ${ticker}`);
      }
    }

    // Seed Fixed Income Assets
    console.log("💰 Criando ativos de renda fixa...");
    const fixedIncomeAssetRepository =
      AppDataSource.getRepository(FixedIncomeAsset);

    const seedFixedIncomeAssets = [
      {
        description: "CDB XP 100% CDI",
        startDate: new Date("2024-01-15"),
        maturityDate: new Date("2026-01-15"),
        interestRate: 13.65, // 100% do CDI
        investedValueCents: 1000000, // R$ 10.000,00
        currency: "BRL",
        institution: institutions[1].name, // XP Investimentos
        type: "Pós-fixado",
      },
      {
        description: "Tesouro IPCA+ 2029",
        startDate: new Date("2023-06-10"),
        maturityDate: new Date("2029-05-15"),
        interestRate: 6.5, // IPCA + 6.5%
        investedValueCents: 500000, // R$ 5.000,00
        currency: "BRL",
        institution: institutions[1].name,
        type: "Inflação",
      },
      {
        description: "LCI Banco XP",
        startDate: new Date("2024-03-20"),
        maturityDate: new Date("2026-03-20"),
        interestRate: 11.2, // 82% do CDI
        investedValueCents: 1500000, // R$ 15.000,00
        currency: "BRL",
        institution: institutions[1].name,
        type: "Pós-fixado",
      },
      {
        description: "Tesouro Prefixado 2027",
        startDate: new Date("2024-01-05"),
        maturityDate: new Date("2027-01-01"),
        interestRate: 12.0, // Taxa prefixada
        investedValueCents: 800000, // R$ 8.000,00
        currency: "BRL",
        institution: institutions[1].name,
        type: "Pré-fixado",
      },
      {
        description: "CDB Banco Inter 110% CDI",
        startDate: new Date("2024-02-10"),
        maturityDate: new Date("2025-02-10"),
        interestRate: 15.0, // 110% do CDI
        investedValueCents: 300000, // R$ 3.000,00
        currency: "BRL",
        institution: institutions[1].name,
        type: "Pós-fixado",
      },
    ];

    for (const fiAsset of seedFixedIncomeAssets) {
      const assetType = await assetTypeRepository.findOneBy({
        name: fiAsset.type,
        userId: seedUsers[1].id,
      });

      if (!assetType) {
        console.warn(
          `Asset type ${fiAsset.type} not found for ${fiAsset.description}`,
        );
        continue;
      }

      const assetInstitution = await institutionsRepository.findOneBy({
        name: fiAsset.institution,
        userId: seedUsers[1].id,
      });

      if (!assetInstitution) {
        console.warn(
          `Institution ${fiAsset.institution} not found for ${fiAsset.description}`,
        );
        continue;
      }

      // Calcular valores derivados
      const now = new Date();
      const calculationDate =
        now > fiAsset.maturityDate ? fiAsset.maturityDate : now;

      const daysElapsed = Math.floor(
        (calculationDate.getTime() - fiAsset.startDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      const dailyRate = Math.pow(1 + fiAsset.interestRate / 100, 1 / 365) - 1;
      const currentValueCents = Math.round(
        fiAsset.investedValueCents * Math.pow(1 + dailyRate, daysElapsed),
      );
      const resultCents = currentValueCents - fiAsset.investedValueCents;
      const returnPercentage =
        fiAsset.investedValueCents > 0
          ? Number(
              ((resultCents / fiAsset.investedValueCents) * 100).toFixed(2),
            )
          : 0;

      const existing = await fixedIncomeAssetRepository.findOne({
        where: {
          description: fiAsset.description,
          userId: seedUsers[1].id,
        },
      });

      if (!existing) {
        const fixedIncomeAsset = fixedIncomeAssetRepository.create({
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
          userId: seedUsers[1].id,
        });

        await fixedIncomeAssetRepository.save(fixedIncomeAsset);
        console.log(`✅ Ativo de renda fixa criado: ${fiAsset.description}`);
      } else {
        console.log(`ℹ️ Ativo de renda fixa já existe: ${fiAsset.description}`);
      }
    }

    await recalculatePortfolio(seedUsers[1].id);
    await AppDataSource.destroy();
  })
  .catch((err) => {
    console.error("Error during Data Source initialization:", err);
  });
