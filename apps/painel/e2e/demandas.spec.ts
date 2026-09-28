import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

async function demanda(telefone: string, setor: string, titulo: string, resumo: string) {
  await db.from('chamados').delete().eq('titulo', titulo);   // sobra de execução anterior (apagar a conversa não apaga o chamado)
  await db.from('conversas').delete().eq('telefone', telefone);
  const { data: conversa } = await db.from('conversas').insert({ telefone }).select().single();
  const { data: s } = await db.from('setores').select('id').eq('nome', setor).single();
  await db.from('chamados').insert({ conversa_id: conversa!.id, setor_id: s!.id, titulo, resumo });
  return conversa!.id;
}

test('administrador vê as demandas com setor e resumo, filtra por setor e abre a conversa', async ({ page }) => {
  const conversa = await demanda('5531999990301', 'Fiscal', 'Nota fiscal - Mercado Teste', 'Nota para Mercado Teste: 10 PAC pão de queijo');
  await demanda('5531999990302', 'Pessoal', 'Holerite de agosto', 'Holerite do funcionário Pedro');
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');

  await page.getByRole('link', { name: 'Demandas' }).click();
  await expect(page.getByText('Nota para Mercado Teste: 10 PAC pão de queijo')).toBeVisible();
  await expect(page.getByText('Holerite do funcionário Pedro')).toBeVisible();

  await page.getByRole('link', { name: 'Fiscal', exact: true }).click();
  await expect(page.getByText('Nota para Mercado Teste: 10 PAC pão de queijo')).toBeVisible();
  await expect(page.getByText('Holerite do funcionário Pedro')).toHaveCount(0);

  await page.getByRole('link', { name: 'Abrir conversa' }).first().click();
  await expect(page).toHaveURL(new RegExp(`/atendimento/${conversa}`));
});

test('atendente do Pessoal não vê demanda do Fiscal', async ({ page }) => {
  await demanda('5531999990303', 'Fiscal', 'Nota fiscal - Mercado Sigiloso', 'Nota sigilosa do Fiscal');
  await criarUsuarioTeste({ email: 'caio@teste.com', senha: 'senha-forte-123', nome: 'Caio', papel: 'atendente', setores: ['Pessoal'] });
  await entrar(page, 'caio@teste.com', 'senha-forte-123');
  await page.goto('/demandas');
  await expect(page.getByRole('heading', { name: 'Demandas' })).toBeVisible();
  await expect(page.getByText('Nota sigilosa do Fiscal')).toHaveCount(0);
});
