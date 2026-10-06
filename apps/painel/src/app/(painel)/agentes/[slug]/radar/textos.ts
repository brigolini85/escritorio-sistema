import { diaSP, type Selo } from '@escritorio/core';
import { formatarData, formatarHora, formatarUSD, formatarBRL } from '@/lib/formatos';

export const rotuloSelo = (s: Selo): string => (s === 'oficial' ? 'oficial' : 'confirmar');

const DIA_SIMPLES = /^\d{4}-\d{2}-\d{2}$/;
/** Data de publicação: "2026-10-01" é um dia, não um instante (senão o fuso o empurra para o dia anterior). */
const dataPublicada = (iso: string): string => (DIA_SIMPLES.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : formatarData(iso));
const diaMes = (iso: string): string => formatarData(iso).slice(0, 5);

function quandoAchou(iso: string, agora: Date): string {
  const dia = diaSP(new Date(iso));
  if (dia === diaSP(agora)) return `hoje ${formatarHora(iso)}`;
  if (dia === diaSP(new Date(agora.getTime() - 86_400_000))) return `ontem ${formatarHora(iso)}`;
  return `${diaMes(iso)} ${formatarHora(iso)}`;
}

export function linhaFonte(n: { fonteNome: string; publicadoEm: string | null; achadoEm: string }, agora: Date): string {
  return [n.fonteNome, n.publicadoEm ? `publicado ${dataPublicada(n.publicadoEm)}` : null, `achado ${quandoAchou(n.achadoEm, agora)}`].filter(Boolean).join(' · ');
}

export function textoVirouDemanda(d: { numero: number | null; setor: string; pessoa: string | null; em: string | null }): string {
  const quem = d.pessoa ? `por ${d.pessoa}${d.em ? `, ${diaMes(d.em)}` : ''}` : d.em ? diaMes(d.em) : null;
  return [d.numero ? `Virou demanda #${d.numero}` : 'Virou demanda', d.setor || null, quem].filter(Boolean).join(' · ');
}

export function textoDescartada(d: { pessoa: string | null; em: string | null }): string {
  const resto = [d.pessoa ? `por ${d.pessoa}` : null, d.em ? diaMes(d.em) : null].filter(Boolean).join(', ');
  return resto ? `Descartada ${resto}` : 'Descartada';
}

export const MOTIVO_ENVIO: Record<string, string> = {
  limite_dia: 'limite do dia', pausado: 'pausado', nao_procuravel: 'não pode mais ser procurado', atendimento_humano: 'conversa com uma pessoa',
};

/** Os motivos vêm das linhas "não enviado"; a lista que esperou usa o mesmo texto enquanto ainda espera. */
export function textoEnvios(e: { enviado: number; aguardando: number; naoEnviado: number; motivos: string[] }): string | null {
  const motivo = e.motivos.map((m) => MOTIVO_ENVIO[m] ?? m).join(', ');
  const partes: string[] = [];
  if (e.enviado) partes.push(`Enviado a ${e.enviado}`);
  if (e.aguardando) partes.push(`${e.aguardando} esperando${motivo ? ` (${motivo})` : ''}`);
  if (e.naoEnviado) partes.push(`${e.naoEnviado} ${e.naoEnviado === 1 ? 'não enviado' : 'não enviados'}${!e.aguardando && motivo ? ` (${motivo})` : ''}`);
  return partes.length ? partes.join(' · ') : null;
}

export const textoVigencia = (v: string | null): string => v || 'sem data ainda';

export function textoCustoMes(usd: number, cotacao: number | null): string {
  return cotacao ? `${formatarUSD(usd)} · ≈ ${formatarBRL(usd * cotacao)}` : formatarUSD(usd);
}

/** Desligado não procura; Teste só procura quando a pessoa pede (D6). */
export function textoProximoGiro(c: { estado: 'ligado' | 'teste' | 'desligado'; hora: string; proximoGiro: string | null }, agora: Date): string {
  if (c.estado === 'desligado') return 'Radar desligado';
  if (c.estado === 'teste' || !c.proximoGiro) return 'sem agenda';
  const dia = diaSP(new Date(c.proximoGiro));
  const hh = c.hora.slice(0, 5);
  const quando = dia === diaSP(agora) ? 'hoje' : dia === diaSP(new Date(agora.getTime() + 86_400_000)) ? 'amanhã' : `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
  return `${quando} ${hh} · automático`;
}
