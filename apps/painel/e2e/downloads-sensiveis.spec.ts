import { expect, test } from '@playwright/test';
import { limparBanco, sqlTeste } from '@escritorio/db/teste';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { SENHA } from './apoio-agentes';
import { conversaCom } from './apoio-contatos';
import { RESULTADO, cenarioTarefa } from './apoio-tarefas';

// Revisão geral (painel I8): rotas de download sensíveis sem e2e até aqui. A RODAR NO FIM (escritas sem rodar: o Supabase
// local estava em uso por outra frente). /api/tarefas/arquivo, /api/tarefas/planilha, /api/arquivos e /auth/confirm.
test.beforeEach(async () => { await limparBanco(); });
test.afterAll(async () => { await limparBanco(); });

const sem = { maxRedirects: 0 };
const arquivoDaTarefa = async (tarefaId: string) =>
  (await sqlTeste<{ id: string }>('select id from public.agente_tarefa_arquivos where tarefa_id = $1 order by criado_em limit 1', [tarefaId]))[0]!.id;

test('arquivo da tarefa: quem vê baixa (link assinado); outro setor 404; apagado pela guarda 410', async ({ page }) => {
  const c = await cenarioTarefa({ estado: 'pronta', resultado: RESULTADO });
  const arq = await arquivoDaTarefa(c.tarefa.id);
  await criarUsuarioTeste({ email: 'paula@i8.local', senha: SENHA, nome: 'Paula Pessoal', papel: 'atendente', setores: ['Pessoal'] });

  await entrar(page, 'claudia@i3.local', SENHA);
  const ok = await page.request.get(`/api/tarefas/arquivo?id=${arq}`, sem);
  expect(ok.status()).toBe(307);
  expect(ok.headers()['location']).toContain('/storage/v1/object/sign/tarefas/');
  expect((await page.request.get('/api/tarefas/arquivo?id=nao-e-uuid', sem)).status()).toBe(404);
  await sqlTeste('update public.agente_tarefa_arquivos set removido_em = now() where id = $1', [arq]);
  expect((await page.request.get(`/api/tarefas/arquivo?id=${arq}`, sem)).status()).toBe(410);

  await page.context().clearCookies();
  await entrar(page, 'paula@i8.local', SENHA);
  expect((await page.request.get(`/api/tarefas/arquivo?id=${arq}`, sem)).status()).toBe(404);
});

test('planilha da tarefa: quem vê baixa o xlsx; outro setor 404', async ({ page }) => {
  const c = await cenarioTarefa({ estado: 'pronta', resultado: RESULTADO });
  await criarUsuarioTeste({ email: 'paula@i8.local', senha: SENHA, nome: 'Paula Pessoal', papel: 'atendente', setores: ['Pessoal'] });
  await entrar(page, 'claudia@i3.local', SENHA);
  const ok = await page.request.get(`/api/tarefas/planilha?id=${c.tarefa.id}`);
  expect(ok.status()).toBe(200);
  expect(ok.headers()['content-type']).toContain('spreadsheetml');
  await page.context().clearCookies();
  await entrar(page, 'paula@i8.local', SENHA);
  expect((await page.request.get(`/api/tarefas/planilha?id=${c.tarefa.id}`)).status()).toBe(404);
});

test('pedido de nota ("NF de ..."): com Pedidos de nota: Sem acesso, nem página, nem CSV, nem planilha, nem arquivo (I2)', async ({ page }) => {
  const c = await cenarioTarefa({ estado: 'pronta', resultado: RESULTADO });
  await sqlTeste("update public.chamados set titulo = 'NF de I3 Padaria Sol' where id = $1", [c.demanda.id]);
  await db.from('usuario_permissoes').upsert({ usuario_id: c.claudia, modulo: 'notas', nivel: 'sem_acesso' });
  const arq = await arquivoDaTarefa(c.tarefa.id);
  await entrar(page, 'claudia@i3.local', SENHA);
  await page.goto(`/tarefas/${c.tarefa.id}`);
  await expect(page.getByText('Não encontrei esta tarefa.')).toBeVisible();
  expect((await page.request.get(`/api/tarefas/csv?id=${c.tarefa.id}`)).status()).toBe(404);
  expect((await page.request.get(`/api/tarefas/planilha?id=${c.tarefa.id}`)).status()).toBe(404);
  expect((await page.request.get(`/api/tarefas/arquivo?id=${arq}`, sem)).status()).toBe(404);
  // Com "ver", volta a sair.
  await db.from('usuario_permissoes').upsert({ usuario_id: c.claudia, modulo: 'notas', nivel: 'ver' });
  expect((await page.request.get(`/api/tarefas/csv?id=${c.tarefa.id}`)).status()).toBe(200);
});

test('anexo de conversa (/api/arquivos): quem vê a conversa baixa; sem acesso ao Atendimento, 404', async ({ page }) => {
  const conversa = await conversaCom('5531999990801', null, [{ autor: 'cliente', em: new Date().toISOString() }]);
  const caminho = `conversas/${conversa}/i8-recibo.txt`;
  const up = await db.storage.from('anexos').upload(caminho, new TextEncoder().encode('recibo'), { contentType: 'text/plain', upsert: true });
  expect(up.error).toBeNull();
  await criarUsuarioTeste({ email: 'admin@i8.local', senha: SENHA, nome: 'Admin I8', papel: 'admin' });
  const bia = await criarUsuarioTeste({ email: 'bia@i8.local', senha: SENHA, nome: 'Bia Sem Atendimento', papel: 'atendente', setores: ['Fiscal'] });
  await db.from('usuario_permissoes').upsert({ usuario_id: bia, modulo: 'atendimento', nivel: 'sem_acesso' });

  await entrar(page, 'admin@i8.local', SENHA);
  const ok = await page.request.get(`/api/arquivos?path=${encodeURIComponent(caminho)}`, sem);
  expect(ok.status()).toBe(307);
  expect((await page.request.get(`/api/arquivos?path=${encodeURIComponent(`conversas/${conversa}/nao-existe.txt`)}`, sem)).status()).toBe(404);

  await page.context().clearCookies();
  await entrar(page, 'bia@i8.local', SENHA);
  expect((await page.request.get(`/api/arquivos?path=${encodeURIComponent(caminho)}`, sem)).status()).toBe(404);
});

test('/auth/confirm: link sem token ou com token inválido vai para /entrar?erro=link', async ({ page }) => {
  for (const url of ['/auth/confirm', '/auth/confirm?token_hash=invalido&type=invite', '/auth/confirm?token_hash=invalido&type=recovery']) {
    const r = await page.request.get(url, sem);
    expect(r.status()).toBe(307);
    expect(r.headers()['location']).toMatch(/\/entrar\?erro=link$/);
  }
});
