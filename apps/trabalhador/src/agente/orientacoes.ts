import type { OrientacaoAgente, TipoOrientacao } from '@escritorio/db';

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
 * Orientações que valem numa conversa: gerais (sem empresa nem setor), de setor (setores ativos) e só as da empresa em foco
 * (sem empresa em foco, nenhuma de empresa). Se passar do limite, entram primeiro as da empresa, depois as de setor, depois
 * as gerais, das mais recentes para as mais antigas; o resto fica de fora (em `cortadas`).
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

  let total = 0;
  const cortadas: string[] = [];
  const cabem = (lista: OrientacaoAgente[]) => lista.filter((o) => {
    if (cortadas.length) { cortadas.push(o.id); return false; }
    const tamanho = linhaOrientacao(o).length + 1;
    if (total + tamanho > limite) { cortadas.push(o.id); return false; }
    total += tamanho;
    return true;
  });
  const empresaOk = cabem(daEmpresa);
  const setorOk = cabem(deSetor);
  const geraisOk = cabem(gerais);

  const porSetor = alvo.setores
    .map((s) => ({ setor: s.nome, orientacoes: setorOk.filter((o) => o.setorId === s.id) }))
    .filter((g) => g.orientacoes.length > 0);
  return { gerais: geraisOk, porSetor, daEmpresa: empresaOk, cortadas };
}
