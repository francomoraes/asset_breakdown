import { AppDataSource } from "config/data-source";
import { AssetClass } from "models/AssetClass";
import { AssetType } from "models/AssetType";
import { Asset } from "models/Asset";
import { getMarketPriceCents } from "utils/getMarketPrice";
import { calculateDerivedFields } from "utils/calculateDerivedFields";
import { recalculatePortfolio } from "utils/recalculatePortfolio";
import { ensureDataSource } from "utils/ensureDataSource";

AppDataSource.initialize()
  .then(async () => {
    await ensureDataSource();

    console.log("Data Source has been initialized!");

    const shouldReset = process.argv.includes("--reset");
    const shouldClearPriceCache = process.argv.includes("--clear-price-cache");

    if (shouldReset) {
      console.log("🧨 Resetando banco com TRUNCATE CASCADE...");

      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();

      await queryRunner.query(`
        TRUNCATE TABLE "asset" RESTART IDENTITY CASCADE;
        TRUNCATE TABLE "asset_type" RESTART IDENTITY CASCADE;
        TRUNCATE TABLE "asset_class" RESTART IDENTITY CASCADE;
      `);

      await queryRunner.release();
    }

    if (shouldClearPriceCache) {
      console.log("🧨 Limpando cache de preços...");

      await AppDataSource.getRepository("PriceCache").clear();
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
      const existing = await assetClassRespository.findOneBy({ name });
      if (!existing) {
        const newClass = assetClassRespository.create({ name });
        await assetClassRespository.save(newClass);
        console.log(`Asset Class created: ${name}`);
      } else {
        console.log(`Asset Class already exists: ${name}`);
      }
    }

    const assetTypeRepository = AppDataSource.getRepository(AssetType);
    const assetTypes = [
      // Renda Fixa
      { name: "Pós-fixado", class: "Renda Fixa", targetPercentage: 0 },
      { name: "Inflação", class: "Renda Fixa", targetPercentage: 0 },
      { name: "Pré-fixado", class: "Renda Fixa", targetPercentage: 0 },
      { name: "Bonds Curtos", class: "Renda Fixa", targetPercentage: 0 },
      { name: "Caixa BRL", class: "Renda Fixa", targetPercentage: 0 },

      // Mercado Imobiliário
      { name: "Reits", class: "Mercado Imobiliário", targetPercentage: 0 },
      { name: "FIIs", class: "Mercado Imobiliário", targetPercentage: 0 },

      // Ações
      { name: "Stocks", class: "Stocks", targetPercentage: 0 },

      // Metais / Commodities
      { name: "Ouro", class: "Metais / Commodities", targetPercentage: 0 },
      { name: "Prata", class: "Metais / Commodities", targetPercentage: 0 },

      // Criptomoedas
      { name: "Caixa Cripto", class: "Criptomoedas", targetPercentage: 0 },
      { name: "Bitcoin", class: "Criptomoedas", targetPercentage: 0 },
      { name: "Altcoin", class: "Criptomoedas", targetPercentage: 0 },
    ];

    for (const { name, class: className, targetPercentage } of assetTypes) {
      const assetClass = await assetClassRespository.findOneBy({
        name: className,
      });

      if (!assetClass) {
        console.warn(`Class ${className} not found`);
        continue;
      }

      const existing = await assetTypeRepository.findOneBy({ name });

      if (!existing) {
        const newType = assetTypeRepository.create({
          name,
          targetPercentage,
          assetClass,
        });
        await assetTypeRepository.save(newType);
        console.log(`Asset type created: ${name}`);
      } else {
        console.log(`Asset type already exists: ${name}`);
      }
    }

    const assetRepository = AppDataSource.getRepository(Asset);
    const seedAssets = [
      {
        type: "Bonds Curtos",
        ticker: "SHV",
        quantity: 23.28,
        averagePrice: 110.35,
      },
      { type: "Ouro", ticker: "IAU", quantity: 70.0, averagePrice: 35.56 },
      { type: "Prata", ticker: "SLV", quantity: 66.0, averagePrice: 20.92 },
      { type: "Reits", ticker: "VNQ", quantity: 16.44, averagePrice: 83.64 },
      { type: "Stocks", ticker: "SPY", quantity: 0.5, averagePrice: 376.51 },
      { type: "Stocks", ticker: "EWZ", quantity: 8.07, averagePrice: 31.6 },
      {
        type: "Inflação",
        ticker: "B5P211",
        quantity: 121.0,
        averagePrice: 88.66,
      },
      {
        type: "Inflação",
        ticker: "JURO11",
        quantity: 171.0,
        averagePrice: 104.78,
      },
      {
        type: "Pós-fixado",
        ticker: "CDII11",
        quantity: 146.0,
        averagePrice: 106.02,
      },
      {
        type: "Altcoin",
        ticker: "ETH",
        quantity: 0.36,
        averagePrice: 10485.73,
      },
      {
        type: "Bitcoin",
        ticker: "BTC",
        quantity: 0.04,
        averagePrice: 220930.03,
      },
      { type: "FIIs", ticker: "TRXF11", quantity: 10.0, averagePrice: 97.62 },
      { type: "FIIs", ticker: "RECR11", quantity: 15.0, averagePrice: 84.46 },
      { type: "Stocks", ticker: "SPGP", quantity: 0.68, averagePrice: 94.7 },
    ];

    for (const { ticker, type, quantity, averagePrice } of seedAssets) {
      const assetType = await assetTypeRepository.findOneBy({ name: type });

      if (!assetType) {
        console.warn(`Asset type ${type} not found for ticker ${ticker}`);
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

      const existing = await assetRepository.findOneBy({ ticker });

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
          institution: "Teste",
          currency: "USD",
          type: assetType,
        });

        await assetRepository.save(asset);
        console.log(`✅ Ativo criado: ${ticker}`);
      } else {
        console.log(`ℹ️ Ativo já existe: ${ticker}`);
      }
    }

    await recalculatePortfolio();
    await AppDataSource.destroy();
  })
  .catch((err) => {
    console.error("Error during Data Source initialization:", err);
  });
