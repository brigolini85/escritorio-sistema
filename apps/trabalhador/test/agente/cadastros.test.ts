import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { carregarContexto } from '../../src/agente/contexto';
import { executarFerramenta, type EstadoExecucao } from '../../src/agente/ferramentas';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { contatoComEmpresas, criarCadastrosExemplo, db, repos, type CadastrosExemplo } from '../apoio/cenario';
import { IaRoteirizada } from '../apoio/ia-roteirizada';

const SEGUNDA_10H = new Date('2026-09-28T13:00:00Z');
let canal: CanalFalso;
let cad: CadastrosExemplo;
let estado: EstadoExecucao;

const d = () => ({ repos, ia: new IaRoteirizada([]), envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) } });
const usar = async (nome: string, entrada: object) => {
  const r = await executarFerramenta(d(), estado, nome, entrada);
  return { ...JSON.parse(r.resultado), _erro: r.erro };
};

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  const { empresas, conversa } = await contatoComEmpresas(['Indústria X']);
  cad = await criarCadastrosExemplo(empresas[0]!.id);
  const contato = await repos.buscarContato(conversa.telefone);
  estado = { ctx: await carregarContexto(repos, conversa, contato, await repos.obterConfiguracoes(), SEGUNDA_10H), respondeu: false };
});

describe('buscar_parceiros', () => {
  it('rede + bairro devolve só a unidade certa', async () => {
    const r = await usar('buscar_parceiros', { texto: 'Brasil Santa Efigênia', tipo: 'cliente' });
    expect(r.candidatos).toEqual([{ id: cad.brasilEfigenia, rede: 'Supermercado Brasil', unidade: 'Santa Efigênia', bairro: 'Santa Efigênia', cidade: 'Belo Horizonte' }]);
  });
  it('só a rede devolve todas as unidades dela', async () => {
    const r = await usar('buscar_parceiros', { texto: 'Hortsul', tipo: 'cliente' });
    expect(r.candidatos.map((c: { id: string }) => c.id).sort()).toEqual([...cad.hortsul].sort());
  });
  it('fornecedor só aparece na busca de fornecedores', async () => {
    expect((await usar('buscar_parceiros', { texto: 'Boi Bom', tipo: 'cliente' })).candidatos).toEqual([]);
    expect((await usar('buscar_parceiros', { texto: 'Boi Bom', tipo: 'fornecedor' })).candidatos[0].id).toBe(cad.boiBom);
  });
  it('não enxerga cadastros de outra empresa', async () => {
    const { data: y } = await db.from('clientes').insert({ razao_social: 'Indústria Y', cnpj: '99888777000166' }).select().single();
    const { data: g } = await db.from('parceiros_grupos').insert({ cliente_id: y!.id, tipo: 'cliente', nome: 'Mercado Sigiloso' }).select().single();
    await db.from('parceiros_unidades').insert({ cliente_id: y!.id, grupo_id: g!.id, nome_unidade: 'Centro' });
    expect((await usar('buscar_parceiros', { texto: 'Mercado Sigiloso', tipo: 'cliente' })).candidatos).toEqual([]);
  });
  it('sem empresa em foco é recusado', async () => {
    estado.ctx.empresaEmFoco = null;
    expect((await usar('buscar_parceiros', { texto: 'Brasil', tipo: 'cliente' }))._erro).toBe(true);
  });
});

