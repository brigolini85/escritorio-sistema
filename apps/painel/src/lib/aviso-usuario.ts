/**
 * Revisão da rodada final (T11): erro com texto escrito por nós para a pessoa (permissão, validação, regra do banco com
 * P0001). Só ele (e a validação do zod) vira frase na tela pelo `?erro=` assinado; qualquer outro erro vira a mensagem
 * genérica. A mensagem crua do Postgres pode repetir o que a pessoa digitou (ex.: "invalid input syntax for type uuid:
 * <texto>"), e assinar isso faria do painel um carimbo para qualquer frase.
 */
export class AvisoUsuario extends Error {}

/** Erro do banco: P0001 (raise exception das nossas funções) vira AvisoUsuario; o resto, um erro comum (genérico na tela). */
export function erroDoBanco(error: { code?: string; message: string }, traduzir: (m: string) => string = (m) => m): Error {
  return error.code === 'P0001' ? new AvisoUsuario(traduzir(error.message)) : new Error(error.message);
}
