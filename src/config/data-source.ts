import path from "path";
import { DataSource } from "typeorm";
import { config } from "./environment";
import { Asset } from "../models/asset";
import { AssetType } from "../models/asset-type";
import { AssetClass } from "../models/asset-class";
import { PriceCache } from "../models/price-cache";
import { User } from "../models/user";
import { Institution } from "models/institution";
import { FixedIncomeAsset } from "../models/fixed-income-asset";
import { IndexRateCache } from "../models/index-rate-cache";
import { WealthHistory } from "../models/wealth-history";
import { ExchangeRateCache } from "../models/exchange-rate-cache";
import { MarketIndexCache } from "../models/market-index-cache";
import { ManagerClientLink } from "../models/manager-client-link";
import { ManagerClientHistory } from "../models/manager-client-history";

const shouldDropSchema = process.argv.includes("--drop-schema");

const connectionConfig = process.env.DATABASE_URL
  ? {
      url: process.env.DATABASE_URL,
    }
  : {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    };

export const AppDataSource = new DataSource({
  type: "postgres",
  ...connectionConfig,
  synchronize: !config.isProduction,
  logging: false,
  dropSchema: shouldDropSchema,
  migrations: [path.join(__dirname, "..", "migrations", "*.{ts,js}")],
  entities: [
    Asset,
    AssetType,
    AssetClass,
    PriceCache,
    User,
    Institution,
    FixedIncomeAsset,
    IndexRateCache,
    WealthHistory,
    ExchangeRateCache,
    MarketIndexCache,
    ManagerClientLink,
    ManagerClientHistory,
  ],
});
