import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Parte B do painel v2: arquivar e restaurar contatos; "Apagar dados (LGPD)" continua separado e igual.
const TEL_MARIA = '5531999991701';
const TEL_ZE = '5531999991702';
const TEL_LGPD = '5500123451799';
const CNPJ_X = '17170000000101';
const CNPJ_Y = '17170000000202';
const SENHA = 'senha-forte-123';

test.beforeEach(async () => {
  await db.from('chamados').delete().like('titulo', '%(contato e2e)%');
  await db.from('conversas').delete().in('telefone', [TEL_MARIA, TEL_ZE, TEL_LGPD]);
  await db.from('contatos').delete().in('telefone', [TEL_MARIA, TEL_ZE, TEL_LGPD]);
  await db.from('clientes').delete().in('cnpj', [CNPJ_X, CNPJ_Y]);
});

// Empresa X (onde o contato é cadastrado agora) e Y (vínculo antigo).
async function empresas() {
  const { data: x } = await db.from('clientes').insert({ razao_social: 'Indústria X (contato e2e)', cnpj: CNPJ_X }).select('id').single();
  const { data: y } = await db.from('clientes').insert({ razao_social: 'Indústria Y (contato e2e)', cnpj: CNPJ_Y }).select('id').single();
  return { x: x!.id, y: y!.id };
}
async function vinculos(contatoId: string) {
  return (await db.from('contato_clientes').select('cliente_id, pode_pedir_nota, pode_atualizar_preco').eq('contato_id', contatoId)).data ?? [];
}
const porEmpresa = <T extends { cliente_id: string }>(l: T[]) => [...l].sort((a, b) => a.cliente_id.localeCompare(b.cliente_id));
async function semViolacoesGraves(page: Page) {
  const r = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
}

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

test('cadastrar de novo o telefone de um contato arquivado traz ele de volta, sem os vínculos antigos', async ({ page }) => {
  const { y } = await empresas();
  const { data: ze } = await db.from('contatos').insert({ nome: 'Zé Antigo', telefone: TEL_ZE, ativo: false }).select().single();
  await db.from('contato_clientes').insert({ contato_id: ze!.id, cliente_id: y, pode_pedir_nota: true });
  await comoAdmin(page);
  await page.goto('/contatos');
  await page.getByPlaceholder('Nome', { exact: true }).fill('Zé Voltou');
  await page.getByPlaceholder('Telefone (com DDD)').fill('(31) 99999-1702');
  await page.getByRole('button', { name: 'Cadastrar contato' }).click();
  const janela = page.getByRole('dialog', { name: 'Trazer Zé Antigo de volta?' });
  await expect(janela.getByRole('checkbox', { name: /Indústria Y \(contato e2e\)/ })).not.toBeChecked();
  await janela.getByRole('button', { name: 'Trazer de volta' }).click();
  await expect(page.getByText('Contato arquivado voltou, sem empresas. Os vínculos antigos saíram.')).toBeVisible();
  await expect(linha(page, 'Zé Voltou')).toHaveCount(1);
  await expect.poll(async () => (await db.from('contatos').select('nome, ativo, arquivado_em').eq('telefone', TEL_ZE).single()).data)
    .toEqual({ nome: 'Zé Voltou', ativo: true, arquivado_em: null });
  expect(await vinculos(ze!.id)).toEqual([]);
  // O aviso sai da URL: recarregar não mostra de novo.
  await expect(page).not.toHaveURL(/aviso=/);
});

test('pela ficha da empresa, o arquivado volta só com o vínculo novo e as permissões escolhidas agora', async ({ page }) => {
  const { x, y } = await empresas();
  const { data: ze } = await db.from('contatos').insert({ nome: 'Zé Antigo', telefone: TEL_ZE, ativo: false }).select().single();
  await db.from('contato_clientes').insert({ contato_id: ze!.id, cliente_id: x, pode_atualizar_preco: true });
  await db.from('contato_clientes').insert({ contato_id: ze!.id, cliente_id: y, pode_pedir_nota: true, pode_atualizar_preco: true });
  await comoAdmin(page);
  await page.goto(`/clientes/${x}?aba=contatos`);
  await page.getByLabel('Nome', { exact: true }).fill('Zé Voltou');
  await page.getByLabel('Telefone').fill('(31) 99999-1702');
  await page.getByLabel('Pode pedir nota', { exact: true }).check();
  await page.getByRole('button', { name: 'Adicionar contato' }).click();
  const janela = page.getByRole('dialog', { name: 'Trazer Zé Antigo de volta?' });
  // A empresa da ficha (X) sempre entra e não aparece na lista; só a Y é perguntada.
  await expect(janela.getByRole('checkbox')).toHaveCount(1);
  await janela.getByRole('button', { name: 'Trazer de volta' }).click();
  await expect(page.getByText('Contato arquivado voltou. Os vínculos antigos com outras empresas saíram.')).toBeVisible();
  await expect(page.getByText('Zé Voltou · 5531999991702 · pode pedir nota')).toBeVisible();
  expect(await vinculos(ze!.id)).toEqual([{ cliente_id: x, pode_pedir_nota: true, pode_atualizar_preco: false }]);
});

