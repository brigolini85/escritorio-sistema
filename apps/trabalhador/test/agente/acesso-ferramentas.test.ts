import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { acessoTotal } from '../../src/agente/acesso';
import { carregarContexto } from '../../src/agente/contexto';
import { AVISOS, executarFerramenta, type EstadoExecucao } from '../../src/agente/ferramentas';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { contatoComEmpresas, criarCadastrosExemplo, db, definirAcessoTeste, repos, setorId } from '../apoio/cenario';
import { IaRoteirizada } from '../apoio/ia-roteirizada';

// Parte H2 (spec 7D.2, D10): o filtro de acesso está no código das ferramentas, não no prompt. Sem modelo: as ferramentas
// são chamadas direto. A Carla é Compras/Vendas (só Fiscal) na Indústria X e Básico na Indústria Y.
const SEGUNDA_10H = new Date('2026-09-28T13:00:00Z');
let canal: CanalFalso;
let estado: EstadoExecucao;
let x: string;
let y: string;
let contato: string;
const d = () => ({ repos, ia: new IaRoteirizada([]), envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) } });
const usar = async (nome: string, entrada: object) => {
  const r = await executarFerramenta(d(), estado, nome, entrada);
  return { ...JSON.parse(r.resultado), _erro: r.erro };
};
const doc = async (clienteId: string, nome: string, setor: string | null, temValores = false) =>
  (await db.from('documentos_empresa').insert({ cliente_id: clienteId, nome, arquivo_path: `clientes/${clienteId}/${nome}.pdf`, arquivo_nome: `${nome}.pdf`,
    ia_pode_enviar: true, setor_id: setor ? await setorId(setor) : null, tem_valores: temValores }).select('id').single()).data!.id;
const focar = async (clienteId: string) => { await usar('selecionar_empresa', { cliente_id: clienteId }); };

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  const r = await contatoComEmpresas(['Indústria X', 'Indústria Y'], '5531999990001',
    { perfil: 'compras_vendas', setores: ['Fiscal'], procurado: ['Fiscal'], podePedirNota: true, podeAtualizarPreco: true, receberDocumentos: true });
  [x, y] = [r.empresas[0]!.id, r.empresas[1]!.id];
  contato = r.contato.id;
  await definirAcessoTeste(contato, y, { perfil: 'basico' });
  const ctx = await carregarContexto(repos, r.conversa, await repos.buscarContato(r.conversa.telefone), await repos.obterConfiguracoes(), SEGUNDA_10H);
  estado = { ctx, respondeu: false };
  await focar(x);
});

describe('com setores (Compras/Vendas, só Fiscal)', () => {
  it('listar_documentos: o do Fiscal e o da empresa; nada do Pessoal', async () => {
    await doc(x, 'Contrato social', null);
    await doc(x, 'Certidão negativa', 'Fiscal');
    await doc(x, 'Folha de setembro', 'Pessoal', true);
    expect((await usar('listar_documentos', {})).documentos.map((x: { nome: string }) => x.nome)).toEqual(['Certidão negativa', 'Contrato social']);
  });
  it('enviar_documento de fora do acesso: "não encontrado" e nada sai', async () => {
    const folha = await doc(x, 'Folha de setembro', 'Pessoal', true);
    const r = await usar('enviar_documento', { documento_id: folha });
    expect(r).toEqual({ erro: AVISOS.documentoNaoEncontrado, _erro: true });
    expect(canal.enviados).toEqual([]);
  });
  it('consultar_chamados: só as do Fiscal', async () => {
    await db.from('chamados').insert([
      { cliente_id: x, setor_id: await setorId('Fiscal'), titulo: 'Guia do DAS' },
      { cliente_id: x, setor_id: await setorId('Pessoal'), titulo: 'Admissão do João' },
    ]);
    expect((await usar('consultar_chamados', {})).chamados.map((c: { titulo: string }) => c.titulo)).toEqual(['Guia do DAS']);
  });
  it('consultar_cadastro da empresa continua', async () => {
    expect((await usar('consultar_cadastro', {})).empresa.razao_social).toBe('Indústria X');
  });
  it('mudança no painel vale na hora (lido a cada ferramenta)', async () => {
    await doc(x, 'Certidão negativa', 'Fiscal');
    await definirAcessoTeste(contato, x, { perfil: 'rh_dp', setores: ['Pessoal'], receberDocumentos: true, verValores: true });
    expect((await usar('listar_documentos', {})).documentos).toEqual([]);
  });
  it('fluxo de nota liberado (pode pedir nota)', async () => {
    await criarCadastrosExemplo(x);
    expect((await usar('buscar_produtos', { textos: ['costela'] })).resultados[0].candidatos).toHaveLength(1);
  });
  it('sem nota e sem Fiscal: o fluxo de nota vira instrução (D10)', async () => {
    await criarCadastrosExemplo(x);
    await definirAcessoTeste(contato, x, { perfil: 'rh_dp', setores: ['Pessoal'], podePedirNota: false });
    expect(await usar('buscar_produtos', { textos: ['costela'] })).toEqual({ instrucao: AVISOS.semFluxoNota, _erro: false });
    expect(await usar('consultar_cadastro', { unidade_id: '00000000-0000-0000-0000-000000000000' })).toEqual({ instrucao: AVISOS.semFluxoNota, _erro: false });
  });
});

