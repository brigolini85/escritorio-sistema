import { describe, expect, it } from 'vitest';
import { lerNiveis } from '@escritorio/core';
import {
  agruparPorPrazo, atalhosDaMesa, detalheDaDemanda, lerDemandasMesa, ROTULOS_MESA, subtituloMinhas, textoComAgenteHoje, textoConcluidasHoje,
} from './minha-mesa';

const agora = new Date('2026-10-01T15:00:00Z'); // quinta, 12:00 em Brasília
const d = (numero: number, extra: Record<string, unknown>) => ({
  id: `id-${numero}`, numero, titulo: `D${numero}`, empresa: 'Mercado Central', setor: 'Fiscal', status: 'em_andamento',
  prioridade: 'normal', prazo_em: null, prazo_pausado_desde: null, vencida: false, ...extra,
});

describe('Minhas demandas por prazo (D11)', () => {
  it('lê as linhas da visão (números e booleanos do PostgREST)', () => {
    expect(lerDemandasMesa([{ ...d(1, {}), numero: '1031', vencida: null }])[0]).toMatchObject({ numero: 1031, vencida: false });
    expect(lerDemandasMesa(null)).toEqual([]);
  });
  it('Vencida · Vencem hoje · Próximos dias; pausada e sem prazo vão para Próximos dias', () => {
    const lista = lerDemandasMesa([
      d(1, { vencida: true, prazo_em: '2026-09-30T21:00:00Z' }),
      d(2, { prazo_em: '2026-10-01T20:00:00Z' }),                                                    // hoje 17h
      d(3, { prazo_em: '2026-10-01T13:00:00Z', vencida: true }),                                    // hoje 10h, já venceu
      d(4, { prazo_em: '2026-09-30T21:00:00Z', status: 'aguardando_cliente', prazo_pausado_desde: '2026-09-29T12:00:00Z' }),
      d(5, { prazo_em: '2026-10-05T21:00:00Z' }),
      d(6, {}),
    ]);
    const g = agruparPorPrazo(lista, agora);
    expect(g.vencidas.map((x) => x.numero)).toEqual([1, 3]);
    expect(g.hoje.map((x) => x.numero)).toEqual([2]);
    expect(g.proximos.map((x) => x.numero)).toEqual([4, 5, 6]);
  });
  it('linha: empresa, setor e status com nome da tela', () => {
    expect(detalheDaDemanda({ empresa: 'Rede Bom Preço', setor: 'Fiscal', status: 'em_andamento' })).toEqual(['Rede Bom Preço', 'Fiscal', 'resolvendo']);
    expect(detalheDaDemanda({ empresa: null, setor: null, status: 'aguardando_cliente' })).toEqual(['sem empresa', 'Triagem', 'com o cliente']);
    expect(detalheDaDemanda({ empresa: 'X', setor: 'Pessoal', status: 'aberto' })[2]).toBe('nova');
  });
});

describe('textos', () => {
  it('singular e plural', () => {
    expect(ROTULOS_MESA.esperando(1)).toBe('conversa esperando você');
    expect(ROTULOS_MESA.esperando(2)).toBe('conversas esperando você');
    expect(ROTULOS_MESA.vencidas(1)).toBe('minha demanda vencida');
    expect(ROTULOS_MESA.vencidas(0)).toBe('minhas demandas vencidas');
    expect(ROTULOS_MESA.hoje(1)).toBe('vence hoje');
    expect(ROTULOS_MESA.hoje(3)).toBe('vencem hoje');
    expect(ROTULOS_MESA.semResponsavel(3)).toBe('sem responsável nos meus setores');
    expect(textoConcluidasHoje(0)).toBe('Você ainda não concluiu demandas hoje.');
    expect(textoConcluidasHoje(1)).toBe('Você concluiu 1 demanda hoje.');
    expect(textoConcluidasHoje(4)).toBe('Você concluiu 4 demandas hoje.');
    expect(textoComAgenteHoje(0)).toBe('nenhuma com o agente hoje');
    expect(textoComAgenteHoje(12)).toBe('12 com o agente hoje');
    expect(subtituloMinhas(8)).toBe('8 comigo · ordenadas pelo que vence primeiro');
  });
});

describe('atalhos pela permissão (D17)', () => {
  const pessoa = (niveis: Record<string, string>) => ({ papel: 'atendente' as const, niveis: lerNiveis(niveis) });
  it('sem nada além do padrão: nada que leve a "sem acesso"', () => {
    const r = atalhosDaMesa(pessoa({ notas: 'sem_acesso', assistente: 'sem_acesso', configuracoes: 'nao' })).map((a) => a.rotulo);
    expect(r).toEqual(['Nova demanda', 'Buscar empresa', 'Contatos']);
  });
  it('com assistente, pedidos de nota e Configurações: os seis', () => {
    const r = atalhosDaMesa(pessoa({ notas: 'ver', assistente: 'site', configuracoes: 'sim' }));
    expect(r.map((a) => a.rotulo)).toEqual(['Nova demanda', 'Buscar empresa', 'Respostas prontas', 'Assistente', 'Pedidos de nota', 'Contatos']);
    expect(r.find((a) => a.rotulo === 'Respostas prontas')!.href).toBe('/configuracoes?secao=respostas');
    expect(r.find((a) => a.rotulo === 'Pedidos de nota')!.href).toBe('/demandas?tipo=venda');
  });
});
