/**
 * Partida do servidor do painel (segurança do login, item 5): variável faltando ou trocada para a subida aqui, com a
 * lista do que falta, em vez de virar "undefined" numa URL ou chave no meio de um pedido.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { exigirAmbiente } = await import('./lib/ambiente-validar');
  try {
    exigirAmbiente(process.env);
  } catch (e) {
    console.error(`[painel] ${(e as Error).message}`);
    // Para o processo: um painel com configuração errada não deve atender ninguém.
    process.exit(1);
  }
}
