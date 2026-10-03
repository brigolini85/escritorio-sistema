// Exportação de Gastos com IA (spec 7B.3, P13): linha a linha, ; e BOM para o Excel em português. Sem telefone nem conversa.
import type { FuncionalidadeIa } from '@escritorio/core';
import { formatarDataHora } from './formatos';
import { INFO_FUNCIONALIDADE } from './gastos';

export type LinhaChamada = {
  id: string; criado_em: string; funcionalidade: string; usuario_id: string | null; pessoa: string | null; cliente_id: string | null; empresa: string | null;
  conversa_id: string | null; modelo: string; provedor: string; tokens_entrada: number; tokens_saida: number; tokens_cache_leitura: number;
  tokens_cache_escrita: number; segundos_audio: number | null; custo_usd: number;
};

/** Teto do arquivo (P13): o mesmo limite que gastos_chamadas aceita. */
export const LIMITE_EXPORTAR = 100_000;
/** O PostgREST devolve no máximo max_rows (1000) por pedido, mesmo com p_limite maior: o arquivo é lido em páginas. */
const POR_PAGINA = 1000;
const AVISO_CORTE = 'Arquivo cortado em 100.000 chamadas. Escolha um período menor.';

/**
 * Fim do período para o arquivo, fixado uma vez antes das páginas: o menor entre o fim do período e o instante do pedido.
 * Chamada gravada durante a leitura fica de fora e não empurra linhas de uma página para a outra. Período todo no futuro
 * fica como está (nada a ler, e o banco recusaria o fim antes do começo).
 */
export function ateCongelado(periodo: { de: string; ate: string }, agora: Date): string {
  const t = agora.getTime();
  return t < Date.parse(periodo.ate) && t > Date.parse(periodo.de) ? agora.toISOString() : periodo.ate;
}

type Pagina ={ data: LinhaChamada[] | null; error: { message: string } | null };
/**
 * Lê todas as chamadas do período em páginas [inicio, fim] (inclusive) até vir uma página incompleta ou chegar ao limite.
 * A ordem da função (criado_em desc, id) é estável: páginas não pulam nem repetem linha. Erro numa página devolve só o erro.
 */
export async function lerTodasChamadas(pagina: (inicio: number, fim: number) => PromiseLike<Pagina>): Promise<{ linhas: LinhaChamada[]; error: { message: string } | null }> {
  const linhas: LinhaChamada[] = [];
  while (linhas.length < LIMITE_EXPORTAR) {
    const inicio = linhas.length;
    const { data, error } = await pagina(inicio, Math.min(inicio + POR_PAGINA, LIMITE_EXPORTAR) - 1);
    if (error) return { linhas: [], error };
    linhas.push(...(data ?? []));
    if ((data ?? []).length < POR_PAGINA) break;
  }
  return { linhas: linhas.slice(0, LIMITE_EXPORTAR), error: null };
}

/** Célula do CSV: texto que começa com = + - @ (ou tab/CR) ganha ' na frente: a planilha não executa fórmula vinda do banco. */
function campo(v: string | number | null): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\r\n]/.test(s) || s.startsWith("'") ? `"${s.replace(/"/g, '""')}"` : s;
}
const decimal = (v: number, casas: number) => v.toFixed(casas).replace('.', ',');
const rotulo = (f: string) => (INFO_FUNCIONALIDADE[f as FuncionalidadeIa] ?? INFO_FUNCIONALIDADE.nao_identificado).rotulo;

export function linhasCsvGastos(linhas: LinhaChamada[], cotacao: number | null): string {
  const comReais = !!cotacao && cotacao > 0;
  const cab = ['Data e hora', 'Funcionalidade', 'Pessoa', 'Empresa', 'Modelo', 'Provedor', 'Tokens de entrada', 'Tokens de saída',
    'Tokens lidos do cache', 'Tokens gravados no cache', 'Segundos de áudio', 'Custo (US$)', ...(comReais ? ['Custo (R$)'] : [])];
  const corpo = linhas.map((l) => [
    campo(formatarDataHora(l.criado_em)), campo(rotulo(l.funcionalidade)),
    campo(l.pessoa), campo(l.empresa), campo(l.modelo), campo(l.provedor), campo(Number(l.tokens_entrada)), campo(Number(l.tokens_saida)),
    campo(Number(l.tokens_cache_leitura)), campo(Number(l.tokens_cache_escrita)), l.segundos_audio === null ? '' : decimal(Number(l.segundos_audio), 2),
    decimal(Number(l.custo_usd), 6), ...(comReais ? [decimal(Number(l.custo_usd) * cotacao, 2)] : []),
  ].join(';'));
  // No limite pode haver mais chamadas no período: o corte fica escrito no arquivo, nunca em silêncio.
  const corte = linhas.length >= LIMITE_EXPORTAR ? [AVISO_CORTE] : [];
  return `﻿${[cab.join(';'), ...corpo, ...corte].join('\r\n')}\r\n`;
}
