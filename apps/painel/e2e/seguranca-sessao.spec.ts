import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { apagarPessoas, atividadeHa } from './apoio-sessao';

// Segurança do login (item 7): 1 h sem uso encerra a sessão, com mensagem; o cookie de atividade não é lido pelo JavaScript.
const SENHA = 'senha-forte-123';
const H = 60 * 60 * 1000;
const TEL = '5531970029901';

test.afterAll(async () => {
  await db.from('conversas').delete().eq('telefone', TEL);
  await apagarPessoas(['sessao@e2e.local']);
});

test('em uso a sessão segue; o cookie de atividade é httpOnly', async ({ page, context, baseURL }) => {
  await criarUsuarioTeste({ email: 'sessao@e2e.local', senha: SENHA, nome: 'Ana Sessão', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'sessao@e2e.local', SENHA);
  await atividadeHa(context, baseURL!, 50 * 60 * 1000);
  await page.goto('/demandas');
  await expect(page).toHaveURL(/\/demandas/);
  const cookie = (await context.cookies()).find((c) => c.name === 'painel_atividade');
  expect(cookie?.httpOnly).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain('painel_atividade');
});

test('mais de 1 h parada: volta para a entrada com "Sua sessão expirou" e a sessão acabou de verdade', async ({ page, context, baseURL }) => {
  await criarUsuarioTeste({ email: 'sessao@e2e.local', senha: SENHA, nome: 'Ana Sessão', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'sessao@e2e.local', SENHA);
  await atividadeHa(context, baseURL!, H + 5 * 60 * 1000);
  await page.goto('/demandas');
  await page.waitForURL('**/entrar?erro=sessao');
  await expect(page.getByText('Sua sessão expirou. Entre de novo.')).toBeVisible();
  // Sem cookie de sessão: outra página também pede login.
  await page.goto('/clientes');
  await expect(page).toHaveURL(/\/entrar$/);
});

// Verificação final da produção: só uso de verdade conta. A tela recarregando sozinha não segura a sessão.
const valorAtividade = async (ctx: BrowserContext) => (await ctx.cookies()).find((c) => c.name === 'painel_atividade')?.value ?? '';
const momento = (valor: string) => Number(valor.split('.')[0]);

async function conversaFiscal(): Promise<string> {
  await db.from('conversas').delete().eq('telefone', TEL);
  const { data: setor } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const { data: c } = await db.from('conversas').insert({ telefone: TEL, aguardando_pessoa_desde: new Date().toISOString() }).select('id').single();
  await db.from('chamados').insert({ conversa_id: c!.id, setor_id: setor!.id, titulo: 'Sessão e2e' });
  await db.from('mensagens').insert({ conversa_id: c!.id, direcao: 'entrada', autor: 'cliente', conteudo: 'oi', processada_em: new Date().toISOString() });
  return c!.id;
}

/** Manda mensagem do cliente até a tela recarregar sozinha (o canal do tempo real pode ainda estar entrando). */
async function mensagemQueRecarrega(page: Page, conversa: string): Promise<void> {
  for (let i = 0; i < 6; i++) {
    const recarga = page.waitForRequest((r) => r.headers()['rsc'] === '1' && decodeURIComponent(r.headers()['next-router-state-tree'] ?? '').includes('"refetch"'), { timeout: 5000 })
      .then(() => true, () => false);
    await db.from('mensagens').insert({ conversa_id: conversa, direcao: 'entrada', autor: 'cliente', conteudo: `ainda aí? ${i}`, processada_em: new Date().toISOString() });
    if (await recarga) return;
  }
  throw new Error('a tela não recarregou pelo tempo real');
}

test('Atendimento aberto sem ninguém mexer: as recargas ao vivo não renovam a 1 h e a sessão vence', async ({ page, context, baseURL }) => {
  await criarUsuarioTeste({ email: 'sessao@e2e.local', senha: SENHA, nome: 'Ana Sessão', papel: 'atendente', setores: ['Fiscal'] });
  const conversa = await conversaFiscal();
  await entrar(page, 'sessao@e2e.local', SENHA);
  await page.goto(`/atendimento/${conversa}`);
  await expect(page.locator('[data-conversa-hidratada]')).toHaveCount(1, { timeout: 30_000 });
  await atividadeHa(context, baseURL!, 50 * 60 * 1000);
  const antes = await valorAtividade(context);
  await mensagemQueRecarrega(page, conversa);
  await expect(page.getByText('ainda aí?').first()).toBeVisible();
  // A marcação de lida (automática) também não conta como uso.
  await expect.poll(async () => (await db.from('conversa_leituras').select('lida_ate').eq('conversa_id', conversa)).data?.length).toBe(1);
  await page.waitForTimeout(1000);
  expect(await valorAtividade(context)).toBe(antes);
  // Passou da 1 h: a próxima recarga automática já leva para a entrada.
  await atividadeHa(context, baseURL!, H + 60 * 1000);
  await db.from('mensagens').insert({ conversa_id: conversa, direcao: 'entrada', autor: 'cliente', conteudo: 'alguém?', processada_em: new Date().toISOString() });
  await page.waitForURL('**/entrar?erro=sessao', { timeout: 30_000 });
});

test('clicar no menu (navegação sem recarregar a página) conta como uso e renova a 1 h', async ({ page, context, baseURL }) => {
  await criarUsuarioTeste({ email: 'sessao@e2e.local', senha: SENHA, nome: 'Ana Sessão', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'sessao@e2e.local', SENHA);
  await page.goto('/atendimento');
  await atividadeHa(context, baseURL!, 50 * 60 * 1000);
  expect(momento(await valorAtividade(context))).toBeLessThan(Date.now() - 49 * 60 * 1000);
  await page.getByRole('navigation').getByRole('link', { name: /Demandas/ }).first().click();
  await page.waitForURL('**/demandas');
  await expect.poll(async () => momento(await valorAtividade(context))).toBeGreaterThan(Date.now() - 60 * 1000);
});
