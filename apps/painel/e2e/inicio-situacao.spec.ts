import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirInicio } from './apoio-inicio';

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
