import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirContatos, limparG3, linhaContato, PREFIXO, semearContatos } from './apoio-contatos';

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

  // Marcações por empresa: cada caixa grava ao clicar (D9).
  await painel.getByRole('group', { name: `${PREFIXO} Mercado Central` }).getByRole('checkbox', { name: 'Pode pedir nota' }).click();
  await expect.poll(async () => (await vinculo(s.carla, s.mercado))?.pode_pedir_nota).toBe(true);
  await painel.getByRole('group', { name: `${PREFIXO} Rede Bom Preço Ltda` }).getByRole('checkbox', { name: 'Pode pedir nota' }).click();
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
  await expect(painel.getByRole('group', { name: `${PREFIXO} Padaria Sol` }).getByRole('checkbox', { name: 'Pode mudar preço e cadastrar produto' })).toBeChecked();
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
    const grupo = painel.getByRole('group', { name: `${PREFIXO} ${empresa}` });
    await expect(grupo.getByRole('checkbox', { name: 'Pode pedir nota' })).toBeDisabled();
    await expect(grupo.getByRole('checkbox', { name: 'Pode mudar preço e cadastrar produto' })).toBeDisabled();
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
