import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { defineConfig } from '@playwright/test';

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

// A porta vem de E2E_PORTA para os testes nunca usarem o painel do dono (porta 3000).
const porta = process.env.E2E_PORTA ?? '3000';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: { baseURL: `http://localhost:${porta}`, locale: 'pt-BR' },
  webServer: { command: `pnpm dev -p ${porta}`, url: `http://localhost:${porta}/entrar`, reuseExistingServer: true, timeout: 120_000 },
});
