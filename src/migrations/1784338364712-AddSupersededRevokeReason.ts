import { MigrationInterface, QueryRunner } from "typeorm";

// O nome real do enum diverge entre ambientes (schema local tem
// "manager_client_link_revokereason_enum" — tudo minúsculo — enquanto
// produção tem "manager_client_link_revokeReason_enum" — com "R" maiúsculo —
// resquício de versões diferentes do TypeORM aplicando synchronize em
// momentos diferentes). Resolver o nome dinamicamente evita hardcodar
// a casing errada para um dos dois ambientes.
export class AddSupersededRevokeReason1784338364712 implements MigrationInterface {
    name = 'AddSupersededRevokeReason1784338364712'

    public async up(queryRunner: QueryRunner): Promise<void> {
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
                EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', enum_type_name, 'superseded');
              END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Postgres não suporta remover valor de enum diretamente — down é no-op intencional.
    }
}
