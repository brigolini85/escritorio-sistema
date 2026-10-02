import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Parte B do painel v2: arquivar e restaurar contatos; "Apagar dados (LGPD)" continua separado e igual.
const TEL_MARIA = '5531999991701';
const TEL_ZE = '5531999991702';
const SENHA = 'senha-forte-123';

test.beforeEach(async () => {
  await db.from('chamados').delete().like('titulo', '%(contato e2e)%');
  await db.from('conversas').delete().in('telefone', [TEL_MARIA, TEL_ZE]);
  await db.from('contatos').delete().in('telefone', [TEL_MARIA, TEL_ZE]);
});

async function comoAdmin(page: Page) {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', SENHA);
}
const linha = (page: Page, texto: string) => page.getByRole('row').filter({ hasText: texto });

test('arquivar contato com conversa avisa a demanda aberta, sai da lista e volta ao restaurar', async ({ page }) => {
  const { data: maria } = await db.from('contatos').insert({ nome: 'Maria Arquivo', telefone: TEL_MARIA }).select().single();
  const { data: conversa } = await db.from('conversas').insert({ telefone: TEL_MARIA, contato_id: maria!.id }).select().single();
  const { data: s } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const { data: d } = await db.from('chamados').insert({ conversa_id: conversa!.id, setor_id: s!.id, titulo: 'Boleto (contato e2e)' }).select('numero').single();
  await comoAdmin(page);
  await page.goto('/contatos');
  await linha(page, 'Maria Arquivo').getByRole('button', { name: 'Arquivar ou excluir Maria Arquivo' }).click();
  const janela = page.getByRole('dialog', { name: 'Arquivar Maria Arquivo?' });
  await expect(janela).toContainText('1 demanda e 1 conversa ficam guardadas. Sai das listas e do agente.');
  await expect(janela).toContainText(`1 demanda ainda aberta (#${d!.numero})`);
  await janela.getByRole('button', { name: 'Sim, arquivar' }).click();
  await expect(linha(page, 'Maria Arquivo')).toHaveCount(0);

  await page.getByRole('link', { name: /^Arquivados \(\d+\)$/ }).click();
  const arquivada = linha(page, 'Maria Arquivo');
  await expect(arquivada).toContainText('Admin');
  await arquivada.getByRole('button', { name: 'Restaurar Maria Arquivo' }).click();
  await expect(arquivada).toHaveCount(0);
  await expect.poll(async () => (await db.from('contatos').select('ativo').eq('id', maria!.id).single()).data!.ativo).toBe(true);
});

test('cadastrar de novo o telefone de um contato arquivado traz ele de volta', async ({ page }) => {
  await db.from('contatos').insert({ nome: 'Zé Antigo', telefone: TEL_ZE, ativo: false });
  await comoAdmin(page);
  await page.goto('/contatos');
  await page.getByPlaceholder('Nome', { exact: true }).fill('Zé Voltou');
  await page.getByPlaceholder('Telefone (com DDD)').fill('(31) 99999-1702');
  await page.getByRole('button', { name: 'Cadastrar contato' }).click();
  await expect(linha(page, 'Zé Voltou')).toHaveCount(1);
  await expect.poll(async () => (await db.from('contatos').select('nome, ativo, arquivado_em').eq('telefone', TEL_ZE).single()).data)
    .toEqual({ nome: 'Zé Voltou', ativo: true, arquivado_em: null });
});

test('na ficha do contato, Excluir… e Apagar dados (LGPD) ficam separados', async ({ page }) => {
  const { data: maria } = await db.from('contatos').insert({ nome: 'Maria Arquivo', telefone: TEL_MARIA }).select().single();
  await comoAdmin(page);
  await page.goto(`/contatos?contato=${maria!.id}`);
  const painel = page.getByRole('dialog', { name: 'Maria Arquivo' });
  await painel.getByRole('button', { name: 'Excluir…' }).click();
  const excluir = page.getByRole('dialog', { name: 'Excluir de vez Maria Arquivo?' });
  await expect(excluir).toBeVisible();
  await excluir.getByRole('button', { name: 'Cancelar' }).click();
  await painel.getByRole('button', { name: 'Apagar dados (LGPD)' }).click();
  const lgpd = page.getByRole('dialog', { name: 'Apagar os dados de Maria Arquivo?' });
  await expect(lgpd).toContainText('A pedido do titular (LGPD): nome, telefone, mensagens, áudios e arquivos deste contato são apagados de vez, em todas as empresas.');
  await lgpd.getByRole('button', { name: 'Cancelar' }).click();
});

test('atendente sem Editar clientes não vê o comando nos contatos', async ({ page }) => {
  const { data: maria } = await db.from('contatos').insert({ nome: 'Maria Arquivo', telefone: TEL_MARIA }).select().single();
  await criarUsuarioTeste({ email: 'ana@teste.com', senha: SENHA, nome: 'Ana', papel: 'atendente' });
  await entrar(page, 'ana@teste.com', SENHA);
  await page.goto('/contatos');
  await expect(linha(page, 'Maria Arquivo')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Arquivar ou excluir/ })).toHaveCount(0);
  await page.goto(`/contatos?contato=${maria!.id}`);
  await expect(page.getByRole('button', { name: 'Excluir…' })).toHaveCount(0);
});
