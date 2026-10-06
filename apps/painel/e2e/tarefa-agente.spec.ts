import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { limparBanco, sqlTeste } from '@escritorio/db/teste';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { SENHA } from './apoio-agentes';
import { RESULTADO, cenarioTarefa } from './apoio-tarefas';

// Parte I3a (spec 7E.4; D7, D8, D11): a página da tarefa do agente.
test.beforeEach(async () => { await limparBanco(); });
test.afterAll(async () => { await limparBanco(); });

const estadoNoBanco = async (id: string) => (await sqlTeste<{ estado: string }>('select estado from public.agente_tarefas where id = $1', [id]))[0]!.estado;

test('aguardando pendências: aprovar travado; a resposta rápida e o "já recebi" retomam a tarefa', async ({ page }) => {
  const c = await cenarioTarefa({ pendencias: [
    { tipo: 'analista', pergunta: 'PIX de R$ 3.200 para Roberto Faria: é pró-labore?', opcoes: ['Pró-labore', 'Distribuição de lucro'] },
    { tipo: 'cliente', pergunta: 'Extrato do Banco do Brasil de outubro' }] });
  await entrar(page, 'claudia@i3.local', SENHA);
  await page.goto(`/tarefas/${c.tarefa.id}`);
  const tarefa = page.getByRole('region', { name: 'Tarefa do agente Contábil' });
  await expect(tarefa.getByRole('list', { name: 'Etapas da tarefa' }).getByText('3 arquivos')).toBeVisible();
  await expect(tarefa.getByText('Faltando', { exact: true })).toBeVisible();
  const aprovacao = page.getByRole('region', { name: 'Aprovação' });
  await expect(aprovacao.getByRole('button', { name: 'Aprovar e concluir' })).toBeDisabled();
  await expect(aprovacao.getByText('liberado quando não houver pendências')).toBeVisible();
  await tarefa.getByRole('article', { name: 'Pendência 1' }).getByRole('button', { name: 'Pró-labore' }).click();
  await expect(tarefa.getByRole('article', { name: 'Pendência 1' }).getByText(/Respondida por Cláudia Contábil: Pró-labore/)).toBeVisible();
  expect(await estadoNoBanco(c.tarefa.id)).toBe('aguardando_pendencias');
  await tarefa.getByRole('article', { name: 'Pendência 2' }).getByRole('button', { name: 'Já recebi' }).click();
  await page.getByLabel('Observação').fill('O cliente disse que não houve movimento no BB.');
  await page.getByRole('button', { name: 'Marcar como recebida' }).click();
  await expect.poll(() => estadoNoBanco(c.tarefa.id)).toBe('trabalhando');
  const a11y = await new AxeBuilder({ page }).analyze();
  expect(a11y.violations).toEqual([]);
});

test('pronto para aprovar: aprova uma vez, a nota entra na demanda e ela é concluída; o CSV baixa', async ({ page }) => {
  const c = await cenarioTarefa({ estado: 'pronta', resultado: RESULTADO });
  await entrar(page, 'claudia@i3.local', SENHA);
  await page.goto(`/tarefas/${c.tarefa.id}`);
  await expect(page.getByRole('table', { name: 'Linhas do resultado' }).getByText('provisória')).toBeVisible();
  const csv = await page.request.get(`/api/tarefas/csv?id=${c.tarefa.id}`);
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain('Tarifa bancária;45,00;;extrato.csv;não');
  await page.getByRole('region', { name: 'Aprovação' }).getByRole('button', { name: 'Aprovar e concluir' }).click();
  await expect(page.getByRole('region', { name: 'Aprovação' }).getByText(/Aprovada por Cláudia Contábil/)).toBeVisible();
  expect(await estadoNoBanco(c.tarefa.id)).toBe('aprovada');
  const { data: ch } = await db.from('chamados').select('status').eq('id', c.demanda.id).single();
  expect(ch!.status).toBe('concluido');
  const { data: notas } = await db.from('chamado_eventos').select('texto').eq('chamado_id', c.demanda.id).eq('tipo', 'nota_interna');
  expect(notas!.map((n) => n.texto)).toEqual([expect.stringContaining('aprovado por Cláudia Contábil: 3 lançamentos')]);
});

