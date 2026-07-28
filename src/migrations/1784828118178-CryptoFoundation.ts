import { MigrationInterface, QueryRunner } from "typeorm";

export class CryptoFoundation1784828118178 implements MigrationInterface {
    name = 'CryptoFoundation1784828118178'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "asset_source_enum" AS ENUM('manual', 'mercado_bitcoin', 'ethereum')`);
        await queryRunner.query(`ALTER TABLE "asset" ADD "source" "asset_source_enum" NOT NULL DEFAULT 'manual'`);
        await queryRunner.query(`ALTER TABLE "asset" ADD "connectedAccountId" integer`);

        await queryRunner.query(`ALTER TABLE "price_cache" DROP CONSTRAINT "PK_c8ba9885e35341efa804e476d3d"`);
        await queryRunner.query(`ALTER TABLE "price_cache" ADD "currency" text`);
        // Backfill: mesma heurística que formatYahooTicker já usa hoje (.SA = ação BR).
        // Linhas de crypto cacheadas antes desta migration caem no "ELSE USD" mesmo se o
        // valor antigo já estivesse convertido pra BRL (bug que esta spec corrige) — risco
        // baixo na prática porque marketPriceTtlHours (4h) provavelmente já invalidou essas
        // linhas antes do deploy, e o próximo fetch as substitui de qualquer forma.
        await queryRunner.query(`UPDATE "price_cache" SET "currency" = CASE WHEN "ticker" ~ '\\.SA$' THEN 'BRL' ELSE 'USD' END`);
        await queryRunner.query(`ALTER TABLE "price_cache" ALTER COLUMN "currency" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "price_cache" ADD CONSTRAINT "PK_price_cache_ticker_currency" PRIMARY KEY ("ticker", "currency")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Assume que nenhuma linha divergente foi inserida depois do up (ticker duplicado
        // em currencies diferentes quebraria a PK original de coluna única).
        await queryRunner.query(`ALTER TABLE "price_cache" DROP CONSTRAINT "PK_price_cache_ticker_currency"`);
        await queryRunner.query(`ALTER TABLE "price_cache" DROP COLUMN "currency"`);
        await queryRunner.query(`ALTER TABLE "price_cache" ADD CONSTRAINT "PK_c8ba9885e35341efa804e476d3d" PRIMARY KEY ("ticker")`);

        await queryRunner.query(`ALTER TABLE "asset" DROP COLUMN "connectedAccountId"`);
        await queryRunner.query(`ALTER TABLE "asset" DROP COLUMN "source"`);
        await queryRunner.query(`DROP TYPE "asset_source_enum"`);
    }

}
