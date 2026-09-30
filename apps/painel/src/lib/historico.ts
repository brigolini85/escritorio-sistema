// Histórico da conversa no Atendimento: mensagens e notas internas numa linha do tempo só, com separadores de dia.
import { formatarData } from './formatos';

const DIA_MS = 24 * 60 * 60 * 1000;

/** "Hoje", "Ontem" ou "28/09/2026", pelo dia no horário de Brasília. */
export function rotuloDia(iso: string, agora: Date | number = Date.now()): string {
  const dia = formatarData(iso);
  if (!dia) return '';
  const hoje = new Date(agora);
  if (dia === formatarData(hoje)) return 'Hoje';
  if (dia === formatarData(new Date(hoje.getTime() - DIA_MS))) return 'Ontem';
  return dia;
}

export type ItemLinhaDoTempo<T> = { tipo: 'dia'; chave: string; rotulo: string } | { tipo: 'item'; chave: string; item: T };

/**
 * Junta listas já com `criado_em`, ordena do mais antigo para o mais novo (empate: a ordem em que vieram)
 * e põe um separador sempre que muda o dia (Brasília).
 */
export function linhaDoTempo<T extends { id: string; criado_em: string }>(itens: T[], agora: Date | number = Date.now()): ItemLinhaDoTempo<T>[] {
  const ordenados = itens
    .map((item, i) => ({ item, i, t: new Date(item.criado_em).getTime() }))
    .sort((a, b) => (a.t - b.t) || (a.i - b.i));
  const saida: ItemLinhaDoTempo<T>[] = [];
  let diaAtual = '';
  for (const { item } of ordenados) {
    const dia = formatarData(item.criado_em);
    if (dia !== diaAtual) {
      diaAtual = dia;
      saida.push({ tipo: 'dia', chave: `dia-${dia || item.id}`, rotulo: rotuloDia(item.criado_em, agora) || 'Data desconhecida' });
    }
    saida.push({ tipo: 'item', chave: item.id, item });
  }
  return saida;
}
