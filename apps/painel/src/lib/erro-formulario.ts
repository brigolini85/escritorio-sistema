import 'server-only';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect, unstable_rethrow } from 'next/navigation';
import { ZodError } from 'zod';
import { AvisoUsuario } from './aviso-usuario';
import { ERRO_GENERICO } from './erro-na-url';
import { urlComErro } from './erro-na-url-servidor';
import { mensagemDoBanco } from './mensagem-banco';

/**
 * Texto para a pessoa. Revisão da rodada final: só texto nosso vai assinado para a tela: as mensagens de validação
 * (zod), um AvisoUsuario ou um erro do banco com P0001 (raise exception das nossas funções). Qualquer outro erro (a
 * mensagem crua do Postgres repete o que a pessoa digitou) vira a mensagem genérica e vai só para o log.
 */
export function mensagemDeErro(e: unknown): string {
  if (e instanceof ZodError) return [...new Set(e.issues.map((i) => i.message))].join('; ');
  if (e instanceof AvisoUsuario) return e.message;
  if (e && typeof e === 'object' && (e as { code?: unknown }).code === 'P0001' && typeof (e as { message?: unknown }).message === 'string') {
    return mensagemDoBanco((e as { message: string }).message);
  }
  console.error('[formulário] erro sem texto para a pessoa', e instanceof Error ? e.message : e);
  return ERRO_GENERICO;
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
  // Revisão final (T11): só o código (assinado) vai na URL; a página não mostra frase vinda de fora.
  if (erro) redirect(urlComErro(destino, erro));
  revalidatePath(destino.split('?')[0]!);
  const telaAtual = (await headers()).get('referer') ?? '';
  if (/[?&]erro=/.test(telaAtual)) redirect(destino);
}
