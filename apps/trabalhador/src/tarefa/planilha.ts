import { abasDoResultado, partesDaPlanilha } from '@escritorio/core';
import type { TarefaParaTrabalho } from '@escritorio/db';
import { strToU8, zipSync } from 'fflate';

// D12: a mesma planilha da I3b (painel: lib/planilha-tarefa.ts), com a data fixa nas entradas (o mesmo resultado dá os mesmos bytes).
const DATA_FIXA = new Date('2026-01-01T00:00:00Z');
export function planilhaDaTarefa(t: Pick<TarefaParaTrabalho, 'resultado' | 'pendencias'>): Uint8Array | null {
  if (!t.resultado) return null;
  const pend = t.pendencias.map((p) => ({ numero: p.numero, tipo: p.tipo, pergunta: p.pergunta, estado: p.estado, resposta: p.resposta }));
  const partes = partesDaPlanilha(abasDoResultado(t.resultado, pend));
  return zipSync(Object.fromEntries(Object.entries(partes).map(([k, v]) => [k, strToU8(v)])), { level: 6, mtime: DATA_FIXA });
}
