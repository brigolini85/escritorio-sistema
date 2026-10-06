import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { criarTarefaTeste, limparBanco, nivelTeste, sqlTeste } from '@escritorio/db/teste';
import { entrar } from './apoio';
import { abrirFicha, indice } from './apoio-ficha';
import { EMAIL_CLAUDIA, EMAIL_DONO, SENHA, cenarioPedir } from './apoio-pedir';
import { RESULTADO } from './apoio-tarefas';

// Parte I4: PEDIR AO AGENTE na demanda e no Assistente, tarefa pelo WhatsApp, avisos no Início e Arquivos na ficha.
test.beforeEach(async () => { await limparBanco(); });
test.afterAll(async () => { await limparBanco(); });

const amanha12 = () => { const d = new Date(Date.now() + 86_400_000); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T12:00`; };
const csv = (nome: string) => ({ name: nome, mimeType: 'text/csv', buffer: Buffer.from('data;valor\n05/10;-45,00\n') });

async function abrirJanela(page: Page, demandaId: string) {
  await page.goto(`/demandas?demanda=${demandaId}`);
  await page.getByRole('button', { name: 'Pedir ao agente' }).click({ timeout: 60_000 });
  const janela = page.getByRole('dialog', { name: /Pedir ao agente/ });
  await expect(janela).toBeVisible();
  return janela;
}
async function axeGraves(page: Page): Promise<string[]> {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('nextjs-portal').analyze();
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.help}`);
}

test('Cláudia na demanda do Contábil: só o Agente Contábil, destino, empresa, WhatsApp desligado, custo, prazo e anexo (D5, D6, D8)', async ({ page }) => {
  const c = await cenarioPedir();
  await entrar(page, EMAIL_CLAUDIA, SENHA);
  const janela = await abrirJanela(page, c.contabil.id);
  const grupo = janela.getByRole('radiogroup');
  await expect(grupo.getByRole('radio', { name: /Agente Contábil/ })).toBeVisible();
  await expect(grupo.getByRole('radio', { name: /Agente Fiscal/ })).toHaveCount(0);
  await expect(janela.getByText(`Nesta demanda #${c.contabil.numero}`)).toBeVisible();
  await expect(janela.getByText('I4 Padaria Sol')).toBeVisible();
  await expect(janela.getByText('da demanda')).toBeVisible();
  await expect(janela.getByLabel('Meu WhatsApp')).toBeDisabled();
  await expect(janela.getByText('Cadastre seu WhatsApp em Usuários para receber avisos.')).toBeVisible();
  await expect(janela.getByText(/até US\$ 2,00 por tarefa/)).toBeVisible();
  expect(await axeGraves(page)).toEqual([]);

  await janela.getByLabel('O que você quer?').fill('Fazer o fechamento de outubro');
  await janela.getByLabel('Prazo desejado').fill(amanha12());
  await janela.getByLabel('Anexar').setInputFiles(csv('extrato.csv'));
  await expect(janela.getByText('extrato.csv')).toBeVisible();
  await janela.getByRole('button', { name: 'Enviar para o agente' }).click();
  await page.waitForURL('**/tarefas/**', { timeout: 60_000 });

  const [t] = await sqlTeste<{ id: string; canal: string; prazo_desejado: string | null; avisar_whatsapp: boolean }>('select id, canal, prazo_desejado, avisar_whatsapp from public.agente_tarefas');
  expect(t!.canal).toBe('painel');
  expect(t!.prazo_desejado).not.toBeNull();
  expect(t!.avisar_whatsapp).toBe(false);
  const arqs = await sqlTeste<{ nome: string }>('select nome from public.agente_tarefa_arquivos where tarefa_id = $1', [t!.id]);
  expect(arqs.map((a) => a.nome)).toEqual(['extrato.csv']);
  await expect(page.getByText(/Prazo desejado:/)).toBeVisible();
  await expect(page.getByText('Avisos: painel')).toBeVisible();
  expect(await axeGraves(page)).toEqual([]);
});

