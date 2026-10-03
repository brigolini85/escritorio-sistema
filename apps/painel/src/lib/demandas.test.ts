import { describe, expect, it } from 'vitest';
import {
  STATUS_PADRAO, etiquetasFiltros, iniciais, inicioDoDiaSP, inicioDoPeriodo, lerFiltrosDemandas, opcoesResponsavel, statusAoAlternar, temFiltro,
} from './demandas';

const ID = '3f2b8c1e-5d4a-4e7b-9c1f-2a3b4c5d6e7f';

describe('lerFiltrosDemandas', () => {
  it('sem parâmetros: todos os setores, as três abertas, nenhum outro filtro', () => {
    expect(lerFiltrosDemandas({})).toEqual({
      setor: 'todos', status: STATUS_PADRAO, origem: null, vencidas: false, prazoHoje: false, responsavel: null,
      prioridade: null, tipo: null, periodo: null, q: null, demanda: null, nova: false,
    });
  });
  it('setor mantém a semântica antiga (todos | triagem | id)', () => {
    expect(lerFiltrosDemandas({ setor: 'triagem' }).setor).toBe('triagem');
    expect(lerFiltrosDemandas({ setor: ID }).setor).toBe(ID);
    expect(lerFiltrosDemandas({ setor: "x' or 1=1" }).setor).toBe('todos');
  });
  it('status em lista, na ordem dos botões; lixo ou vazio volta ao padrão; ?status=concluido antigo continua valendo', () => {
    expect(lerFiltrosDemandas({ status: 'aguardando_cliente,aberto' }).status).toEqual(['aberto', 'aguardando_cliente']);
    expect(lerFiltrosDemandas({ status: 'concluido' }).status).toEqual(['concluido']);
    expect(lerFiltrosDemandas({ status: 'fechado' }).status).toEqual(STATUS_PADRAO);
    expect(lerFiltrosDemandas({ status: '' }).status).toEqual(STATUS_PADRAO);
  });
  it('lê os outros filtros e ignora valores estranhos', () => {
    const f = lerFiltrosDemandas({ origem: 'equipe', vencidas: '1', prazo: 'hoje', responsavel: 'sem', prioridade: 'urgente', tipo: 'venda',
      periodo: '7d', q: '  guia  ', demanda: ID, nova: '1' });
    expect(f).toMatchObject({ origem: 'equipe', vencidas: true, prazoHoje: true, responsavel: 'sem', prioridade: 'urgente', tipo: 'venda',
      periodo: '7d', q: 'guia', demanda: ID, nova: true });
    expect(lerFiltrosDemandas({ origem: 'x', vencidas: 'sim', prazo: 'ontem', responsavel: 'fulano', prioridade: 'maxima', q: '   ' }))
      .toMatchObject({ origem: null, vencidas: false, prazoHoje: false, responsavel: null, prioridade: null, q: null });
    expect(lerFiltrosDemandas({ responsavel: ID }, ID).responsavel).toBe('eu');
    expect(lerFiltrosDemandas({ q: 'x'.repeat(200) }).q).toHaveLength(80);
  });
});

describe('botões de status', () => {
  it('alternar um status monta a lista; voltar ao padrão ou esvaziar tira o parâmetro', () => {
    expect(statusAoAlternar(STATUS_PADRAO, 'concluido')).toBe('aberto,em_andamento,aguardando_cliente,concluido');
    expect(statusAoAlternar(STATUS_PADRAO, 'aberto')).toBe('em_andamento,aguardando_cliente');
    expect(statusAoAlternar(['em_andamento', 'aguardando_cliente'], 'aberto')).toBeNull();
    expect(statusAoAlternar(['concluido'], 'concluido')).toBeNull();
  });
  it('temFiltro: só o padrão não conta', () => {
    expect(temFiltro(lerFiltrosDemandas({}))).toBe(false);
    expect(temFiltro(lerFiltrosDemandas({ status: 'concluido' }))).toBe(true);
    expect(temFiltro(lerFiltrosDemandas({ q: 'guia' }))).toBe(true);
  });
});

