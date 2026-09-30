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
