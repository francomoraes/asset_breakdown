import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDividendsCentsAccumulatedToAsset1785200000001 implements MigrationInterface {
    name = 'AddDividendsCentsAccumulatedToAsset1785200000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "asset" ADD "dividendsCentsAccumulated" integer NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "asset" DROP COLUMN "dividendsCentsAccumulated"`);
    }
}
