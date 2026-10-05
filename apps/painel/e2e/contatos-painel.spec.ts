import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirContatos, limparG3, linhaContato, PREFIXO, semearContatos, semearHistorico } from './apoio-contatos';

const SENHA = 'senha-forte-123';
test.beforeEach(limparG3);
test.afterAll(limparG3);

const vinculo = async (contato: string, empresa: string) =>
  (await db.from('contato_clientes').select('pode_pedir_nota, pode_atualizar_preco').eq('contato_id', contato).eq('cliente_id', empresa).maybeSingle()).data;

const nivel = (id: string, modulo: string, n: string) => db.from('usuario_permissoes').update({ nivel: n }).eq('usuario_id', id).eq('modulo', modulo);

test('painel: Abrir conversa, marcações por empresa, vincular empresa, Editar e a chave do agente', async ({ page }) => {
  const s = await semearContatos();
  await criarUsuarioTeste({ email: 'admin-g3p@e2e.local', senha: SENHA, nome: 'Thiago G3', papel: 'admin' });
  await entrar(page, 'admin-g3p@e2e.local', SENHA);
  await abrirContatos(page, `?q=${PREFIXO}`);
  await linhaContato(page, 'Carla Mendes').click();
  const painel = page.getByRole('dialog', { name: `${PREFIXO} Carla Mendes` });
  await expect(painel.getByRole('link', { name: 'Abrir conversa' })).toHaveAttribute('href', `/atendimento/${s.conversaCarla}`);
  await expect(painel).not.toContainText('Zeta'); // empresa arquivada fora do painel (D5)

  // Parte H2 (D22): as marcações moram no bloco de acesso de cada empresa, com Salvar.
  await painel.getByRole('button', { name: `Acesso em ${PREFIXO} Mercado Central` }).click();
  const mercado = painel.getByRole('group', { name: `${PREFIXO} Mercado Central` });
  await mercado.getByRole('switch', { name: 'Pedir nota de venda' }).click();
  await mercado.getByRole('button', { name: 'Salvar' }).click();
  await expect.poll(async () => (await vinculo(s.carla, s.mercado))?.pode_pedir_nota).toBe(true);
  await painel.getByRole('button', { name: `Acesso em ${PREFIXO} Rede Bom Preço Ltda` }).click();
  const redeAcesso = painel.getByRole('group', { name: `${PREFIXO} Rede Bom Preço Ltda` });
  await redeAcesso.getByRole('switch', { name: 'Pedir nota de venda' }).click();
  await redeAcesso.getByRole('button', { name: 'Salvar' }).click();
  await expect.poll(async () => (await vinculo(s.carla, s.rede))?.pode_pedir_nota).toBe(false);

  // Vincular empresa: só as ativas ainda não ligadas (D10).
  await painel.getByRole('button', { name: 'Vincular empresa' }).click();
  const form = painel.getByRole('form', { name: 'Vincular empresa' });
  await form.getByRole('combobox', { name: 'Empresa', exact: true }).click();
  await page.getByRole('combobox', { name: 'Buscar empresa' }).fill(PREFIXO);
  await expect(page.getByRole('option', { name: new RegExp(`${PREFIXO} (Zeta|Mercado|Rede)`) })).toHaveCount(0);
  await page.getByRole('option', { name: new RegExp(`${PREFIXO} Padaria Sol`) }).click();
  await form.getByRole('checkbox', { name: 'Pode mudar preço e cadastrar produto' }).check();
  await form.getByRole('button', { name: 'Vincular', exact: true }).click();
  await expect(page.getByText('Empresa vinculada.')).toBeVisible();
  await painel.getByRole('button', { name: `Acesso em ${PREFIXO} Padaria Sol` }).click();
  await expect(painel.getByRole('group', { name: new RegExp(`^${PREFIXO} Padaria Sol`) }).getByRole('switch', { name: 'Mudar preço e cadastrar produto' })).toBeChecked();
  expect(await vinculo(s.carla, s.padaria)).toEqual({ pode_pedir_nota: false, pode_atualizar_preco: true });

  // Editar abre o nome (D6).
  await painel.getByRole('link', { name: `Editar ${PREFIXO} Carla Mendes` }).click();
  const painelEditar = page.getByRole('dialog', { name: `${PREFIXO} Carla Mendes` });
  await painelEditar.getByLabel('Nome', { exact: true }).fill(`${PREFIXO} Carla Souza`);
  await painelEditar.getByRole('button', { name: 'Salvar nome' }).click();
  await expect(page.getByText(`Salvo: ${PREFIXO} Carla Souza.`)).toBeVisible();

  // Chave do agente no painel.
  const painelNovo = page.getByRole('dialog', { name: `${PREFIXO} Carla Souza` });
  await painelNovo.getByRole('switch', { name: `Desligar o agente para ${PREFIXO} Carla Souza` }).click();
  await expect.poll(async () => (await db.from('contatos').select('agente_pausado').eq('id', s.carla).single()).data!.agente_pausado).toBe(true);
});

