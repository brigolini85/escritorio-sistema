import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { carregarContexto } from '../../src/agente/contexto';
import { FERRAMENTAS, executarFerramenta, validarEntrada, type EstadoExecucao } from '../../src/agente/ferramentas';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { contatoComEmpresas, criarCadastrosExemplo, db, repos, type CadastrosExemplo } from '../apoio/cenario';
import { IaRoteirizada } from '../apoio/ia-roteirizada';

/**
 * Auditoria 1.1 e 5.5: o pedido de nota só abre com o resumo_id de um resumo que o cliente respondeu depois de
 * recebê-lo, numa vez seguinte, com a mesma empresa em foco, e só uma vez.
 */
const SEGUNDA_10H = new Date('2026-09-28T13:00:00Z');
let canal: CanalFalso;
let cad: CadastrosExemplo;
let estado: EstadoExecucao;
let conversaId: string;
let empresaA: string;
let empresaB: string;

const d = () => ({ repos, ia: new IaRoteirizada([]), envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) } });
const usar = async (nome: string, entrada: object) => {
  const r = await executarFerramenta(d(), estado, nome, entrada);
  return { ...JSON.parse(r.resultado), _erro: r.erro };
};
const pedidoPara = (unidade: string, texto: string, quantidade = 20) => ({
  tipo: 'venda', unidade_id: unidade, texto_destinatario: texto,
  itens: [{ produto_id: cad.costela, texto: 'costela', quantidade, unidade: 'PAC' }],
});
/** Uma vez do agente (execução): cada uma tem o seu turno. */
const novaVez = () => { estado.turno = randomUUID(); };
/** Mensagem do cliente chegando agora. */
const clienteEscreve = (texto: string) =>
  repos.inserirMensagemEntrada({ conversaId, clienteId: empresaA, tipo: 'texto', conteudo: texto, idProvedor: `ENT-${randomUUID()}` });
const resumir = async (pedido: object) => {
  const r = await usar('resumir_pedido_nota', pedido);
  expect(r._erro).toBe(false);
  expect(typeof r.resumo_id).toBe('string');
  return r.resumo_id as string;
};
const abrir = (resumoId: string, extra: object = {}) =>
  usar('abrir_pedido_nota', { resumo_id: resumoId, pedido_original: 'NF pro Brasil: 20 costela', prioridade: 'normal', ...extra });
const demandas = async () => (await db.from('chamados').select('numero, titulo, pedido_venda').order('numero')).data!;

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  const { empresas, conversa } = await contatoComEmpresas(['Indústria A', 'Indústria B']);
  empresaA = empresas[0]!.id;
  empresaB = empresas[1]!.id;
  conversaId = conversa.id;
  cad = await criarCadastrosExemplo(empresaA);
  const contato = await repos.buscarContato(conversa.telefone);
  const ctx = await carregarContexto(repos, conversa, contato, await repos.obterConfiguracoes(), SEGUNDA_10H);
  ctx.empresaEmFoco = ctx.contato!.empresas.find((e) => e.id === empresaA)!;
  estado = { ctx, respondeu: false, turno: randomUUID() };
});

