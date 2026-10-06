import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import { definirPastaDriveTeste, limparBanco, situacaoDriveTeste, sqlTeste } from '@escritorio/db/teste';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { SENHA, criarDono } from './apoio-agentes';
import { abrirSecao } from './apoio-configuracoes';
import { PASTA_E2E, arquivoDoDrive } from './apoio-drive';
import { empresaE2e } from './apoio-demandas';
import { abrirFicha, bloco } from './apoio-ficha';
import { RESULTADO, cenarioTarefa } from './apoio-tarefas';

// Parte I3b (spec 7E.4 e 7E.6; D7–D10, D14, D15b): a pasta do cliente no Drive, a planilha, as linhas provisórias e a guarda dos arquivos.
test.beforeEach(async () => { await limparBanco(); });
test.afterAll(async () => { await limparBanco(); });

const CONTA = 'drive@escritorio.iam.gserviceaccount.com';
const LINK = `https://drive.google.com/drive/u/0/folders/${PASTA_E2E}?usp=sharing`;
const nivelClientes = (id: string, nivel: string) => db.from('usuario_permissoes').upsert({ usuario_id: id, modulo: 'clientes', nivel });
const naoSalvo = (page: import('@playwright/test').Page) => page.getByRole('status').filter({ hasText: /não salv/i });

test('ficha: Pasta no Drive salva sozinha, não conta como "não salvo", recusa pasta repetida e respeita o nível', async ({ page }) => {
  const sol = await empresaE2e('I3 Padaria Sol', '21448390000190');
  const outra = await empresaE2e('I3 Mercearia Lua', '11222333000181');
  const claudia = await criarUsuarioTeste({ email: 'claudia@i3.local', senha: SENHA, nome: 'Cláudia Contábil', papel: 'atendente', setores: ['Contábil'] });
  await nivelClientes(claudia, 'editar');
  await entrar(page, 'claudia@i3.local', SENHA);
  await abrirFicha(page, `/clientes/${sol}`);
  const arquivos = bloco(page, 'Arquivos');
  await expect(arquivos.getByText('Drive não configurado: o agente lê só os arquivos enviados.')).toBeVisible();

  await arquivos.getByLabel('Pasta no Drive').fill(LINK);
  // O campo salva sozinho: digitar nele não acende o "não salvo" do rodapé da ficha.
  await expect(naoSalvo(page)).toHaveCount(0);
  await arquivos.getByRole('button', { name: 'Salvar pasta' }).click();
  await expect(page.getByText('Pasta no Drive salva.')).toBeVisible();
  await expect.poll(async () => (await db.from('clientes').select('drive_pasta_id').eq('id', sol).single()).data!.drive_pasta_id).toBe(PASTA_E2E);
  await expect(naoSalvo(page)).toHaveCount(0);

  // A mesma pasta em outro cliente é recusada.
  await abrirFicha(page, `/clientes/${outra}`);
  await bloco(page, 'Arquivos').getByLabel('Pasta no Drive').fill(LINK);
  await bloco(page, 'Arquivos').getByRole('button', { name: 'Salvar pasta' }).click();
  await expect(page.getByText('Esta pasta do Drive já é de outro cliente.')).toBeVisible();
  expect((await db.from('clientes').select('drive_pasta_id').eq('id', outra).single()).data!.drive_pasta_id).toBeNull();

  // Com a conta ligada, a ficha diz com quem compartilhar.
  await situacaoDriveTeste(CONTA);
  await page.reload();
  await expect(bloco(page, 'Arquivos').getByText(`Compartilhe a pasta de cada cliente com ${CONTA}, como Leitor.`)).toBeVisible();

  // Só "ver" clientes: campo desligado e sem Salvar pasta.
  await nivelClientes(claudia, 'ver');
  await abrirFicha(page, `/clientes/${sol}`);
  await expect(bloco(page, 'Arquivos').getByLabel('Pasta no Drive')).toBeDisabled();
  await expect(bloco(page, 'Arquivos').getByRole('button', { name: 'Salvar pasta' })).toHaveCount(0);
});

