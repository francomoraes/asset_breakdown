import { AppDataSource } from "config/data-source";

export async function ensureDataSource() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    console.log("📦 AppDataSource inicializado automaticamente");
  }
}
