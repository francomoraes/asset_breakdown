import { AppDataSource } from "../config/data-source";
import { AssetClass } from "../models/asset-class";
import { AssetType } from "../models/asset-type";
import { Asset } from "../models/asset";
import { getMarketPriceCents } from "../utils/get-market-price";
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
        TRUNCATE TABLE "asset_type" RESTART IDENTITY CASCADE;
        TRUNCATE TABLE "asset_class" RESTART IDENTITY CASCADE;
        TRUNCATE TABLE "institution" RESTART IDENTITY CASCADE;
      `);

      await queryRunner.release();
    }

    const userRepository = AppDataSource.getRepository(User);
    const seedUsersData = [
      { email: "admin@test.com", password: "Admin123!" },
      { email: "user@test.com", password: "User123!" },
    ];

    const seedUsers: User[] = [];

    for (const userData of seedUsersData) {
      const { email, password } = userData;
      let user = await userRepository.findOneBy({ email });

      if (!user) {
        const hashedPassword = await bcrypt.hash(password, 10);
        user = userRepository.create({
          email,
          password: hashedPassword,
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

      const currentPriceCents = await getMarketPriceCents(ticker);
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

    await recalculatePortfolio(seedUsers[1].id);
    await AppDataSource.destroy();
  })
  .catch((err) => {
    console.error("Error during Data Source initialization:", err);
  });
