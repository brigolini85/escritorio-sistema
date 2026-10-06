/** Parte I3b (D11): como cada agente é testado no painel. */
export type ComoTestar = 'thiago' | 'setor' | 'trabalho' | 'sem_i3b';
export function comoTestar(a: { portaDeEntrada: boolean; tipos: readonly string[] }, i3b: boolean): ComoTestar {
  if (a.portaDeEntrada) return 'thiago';
  if (!a.tipos.includes('conversa')) return 'trabalho';
  return i3b ? 'setor' : 'sem_i3b';
}