test('pedir ao cliente: só o contato que pode ser procurado; depois, sem "cobrar de novo" antes de 24 h', async ({ page }) => {
  const c = await cenarioTarefa({ contatoProcuravel: true, pendencias: [{ tipo: 'cliente', pergunta: 'Extrato do Banco do Brasil de outubro',
    mensagem: 'Roberto, bom dia! Para fechar outubro só falta o extrato do Banco do Brasil. Pode mandar o PDF por aqui?' }] });
  await entrar(page, 'claudia@i3.local', SENHA);
  await page.goto(`/tarefas/${c.tarefa.id}`);
  const p = page.getByRole('article', { name: 'Pendência 1' });
  await p.getByRole('button', { name: 'Pedir ao cliente' }).click();
  // Task 13: o contato começa sem escolha e o botão fica desabilitado até escolher.
  await expect(page.getByRole('button', { name: 'Mandar pelo Thiago' })).toBeDisabled();
  await page.getByLabel('Contato').selectOption(c.contatoId!);
  await expect(page.getByLabel('Contato')).toHaveValue(c.contatoId!);
  await expect(page.getByLabel('Mensagem')).toHaveValue(/só falta o extrato do Banco do Brasil/);
  await page.getByRole('button', { name: 'Mandar pelo Thiago' }).click();
  // Task 13: antes do trabalhador enviar, aparece "Aprovado, aguardando envio".
  await expect(p.getByText(/Aprovado, aguardando envio/)).toBeVisible();
  await expect(p.getByRole('button', { name: 'Cobrar de novo' })).toHaveCount(0);
  const [x] = await sqlTeste<{ pedidos: number; contato_id: string }>('select pedidos, contato_id from public.agente_pendencias where tarefa_id = $1', [c.tarefa.id]);
  expect(x).toEqual({ pedidos: 1, contato_id: c.contatoId });
});

test('quem vê a demanda mas não é do setor não decide nem responde; o envio de arquivo entra na lista', async ({ page }) => {
  const c = await cenarioTarefa({ pendencias: [{ tipo: 'analista', pergunta: 'Despesa sem nota: qual conta?' }] });
  const paula = await criarUsuarioTeste({ email: 'paula@i3.local', senha: SENHA, nome: 'Paula Pessoal', papel: 'atendente', setores: ['Pessoal'] });
  await sqlTeste("update public.usuario_permissoes set nivel = 'todas' where modulo = 'demandas' and usuario_id = $1", [paula]);
  await entrar(page, 'paula@i3.local', SENHA);
  await page.goto(`/tarefas/${c.tarefa.id}`);
  await expect(page.getByRole('region', { name: 'Aprovação' }).getByText('Quem aprova é uma pessoa do setor da demanda.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Responder' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enviar arquivo' })).toHaveCount(0);
  await page.context().clearCookies();
  await entrar(page, 'claudia@i3.local', SENHA);
  await page.goto(`/tarefas/${c.tarefa.id}`);
  await page.getByLabel('Enviar arquivo').setInputFiles({ name: 'folha.csv', mimeType: 'text/csv', buffer: Buffer.from('funcionario;liquido\nAna;2450,00') });
  await expect(page.getByRole('list', { name: 'Arquivos da tarefa' }).getByRole('link', { name: 'folha.csv' })).toBeVisible();
});

// Ruling F7: o bucket "tarefas" não tem política de leitura; só a rota auditada baixa o arquivo.
test('arquivo da tarefa: leitura direta do storage com a sessão da pessoa falha; a rota auditada baixa', async ({ page }) => {
  const c = await cenarioTarefa();
  await entrar(page, 'claudia@i3.local', SENHA);
  await page.goto(`/tarefas/${c.tarefa.id}`);
  const link = page.getByRole('list', { name: 'Arquivos da tarefa' }).getByRole('link', { name: 'extrato.csv' });
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  const rota = await page.request.get(href!);
  expect(rota.status()).toBe(200);
  expect(await rota.text()).toContain('05/10;-45,00');
  // Leitura direta com a sessão (JWT) da pessoa, como o navegador faria com o supabase-js.
  const [arq] = await sqlTeste<{ caminho: string }>("select name as caminho from storage.objects where bucket_id = 'tarefas' limit 1");
  const cookies = await page.context().cookies();
  const bruto = cookies.filter((k) => k.name.includes('auth-token')).sort((a, b) => a.name.localeCompare(b.name)).map((k) => k.value).join('');
  let jwt = '';
  try {
    const txt = bruto.startsWith('base64-') ? Buffer.from(bruto.slice(7), 'base64').toString('utf8') : decodeURIComponent(bruto);
    jwt = (JSON.parse(txt) as { access_token: string }).access_token;
  } catch { /* sem sessão legível: o expect abaixo falha com a mensagem certa */ }
  expect(jwt).not.toBe('');
  const url = `${process.env.SUPABASE_URL}/storage/v1/object/authenticated/tarefas/${arq!.caminho}`;
  const direto = await page.request.get(url, { headers: { Authorization: `Bearer ${jwt}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA ?? '' } });
  expect(direto.ok()).toBe(false);
  expect([400, 401, 403, 404]).toContain(direto.status());
});