describe('buscar_produtos', () => {
  it('acha por apelido e por código; o que não existe volta vazio', async () => {
    const r = await usar('buscar_produtos', { textos: ['costela', '14', 'lasanha'] });
    expect(r.resultados).toEqual([
      { texto: 'costela', candidatos: [{ id: cad.costela, codigo: '12', descricao: 'Costela com Requeijão', unidade: 'PAC' }] },
      { texto: '14', candidatos: [{ id: cad.frango, codigo: '14', descricao: 'Frango com Requeijão', unidade: 'PAC' }] },
      { texto: 'lasanha', candidatos: [] },
    ]);
  });
});
describe('abrir_pedido_nota', () => {
  const pedido = (extra: object = {}) => ({
    tipo: 'venda', unidade_id: cad.brasilEfigenia, texto_destinatario: 'Brasil Santa Efigênia',
    itens: [{ produto_id: cad.costela, texto: 'costela', quantidade: 20, unidade: 'PAC' }, { produto_id: null, texto: 'lasanha', quantidade: 3, unidade: 'PAC' }],
    pedido_original: 'Tira NF pro Brasil Santa Efigênia: 20 PAC costela e 3 lasanha', ...extra,
  });

  it('abre a demanda no Fiscal com CNPJ, preço da tabela e item não cadastrado', async () => {
    const r = await usar('abrir_pedido_nota', pedido());
    expect(r).toMatchObject({ setor: 'Fiscal', itens_sem_cadastro: 1, _erro: false });
    const { data } = await db.from('chamados').select('titulo, resumo, setores(nome), cliente_id').single();
    expect(data!.setores?.nome).toBe('Fiscal');
    expect(data!.titulo).toBe('NF de venda – Supermercado Brasil / Santa Efigênia');
    expect(data!.resumo).toContain('CNPJ 11.111.111/0001-91');
    expect(data!.resumo).toContain('20 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 190,00');
    expect(data!.resumo).toContain('3 PAC lasanha – PRODUTO NÃO CADASTRADO');
    expect(data!.resumo).toContain('Observação: contato sem permissão para pedir nota.');
  });

  it('recusa unidade de fornecedor num pedido de venda', async () => {
    expect((await usar('abrir_pedido_nota', pedido({ unidade_id: cad.boiBom })))._erro).toBe(true);
    expect((await db.from('chamados').select('id')).data).toHaveLength(0);
  });

  it('recusa produto de outra empresa', async () => {
    const { data: y } = await db.from('clientes').insert({ razao_social: 'Indústria Y', cnpj: '99888777000166' }).select().single();
    const { data: alheio } = await db.from('produtos').insert({ cliente_id: y!.id, codigo: '1', descricao: 'Alheio' }).select().single();
    const r = await usar('abrir_pedido_nota', pedido({ itens: [{ produto_id: alheio!.id, texto: 'alheio', quantidade: 1, unidade: 'UN' }] }));
    expect(r._erro).toBe(true);
  });

  it('devolução para fornecedor, sem preço', async () => {
    const r = await usar('abrir_pedido_nota', pedido({ tipo: 'devolucao', unidade_id: cad.boiBom, texto_destinatario: 'Boi Bom',
      itens: [{ produto_id: cad.costela, texto: 'costela', quantidade: 3, unidade: 'PAC' }], pedido_original: 'devolução de 3 costela pro Boi Bom' }));
    expect(r._erro).toBe(false);
    const { data } = await db.from('chamados').select('titulo, resumo').single();
    expect(data!.titulo).toBe('NF de devolução – Frigorífico Boi Bom / Matriz');
    expect(data!.resumo).not.toContain('R$');
  });
});
describe('documentos', () => {
  it('lista os documentos da empresa com a marcação de envio', async () => {
    const r = await usar('listar_documentos', {});
    expect(r.documentos).toEqual([
      { id: cad.balanco, nome: 'Balanço 2025', ia_pode_enviar: false },
      { id: cad.contrato, nome: 'Contrato social', ia_pode_enviar: true },
    ]);
  });
  it('envia o documento liberado e registra a mensagem', async () => {
    const r = await usar('enviar_documento', { documento_id: cad.contrato });
    expect(r._erro).toBe(false);
    expect(canal.enviados).toEqual([{ telefone: '5531999990001', arquivo: 'contrato-social.pdf' }]);
    const { data } = await db.from('mensagens').select('conteudo, status_envio, autor').single();
    expect(data).toEqual({ conteudo: '📎 Contrato social', status_envio: 'enviada', autor: 'agente' });
    expect(estado.respondeu).toBe(true);
  });
  it('recusa documento não liberado', async () => {
    expect((await usar('enviar_documento', { documento_id: cad.balanco }))._erro).toBe(true);
    expect(canal.enviados).toHaveLength(0);
  });
  it('recusa documento de outra empresa', async () => {
    const { data: y } = await db.from('clientes').insert({ razao_social: 'Indústria Y', cnpj: '99888777000166' }).select().single();
    const { data: doc } = await db.from('documentos_empresa').insert({ cliente_id: y!.id, nome: 'Contrato alheio', arquivo_path: `clientes/${y!.id}/x.pdf`, arquivo_nome: 'x.pdf', ia_pode_enviar: true }).select().single();
    expect((await usar('enviar_documento', { documento_id: doc!.id }))._erro).toBe(true);
    expect(canal.enviados).toHaveLength(0);
  });
});

