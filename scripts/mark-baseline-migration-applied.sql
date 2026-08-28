-- ============================================================
-- Marca a migration baseline (InitialSchema) como já aplicada,
-- SEM rodar o DDL dela — o schema já existe fisicamente no banco
-- (criado via synchronize antes da introdução de migrations).
--
-- Rodar UMA VEZ por ambiente: primeiro local, depois produção.
-- Idempotente: pode rodar de novo sem duplicar a linha.
-- ============================================================

-- 1. Cria a tabela de controle do TypeORM (mesmo formato que ele cria sozinho
--    via migration:run — não precisa bater nomes de constraint, só a estrutura).
CREATE TABLE IF NOT EXISTS "migrations" (
  "id" SERIAL NOT NULL,
  "timestamp" bigint NOT NULL,
  "name" character varying NOT NULL,
  CONSTRAINT "PK_migrations_id" PRIMARY KEY ("id")
);

-- 2. Insere o registro da baseline como já aplicada (idempotente).
INSERT INTO "migrations" ("timestamp", "name")
SELECT 1784255767707, 'InitialSchema1784255767707'
WHERE NOT EXISTS (
  SELECT 1 FROM "migrations" WHERE "name" = 'InitialSchema1784255767707'
);

-- 3. Conferência — deve mostrar exatamente 1 linha.
SELECT * FROM "migrations" ORDER BY "timestamp";
