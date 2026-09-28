import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { defineConfig } from '@playwright/test';

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: { baseURL: 'http://localhost:3000', locale: 'pt-BR' },
  webServer: { command: 'pnpm dev', url: 'http://localhost:3000/entrar', reuseExistingServer: true, timeout: 120_000 },
});
