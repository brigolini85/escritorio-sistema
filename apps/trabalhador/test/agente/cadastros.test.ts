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