test('painel com "Só ver" e Atendimento "Sem acesso": sem Editar, marcações e vincular travados, Abrir conversa com o motivo', async ({ page }) => {
  const s = await semearContatos();
  const ana = await criarUsuarioTeste({ email: 'ana-g3p@e2e.local', senha: SENHA, nome: 'Ana G3', papel: 'atendente', setores: ['Fiscal'] });
  await nivel(ana, 'clientes', 'ver');
  await nivel(ana, 'atendimento', 'sem_acesso');
  await entrar(page, 'ana-g3p@e2e.local', SENHA);
  // Mesmo com ?editar=1 no endereço, "Só ver" não ganha o campo Nome.
  await abrirContatos(page, `?q=${PREFIXO}&contato=${s.carla}&editar=1`);
  const painel = page.getByRole('dialog', { name: `${PREFIXO} Carla Mendes` });
  await expect(painel.getByText(`${PREFIXO} Mercado Central`)).toBeVisible({ timeout: 30_000 });

  await expect(painel.getByRole('link', { name: /^Editar / })).toHaveCount(0);
  await expect(painel.getByLabel('Nome', { exact: true })).toHaveCount(0);
  await expect(painel.getByRole('button', { name: 'Vincular empresa' })).toHaveCount(0);
  for (const empresa of ['Mercado Central', 'Rede Bom Preço Ltda']) {
    await painel.getByRole('button', { name: `Acesso em ${PREFIXO} ${empresa}` }).click();
    const grupo = painel.getByRole('group', { name: `${PREFIXO} ${empresa}` });
    await expect(grupo.getByRole('switch', { name: 'Pedir nota de venda' })).toBeDisabled();
    await expect(grupo.getByRole('switch', { name: 'Mudar preço e cadastrar produto' })).toBeDisabled();
  }
  await expect(painel.getByText('Só quem pode editar clientes muda as marcações.')).toBeVisible();
  await expect(painel.getByRole('switch', { name: `Desligar o agente para ${PREFIXO} Carla Mendes` })).toBeDisabled();

  // Abrir conversa: botão desligado (não link) e o motivo do Atendimento no tooltip (D8).
  await expect(painel.getByRole('link', { name: 'Abrir conversa' })).toHaveCount(0);
  const abrir = painel.getByRole('button', { name: 'Abrir conversa' });
  await expect(abrir).toBeDisabled();
  // O invólucro do PermissionGate recebe o mouse (o botão desligado não).
  await painel.getByRole('group').filter({ has: page.getByRole('button', { name: 'Abrir conversa' }) }).hover();
  await expect(page.getByRole('tooltip')).toContainText('Atendimento: Sem acesso. Peça ao administrador na aba Usuários.');

  // Nada mudou no banco.
  expect(await vinculo(s.carla, s.mercado)).toEqual({ pode_pedir_nota: false, pode_atualizar_preco: false });
});

test('painel: WhatsApp (último contato, conversa agora, % resolvida) e demandas abertas; LGPD separado com borda tracejada', async ({ page }) => {
  const s = await semearContatos();
  const h = await semearHistorico(s);
  await criarUsuarioTeste({ email: 'admin-g3p@e2e.local', senha: SENHA, nome: 'Thiago G3', papel: 'admin' });
  await entrar(page, 'admin-g3p@e2e.local', SENHA);
  await abrirContatos(page, `?q=${PREFIXO}&contato=${s.carla}`);
  const painel = page.getByRole('dialog', { name: `${PREFIXO} Carla Mendes` });

  const whats = painel.getByRole('region', { name: 'WhatsApp' });
  await expect(whats).toContainText('3 atendimentos');
  await expect(whats).toContainText(/Último contato\s*(hoje|ontem) \d{2}:\d{2}/);
  await expect(whats).toContainText(/esperando pessoa · \d+ min/);
  await expect(whats).toContainText('33%');

  const demandas = painel.getByRole('region', { name: 'Demandas abertas' });
  await expect(demandas).toContainText(`#${h.urgente.numero} ${PREFIXO} Nota de venda`);
  await expect(demandas).toContainText('Urgente');
  await expect(demandas).toContainText(`${PREFIXO} Alteração de sócio`);
  await expect(demandas).not.toContainText('Antiga');
  await expect(demandas.getByRole('link', { name: new RegExp(`${PREFIXO} Nota de venda`) })).toHaveAttribute('href', `/demandas?demanda=${h.urgente.id}`);

  await expect(painel.getByRole('button', { name: 'Excluir…' })).toBeVisible();
  const lgpd = painel.getByRole('region', { name: 'Apagar dados (LGPD) · só admin' });
  await expect(lgpd).toHaveCSS('border-top-style', 'dashed');
  await expect(lgpd.getByRole('button', { name: 'Apagar dados (LGPD)' })).toBeVisible();
});

