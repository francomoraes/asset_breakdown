import "tsconfig-paths/register";
import express from "express";
import dotenv from "dotenv";
import { AppDataSource } from "./config/data-source";
import csvRoutes from "./routes/csv.routes";
import assetRoutes from "./routes/assets.routes";
import summaryRoutes from "./routes/summary.routes";
import assetTypeRoutes from "./routes/asset-type.routes";
import authRoutes from "./routes/auth.routes";
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

dotenv.config();

const app = express();

// Middlewares
app.use(express.json());
app.use(cors(corsOptions));
app.use(helmetOptions);
app.use(appLimiter);

// Rotas
app.use("/api", authLimiter, authRoutes);
app.use("/api", authMiddleware, strictLimiter, csvRoutes);
app.use("/api", authMiddleware, assetRoutes);
app.use("/api", authMiddleware, summaryRoutes);
app.use("/api", authMiddleware, assetTypeRoutes);
// Error handler
app.use(errorHandler);

// Inicializa conexão com o banco
AppDataSource.initialize()
  .then(() => console.log("📦 Banco conectado com sucesso"))
  .catch((err) => console.error("Erro ao conectar banco:", err));

export default app;
