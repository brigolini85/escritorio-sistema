import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { demandaE2e, limparDemandasE2e } from './apoio-demandas';
import { abrirInicio, cartaoNumero, fimDeHoje, numeroInicio } from './apoio-inicio';

const SENHA = 'senha-forte-123';
const ADMIN = { email: 'thiago-situacao@e2e.local', nome: 'Thiago Situação' };
const PREFIXO_TEL = '553197003';

test.beforeEach(async () => {
  await criarUsuarioTeste({ email: ADMIN.email, senha: SENHA, nome: ADMIN.nome, papel: 'admin' });
});
test.afterAll(async () => {
  await db.from('conversas').delete().like('telefone', `${PREFIXO_TEL}%`);
});

test('cartão do agente: estado, expediente e números do dia (conversas, % resolvidas, demandas abertas por ele)', async ({ page }) => {
  await db.from('conversas').delete().like('telefone', `${PREFIXO_TEL}%`);
  await entrar(page, ADMIN.email, SENHA);
  await abrirInicio(page, 'situacao');
  const cartao = page.getByTestId('inicio-agente');
  const conversas = async () => Number((await cartao.locator('[data-agente-numero="conversas"]').innerText()).trim());
  const antes = await conversas();

  // Duas conversas de hoje: uma só com o agente, outra a equipe respondeu.
  const agora = Date.now();
  for (const [sufixo, equipe] of [['0001', false], ['0002', true]] as const) {
    const { data: c } = await db.from('conversas').insert({ telefone: `${PREFIXO_TEL}${sufixo}` }).select('id').single();
    await db.from('mensagens').insert({ conversa_id: c!.id, direcao: 'entrada', autor: 'cliente', conteudo: 'oi', criado_em: new Date(agora - 60_000).toISOString(), processada_em: new Date().toISOString() });
    if (equipe) await db.from('mensagens').insert({ conversa_id: c!.id, direcao: 'saida', autor: 'atendente', conteudo: 'pois não', criado_em: new Date(agora - 30_000).toISOString() });
  }
  await abrirInicio(page, 'situacao');
  await expect.poll(conversas).toBe(antes + 2);
  await expect(cartao.locator('[data-agente-numero="resolvidas"]')).toHaveText(/^\d+%$/);
  await expect(cartao.locator('[data-agente-numero="demandas"]')).toHaveText(/^\d+$/);
  await expect(cartao.locator('[data-estado-agente]')).toHaveText(/Atendendo|Pausado|Parado pelo teto de IA/);
  await expect(cartao).toContainText(/dentro do expediente|fora do expediente|Todas as mensagens vão para a equipe|o gasto do mês chegou ao teto/);
});

test('sinais de vida: WhatsApp, fila, último batimento e avisos não vistos', async ({ page }) => {
  await db.from('alertas').delete().like('mensagem', 'E2E G2 sinais%');
  await db.from('alertas').insert({ nivel: 'aviso', mensagem: 'E2E G2 sinais: aviso de teste' });
  try {
    await entrar(page, ADMIN.email, SENHA);
    await abrirInicio(page, 'situacao');
    const sinais = page.locator('#sinais-de-vida');
    await expect(sinais.getByRole('heading', { name: 'Sinais de vida' })).toBeVisible();
    await expect(sinais).toContainText('WhatsApp (Z-API)');
    await expect(sinais).toContainText('Fila de tarefas');
    await expect(sinais).toContainText('Último batimento');
    await expect(sinais.getByRole('link', { name: /Avisos não vistos/ })).toHaveAttribute('href', '#avisos');
  } finally {
    await db.from('alertas').delete().like('mensagem', 'E2E G2 sinais%');
  }
});

const P = 'E2E-G2S';

