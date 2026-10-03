import { describe, expect, it } from 'vitest';
import { aplicarFiltrosDemandas, type ConsultaFiltravel } from './demandas-consulta';
import { lerFiltrosDemandas } from './demandas';

/** Grava as chamadas, como o construtor do PostgREST receberia. */
class Gravador implements ConsultaFiltravel<Gravador> {
  chamadas: string[] = [];
  private g(t: string) { this.chamadas.push(t); return this; }
  is(c: string, v: boolean | null) { return this.g(`is ${c} ${v}`); }
  eq(c: string, v: string) { return this.g(`eq ${c} ${v}`); }
  in(c: string, v: readonly string[]) { return this.g(`in ${c} ${v.join('|')}`); }
  gte(c: string, v: string) { return this.g(`gte ${c} ${v}`); }
  lt(c: string, v: string) { return this.g(`lt ${c} ${v}`); }
  or(f: string) { return this.g(`or ${f}`); }
}
const ID = '3f2b8c1e-5d4a-4e7b-9c1f-2a3b4c5d6e7f';
const EU = '11111111-1111-4111-8111-111111111111';
// 08/10/2026 10:00 em Brasília
const AGORA = new Date('2026-10-08T13:00:00Z');
const chamadas = (params: Record<string, string>, opcoes?: { semStatus?: boolean }) =>
  aplicarFiltrosDemandas(new Gravador(), lerFiltrosDemandas(params, EU), EU, AGORA, opcoes).chamadas;

describe('aplicarFiltrosDemandas', () => {
  it('padrão: só as três abertas', () => {
    expect(chamadas({})).toEqual(['in status aberto|em_andamento|aguardando_cliente']);
  });
  it('o quadro não filtra status (as colunas já são os status)', () => {
    expect(chamadas({ status: 'concluido' }, { semStatus: true })).toEqual([]);
  });
  it('todos os filtros juntos, como a tabela e o CSV usam', () => {
    expect(chamadas({ setor: ID, status: 'concluido', origem: 'agente', vencidas: '1', prazo: 'hoje', responsavel: 'eu', prioridade: 'alta',
      tipo: 'venda', periodo: 'hoje' })).toEqual([
      `eq setor_id ${ID}`,
      'in status concluido',
      'in origem agente|sistema',
      'is vencida true',
      'gte prazo_em 2026-10-08T03:00:00.000Z',
      'lt prazo_em 2026-10-09T03:00:00.000Z',
      `eq responsavel_id ${EU}`,
      'eq prioridade alta',
      'is tem_pedido true',
      'gte criado_em 2026-10-08T03:00:00.000Z',
    ]);
  });
  it('triagem, da equipe, sem responsável, outras', () => {
    expect(chamadas({ setor: 'triagem', origem: 'equipe', responsavel: 'sem', tipo: 'outras' })).toEqual([
      'is setor_id null', 'in status aberto|em_andamento|aguardando_cliente', 'eq origem equipe', 'is responsavel_id null', 'is tem_pedido false',
    ]);
  });
  it('busca: número exato ou texto no título, na descrição e na empresa; vírgula e parênteses não quebram o filtro', () => {
    expect(chamadas({ q: '#1042' }).at(-1)).toBe('or numero.eq.1042,titulo.ilike.%1042%,resumo.ilike.%1042%,empresa.ilike.%1042%');
    expect(chamadas({ q: 'bom preço, (centro)' }).at(-1)).toBe('or titulo.ilike.%bom preço centro%,resumo.ilike.%bom preço centro%,empresa.ilike.%bom preço centro%');
    expect(chamadas({ q: 'a' })).toEqual(['in status aberto|em_andamento|aguardando_cliente']);
  });
});
