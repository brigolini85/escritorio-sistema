import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { demandaE2e, empresaE2e, limparDemandasE2e } from './apoio-demandas';

const SENHA = 'senha-forte-123';
const P = 'E2E-C9';

test.beforeEach(() => limparDemandasE2e(P));
test.afterAll(() => limparDemandasE2e(P));

// O nome da janela é "Nº <número> · <setor>" (o título editável fica fora dele, para o nome não mudar ao editar).
let numero = 0;
const painel = (page: Page) => page.getByRole('dialog', { name: new RegExp(`Nº ${numero}`) });
const linhaDoTempo = (page: Page) => painel(page).getByRole('list', { name: /Linha do tempo/ });

test('painel lateral: assumir, responsável, status, prioridade, prazo, nota, edição, transferir, concluir e reabrir', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-c9@e2e.local', senha: SENHA, nome: 'Ana C9', papel: 'atendente', setores: ['Fiscal'] });
  await criarUsuarioTeste({ email: 'bia-c9@e2e.local', senha: SENHA, nome: 'Bia C9', papel: 'atendente', setores: ['Fiscal'] });
  const cliente = await empresaE2e('Rede Bom Preço C9', '90000000000360');
  const { data: carla } = await db.from('contatos').upsert({ nome: 'Carla C9', telefone: '5531999990901' }, { onConflict: 'telefone' }).select('id').single();
  await db.from('contato_clientes').upsert({ contato_id: carla!.id, cliente_id: cliente });
  const d = await demandaE2e({ titulo: `${P} Nota de venda`, setor: 'Fiscal', clienteId: cliente, resumo: 'Pediu a nota' });
  numero = d.numero;
  await entrar(page, 'ana-c9@e2e.local', SENHA);
  await page.goto(`/demandas?demanda=${d.id}`);

  await expect(painel(page)).toContainText(`${P} Nota de venda`, { timeout: 30_000 });
  await expect(painel(page)).toContainText('aberta pelo agente');
  await painel(page).getByRole('button', { name: 'Assumir' }).click();
  await expect(page.getByText('Demanda assumida.')).toBeVisible();
  await expect(painel(page).getByLabel('Responsável')).toHaveValue(ana);
  await expect(painel(page).getByLabel('Status')).toHaveValue('em_andamento');

  await painel(page).getByLabel('Responsável').selectOption({ label: 'Bia C9' });
  await expect(page.getByText('Responsável alterado.')).toBeVisible();
  await painel(page).getByLabel('Status').selectOption('aguardando_cliente');
  await expect(page.getByText('Status: Com o cliente.')).toBeVisible();
  await expect(painel(page)).toContainText('pausado');
  await painel(page).getByLabel('Prioridade').selectOption('urgente');
  await expect(page.getByText('Prioridade Urgente. Prazo recalculado.')).toBeVisible();
  await painel(page).getByLabel('Prazo').fill('2030-01-15T12:00');
  await painel(page).getByLabel('Prazo').blur();
  await expect(page.getByText('Prazo alterado.')).toBeVisible();

  await painel(page).getByRole('button', { name: 'Nota' }).click();
  await page.getByRole('dialog', { name: /Nota interna/ }).getByLabel('Nota interna').fill('Cliente ligou às 15h');
  await page.getByRole('dialog', { name: /Nota interna/ }).getByRole('button', { name: 'Salvar nota' }).click();
  await expect(page.getByText('Nota interna registrada.')).toBeVisible();

  await painel(page).getByRole('button', { name: 'Editar título' }).click();
  await painel(page).getByLabel('Título').fill(`${P} Nota de venda corrigida`);
  await painel(page).getByRole('button', { name: 'Salvar título' }).click();
  await expect(page.getByText('Demanda alterada.')).toBeVisible();
  await painel(page).getByLabel('Contato na empresa').selectOption({ label: 'Carla C9' });
  await painel(page).getByLabel('Descrição').fill('Pediu a nota de 10 PAC');
  await painel(page).getByRole('button', { name: 'Salvar descrição' }).click();
  await expect(page.getByText('Demanda alterada.').last()).toBeVisible();

  // Editar só o título depois de escolher o contato: o contato continua (o banco trata nulo como remover).
  await painel(page).getByRole('button', { name: 'Editar título' }).click();
  await painel(page).getByLabel('Título').fill(`${P} Nota de venda final`);
  await painel(page).getByRole('button', { name: 'Salvar título' }).click();
  await expect(painel(page).getByLabel('Contato na empresa')).toHaveValue(String(carla!.id));
  await expect.poll(async () => (await db.from('chamados').select('contato_id').eq('id', d.id).single()).data?.contato_id).toBe(carla!.id);

  await painel(page).getByRole('button', { name: 'Transferir' }).click();
  const transferir = page.getByRole('dialog', { name: /Transferir a demanda/ });
  await transferir.getByLabel('Setor').selectOption({ label: 'Fiscal' });
  await transferir.getByLabel('Responsável').selectOption({ label: 'Ana C9' });
  await transferir.getByRole('button', { name: 'Transferir' }).click();
  await expect(page.getByText('Demanda transferida.')).toBeVisible();

  await painel(page).getByRole('button', { name: 'Concluir' }).click();
  await page.getByRole('dialog', { name: /Concluir a demanda/ }).getByRole('button', { name: 'Concluir' }).click();
  await expect(page.getByText('Demanda concluída.')).toBeVisible();
  await painel(page).getByRole('button', { name: 'Reabrir' }).click();
  await expect(page.getByText('Demanda reaberta.')).toBeVisible();
  await expect(painel(page).getByLabel('Status')).toHaveValue('aberto');

  for (const t of ['Agente abriu', 'Ana C9 assumiu', 'responsável Bia C9', 'status Com o cliente', 'prioridade Urgente', 'prazo 15/01 12h',
    'nota interna', 'editou título', 'editou descrição, contato', 'transferiu para Fiscal', 'concluiu', 'reabriu']) {
    await expect(linhaDoTempo(page)).toContainText(t);
  }
});

