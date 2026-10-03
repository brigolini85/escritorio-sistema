// Regras puras da tela Gastos com IA (spec 7B.3): período, previsão, nomes e cores, ranking, alerta do dia mais caro.
import type { FuncionalidadeIa } from '@escritorio/core';
import { FUSO, NBSP, formatarBRL, formatarUSD } from './formatos';

export type FiltroPeriodo = 'hoje' | '7d' | 'mes' | 'mes-passado' | 'periodo';
export type Periodo = { filtro: FiltroPeriodo; de: string; ate: string; deDia: string; ateDia: string; rotulo: string; dias: number; aviso: string | null };

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 366;

/** Dia de hoje em Brasília, como AAAA-MM-DD. */
function hojeSP(agora: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}
/** Soma dias a um AAAA-MM-DD (conta em UTC ao meio-dia: sem horário de verão no caminho). */
function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const inicio = (dia: string) => `${dia}T00:00:00-03:00`;
const diasEntre = (de: string, ateExclusivo: string) => Math.round((Date.parse(`${ateExclusivo}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
function valido(dia: string | undefined): dia is string {
  return !!dia && DIA.test(dia) && !Number.isNaN(Date.parse(`${dia}T12:00:00Z`)) && new Date(`${dia}T12:00:00Z`).toISOString().slice(0, 10) === dia;
}

function montar(filtro: FiltroPeriodo, de: string, ateExclusivo: string, rotulo: string, aviso: string | null = null): Periodo {
  return { filtro, de: inicio(de), ate: inicio(ateExclusivo), deDia: de, ateDia: somarDias(ateExclusivo, -1), rotulo, dias: diasEntre(de, ateExclusivo), aviso };
}
function mes(ano: number, m: number, filtro: FiltroPeriodo, aviso: string | null = null): Periodo {
  const de = `${ano}-${String(m).padStart(2, '0')}-01`;
  const prox = m === 12 ? `${ano + 1}-01-01` : `${ano}-${String(m + 1).padStart(2, '0')}-01`;
  return montar(filtro, de, prox, MESES[m - 1]!, aviso);
}

/** Período da URL (?p=hoje|7d|mes|mes-passado|periodo&de=&ate=). Padrão: este mês. "de" e "até" inclusive (P18). */
export function lerPeriodo(params: { p?: string; de?: string; ate?: string }, agora: Date): Periodo {
  const hoje = hojeSP(agora);
  const [ano, m] = hoje.split('-').map(Number) as [number, number];
  switch (params.p) {
    case 'hoje': return montar('hoje', hoje, somarDias(hoje, 1), 'hoje');
    case '7d': return montar('7d', somarDias(hoje, -6), somarDias(hoje, 1), 'últimos 7 dias');
    case 'mes-passado': return m === 1 ? mes(ano - 1, 12, 'mes-passado') : mes(ano, m - 1, 'mes-passado');
    case 'periodo': {
      const { de, ate } = params;
      if (valido(de) && valido(ate) && de <= ate && diasEntre(de, somarDias(ate, 1)) <= MAX_DIAS) {
        return montar('periodo', de, somarDias(ate, 1), `${ddmm(de)} a ${ddmm(ate)}`);
      }
      return mes(ano, m, 'mes', 'Período inválido: mostrando este mês.');
    }
    default: return mes(ano, m, 'mes');
  }
}

/** Previsão de fechamento do mês (spec 7B.3): gasto ÷ dias corridos (contando hoje) × dias do mês, em Brasília. */
export function previsaoFechamento(gastoMes: number, agora: Date): number {
  const hoje = hojeSP(agora);
  const [ano, m, d] = hoje.split('-').map(Number) as [number, number, number];
  const diasNoMes = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  return (gastoMes / d) * diasNoMes;
}

type Icone = 'robo' | 'brilho' | 'whatsapp' | 'varinha' | 'chapeu' | 'microfone' | 'setor' | 'interrogacao';
/** Nome, ícone e cor (token --gasto-*) de cada funcionalidade. A cor segue a funcionalidade, nunca a posição. */
export const INFO_FUNCIONALIDADE: Record<FuncionalidadeIa, { rotulo: string; icone: Icone; cor: string }> = {
  agente_clientes: { rotulo: 'Agente de clientes', icone: 'robo', cor: 'bg-gasto-agente' },
  assistente_site: { rotulo: 'Assistente (site)', icone: 'brilho', cor: 'bg-gasto-assistente-site' },
  assistente_whatsapp: { rotulo: 'Assistente (WhatsApp)', icone: 'whatsapp', cor: 'bg-gasto-assistente-whatsapp' },
  sugerir_resposta: { rotulo: 'Sugerir resposta', icone: 'varinha', cor: 'bg-gasto-sugerir' },
  testar_agente: { rotulo: 'Testar o agente', icone: 'chapeu', cor: 'bg-gasto-testar' },
  transcricao_audio: { rotulo: 'Transcrição de áudio', icone: 'microfone', cor: 'bg-gasto-transcricao' },
  especialista_setor: { rotulo: 'Especialista por setor', icone: 'setor', cor: 'bg-gasto-especialista' },
  nao_identificado: { rotulo: 'Não identificado', icone: 'interrogacao', cor: 'bg-gasto-nao-identificado' },
};
/** Ordem fixa da barra empilhada do ranking (validada pela skill dataviz: vizinhos distinguíveis, inclusive com daltonismo). */
export const ORDEM_EMPILHADO: FuncionalidadeIa[] = ['assistente_site', 'sugerir_resposta', 'testar_agente', 'assistente_whatsapp'];

export const percentual = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0);

export type LinhaPessoa = { usuario_id: string; nome: string; funcionalidade: string; custo_usd: number; chamadas: number };
export function montarRanking(linhas: LinhaPessoa[], max = 10) {
  const pessoas = new Map<string, { usuarioId: string; nome: string; custo: number; chamadas: number; por: Map<string, number> }>();
  for (const l of linhas) {
    const p = pessoas.get(l.usuario_id) ?? { usuarioId: l.usuario_id, nome: l.nome, custo: 0, chamadas: 0, por: new Map() };
    p.custo += Number(l.custo_usd);
    p.chamadas += Number(l.chamadas);
    p.por.set(l.funcionalidade, (p.por.get(l.funcionalidade) ?? 0) + Number(l.custo_usd));
    pessoas.set(l.usuario_id, p);
  }
  const total = [...pessoas.values()].reduce((s, p) => s + p.custo, 0);
  const ordem = (f: string) => { const i = ORDEM_EMPILHADO.indexOf(f as FuncionalidadeIa); return i < 0 ? 99 : i; };
  return [...pessoas.values()].sort((a, b) => b.custo - a.custo || a.nome.localeCompare(b.nome)).slice(0, max).map((p) => ({
    usuarioId: p.usuarioId, nome: p.nome, custo: p.custo, chamadas: p.chamadas, pct: percentual(p.custo, total),
    partes: [...p.por.entries()].sort((a, b) => ordem(a[0]) - ordem(b[0]))
      .map(([f, c]) => ({ funcionalidade: f as FuncionalidadeIa, custo: c, pct: percentual(c, p.custo) })),
  }));
}

/** Alerta do dia mais caro (spec 7B.3, P17): só com 2 dias ou mais com gasto. */
export function textoDiaMaisCaro(d: { dia: string; custo_dia: number; dias_com_gasto: number; funcionalidade: string; pessoa: string | null; chamadas: number } | null): string | null {
  if (!d || Number(d.dias_com_gasto) < 2) return null;
  const rotulo = INFO_FUNCIONALIDADE[d.funcionalidade as FuncionalidadeIa]?.rotulo ?? d.funcionalidade;
  const inicioTexto = `${ddmm(d.dia)} foi o dia mais caro (${formatarUSD(Number(d.custo_dia)).replace(NBSP, ' ')})`;
  return d.pessoa
    ? `${inicioTexto}: ${rotulo} usado ${d.chamadas} vezes por ${d.pessoa}.`
    : `${inicioTexto}: ${rotulo}, ${d.chamadas} chamadas.`;
}

/** Custo de uma chamada: 4 casas abaixo de 1 centavo (senão tudo vira "US$ 0,00"). */
export function formatarUsdFino(v: number): string {
  if (v === 0 || Math.abs(v) >= 0.01) return formatarUSD(v);
  return `US$${NBSP}${v.toFixed(4).replace('.', ',')}`;
}
export const emReais = (usd: number, cotacao: number | null) => (cotacao && cotacao > 0 ? formatarBRL(usd * cotacao) : null);

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return `${partes[0]![0]}${partes.at(-1)![0]}`.toUpperCase();
  return (partes[0] ?? '?').slice(0, 2).toUpperCase();
}