test('tarefa: arquivo do Drive é só leitura, LER A PASTA DE NOVO pede uma vez e sem pasta orienta', async ({ page }) => {
  const c = await cenarioTarefa({ estado: 'trabalhando' });
  await definirPastaDriveTeste(c.empresa, PASTA_E2E);
  await situacaoDriveTeste(CONTA);
  await arquivoDoDrive(c.tarefa.id, 'balancete.pdf');
  await entrar(page, 'claudia@i3.local', SENHA);
  await page.goto(`/tarefas/${c.tarefa.id}`);
  const arquivos = page.getByRole('list', { name: 'Arquivos da tarefa' });
  await expect(arquivos.getByRole('link', { name: 'balancete.pdf' })).toBeVisible();
  await expect(arquivos.getByText('Drive · só leitura')).toBeVisible();

  await page.getByRole('button', { name: 'Ler a pasta de novo' }).click();
  await expect(page.getByText(/Pedi para ler a pasta do Drive/)).toBeVisible();
  const eventos = await sqlTeste<{ texto: string }>(
    "select texto from public.agente_tarefa_eventos where tarefa_id = $1 and texto = 'pediu para ler a pasta do Drive de novo'", [c.tarefa.id]);
  expect(eventos).toHaveLength(1);
  await page.getByRole('button', { name: 'Ler a pasta de novo' }).click();
  await expect(page.getByText('A pasta já está sendo lida. Espere um pouco.')).toBeVisible();
  const a11y = await new AxeBuilder({ page }).analyze();
  expect(a11y.violations).toEqual([]);

  // Sem pasta: o botão some e a tela manda para a ficha do cliente.
  await definirPastaDriveTeste(c.empresa, null);
  await page.reload();
  await expect(page.getByText('Sem pasta no Drive: preencha na ficha do cliente, em Arquivos.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ler a pasta de novo' })).toHaveCount(0);
});

test('planilha: baixa o XLSX com a aba Resultado, audita o download e o CSV continua', async ({ page }) => {
  const c = await cenarioTarefa({ estado: 'pronta', resultado: RESULTADO });
  await entrar(page, 'claudia@i3.local', SENHA);
  await page.goto(`/tarefas/${c.tarefa.id}`);
  await expect(page.getByRole('link', { name: 'Baixar CSV' })).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Baixar planilha' }).click()]);
  expect(download.suggestedFilename()).toBe(`tarefa-${c.tarefa.numero}-rascunho.xlsx`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(await download.path());
  const aba = wb.getWorksheet('Resultado')!;
  expect(aba).toBeTruthy();
  expect(aba.getRow(1).getCell(1).value).toBe('Descrição');
  expect(aba.getRow(2).getCell(1).value).toBe('Tarifa bancária');
  await expect.poll(async () => (await db.from('auditoria_acessos').select('id').eq('entidade', 'planilha_tarefa').eq('entidade_id', c.tarefa.id)).data!.length).toBeGreaterThan(0);
  const csv = await page.request.get(`/api/tarefas/csv?id=${c.tarefa.id}`);
  expect(csv.status()).toBe(200);
});

test('provisórias: a Aprovação avisa quando o rascunho ainda tem linha provisória', async ({ page }) => {
  const c = await cenarioTarefa({ estado: 'pronta', resultado: RESULTADO });
  await entrar(page, 'claudia@i3.local', SENHA);
  await page.goto(`/tarefas/${c.tarefa.id}`);
  await expect(page.getByRole('region', { name: 'Aprovação' }).getByText('1 linha provisória: confira antes de aprovar ou peça ajuste.')).toBeVisible();
});

test('guarda: o dono escolhe o prazo; o administrador que não é dono vê o seletor travado', async ({ page }) => {
  await criarDono();
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirSecao(page, 'integracoes');
  const cartao = page.getByRole('region', { name: 'Guarda dos arquivos das tarefas' });
  const seletor = cartao.getByLabel('Apagar os arquivos depois de');
  await expect(seletor).toHaveValue('nunca');
  await seletor.selectOption({ label: '365 dias (sugerido)' });
  await cartao.getByRole('button', { name: 'SALVAR' }).click();
  await expect(page.getByText('Guarda dos arquivos salva.')).toBeVisible();
  await expect.poll(async () => (await sqlTeste<{ dias: number | null }>('select dias from public.tarefas_guarda'))[0]!.dias).toBe(365);

  await page.context().clearCookies();
  await criarUsuarioTeste({ email: 'admin@i3.local', senha: SENHA, nome: 'Admin Comum', papel: 'admin' });
  await entrar(page, 'admin@i3.local', SENHA);
  await abrirSecao(page, 'integracoes');
  const outro = page.getByRole('region', { name: 'Guarda dos arquivos das tarefas' });
  await expect(outro.getByLabel('Apagar os arquivos depois de')).toBeDisabled();
  await expect(outro.getByText('só o dono')).toBeVisible();
});