describe('Básico (a mesma Carla na Indústria Y)', () => {
  beforeEach(async () => { await focar(y); });
  it('não lê demandas, documentos nem cadastro; recebe a instrução', async () => {
    await db.from('chamados').insert({ cliente_id: y, setor_id: await setorId('Fiscal'), titulo: 'Guia da Y' });
    const contrato = await doc(y, 'Contrato social', null);
    expect(await usar('consultar_chamados', {})).toEqual({ chamados: [], instrucao: AVISOS.basicoSemConsulta, _erro: false });
    expect(await usar('listar_documentos', {})).toEqual({ documentos: [], instrucao: AVISOS.basicoSemDocumentos, _erro: false });
    expect(await usar('enviar_documento', { documento_id: contrato })).toEqual({ enviado: false, instrucao: AVISOS.basicoSemDocumentos, _erro: false });
    expect(await usar('consultar_cadastro', {})).toEqual({ instrucao: AVISOS.basicoSemDados, _erro: false });
    expect(canal.enviados).toEqual([]);
  });
  it('abre demanda em qualquer setor, com a observação para a equipe, sem recusa nem aviso (D16)', async () => {
    const r = await usar('abrir_chamado', { setor_id: await setorId('Pessoal'), titulo: 'Folha de setembro', resumo: 'Pediu a folha.', fora_do_contrato: false, prioridade: 'normal' });
    expect(r.setor).toBe('Pessoal');
    const { data } = await db.from('chamados').select('titulo, resumo').eq('cliente_id', y).single();
    expect(data!.titulo).toBe('Folha de setembro');
    expect(data!.resumo).toContain('Contato com acesso ainda não definido (Básico)');
    expect(canal.enviados).toEqual([]);
  });
});

describe('Treinar o agente (simulação, D9)', () => {
  it('com acessoFixo, as leituras são as de sempre (acesso total)', async () => {
    await focar(y);
    await doc(y, 'Contrato social', null);
    estado.ctx.acessoFixo = acessoTotal(estado.ctx.setores);
    expect((await usar('listar_documentos', {})).documentos.map((x: { nome: string }) => x.nome)).toEqual(['Contrato social']);
  });
});

// Pendências da revisão das Tasks 1–4 (progress.md, "minor (deferred) → Task 5").
describe('sem acesso legível = Básico, nunca acesso total', () => {
  it('vínculo apagado depois de carregar o contexto (acesso_do_contato nulo): nada é lido', async () => {
    await doc(x, 'Contrato social', null);
    await db.from('chamados').insert({ cliente_id: x, setor_id: await setorId('Fiscal'), titulo: 'Guia do DAS' });
    await db.from('contato_clientes').delete().eq('contato_id', contato).eq('cliente_id', x);
    expect(await usar('listar_documentos', {})).toEqual({ documentos: [], instrucao: AVISOS.basicoSemDocumentos, _erro: false });
    expect(await usar('consultar_chamados', {})).toEqual({ chamados: [], instrucao: AVISOS.basicoSemConsulta, _erro: false });
    expect(await usar('consultar_cadastro', {})).toEqual({ instrucao: AVISOS.basicoSemDados, _erro: false });
  });
  it('erro ao ler o acesso: nega como Básico', async () => {
    await doc(x, 'Contrato social', null);
    const quebrado = { ...repos, acessoDoContato: async () => { throw new Error('acessoDoContato: falha de rede'); } };
    const r = await executarFerramenta({ ...d(), repos: quebrado }, estado, 'listar_documentos', {});
    expect(JSON.parse(r.resultado)).toEqual({ documentos: [], instrucao: AVISOS.basicoSemDocumentos });
    const nota = await executarFerramenta({ ...d(), repos: quebrado }, estado, 'buscar_produtos', { textos: ['costela'] });
    expect(JSON.parse(nota.resultado)).toEqual({ instrucao: AVISOS.semFluxoNota });
  });
});

describe('documento e demanda dentro do acesso', () => {
  it('enviar_documento continua conferindo "IA pode enviar"', async () => {
    const certidao = await doc(x, 'Certidão negativa', 'Fiscal');
    await db.from('documentos_empresa').update({ ia_pode_enviar: false }).eq('id', certidao);
    expect(await usar('enviar_documento', { documento_id: certidao })).toEqual({ erro: AVISOS.documentoNaoLiberado, _erro: true });
    expect(canal.enviados).toEqual([]);
  });
  it('sem "Ver valores", o valor escrito no título da demanda não chega ao modelo', async () => {
    await definirAcessoTeste(contato, x, { perfil: 'personalizado', setores: ['Pessoal'], verValores: false });
    await db.from('chamados').insert({ cliente_id: x, setor_id: await setorId('Pessoal'), titulo: 'Folha de setembro R$ 12.345,67' });
    expect((await usar('consultar_chamados', {})).chamados.map((c: { titulo: string }) => c.titulo)).toEqual(['Folha de setembro R$ …']);
    await definirAcessoTeste(contato, x, { perfil: 'rh_dp', setores: ['Pessoal'], verValores: true });
    expect((await usar('consultar_chamados', {})).chamados.map((c: { titulo: string }) => c.titulo)).toEqual(['Folha de setembro R$ 12.345,67']);
  });
});