test('arquivo recusado antes de criar a tarefa: contrato.docx desliga o envio', async ({ page }) => {
  const c = await cenarioPedir();
  await entrar(page, EMAIL_CLAUDIA, SENHA);
  const janela = await abrirJanela(page, c.contabil.id);
  await janela.getByLabel('O que você quer?').fill('Fazer o fechamento de outubro');
  await janela.getByLabel('Anexar').setInputFiles({ name: 'contrato.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('x') });
  await expect(janela.getByText('contrato.docx: o agente lê PDF, XML, CSV, TXT, OFX, JPG e PNG.')).toBeVisible();
  await expect(janela.getByRole('button', { name: 'Enviar para o agente' })).toBeDisabled();
  expect(await sqlTeste('select id from public.agente_tarefas')).toEqual([]);
});

test('dono a partir da demanda do Contábil escolhe o Fiscal: demanda nova no Fiscal e nota na demanda de origem (D15)', async ({ page }) => {
  const c = await cenarioPedir();
  await entrar(page, EMAIL_DONO, SENHA);
  const janela = await abrirJanela(page, c.contabil.id);
  const grupo = janela.getByRole('radiogroup');
  await expect(grupo.getByRole('radio', { name: /Agente Contábil/ })).toBeVisible();
  await expect(grupo.getByRole('radio', { name: /Agente Fiscal/ })).toBeVisible();
  await expect(janela.getByText('todos os setores')).toBeVisible();
  await grupo.getByRole('radio', { name: /Agente Fiscal/ }).click();
  await expect(janela.getByText('Demanda nova no Fiscal')).toBeVisible();
  await janela.getByLabel('O que você quer?').fill('Conferir as notas de setembro');
  await janela.getByRole('button', { name: 'Enviar para o agente' }).click();
  await page.waitForURL('**/tarefas/**', { timeout: 60_000 });
  const novas = await sqlTeste<{ numero: string }>(`select ch.numero from public.chamados ch join public.setores s on s.id = ch.setor_id
    where s.nome = 'Fiscal' and ch.cliente_id = $1 and ch.id <> $2`, [c.empresa, c.fiscal.id]);
  expect(novas).toHaveLength(1);
  const notas = await sqlTeste<{ texto: string }>("select texto from public.chamado_eventos where chamado_id = $1 and tipo = 'nota_interna'", [c.contabil.id]);
  expect(notas.map((n) => n.texto)).toContain(`Pedido ao Agente Fiscal na demanda nova #${novas[0]!.numero}.`);
});

test('demanda com tarefa ativa: resumo da tarefa e o botão; o cartão diz demanda nova no Contábil', async ({ page }) => {
  const c = await cenarioPedir();
  await criarTarefaTeste({ chamadoId: c.contabil.id, pedidaPor: c.claudia, estado: 'trabalhando', etapas: ['Coletar', 'Lançar'] });
  await entrar(page, EMAIL_CLAUDIA, SENHA);
  await page.goto(`/demandas?demanda=${c.contabil.id}`);
  await expect(page.getByRole('link', { name: 'Abrir a tarefa' })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Pedir ao agente' }).click();
  const janela = page.getByRole('dialog', { name: /Pedir ao agente/ });
  await expect(janela.getByText('Demanda nova no Contábil')).toBeVisible();
});

test('Assistente: Cláudia pede ao agente escolhendo a empresa; a demanda nova é do Contábil (D20)', async ({ page }) => {
  await cenarioPedir();
  await entrar(page, EMAIL_CLAUDIA, SENHA);
  await page.goto('/assistente');
  await expect(page.locator('[data-assistente-hidratado]')).toHaveCount(1, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Pedir ao agente' }).click();
  const janela = page.getByRole('dialog', { name: /Pedir ao agente/ });
  // Sem empresa fixa: o combobox da Empresa tem nome acessível (revisão final, Important 2) e a janela passa no axe.
  await expect(janela.getByRole('combobox', { name: 'Empresa' })).toBeVisible();
  expect(await axeGraves(page)).toEqual([]);
  await janela.getByRole('combobox', { name: 'Empresa' }).click();
  await page.getByRole('combobox', { name: 'Buscar empresa' }).fill('I4 Padaria Sol');
  await page.getByRole('option', { name: /I4 Padaria Sol/ }).click();
  await janela.getByLabel('O que você quer?').fill('Fazer o fechamento de outubro');
  await janela.getByRole('button', { name: 'Enviar para o agente' }).click();
  await page.waitForURL('**/tarefas/**', { timeout: 60_000 });
  const r = await sqlTeste<{ setor: string }>(`select s.nome as setor from public.agente_tarefas t join public.chamados ch on ch.id = t.chamado_id
    join public.setores s on s.id = ch.setor_id`);
  expect(r).toEqual([{ setor: 'Contábil' }]);
});

test('tarefa pedida pelo WhatsApp: a tela mostra "pelo WhatsApp"', async ({ page }) => {
  const c = await cenarioPedir();
  await nivelTeste(c.claudia, 'assistente', 'site_whatsapp');
  const [ag] = await sqlTeste<{ id: string }>("select id from public.agentes where slug = 'contabil'");
  await sqlTeste("select public.pedir_ao_agente_de($1, 'whatsapp', $2, 'Fazer o fechamento de outubro', $3, $4, null)", [c.claudia, ag!.id, c.empresa, c.contabil.numero]);
  const [t] = await sqlTeste<{ id: string }>('select id from public.agente_tarefas');
  await entrar(page, EMAIL_CLAUDIA, SENHA);
  await page.goto(`/tarefas/${t!.id}`);
  await expect(page.getByText(/pedido por .* pelo WhatsApp/)).toBeVisible({ timeout: 60_000 });
});

test('avisos no Início: tarefa pronta aparece em Avisos para quem pediu', async ({ page }) => {
  const c = await cenarioPedir();
  const t = await criarTarefaTeste({ chamadoId: c.contabil.id, pedidaPor: c.claudia, estado: 'pronta', resultado: RESULTADO, etapas: ['Coletar', 'Lançar'] });
  await sqlTeste('select public.registrar_avisos_da_tarefa($1)', [t.id]);
  await entrar(page, EMAIL_CLAUDIA, SENHA);
  await page.goto('/inicio');
  const avisos = page.getByRole('region', { name: 'Avisos' });
  await expect(avisos.getByText(/Tarefa T-\d+.*pronta para aprovar/)).toBeVisible({ timeout: 60_000 });
});

test('ficha do cliente: o índice tem "Arquivos" e o clique leva o foco ao título (D19a)', async ({ page }) => {
  const c = await cenarioPedir();
  await entrar(page, EMAIL_DONO, SENHA);
  await abrirFicha(page, `/clientes/${c.empresa}`);
  await indice(page).getByRole('link', { name: /^Arquivos/ }).click();
  await expect(page.getByRole('heading', { name: 'Arquivos', exact: true })).toBeFocused();
});
