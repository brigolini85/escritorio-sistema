import { test } from '@playwright/test';
import { criarUsuarioTeste, entrar } from './apoio';

// Capturas para o dono aprovar (spec 4.7). Só roda com CAPTURAS=1; saem em test-results/capturas/.
test.skip(!process.env.CAPTURAS, 'capturas só sob demanda (CAPTURAS=1)');

const TELAS = [['login', '/entrar'], ['inicio', '/inicio'], ['atendimento', '/atendimento'], ['demandas', '/demandas'], ['clientes', '/clientes'], ['configuracoes', '/configuracoes']] as const;

for (const largura of [1366, 1920, 2560]) {
  for (const tema of ['claro', 'escuro'] as const) {
    test(`capturas ${largura} ${tema}`, async ({ page, context }) => {
      await criarUsuarioTeste({ email: 'capturas@teste.com', senha: 'senha-forte-123', nome: 'Ana Souza', papel: 'admin' });
      await page.setViewportSize({ width: largura, height: Math.round(largura * 0.5625) });
      await context.addCookies([{ name: 'tema', value: tema, url: `http://localhost:${process.env.E2E_PORTA ?? '3100'}` }]);
      await page.goto('/entrar');
      await page.screenshot({ path: `test-results/capturas/${largura}-${tema}-login.png` });
      await entrar(page, 'capturas@teste.com', 'senha-forte-123');
      for (const [nome, rota] of TELAS.slice(1)) {
        await page.goto(rota);
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: `test-results/capturas/${largura}-${tema}-${nome}.png` });
      }
    });
  }
}
