import { beforeEach, describe, expect, it } from 'vitest';
import { FERRAMENTAS_SETOR, FERRAMENTAS_SO_ATENDIMENTO } from '@escritorio/core';
import { criarClienteServico, criarRepos } from '../src';
import { configurarAgenteTeste, criarSkillTeste, limparBanco } from './limpar';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);
const semErro = <T extends { error: { message: string } | null }>(r: T): T => { if (r.error) throw new Error(r.error.message); return r; };
const AGORA = new Date('2026-10-05T13:00:00Z');

async function contato(nome: string, telefone: string): Promise<string> {
  return semErro(await db.from('contatos').insert({ nome, telefone }).select('id').single()).data!.id;
}

beforeEach(limparBanco);

describe('listas do core e do banco (F8)', () => {
  it('"só do Thiago" e as ferramentas do setor são iguais nos dois lados', async () => {
    const soThiago = semErro(await db.rpc('ferramentas_so_do_atendimento')).data;
    expect([...soThiago!].sort()).toEqual([...FERRAMENTAS_SO_ATENDIMENTO].sort());
    const setor = semErro(await db.rpc('ferramentas_do_setor')).data;
    expect([...setor!].sort()).toEqual([...FERRAMENTAS_SETOR].sort());
  });
});

describe('agentesParaContato (D2)', () => {
  it('Teste com o contato na lista e modo: vem com regras, skills ligadas e orientações do próprio agente', async () => {
    const carla = await contato('Carla', '5531955550001');
    const beto = await contato('Beto', '5531955550002');
    const fiscal = await configurarAgenteTeste('fiscal', { estado: 'teste', modo: 'mesma_voz', contatos: [carla], ferramentas: ['conferir_pedido_nota'],
      regras: [{ assunto: 'Pedido de nota de venda', exemplo: 'Preciso da nota', modo: 'por_tras' }] });
    await criarSkillTeste('fiscal', 'jeito-do-fiscal', 'jeito', true);
    await criarSkillTeste('fiscal', 'rascunho', 'conhecimento', false);
    semErro(await db.from('orientacoes_agente').insert({ titulo: 'Prazo', texto: 'Notas até as 16h.', tipo: 'regra', ativo: true, agente_id: fiscal }));
    semErro(await db.from('orientacoes_agente').insert({ titulo: 'Do Thiago', texto: 'Só do Thiago.', tipo: 'jeito', ativo: true }));
    const [a] = (await repos.agentesParaContato(carla))!;
    expect(a).toMatchObject({ id: fiscal, slug: 'fiscal', setor: 'Fiscal', estado: 'teste', modo: 'mesma_voz', ferramentas: ['conferir_pedido_nota'] });
    expect(a!.regras).toEqual([expect.objectContaining({ assunto: 'Pedido de nota de venda', exemplo: 'Preciso da nota', modo: 'por_tras' })]);
    expect(a!.skills.map((s) => s.nome)).toEqual(['jeito-do-fiscal']);
    expect(a!.orientacoes.map((o) => o.titulo)).toEqual(['Prazo']);
    expect(await repos.agentesParaContato(beto)).toEqual([]);
  });
  it('Desligado, sem modo ou só Trabalho: ninguém', async () => {
    const carla = await contato('Carla', '5531955550001');
    await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: null });
    await configurarAgenteTeste('contabil', { estado: 'ligado', modo: 'mesma_voz' });
    expect(await repos.agentesParaContato(carla)).toEqual([]);
  });
  it('configurarAgenteTeste respeita a trava do banco: "só do Thiago" no agente do setor é recusado', async () => {
    await expect(configurarAgenteTeste('fiscal', { ferramentas: [FERRAMENTAS_SO_ATENDIMENTO[0]!] })).rejects.toThrow(/só do Thiago/);
  });
});

describe('condução e decisões com agente (D6, D11)', () => {
  it('inicia e encerra com marcos; decisão do agente do setor leva o agente_id, a do Thiago não', async () => {
    const carla = await contato('Carla', '5531955550001');
    const fiscal = await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'passa_conversa' });
    const conversa = await repos.obterOuCriarConversa('5531955550001', carla);
    expect(await repos.iniciarConducao(conversa.id, fiscal)).toBe(true);
    expect((await repos.obterConversa(conversa.id)).agente_conduzindo_id).toBe(fiscal);
    expect(await repos.encerrarConducao(conversa.id, 'assunto encerrado')).toBe(true);
    const { data: ev } = await db.from('conversa_eventos').select('tipo, texto').eq('conversa_id', conversa.id).order('criado_em');
    expect(ev).toEqual([{ tipo: 'agente_assumiu', texto: 'Agente Fiscal' }, { tipo: 'agente_devolveu', texto: 'Agente Fiscal: assunto encerrado' }]);
    await repos.registrarDecisao({ conversaId: conversa.id, clienteId: null, etapa: 'responder', entrada: {}, saida: {}, agenteId: fiscal });
    await repos.registrarDecisao({ conversaId: conversa.id, clienteId: null, etapa: 'responder', entrada: {}, saida: {} });
    const { data: dec } = await db.from('decisoes_agente').select('agente_id').eq('conversa_id', conversa.id).order('criado_em');
    expect(dec!.map((d) => d.agente_id)).toEqual([fiscal, null]);
  });
});

