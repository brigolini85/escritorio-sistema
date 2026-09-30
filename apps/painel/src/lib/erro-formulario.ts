import 'server-only';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
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
 * Se der certo e a tela ainda mostra o aviso de uma tentativa anterior (`?erro=` no endereço), volta para
 * `destino` sem ele, para o aviso vermelho não ficar. Sem aviso na tela não navega: só atualiza os dados
 * (navegar a cada salvamento engolia o clique seguinte da pessoa, ex.: "histórico" logo depois de salvar um preço).
 */
export async function comAvisoDeErro(destino: string, acao: () => Promise<void>): Promise<void> {
  let erro: string | null = null;
  try {
    await acao();
  } catch (e) {
    unstable_rethrow(e);   // redirect() de sucesso da própria ação continua valendo
    erro = mensagemDeErro(e);
  }
  if (erro) redirect(`${destino}${destino.includes('?') ? '&' : '?'}erro=${encodeURIComponent(erro)}`);
  revalidatePath(destino.split('?')[0]!);
  const telaAtual = (await headers()).get('referer') ?? '';
  if (/[?&]erro=/.test(telaAtual)) redirect(destino);
}
