import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });
// Sem pg_dump/psql 17 na máquina, os testes usam os do contêiner do Supabase local (COPIA_PG_DOCKER= vazio usa os da máquina).
process.env.COPIA_PG_DOCKER ??= 'supabase_db_AGENTESDEIA';

export default defineConfig({
  test: { fileParallelism: false, testTimeout: 180_000, hookTimeout: 120_000 },
});
