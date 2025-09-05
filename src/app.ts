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

dotenv.config();

const app = express();

// Middlewares
app.use(express.json());

// Rotas
app.use("/api", authRoutes);
app.use("/api", authMiddleware, csvRoutes);
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
