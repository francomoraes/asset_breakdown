import { AppDataSource } from "../config/data-source";
import { ensureDataSource } from "../utils/ensure-data-source";
import { User } from "../models/user";
import { wealthHistoryService } from "../services/wealth-history.service";
import { summaryService } from "../services/summary.service";
import { logger } from "../utils/logger";

/**
 * Job que salva um snapshot do patrimônio de todos os usuários
 * Deve ser executado mensalmente (dia 1 de cada mês)
 *
 * Para configurar como cron job:
 * 0 0 1 * * node dist/jobs/monthly-wealth-snapshot.js
 * (Executa todo dia 1 de cada mês à meia-noite)
 */

async function runMonthlyWealthSnapshot() {
  try {
    await AppDataSource.initialize();
    await ensureDataSource();

    logger.info("🔄 Iniciando snapshot mensal de patrimônio...");

    const userRepository = AppDataSource.getRepository(User);
    const users = await userRepository.find();

    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        // Buscar valor total do patrimônio do usuário
        const overview = await summaryService.getOverviewByCurrency({
          userId: user.id!,
        });

        // Calcular total em BRL
        let totalInBRL = 0;

        for (const item of overview) {
          if (item.currency === "BRL") {
            totalInBRL += item.totalCents;
          } else if (item.currency === "USD") {
            // Converter USD para BRL (aproximadamente)
            // Usar taxa de câmbio aproximada ou buscar a taxa atual
            totalInBRL += Math.round(item.totalCents * 5.5); // Aproximação, ajustar conforme necessário
          }
        }

        // Se não houver patrimônio, pular
        if (totalInBRL === 0) {
          logger.info(`⚠️  Usuário ${user.email} sem patrimônio, pulando...`);
          continue;
        }

        // Salvar snapshot
        await wealthHistoryService.saveMonthlyWealthSnapshot(
          user.id!,
          totalInBRL,
        );

        logger.info(
          `✅ Snapshot salvo para usuário ${user.email}: R$ ${(totalInBRL / 100).toFixed(2)}`,
        );
        successCount++;
      } catch (error: any) {
        logger.error(
          `❌ Erro ao salvar snapshot para usuário ${user.email}:`,
          error.message,
        );
        errorCount++;
      }
    }

    logger.info(
      `✅ Job finalizado! Sucessos: ${successCount}, Erros: ${errorCount}`,
    );

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error: any) {
    logger.error("❌ Erro fatal ao executar job:", error);
    process.exit(1);
  }
}

// Executar o job
runMonthlyWealthSnapshot();
