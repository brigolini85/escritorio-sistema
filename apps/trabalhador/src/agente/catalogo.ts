import catalogo from './catalogo-pedidos.json';

/**
 * Catálogo de pedidos revisado pelo dono (atendimento rápido, opção A do desenho 2026-10-27): só guia no prompt, sem banco
 * nem conferência no código. A versão completa (tabela tipos_pedido, campos conferidos em abrir_chamado) substitui este
 * arquivo e o JSON ao lado.
 */
export type CampoPedido = { chave: string; rotulo: string; pergunta: string; obrigatorio: boolean };
export type TipoPedido = {
  nome: string;
  setor: string | null;
  /** Tipo com fluxo próprio: nota (regra 3a), documento (3b), novo_cliente (8), outro (sem tipo). */
  fluxo?: 'nota' | 'documento' | 'novo_cliente' | 'outro';
  prioridade_padrao: 'baixa' | 'normal' | 'alta' | 'urgente';
  exemplos: string[];
  campos: CampoPedido[];
  observacoes_equipe: string | null;
};

export const CATALOGO_PEDIDOS = catalogo as TipoPedido[];

const FLUXOS: Record<NonNullable<TipoPedido['fluxo']>, string> = {
  nota: 'siga a regra 3a',
  documento: 'siga a regra 3b',
  novo_cliente: 'siga a regra 8',
  outro: 'pedido que não combina com nenhum tipo: abra como hoje, com o que o cliente disse',
};

function linha(t: TipoPedido): string {
  const destino = t.setor ?? 'setor mais próximo ou "triagem"';
  const prioridade = t.prioridade_padrao === 'normal' ? '' : ` (${t.prioridade_padrao})`;
  const obrigatorias = t.campos.filter((c) => c.obrigatorio).map((c) => c.pergunta);
  const opcionais = t.campos.filter((c) => !c.obrigatorio).map((c) => c.pergunta);
  const partes = t.fluxo && t.fluxo !== 'novo_cliente'
    ? [FLUXOS[t.fluxo]]
    : [t.fluxo ? FLUXOS[t.fluxo] : '', obrigatorias.join(' '), opcionais.length ? `[se couber: ${opcionais.join(' ')}]` : ''].filter(Boolean);
  return `- ${t.nome} → ${destino}${prioridade}: ${partes.join(' ')}`;
}

/** Seção compacta do catálogo: tipo → setor (prioridade, se não for normal): perguntas do que precisa [opcionais]. */
export function secaoCatalogo(tipos: readonly TipoPedido[] = CATALOGO_PEDIDOS): string {
  return `CATÁLOGO DE PEDIDOS (guia da regra 3f: tipo → setor, prioridade quando não é normal e as perguntas do que a equipe precisa saber; entre colchetes, o que só se pergunta se couber na mesma mensagem. Se o setor não estiver em SETORES, use o mais próximo ou "triagem"):
${tipos.map(linha).join('\n')}`;
}
