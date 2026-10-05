import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configurarAgenteTeste, limparBanco } from '@escritorio/db/teste';
import { carregarContexto } from '../../src/agente/contexto';
import { AVISOS_SETOR, executarFerramenta, type EstadoExecucao } from '../../src/agente/ferramentas';
import { preAnaliseNaAbertura } from '../../src/agente/pre-analise';
import { AVISOS_AGENTE } from '../../src/agente/roteamento';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { contatoComEmpresas, criarCadastrosExemplo, db, definirAcessoTeste, repos, setorId, type CadastrosExemplo } from '../apoio/cenario';
import { IaRoteirizada } from '../apoio/ia-roteirizada';

// Parte I2 (D8, D9): as ferramentas do agente do setor e a pré-análise, com o banco de verdade.
const AGORA = new Date('2026-10-05T13:00:00Z');
const TEL = '5531999990001';
let canal: CanalFalso;
let empresa: string;
let contato: string;
let cad: CadastrosExemplo;
let fiscal: string;
const deps = () => ({ repos, ia: new IaRoteirizada([]), envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) } });
const semErro = <T extends { error: { message: string } | null }>(r: T): T => { if (r.error) throw new Error(r.error.message); return r; };
const PEDIDO = (unidade: string) => ({ unidade_id: unidade, texto_destinatario: 'Brasil Santa Efigênia', data: '05/10/2026',
  itens: [{ produto: 'Costela com Requeijão', sku: '12', un: 'PAC', quantidade: 10, valor_unitario: 9.5 }],
  data_prevista: null, forma_pagamento: null, valor_frete: null, tipo_frete: null, transportadora: null, observacoes: null, entrega: null });

async function demanda(setor: string, titulo: string, pedido: unknown = null, cliente = empresa): Promise<{ id: string; numero: number }> {
  const ch = semErro(await db.from('chamados').insert({ cliente_id: cliente, setor_id: await setorId(setor), titulo, pedido_venda: pedido as never })
    .select('id, numero').single()).data!;
  return { id: ch.id, numero: Number(ch.numero) };
}
async function estadoDo(agente: 'fiscal' | 'thiago'): Promise<EstadoExecucao> {
  const ctx = await carregarContexto(repos, await repos.obterOuCriarConversa(TEL, null), await repos.buscarContato(TEL), await repos.obterConfiguracoes(), AGORA);
  return agente === 'fiscal' ? { ctx, respondeu: false, agenteSetor: ctx.agentesSetor![0], modo: 'mesma_voz' } : { ctx, respondeu: false };
}
const usar = async (estado: EstadoExecucao, nome: string, entrada: object) => {
  const r = await executarFerramenta(deps(), estado, nome, entrada);
  return { ...JSON.parse(r.resultado), _erro: r.erro };
};

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  const r = await contatoComEmpresas(['Padaria Sol'], TEL);
  empresa = r.empresas[0]!.id;
  contato = r.contato.id;
  cad = await criarCadastrosExemplo(empresa);
  fiscal = await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'mesma_voz',
    ferramentas: ['ler_demandas_setor', 'conferir_pedido_nota', 'nota_interna', 'sugerir_correcao'] });
});
afterEach(() => { vi.restoreAllMocks(); });

describe('ferramentas do setor (D8)', () => {
  it('ler_demandas_setor: só as do setor do agente', async () => {
    await demanda('Fiscal', 'Guia DAS de setembro');
    await demanda('Pessoal', 'Folha de setembro');
    const r = await usar(await estadoDo('fiscal'), 'ler_demandas_setor', {});
    expect(r.demandas.map((x: { titulo: string }) => x.titulo)).toEqual(['Guia DAS de setembro']);
  });
  it('conferir_pedido_nota: as linhas da pré-análise, calculada na hora quando não há gravada', async () => {
    const d = await demanda('Fiscal', 'NF de venda – Brasil / Santa Efigênia', PEDIDO(cad.brasilEfigenia));
    const r = await usar(await estadoDo('fiscal'), 'conferir_pedido_nota', { numero: d.numero });
    expect(r.linhas).toContain('OK: Destinatário: Supermercado Brasil Ltda · CNPJ 11.111.111/0001-91.');
    expect(r.resumo).toMatch(/OK/);
  });
  it('demanda de outra empresa ou de outro setor: não encontrada', async () => {
    const outra = semErro(await db.from('clientes').insert({ razao_social: 'Outra', cnpj: '99888777000166' }).select('id').single()).data!.id;
    const deOutra = await demanda('Fiscal', 'NF de outra', PEDIDO(cad.brasilEfigenia), outra);
    const doPessoal = await demanda('Pessoal', 'Folha');
    const e = await estadoDo('fiscal');
    expect(await usar(e, 'conferir_pedido_nota', { numero: deOutra.numero })).toMatchObject({ _erro: true, erro: AVISOS_SETOR.demandaNaoEncontrada });
    expect(await usar(e, 'nota_interna', { numero: doPessoal.numero, texto: 'x' })).toMatchObject({ _erro: true, erro: AVISOS_SETOR.demandaNaoEncontrada });
  });
  it('nota_interna e sugerir_correcao: viram sugestão aguardando, com a decisão do agente', async () => {
    const d = await demanda('Fiscal', 'NF de venda – Brasil / Santa Efigênia', PEDIDO(cad.brasilEfigenia));
    const e = await estadoDo('fiscal');
    expect(await usar(e, 'nota_interna', { numero: d.numero, texto: 'Conferir o CFOP 5.405.' })).toMatchObject({ sugestao: 'aguardando aprovação' });
    await usar(e, 'sugerir_correcao', { numero: d.numero, campo: 'quantidade do item 1', de: '10', para: '12', motivo: 'o cliente corrigiu' });
    const { data } = await db.from('agente_sugestoes').select('tipo, estado, agente_id').order('criado_em');
    expect(data).toEqual([{ tipo: 'nota_interna', estado: 'aguardando', agente_id: fiscal }, { tipo: 'correcao', estado: 'aguardando', agente_id: fiscal }]);
    const { data: dec } = await db.from('decisoes_agente').select('etapa, agente_id').eq('etapa', 'nota_interna');
    expect(dec).toEqual([{ etapa: 'nota_interna', agente_id: fiscal }]);
    expect(await db.from('chamado_eventos').select('id').eq('tipo', 'nota_interna')).toMatchObject({ data: [] });   // nada vale antes de aprovar
  });
  it('o Thiago não usa ferramenta do setor', async () => {
    expect(await usar(await estadoDo('thiago'), 'ler_demandas_setor', {})).toMatchObject({ _erro: true, erro: AVISOS_SETOR.soDoSetor });
  });
  it('F19: cada ferramenta confere de novo o acesso do contato ao setor (sem o Fiscal no acesso, nada lê nem grava)', async () => {
    const d = await demanda('Fiscal', 'NF de venda – Brasil / Santa Efigênia', PEDIDO(cad.brasilEfigenia));
    const e = await estadoDo('fiscal');
    e.acessoSetorConferido = true;   // como quando chamar_agente já conferiu: a ferramenta lê o acesso de agora
    await definirAcessoTeste(contato, empresa, { perfil: 'personalizado', setores: ['Pessoal'], verValores: true });
    for (const [nome, entrada] of [['ler_demandas_setor', {}], ['conferir_pedido_nota', { numero: d.numero }], ['nota_interna', { numero: d.numero, texto: 'x' }],
      ['sugerir_correcao', { numero: d.numero, campo: 'c', de: null, para: 'p', motivo: 'm' }]] as const) {
      expect(await usar(e, nome, entrada)).toMatchObject({ _erro: true, erro: AVISOS_AGENTE.semAcesso });
    }
    expect((await db.from('agente_sugestoes').select('id')).data).toEqual([]);
    expect(canal.enviados).toEqual([]);
  });
});

