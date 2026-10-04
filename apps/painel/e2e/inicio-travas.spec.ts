import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirInicio } from './apoio-inicio';

const SENHA = 'senha-forte-123';
// Nomes de campo e textos que só existem quando há custo na página ou no pacote do servidor (props de componentes de cliente).
const CUSTO = /US\$|teto_ia_usd|total_usd|custo_usd|cotacao_usd_brl|gastos_resumo|Gasto com IA/;

test('quem atende nunca recebe custo: nem na página, nem no pacote RSC (também com "Configurações: Sim")', async ({ page }) => {
  // Controle: o administrador recebe US$ (o filtro acha custo quando há).
  await criarUsuarioTeste({ email: 'admin-travas@e2e.local', senha: SENHA, nome: 'Thiago Travas', papel: 'admin' });
  await entrar(page, 'admin-travas@e2e.local', SENHA);
  await abrirInicio(page, 'situacao');
  expect(await page.content()).toMatch(/US\$/);

  for (const comConfiguracoes of [false, true]) {
    await page.context().clearCookies();
    const email = `mesa-travas-${comConfiguracoes ? 'conf' : 'comum'}@e2e.local`;
    const id = await criarUsuarioTeste({ email, senha: SENHA, nome: 'Ana Travas', papel: 'atendente', setores: ['Fiscal'] });
    if (comConfiguracoes) await db.from('usuario_permissoes').update({ nivel: 'sim' }).eq('usuario_id', id).eq('modulo', 'configuracoes');
    await entrar(page, email, SENHA);
    await abrirInicio(page, 'mesa');
    expect(await page.content(), `HTML da Minha mesa (${email})`).not.toMatch(CUSTO);
    const rsc = await page.request.get('/inicio', { headers: { RSC: '1' } });
    expect(rsc.status()).toBe(200);
    expect(await rsc.text(), `pacote RSC da Minha mesa (${email})`).not.toMatch(CUSTO);
  }
});

test('o bloco Sistema muda sozinho em até ~75 s, sem recarregar a página (polling, sem tempo real novo)', async ({ page }) => {
  test.setTimeout(150_000);
  await db.from('configuracoes').update({ agente_pausado: false }).eq('id', 1);
  try {
    await criarUsuarioTeste({ email: 'mesa-polling@e2e.local', senha: SENHA, nome: 'Ana Polling', papel: 'atendente', setores: ['Fiscal'] });
    await entrar(page, 'mesa-polling@e2e.local', SENHA);
    await abrirInicio(page, 'mesa');
    const agente = page.getByTestId('inicio-sistema').locator('[data-sistema="agente"]');
    await expect(agente).toContainText(/atendendo|limite de IA do mês/);
    await page.evaluate(() => { (window as unknown as { __marcaG2?: number }).__marcaG2 = 1; });
    await db.from('configuracoes').update({ agente_pausado: true }).eq('id', 1);
    await expect(agente).toHaveText(/pausado$/, { timeout: 90_000 });
    // router.refresh troca os dados do servidor; recarga de verdade apagaria a marca.
    expect(await page.evaluate(() => (window as unknown as { __marcaG2?: number }).__marcaG2)).toBe(1);
  } finally {
    await db.from('configuracoes').update({ agente_pausado: false }).eq('id', 1);
  }
});
