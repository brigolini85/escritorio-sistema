import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { carregarContextoAssistente } from '../../src/assistente/contexto';
import { executarFerramentaAssistente, type EstadoAssistente } from '../../src/assistente/ferramentas';
import { montarPedidoVenda } from '../../src/agente/pedido-nota';
import { CanalFalso } from '../../src/canal/falso';
import { contatoComEmpresas, criarCadastrosExemplo, repos, setorId, type CadastrosExemplo } from '../apoio/cenario';
import { IaRoteirizada } from '../apoio/ia-roteirizada';
import { criarUsuarioTeste } from '../apoio/usuario';

let cad: CadastrosExemplo;
let empresaId: string;
let fiscal: { id: string; numero: number };
let triagem: { id: string; numero: number };

async function estadoDe(usuarioId: string): Promise<EstadoAssistente> {
  const u = (await repos.obterUsuarioAssistente(usuarioId))!;
  return { ctx: await carregarContextoAssistente(repos, u, 'site', null, new Date('2026-09-29T15:00:00Z')), resposta: [], arquivo: null, csvs: [], previas: new Set(), acoes: [] };
}
const usar = async (estado: EstadoAssistente, nome: string, entrada: object) => {
  const r = await executarFerramentaAssistente({ repos, ia: new IaRoteirizada([]), canal: new CanalFalso() }, estado, nome, entrada);
  return { ...JSON.parse(r.resultado), _erro: r.erro };
};

beforeEach(async () => {
  await limparBanco();
  const { empresas } = await contatoComEmpresas(['Indústria X']);
  empresaId = empresas[0]!.id;
  cad = await criarCadastrosExemplo(empresaId);
  const unidades = await repos.unidadesDaEmpresa(empresaId, 'cliente');
  const efigenia = unidades.find((u) => u.id === cad.brasilEfigenia)!;
  const costela = (await repos.produtosDaEmpresa(empresaId)).find((p) => p.id === cad.costela)!;
  fiscal = await repos.abrirChamado({ clienteId: empresaId, conversaId: null, setorId: await setorId('Fiscal'), responsavelId: null,
    titulo: 'NF de venda – Supermercado Brasil / Santa Efigênia', resumo: 'r', foraDoContrato: false, origem: 'agente' });
  await repos.anexarPedidoVenda(fiscal.id, montarPedidoVenda({ agora: new Date('2026-09-29T15:00:00Z'), destino: efigenia, textoDestinatario: 'Brasil',
    itens: [{ produto: costela, texto: 'costela', quantidade: 10, unidade: 'PAC', preco: 9.5 }], extras: {} }));
  triagem = await repos.abrirChamado({ clienteId: empresaId, conversaId: null, setorId: null, responsavelId: null,
    titulo: 'Número desconhecido', resumo: 'segredo da triagem', foraDoContrato: false, origem: 'agente' });
});