describe('pré-análise na abertura do pedido de nota (D9)', () => {
  it('com o Fiscal ativo para o contato: grava a pré-análise e a decisão do agente', async () => {
    const d = await demanda('Fiscal', 'NF de venda – Brasil / Santa Efigênia', PEDIDO(cad.brasilEfigenia));
    await preAnaliseNaAbertura(deps(), await estadoDo('thiago'), d.id, await setorId('Fiscal'));
    const { data } = await db.from('pre_analises_nota').select('agente_id, resultado').eq('chamado_id', d.id).single();
    expect(data!.agente_id).toBe(fiscal);
    expect((data!.resultado as { versao: number }).versao).toBe(1);
    expect((await db.from('decisoes_agente').select('agente_id').eq('etapa', 'pre_analise_nota')).data).toEqual([{ agente_id: fiscal }]);
  });
  it('Fiscal desligado ou sem conferir_pedido_nota: nada', async () => {
    const d = await demanda('Fiscal', 'NF de venda – Brasil / Santa Efigênia', PEDIDO(cad.brasilEfigenia));
    await configurarAgenteTeste('fiscal', { ferramentas: ['ler_demandas_setor'] });
    await preAnaliseNaAbertura(deps(), await estadoDo('thiago'), d.id, await setorId('Fiscal'));
    await configurarAgenteTeste('fiscal', { estado: 'desligado', ferramentas: ['conferir_pedido_nota'] });
    await preAnaliseNaAbertura(deps(), await estadoDo('thiago'), d.id, await setorId('Fiscal'));
    expect((await db.from('pre_analises_nota').select('id')).data).toEqual([]);
  });
  it('data inválida na conferência (diaMes do core lança): a pré-análise é pulada com log e nada quebra', async () => {
    const d = await demanda('Fiscal', 'NF de venda – Brasil / Santa Efigênia', PEDIDO(cad.brasilEfigenia));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const real = repos.dadosParaPreAnalise.bind(repos);
    const reposDataRuim = { ...repos, dadosParaPreAnalise: async (id: string, agora: Date) => {
      const x = await real(id, agora);
      return x && { ...x, mudancas: [{ sku: '12', anterior: 8, desde: 'não é data' }] };
    } };
    await expect(preAnaliseNaAbertura({ ...deps(), repos: reposDataRuim }, await estadoDo('thiago'), d.id, await setorId('Fiscal'))).resolves.toBeUndefined();
    expect((await db.from('pre_analises_nota').select('id')).data).toEqual([]);
    expect(log).toHaveBeenCalledWith('[pré-análise] não gravada', d.id, expect.any(Error));
  });
  it('o abrir_pedido_nota do Thiago chama a pré-análise (venda com o resumo conferido)', async () => {
    const e = await estadoDo('thiago');
    const pedido = { tipo: 'venda', unidade_id: cad.brasilEfigenia, texto_destinatario: 'Brasil Santa Efigênia',
      itens: [{ produto_id: cad.costela, texto: 'costela', quantidade: 10, unidade: 'PAC' }] };
    await usar(e, 'resumir_pedido_nota', pedido);
    const r = await usar(e, 'abrir_pedido_nota', { ...pedido, pedido_original: '10 costela pro Brasil', cliente_confirmou_resumo: true, prioridade: 'normal' });
    expect(r._erro).toBe(false);
    const { data } = await db.from('pre_analises_nota').select('agente_id');
    expect(data).toEqual([{ agente_id: fiscal }]);
  });
});
