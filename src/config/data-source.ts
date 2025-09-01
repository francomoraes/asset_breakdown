import dotenv from "dotenv";
import { DataSource } from "typeorm";
import { Asset } from "../models/Asset";
import { AssetType } from "../models/AssetType";
import { AssetClass } from "../models/AssetClass";
import { PriceCache } from "../models/PriceCache";
import { User } from "models/User";
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
