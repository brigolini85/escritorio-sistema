import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

const email = 'dono-assistente@e2e.local';
const senha = 'Senha-e2e-123';

test('dono pergunta ao assistente pela tela Assistente (pedido do dono, 2026-09-29)', async ({ page }) => {
  const usuarioId = await criarUsuarioTeste({ email, senha, nome: 'Dono', papel: 'admin', permissoes: ['assistente_site'] });
  await entrar(page, email, senha);
  await page.getByRole('link', { name: 'Assistente' }).click();
  await page.getByPlaceholder('Pergunte ao assistente').fill('quais notas estão abertas?');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText('quais notas estão abertas?')).toBeVisible();
  await expect(page.getByText('Pensando…')).toBeVisible();
  const { data } = await db.from('assistente_mensagens').select('conteudo, canal, papel').eq('usuario_id', usuarioId);
  expect(data).toEqual([{ conteudo: 'quais notas estão abertas?', canal: 'site', papel: 'usuario' }]);
});

test('sem a marcação, o menu não mostra o Assistente e a tela redireciona', async ({ page }) => {
  await criarUsuarioTeste({ email, senha, nome: 'Dono', papel: 'admin', permissoes: [] });
  await entrar(page, email, senha);
  await expect(page.getByRole('link', { name: 'Assistente' })).toHaveCount(0);
  await page.goto('/assistente');
  await page.waitForURL('**/inicio');
});

test('resposta do assistente com CSV em duas partes mostra um link por parte, sem ids', async ({ page }) => {
  const usuarioId = await criarUsuarioTeste({ email, senha, nome: 'Dono', papel: 'admin', permissoes: ['assistente_site'] });
  const { data: msg, error } = await db.from('assistente_mensagens').insert({
    usuario_id: usuarioId, canal: 'site', papel: 'assistente', conteudo: 'Pronto, gerei o CSV.', processada_em: new Date().toISOString(),
    arquivo: { tipo: 'csv_bling', chamados: [], nome: 'x.csv', partes: 2 },
  }).select('id').single();
  if (error) throw error;
  await entrar(page, email, senha);
  await page.getByRole('link', { name: 'Assistente' }).click();
  const p1 = page.getByRole('link', { name: 'Baixar CSV Bling (parte 1)' });
  const p2 = page.getByRole('link', { name: 'Baixar CSV Bling (parte 2)' });
  await expect(p1).toHaveAttribute('href', `/api/csv-bling?assistente=${msg.id}&parte=1`);
  await expect(p2).toHaveAttribute('href', `/api/csv-bling?assistente=${msg.id}&parte=2`);
});

async function conversaComDemanda(telefone: string) {
  await db.from('conversas').delete().eq('telefone', telefone);
  const { data: conversa } = await db.from('conversas').insert({ telefone }).select().single();
  const { data: s } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  await db.from('chamados').insert({ conversa_id: conversa!.id, setor_id: s!.id, titulo: 'Guia do DAS' });
  return conversa!.id as string;
}

test('caixa do assistente dentro do atendimento grava a pergunta com a conversa, limita o tamanho e mostra avisos', async ({ page }) => {
  const usuarioId = await criarUsuarioTeste({ email, senha, nome: 'Ana', papel: 'atendente', setores: ['Fiscal'], permissoes: ['assistente_site'] });
  const conversaId = await conversaComDemanda('5531999990201');
  await entrar(page, email, senha);
  await page.goto(`/atendimento/${conversaId}`);
  await expect(page.getByText('Já sabe deste cliente')).toBeVisible();
  const campo = page.getByPlaceholder('Pergunte ao assistente');
  await expect(campo).toHaveAttribute('maxlength', '4000');
  await campo.fill('resuma esta conversa');
  await campo.press('Enter');
  await expect(page.getByText('resuma esta conversa')).toBeVisible();
  await expect(page.getByText('Pensando…')).toBeVisible();
  const { data } = await db.from('assistente_mensagens').select('conversa_id, canal, papel').eq('usuario_id', usuarioId);
  expect(data).toEqual([{ conversa_id: conversaId, canal: 'site', papel: 'usuario' }]);
  await page.goto(`/atendimento/${conversaId}?erro=${encodeURIComponent('Sem acesso a esta conversa.')}`);
  await expect(page.getByText('Sem acesso a esta conversa.')).toBeVisible();
});

test('sem a marcação, a caixa do assistente não aparece no atendimento', async ({ page }) => {
  await criarUsuarioTeste({ email, senha, nome: 'Ana', papel: 'atendente', setores: ['Fiscal'], permissoes: [] });
  const conversaId = await conversaComDemanda('5531999990202');
  await entrar(page, email, senha);
  await page.goto(`/atendimento/${conversaId}`);
  await expect(page.getByText('Guia do DAS').first()).toBeVisible();
  await expect(page.getByPlaceholder('Pergunte ao assistente')).toHaveCount(0);
});
