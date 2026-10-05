import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirAcesso, acessoNoBanco, limparH2, semearAcesso } from './apoio-acesso';

// Parte H2 (spec 7D.2 e 7D.3, imagem 00-cliente-contatos-acesso): perfis marcando setores e a prévia do agente mudando.
const SENHA = 'senha-forte-123';
test.beforeEach(limparH2);
test.afterAll(limparH2);
const comoAdmin = async (page: import('@playwright/test').Page) => {
  await criarUsuarioTeste({ email: 'admin-h2@e2e.local', senha: SENHA, nome: 'Thiago H2', papel: 'admin' });
  await entrar(page, 'admin-h2@e2e.local', SENHA);
};

test('perfis marcam os setores contratados e a prévia muda com as marcações', async ({ page }) => {
  const s = await semearAcesso();
  await comoAdmin(page);
  await page.goto(`/clientes/${s.rede}?aba=contatos`);
  await expect(page.getByRole('status').filter({ hasText: 'aguardando definir acesso' })).toContainText('2 contatos aguardando definir acesso.');
  const roberto = page.getByRole('row').filter({ hasText: 'Roberto Faria' });
  await expect(roberto).toContainText('Sócio');
  await expect(roberto).toContainText('Todos os setores contratados');
  await expect(page.getByRole('row').filter({ hasText: 'Carla Mendes' })).toContainText('Básico · definir');

  const bloco = await abrirAcesso(page, 'Carla Mendes');
  // Só os setores contratados + Financeiro; o não contratado não aparece (D5).
  for (const nome of ['Fiscal', 'Pessoal', 'Contábil', 'Financeiro', 'Legalização']) await expect(bloco.getByRole('checkbox', { name: nome, exact: true })).toBeVisible();
  await expect(bloco.getByRole('checkbox', { name: 'H2E2E Auditoria' })).toHaveCount(0);
  const previa = bloco.getByRole('region', { name: 'O que o agente vai fazer com Carla' });
  await expect(previa).toContainText('Conversa e abre demandas para a equipe.');

  await bloco.getByLabel('Perfil de acesso').selectOption({ label: 'Compras/Vendas' });
  await expect(bloco.getByRole('checkbox', { name: 'Fiscal', exact: true })).toBeChecked();
  await expect(bloco.getByRole('checkbox', { name: 'Pessoal', exact: true })).not.toBeChecked();
  await expect(bloco.getByRole('switch', { name: 'Pode ser procurado pelo agente do Fiscal' })).toBeChecked();
  await expect(bloco.getByRole('switch', { name: 'Pedir nota de venda' })).toBeChecked();
  await expect(bloco.getByRole('switch', { name: 'Ver valores' })).not.toBeChecked();
  await expect(previa).toContainText('Abre e consulta demandas do Fiscal, pede nota, ajusta preços e produtos, envia documentos do Fiscal (sem valores).'); // "(sem valores)": minor da Task 10 (sem "Ver valores")
  await expect(previa).toContainText('Se pedir algo de Pessoal, Contábil, Financeiro ou Legalização, ou perguntar valores: responde que vai tratar com o responsável da empresa, não revela nada, deixa uma nota para o setor e avisa o sócio (Roberto).');
  await expect(previa).toContainText('Pode receber lembretes e cobranças do Fiscal.');

  // Mudar uma marcação vira Personalizado; desfazer volta (D3).
  await bloco.getByRole('checkbox', { name: 'Pessoal', exact: true }).check();
  await expect(bloco.getByLabel('Perfil de acesso')).toHaveValue('personalizado');
  await expect(previa).toContainText('Abre e consulta demandas do Fiscal e do Pessoal');
  await bloco.getByRole('checkbox', { name: 'Pessoal', exact: true }).uncheck();
  await expect(bloco.getByLabel('Perfil de acesso')).toHaveValue('compras_vendas');
  await bloco.getByRole('switch', { name: 'Ver valores' }).click();
  await expect(previa).not.toContainText('perguntar valores');
  await bloco.getByRole('switch', { name: 'Ver valores' }).click();

  const axe = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);

  await bloco.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Acesso salvo.')).toBeVisible();
  await expect.poll(async () => (await acessoNoBanco(s.carla, s.rede)).perfil).toBe('compras_vendas');
  expect((await acessoNoBanco(s.carla, s.rede)).contato_cliente_setores).toEqual([{ setor_id: s.setores.fiscal, pode_ser_procurado: true }]);
  const carla = page.getByRole('row').filter({ hasText: 'Carla Mendes' });
  await expect(carla).toContainText('Compras/Vendas');
  await expect(carla).toContainText('pede nota');
  await expect(page.getByRole('status').filter({ hasText: 'aguardando definir acesso' })).toContainText('1 contato aguardando definir acesso.');
});

test('a mesma pessoa tem acesso diferente em outra empresa', async ({ page }) => {
  const s = await semearAcesso();
  await db.from('contato_clientes').update({ perfil: 'compras_vendas' }).eq('contato_id', s.carla).eq('cliente_id', s.rede);
  await comoAdmin(page);
  await page.goto(`/clientes/${s.padaria}?aba=contatos`);
  const carla = page.getByRole('row').filter({ hasText: 'Carla Mendes' });
  await expect(carla).toContainText('Básico · definir');
  await expect(carla).toContainText('Só conversa e abre demanda');
});

