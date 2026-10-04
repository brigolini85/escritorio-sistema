import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirInicio } from './apoio-inicio';

const SENHA = 'senha-forte-123';

// Prompt G, ponto que não pode falhar: o papel escolhe a versão (D1).
test('administrador abre o Painel de situação; quem atende, a Minha mesa (também com "Configurações: Sim")', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin-papel@e2e.local', senha: SENHA, nome: 'Thiago Papel', papel: 'admin' });
  await entrar(page, 'admin-papel@e2e.local', SENHA);
  await abrirInicio(page, 'situacao');
  await expect(page.locator('[data-inicio="mesa"]')).toHaveCount(0);

  await page.context().clearCookies();
  await criarUsuarioTeste({ email: 'ana-papel@e2e.local', senha: SENHA, nome: 'Ana Papel', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'ana-papel@e2e.local', SENHA);
  await abrirInicio(page, 'mesa');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^(Bom dia|Boa tarde|Boa noite), Ana$/);
  await expect(page.locator('[data-inicio="situacao"]')).toHaveCount(0);

  await page.context().clearCookies();
  const conf = await criarUsuarioTeste({ email: 'conf-papel@e2e.local', senha: SENHA, nome: 'Cláudia Papel', papel: 'atendente' });
  await db.from('usuario_permissoes').update({ nivel: 'sim' }).eq('usuario_id', conf).eq('modulo', 'configuracoes');
  await entrar(page, 'conf-papel@e2e.local', SENHA);
  await abrirInicio(page, 'mesa');
});
