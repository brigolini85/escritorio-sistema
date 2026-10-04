import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirFicha, bloco, CNPJ_SOL, diaDaqui, empresa, indice, SENHA } from './apoio-ficha';

// Parte H1 (spec 7D.1 e 7D.3): blocos do cadastro com busca de CNPJ/CEP simulada (servidor falso, D32) e pendências no índice.
const ADMIN = 'admin-ficha@e2e.local';
const CNPJ_TESTE = '12121212000106';
// Fora do servidor falso e de outros e2e: a ficha salva à mão depois da busca que falhou.
const CNPJ_A_MAO = '31313131000152';

// Campos com * têm o asterisco no rótulo: o nome acessível é exato, o texto do rótulo não (getByLabel exato falharia).
const campoCep = (page: Page) => page.getByRole('textbox', { name: 'CEP', exact: true });
const campoUf = (page: Page) => page.getByRole('combobox', { name: 'UF', exact: true });

// A Padaria Sol e as empresas de teste saem no fim: outros e2e procuram "Padaria Sol" e esperam não achar.
test.afterAll(async () => {
  await db.from('clientes').delete().in('cnpj', [CNPJ_SOL, CNPJ_TESTE, CNPJ_A_MAO]);
  await db.from('servicos').delete().eq('nome', 'Serviço Ficha E2E');
});

async function comoAdmin(page: Page): Promise<string> {
  const id = await criarUsuarioTeste({ email: ADMIN, senha: SENHA, nome: 'Admin Ficha', papel: 'admin' });
  await entrar(page, ADMIN, SENHA);
  return id;
}

test('Novo cliente: o CNPJ busca razão social, CNAE e endereço; o resto vira pendência e a ficha salva assim mesmo', async ({ page }) => {
  await db.from('clientes').delete().eq('cnpj', CNPJ_SOL);
  await comoAdmin(page);
  await abrirFicha(page, '/clientes/novo');
  await expect(bloco(page, 'Acessos de portais').getByText('Salve a ficha para cadastrar acessos.')).toBeVisible();
  await page.getByLabel('CNPJ').fill('12.345.678/0001-95');
  await page.getByRole('button', { name: 'Buscar dados públicos da empresa' }).click();
  await expect(page.getByText('Preenchido pela busca: razão social, nome fantasia, CNAE e endereço.')).toBeVisible();
  await expect(page.getByLabel('Razão social')).toHaveValue('PADARIA SOL COMERCIO DE ALIMENTOS ME');
  await expect(page.getByLabel('CNAE principal')).toHaveValue('1091-1/01 · Fabricação de produtos de panificação');
  await expect(campoCep(page)).toHaveValue('36404-450');
  await expect(page.getByLabel('Logradouro')).toHaveValue('Rua Rosa Figueiredo');
  await expect(page.getByLabel('Cidade')).toHaveValue('Conselheiro Lafaiete');
  await expect(campoUf(page)).toHaveValue('MG');
  // Faltam regime e segmento; o endereço veio inteiro da busca.
  await expect(indice(page).getByRole('link', { name: /Identificação.*2 pendentes/ })).toBeVisible();
  await expect(indice(page).getByRole('link', { name: /Endereço.*completo/ })).toBeVisible();
  await page.getByLabel('Regime tributário').selectOption('Simples Nacional');
  await page.getByLabel('Comércio').check();
  await expect(indice(page).getByRole('link', { name: /Identificação.*completo/ })).toBeVisible();
  await expect(indice(page).getByRole('link', { name: /Contrato e honorários.*2 pendentes/ })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'PADARIA SOL', level: 1 })).toBeVisible();
  await expect.poll(async () => (await db.from('clientes')
    .select('regime, segmentos, cnae_principal, logradouro, numero, bairro, cidade, uf, cep, endereco, contrato_inicio').eq('cnpj', CNPJ_SOL).single()).data)
    .toEqual({
      regime: 'Simples Nacional', segmentos: ['comercio'], cnae_principal: '1091-1/01 · Fabricação de produtos de panificação',
      logradouro: 'Rua Rosa Figueiredo', numero: '430', bairro: 'São Marcos', cidade: 'Conselheiro Lafaiete', uf: 'MG', cep: '36404450',
      endereco: 'Rua Rosa Figueiredo, 430 - São Marcos, Conselheiro Lafaiete/MG, CEP 36404-450', contrato_inicio: null,
    });
  // Depois de salvar, a ficha da empresa nova já recebe acessos (D25).
  const acessos = bloco(page, 'Acessos de portais');
  await expect(acessos.getByText('Nenhum acesso cadastrado.')).toBeVisible();
  await expect(acessos.getByRole('button', { name: 'Adicionar acesso' })).toBeVisible();
});

