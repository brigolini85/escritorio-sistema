import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

const SENHA = 'senha-forte-123';
const PREFIXO = '553197001';

async function conversa(sufixo: string, p: { nome: string; cliente: string; minutosEspera?: number; motivo?: string; mensagens: string[] }) {
  const tel = `${PREFIXO}${sufixo}`;
  const { data: setor } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const { data: c } = await db.from('conversas').insert({
    telefone: tel,
    aguardando_pessoa_desde: p.minutosEspera === undefined ? null : new Date(Date.now() - p.minutosEspera * 60_000).toISOString(),
    motivo_pessoa: p.motivo ?? null,
  }).select('id').single();
  await db.from('chamados').insert({ conversa_id: c!.id, setor_id: setor!.id, titulo: `Lista ${p.nome}` });
  for (const [i, texto] of p.mensagens.entries()) {
    await db.from('mensagens').insert({ conversa_id: c!.id, direcao: 'entrada', autor: 'cliente', conteudo: texto,
      criado_em: new Date(Date.now() - (p.mensagens.length - i) * 1000).toISOString(), processada_em: new Date().toISOString() });
  }
  return c!.id;
}

test.beforeEach(async () => {
  await db.from('conversas').delete().like('telefone', `${PREFIXO}%`);
  // Sobras de outros specs (assumidas ou passadas para pessoa) entrariam na conta de "esperando você".
  await db.from('conversas').delete().eq('estado', 'humano');
  await db.from('conversas').delete().not('aguardando_pessoa_desde', 'is', null);
});

test('grupos, ordem por espera, cronômetro colorido, não lidas e o título "esperando você"', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana-lista@e2e.local', senha: SENHA, nome: 'Ana Lista', papel: 'atendente', setores: ['Fiscal'] });
  const carla = await conversa('0001', { nome: 'Carla', cliente: 'Rede', minutosEspera: 18, motivo: 'não entendeu o pedido duas vezes', mensagens: ['um', 'dois', 'três'] });
  await conversa('0002', { nome: 'Jorge', cliente: 'Padaria', minutosEspera: 7, motivo: 'pediu para falar com pessoa', mensagens: ['quero falar com alguém'] });
  const paulo = await conversa('0003', { nome: 'Paulo', cliente: 'Mercado', mensagens: ['oi'] });

  await entrar(page, 'ana-lista@e2e.local', SENHA);
  await page.goto('/atendimento');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Atendimento\s*2\s*esperando você/, { timeout: 30_000 });
  const esperando = page.getByRole('region', { name: /Esperando pessoa/ });
  await expect(esperando.locator('a[data-conversa-item]')).toHaveCount(2);
  // Quem espera há mais tempo primeiro.
  await expect(esperando.locator('a[data-conversa-item]').first()).toContainText('não entendeu o pedido duas vezes');
  await expect(esperando.getByText('pediu para falar com pessoa')).toBeVisible();
  // Cronômetro: 18 min passa de 15 (vermelho, com texto); 7 min é âmbar.
  await expect(esperando.locator('[data-espera="vermelho"]')).toContainText('18 min');
  await expect(esperando.locator('[data-espera="ambar"]')).toContainText('7 min');
  await expect(esperando.getByText('esperando há 18 minutos')).toBeAttached();
  // Sobras de outros specs podem estar neste grupo: confere só a conversa do Paulo.
  await expect(page.getByRole('region', { name: /Com o agente/ }).locator(`a[href^="/atendimento/${paulo}"]`)).toBeVisible();
  // Não lidas: 3 na Carla (nenhuma resposta ainda, P8). Zerar ao abrir é da Task 10.
  const itemCarla = page.locator(`a[href^="/atendimento/${carla}"]`);
  await expect(itemCarla.getByLabel('3 mensagens não lidas')).toBeVisible();
  // O número do cartão do Início é o mesmo do título do Atendimento (P2).
  await page.goto('/inicio');
  await expect(page.getByText('Esperando você', { exact: true }).locator('xpath=following-sibling::p[1]')).toHaveText('2', { timeout: 30_000 });
});

test('o menu abre recolhido no Atendimento sem mudar a preferência; J/K continuam', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana-lista@e2e.local', senha: SENHA, nome: 'Ana Lista', papel: 'atendente', setores: ['Fiscal'] });
  const a = await conversa('0001', { nome: 'Carla', cliente: 'Rede', minutosEspera: 10, mensagens: ['um'] });
  const b = await conversa('0002', { nome: 'Jorge', cliente: 'Padaria', minutosEspera: 5, mensagens: ['dois'] });
  await entrar(page, 'ana-lista@e2e.local', SENHA);
  await page.goto('/demandas');
  await expect(page.getByRole('button', { name: 'Recolher menu' })).toBeVisible({ timeout: 30_000 });
  await page.goto('/atendimento');
  await expect(page.getByRole('button', { name: 'Expandir menu' })).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press('j');
  await expect(page).toHaveURL(new RegExp(`/atendimento/${a}`));
  await page.keyboard.press('j');
  await expect(page).toHaveURL(new RegExp(`/atendimento/${b}`));
  await page.goto('/demandas');
  await expect(page.getByRole('button', { name: 'Recolher menu' })).toBeVisible();
});

test('limites de espera em Configurações mudam a cor', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin-lista@e2e.local', senha: SENHA, nome: 'Admin Lista', papel: 'admin' });
  await conversa('0001', { nome: 'Carla', cliente: 'Rede', minutosEspera: 18, mensagens: ['um'] });
  await entrar(page, 'admin-lista@e2e.local', SENHA);
  await page.goto('/configuracoes#atendimento');
  await page.getByLabel('Verde até (minutos)').fill('20', { timeout: 30_000 });
  await page.getByLabel('Âmbar até (minutos)').fill('40');
  await page.getByRole('button', { name: 'Salvar limites' }).click();
  await expect(page.getByText('Limites de espera salvos.')).toBeVisible();
  await page.goto('/atendimento');
  await expect(page.locator('[data-espera="verde"]')).toContainText('18 min', { timeout: 30_000 });
  await db.from('configuracoes').update({ espera_verde_min: 5, espera_ambar_min: 15 }).eq('id', 1);
});
