import { AppDataSource } from "../config/data-source";
import { logger } from "./logger";

export async function ensureDataSource() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    logger.info("📦 AppDataSource inicializado automaticamente");
  }
}
