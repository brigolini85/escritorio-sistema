import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, entrar } from './apoio';
import { demandaE2e, limparDemandasE2e } from './apoio-demandas';
import { abrirInicio, cartaoNumero, numeroInicio } from './apoio-inicio';

const SENHA = 'senha-forte-123';
const P = 'E2E-C13';

test.beforeEach(() => limparDemandasE2e(P));
test.afterAll(() => limparDemandasE2e(P));

/** Fim do dia de hoje em Brasília (UTC-3, sem horário de verão) menos 1 minuto: ainda hoje e no futuro. */
// A atrasada vence ontem (26 h atrás): uma de 1 h atrás também cairia em "hoje" e contaria nos dois números.
function fimDeHoje(): string {
  const UM_DIA = 24 * 3600_000;
  const inicio = Math.floor((Date.now() - 3 * 3600_000) / UM_DIA) * UM_DIA + 3 * 3600_000;
  return new Date(inicio + UM_DIA - 60_000).toISOString();
}

test('Início: Vencem hoje e Vencidas contam e levam à tabela com o filtro', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', SENHA);
  await abrirInicio(page, 'situacao');
  const antesHoje = await numeroInicio(page, 'vencem-hoje');
  const antesVencidas = await numeroInicio(page, 'vencidas');

  await demandaE2e({ titulo: `${P} Vence hoje`, setor: 'Fiscal', status: 'em_andamento', prazoEm: fimDeHoje() });
  await demandaE2e({ titulo: `${P} Atrasada`, setor: 'Fiscal', status: 'em_andamento', prazoEm: new Date(Date.now() - 26 * 3600_000).toISOString() });
  await abrirInicio(page, 'situacao');
  await expect.poll(() => numeroInicio(page, 'vencem-hoje')).toBe(antesHoje + 1);
  await expect.poll(() => numeroInicio(page, 'vencidas')).toBe(antesVencidas + 1);

  await cartaoNumero(page, 'vencem-hoje').getByRole('link', { name: 'Ver na lista' }).click();
  await expect(page).toHaveURL(/prazo=hoje/);
  await expect(page.getByText('Prazo: vence hoje')).toBeVisible({ timeout: 30_000 });
  // A tabela pode ter outras demandas do banco: a busca deixa só as deste teste.
  await page.goto(`/demandas?prazo=hoje&q=${P}`);
  await expect(page.getByRole('row', { name: new RegExp(`${P} Vence hoje`) })).toBeVisible();

  await abrirInicio(page, 'situacao');
  await cartaoNumero(page, 'vencidas').getByRole('link', { name: 'Ver na lista' }).click();
  await expect(page).toHaveURL(/vencidas=1/);
  await expect(page.getByRole('navigation', { name: 'Filtros rápidos' }).getByRole('link', { name: /Vencidas/ })).toHaveAttribute('aria-current', 'true', { timeout: 30_000 });
  await page.goto(`/demandas?vencidas=1&q=${P}`);
  await expect(page.getByRole('row', { name: new RegExp(`${P} Atrasada`) })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(`${P} Vence hoje`) })).toHaveCount(0);
});
