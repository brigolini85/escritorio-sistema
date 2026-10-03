import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirSecao, textoDias } from './apoio-configuracoes';

const SENHA = 'senha-forte-123';

test.beforeEach(async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin-g1@e2e.local', senha: SENHA, nome: 'Admin G1', papel: 'admin' });
  await entrar(page, 'admin-g1@e2e.local', SENHA);
});

test('Expediente: campo alterado fica âmbar com "antes", Descartar volta e Salvar grava', async ({ page }) => {
  const antes = (await db.from('configuracoes').select('horario_fim').eq('id', 1).single()).data!.horario_fim.slice(0, 5);
  const novo = antes === '19:15' ? '18:45' : '19:15';
  await abrirSecao(page, 'expediente');
  const cartao = page.getByRole('region', { name: 'Expediente' });
  const fim = cartao.getByLabel('às', { exact: true });
  await fim.fill(novo, { timeout: 30_000 });
  await expect(fim).toHaveAttribute('data-alterado', '');
  await expect(cartao.getByText(`antes: ${antes}`)).toBeVisible();
  await expect(cartao.getByText('1 alteração não salva')).toBeVisible();
  await cartao.getByRole('button', { name: 'Descartar' }).click();
  await expect(fim).toHaveValue(antes);
  await expect(cartao.getByText('Sem alterações')).toBeVisible();
  try {
    await fim.fill(novo);
    await cartao.getByRole('button', { name: 'Salvar expediente' }).click();
    await expect(page.getByText('Expediente salvo.')).toBeVisible();
    await expect.poll(async () => (await db.from('configuracoes').select('horario_fim').eq('id', 1).single()).data?.horario_fim.slice(0, 5)).toBe(novo);
    await expect(cartao.getByText('Sem alterações')).toBeVisible();
  } finally {
    await db.from('configuracoes').update({ horario_fim: `${antes}:00` }).eq('id', 1);
  }
});

test('Expediente: fim antes do início — o navegador segura e o que foi digitado fica', async ({ page }) => {
  await abrirSecao(page, 'expediente');
  const cartao = page.getByRole('region', { name: 'Expediente' });
  const inicio = cartao.getByLabel('Das', { exact: true });
  await inicio.fill('19:00', { timeout: 30_000 });
  await cartao.getByLabel('às', { exact: true }).fill('18:00');
  await cartao.getByRole('button', { name: 'Salvar expediente' }).click();
  // O navegador segura (mesma regra do servidor) e o digitado continua.
  await expect(inicio).toHaveValue('19:00');
  await expect(cartao.getByText(/alteraç(ão|ões) não salva/)).toBeVisible();
});

test('Prazos: exemplo de vencimento, abertas por prioridade, "antes" e "era"', async ({ page }) => {
  await abrirSecao(page, 'prazos');
  const cartao = page.getByRole('region', { name: 'Prazos por prioridade' });
  await expect(cartao.getByRole('row')).toHaveCount(5, { timeout: 30_000 });
  await expect(cartao.getByText(/^vence /)).toHaveCount(4);
  await expect(cartao.getByText(/\d+ abertas?$/)).toHaveCount(4);
  const normal = cartao.getByLabel('Normal (dias úteis)');
  const valor = Number(await normal.inputValue());
  await normal.fill(String(valor + 1));
  await expect(cartao.getByText(`antes: ${textoDias(valor)}`)).toBeVisible();
  await expect(cartao.getByText(/\(era (seg|ter|qua|qui|sex|sáb|dom) \d{2}\/\d{2}\)/)).toBeVisible();
  await cartao.getByRole('button', { name: 'Descartar' }).click();
  await expect(normal).toHaveValue(String(valor));
  await expect(page.getByRole('region', { name: 'Como o prazo é contado' })).toContainText('Com o cliente');
  await expect(page.getByRole('region', { name: 'Quem pode mudar o prazo' })).toContainText('com a permissão');
});

test('Feriados: adiciona (o formulário volta vazio) e remove', async ({ page }) => {
  await db.from('feriados').delete().eq('data', '2099-12-24');
  await abrirSecao(page, 'feriados');
  const cartao = page.getByRole('region', { name: 'Feriados' });
  await cartao.getByLabel('Data do feriado').fill('2099-12-24', { timeout: 30_000 });
  await cartao.getByLabel('Descrição do feriado').fill('Véspera e2e G1');
  await cartao.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByText('Feriado adicionado.')).toBeVisible();
  await expect(cartao.getByText('Véspera e2e G1', { exact: true })).toBeVisible();
  await expect(cartao.getByLabel('Descrição do feriado')).toHaveValue('');
  await cartao.getByRole('button', { name: 'Remover o feriado 24/12/2099' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remover' }).click();
  await expect(cartao.getByText('Véspera e2e G1')).toHaveCount(0);
});
