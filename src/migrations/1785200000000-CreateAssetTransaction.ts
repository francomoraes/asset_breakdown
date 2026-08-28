import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAssetTransaction1785200000000 implements MigrationInterface {
    name = 'CreateAssetTransaction1785200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."asset_transaction_type_enum" AS ENUM('buy', 'sell', 'dividend')`);
        await queryRunner.query(`CREATE TABLE "asset_transaction" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "last_modified_by" character varying, "assetId" integer NOT NULL, "userId" integer NOT NULL, "type" "public"."asset_transaction_type_enum" NOT NULL, "date" date NOT NULL, "quantity" numeric(18,8), "unitPriceCents" integer, "feesCents" integer NOT NULL DEFAULT 0, "totalAmountCents" integer NOT NULL, CONSTRAINT "PK_asset_transaction_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_asset_transaction_userId_date" ON "asset_transaction" ("userId", "date")`);
        await queryRunner.query(`CREATE INDEX "IDX_asset_transaction_assetId_date" ON "asset_transaction" ("assetId", "date")`);
        await queryRunner.query(`ALTER TABLE "asset_transaction" ADD CONSTRAINT "FK_asset_transaction_assetId" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "asset_transaction" DROP CONSTRAINT "FK_asset_transaction_assetId"`);
        await queryRunner.query(`DROP INDEX "IDX_asset_transaction_assetId_date"`);
        await queryRunner.query(`DROP INDEX "IDX_asset_transaction_userId_date"`);
        await queryRunner.query(`DROP TABLE "asset_transaction"`);
        await queryRunner.query(`DROP TYPE "public"."asset_transaction_type_enum"`);
    }
}
