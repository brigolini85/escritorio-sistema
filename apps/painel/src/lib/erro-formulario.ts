import 'server-only';
import { redirect, unstable_rethrow } from 'next/navigation';
import { ZodError } from 'zod';

/** Texto para a pessoa: as mensagens de validação ou a mensagem do erro. */
export function mensagemDeErro(e: unknown): string {
  if (e instanceof ZodError) return [...new Set(e.issues.map((i) => i.message))].join('; ');
  if (e instanceof Error) return e.message;
  return 'Não foi possível salvar.';
}

/**
 * Executa a ação de um formulário; se falhar (validação, permissão, banco), volta para `destino`
 * com `?erro=` para a página mostrar o aviso, em vez de quebrar a tela.
 */
export async function comAvisoDeErro(destino: string, acao: () => Promise<void>): Promise<void> {
  let erro: string | null = null;
  try {
    await acao();
  } catch (e) {
    unstable_rethrow(e);   // redirect() de sucesso continua funcionando
    erro = mensagemDeErro(e);
  }
  if (erro) redirect(`${destino}${destino.includes('?') ? '&' : '?'}erro=${encodeURIComponent(erro)}`);
}
