/**
 * Orientações do agente no painel (tela Treinar o agente): rótulos, a linha que vai para o prompt e o medidor.
 *
 * ESPELHO de apps/trabalhador/src/agente/orientacoes.ts (LIMITE_ORIENTACOES, ROTULO_TIPO, limparTextoOrientacao,
 * linhaOrientacao e a conta do orçamento de orientacoesDaConversa: `linhaOrientacao(o).length + 1` por orientação).
 * O painel não importa do trabalhador; se a conta mudar lá, mude aqui também. O teste (orientacoes.test.ts) usa os
 * mesmos exemplos do teste do trabalhador (apps/trabalhador/test/agente/orientacoes.test.ts) para os dois não se afastarem.
 */

export type TipoOrientacao = 'jeito' | 'regra' | 'situacao';

/** Total de caracteres das orientações no prompt de uma conversa (linhas já montadas). */
export const LIMITE_ORIENTACOES = 12_000;
export const LIMITE_TITULO = 120;
export const LIMITE_TEXTO = 2000;
/** A partir desta fração do limite o medidor avisa. */
export const AVISO_MEDIDOR = 0.8;

export const ROTULO_TIPO: Record<TipoOrientacao, string> = {
  jeito: 'Jeito de atender',
  regra: 'Regra do escritório',
  situacao: 'Situação específica',
};
export const TIPOS: TipoOrientacao[] = ['jeito', 'regra', 'situacao'];

export function limparTextoOrientacao(texto: string): string {
  return texto
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2028\u2029\u0085\v\f]/g, '\n')
    .replace(/</g, '‹').replace(/>/g, '›')
    .split('\n').map((l) => l.trimEnd()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function linhaOrientacao(o: { tipo: TipoOrientacao; titulo: string; texto: string }): string {
  const texto = limparTextoOrientacao(o.texto).replace(/\n(?=.)/g, '\n  ');
  return `- [${ROTULO_TIPO[o.tipo]}] ${limparTextoOrientacao(o.titulo).replace(/\s+/g, ' ')}: ${texto}`;
}

/** Quanto uma orientação ocupa no orçamento (a linha e a quebra de linha). */
export function tamanhoOrientacao(o: { tipo: TipoOrientacao; titulo: string; texto: string }): number {
  return linhaOrientacao(o).length + 1;
}

export type OrientacaoMedida = { tipo: TipoOrientacao; titulo: string; texto: string; ativo: boolean; clienteId: string | null; setorId: string | null };

export type Medidor = {
  /** Caracteres da conversa mais pesada: gerais + de setor (setores ativos) + a empresa com mais texto. */
  total: number;
  gerais: number;
  setores: number;
  /** A empresa que mais pesa (null quando nenhuma orientação ligada é de empresa). */
  empresa: { id: string; total: number } | null;
  nivel: 'ok' | 'aviso' | 'excesso';
  /** 0 a 100 (para a barra; passa de 100 só no texto). */
  percentual: number;
};

/**
 * Medidor da tela: numa conversa entram as gerais, as de setor (setores ativos) e só as da empresa da conversa.
 * O pior caso é a empresa com mais texto; é ele que chega primeiro no limite (e aí as gerais mais antigas ficam de fora).
 */
export function medirOrientacoes(orientacoes: OrientacaoMedida[], setoresAtivos: Iterable<string>, limite = LIMITE_ORIENTACOES): Medidor {
  const ativos = new Set(setoresAtivos);
  let gerais = 0;
  let setores = 0;
  const porEmpresa = new Map<string, number>();
  for (const o of orientacoes) {
    if (!o.ativo) continue;
    const t = tamanhoOrientacao(o);
    if (o.clienteId) porEmpresa.set(o.clienteId, (porEmpresa.get(o.clienteId) ?? 0) + t);
    else if (o.setorId) { if (ativos.has(o.setorId)) setores += t; }
    else gerais += t;
  }
  let empresa: Medidor['empresa'] = null;
  for (const [id, total] of porEmpresa) if (!empresa || total > empresa.total) empresa = { id, total };
  const total = gerais + setores + (empresa?.total ?? 0);
  const nivel = total >= limite ? 'excesso' : total >= limite * AVISO_MEDIDOR ? 'aviso' : 'ok';
  return { total, gerais, setores, empresa, nivel, percentual: Math.min(100, Math.round((total / limite) * 100)) };
}
