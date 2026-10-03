export type SituacaoAcesso = 'liberado' | 'fora_do_horario' | 'inativo' | 'sem_cadastro';

/** Resposta de situacao_acesso(); qualquer coisa estranha conta como sem acesso. */
export function situacaoDe(bruto: unknown): SituacaoAcesso {
  const s = (bruto as { situacao?: unknown } | null)?.situacao;
  return s === 'liberado' || s === 'fora_do_horario' || s === 'sem_cadastro' ? s : 'inativo';
}
