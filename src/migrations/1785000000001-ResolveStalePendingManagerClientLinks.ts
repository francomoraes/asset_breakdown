import { MigrationInterface, QueryRunner } from "typeorm";

// Vínculo unilateral do gestor (.docs/vinculo-unilateral-gestor.md, decisão 4.8):
// não existe mais rota de approve/reject, então qualquer "manager_client_link"
// que ainda esteja "pending" no momento deste deploy fica sem caminho de
// resolução. Resolve automaticamente para "revoked" com um motivo dedicado,
// em vez de deixar a linha presa — se o gestor ainda quiser aquele cliente,
// basta recriar o vínculo pelo fluxo novo (já nasce ACTIVE).
export class ResolveStalePendingManagerClientLinks1785000000001
  implements MigrationInterface
{
  name = "ResolveStalePendingManagerClientLinks1785000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Mesmo problema de casing do enum já resolvido em AddSupersededRevokeReason:
    // o nome do tipo diverge entre ambientes ("...revokereason_enum" vs
    // "...revokeReason_enum"), então resolvemos dinamicamente.
    await queryRunner.query(`
      DO $$
      DECLARE
        enum_type_name text;
      BEGIN
        SELECT typname INTO enum_type_name
        FROM pg_type
        WHERE typname ILIKE 'manager_client_link_revokereason_enum'
        LIMIT 1;

        IF enum_type_name IS NOT NULL THEN
          EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', enum_type_name, 'stale_pending_migration');
        END IF;
      END $$;
    `);

    // Postgres proíbe usar um valor de enum recém-adicionado na mesma transação
    // em que ele foi criado (só passa a existir após commit). O runner de
    // migrations do TypeORM roda em uma transação compartilhada por padrão, então
    // fechamos e reabrimos a transação aqui antes do UPDATE usar o valor novo.
    if (queryRunner.isTransactionActive) {
      await queryRunner.commitTransaction();
      await queryRunner.startTransaction();
    }

    await queryRunner.query(`
      UPDATE "manager_client_link"
      SET "status" = 'revoked',
          "revokedAt" = now(),
          "revokeReason" = 'stale_pending_migration'
      WHERE "status" = 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres não suporta remover valor de enum diretamente, e reverter a
    // atualização de dados perderia a distinção entre revoke manual e
    // resolução automática — down é no-op intencional.
  }
}
