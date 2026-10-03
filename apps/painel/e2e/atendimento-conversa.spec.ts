import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

const SENHA = 'senha-forte-123';
const TEL = '5531970020001';
const HIDRATADA = 'data-conversa-hidratada';
const TURNO = '22222222-2222-4222-8222-222222222222';

async function cenario() {
  await db.from('conversas').delete().eq('telefone', TEL);
  await db.from('clientes').delete().in('cnpj', ['11222333000181', '11222333000262']);
  const { data: um } = await db.from('clientes').insert({ razao_social: 'Rede Bom Preço Ltda', cnpj: '11222333000181' }).select().single();
  const { data: dois } = await db.from('clientes').insert({ razao_social: 'Padaria Sol ME', cnpj: '11222333000262' }).select().single();
  await db.from('contatos').delete().eq('telefone', TEL);
  const { data: contato } = await db.from('contatos').insert({ nome: 'Carla Mendes', telefone: TEL }).select().single();
  await db.from('contato_clientes').insert([{ contato_id: contato!.id, cliente_id: um!.id }, { contato_id: contato!.id, cliente_id: dois!.id }]);
  const { data: setor } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const { data: c } = await db.from('conversas').insert({
    telefone: TEL, contato_id: contato!.id, cliente_em_foco: um!.id,
    aguardando_pessoa_desde: new Date(Date.now() - 18 * 60_000).toISOString(), motivo_pessoa: 'não entendeu o pedido duas vezes',
  }).select().single();
  const { data: ch } = await db.from('chamados').insert({ conversa_id: c!.id, cliente_id: um!.id, setor_id: setor!.id, titulo: 'Nota de venda e2e' })
    .select('id, numero').single();
  const { data: doc } = await db.from('documentos_empresa')
    .insert({ cliente_id: um!.id, nome: 'Contrato social', arquivo_path: 'e2e/contrato.pdf', arquivo_nome: 'contrato.pdf', ia_pode_enviar: true }).select().single();
  const t = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  await db.from('mensagens').insert([
    { conversa_id: c!.id, direcao: 'entrada', autor: 'cliente', conteudo: 'Preciso de uma nota pra Unidade Centro', criado_em: t(30), processada_em: t(30) },
    { conversa_id: c!.id, direcao: 'saida', autor: 'agente', conteudo: 'Vou confirmar o valor com a equipe.', criado_em: t(29), turno_agente: TURNO, status_envio: 'enviada' },
    { conversa_id: c!.id, direcao: 'saida', autor: 'agente', conteudo: '📎 Contrato social', criado_em: t(28), turno_agente: TURNO, documento_id: doc!.id, status_envio: 'enviada' },
  ]);
  await db.from('decisoes_agente').insert([
    { conversa_id: c!.id, etapa: 'buscar_produtos', entrada: { textos: ['caixa'] }, saida: { candidatos: [] }, turno: TURNO, criado_em: t(29.5) },
    { conversa_id: c!.id, etapa: 'abrir_chamado', entrada: {}, saida: { numero: ch!.numero, setor: 'Fiscal' }, turno: TURNO, criado_em: t(29.4) },
    { conversa_id: c!.id, etapa: 'responder', entrada: {}, saida: {}, turno: TURNO, criado_em: t(29) },
  ]);
  return { conversa: c!.id, numero: ch!.numero, doc: doc!.id, um: um!, dois: dois! };
}

test('faixa de passagem, por quê, cartão de decisão, marco e link do documento', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana-conversa@e2e.local', senha: SENHA, nome: 'Ana Conversa', papel: 'atendente', setores: ['Fiscal'] });
  const s = await cenario();
  await entrar(page, 'ana-conversa@e2e.local', SENHA);
  await page.goto(`/atendimento/${s.conversa}`);
  const faixa = page.getByRole('note', { name: 'Passagem para pessoa' });
  await expect(faixa).toContainText('O agente passou para uma pessoa há 18 min.');
  await expect(faixa).toContainText('Motivo: não entendeu o pedido duas vezes');
  const log = page.getByRole('log', { name: 'Histórico da conversa' });
  // De 1024 a 1535 px o painel da direita fica por cima do histórico (a coluna própria é da Task 12): fecha para clicar.
  await expect(page.locator('body')).toHaveAttribute(HIDRATADA, '', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Esconder painel lateral' }).click();
  await expect(page.locator('#painel-conversa')).toBeHidden();
  await log.getByText('por quê?').click();
  await expect(log.getByText('Buscou produtos', { exact: true })).toBeVisible();
  await expect(log.getByText(`Abriu uma demanda (#${s.numero} no Fiscal)`)).toBeVisible();
  await expect(log.getByText(`Demanda #${s.numero} aberta no Fiscal · normal`)).toBeVisible();
  await expect(log.getByRole('link', { name: 'Contrato social' })).toHaveAttribute('href', `/api/documentos?id=${s.doc}`);
  await faixa.getByRole('button', { name: 'Ver decisão' }).click();
  await expect(page.locator(`#turno-${TURNO}`)).toBeInViewport();
});