test('busca que falha não trava: CEP desconhecido, CEP lento e CNPJ fora da busca viram aviso', async ({ page }) => {
  test.setTimeout(60_000);
  await db.from('clientes').delete().eq('cnpj', CNPJ_A_MAO);
  await comoAdmin(page);
  await abrirFicha(page, '/clientes/novo');
  const endereco = bloco(page, 'Endereço');
  await campoCep(page).fill('99999-999');
  await endereco.getByRole('button', { name: 'Buscar o endereço' }).click();
  await expect(endereco.getByText('Não achei este CEP. Preencha à mão.')).toBeVisible();
  await campoCep(page).fill('11111-111');
  await endereco.getByRole('button', { name: 'Buscar o endereço' }).click();
  await expect(endereco.getByText('Não consegui buscar agora. Preencha à mão.')).toBeVisible({ timeout: 10_000 });
  await page.getByLabel('Logradouro').fill('Rua Escrita à Mão');
  await expect(page.getByLabel('Logradouro')).toHaveValue('Rua Escrita à Mão');
  const identificacao = bloco(page, 'Identificação');
  await page.getByLabel('CNPJ').fill('11.222.333/0001-81');
  await identificacao.getByRole('button', { name: 'Buscar dados públicos da empresa' }).click();
  await expect(identificacao.getByText('Não achei este CNPJ na busca pública. Preencha à mão.')).toBeVisible();
  await page.getByLabel('CNPJ').fill('55.566.677/0001-83');
  await identificacao.getByRole('button', { name: 'Buscar dados públicos da empresa' }).click();
  await expect(identificacao.getByText('Não consegui buscar agora. Preencha à mão.')).toBeVisible();
  // A busca que falhou não impede salvar o que foi escrito à mão.
  await page.getByLabel('CNPJ').fill('31.313.131/0001-52');
  await page.getByLabel('Razão social').fill('Escrita à Mão Ltda');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}$/);
  await expect.poll(async () => (await db.from('clientes').select('razao_social, logradouro, cep').eq('cnpj', CNPJ_A_MAO).maybeSingle()).data)
    .toEqual({ razao_social: 'Escrita à Mão Ltda', logradouro: 'Rua Escrita à Mão', cep: '11111111' });
});

test('cliente existente: contrato, honorários, inscrições ST, serviços e responsáveis num Salvar só', async ({ page }) => {
  const id = await empresa(CNPJ_TESTE);
  await db.from('servicos').delete().eq('nome', 'Serviço Ficha E2E');
  const { data: fiscal } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const { data: servico } = await db.from('servicos').insert({ nome: 'Serviço Ficha E2E', setor_id: fiscal!.id }).select('id').single();
  const bia = await criarUsuarioTeste({ email: 'bia-ficha@e2e.local', senha: SENHA, nome: 'Bia Ficha', papel: 'atendente', setores: ['Fiscal'] });
  await comoAdmin(page);
  await abrirFicha(page, `/clientes/${id}`);
  await page.getByLabel('Início do contrato').fill('2022-03-01');
  await page.getByLabel('Honorário mensal').fill('1.250,00');
  await page.getByLabel('Dia de vencimento').fill('10');
  await page.getByLabel('Reajuste').selectOption({ label: 'Anual · março' });
  await page.getByLabel('13º honorário').selectOption({ label: 'Sim, em dezembro' });
  const fiscalBloco = bloco(page, 'Fiscal · Inscrições de substituto tributário');
  await fiscalBloco.getByRole('button', { name: 'Adicionar inscrição' }).click();
  await fiscalBloco.getByRole('button', { name: 'Adicionar inscrição' }).click();
  await page.getByLabel('UF da linha 1').selectOption('SP');
  await page.getByLabel('Inscrição da linha 1').fill('123.456.789.110');
  await page.getByLabel('UF da linha 2').selectOption('RJ');
  await expect(fiscalBloco.getByText('1 linha sem inscrição')).toBeVisible();
  await expect(indice(page).getByRole('link', { name: /Fiscal.*1 pendente/ })).toBeVisible();
  await page.getByLabel('Serviço Ficha E2E').check();
  await page.getByLabel('Responsável pelo setor Fiscal').selectOption({ label: 'Bia Ficha' });
  await expect(page.getByText('Alterações não salvas')).toBeVisible();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Ficha salva.')).toBeVisible();
  await expect.poll(async () => (await db.from('clientes')
    .select('honorario_mensal, contrato_inicio, dia_vencimento, reajuste, reajuste_mes, decimo_terceiro').eq('id', id).single()).data)
    .toEqual({ honorario_mensal: 1250, contrato_inicio: '2022-03-01', dia_vencimento: 10, reajuste: 'anual', reajuste_mes: 3, decimo_terceiro: true });
  expect((await db.from('cliente_inscricoes_st').select('uf, inscricao').eq('cliente_id', id).order('uf')).data)
    .toEqual([{ uf: 'RJ', inscricao: null }, { uf: 'SP', inscricao: '123.456.789.110' }]);
  expect((await db.from('cliente_servicos').select('servico_id').eq('cliente_id', id)).data).toEqual([{ servico_id: servico!.id }]);
  expect((await db.from('cliente_responsaveis').select('setor_id, usuario_id').eq('cliente_id', id)).data).toEqual([{ setor_id: fiscal!.id, usuario_id: bia }]);

  // A ficha volta com os dados novos e quem mudou por último (D24).
  await abrirFicha(page, `/clientes/${id}`);
  await expect(page.getByText(/Última alteração: Admin Ficha, \d{2}\/\d{2} \d{2}:\d{2}/)).toBeVisible();
  // Tirar a linha sem inscrição (RJ, a primeira pela UF) também é um Salvar.
  await bloco(page, 'Fiscal · Inscrições de substituto tributário').getByRole('button', { name: 'Remover a linha 1' }).click();
  await expect(page.getByText('Alterações não salvas')).toBeVisible();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect.poll(async () => (await db.from('cliente_inscricoes_st').select('uf').eq('cliente_id', id)).data).toEqual([{ uf: 'SP' }]);
});

