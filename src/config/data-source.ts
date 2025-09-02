import dotenv from "dotenv";
import { DataSource } from "typeorm";
import { Asset } from "../models/asset";
import { AssetType } from "../models/asset-type";
import { AssetClass } from "../models/asset-class";
import { PriceCache } from "../models/price-cache";
import { User } from "../models/user";
dotenv.config();

const shouldDropSchema = process.argv.includes("--drop-schema");

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  synchronize: true,
  logging: false,
  dropSchema: shouldDropSchema,
  entities: [Asset, AssetType, AssetClass, PriceCache, User],
});
