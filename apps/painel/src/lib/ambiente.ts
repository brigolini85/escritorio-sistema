/**
 * Faixa de ambiente do topo do painel (D10): some só em produção.
 * Lê NEXT_PUBLIC_AMBIENTE (ou AMBIENTE); ausente = DESENVOLVIMENTO.
 */
export function rotuloAmbiente(valor: string | undefined | null): string | null {
  const v = (valor ?? '').trim().toLowerCase();
  if (!v) return 'DESENVOLVIMENTO';
  if (v === 'producao' || v === 'produção') return null;
  if (v === 'homologacao' || v === 'homologação') return 'HOMOLOGAÇÃO';
  if (v === 'desenvolvimento') return 'DESENVOLVIMENTO';
  return v.toUpperCase();
}

const NOMES: Record<string, string> = { producao: 'PRODUÇÃO', homologacao: 'HOMOLOGAÇÃO', local: 'LOCAL' };
const nome = (v: string) => NOMES[v] ?? (v.toUpperCase() || 'DESENVOLVIMENTO');

/**
 * Auditoria 3.13: faixa vermelha quando o AMBIENTE do painel é diferente do ambiente do banco (configuracoes.ambiente,
 * gravado pelo trabalhador na primeira partida). Banco ainda sem ambiente: nada a comparar.
 */
export function divergenciaAmbiente(processo: string | undefined | null, banco: string | null): string | null {
  if (!banco) return null;
  const p = (processo ?? '').trim().toLowerCase();
  const b = banco.trim().toLowerCase();
  if (p === b) return null;
  return `Este painel está configurado como ${nome(p)}, mas o banco é de ${nome(b)}. Confira o AMBIENTE do painel no Easypanel.`;
}