describe('consultas do assistente (pedido do dono, 2026-09-29)', () => {
  it('admin lista todas as demandas abertas, com total do pedido', async () => {
    const e = await estadoDe(await criarUsuarioTeste({ email: 'dono@teste-consultas.local' }));
    const r = await usar(e, 'listar_demandas', { abertas: true });
    expect(r.demandas.map((d: { numero: number }) => d.numero).sort()).toEqual([fiscal.numero, triagem.numero].sort());
    expect(r.demandas.find((d: { numero: number }) => d.numero === fiscal.numero)).toMatchObject({ setor: 'Fiscal', empresa: 'Indústria X', total_pedido: 'R$ 95,00' });
  });

  it('atendente do Fiscal não vê a triagem nem consegue abrir a demanda dela', async () => {
    const e = await estadoDe(await criarUsuarioTeste({ email: 'ana@teste-consultas.local', papel: 'atendente', setores: ['Fiscal'] }));
    const r = await usar(e, 'listar_demandas', { abertas: true });
    expect(r.demandas.map((d: { numero: number }) => d.numero)).toEqual([fiscal.numero]);
    const v = await usar(e, 'ver_demanda', { numero: triagem.numero });
    expect(v._erro).toBe(true);
    expect(JSON.stringify(v)).not.toContain('segredo da triagem');
  });

  it('atendente ainda vê a demanda do setor dele com 35 mais novas de outro setor', async () => {
    const outro = await setorId('Financeiro');
    for (let i = 0; i < 35; i++) {
      await repos.abrirChamado({ clienteId: empresaId, conversaId: null, setorId: outro, responsavelId: null, titulo: `Boleto ${i}`, resumo: 'r', foraDoContrato: false, origem: 'agente' });
    }
    const e = await estadoDe(await criarUsuarioTeste({ email: 'ana@teste-consultas.local', papel: 'atendente', setores: ['Fiscal'] }));
    expect((await usar(e, 'listar_demandas', { abertas: true })).demandas.map((d: { numero: number }) => d.numero)).toEqual([fiscal.numero]);
    expect((await usar(e, 'listar_demandas', { setor: 'Fiscal' })).demandas.map((d: { numero: number }) => d.numero)).toEqual([fiscal.numero]);
    const admin = await estadoDe(await criarUsuarioTeste({ email: 'dono@teste-consultas.local' }));
    expect((await usar(admin, 'listar_demandas', {})).demandas).toHaveLength(30);
  });

  it('entradas ruins viram erro da ferramenta, sem exceção', async () => {
    const e = await estadoDe(await criarUsuarioTeste({ email: 'dono@teste-consultas.local' }));
    expect((await usar(e, 'resumo_vendas', { de: '31/02/2026', ate: '01/03/2026' }))._erro).toBe(true);
    expect((await usar(e, 'resumo_vendas', { de: '45/13/2026', ate: '01/03/2027' }))._erro).toBe(true);
    expect((await usar(e, 'consultar_preco', { cliente_id: 'Indústria X', unidade_id: cad.brasilEfigenia, produto_id: cad.costela }))._erro).toBe(true);
    const spy = vi.spyOn(repos, 'buscarEmpresas').mockRejectedValueOnce(new Error('banco caiu'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await usar(e, 'buscar_empresas', { texto: 'industria' });
    expect(r._erro).toBe(true);
    spy.mockRestore(); err.mockRestore();
  });

  it('período com data inicial depois da final é recusado', async () => {
    const e = await estadoDe(await criarUsuarioTeste({ email: 'dono@teste-consultas.local' }));
    expect(await usar(e, 'resumo_vendas', { de: '02/10/2026', ate: '01/10/2026' })).toMatchObject({ _erro: true, erro: 'A data inicial é depois da final.' });
    expect(await usar(e, 'listar_demandas', { de: '02/10/2026', ate: '01/10/2026' })).toMatchObject({ _erro: true, erro: 'A data inicial é depois da final.' });
  });

  it('nomesDasRedes: ids repetidos dão uma entrada e lista longa funciona em blocos', async () => {
    const ids = [cad.brasilEfigenia, cad.brasilEfigenia, ...Array.from({ length: 148 }, () => randomUUID())];
    const r = await repos.nomesDasRedes(ids);
    expect(Object.keys(r)).toEqual([cad.brasilEfigenia]);
    expect(r[cad.brasilEfigenia]).toBe('Supermercado Brasil');
  });

  it('ver_demanda mostra o pedido com valores, total e pendências do CSV', async () => {
    const e = await estadoDe(await criarUsuarioTeste({ email: 'dono@teste-consultas.local' }));
    const r = await usar(e, 'ver_demanda', { numero: fiscal.numero });
    expect(r).toMatchObject({ numero: fiscal.numero, status: 'aberto', setor: 'Fiscal', pedido: { total: 'R$ 95,00', pendencias_csv: [] } });
    expect(r.pedido.itens).toEqual(['10 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 95,00']);
  });

  it('busca empresa, parceiros, produtos e preço', async () => {
    const e = await estadoDe(await criarUsuarioTeste({ email: 'dono@teste-consultas.local' }));
    expect((await usar(e, 'buscar_empresas', { texto: 'industria x' })).empresas[0]).toMatchObject({ id: empresaId, nome: 'Indústria X' });
    expect((await usar(e, 'buscar_parceiros', { cliente_id: empresaId, texto: 'Brasil Santa Efigênia', tipo: 'cliente' })).candidatos[0].id).toBe(cad.brasilEfigenia);
    expect((await usar(e, 'buscar_produtos', { cliente_id: empresaId, textos: ['costela'] })).resultados[0].candidatos[0].id).toBe(cad.costela);
    expect((await usar(e, 'consultar_preco', { cliente_id: empresaId, unidade_id: cad.brasilEfigenia, produto_id: cad.costela })).preco).toBe('R$ 9,50');
    expect((await usar(e, 'dados_cadastro', { cliente_id: empresaId, unidade_id: cad.brasilEfigenia })).parceiro.cnpj).toBe('11.111.111/0001-91');
  });

  it('resumo de vendas no período, por rede', async () => {
    const e = await estadoDe(await criarUsuarioTeste({ email: 'dono@teste-consultas.local' }));
    const r = await usar(e, 'resumo_vendas', { de: '01/09/2026', ate: '31/12/2026' });
    expect(r).toMatchObject({ pedidos: 1, total: 'R$ 95,00', por_rede: [{ rede: 'Supermercado Brasil', pedidos: 1, total: 'R$ 95,00' }] });
  });
});
