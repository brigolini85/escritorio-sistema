import { randomUUID } from 'node:crypto';
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
const clienteEscreve = (texto: string) => repos.inserirMensagemEntrada({
  conversaId: estado.ctx.conversa.id, clienteId: null, tipo: 'texto', conteudo: texto, idProvedor: `ENT-${randomUUID()}`,
});

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  const { empresas, conversa } = await contatoComEmpresas(['Indústria X']);
  cad = await criarCadastrosExemplo(empresas[0]!.id);
  const contato = await repos.buscarContato(conversa.telefone);
  estado = { ctx: await carregarContexto(repos, conversa, contato, await repos.obterConfiguracoes(), SEGUNDA_10H), respondeu: false, turno: randomUUID() };
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
describe('pedido de nota: resumo para o cliente e demanda no Fiscal', () => {
  const base = (extra: object = {}) => ({
    tipo: 'venda', unidade_id: cad.brasilEfigenia, texto_destinatario: 'Brasil Santa Efigênia',
    itens: [{ produto_id: cad.costela, texto: 'costela', quantidade: 20, unidade: 'PAC' }, { produto_id: null, texto: 'lasanha', quantidade: 3, unidade: 'PAC' }],
    ...extra,
  });
  // Auditoria 1.1: a abertura recebe o resumo_id; itens e destinatário vêm do resumo.
  const abrir = (resumoId: string, extra: object = {}) => usar('abrir_pedido_nota', {
    resumo_id: resumoId, pedido_original: 'Tira NF pro Brasil Santa Efigênia: 20 PAC costela e 3 lasanha', ...extra,
  });
  const resumir = async (extra: object = {}) => {
    const r = await usar('resumir_pedido_nota', base(extra));
    expect(r._erro).toBe(false);
    return r.resumo_id as string;
  };
  /** O cliente responde ao resumo; a abertura vem na vez seguinte do agente (auditoria 1.1/5.5). */
  const clienteConfirma = async () => {
    await repos.inserirMensagemEntrada({ conversaId: estado.ctx.conversa.id, clienteId: null, tipo: 'texto', conteudo: 'sim', idProvedor: `ENT-${randomUUID()}` });
    estado.turno = randomUUID();
  };
  it('a nota leva a prioridade que o agente mandou (regra 14); sem ela, normal', async () => {
    const id1 = await resumir();
    const id2 = await resumir({ observacoes: 'segunda nota' });
    await clienteConfirma();
    expect((await abrir(id1, { prioridade: 'urgente' }))._erro).toBe(false);
    expect((await abrir(id2))._erro).toBe(false);
    const { data } = await db.from('chamados').select('prioridade, prazo_em').order('numero');
    expect(data!.map((c) => c.prioridade)).toEqual(['urgente', 'normal']);
    expect(data!.every((c) => c.prazo_em !== null)).toBe(true);
  });

  it('prioridade inválida do modelo na nota cai para normal', async () => {
    const id = await resumir();
    await clienteConfirma();
    expect((await abrir(id, { prioridade: 'enorme' }))._erro).toBe(false);
    expect((await db.from('chamados').select('prioridade').single()).data!.prioridade).toBe('normal');
  });

  /** O cliente confere o resumo e confirma: só então a demanda abre. */
  const conferirEAbrir = async (extra: object = {}) => {
    const id = await resumir(extra);
    await clienteConfirma();
    return abrir(id);
  };

  it('resumo vai ao cliente com CNPJ, código, preço e total, e não abre demanda (pedido do dono, 2026-09-29)', async () => {
    const r = await usar('resumir_pedido_nota', base({ forma_pagamento: 'PIX' }));
    expect(r).toMatchObject({ _erro: false, enviado: true });
    expect(canal.enviados).toEqual([{ telefone: '5531999990001', texto: [
      '*Nota de venda*',
      'Para: Supermercado Brasil Ltda – CNPJ 11.111.111/0001-91',
      'Endereço: Rua Salinas, 1200, loja 2 – Santa Efigênia – Belo Horizonte/MG – CEP 30150-230',
      '• 20 PAC Costela com Requeijão (cód. 12) – R$ 9,50 = R$ 190,00',
      '• 3 PAC lasanha – produto não cadastrado, a equipe confere',
      'Total: R$ 190,00 (itens sem preço de fora)',
      'Pagamento: PIX',
    ].join('\n') }]);
    expect(estado.respondeu).toBe(true);
    expect((await db.from('chamados').select('id')).data).toHaveLength(0);
  });

  it('abre a demanda no Fiscal com CNPJ, preço da tabela e item não cadastrado', async () => {
    const r = await conferirEAbrir();
    expect(r).toMatchObject({ setor: 'Fiscal', itens_sem_cadastro: 1, _erro: false });
    const { data } = await db.from('chamados').select('titulo, resumo, setores(nome), cliente_id').single();
    expect(data!.setores?.nome).toBe('Fiscal');
    expect(data!.titulo).toBe('NF de venda – Supermercado Brasil / Santa Efigênia');
    expect(data!.resumo).toContain('CNPJ 11.111.111/0001-91');
    expect(data!.resumo).toContain('20 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 190,00');
    expect(data!.resumo).toContain('3 PAC lasanha – PRODUTO NÃO CADASTRADO');
    expect(data!.resumo).toContain('Observação: contato sem permissão para pedir nota.');
  });

  // Auditoria 1.1: o caminho sem resumo_id (pedido remontado e casado com um resumo) não existe mais.
  it('trava: sem resumo_id o esquema recusa; sem resposta do cliente ao resumo, não abre a demanda', async () => {
    expect((await usar('abrir_pedido_nota', { ...base(), pedido_original: 'x', cliente_confirmou_resumo: true }))._erro).toBe(true);
    const id = await resumir();
    estado.turno = randomUUID();
    expect(JSON.stringify(await abrir(id))).toContain('sem_resposta');
    expect((await db.from('chamados').select('id')).data).toHaveLength(0);
    await clienteConfirma();
    expect((await abrir(id))._erro).toBe(false);
  });

  it('depois do "sim", vai o pedido do resumo (ids, unidade de contagem e pagamento), sem o modelo remontar (bug do dono, 2026-09-30)', async () => {
    const id = await resumir({ forma_pagamento: 'PIX' });
    await clienteConfirma();
    const r = await abrir(id);
    expect(r._erro).toBe(false);
    const { data } = await db.from('chamados').select('resumo, pedido_venda').single();
    expect(data!.resumo).toContain('20 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 190,00');
    expect(data!.pedido_venda).toMatchObject({ unidade_id: cad.brasilEfigenia, forma_pagamento: 'PIX' });
  });

  it('venda: guarda na demanda o pedido de venda para o arquivo do Bling (pedido do dono, 2026-09-29)', async () => {
    await conferirEAbrir({ forma_pagamento: 'PIX', data_prevista: '02/10/2026',
      itens: [{ produto_id: cad.costela, texto: 'costela', quantidade: 20, unidade: 'PAC' }, { produto_id: cad.frango, texto: 'frango', quantidade: 2, unidade: 'kg' },
        { produto_id: null, texto: 'lasanha', quantidade: 3, unidade: 'PAC' }],
      entrega: { endereco: 'Rua B', numero: '5', cep: '35.900-000', uf: 'mg', cidade: 'Itabira' } });
    const { data } = await db.from('chamados').select('pedido_venda').single();
    expect(data!.pedido_venda).toEqual({
      unidade_id: cad.brasilEfigenia, texto_destinatario: 'Brasil Santa Efigênia', data: '28/09/2026',
      itens: [
        { produto: 'Costela com Requeijão', sku: '12', un: 'PAC', quantidade: 20, valor_unitario: 9.5 },
        { produto: 'Frango com Requeijão', sku: '14', un: 'KG', quantidade: 2, valor_unitario: null },
        { produto: 'lasanha', sku: null, un: 'PAC', quantidade: 3, valor_unitario: null },
      ],
      data_prevista: '02/10/2026', forma_pagamento: 'PIX', valor_frete: null, tipo_frete: null, transportadora: null, observacoes: null,
      entrega: { endereco: 'Rua B', numero: '5', complemento: null, bairro: null, cidade: 'Itabira', uf: 'MG', cep: '35900000' },
    });
  });

  it('data prevista fora do formato é recusada', async () => {
    expect((await usar('resumir_pedido_nota', base({ data_prevista: 'sexta' })))._erro).toBe(true);
    expect(canal.enviados).toHaveLength(0);
  });

  it('recusa unidade de fornecedor num pedido de venda', async () => {
    expect((await usar('resumir_pedido_nota', base({ unidade_id: cad.boiBom })))._erro).toBe(true);
    expect(canal.enviados).toHaveLength(0);
  });

  it('recusa produto de outra empresa', async () => {
    const { data: y } = await db.from('clientes').insert({ razao_social: 'Indústria Y', cnpj: '99888777000166' }).select().single();
    const { data: alheio } = await db.from('produtos').insert({ cliente_id: y!.id, codigo: '1', descricao: 'Alheio' }).select().single();
    const r = await usar('resumir_pedido_nota', base({ itens: [{ produto_id: alheio!.id, texto: 'alheio', quantidade: 1, unidade: 'UN' }] }));
    expect(r._erro).toBe(true);
    expect(canal.enviados).toHaveLength(0);
  });

  it('devolução para fornecedor, sem preço', async () => {
    const r = await conferirEAbrir({ tipo: 'devolucao', unidade_id: cad.boiBom, texto_destinatario: 'Boi Bom',
      itens: [{ produto_id: cad.costela, texto: 'costela', quantidade: 3, unidade: 'PAC' }] });
    expect(r._erro).toBe(false);
    expect(canal.enviados[0]!.texto).not.toContain('R$');
    const { data } = await db.from('chamados').select('titulo, resumo').single();
    expect(data!.titulo).toBe('NF de devolução – Frigorífico Boi Bom / Matriz');
    expect(data!.resumo).not.toContain('R$');
    expect((await db.from('chamados').select('pedido_venda').single()).data!.pedido_venda).toBeNull();
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

  // Auditoria 1.2: antes, confirmado_pelo_cliente = true gravava direto; agora os dados só perguntam e o confirmacao_id aplica.
  it('alterar_preco só depois de o cliente confirmar', async () => {
    await db.from('contato_clientes').update({ pode_atualizar_preco: true }).eq('contato_id', estado.ctx.contato!.id);
    const pergunta = await usar('alterar_preco', { unidade_id: cad.brasilEfigenia, produto_id: cad.costela, novo_valor: 10 });
    expect(pergunta).toMatchObject({ _erro: false, aguardando_cliente: true });
    expect(await vigente()).toEqual({ valor: 9.5, origem: 'painel' });

    await clienteEscreve('sim');
    estado.turno = randomUUID();
    const r = await usar('alterar_preco', { confirmacao_id: pergunta.confirmacao_id });
    expect(r).toMatchObject({ _erro: false, antes: 'R$ 9,50', depois: 'R$ 10,00' });
    expect(await vigente()).toEqual({ valor: 10, origem: 'agente' });
  });
});

describe('produto pelo WhatsApp (pedido do dono, 2026-09-29)', () => {
  const lasanha = { codigo: '30', descricao: 'Lasanha Bolonhesa', unidade: 'pac', apelidos: ['lasanha'] };
  const gravado = async () => (await db.from('produtos').select('codigo, descricao, unidade, apelidos').eq('codigo', '30').maybeSingle()).data;

  it('sem a marcação "pode mudar preço" é recusado', async () => {
    const r = await usar('cadastrar_produto', lasanha);
    expect(r._erro).toBe(true);
    expect(JSON.stringify(r)).toContain('sem permissão');
    expect(await gravado()).toBeNull();
  });

  // Auditoria 1.2: os dados só perguntam ao cliente; o confirmacao_id cadastra depois da resposta dele.
  it('só cadastra depois de o cliente confirmar; depois a busca já acha', async () => {
    await db.from('contato_clientes').update({ pode_atualizar_preco: true }).eq('contato_id', estado.ctx.contato!.id);
    const pergunta = await usar('cadastrar_produto', lasanha);
    expect(pergunta).toMatchObject({ _erro: false, aguardando_cliente: true });
    expect(await gravado()).toBeNull();

    await clienteEscreve('sim');
    estado.turno = randomUUID();
    const r = await usar('cadastrar_produto', { confirmacao_id: pergunta.confirmacao_id });
    expect(r).toMatchObject({ _erro: false, codigo: '30', descricao: 'Lasanha Bolonhesa', unidade: 'PAC' });
    expect(await gravado()).toEqual({ codigo: '30', descricao: 'Lasanha Bolonhesa', unidade: 'PAC', apelidos: ['lasanha'] });
    expect((await usar('buscar_produtos', { textos: ['lasanha'] })).resultados[0].candidatos[0].codigo).toBe('30');
  });

  it('código repetido é recusado', async () => {
    await db.from('contato_clientes').update({ pode_atualizar_preco: true }).eq('contato_id', estado.ctx.contato!.id);
    const r = await usar('cadastrar_produto', { ...lasanha, codigo: '12' });
    expect(r._erro).toBe(true);
    expect(JSON.stringify(r)).toContain('Já existe');
  });
});
