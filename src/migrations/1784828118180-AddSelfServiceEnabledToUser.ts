import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSelfServiceEnabledToUser1784828118180 implements MigrationInterface {
    name = 'AddSelfServiceEnabledToUser1784828118180'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "selfServiceEnabled" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "selfServiceEnabled"`);
    }

}
