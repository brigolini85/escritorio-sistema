import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { defineConfig } from '@playwright/test';

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

// A porta vem de E2E_PORTA (padrão 3100) para os testes nunca usarem o painel do dono (porta 3000).
const porta = process.env.E2E_PORTA ?? '3100';

// Os e2e nunca chamam BrasilAPI/ViaCEP (servidor falso local) e usam uma chave de cifra só de teste (D8, D32).
// Atribuição direta (não ??=): nem um valor de verdade no terminal escapa para os testes.
const PORTA_CONSULTAS = 3199;
process.env.CONSULTA_CNPJ_URL = `http://127.0.0.1:${PORTA_CONSULTAS}/api/cnpj/v1`;
process.env.CONSULTA_CEP_URL = `http://127.0.0.1:${PORTA_CONSULTAS}/ws`;
process.env.ACESSOS_PORTAIS_CHAVE = 'ZTJlLXNvLXBhcmEtdGVzdGVzLWxvY2Fpcy0zMmJ5dGU='; // "e2e-so-para-testes-locais-32byte"
// Auditoria 2.7: segredo do cookie de atividade, fixo e só de teste (os e2e assinam o cookie como o painel, apoio-sessao.ts).
process.env.PAINEL_SEGREDO_SESSAO = 'e2e-segredo-de-sessao-so-para-testes-locais';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  globalSetup: './e2e/aquecer.ts',
  use: { baseURL: `http://localhost:${porta}`, locale: 'pt-BR' },
  webServer: [
    { command: 'node e2e/consultas-falsas.mjs', url: `http://127.0.0.1:${PORTA_CONSULTAS}/saude`, reuseExistingServer: true, timeout: 30_000 },
    { command: `pnpm dev -p ${porta}`, url: `http://localhost:${porta}/entrar`, reuseExistingServer: true, timeout: 120_000 },
  ],
});
