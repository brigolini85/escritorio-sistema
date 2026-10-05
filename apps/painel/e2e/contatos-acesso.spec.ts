import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, entrar } from './apoio';
import { acessoNoBanco, limparH2, semearAcesso } from './apoio-acesso';

// Parte H2 (spec 7C.2, último item): coluna Perfil e o mesmo bloco de acesso da ficha no painel lateral, com os mesmos dados.
const SENHA = 'senha-forte-123';
test.beforeEach(limparH2);
test.afterAll(limparH2);

test('coluna Perfil por empresa e o bloco do painel grava o mesmo que a ficha mostra', async ({ page }) => {
  const s = await semearAcesso();
  await criarUsuarioTeste({ email: 'admin-h2c@e2e.local', senha: SENHA, nome: 'Thiago H2', papel: 'admin' });
  await entrar(page, 'admin-h2c@e2e.local', SENHA);
  // Pela parte do telefone: o nome "Carla Mendes" também existe nos dados da G3.
  await page.goto('/contatos?q=900002211');
  const linha = page.locator('tbody tr').filter({ hasText: 'Carla Mendes' });
  await expect(linha.getByText('Básico · definir')).toHaveCount(2); // Rede e Padaria
  await linha.click();
  const painel = page.getByRole('dialog', { name: 'Carla Mendes' });
  await painel.getByRole('button', { name: 'Acesso em H2E2E Rede Bom Preço Ltda' }).click();
  const bloco = painel.getByRole('group', { name: 'H2E2E Rede Bom Preço Ltda' });
  await expect(bloco).toHaveAttribute('data-acesso-hidratado', '');
  await bloco.getByLabel('Perfil de acesso').selectOption({ label: 'RH/DP' });
  await expect(bloco.getByRole('region', { name: 'O que o agente vai fazer com Carla' })).toContainText('Abre e consulta demandas do Pessoal');
  await bloco.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Acesso salvo.')).toBeVisible();
  await expect.poll(async () => (await acessoNoBanco(s.carla, s.rede)).perfil).toBe('rh_dp');
  expect((await acessoNoBanco(s.carla, s.padaria)).perfil).toBe('basico');

  await page.goto(`/clientes/${s.rede}?aba=contatos`);
  await expect(page.getByRole('row').filter({ hasText: 'Carla Mendes' })).toContainText('RH/DP');
});
