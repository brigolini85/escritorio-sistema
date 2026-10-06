import { abasDoResultado, partesDaPlanilha } from '@escritorio/core';
import { strToU8, zipSync } from 'fflate';
import type { TarefaTela } from './tarefas-tela';

// Data fixa nas entradas do zip: o mesmo resultado dá os mesmos bytes (D10).
const DATA_FIXA = new Date('2026-01-01T00:00:00Z');
/** D10: a planilha do resultado, montada na hora do download (nada guardado; vem do mesmo `resultado` do CSV). */
export function planilhaDaTarefa(t: Pick<TarefaTela, 'resultado' | 'pendencias'>): Uint8Array | null {
  if (!t.resultado) return null;
  const pend = t.pendencias.map((p) => ({ numero: p.numero, tipo: p.tipo, pergunta: p.pergunta, estado: p.estado, resposta: p.resposta }));
  const partes = partesDaPlanilha(abasDoResultado(t.resultado, pend));
  return zipSync(Object.fromEntries(Object.entries(partes).map(([k, v]) => [k, strToU8(v)])), { level: 6, mtime: DATA_FIXA });
}
