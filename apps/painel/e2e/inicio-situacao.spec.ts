import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { demandaE2e, limparDemandasE2e } from './apoio-demandas';
import { abrirInicio, cartaoNumero, numeroInicio } from './apoio-inicio';

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
/** Fim do dia de hoje em Brasília (UTC-3) menos 1 minuto: ainda hoje e no futuro (mesmo cálculo do inicio-vencimentos). */
function fimDeHoje(): string {
  const UM_DIA = 24 * 3600_000;
  const inicio = Math.floor((Date.now() - 3 * 3600_000) / UM_DIA) * UM_DIA + 3 * 3600_000;
  return new Date(inicio + UM_DIA - 60_000).toISOString();
}

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