test('"Só ver" (o padrão de quem atende): vê o painel, mas não muda nada; sem Excluir… e sem LGPD', async ({ page }) => {
  const s = await semearContatos();
  await semearHistorico(s); // as demandas no Fiscal deixam a Ana ver a conversa (Parte D)
  await criarUsuarioTeste({ email: 'ana-g3p@e2e.local', senha: SENHA, nome: 'Ana G3', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'ana-g3p@e2e.local', SENHA);
  await abrirContatos(page, `?q=${PREFIXO}&contato=${s.carla}`);
  const painel = page.getByRole('dialog', { name: `${PREFIXO} Carla Mendes` });
  await expect(painel.getByRole('region', { name: 'WhatsApp' })).toContainText('esperando pessoa');
  await expect(painel.getByRole('region', { name: 'Demandas abertas' })).toContainText(`${PREFIXO} Nota de venda`);
  await expect(painel.getByRole('link', { name: /^Editar / })).toHaveCount(0);
  await expect(painel.getByRole('button', { name: 'Vincular empresa' })).toHaveCount(0);
  await expect(painel.getByRole('button', { name: 'Excluir…' })).toHaveCount(0);
  await expect(painel.getByRole('button', { name: 'Apagar dados (LGPD)' })).toHaveCount(0);
  await expect(painel.getByRole('switch', { name: /o agente para/ })).toBeDisabled();
  for (const caixa of await painel.getByRole('group', { name: `${PREFIXO} Rede Bom Preço Ltda` }).getByRole('checkbox').all()) {
    await expect(caixa).toBeDisabled();
  }
  await expect(painel).toContainText('Só quem pode editar clientes muda as marcações.');
});

test('Editar vira "Fechar edição"; contato arquivado com ?editar=1 não mostra o Nome e diz por que as marcações não mudam', async ({ page }) => {
  const s = await semearContatos();
  await criarUsuarioTeste({ email: 'admin-g3p@e2e.local', senha: SENHA, nome: 'Thiago G3', papel: 'admin' });
  await entrar(page, 'admin-g3p@e2e.local', SENHA);
  await abrirContatos(page, `?q=${PREFIXO}&contato=${s.carla}`);
  const painel = page.getByRole('dialog', { name: `${PREFIXO} Carla Mendes` });
  await expect(painel.getByText('Contato arquivado: restaure para mudar as marcações.')).toHaveCount(0);

  // Aberto o Editar, o mesmo lugar fecha a edição (link sem ?editar).
  await painel.getByRole('link', { name: `Editar ${PREFIXO} Carla Mendes` }).click();
  await expect(painel.getByLabel('Nome', { exact: true })).toBeVisible();
  await expect(painel.getByRole('link', { name: `Editar ${PREFIXO} Carla Mendes` })).toHaveCount(0);
  const fechar = painel.getByRole('link', { name: `Fechar edição de ${PREFIXO} Carla Mendes` });
  await expect(fechar).toHaveText('Fechar edição');
  await expect(fechar).not.toHaveAttribute('href', /editar=/);
  await fechar.click();
  await expect(painel.getByLabel('Nome', { exact: true })).toHaveCount(0);
  await expect(painel.getByRole('link', { name: `Editar ${PREFIXO} Carla Mendes` })).toBeVisible();

  // Arquivado: só leitura, mesmo com ?editar=1 no endereço; as marcações dizem o motivo.
  await db.from('contatos').update({ ativo: false, arquivado_em: new Date().toISOString() }).eq('id', s.carla);
  await abrirContatos(page, `?q=${PREFIXO}&contato=${s.carla}&editar=1`);
  const arquivado = page.getByRole('dialog', { name: `${PREFIXO} Carla Mendes` });
  await expect(arquivado.getByText(`${PREFIXO} Mercado Central`)).toBeVisible({ timeout: 30_000 });
  await expect(arquivado.getByLabel('Nome', { exact: true })).toHaveCount(0);
  await expect(arquivado.getByRole('link', { name: /Editar |Fechar edição/ })).toHaveCount(0);
  await arquivado.getByRole('button', { name: `Acesso em ${PREFIXO} Mercado Central` }).click();
  await expect(arquivado.getByRole('group', { name: `${PREFIXO} Mercado Central` }).getByRole('switch', { name: 'Pedir nota de venda' })).toBeDisabled();
  await expect(arquivado.getByText('Contato arquivado: restaure para mudar as marcações.')).toBeVisible();
  await expect(arquivado.getByText('Só quem pode editar clientes muda as marcações.')).toHaveCount(0);
});