describe('pedido de nota com confirmação verificável (auditoria 1.1, 5.5)', () => {
  it('(a) resumo e abertura na mesma vez: recusado, sem demanda', async () => {
    const id = await resumir(pedidoPara(cad.brasilEfigenia, 'Brasil Santa Efigênia'));
    const r = await abrir(id);
    expect(r._erro).toBe(true);
    expect(r.motivo).toBe('mesmo_turno');
    expect(await demandas()).toHaveLength(0);
  });

  it('(a2) vez seguinte, mas sem mensagem do cliente depois do resumo: recusado', async () => {
    const id = await resumir(pedidoPara(cad.brasilEfigenia, 'Brasil Santa Efigênia'));
    novaVez();
    const r = await abrir(id);
    expect(r).toMatchObject({ _erro: true, motivo: 'sem_resposta' });
    expect(await demandas()).toHaveLength(0);
  });

  it('(b) resumo, "sim" do cliente e duas aberturas: uma demanda; a segunda devolve o mesmo número', async () => {
    const id = await resumir(pedidoPara(cad.brasilEfigenia, 'Brasil Santa Efigênia'));
    await clienteEscreve('sim, é só isso');
    novaVez();
    const r1 = await abrir(id);
    expect(r1).toMatchObject({ _erro: false, setor: 'Fiscal' });
    const r2 = await abrir(id);
    expect(r2).toEqual({ numero: r1.numero, ja_aberto: true, _erro: false });
    novaVez();
    await clienteEscreve('sim, obrigado');
    expect(await abrir(id)).toEqual({ numero: r1.numero, ja_aberto: true, _erro: false });
    const ds = await demandas();
    expect(ds).toHaveLength(1);
    expect(ds[0]!.titulo).toBe('NF de venda – Supermercado Brasil / Santa Efigênia');
    expect((await db.from('pedidos_nota_resumo').select('usado_em, chamado_id').single()).data).toMatchObject({ chamado_id: expect.any(String) });
  });

  it('(c) resumo para X e cliente pede Y: só o resumo_id de X abre X; sem resumo_id o esquema recusa', async () => {
    const idX = await resumir(pedidoPara(cad.brasilEfigenia, 'Brasil Santa Efigênia'));
    await clienteEscreve('sim');
    novaVez();
    expect((await abrir(idX))._erro).toBe(false);
    // À tarde: "manda 20 costela pra Loja Y". O modelo pula o resumo e tenta abrir sem id: o esquema recusa.
    novaVez();
    await clienteEscreve('manda 20 costela pra Santa Matilde');
    const semId = await usar('abrir_pedido_nota', {
      ...pedidoPara(cad.brasilMatilde, 'Brasil Santa Matilde'), pedido_original: 'manda 20 costela pra Santa Matilde', cliente_confirmou_resumo: true, prioridade: 'normal',
    });
    expect(semId._erro).toBe(true);
    expect(semId.erro).toMatch(/Entrada inválida/);
    expect('erro' in validarEntrada('abrir_pedido_nota', { pedido_original: 'x', prioridade: 'normal' })).toBe(true);
    const def = FERRAMENTAS.find((f) => f.name === 'abrir_pedido_nota')!;
    expect(def.input_schema.required).toContain('resumo_id');
    expect(Object.keys(def.input_schema.properties!)).not.toContain('itens');
    // Com o id de X, o resumo de X já foi usado: devolve a demanda de X, não abre outra para ninguém.
    expect(await abrir(idX)).toMatchObject({ ja_aberto: true });
    const ds = await demandas();
    expect(ds).toHaveLength(1);
    expect(ds[0]!.titulo).toContain('Santa Efigênia');
  });

  it('(d) preço mudou entre o resumo e o "sim": pedido_mudou, sem demanda e sem consumir', async () => {
    const id = await resumir(pedidoPara(cad.brasilEfigenia, 'Brasil Santa Efigênia'));
    await db.from('precos').update({ valor: 11 }).eq('produto_id', cad.costela).is('vigente_ate', null);
    await clienteEscreve('sim');
    novaVez();
    const r = await abrir(id);
    expect(r).toMatchObject({ _erro: true, motivo: 'pedido_mudou' });
    expect(r.erro).toBe('Os preços ou o cadastro mudaram desde o resumo. Mande um resumo novo com resumir_pedido_nota');
    expect(await demandas()).toHaveLength(0);
    expect((await db.from('pedidos_nota_resumo').select('usado_em').single()).data!.usado_em).toBeNull();
    // Cadastro do destinatário mudou: também pede resumo novo.
    const id2 = await resumir(pedidoPara(cad.brasilEfigenia, 'Brasil Santa Efigênia'));
    await db.from('parceiros_unidades').update({ razao_social: 'Brasil Novo Ltda' }).eq('id', cad.brasilEfigenia);
    await clienteEscreve('sim');
    novaVez();
    expect(await abrir(id2)).toMatchObject({ _erro: true, motivo: 'pedido_mudou' });
    expect(await demandas()).toHaveLength(0);
  });

  it('(e) resumo com foco na empresa A e foco trocado para B: recusado', async () => {
    const id = await resumir(pedidoPara(cad.brasilEfigenia, 'Brasil Santa Efigênia'));
    await clienteEscreve('sim');
    novaVez();
    estado.ctx.empresaEmFoco = estado.ctx.contato!.empresas.find((e) => e.id === empresaB)!;
    const r = await abrir(id);
    expect(r._erro).toBe(true);
    expect(await demandas()).toHaveLength(0);
    expect((await db.from('pedidos_nota_resumo').select('usado_em').single()).data!.usado_em).toBeNull();
  });

  it('(f) a entrada que chega antes de o resumo ficar registrado como enviado não confirma', async () => {
    // O cliente escreve enquanto o resumo está saindo (a saída já foi gravada como pendente).
    const enviar = canal.enviarTexto.bind(canal);
    canal.enviarTexto = async (telefone: string, texto: string) => {
      await clienteEscreve('oi, tudo bem?');
      return enviar(telefone, texto);
    };
    const id = await resumir(pedidoPara(cad.brasilEfigenia, 'Brasil Santa Efigênia'));
    novaVez();
    expect(await abrir(id)).toMatchObject({ _erro: true, motivo: 'sem_resposta' });
    expect(await demandas()).toHaveLength(0);
    // A resposta de verdade, depois do resumo, confirma.
    await clienteEscreve('sim');
    novaVez();
    expect((await abrir(id))._erro).toBe(false);
    expect(await demandas()).toHaveLength(1);
  });

  it('vários resumos na mesma conversa: cada um com o seu id, uma abertura por resumo, cada uma para o seu destinatário', async () => {
    const id1 = await resumir(pedidoPara(cad.brasilEfigenia, 'Brasil Santa Efigênia'));
    const id2 = await resumir(pedidoPara(cad.brasilMatilde, 'Brasil Santa Matilde', 5));
    expect(id1).not.toBe(id2);
    await clienteEscreve('tudo certo, é só isso');
    novaVez();
    expect((await abrir(id2))._erro).toBe(false);
    expect((await abrir(id1))._erro).toBe(false);
    expect((await abrir(id1)).ja_aberto).toBe(true);
    const ds = await demandas();
    expect(ds.map((x) => x.titulo)).toEqual([
      'NF de venda – Supermercado Brasil / Santa Matilde', 'NF de venda – Supermercado Brasil / Santa Efigênia',
    ]);
  });

  it('itens, destinatário e entrega vêm do resumo; o que o resumo deixou vazio pode vir na abertura', async () => {
    const id = await resumir({ ...pedidoPara(cad.brasilEfigenia, 'Brasil Santa Efigênia'), forma_pagamento: 'PIX', entrega: { endereco: 'Rua B', numero: '5' } });
    await clienteEscreve('sim, entrega dia 02/10');
    novaVez();
    const r = await abrir(id, { forma_pagamento: 'Boleto', data_prevista: '02/10/2026', entrega: { endereco: 'Rua Outra' } });
    expect(r._erro).toBe(false);
    expect((await demandas())[0]!.pedido_venda).toMatchObject({
      unidade_id: cad.brasilEfigenia, forma_pagamento: 'PIX', data_prevista: '02/10/2026', entrega: { endereco: 'Rua B', numero: '5' },
      itens: [{ produto: 'Costela com Requeijão', quantidade: 20, valor_unitario: 9.5 }],
    });
  });

  it('resumo_id de outra conversa ou inventado: recusado', async () => {
    novaVez();
    expect((await abrir(randomUUID()))._erro).toBe(true);
    expect((await abrir('nao-e-um-id'))._erro).toBe(true);
    expect(await demandas()).toHaveLength(0);
  });
});
