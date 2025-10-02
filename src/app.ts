import "tsconfig-paths/register";
import express from "express";
import dotenv from "dotenv";
import { AppDataSource } from "./config/data-source";
import csvRoutes from "./routes/csv.routes";
import assetRoutes from "./routes/assets.routes";
import summaryRoutes from "./routes/summary.routes";
import assetTypeRoutes from "./routes/asset-type.routes";
import authRoutes from "./routes/auth.routes";
import assetClassRoutes from "./routes/asset-class.routes";
import { errorHandler } from "./middlewares/error-handler";
import { authMiddleware } from "./middlewares/auth.middleware";
import {
  appLimiter,
  authLimiter,
  strictLimiter,
} from "./middlewares/rate-limit";
import { corsOptions } from "./config/cors";
import cors from "cors";
import { helmetOptions } from "./config/helmet";
import { requestLogger } from "./middlewares/request-logger";
import { logger } from "./utils/logger";
import { demoProtection } from "./middlewares/demo-protection";

dotenv.config();

const app = express();

// Middlewares
app.use(express.json());
app.use(cors(corsOptions));
app.use(helmetOptions);
app.use(requestLogger);
app.use(demoProtection);
app.use(appLimiter);

// Rotas
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/csv", authMiddleware, strictLimiter, csvRoutes);
app.use("/api/assets", authMiddleware, assetRoutes);
app.use("/api/summary", authMiddleware, summaryRoutes);
app.use("/api/asset-class", authMiddleware, assetClassRoutes);
app.use("/api/asset-type", authMiddleware, assetTypeRoutes);

// Error handler
app.use(errorHandler);

// Inicializa conexão com o banco
AppDataSource.initialize()
  .then(() => logger.info("📦 Banco conectado com sucesso"))
  .catch((err) => logger.error("Erro ao conectar banco:", err));

export default app;
