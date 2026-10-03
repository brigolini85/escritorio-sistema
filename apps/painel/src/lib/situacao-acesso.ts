export type SituacaoAcesso = 'liberado' | 'fora_do_horario' | 'inativo' | 'sem_cadastro';

/** Resposta de situacao_acesso(); qualquer coisa estranha conta como sem acesso. */
export function situacaoDe(bruto: unknown): SituacaoAcesso {
  const s = (bruto as { situacao?: unknown } | null)?.situacao;
  return s === 'liberado' || s === 'fora_do_horario' || s === 'sem_cadastro' ? s : 'inativo';
}

/** Erro do banco ao conferir o acesso: "tente de novo", nunca "acesso desativado". */
export type SituacaoLida = SituacaoAcesso | 'indisponivel';

/** Lê a resposta do rpc('situacao_acesso'); o erro vai para o log e vira 'indisponivel'. */
export function lerSituacao(r: { data: unknown; error: { message: string } | null }, onde: string): SituacaoLida {
  if (r.error) {
    console.error(`[${onde}] situação de acesso`, r.error.message);
    return 'indisponivel';
  }
  return situacaoDe(r.data);
}

/** Sessão aberta sem a própria linha: para onde vai. Liberado sem achar a linha é falha passageira, não desativação. */
export function destinoSemAcesso(s: SituacaoLida): string {
  if (s === 'fora_do_horario') return '/fora-do-horario';
  if (s === 'inativo' || s === 'sem_cadastro') return '/entrar?erro=inativo';
  return '/entrar?erro=indisponivel';
}