test('pela conversa, o arquivado volta só com a empresa escolhida', async ({ page }) => {
  const { x, y } = await empresas();
  const { data: ze } = await db.from('contatos').insert({ nome: 'Zé Antigo', telefone: TEL_ZE, ativo: false }).select().single();
  await db.from('contato_clientes').insert({ contato_id: ze!.id, cliente_id: y, pode_pedir_nota: true, pode_atualizar_preco: true });
  const { data: conversa } = await db.from('conversas').insert({ telefone: TEL_ZE }).select().single();
  await db.from('mensagens').insert({ conversa_id: conversa!.id, direcao: 'entrada', autor: 'cliente', tipo: 'texto', conteudo: 'oi, voltei' });
  await comoAdmin(page);
  await page.goto(`/atendimento/${conversa!.id}`);
  await page.getByLabel('Nome do contato').fill('Zé Voltou');
  await page.getByLabel('Empresa (opcional)').selectOption({ label: 'Indústria X (contato e2e)' });
  await page.getByRole('button', { name: 'Cadastrar contato' }).click();
  const janela = page.getByRole('dialog', { name: 'Trazer Zé Antigo de volta?' });
  await expect(janela.getByRole('checkbox', { name: /Indústria Y \(contato e2e\)/ })).not.toBeChecked();
  await janela.getByRole('button', { name: 'Trazer de volta' }).click();
  await expect(page.getByText('Contato arquivado voltou. Os vínculos antigos com outras empresas saíram.')).toBeVisible();
  expect(await vinculos(ze!.id)).toEqual([{ cliente_id: x, pode_pedir_nota: false, pode_atualizar_preco: false }]);
});