test('assumir limpa a faixa e marca; devolver e concluir; atalho A', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana-conversa@e2e.local', senha: SENHA, nome: 'Ana Conversa', papel: 'atendente', setores: ['Fiscal'] });
  const s = await cenario();
  await entrar(page, 'ana-conversa@e2e.local', SENHA);
  await page.goto(`/atendimento/${s.conversa}`);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect(page.locator('body')).toHaveAttribute(HIDRATADA, '', { timeout: 30_000 });
  await page.keyboard.press('a');
  await expect(page.getByRole('button', { name: 'Devolver ao agente' })).toBeVisible();
  await expect(page.getByRole('note', { name: 'Passagem para pessoa' })).toHaveCount(0);
  await expect(page.getByRole('log', { name: 'Histórico da conversa' }).getByText('Ana Conversa assumiu')).toBeVisible();
  // N e Esc continuam (spec 7A.3): N vai para a nota interna (há demanda aberta); Esc fecha o painel da direita.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('n');
  await expect(page.getByRole('textbox', { name: 'Nota interna', exact: true })).toBeFocused();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Escape');
  await expect(page.locator('#painel-conversa')).toBeHidden();
  await page.getByRole('button', { name: 'Concluir atendimento' }).click();
  await expect(page.getByRole('button', { name: 'Assumir' })).toBeVisible();
  await expect(page.getByRole('log', { name: 'Histórico da conversa' }).getByText('Atendimento concluído por Ana Conversa')).toBeVisible();
  await page.goto('/atendimento');
  await page.getByText('Concluídas hoje').click();
  await expect(page.locator(`a[href^="/atendimento/${s.conversa}"]`)).toBeVisible();
});

test('trocar empresa só entre as do contato; vínculo apagado com a tela aberta mostra o erro (foco da revisão 3)', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana-conversa@e2e.local', senha: SENHA, nome: 'Ana Conversa', papel: 'atendente', setores: ['Fiscal'] });
  const s = await cenario();
  await entrar(page, 'ana-conversa@e2e.local', SENHA);
  await page.goto(`/atendimento/${s.conversa}`);
  await page.getByRole('button', { name: 'Trocar empresa' }).click();
  await page.getByRole('menuitem', { name: 'Padaria Sol ME' }).click();
  await expect(page.getByText('Conversa agora em Padaria Sol ME.')).toBeVisible();
  await expect(page.locator('header').filter({ has: page.locator('#titulo-conversa') })).toContainText('Padaria Sol ME');
  await expect(page.getByRole('log', { name: 'Histórico da conversa' }).getByText('Empresa trocada: Rede Bom Preço Ltda → Padaria Sol ME')).toBeVisible();
  // O contato sai da Rede com a tela aberta: a troca é recusada pelo banco.
  await page.getByRole('button', { name: 'Trocar empresa' }).click();
  await db.from('contato_clientes').delete().eq('cliente_id', s.um.id);
  await page.getByRole('menuitem', { name: 'Rede Bom Preço Ltda' }).click();
  await expect(page.getByText('Esta empresa não está ligada ao contato.')).toBeVisible();
  await expect(page.locator('header').filter({ has: page.locator('#titulo-conversa') })).toContainText('Padaria Sol ME');
});

test('não lidas zeram ao abrir e são de cada pessoa (foco da revisão 2)', async ({ page, browser }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-conversa@e2e.local', senha: SENHA, nome: 'Ana Conversa', papel: 'atendente', setores: ['Fiscal'] });
  await criarUsuarioTeste({ email: 'caio-conversa@e2e.local', senha: SENHA, nome: 'Caio Conversa', papel: 'atendente', setores: ['Fiscal'] });
  const s = await cenario();
  await db.from('mensagens').insert({ conversa_id: s.conversa, direcao: 'entrada', autor: 'cliente', conteudo: 'Preciso hoje, é urgente', processada_em: new Date().toISOString() });
  await entrar(page, 'ana-conversa@e2e.local', SENHA);
  await page.goto('/atendimento');
  await expect(page.locator(`a[href^="/atendimento/${s.conversa}"]`).getByLabel('1 mensagem não lida')).toBeVisible();
  await page.locator(`a[href^="/atendimento/${s.conversa}"]`).click();
  await expect(page.getByRole('log', { name: 'Histórico da conversa' })).toBeVisible();
  await expect.poll(async () => (await db.from('conversa_leituras').select('usuario_id').eq('conversa_id', s.conversa)).data).toEqual([{ usuario_id: ana }]);
  await page.goto('/atendimento');
  await expect(page.locator(`a[href^="/atendimento/${s.conversa}"]`).getByLabel(/não lida/)).toHaveCount(0);
  const caio = await (await browser.newContext()).newPage();
  await entrar(caio, 'caio-conversa@e2e.local', SENHA);
  await caio.goto('/atendimento');
  await expect(caio.locator(`a[href^="/atendimento/${s.conversa}"]`).getByLabel('1 mensagem não lida')).toBeVisible();
});

test('sem acesso a pedidos de nota, o por quê mostra o aviso e nunca o conteúdo do pedido (P11)', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-conversa@e2e.local', senha: SENHA, nome: 'Ana Conversa', papel: 'atendente', setores: ['Fiscal'] });
  const s = await cenario();
  await db.from('decisoes_agente').insert({
    conversa_id: s.conversa, etapa: 'abrir_pedido_nota', entrada: { texto: 'SEGREDO-DO-PEDIDO 10 caixas' }, saida: { itens: 'SEGREDO-DO-PEDIDO' },
    turno: TURNO, criado_em: new Date(Date.now() - 29.3 * 60_000).toISOString(),
  });
  await db.from('usuario_permissoes').update({ nivel: 'sem_acesso' }).eq('usuario_id', ana).eq('modulo', 'notas');
  await entrar(page, 'ana-conversa@e2e.local', SENHA);
  await page.goto(`/atendimento/${s.conversa}`);
  const log = page.getByRole('log', { name: 'Histórico da conversa' });
  await expect(page.locator('body')).toHaveAttribute(HIDRATADA, '', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Esconder painel lateral' }).click();
  await log.getByText('por quê?').click();
  await expect(log.getByText('Só quem tem acesso a pedidos de nota vê a descrição, os itens e as correções deste pedido.')).toBeVisible();
  await expect(page.getByText('SEGREDO-DO-PEDIDO')).toHaveCount(0);
  expect(await page.content()).not.toContain('SEGREDO-DO-PEDIDO');
});
