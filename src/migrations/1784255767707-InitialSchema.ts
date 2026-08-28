import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1784255767707 implements MigrationInterface {
    name = 'InitialSchema1784255767707'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "asset_class" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "last_modified_by" character varying, "name" text NOT NULL, "userId" integer NOT NULL, CONSTRAINT "PK_3842a384185a26bf0ac5a833679" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "asset_type" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "last_modified_by" character varying, "name" text NOT NULL, "targetPercentage" numeric(5,2) NOT NULL, "userId" integer NOT NULL, "assetClassId" integer, CONSTRAINT "PK_9b5ee2748943131ed9d9831e8c9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "institution" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "last_modified_by" character varying, "name" text NOT NULL, "userId" integer NOT NULL, CONSTRAINT "PK_f60ee4ff0719b7df54830b39087" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "asset" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "last_modified_by" character varying, "userId" integer NOT NULL, "ticker" text NOT NULL, "quantity" numeric(18,8) NOT NULL, "averagePriceCents" integer NOT NULL, "currentPriceCents" integer NOT NULL, "investedValueCents" integer NOT NULL, "currentValueCents" integer NOT NULL, "resultCents" integer NOT NULL, "returnPercentage" numeric(12,2) NOT NULL, "portfolioPercentage" numeric(12,2) NOT NULL, "currency" text NOT NULL, "priceUnavailable" boolean NOT NULL DEFAULT false, "typeId" integer, "institutionId" integer, CONSTRAINT "PK_1209d107fe21482beaea51b745e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "price_cache" ("ticker" text NOT NULL, "value" integer NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c8ba9885e35341efa804e476d3d" PRIMARY KEY ("ticker"))`);
        await queryRunner.query(`CREATE TYPE "user_role_enum" AS ENUM('investor', 'manager', 'admin')`);
        await queryRunner.query(`CREATE TABLE "user" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "last_modified_by" character varying, "email" text NOT NULL, "name" text NOT NULL, "password" character varying NOT NULL, "profilePictureUrl" text, "locale" text, "role" "user_role_enum" NOT NULL DEFAULT 'investor', "managerClientLimit" integer, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "fixed_income_asset" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "last_modified_by" character varying, "userId" integer NOT NULL, "description" text NOT NULL, "startDate" TIMESTAMP, "maturityDate" TIMESTAMP, "indexationMode" text NOT NULL DEFAULT 'PRE', "interestRate" numeric(10,2), "investedValueCents" integer NOT NULL, "currentValueCents" integer NOT NULL, "resultCents" integer NOT NULL, "returnPercentage" numeric(12,2) NOT NULL, "portfolioPercentage" numeric(12,2) NOT NULL, "manualMode" boolean NOT NULL DEFAULT false, "currency" text NOT NULL, "typeId" integer, "institutionId" integer, CONSTRAINT "PK_f580fd87dbcd9b2cff84efb77a1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "index_rate_cache" ("id" SERIAL NOT NULL, "indexType" text NOT NULL, "date" date NOT NULL, "value" numeric(10,6) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_78eec5f843955cfc3f4260c7739" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e7ca9f485ac3d29fee98c5580b" ON "index_rate_cache" ("indexType", "date") `);
        await queryRunner.query(`CREATE TABLE "wealth_history" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "last_modified_by" character varying, "userId" integer NOT NULL, "date" date NOT NULL, "totalWealthCents" numeric(15,2) NOT NULL, CONSTRAINT "PK_cc2d9e184a3187eb115bf6b1dda" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ddae234089f674615cc160caf3" ON "wealth_history" ("userId", "date") `);
        await queryRunner.query(`CREATE TABLE "exchange_rate_cache" ("pair" text NOT NULL, "value" double precision NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ecab942602e7709cbe3a8710b82" PRIMARY KEY ("pair"))`);
        await queryRunner.query(`CREATE TABLE "market_index_cache" ("id" SERIAL NOT NULL, "symbol" text NOT NULL, "date" date NOT NULL, "value" numeric(12,4) NOT NULL, "fetchedAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5eeceb6e9d285e83b1fc56b564e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4af0a96d12b3ce64e1314ca521" ON "market_index_cache" ("symbol", "date") `);
        await queryRunner.query(`CREATE TYPE "manager_client_link_status_enum" AS ENUM('pending', 'active', 'rejected', 'revoked')`);
        await queryRunner.query(`CREATE TYPE "manager_client_link_revokeReason_enum" AS ENUM('manual_by_investor', 'manual_by_manager', 'role_removed')`);
        await queryRunner.query(`CREATE TABLE "manager_client_link" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "last_modified_by" character varying, "investorId" integer NOT NULL, "managerId" integer NOT NULL, "status" "manager_client_link_status_enum" NOT NULL DEFAULT 'pending', "requestedByUserId" integer NOT NULL, "respondedByUserId" integer, "activatedAt" TIMESTAMP, "rejectedAt" TIMESTAMP, "revokedAt" TIMESTAMP, "revokeReason" "manager_client_link_revokeReason_enum", CONSTRAINT "PK_acd7a3b882f72e92d3ec4b58215" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_40fad4a0d57f2b2c7ff4a2012f" ON "manager_client_link" ("managerId", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_6c2dc0b1efa47be1a8e36e8a19" ON "manager_client_link" ("investorId", "managerId", "status") `);
        await queryRunner.query(`CREATE TYPE "manager_client_history_status_enum" AS ENUM('active', 'closed')`);
        await queryRunner.query(`CREATE TABLE "manager_client_history" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "last_modified_by" character varying, "investorId" integer NOT NULL, "managerId" integer NOT NULL, "linkId" integer NOT NULL, "status" "manager_client_history_status_enum" NOT NULL DEFAULT 'active', "cycleStartAt" TIMESTAMP NOT NULL, "cycleEndAt" TIMESTAMP, "initialWealthCents" bigint NOT NULL, "finalWealthCents" bigint, "currentWealthCents" bigint, CONSTRAINT "PK_12e572734696e7b2bfe69a1d2e0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a8ac44748b24b53624a015c92d" ON "manager_client_history" ("investorId", "managerId", "status") `);
        await queryRunner.query(`ALTER TABLE "asset_type" ADD CONSTRAINT "FK_927aecb9813afd99d3fc8b093bf" FOREIGN KEY ("assetClassId") REFERENCES "asset_class"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset" ADD CONSTRAINT "FK_bc5bb7225b951dcc4cba1bc1c03" FOREIGN KEY ("typeId") REFERENCES "asset_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset" ADD CONSTRAINT "FK_600bce611adc4d42ce552ddc192" FOREIGN KEY ("institutionId") REFERENCES "institution"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "fixed_income_asset" ADD CONSTRAINT "FK_bafe7ece1711b0ddee9fc7763f1" FOREIGN KEY ("typeId") REFERENCES "asset_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "fixed_income_asset" ADD CONSTRAINT "FK_db949fdb6c4da3cd128f1b9e799" FOREIGN KEY ("institutionId") REFERENCES "institution"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "wealth_history" ADD CONSTRAINT "FK_67c3ad7c7ca0b31b1da85f96141" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "manager_client_link" ADD CONSTRAINT "FK_f44338b50dbd8d67be6552935c2" FOREIGN KEY ("investorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "manager_client_link" ADD CONSTRAINT "FK_21c032b33b17dcf758170850c22" FOREIGN KEY ("managerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "manager_client_history" ADD CONSTRAINT "FK_3ea5a396be1e2d37041ac652bff" FOREIGN KEY ("investorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "manager_client_history" ADD CONSTRAINT "FK_9cb511b58536c730d8731a2888f" FOREIGN KEY ("managerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "manager_client_history" ADD CONSTRAINT "FK_011f937ca197415812698f50c5e" FOREIGN KEY ("linkId") REFERENCES "manager_client_link"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "manager_client_history" DROP CONSTRAINT "FK_011f937ca197415812698f50c5e"`);
        await queryRunner.query(`ALTER TABLE "manager_client_history" DROP CONSTRAINT "FK_9cb511b58536c730d8731a2888f"`);
        await queryRunner.query(`ALTER TABLE "manager_client_history" DROP CONSTRAINT "FK_3ea5a396be1e2d37041ac652bff"`);
        await queryRunner.query(`ALTER TABLE "manager_client_link" DROP CONSTRAINT "FK_21c032b33b17dcf758170850c22"`);
        await queryRunner.query(`ALTER TABLE "manager_client_link" DROP CONSTRAINT "FK_f44338b50dbd8d67be6552935c2"`);
        await queryRunner.query(`ALTER TABLE "wealth_history" DROP CONSTRAINT "FK_67c3ad7c7ca0b31b1da85f96141"`);
        await queryRunner.query(`ALTER TABLE "fixed_income_asset" DROP CONSTRAINT "FK_db949fdb6c4da3cd128f1b9e799"`);
        await queryRunner.query(`ALTER TABLE "fixed_income_asset" DROP CONSTRAINT "FK_bafe7ece1711b0ddee9fc7763f1"`);
        await queryRunner.query(`ALTER TABLE "asset" DROP CONSTRAINT "FK_600bce611adc4d42ce552ddc192"`);
        await queryRunner.query(`ALTER TABLE "asset" DROP CONSTRAINT "FK_bc5bb7225b951dcc4cba1bc1c03"`);
        await queryRunner.query(`ALTER TABLE "asset_type" DROP CONSTRAINT "FK_927aecb9813afd99d3fc8b093bf"`);
        await queryRunner.query(`DROP INDEX "IDX_a8ac44748b24b53624a015c92d"`);
        await queryRunner.query(`DROP TABLE "manager_client_history"`);
        await queryRunner.query(`DROP TYPE "manager_client_history_status_enum"`);
        await queryRunner.query(`DROP INDEX "IDX_6c2dc0b1efa47be1a8e36e8a19"`);
        await queryRunner.query(`DROP INDEX "IDX_40fad4a0d57f2b2c7ff4a2012f"`);
        await queryRunner.query(`DROP TABLE "manager_client_link"`);
        await queryRunner.query(`DROP TYPE "manager_client_link_revokeReason_enum"`);
        await queryRunner.query(`DROP TYPE "manager_client_link_status_enum"`);
        await queryRunner.query(`DROP INDEX "IDX_4af0a96d12b3ce64e1314ca521"`);
        await queryRunner.query(`DROP TABLE "market_index_cache"`);
        await queryRunner.query(`DROP TABLE "exchange_rate_cache"`);
        await queryRunner.query(`DROP INDEX "IDX_ddae234089f674615cc160caf3"`);
        await queryRunner.query(`DROP TABLE "wealth_history"`);
        await queryRunner.query(`DROP INDEX "IDX_e7ca9f485ac3d29fee98c5580b"`);
        await queryRunner.query(`DROP TABLE "index_rate_cache"`);
        await queryRunner.query(`DROP TABLE "fixed_income_asset"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TYPE "user_role_enum"`);
        await queryRunner.query(`DROP TABLE "price_cache"`);
        await queryRunner.query(`DROP TABLE "asset"`);
        await queryRunner.query(`DROP TABLE "institution"`);
        await queryRunner.query(`DROP TABLE "asset_type"`);
        await queryRunner.query(`DROP TABLE "asset_class"`);
    }

}