describe('revisão final: quantidade no texto do item', () => {
  it('"20 PAC costela" não confunde o 20 com o produto de código 20', async () => {
    const r = await usar('buscar_produtos', { textos: ['20 PAC costela', '20'] });
    expect(r.resultados[0].candidatos.map((c: { id: string }) => c.id)).toEqual([cad.costela]);
    expect(r.resultados[1].candidatos.map((c: { id: string }) => c.id)).toEqual([cad.alho]);
  });
});

describe('consultar_cadastro', () => {
  it('sem unidade: dados da própria empresa do contato', async () => {
    const r = await usar('consultar_cadastro', {});
    expect(r).toMatchObject({ _erro: false, empresa: { razao_social: 'Indústria X', cnpj: '11.222.333/0001-00' } });
  });
  it('com unidade: dados do cliente cadastrado da empresa, com CNPJ e IE', async () => {
    const r = await usar('consultar_cadastro', { unidade_id: cad.brasilEfigenia });
    expect(r.parceiro).toMatchObject({ tipo: 'cliente', rede: 'Supermercado Brasil', unidade: 'Santa Efigênia', razao_social: 'Supermercado Brasil Ltda',
      cnpj: '11.111.111/0001-91', inscricao_estadual: '0012345670011', cidade: 'Belo Horizonte', uf: 'MG' });
  });
  it('unidade de outra empresa é recusada', async () => {
    const { data: y } = await db.from('clientes').insert({ razao_social: 'Indústria Y', cnpj: '99888777000166' }).select().single();
    const { data: g } = await db.from('parceiros_grupos').insert({ cliente_id: y!.id, tipo: 'cliente', nome: 'Mercado Sigiloso' }).select().single();
    const { data: u } = await db.from('parceiros_unidades').insert({ cliente_id: y!.id, grupo_id: g!.id, nome_unidade: 'Centro', cnpj: '33333333000191' }).select().single();
    const r = await usar('consultar_cadastro', { unidade_id: u!.id });
    expect(r._erro).toBe(true);
    expect(JSON.stringify(r)).not.toContain('33333333000191');
  });
  it('sem empresa em foco não informa nada', async () => {
    estado.ctx.empresaEmFoco = null;
    expect((await usar('consultar_cadastro', {}))._erro).toBe(true);
  });
});

describe('preço pelo WhatsApp (pedido do dono, 2026-09-28)', () => {
  const vigente = async () => (await db.from('precos').select('valor, origem').eq('produto_id', cad.costela).is('vigente_ate', null).single()).data;

  it('consultar_preco informa o preço da tabela da rede e avisa quando não há preço', async () => {
    const r = await usar('consultar_preco', { unidade_id: cad.brasilEfigenia, produto_id: cad.costela });
    expect(r).toMatchObject({ _erro: false, rede: 'Supermercado Brasil', produto: 'Costela com Requeijão', unidade: 'PAC', preco: 'R$ 9,50' });
    expect((await usar('consultar_preco', { unidade_id: cad.brasilEfigenia, produto_id: cad.alho })).preco).toBeNull();
  });

  it('alterar_preco sem a marcação "pode mudar preço" é recusado', async () => {
    const r = await usar('alterar_preco', { unidade_id: cad.brasilEfigenia, produto_id: cad.costela, novo_valor: 10, confirmado_pelo_cliente: true });
    expect(r._erro).toBe(true);
    expect(JSON.stringify(r)).toContain('sem permissão');
    expect(await vigente()).toEqual({ valor: 9.5, origem: 'painel' });
  });

  it('alterar_preco só depois de o cliente confirmar', async () => {
    await db.from('contato_clientes').update({ pode_atualizar_preco: true }).eq('contato_id', estado.ctx.contato!.id);
    const semConfirmar = await usar('alterar_preco', { unidade_id: cad.brasilEfigenia, produto_id: cad.costela, novo_valor: 10, confirmado_pelo_cliente: false });
    expect(semConfirmar._erro).toBe(true);
    expect(await vigente()).toEqual({ valor: 9.5, origem: 'painel' });

    const r = await usar('alterar_preco', { unidade_id: cad.brasilEfigenia, produto_id: cad.costela, novo_valor: 10, confirmado_pelo_cliente: true });
    expect(r).toMatchObject({ _erro: false, antes: 'R$ 9,50', depois: 'R$ 10,00' });
    expect(await vigente()).toEqual({ valor: 10, origem: 'agente' });
  });
});
