// Histórico da conversa no Atendimento: mensagens e notas internas numa linha do tempo só, com separadores de dia.
import { FUSO, formatarData } from './formatos';

const DIA_MS = 24 * 60 * 60 * 1000;
const DIA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** "Hoje", "Ontem" ou "28/09/2026", pelo dia no horário de Brasília. */
export function rotuloDia(iso: string, agora: Date | number = Date.now()): string {
  const dia = formatarData(iso);
  if (!dia) return '';
  const hoje = new Date(agora);
  if (dia === formatarData(hoje)) return 'Hoje';
  if (dia === formatarData(new Date(hoje.getTime() - DIA_MS))) return 'Ontem';
  return dia;
}

/** Dia de Brasília como AAAA-MM-DD ('' se a data for inválida). */
function diaIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** `?data=` do Atendimento (o "abrir" de Gastos com IA): só um AAAA-MM-DD que existe; o resto é ignorado. */
export function lerDataAlvo(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s || !DIA_ISO.test(s)) return null;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
}

export type ItemLinhaDoTempo<T> = { tipo: 'dia'; chave: string; rotulo: string; iso: string } | { tipo: 'item'; chave: string; item: T };

/**
 * Junta listas já com `criado_em`, ordena do mais antigo para o mais novo (empate: a ordem em que vieram)
 * e põe um separador sempre que muda o dia (Brasília). O separador traz o dia em AAAA-MM-DD (`iso`, âncora do `?data=`).
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
      saida.push({ tipo: 'dia', chave: `dia-${dia || item.id}`, rotulo: rotuloDia(item.criado_em, agora) || 'Data desconhecida', iso: diaIso(item.criado_em) });
    }
    saida.push({ tipo: 'item', chave: item.id, item });
  }
  return saida;
}