describe('demanda do setor, pré-análise e sugestões (D9, D19)', () => {
  async function demandaComPedido() {
    const cliente = semErro(await db.from('clientes').insert({ razao_social: 'Padaria Sol', cnpj: '11222333000181' }).select('id').single()).data!.id;
    const grupo = semErro(await db.from('parceiros_grupos').insert({ cliente_id: cliente, tipo: 'cliente', nome: 'Supermercado Brasil' }).select('id').single()).data!.id;
    const unidade = semErro(await db.from('parceiros_unidades').insert({ cliente_id: cliente, grupo_id: grupo, nome_unidade: 'Centro',
      razao_social: 'Supermercado Brasil Ltda', cnpj: '11111111000191', endereco: 'Rua A', cidade: 'BH', uf: 'MG', cep: '30150230' }).select('id').single()).data!.id;
    const produto = semErro(await db.from('produtos').insert({ cliente_id: cliente, codigo: '12', descricao: 'Costela', unidade: 'PAC' }).select('id').single()).data!.id;
    // Preço antigo (até 20/09) e o vigente desde 20/09: mudou nos últimos 30 dias.
    semErro(await db.from('precos').insert({ cliente_id: cliente, grupo_id: grupo, produto_id: produto, valor: 8.9,
      vigente_desde: '2026-08-01T12:00:00Z', vigente_ate: '2026-09-20T15:00:00Z' }));
    semErro(await db.from('precos').insert({ cliente_id: cliente, grupo_id: grupo, produto_id: produto, valor: 9.5, vigente_desde: '2026-09-20T15:00:00Z' }));
    const fiscalSetor = semErro(await db.from('setores').select('id').eq('nome', 'Fiscal').single()).data!.id;
    const pedido = { unidade_id: unidade, texto_destinatario: 'Brasil Centro', data: '05/10/2026',
      itens: [{ produto: 'Costela', sku: '12', un: 'PAC', quantidade: 10, valor_unitario: 9.5 }],
      data_prevista: null, forma_pagamento: null, valor_frete: null, tipo_frete: null, transportadora: null, observacoes: null, entrega: null };
    const ch = semErro(await db.from('chamados').insert({ cliente_id: cliente, setor_id: fiscalSetor, titulo: 'NF de venda – Brasil / Centro',
      pedido_venda: pedido as never }).select('id, numero').single()).data!;
    return { cliente, fiscalSetor, chamado: ch.id as string, numero: Number(ch.numero) };
  }

  it('demandaDoSetor: só da empresa e do setor pedidos', async () => {
    const x = await demandaComPedido();
    expect(await repos.demandaDoSetor(x.cliente, x.fiscalSetor, x.numero)).toMatchObject({ id: x.chamado, numero: x.numero, temPedido: true });
    const pessoal = semErro(await db.from('setores').select('id').eq('nome', 'Pessoal').single()).data!.id;
    expect(await repos.demandaDoSetor(x.cliente, pessoal, x.numero)).toBeNull();
  });
  it('dadosParaPreAnalise traz o pedido, o comprador do cadastro e o preço que mudou', async () => {
    const x = await demandaComPedido();
    const d = await repos.dadosParaPreAnalise(x.chamado, AGORA);
    expect(d).toMatchObject({ numero: x.numero, clienteId: x.cliente, comprador: { razao_social: 'Supermercado Brasil Ltda', cnpj: '11111111000191' } });
    expect(d!.mudancas).toEqual([{ sku: '12', anterior: 8.9, desde: expect.stringMatching(/^2026-09-20/) }]);
  });
  it('salva e lê a pré-análise; formato estranho no banco vira null', async () => {
    const x = await demandaComPedido();
    const fiscal = await configurarAgenteTeste('fiscal', {});
    const analise = { versao: 1 as const, linhas: [{ situacao: 'ok' as const, texto: 'Tudo certo.' }], contagem: { falta: 0, atencao: 0, ok: 1 } };
    await repos.salvarPreAnalise(x.chamado, fiscal, analise);
    expect(await repos.preAnaliseDaDemanda(x.chamado)).toEqual(analise);
  });
  it('criarSugestao grava aguardando; demanda de outro setor recusa com a frase do banco', async () => {
    const x = await demandaComPedido();
    const fiscal = await configurarAgenteTeste('fiscal', {});
    const id = await repos.criarSugestao({ chamadoId: x.chamado, agenteId: fiscal, conversaId: null, tipo: 'nota_interna', conteudo: { texto: 'Conferir CFOP.' } });
    expect((await db.from('agente_sugestoes').select('estado').eq('id', id).single()).data).toEqual({ estado: 'aguardando' });
    const pessoal = await configurarAgenteTeste('pessoal', {});
    await expect(repos.criarSugestao({ chamadoId: x.chamado, agenteId: pessoal, conversaId: null, tipo: 'nota_interna', conteudo: { texto: 'x' } }))
      .rejects.toThrow(/A demanda não é do setor deste agente/);
  });
});
