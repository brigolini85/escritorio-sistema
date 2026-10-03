import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, entrar } from './apoio';
import { demandaE2e, limparDemandasE2e } from './apoio-demandas';

const SENHA = 'senha-forte-123';
const P = 'E2E-C10';

test.beforeEach(() => limparDemandasE2e(P));
test.afterAll(() => limparDemandasE2e(P));

test('quadro: arrastar muda o status, Concluída pede confirmação, teclado move, a escolha fica guardada', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin', papel: 'admin' });
  await demandaE2e({ titulo: `${P} Nota de venda`, setor: 'Fiscal', prioridade: 'urgente' });
  await demandaE2e({ titulo: `${P} Admissão`, setor: 'Pessoal', status: 'em_andamento', prioridade: 'alta' });
  await entrar(page, 'admin@teste.com', SENHA);
  await page.goto(`/demandas?q=${P}`);
  await page.getByRole('button', { name: 'Quadro' }).click();
  await expect(page.getByRole('button', { name: 'Quadro' })).toHaveAttribute('aria-pressed', 'true', { timeout: 30_000 });

  const coluna = (nome: RegExp) => page.getByRole('region', { name: nome });
  const cartao = (titulo: string) => page.getByRole('link', { name: new RegExp(titulo) });
  await expect(coluna(/^Nova/)).toContainText(`${P} Nota de venda`);
  await expect(coluna(/^Nova/)).toContainText('Urgente', { ignoreCase: true });
  await expect(page.getByRole('navigation', { name: 'Filtros rápidos' }).getByRole('link', { name: /^Novas/ })).toHaveCount(0);

  await cartao(`${P} Nota de venda`).dragTo(coluna(/^Resolvendo/));
  await expect(page.getByText('Status: Resolvendo.')).toBeVisible();
  await expect(coluna(/^Resolvendo/)).toContainText(`${P} Nota de venda`);

  await cartao(`${P} Admissão`).dragTo(coluna(/^Concluída/));
  const janela = page.getByRole('dialog', { name: /Concluir a demanda/ });
  await expect(janela).toBeVisible();
  await janela.getByRole('button', { name: 'Concluir' }).click();
  await expect(page.getByText('Demanda concluída.')).toBeVisible();
  await expect(coluna(/^Concluída/)).toContainText(`${P} Admissão`);

  await cartao(`${P} Nota de venda`).focus();
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.getByText('Status: Com o cliente.')).toBeVisible();
  await expect(coluna(/^Com o cliente/)).toContainText(`${P} Nota de venda`);
  await expect(coluna(/^Com o cliente/)).toContainText('pausado');

  await page.goto('/demandas');
  await expect(page.getByRole('button', { name: 'Quadro' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await expect(page.getByRole('button', { name: 'Tabela' })).toHaveAttribute('aria-pressed', 'true');
});
