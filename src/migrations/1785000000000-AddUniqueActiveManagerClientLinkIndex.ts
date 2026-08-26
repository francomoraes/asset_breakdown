import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueActiveManagerClientLinkIndex1785000000000
  implements MigrationInterface
{
  name = "AddUniqueActiveManagerClientLinkIndex1785000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_manager_client_link_active_pair_unique"
      ON "manager_client_link" ("investorId", "managerId")
      WHERE "status" = 'active'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_manager_client_link_active_pair_unique"`,
    );
  }
}