test('contato ativo cadastrado de novo pela ficha continua com os outros vínculos, sem aviso', async ({ page }) => {
  const { x, y } = await empresas();
  const { data: maria } = await db.from('contatos').insert({ nome: 'Maria Arquivo', telefone: TEL_MARIA }).select().single();
  await db.from('contato_clientes').insert({ contato_id: maria!.id, cliente_id: y, pode_pedir_nota: true });
  await comoAdmin(page);
  await page.goto(`/clientes/${x}?aba=contatos`);
  await page.getByLabel('Nome', { exact: true }).fill('Maria Arquivo');
  await page.getByLabel('Telefone').fill('(31) 99999-1701');
  await page.getByRole('button', { name: 'Adicionar contato' }).click();
  await expect(page.getByText('Maria Arquivo · 5531999991701')).toBeVisible();
  await expect(page.getByText(/Contato arquivado voltou/)).toHaveCount(0);
  expect((await vinculos(maria!.id)).map((v) => v.cliente_id).sort()).toEqual([x, y].sort());
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

test('pela ficha, a pessoa escolhe quais empresas de antes voltam, com as marcações antigas', async ({ page }) => {
  const { x, y } = await empresas();
  const { data: ze } = await db.from('contatos').insert({ nome: 'Zé Antigo', telefone: TEL_ZE, ativo: false }).select().single();
  await db.from('contato_clientes').insert({ contato_id: ze!.id, cliente_id: y, pode_pedir_nota: true, pode_atualizar_preco: true });
  await comoAdmin(page);
  await page.goto(`/clientes/${x}?aba=contatos`);
  await page.getByLabel('Nome', { exact: true }).fill('Zé Voltou');
  await page.getByLabel('Telefone').fill('(31) 99999-1702');
  await page.getByLabel('Pode pedir nota', { exact: true }).check();
  await page.getByRole('button', { name: 'Adicionar contato' }).click();
  const janela = page.getByRole('dialog', { name: 'Trazer Zé Antigo de volta?' });
  await expect(janela).toContainText('Indústria X (contato e2e) entra com as marcações escolhidas agora.');
  await expect(janela).toContainText('pode pedir nota · pode mudar preço e cadastrar produto');
  const caixaY = janela.getByRole('checkbox', { name: /Indústria Y \(contato e2e\)/ });
  await expect(caixaY).not.toBeChecked();
  await semViolacoesGraves(page);
  await caixaY.check();
  await janela.getByRole('button', { name: 'Trazer de volta' }).click();
  await expect(page.getByText('Contato arquivado voltou com as empresas escolhidas.')).toBeVisible();
  expect(porEmpresa(await vinculos(ze!.id))).toEqual(porEmpresa([
    { cliente_id: x, pode_pedir_nota: true, pode_atualizar_preco: false },
    { cliente_id: y, pode_pedir_nota: true, pode_atualizar_preco: true },
  ]));
  const { data: aud } = await db.from('auditoria_acessos').select('detalhes').eq('acao', 'reativar_contato').eq('entidade_id', ze!.id);
  expect(aud).toEqual([{ detalhes: { empresa_nova: x, mantidos: [y], removidos: [] } }]);
});

test('cancelar a pergunta não cadastra nada', async ({ page }) => {
  const { y } = await empresas();
  const { data: ze } = await db.from('contatos').insert({ nome: 'Zé Antigo', telefone: TEL_ZE, ativo: false }).select().single();
  await db.from('contato_clientes').insert({ contato_id: ze!.id, cliente_id: y, pode_pedir_nota: true });
  await comoAdmin(page);
  await page.goto('/contatos');
  await page.getByPlaceholder('Nome', { exact: true }).fill('Zé Voltou');
  await page.getByPlaceholder('Telefone (com DDD)').fill('(31) 99999-1702');
  await page.getByRole('button', { name: 'Cadastrar contato' }).click();
  const janela = page.getByRole('dialog', { name: 'Trazer Zé Antigo de volta?' });
  await janela.getByRole('button', { name: 'Cancelar' }).click();
  await expect(janela).toHaveCount(0);
  expect((await db.from('contatos').select('nome, ativo').eq('id', ze!.id).single()).data).toEqual({ nome: 'Zé Antigo', ativo: false });
  expect(await vinculos(ze!.id)).toEqual([{ cliente_id: y, pode_pedir_nota: true, pode_atualizar_preco: false }]);
});

test('arquivado sem empresas de antes volta sem pergunta', async ({ page }) => {
  await db.from('contatos').insert({ nome: 'Zé Antigo', telefone: TEL_ZE, ativo: false });
  await comoAdmin(page);
  await page.goto('/contatos');
  await page.getByPlaceholder('Nome', { exact: true }).fill('Zé Voltou');
  await page.getByPlaceholder('Telefone (com DDD)').fill('(31) 99999-1702');
  await page.getByRole('button', { name: 'Cadastrar contato' }).click();
  await expect(page.getByText('Contato arquivado voltou.', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('telefone de contato apagado pela LGPD: avisa e não cadastra', async ({ page }) => {
  const { data: apagado } = await db.from('contatos').insert({ nome: 'Contato removido', telefone: TEL_LGPD, ativo: false }).select().single();
  await db.from('auditoria_acessos').insert({ acao: 'anonimizar', entidade: 'contatos', entidade_id: apagado!.id });
  await comoAdmin(page);
  await page.goto('/contatos');
  await page.getByPlaceholder('Nome', { exact: true }).fill('Tentativa');
  await page.getByPlaceholder('Telefone (com DDD)').fill(TEL_LGPD);
  await page.getByRole('button', { name: 'Cadastrar contato' }).click();
  await expect(page.getByText('Os dados deste contato foram apagados (LGPD). Ele não volta.')).toBeVisible();
  expect((await db.from('contatos').select('nome, ativo').eq('id', apagado!.id).single()).data).toEqual({ nome: 'Contato removido', ativo: false });
  await db.from('auditoria_acessos').delete().eq('acao', 'anonimizar').eq('entidade_id', apagado!.id);
});

test('a linha abre o contato e o nome muda ali; sem permissão não há edição', async ({ page }) => {
  await db.from('contatos').insert({ nome: 'Maria Arquivo', telefone: TEL_MARIA });
  await comoAdmin(page);
  await page.goto('/contatos');
  await page.locator('tbody tr').filter({ hasText: 'Maria Arquivo' }).click();
  const painel = page.getByRole('dialog');
  await painel.getByLabel('Nome', { exact: true }).fill('Maria Souza');
  await painel.getByRole('button', { name: 'Salvar nome' }).click();
  await expect(page.getByText('Salvo: Maria Souza.')).toBeVisible();
  await expect.poll(async () => (await db.from('contatos').select('nome').eq('telefone', TEL_MARIA).single()).data!.nome).toBe('Maria Souza');

  await page.context().clearCookies();
  await criarUsuarioTeste({ email: 'ana-contatos@teste.com', senha: SENHA, nome: 'Ana', papel: 'atendente' });
  await entrar(page, 'ana-contatos@teste.com', SENHA);
  await page.goto('/contatos');
  await expect(linha(page, 'Maria Souza')).toHaveCount(1);
  await expect(page.getByRole('link', { name: /^Editar / })).toHaveCount(0);
});
