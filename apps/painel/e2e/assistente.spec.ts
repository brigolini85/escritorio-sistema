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
