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
import fixedIncomeAssetRoutes from "./routes/fixed-income-asset.routes";
import institutionRoutes from "./routes/institution.routes";
import summaryRoutes from "./routes/summary.routes";
import wealthHistoryRoutes from "./routes/wealth-history.routes";
import path from "path";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

// Middlewares
app.use(express.json());
app.use(cors(corsOptions));
app.use(helmetOptions);
app.use(requestLogger);
app.use(demoProtection);
app.use(appLimiter);

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Rotas
app.use("/api/auth", authRoutes);
app.use("/api/csv", authMiddleware, strictLimiter, csvRoutes);
app.use("/api/assets", authMiddleware, assetRoutes);
app.use("/api/fixed-income-assets", authMiddleware, fixedIncomeAssetRoutes);
app.use("/api/summary", authMiddleware, summaryRoutes);
app.use("/api/wealth-history", authMiddleware, wealthHistoryRoutes);
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
