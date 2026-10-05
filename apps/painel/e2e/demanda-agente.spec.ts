import { expect, test } from '@playwright/test';
import { configurarAgenteTeste, limparBanco } from '@escritorio/db/teste';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { SENHA } from './apoio-agentes';
import { demandaE2e, empresaE2e } from './apoio-demandas';

// Parte I2 (D9, D19): o bloco do Agente Fiscal na demanda — pré-análise e sugestões que uma pessoa do setor aprova.
test.beforeEach(async () => { await limparBanco(); });
test.afterAll(async () => { await limparBanco(); });

const PRE = { versao: 1, linhas: [{ situacao: 'falta', texto: 'Destinatário sem CNPJ.' }, { situacao: 'ok', texto: '1 item com produto e preço da tabela.' }],
  contagem: { falta: 1, atencao: 0, ok: 1 } };

async function preparar() {
  const empresa = await empresaE2e('I2 Padaria', '77111222000190');
  const d = await demandaE2e({ titulo: 'I2 NF de venda – Brasil / Centro', setor: 'Fiscal', clienteId: empresa,
    pedidoVenda: { unidade_id: null, texto_destinatario: 'Brasil Centro', data: '05/10/2026', itens: [] } });
  const fiscal = await configurarAgenteTeste('fiscal', {});
  // service_role não grava direto (só as funções do trabalhador): o mesmo caminho do trabalhador.
  await db.rpc('salvar_pre_analise', { p_chamado: d.id, p_agente: fiscal, p_resultado: PRE as never });
  await db.rpc('criar_sugestao_agente', { p_chamado: d.id, p_agente: fiscal, p_conversa: null as never, p_tipo: 'nota_interna',
    p_conteudo: { texto: 'Conferir o CFOP 5.405.' } as never });
  return d;
}

test('Ana (Fiscal) vê a pré-análise e aprova a sugestão: a nota entra na linha do tempo, uma vez', async ({ page }) => {
  const d = await preparar();
  await criarUsuarioTeste({ email: 'ana@i2.local', senha: SENHA, nome: 'Ana Fiscal', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'ana@i2.local', SENHA);
  await page.goto(`/demandas?demanda=${d.id}`);
  // Quem não vê a lista de agentes (atendente) recebe o rótulo de reserva "Agente do setor" no título do bloco.
  const bloco = page.getByRole('heading', { name: 'Agente do setor' }).locator('..');
  await expect(bloco.getByRole('list', { name: 'Pré-análise do pedido de nota' }).getByText('Destinatário sem CNPJ.')).toBeVisible();
  await expect(bloco.getByText('Falta:')).toBeVisible();
  await bloco.getByRole('button', { name: 'Aprovar' }).click();
  await expect(page.getByText('Agente Fiscal (sugestão aprovada por Ana Fiscal): Conferir o CFOP 5.405.')).toBeVisible();
  await expect(bloco.getByRole('button', { name: 'Aprovar' })).toHaveCount(0);
  const { data } = await db.from('chamado_eventos').select('id').eq('chamado_id', d.id).eq('tipo', 'nota_interna');
  expect(data).toHaveLength(1);
});

test('administrador descarta; nada entra na linha do tempo', async ({ page }) => {
  const d = await preparar();
  await criarUsuarioTeste({ email: 'admin@i2.local', senha: SENHA, nome: 'Admin I2', papel: 'admin' });
  await entrar(page, 'admin@i2.local', SENHA);
  await page.goto(`/demandas?demanda=${d.id}`);
  await page.getByRole('button', { name: 'Descartar' }).click();
  // F7: 'Descartada' exato, dentro da lista de sugestões ("Descartada por X em ..." é outro texto).
  await expect(page.getByRole('list', { name: 'Sugestões do agente' }).getByText('Descartada', { exact: true })).toBeVisible();
  const { data } = await db.from('chamado_eventos').select('id').eq('chamado_id', d.id).eq('tipo', 'nota_interna');
  expect(data).toEqual([]);
});
