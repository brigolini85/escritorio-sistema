import { expect, test } from '@playwright/test';
import { limparBanco, sqlTeste } from '@escritorio/db/teste';
import { criarUsuarioTeste, entrar } from './apoio';
import { SENHA, abrirAgente, criarDono } from './apoio-agentes';

// Parte I3a (D13, D19, D25): a ficha do agente de Trabalho.
test.beforeEach(async () => { await limparBanco(); });
test.afterAll(async () => { await limparBanco(); });

test('dono: faixa das tarefas, limites salvos e no histórico; ferramentas das tarefas', async ({ page }) => {
  await criarDono();
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirAgente(page, 'contabil');
  await expect(page.getByText('Desligado: não recebe tarefas.')).toBeVisible();
  const limites = page.getByRole('region', { name: 'Limites de cada tarefa' });
  await limites.getByLabel('Custo (US$)').fill('3,50');
  await limites.getByLabel('Tempo (minutos)').fill('30');
  await limites.getByRole('button', { name: 'Salvar limites' }).click();
  await expect.poll(async () => (await sqlTeste<{ u: string; m: number }>(
    "select tarefa_limite_usd::text as u, tarefa_limite_minutos as m from public.agentes where slug = 'contabil'"))[0]).toEqual({ u: '3.50', m: 30 });
  await abrirAgente(page, 'contabil', 'ferramentas');
  await expect(page.getByText('Ferramentas das tarefas')).toBeVisible();
  await expect(page.getByText('Entregar o resultado')).toBeVisible();
});

test('administrador que não é dono: limites só para ler', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@i3.local', senha: SENHA, nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@i3.local', SENHA);
  await abrirAgente(page, 'contabil');
  const limites = page.getByRole('region', { name: 'Limites de cada tarefa' });
  await expect(limites.getByText('US$ 2,00 e 20 minutos por tarefa. Só o dono altera.')).toBeVisible();
  await expect(limites.getByRole('button', { name: 'Salvar limites' })).toHaveCount(0);
});
