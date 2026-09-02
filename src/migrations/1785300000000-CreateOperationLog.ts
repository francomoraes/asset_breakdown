import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOperationLog1785300000000 implements MigrationInterface {
    name = 'CreateOperationLog1785300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."operation_log_actorrole_enum" AS ENUM('investor', 'manager', 'admin', 'system')`);
        await queryRunner.query(`CREATE TYPE "public"."operation_log_action_enum" AS ENUM('target_percentage_change', 'asset_class_created', 'asset_class_updated', 'asset_class_deleted', 'asset_type_created', 'asset_type_updated', 'asset_type_deleted', 'institution_created', 'institution_updated', 'institution_deleted', 'link_added', 'link_revoked', 'autonomy_granted', 'autonomy_revoked', 'risk_profile_changed', 'wealth_history_created', 'wealth_history_updated', 'wealth_history_deleted', 'asset_manual_edit')`);
        await queryRunner.query(`CREATE TABLE "operation_log" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "last_modified_by" character varying, "clientId" integer NOT NULL, "actorUserId" integer, "actorEmail" text NOT NULL, "actorRole" "public"."operation_log_actorrole_enum" NOT NULL, "action" "public"."operation_log_action_enum" NOT NULL, "entityType" text, "entityId" integer, "beforeValue" jsonb, "afterValue" jsonb, CONSTRAINT "PK_operation_log_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_operation_log_clientId_createdAt" ON "operation_log" ("clientId", "createdAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_operation_log_clientId_createdAt"`);
        await queryRunner.query(`DROP TABLE "operation_log"`);
        await queryRunner.query(`DROP TYPE "public"."operation_log_action_enum"`);
        await queryRunner.query(`DROP TYPE "public"."operation_log_actorrole_enum"`);
    }

}
