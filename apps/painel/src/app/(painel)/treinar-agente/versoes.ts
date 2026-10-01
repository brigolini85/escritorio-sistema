import type { TipoOrientacao } from '../../../lib/orientacoes';

export type AcaoVersao = 'criar' | 'editar' | 'ligar' | 'desligar' | 'restaurar';

/** Retrato gravado a cada criação, edição, ligar/desligar e restauração (orientacoes_agente_versoes). */
export type Versao = {
  id: string;
  acao: AcaoVersao;
  titulo: string;
  texto: string;
  tipo: TipoOrientacao;
  clienteId: string | null;
  setorId: string | null;
  ativo: boolean;
  usuario: string | null;
  criadoEm: string;
};

export const ROTULO_ACAO: Record<AcaoVersao, string> = {
  criar: 'Criou',
  editar: 'Editou',
  ligar: 'Ligou',
  desligar: 'Desligou',
  restaurar: 'Restaurou uma versão anterior',
};

type Conteudo = Pick<Versao, 'titulo' | 'texto' | 'tipo' | 'clienteId' | 'setorId'>;

/** O que muda o que o agente lê (ligada/desligada fica de fora: restaurar não mexe nisso). */
export function mesmoConteudo(a: Conteudo, b: Conteudo): boolean {
  return a.titulo === b.titulo && a.texto === b.texto && a.tipo === b.tipo && a.clienteId === b.clienteId && a.setorId === b.setorId;
}

/** Campos que mudaram desta versão para a anterior, em palavras: "título, texto e vale para". */
export function camposAlterados(versao: Conteudo, anterior: Conteudo | null): string[] {
  if (!anterior) return [];
  const campos: string[] = [];
  if (versao.titulo !== anterior.titulo) campos.push('título');
  if (versao.tipo !== anterior.tipo) campos.push('tipo');
  if (versao.clienteId !== anterior.clienteId || versao.setorId !== anterior.setorId) campos.push('vale para');
  if (versao.texto !== anterior.texto) campos.push('texto');
  return campos;
}

export function juntarComE(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? '';
  return `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`;
}

/**
 * Resumo de uma linha do histórico. `versoes` vem da mais nova para a mais antiga; a anterior de cada uma é a seguinte.
 * Ex.: "Editou: título e texto", "Ligou", "Criou (desligada)".
 */
export function resumoVersao(versoes: readonly Versao[], i: number): string {
  const v = versoes[i]!;
  const anterior = versoes[i + 1] ?? null;
  if (v.acao === 'criar') return `Criou (${v.ativo ? 'ligada' : 'desligada'})`;
  if (v.acao === 'ligar' || v.acao === 'desligar') return ROTULO_ACAO[v.acao];
  const campos = camposAlterados(v, anterior);
  if (v.acao === 'editar') {
    const ligou = anterior && anterior.ativo !== v.ativo ? (v.ativo ? 'ligou' : 'desligou') : null;
    if (campos.length === 0) return ligou ? `Editou e ${ligou}` : 'Salvou sem mudanças';
    return `Editou: ${juntarComE(campos)}${ligou ? ` (e ${ligou})` : ''}`;
  }
  return campos.length ? `${ROTULO_ACAO.restaurar}: ${juntarComE(campos)}` : ROTULO_ACAO.restaurar;
}