test('Assumir na linha da tabela, e a segunda pessoa recebe o aviso', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana-c9@e2e.local', senha: SENHA, nome: 'Ana C9', papel: 'atendente', setores: ['Fiscal'] });
  const bia = await criarUsuarioTeste({ email: 'bia-c9@e2e.local', senha: SENHA, nome: 'Bia C9', papel: 'atendente', setores: ['Fiscal'] });
  const d = await demandaE2e({ titulo: `${P} Guia DAS`, setor: 'Fiscal' });
  await entrar(page, 'ana-c9@e2e.local', SENHA);
  await page.goto(`/demandas?q=${P}`);
  // Outra pessoa assume antes (aba aberta há tempo): o clique recebe o aviso e nada muda.
  await db.from('chamados').update({ responsavel_id: bia }).eq('id', d.id);
  await page.getByRole('row', { name: new RegExp(`${P} Guia DAS`) }).getByRole('button', { name: 'Assumir' }).click();
  await expect(page.getByText('A demanda já está com Bia C9.')).toBeVisible();
  await db.from('chamados').update({ responsavel_id: null }).eq('id', d.id);
  await page.reload();
  await page.getByRole('row', { name: new RegExp(`${P} Guia DAS`) }).getByRole('button', { name: 'Assumir' }).click();
  await expect(page.getByText('Demanda assumida.')).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(`${P} Guia DAS`) })).toContainText('Ana C9');
});

test('administrador que assumiu demanda do Fiscal aparece como responsável (mesmo fora do setor)', async ({ page }) => {
  await criarUsuarioTeste({ email: 'adm-c9@e2e.local', senha: SENHA, nome: 'Adm C9', papel: 'admin' });
  const d = await demandaE2e({ titulo: `${P} Guia FGTS`, setor: 'Fiscal' });
  numero = d.numero;
  await entrar(page, 'adm-c9@e2e.local', SENHA);
  await page.goto(`/demandas?demanda=${d.id}`);
  await expect(painel(page)).toContainText(`${P} Guia FGTS`, { timeout: 30_000 });
  await painel(page).getByRole('button', { name: 'Assumir' }).click();
  await expect(page.getByText('Demanda assumida.')).toBeVisible();
  await expect(painel(page).getByLabel('Responsável').locator('option:checked')).toHaveText('Adm C9');
  await expect(painel(page).getByRole('button', { name: 'Assumir' })).toHaveCount(0);
});
