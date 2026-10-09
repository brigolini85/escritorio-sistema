import type { OrientacaoAgente, TipoOrientacao } from '@escritorio/db';

// Espelhado no painel (medidor da tela Treinar o agente) em apps/painel/src/lib/orientacoes.ts: mudou a conta aqui, mude lá.

/** Total de caracteres das orientações no prompt (linhas já montadas). */
export const LIMITE_ORIENTACOES = 12_000;

export const ROTULO_TIPO: Record<TipoOrientacao, string> = {
  jeito: 'Jeito de atender',
  regra: 'Regra do escritório',
  situacao: 'Situação específica',
};

export type OrientacoesDaConversa = {
  gerais: OrientacaoAgente[];
  porSetor: { setor: string; orientacoes: OrientacaoAgente[] }[];
  daEmpresa: OrientacaoAgente[];
  /** Ids que ficaram de fora por passar do limite. */
  cortadas: string[];
};

/**
 * Texto da equipe vai para o prompt: não pode abrir nem fechar as marcas usadas no prompt (<historico> etc.)
 * nem virar um bloco solto (linhas seguintes ficam recuadas dentro do item; no máximo uma linha em branco seguida).
 */
export function limparTextoOrientacao(texto: string): string {
  return texto
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2028\u2029\u0085\v\f]/g, '\n')   // outras quebras de linha contam como linha nova (e ganham o recuo)
    .replace(/</g, '‹').replace(/>/g, '›')
    .split('\n').map((l) => l.trimEnd()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function linhaOrientacao(o: Pick<OrientacaoAgente, 'tipo' | 'titulo' | 'texto'>): string {
  const texto = limparTextoOrientacao(o.texto).replace(/\n(?=.)/g, '\n  ');
  return `- [${ROTULO_TIPO[o.tipo]}] ${limparTextoOrientacao(o.titulo).replace(/\s+/g, ' ')}: ${texto}`;
}

const maisRecentes = (a: OrientacaoAgente, b: OrientacaoAgente) => b.atualizadoEm.getTime() - a.atualizadoEm.getTime();

/**
 * Orçamento das orientações (espelhado no medidor do painel): percorre na ordem de prioridade e põe cada uma que ainda cabe.
 * Auditoria 5.9: a que não cabe fica de fora e a seguinte ainda tenta (antes, depois do primeiro corte todas saíam).
 */
export function cortarNoLimite<T>(emOrdem: readonly T[], tamanho: (o: T) => number, limite: number): { entram: T[]; cortadas: T[] } {
  let total = 0;
  const entram: T[] = [];
  const cortadas: T[] = [];
  for (const o of emOrdem) {
    const t = tamanho(o);
    if (total + t > limite) { cortadas.push(o); continue; }
    total += t;
    entram.push(o);
  }
  return { entram, cortadas };
}

/**
 * Orientações que valem numa conversa: gerais (sem empresa nem setor), de setor (setores ativos) e só as da empresa em foco
 * (sem empresa em foco, nenhuma de empresa). Se passar do limite, a prioridade é: as da empresa, depois as de setor, depois
 * as gerais, das mais recentes para as mais antigas; entra cada uma que ainda couber e o resto fica de fora (em `cortadas`).
 */
export function orientacoesDaConversa(
  todas: OrientacaoAgente[],
  alvo: { clienteId: string | null; setores: { id: string; nome: string }[] },
  limite = LIMITE_ORIENTACOES,
): OrientacoesDaConversa {
  const setores = new Map(alvo.setores.map((s) => [s.id, s.nome]));
  const daEmpresa = alvo.clienteId ? todas.filter((o) => o.clienteId === alvo.clienteId).sort(maisRecentes) : [];
  const deSetor = todas.filter((o) => !o.clienteId && o.setorId && setores.has(o.setorId)).sort(maisRecentes);
  const gerais = todas.filter((o) => !o.clienteId && !o.setorId).sort(maisRecentes);

  // Orçamento único (spec §4): a empresa vem primeiro. Custo aceito: acima do limite, o que cabe no bloco 1 (gerais e setor)
  // depende da empresa em foco, e o cache do bloco 1 deixa de valer entre empresas. Abaixo do limite o bloco 1 é idêntico;
  // o medidor do painel existe para não chegar lá.
  // A segurança não depende disto: as regras fixas ficam fora do orçamento, e o bloco da empresa repete a precedência delas.
  const { entram, cortadas } = cortarNoLimite([...daEmpresa, ...deSetor, ...gerais], (o) => linhaOrientacao(o).length + 1, limite);
  const ok = new Set(entram);
  const empresaOk = daEmpresa.filter((o) => ok.has(o));
  const setorOk = deSetor.filter((o) => ok.has(o));
  const geraisOk = gerais.filter((o) => ok.has(o));

  const porSetor = alvo.setores
    .map((s) => ({ setor: s.nome, orientacoes: setorOk.filter((o) => o.setorId === s.id) }))
    .filter((g) => g.orientacoes.length > 0);
  return { gerais: geraisOk, porSetor, daEmpresa: empresaOk, cortadas: cortadas.map((o) => o.id) };
}
