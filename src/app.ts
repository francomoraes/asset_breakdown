import "tsconfig-paths/register";
import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import path from "path";

import { AppDataSource } from "./config/data-source";
import { corsOptions } from "./config/cors";
import { helmetOptions } from "./config/helmet";
import { config } from "./config/environment";

import { logger } from "./utils/logger";

import {
  appLimiter,
  strictLimiter,
} from "./middlewares/rate-limit";
import { authMiddleware } from "./middlewares/auth.middleware";
import { demoProtection } from "./middlewares/demo-protection";
import { errorHandler } from "./middlewares/error-handler";
import { requestLogger } from "./middlewares/request-logger";
import { requireRole } from "./middlewares/require-role.middleware";
import { UserRole } from "./enums/role.enum";

import assetClassRoutes from "./routes/asset-class.routes";
import assetRoutes from "./routes/assets.routes";
import assetTypeRoutes from "./routes/asset-type.routes";
import authRoutes from "./routes/auth.routes";
import csvRoutes from "./routes/csv.routes";
import fixedIncomeAssetRoutes from "./routes/fixed-income-asset.routes";
import institutionRoutes from "./routes/institution.routes";
import cryptoAccountRoutes from "./routes/crypto-account.routes";
import summaryRoutes from "./routes/summary.routes";
import wealthHistoryRoutes from "./routes/wealth-history.routes";
import adminRoutes from "./routes/admin.routes";
import managerLinkRoutes from "./routes/manager-link.routes";
import managerRoutes from "./routes/manager.routes";
import investorRoutes from "./routes/investor.routes";
import userRoutes from "./routes/user.routes";

const app = express();
app.set("trust proxy", 1);

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOptions));
app.use(helmetOptions);
app.use((_req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  next();
});
app.use(requestLogger);
app.use(demoProtection);
app.use(appLimiter);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
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
app.use("/api/crypto-accounts", authMiddleware, cryptoAccountRoutes);
app.use("/api/admin", authMiddleware, adminRoutes);
app.use("/api/manager-links", authMiddleware, managerLinkRoutes);
app.use("/api/managers", authMiddleware, managerRoutes);
app.use(
  "/api/investors",
  authMiddleware,
  requireRole(UserRole.MANAGER, UserRole.ADMIN),
  investorRoutes,
);
app.use(
  "/api/users",
  authMiddleware,
  requireRole(UserRole.MANAGER, UserRole.ADMIN),
  userRoutes,
);

// Arquivos estáticos de uploads — CORS restrito ao frontend configurado
const allowedUploadOrigins = config.isDevelopment
  ? [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      "http://localhost:8080",
      "http://192.168.1.24:8080",
    ]
  : config.frontendUrl
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);

app.use(
  "/api/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    const origin = req.headers.origin;
    if (origin && allowedUploadOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
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
