import express from "express";
import dotenv from "dotenv";
import { AppDataSource } from "./config/data-source";
import csvRoutes from "./routes/csv.routes";
import assetRoutes from "./routes/assets.routes";
import summaryRoutes from "./routes/summary.routes";
import assetTypeRoutes from "./routes/assetType.routes";

dotenv.config();

const app = express();

// Middlewares
app.use(express.json());

// Rotas
app.use("/api", csvRoutes);
app.use("/api", assetRoutes);
app.use("/api", summaryRoutes);
app.use("/api", assetTypeRoutes);

// Inicializa conexão com o banco
AppDataSource.initialize()
  .then(() => console.log("📦 Banco conectado com sucesso"))
  .catch((err) => console.error("Erro ao conectar banco:", err));

export default app;
