import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Correções da revisão de código de 2026-09-28.

test('item 6: quem tem Editar clientes (sem ser admin) desmarca serviço e o salvamento vale', async ({ page }) => {
  await db.from('clientes').delete().eq('cnpj', '11444777000161');
  const { data: cliente } = await db.from('clientes').insert({ razao_social: 'Indústria Revisão', cnpj: '11444777000161' }).select().single();
  await db.from('servicos').delete().eq('nome', 'Serviço Revisão E2E');
  const { data: servico } = await db.from('servicos').insert({ nome: 'Serviço Revisão E2E' }).select().single();
  await db.from('cliente_servicos').insert({ cliente_id: cliente!.id, servico_id: servico!.id });
  await criarUsuarioTeste({ email: 'bia@teste.com', senha: 'senha-forte-123', nome: 'Bia', papel: 'atendente', permissoes: ['editar_clientes'] });
  await entrar(page, 'bia@teste.com', 'senha-forte-123');

  await page.goto(`/clientes/${cliente!.id}`);
  await page.getByLabel('Serviço Revisão E2E').uncheck();
  await page.getByRole('button', { name: 'Salvar serviços' }).click();
  await expect(page.getByLabel('Serviço Revisão E2E')).not.toBeChecked();
  await expect.poll(async () => (await db.from('cliente_servicos').select('servico_id').eq('cliente_id', cliente!.id)).data).toEqual([]);
});

test('item 8: "Minhas" mostra conversa assumida mesmo com mais de 200 conversas mais recentes', async ({ page }) => {
  const adminId = await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await db.from('conversas').delete().like('telefone', '553190009%');
  const { data: antiga } = await db.from('conversas').insert({ telefone: '5531900090000', estado: 'humano', atendente_id: adminId }).select().single();
  await db.from('mensagens').insert({ conversa_id: antiga!.id, direcao: 'entrada', autor: 'cliente', tipo: 'texto', conteudo: 'Conversa antiga assumida', criado_em: '2025-01-01T12:00:00Z' });
  const novas = Array.from({ length: 205 }, (_, i) => ({ telefone: `553190009${String(i + 1).padStart(4, '0')}` }));
  const { data: criadas } = await db.from('conversas').insert(novas).select('id');
  await db.from('mensagens').insert(criadas!.map((c) => ({ conversa_id: c.id, direcao: 'entrada', autor: 'cliente', tipo: 'texto', conteudo: 'oi' })));

  await entrar(page, 'admin@teste.com', 'senha-forte-123');
  await page.goto('/atendimento?filtro=minhas');
  await expect(page.getByText('Conversa antiga assumida')).toBeVisible();
  await db.from('conversas').delete().like('telefone', '553190009%');
});
