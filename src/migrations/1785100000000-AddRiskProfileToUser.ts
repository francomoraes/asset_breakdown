import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRiskProfileToUser1785100000000 implements MigrationInterface {
    name = 'AddRiskProfileToUser1785100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."user_riskprofile_enum" AS ENUM('conservative', 'moderate', 'aggressive')`);
        await queryRunner.query(`ALTER TABLE "user" ADD "riskProfile" "public"."user_riskprofile_enum"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "riskProfileUpdatedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "user" ADD "riskProfileSetByUserId" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "riskProfileSetByUserId"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "riskProfileUpdatedAt"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "riskProfile"`);
        await queryRunner.query(`DROP TYPE "public"."user_riskprofile_enum"`);
    }

}
