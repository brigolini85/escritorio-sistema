import { describe, expect, it } from 'vitest';
import { inicioDoDiaSP, inicioDoPeriodo, lerFiltrosDemandas, temFiltroAlemDoSetor } from './demandas';

const ID = '3f2b8c1e-5d4a-4e7b-9c1f-2a3b4c5d6e7f';

describe('lerFiltrosDemandas', () => {
  it('sem parâmetros: todos os setores, só não concluídas (nenhum filtro novo)', () => {
    expect(lerFiltrosDemandas({})).toEqual({ setor: 'todos', status: null, responsavel: null, tipo: null, periodo: null, demanda: null });
  });
  it('setor mantém a semântica antiga (todos | triagem | id)', () => {
    expect(lerFiltrosDemandas({ setor: 'triagem' }).setor).toBe('triagem');
    expect(lerFiltrosDemandas({ setor: ID }).setor).toBe(ID);
    expect(lerFiltrosDemandas({ setor: 'todos' }).setor).toBe('todos');
    expect(lerFiltrosDemandas({ setor: "x' or 1=1" }).setor).toBe('todos');
  });
  it('lê os filtros novos e ignora valores estranhos', () => {
    const f = lerFiltrosDemandas({ status: 'concluido', responsavel: 'sem', tipo: 'venda', periodo: '7d', demanda: ID });
    expect(f).toMatchObject({ status: 'concluido', responsavel: 'sem', tipo: 'venda', periodo: '7d', demanda: ID });
    expect(lerFiltrosDemandas({ status: 'fechado', responsavel: 'fulano', tipo: 'x', periodo: '1a', demanda: '12' }))
      .toMatchObject({ status: null, responsavel: null, tipo: null, periodo: null, demanda: null });
    expect(lerFiltrosDemandas({ responsavel: ['eu', 'sem'] }).responsavel).toBe('eu');
    expect(lerFiltrosDemandas({ responsavel: ID }).responsavel).toBe(ID);
  });
  it('temFiltroAlemDoSetor', () => {
    expect(temFiltroAlemDoSetor(lerFiltrosDemandas({ setor: 'triagem' }))).toBe(false);
    expect(temFiltroAlemDoSetor(lerFiltrosDemandas({ tipo: 'outras' }))).toBe(true);
  });
});

describe('período', () => {
  // 30/09/2026 01:30 em Brasília = 04:30 UTC
  const agora = new Date('2026-09-30T04:30:00Z');
  it('hoje começa à meia-noite de Brasília', () => {
    expect(inicioDoDiaSP(agora).toISOString()).toBe('2026-09-30T03:00:00.000Z');
    expect(inicioDoPeriodo('hoje', agora)).toBe('2026-09-30T03:00:00.000Z');
    // 23:30 do dia 29 em Brasília (02:30 UTC do dia 30) ainda é dia 29
    expect(inicioDoDiaSP(new Date('2026-09-30T02:30:00Z')).toISOString()).toBe('2026-09-29T03:00:00.000Z');
  });
  it('7 e 30 dias contam para trás a partir de agora; sem período, null', () => {
    expect(inicioDoPeriodo('7d', agora)).toBe('2026-09-23T04:30:00.000Z');
    expect(inicioDoPeriodo('30d', agora)).toBe('2026-08-31T04:30:00.000Z');
    expect(inicioDoPeriodo(null, agora)).toBeNull();
  });
});
