import "tsconfig-paths/register";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import { AppDataSource } from "./config/data-source";
import { corsOptions } from "./config/cors";
import { helmetOptions } from "./config/helmet";

import { logger } from "./utils/logger";

import {
  appLimiter,
  authLimiter,
  strictLimiter,
} from "./middlewares/rate-limit";
import { authMiddleware } from "./middlewares/auth.middleware";
import { demoProtection } from "./middlewares/demo-protection";
import { errorHandler } from "./middlewares/error-handler";
import { requestLogger } from "./middlewares/request-logger";

import assetClassRoutes from "./routes/asset-class.routes";
import assetRoutes from "./routes/assets.routes";
import assetTypeRoutes from "./routes/asset-type.routes";
import authRoutes from "./routes/auth.routes";
import csvRoutes from "./routes/csv.routes";
import institutionRoutes from "./routes/institution.routes";
import summaryRoutes from "./routes/summary.routes";
import path from "path";

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
app.use("/api/institutions", authMiddleware, institutionRoutes);
app.use(
  "/api/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(path.join(__dirname, "../uploads")),
);

// Error handler
app.use(errorHandler);

// Inicializa conexão com o banco
AppDataSource.initialize()
  .then(() => logger.info("📦 Banco conectado com sucesso"))
  .catch((err) => logger.error("Erro ao conectar banco:", err));

export default app;