describe('etiquetasFiltros (imagem 03: "Setor: Fiscal ×")', () => {
  it('uma etiqueta por filtro avançado, com o nome legível', () => {
    const f = lerFiltrosDemandas({ setor: ID, responsavel: 'eu', prioridade: 'alta', tipo: 'venda', periodo: '30d', prazo: 'hoje' });
    expect(etiquetasFiltros(f, { setores: [{ id: ID, nome: 'Fiscal' }], pessoas: [] })).toEqual([
      { param: 'setor', rotulo: 'Setor: Fiscal' },
      { param: 'responsavel', rotulo: 'Responsável: eu' },
      { param: 'prioridade', rotulo: 'Prioridade: Alta' },
      { param: 'tipo', rotulo: 'Tipo: Pedido de nota (venda)' },
      { param: 'periodo', rotulo: 'Aberta: Últimos 30 dias' },
      { param: 'prazo', rotulo: 'Prazo: vence hoje' },
    ]);
  });
  it('pessoa arquivada aparece como "(arquivado)"; sem responsável, "ninguém"', () => {
    const pessoas = [{ id: ID, nome: 'Zé', ativo: false }];
    expect(etiquetasFiltros(lerFiltrosDemandas({ responsavel: ID }), { setores: [], pessoas })).toEqual([{ param: 'responsavel', rotulo: 'Responsável: Zé (arquivado)' }]);
    expect(etiquetasFiltros(lerFiltrosDemandas({ responsavel: 'sem' }), { setores: [], pessoas })).toEqual([{ param: 'responsavel', rotulo: 'Responsável: ninguém' }]);
  });
});

describe('iniciais (avatar do quadro)', () => {
  it('primeira e última palavra; uma palavra só, duas letras', () => {
    expect(iniciais('Ana Paula Nunes')).toBe('AN');
    expect(iniciais('Ana')).toBe('AN');
    expect(iniciais('  ')).toBe('?');
  });
});

describe('período', () => {
  // 30/09/2026 01:30 em Brasília = 04:30 UTC
  const agora = new Date('2026-09-30T04:30:00Z');
  it('hoje começa à meia-noite de Brasília', () => {
    expect(inicioDoDiaSP(agora).toISOString()).toBe('2026-09-30T03:00:00.000Z');
    expect(inicioDoPeriodo('hoje', agora)).toBe('2026-09-30T03:00:00.000Z');
    expect(inicioDoDiaSP(new Date('2026-09-30T02:30:00Z')).toISOString()).toBe('2026-09-29T03:00:00.000Z');
  });
  it('7 e 30 dias contam para trás a partir de agora; sem período, null', () => {
    expect(inicioDoPeriodo('7d', agora)).toBe('2026-09-23T04:30:00.000Z');
    expect(inicioDoPeriodo('30d', agora)).toBe('2026-08-31T04:30:00.000Z');
    expect(inicioDoPeriodo(null, agora)).toBeNull();
  });
});

describe('opcoesResponsavel', () => {
  const pessoas = [{ id: 'eu', nome: 'Ana', ativo: true }, { id: 'bia', nome: 'Bia', ativo: true }, { id: 'ze', nome: 'Zé', ativo: false }];
  it('arquivado sai da seleção (spec 5.1); eu viro "Comigo" à parte', () => {
    expect(opcoesResponsavel(pessoas, 'eu', null)).toEqual([{ valor: 'bia', rotulo: 'Bia' }]);
  });
  it('arquivado que já está no filtro da URL aparece como "(arquivado)", nunca "(inativo)"', () => {
    expect(opcoesResponsavel(pessoas, 'eu', 'ze')).toEqual([{ valor: 'bia', rotulo: 'Bia' }, { valor: 'ze', rotulo: 'Zé (arquivado)' }]);
  });
});