test('certificado perto de vencer: etiqueta no topo e "vence" no índice; "Sem certificado" completa na hora', async ({ page }) => {
  const id = await empresa(CNPJ_TESTE, { certificado_tipo: 'e_cnpj_a1', certificado_vencimento: diaDaqui(23), certificado_avisar_dias: 30, regime: 'Simples Nacional' });
  await comoAdmin(page);
  await abrirFicha(page, `/clientes/${id}`);
  const situacao = page.getByRole('list', { name: 'Situação da empresa' });
  await expect(situacao.getByText('Ativo', { exact: true })).toBeVisible();
  await expect(situacao.getByText('Certificado vence em 23 dias')).toBeVisible();
  await expect(situacao.getByText('Simples Nacional')).toBeVisible();
  await expect(indice(page).getByRole('link', { name: /Certificado digital.*vence/ })).toBeVisible();
  await expect(bloco(page, 'Certificado digital').getByText('vence em 23 dias')).toBeVisible();
  await page.getByLabel('Tipo', { exact: true }).selectOption({ label: 'Sem certificado' });
  await expect(indice(page).getByRole('link', { name: /Certificado digital.*completo/ })).toBeVisible();
});

test('endereço antigo: aparece em Logradouro, vira pendência e salvar outra coisa não mexe nele', async ({ page }) => {
  const antigo = 'Rua Antiga, 10 - Centro, Belo Horizonte';
  const id = await empresa(CNPJ_TESTE, { endereco: antigo, logradouro: antigo });
  await comoAdmin(page);
  await abrirFicha(page, `/clientes/${id}`);
  await expect(page.getByLabel('Logradouro')).toHaveValue(antigo);
  await expect(indice(page).getByRole('link', { name: /Endereço.*5 pendentes/ })).toBeVisible();
  await page.getByLabel('Telefone').fill('(31) 3333-4444');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Ficha salva.')).toBeVisible();
  await expect.poll(async () => (await db.from('clientes').select('telefone, endereco, logradouro').eq('id', id).single()).data)
    .toEqual({ telefone: '3133334444', endereco: antigo, logradouro: antigo });
});

test('"Só ver": a ficha aparece com os campos desligados, sem busca e sem Salvar', async ({ page }) => {
  const id = await empresa(CNPJ_TESTE, { regime: 'MEI' });
  await criarUsuarioTeste({ email: 'ana-ficha@e2e.local', senha: SENHA, nome: 'Ana Ficha', papel: 'atendente' });
  await entrar(page, 'ana-ficha@e2e.local', SENHA);
  await abrirFicha(page, `/clientes/${id}`);
  await expect(page.getByLabel('Razão social')).toBeDisabled();
  await expect(page.getByLabel('Regime tributário')).toHaveValue('MEI');
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toHaveCount(0);
  await expect(page.getByText('Só quem pode editar clientes altera estes dados.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Buscar dados públicos da empresa' })).toHaveCount(0);
  // Sem segmento: 1 pendência, calculada pelo que está salvo.
  await expect(indice(page).getByRole('link', { name: /Identificação.*1 pendente/ })).toBeVisible();
});

test('administrador pausa o agente pela ficha (mesmo rótulo de hoje)', async ({ page }) => {
  const id = await empresa(CNPJ_TESTE);
  await comoAdmin(page);
  await abrirFicha(page, `/clientes/${id}`);
  await page.getByLabel('Pausar o agente para este cliente').check();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect.poll(async () => (await db.from('clientes').select('agente_pausado').eq('id', id).single()).data?.agente_pausado).toBe(true);
  await expect(page.getByRole('list', { name: 'Situação da empresa' }).getByText('Agente pausado para esta empresa')).toBeVisible();
});
