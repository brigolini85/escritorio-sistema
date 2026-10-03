// Exportação de Gastos com IA (spec 7B.3, P13): linha a linha, ; e BOM para o Excel em português. Sem telefone nem conversa.
import type { FuncionalidadeIa } from '@escritorio/core';
import { formatarDataHora } from './formatos';
import { INFO_FUNCIONALIDADE } from './gastos';

export type LinhaChamada = {
  id: string; criado_em: string; funcionalidade: string; usuario_id: string | null; pessoa: string | null; cliente_id: string | null; empresa: string | null;
  conversa_id: string | null; modelo: string; provedor: string; tokens_entrada: number; tokens_saida: number; tokens_cache_leitura: number;
  tokens_cache_escrita: number; segundos_audio: number | null; custo_usd: number;
};

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
  return `﻿${[cab.join(';'), ...corpo].join('\r\n')}\r\n`;
}
