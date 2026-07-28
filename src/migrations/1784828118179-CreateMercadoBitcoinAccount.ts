import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMercadoBitcoinAccount1784828118179 implements MigrationInterface {
    name = 'CreateMercadoBitcoinAccount1784828118179'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "connected_account_status_enum" AS ENUM('active', 'error', 'disabled')`);
        await queryRunner.query(`CREATE TABLE "mercado_bitcoin_account" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "last_modified_by" character varying, "userId" integer NOT NULL, "label" text, "institutionId" integer NOT NULL, "assetTypeId" integer NOT NULL, "externalAccountId" text NOT NULL, "status" "connected_account_status_enum" NOT NULL DEFAULT 'active', "lastSyncedAt" TIMESTAMP, "lastSyncError" text, "credentialsEncrypted" text NOT NULL, "iv" text NOT NULL, "authTag" text NOT NULL, CONSTRAINT "PK_mercado_bitcoin_account_id" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "mercado_bitcoin_account"`);
        await queryRunner.query(`DROP TYPE "connected_account_status_enum"`);
    }

}