test('cabeçalho e os cinco números: contam as novas, com detalhes e links', async ({ page }) => {
  await limparDemandasE2e(P);
  try {
    await entrar(page, ADMIN.email, SENHA);
    await abrirInicio(page, 'situacao');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Situação do escritório · \S+, \d{2}\/\d{2}$/);
    await expect(page.getByText(/^(Bom dia|Boa tarde|Boa noite), Thiago\. Visão de administrador: todos os setores\.$/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Gestão das demandas' })).toHaveAttribute('href', '/demandas');
    await expect(page.getByRole('link', { name: 'Abrir atendimento' })).toHaveAttribute('href', '/atendimento');
    const antes = {
      abertas: await numeroInicio(page, 'demandas-abertas'), hoje: await numeroInicio(page, 'vencem-hoje'),
      vencidas: await numeroInicio(page, 'vencidas'), sem: await numeroInicio(page, 'sem-responsavel'),
    };
    await demandaE2e({ titulo: `${P} hoje`, setor: 'Fiscal', status: 'em_andamento', prioridade: 'urgente', prazoEm: fimDeHoje() });
    await demandaE2e({ titulo: `${P} vencida`, setor: 'Fiscal', status: 'em_andamento', prazoEm: '2020-01-02T21:00:00Z' });
    await abrirInicio(page, 'situacao');
    await expect.poll(() => numeroInicio(page, 'demandas-abertas')).toBe(antes.abertas + 2);
    expect(await numeroInicio(page, 'vencem-hoje')).toBe(antes.hoje + 1);
    expect(await numeroInicio(page, 'vencidas')).toBe(antes.vencidas + 1);
    expect(await numeroInicio(page, 'sem-responsavel')).toBe(antes.sem + 2);
    await expect(cartaoNumero(page, 'vencem-hoje')).toContainText(/\d+ urgentes? · até \d+h/);
    await expect(cartaoNumero(page, 'vencidas')).toContainText('mais atrasada: venceu 02/01');
    await expect(cartaoNumero(page, 'demandas-abertas')).toContainText(/\d+ abertas hoje · \d+ do agente/);
    await expect(cartaoNumero(page, 'sem-responsavel')).toContainText(/\d+ há mais de \d+ min/);
    await expect(cartaoNumero(page, 'esperando-pessoa').getByRole('link', { name: 'Ver no Atendimento' })).toHaveAttribute('href', '/atendimento');
    await expect(cartaoNumero(page, 'demandas-abertas').getByRole('link', { name: 'Ver todas' })).toHaveAttribute('href', '/demandas');
    await expect(cartaoNumero(page, 'sem-responsavel').getByRole('link', { name: 'Ver na lista' })).toHaveAttribute('href', '/demandas?responsavel=sem');
  } finally {
    await limparDemandasE2e(P);
  }
});

test('faixa: fila atrasada vira aviso âmbar que leva aos sinais de vida (D10)', async ({ page }) => {
  const { data: antes } = await db.from('sinais_vida').select('componente, visto_em');
  try {
    await db.from('sinais_vida').upsert([
      { componente: 'fila', visto_em: new Date(Date.now() - 200_000).toISOString() },
      { componente: 'whatsapp', visto_em: new Date().toISOString() },
    ]);
    await entrar(page, ADMIN.email, SENHA);
    await abrirInicio(page, 'situacao');
    // Outros avisos (ex.: teto perto) podem estar na faixa: o teste olha só o da fila.
    const fila = page.getByRole('region', { name: 'Alertas' }).getByRole('status').filter({ hasText: 'Fila de tarefas sem batimento' });
    await expect(fila).toContainText('Fila de tarefas sem batimento há 3 min');
    await expect(fila).toContainText('Se passar de 5 min, vira alerta crítico.');
    await fila.getByRole('link', { name: 'Ver sinais de vida' }).click();
    await expect(page).toHaveURL(/#sinais-de-vida$/);
  } finally {
    await db.from('sinais_vida').delete().neq('componente', '');
    if (antes?.length) await db.from('sinais_vida').insert(antes);
  }
});

test('Demandas por setor: linha do setor com barra em texto, link filtrado, Triagem e soma igual ao cartão', async ({ page }) => {
  const NOME = 'E2E G2 Setor';
  await db.from('chamados').delete().like('titulo', `${P} setor%`);
  await db.from('setores').delete().eq('nome', NOME);
  const { data: setor } = await db.from('setores').insert({ nome: NOME }).select('id').single();
  const { data: admin } = await db.from('usuarios').select('id').eq('email', ADMIN.email).single();
  try {
    await demandaE2e({ titulo: `${P} setor hoje`, setor: NOME, status: 'em_andamento', prioridade: 'urgente', prazoEm: fimDeHoje() });
    await demandaE2e({ titulo: `${P} setor vencida`, setor: NOME, status: 'em_andamento', prazoEm: '2020-01-02T21:00:00Z', responsavelId: admin!.id });
    await demandaE2e({ titulo: `${P} setor depois`, setor: NOME, prazoEm: new Date(Date.now() + 10 * 86_400_000).toISOString() });
    await entrar(page, ADMIN.email, SENHA);
    await abrirInicio(page, 'situacao');
    const tabela = page.getByRole('table', { name: 'Demandas por setor' });
    const linha = tabela.getByRole('row', { name: new RegExp(NOME) });
    // Situação (barra) · Abertas · Vencem hoje · Vencidas · Sem responsável · Urgentes
    await expect(linha.getByRole('cell')).toHaveText(['', '3', '1', '1', '2', '1']);
    await expect(linha.getByRole('img')).toHaveAttribute('aria-label', '1 vencida, 1 vence hoje, 1 no prazo');
    await expect(linha.getByRole('link', { name: NOME })).toHaveAttribute('href', `/demandas?setor=${setor!.id}`);
    // Os cartões são a soma da tabela (D5).
    const abertas = await tabela.locator('tbody tr').evaluateAll((linhas) =>
      linhas.reduce((s, l) => s + Number((l as HTMLTableRowElement).cells[2]?.textContent ?? 0), 0));
    expect(abertas).toBe(await numeroInicio(page, 'demandas-abertas'));
  } finally {
    await db.from('chamados').delete().eq('setor_id', setor!.id);
    await db.from('setores').delete().eq('id', setor!.id);
  }
});

test('Esperando pessoa agora (cronômetro), Vencidas e um aviso que some com OK', async ({ page }) => {
  // Sobras de outros specs com espera entrariam antes na lista de 5 (mesmo cuidado do atendimento-lista).
  await db.from('conversas').delete().not('aguardando_pessoa_desde', 'is', null);
  await db.from('conversas').delete().like('telefone', `${PREFIXO_TEL}%`);
  await db.from('alertas').delete().like('mensagem', 'E2E G2 aviso%');
  const { data: c } = await db.from('conversas').insert({
    telefone: `${PREFIXO_TEL}0009`, aguardando_pessoa_desde: new Date(Date.now() - 18 * 60_000).toISOString(), motivo_pessoa: 'pediu para falar com pessoa',
  }).select('id').single();
  await db.from('mensagens').insert({ conversa_id: c!.id, direcao: 'entrada', autor: 'cliente', conteudo: 'quero falar com alguém', processada_em: new Date().toISOString() });
  const vencida = await demandaE2e({ titulo: `${P} muito vencida`, setor: 'Fiscal', status: 'em_andamento', prazoEm: '2019-01-02T21:00:00Z' });
  await db.from('alertas').insert({ nivel: 'aviso', mensagem: 'E2E G2 aviso: contato novo sem empresa' });
  try {
    await entrar(page, ADMIN.email, SENHA);
    await abrirInicio(page, 'situacao');
    const esperando = page.getByRole('region', { name: 'Esperando pessoa agora' });
    const item = esperando.locator(`a[href="/atendimento/${c!.id}"]`);
    await expect(item.locator('[data-espera="vermelho"]')).toContainText('18 min');
    await expect(item).toContainText('pediu para falar com pessoa');

    const vencidas = page.getByRole('region', { name: /^Vencidas/ });
    const linhaVencida = vencidas.getByRole('link', { name: new RegExp(`#${vencida.numero}`) });
    await expect(linhaVencida).toHaveAttribute('href', `/demandas?demanda=${vencida.id}`);
    await expect(linhaVencida).toContainText('venceu 02/01');
    await expect(linhaVencida).toContainText('sem responsável');

    // Por id: o toaster também é uma região chamada "Avisos".
    const avisos = page.locator('#avisos');
    const aviso = avisos.getByRole('listitem').filter({ hasText: 'E2E G2 aviso: contato novo sem empresa' });
    await aviso.getByRole('button', { name: 'ok' }).click();
    await expect(aviso).toHaveCount(0);
  } finally {
    await db.from('conversas').delete().like('telefone', `${PREFIXO_TEL}%`);
    await db.from('alertas').delete().like('mensagem', 'E2E G2 aviso%');
    await limparDemandasE2e(P);
  }
});
