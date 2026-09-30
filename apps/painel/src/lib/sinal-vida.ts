/**
 * Situação de um sinal de vida (WhatsApp, fila, batimento do trabalhador) pelo tempo desde o último sinal.
 * Usado pelo HealthSignal: ok (verde), atrasado (amarelo), parado ou sem sinal (vermelho).
 */

export type SituacaoSinal = 'ok' | 'atrasado' | 'parado' | 'sem_sinal';
export type LimitesSinal = { atrasadoApos: number; paradoApos: number };

/** Padrão: batimento a cada ~30s; 2 min sem sinal é atraso, 10 min é parado. */
export const LIMITES_PADRAO: LimitesSinal = { atrasadoApos: 120, paradoApos: 600 };

export function situacaoDoSinal(
  ultimo: Date | string | null | undefined,
  agora: Date | number = Date.now(),
  limites: LimitesSinal = LIMITES_PADRAO,
): SituacaoSinal {
  if (!ultimo) return 'sem_sinal';
  const ms = new Date(ultimo).getTime();
  if (Number.isNaN(ms)) return 'sem_sinal';
  const segundos = ((agora instanceof Date ? agora.getTime() : agora) - ms) / 1000;
  if (segundos >= limites.paradoApos) return 'parado';
  if (segundos >= limites.atrasadoApos) return 'atrasado';
  return 'ok';
}

export const ROTULO_SITUACAO: Record<SituacaoSinal, string> = {
  ok: 'Funcionando',
  atrasado: 'Atrasado',
  parado: 'Parado',
  sem_sinal: 'Sem sinal',
};
