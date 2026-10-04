import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirSecao } from './apoio-configuracoes';

const SENHA = 'senha-forte-123';

test('Modelos de IA: escolhe entre os modelos com preço, "antes" e grava', async ({ page }) => {
  const { data } = await db.from('configuracoes').select('modelo_rapido, precos_modelos').eq('id', 1).single();
  const outro = Object.keys(data!.precos_modelos as Record<string, unknown>).find((m) => m !== data!.modelo_rapido)!;
  await criarUsuarioTeste({ email: 'admin-modelos@e2e.local', senha: SENHA, nome: 'Admin Modelos', papel: 'admin' });
  try {
    await entrar(page, 'admin-modelos@e2e.local', SENHA);
    await abrirSecao(page, 'ia');
    const cartao = page.getByRole('region', { name: 'Modelos de IA' });
    const rapido = cartao.getByLabel('Tarefas rápidas');
    await rapido.selectOption(outro, { timeout: 30_000 });
    await expect(cartao.getByText(/^antes: Claude /)).toBeVisible();
    await expect(rapido).toHaveAttribute('data-alterado', '');
    await cartao.getByRole('button', { name: 'Salvar modelos' }).click();
    await expect(page.getByText('Modelos salvos.')).toBeVisible();
    await expect.poll(async () => (await db.from('configuracoes').select('modelo_rapido').eq('id', 1).single()).data?.modelo_rapido).toBe(outro);
    // Salvo sem recarregar: o <select> vira o novo valor salvo (fixarComoSalvo), sem âmbar nem "antes".
    await expect(rapido).not.toHaveAttribute('data-alterado');
    await expect(cartao.getByText(/^antes: /)).toHaveCount(0);
    await expect(rapido).toHaveValue(outro);
  } finally {
    await db.from('configuracoes').update({ modelo_rapido: data!.modelo_rapido }).eq('id', 1);
  }
});

test('Mensagens: aviso do login com "antes" e Salvar próprio', async ({ page }) => {
  const antes = (await db.from('configuracoes').select('aviso_login').eq('id', 1).single()).data!.aviso_login;
  await criarUsuarioTeste({ email: 'admin-msg@e2e.local', senha: SENHA, nome: 'Admin Msg', papel: 'admin' });
  try {
    await entrar(page, 'admin-msg@e2e.local', SENHA);
    await abrirSecao(page, 'mensagens');
    const cartao = page.getByRole('region', { name: 'Aviso na tela de entrada' });
    await cartao.getByRole('textbox').fill('Recado e2e G1', { timeout: 30_000 });
    await expect(cartao.getByText(/^antes: /)).toBeVisible();
    await cartao.getByRole('button', { name: 'Salvar aviso' }).click();
    await expect(page.getByText('Aviso do login salvo.')).toBeVisible();
    await expect.poll(async () => (await db.from('configuracoes').select('aviso_login').eq('id', 1).single()).data?.aviso_login).toBe('Recado e2e G1');
  } finally {
    await db.from('configuracoes').update({ aviso_login: antes }).eq('id', 1);
  }
});

test('Configurações "Sim": não vê Teto, Modelos nem Cotação', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-ia@e2e.local', senha: SENHA, nome: 'Ana IA', papel: 'atendente', setores: ['Fiscal'] });
  await db.from('usuario_permissoes').update({ nivel: 'sim' }).eq('usuario_id', ana).eq('modulo', 'configuracoes');
  await entrar(page, 'ana-ia@e2e.local', SENHA);
  await abrirSecao(page, 'ia');
  await expect(page.getByRole('region', { name: 'Expediente' })).toBeVisible({ timeout: 30_000 });
  for (const nome of ['Teto de IA e alertas', 'Modelos de IA', 'Cotação e custo da transcrição']) {
    await expect(page.getByRole('region', { name: nome })).toHaveCount(0);
  }
});

test('Configurações "Sim" chamando a ação salvarModelos direto: recusada (exigirAdmin e o gatilho do banco)', async ({ browser }) => {
  const { data } = await db.from('configuracoes').select('modelo_rapido, precos_modelos').eq('id', 1).single();
  const original = data!.modelo_rapido;
  const outro = Object.keys(data!.precos_modelos as Record<string, unknown>).find((m) => m !== original)!;
  await criarUsuarioTeste({ email: 'admin-acao@e2e.local', senha: SENHA, nome: 'Admin Ação', papel: 'admin' });
  const ana = await criarUsuarioTeste({ email: 'ana-acao@e2e.local', senha: SENHA, nome: 'Ana Ação', papel: 'atendente', setores: ['Fiscal'] });
  await db.from('usuario_permissoes').update({ nivel: 'sim' }).eq('usuario_id', ana).eq('modulo', 'configuracoes');
  const ctxAdmin = await browser.newContext();
  const ctxAna = await browser.newContext();
  try {
    // O administrador salva pela tela; guardamos a chamada exata da ação (id, cabeçalhos e corpo).
    const admin = await ctxAdmin.newPage();
    await entrar(admin, 'admin-acao@e2e.local', SENHA);
    await abrirSecao(admin, 'ia');
    const cartao = admin.getByRole('region', { name: 'Modelos de IA' });
    await cartao.getByLabel('Tarefas rápidas').selectOption(outro, { timeout: 30_000 });
    const pedido = admin.waitForRequest((r) => r.method() === 'POST' && Boolean(r.headers()['next-action']));
    await cartao.getByRole('button', { name: 'Salvar modelos' }).click();
    const chamada = await pedido;
    await expect(admin.getByText('Modelos salvos.')).toBeVisible();
    await db.from('configuracoes').update({ modelo_rapido: original }).eq('id', 1);

    // A mesma chamada, com a sessão de quem tem "Configurações: Sim" mas não é administrador.
    const pagAna = await ctxAna.newPage();
    await entrar(pagAna, 'ana-acao@e2e.local', SENHA);
    const h = chamada.headers();
    const repetir = (p: typeof admin) => p.request.post(chamada.url(), {
      headers: { 'next-action': h['next-action']!, 'content-type': h['content-type']!, accept: h['accept'] ?? 'text/x-component' },
      data: chamada.postDataBuffer()!,
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    await repetir(pagAna);
    expect((await db.from('configuracoes').select('modelo_rapido').eq('id', 1).single()).data?.modelo_rapido).toBe(original);
    // Controle: a mesma chamada repetida pelo administrador grava (a repetição funciona; a recusa acima é da permissão).
    await repetir(admin);
    await expect.poll(async () => (await db.from('configuracoes').select('modelo_rapido').eq('id', 1).single()).data?.modelo_rapido).toBe(outro);
  } finally {
    await ctxAdmin.close();
    await ctxAna.close();
    await db.from('configuracoes').update({ modelo_rapido: original }).eq('id', 1);
  }
});
