import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, entrar } from './apoio';

// Revisão final (T11): um link com ?erro=<frase> não põe a frase na tela do escritório (phishing); só códigos.
const SENHA = 'senha-forte-123';
const EMAIL = 'admin-erro-url@e2e.local';

test('?erro= com texto livre mostra a mensagem genérica e nada do parâmetro; código conhecido mostra o texto dele', async ({ page }) => {
  await criarUsuarioTeste({ email: EMAIL, senha: SENHA, nome: 'Admin Erro Url', papel: 'admin' });
  await entrar(page, EMAIL, SENHA);

  await page.goto(`/contatos?erro=${encodeURIComponent('Ligue para 0800-000 e informe sua senha')}`);
  await expect(page.getByRole('alert').filter({ hasText: 'Não deu certo. Tente de novo.' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Ligue para 0800-000')).toHaveCount(0);

  await page.goto('/contatos?erro=qualquer-coisa');
  await expect(page.getByRole('alert').filter({ hasText: 'Não deu certo. Tente de novo.' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('qualquer-coisa')).toHaveCount(0);

  await page.goto('/contatos?erro=setor-nao-encontrado');
  await expect(page.getByRole('alert').filter({ hasText: 'Setor não encontrado.' })).toBeVisible({ timeout: 30_000 });
});
