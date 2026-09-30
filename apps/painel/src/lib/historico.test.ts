import { describe, expect, it } from 'vitest';
import { linhaDoTempo, rotuloDia } from './historico';

// 30/09/2026 às 10:00 em Brasília (13:00 UTC).
const agora = new Date('2026-09-30T13:00:00Z');

describe('rotuloDia', () => {
  it('hoje, ontem e data, pelo dia de Brasília', () => {
    expect(rotuloDia('2026-09-30T03:30:00Z', agora)).toBe('Hoje'); // 00:30 em Brasília
    expect(rotuloDia('2026-09-30T02:30:00Z', agora)).toBe('Ontem'); // 23:30 do dia 29 em Brasília
    expect(rotuloDia('2026-09-28T15:00:00Z', agora)).toBe('28/09/2026');
    expect(rotuloDia('lixo', agora)).toBe('');
  });
});

describe('linhaDoTempo', () => {
  it('junta, ordena e separa por dia', () => {
    const itens = [
      { id: 'm2', criado_em: '2026-09-30T12:00:00Z' },
      { id: 'n1', criado_em: '2026-09-29T20:00:00Z' },
      { id: 'm1', criado_em: '2026-09-29T19:00:00Z' },
      { id: 'm3', criado_em: '2026-09-30T12:00:00Z' },
    ];
    const r = linhaDoTempo(itens, agora);
    expect(r.map((x) => (x.tipo === 'dia' ? `[${x.rotulo}]` : x.item.id))).toEqual(['[Ontem]', 'm1', 'n1', '[Hoje]', 'm2', 'm3']);
    expect(new Set(r.map((x) => x.chave)).size).toBe(r.length);
  });
  it('lista vazia não tem separador', () => {
    expect(linhaDoTempo([], agora)).toEqual([]);
  });
});
