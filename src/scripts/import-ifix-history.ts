import * as fs from "fs";
import * as path from "path";
import { AppDataSource } from "../config/data-source";
import { ensureDataSource } from "../utils/ensure-data-source";
import { MarketIndexCache } from "../models/market-index-cache";

const IFIX_SYMBOL = "IFIX";

function parseBrNumber(raw: string): number {
  return Number(raw.trim().replace(/\./g, "").replace(",", "."));
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Uso: npm run import:ifix -- <caminho-do-csv>");
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);
  const content = fs.readFileSync(resolvedPath, "utf-8");
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

  const dataLines = lines.slice(2);
  if (dataLines.length === 0) {
    console.error("Nenhuma linha de dado encontrada após o cabeçalho.");
    process.exit(1);
  }

  const fetchedAt = new Date();
  const rows = dataLines.map((line) => {
    const [mes, ano, valor] = line.split(";");
    return {
      symbol: IFIX_SYMBOL,
      date: new Date(Date.UTC(Number(ano), Number(mes) - 1, 1, 12, 0, 0)),
      value: parseBrNumber(valor),
      fetchedAt,
    };
  });

  await ensureDataSource();
  const repo = AppDataSource.getRepository(MarketIndexCache);
  await repo.upsert(rows, ["symbol", "date"]);

  const sorted = [...rows].sort((a, b) => a.date.getTime() - b.date.getTime());
  console.log(
    `✅ ${rows.length} pontos do IFIX importados/atualizados ` +
      `(${sorted[0].date.toISOString().slice(0, 7)} a ${sorted[sorted.length - 1].date.toISOString().slice(0, 7)}).`,
  );

  await AppDataSource.destroy();
}

main().catch((error) => {
  console.error("Falha ao importar histórico do IFIX:", error);
  process.exit(1);
});