test('contato novo nasce Básico', async ({ page }) => {
  const s = await semearAcesso();
  await comoAdmin(page);
  await page.goto(`/clientes/${s.rede}?aba=contatos`);
  await page.getByLabel('Nome', { exact: true }).fill('Zé Novo');
  await page.getByLabel('Telefone').fill('(11) 90000-3030');
  await page.getByLabel('Pode pedir nota', { exact: true }).check();
  await page.getByRole('button', { name: 'Adicionar contato' }).click();
  const ze = page.getByRole('row').filter({ hasText: 'Zé Novo' });
  await expect(ze).toContainText('Básico · definir');
  await expect(ze).toContainText('pede nota');
  const { data } = await db.from('contatos').select('id').eq('telefone', '5511900003030').single();
  expect((await acessoNoBanco(data!.id, s.rede)).perfil).toBe('basico');
});

test('nome, cargo e e-mail na linha aberta; celular só leitura', async ({ page }) => {
  const s = await semearAcesso();
  await comoAdmin(page);
  await page.goto(`/clientes/${s.rede}?aba=contatos`);
  const bloco = await abrirAcesso(page, 'Carla Mendes');
  await expect(bloco.getByLabel('Celular (WhatsApp)')).toHaveAttribute('readonly', '');
  await bloco.getByLabel('Cargo').fill('Compras e vendas');
  await bloco.getByRole('button', { name: 'Salvar' }).click();
  await expect.poll(async () => (await db.from('contatos').select('cargo').eq('id', s.carla).single()).data!.cargo).toBe('Compras e vendas');
});

test('"Só ver" vê o bloco desligado e sem Salvar', async ({ page }) => {
  const s = await semearAcesso();
  const ana = await criarUsuarioTeste({ email: 'ana-h2@e2e.local', senha: SENHA, nome: 'Ana H2', papel: 'atendente', setores: ['Fiscal'] });
  await db.from('usuario_permissoes').update({ nivel: 'ver' }).eq('usuario_id', ana).eq('modulo', 'clientes');
  await entrar(page, 'ana-h2@e2e.local', SENHA);
  await page.goto(`/clientes/${s.rede}?aba=contatos`);
  const bloco = await abrirAcesso(page, 'Carla Mendes');
  await expect(bloco.getByRole('switch', { name: 'Pedir nota de venda' })).toBeDisabled();
  await expect(bloco.getByLabel('Perfil de acesso')).toBeDisabled();
  await expect(bloco.getByRole('button', { name: 'Salvar' })).toHaveCount(0);
  await expect(bloco.getByText('Só quem pode editar clientes muda as marcações.')).toBeVisible();
});

test('documento com setor: escolher o Pessoal já marca "Tem valores"', async ({ page }) => {
  const s = await semearAcesso();
  await comoAdmin(page);
  await page.goto(`/clientes/${s.rede}?aba=documentos`);
  await page.getByLabel('Nome do documento').fill('Folha de setembro');
  await page.getByLabel('Arquivo').setInputFiles({ name: 'folha.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await page.getByLabel('Setor do documento').selectOption({ label: 'Pessoal' });
  await expect(page.getByLabel('Tem valores (boleto, folha, salários)')).toBeChecked();
  await page.getByRole('button', { name: 'Enviar documento' }).click();
  await expect.poll(async () => (await db.from('documentos_empresa').select('setor_id, tem_valores').eq('cliente_id', s.rede).maybeSingle()).data)
    .toEqual({ setor_id: s.setores.pessoal, tem_valores: true });
});

test('documento com setor desativado mantém o setor ao salvar (nunca vira "da empresa" sozinho)', async ({ page }) => {
  const s = await semearAcesso();
  const auditoria = (await db.from('setores').select('id').eq('nome', 'H2E2E Auditoria').single()).data!.id as string;
  await db.from('setores').update({ ativo: false }).eq('id', auditoria);
  await db.from('documentos_empresa').insert({ cliente_id: s.rede, nome: 'Relatório de auditoria', arquivo_path: `${s.rede}/auditoria.pdf`, arquivo_nome: 'auditoria.pdf', setor_id: auditoria });
  await comoAdmin(page);
  await page.goto(`/clientes/${s.rede}?aba=documentos`);
  await expect(page.getByLabel('Setor de Relatório de auditoria', { exact: true })).toHaveValue(auditoria);
  await expect(page.getByText('H2E2E Auditoria (desativado)').first()).toBeVisible();
  // Só marca "Tem valores": o setor desativado continua o mesmo depois do Salvar.
  await page.getByLabel('Tem valores em Relatório de auditoria').check();
  await page.getByRole('button', { name: 'Salvar o setor de Relatório de auditoria' }).click();
  await expect.poll(async () => (await db.from('documentos_empresa').select('setor_id, tem_valores').eq('cliente_id', s.rede).single()).data)
    .toEqual({ setor_id: auditoria, tem_valores: true });
});
