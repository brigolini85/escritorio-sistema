import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ERRO_GENERICO, ERROS, PARAM_ERRO, type CodigoErro } from './erro-na-url';

/**
 * Revisão final (T11): as ações devolvem a falha pela URL só como código. Frase do mapa (ERROS): o código dela. Frase
 * dinâmica (regra do banco, validação): um código assinado pelo servidor, `s.<texto em base64url>.<assinatura>`. A
 * página só mostra o texto de um código conhecido ou de assinatura válida; qualquer outra coisa vira ERRO_GENERICO.
 * A chave da assinatura deriva da chave de serviço (só o servidor tem); sem ela, só os códigos do mapa.
 */
const TAMANHO_MAXIMO = 300;

function chave(): Buffer | null {
  const segredo = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return segredo ? createHmac('sha256', segredo).update('painel:erro-na-url').digest() : null;
}

const assinar = (k: Buffer, corpo: string) => createHmac('sha256', k).update(corpo).digest('base64url').slice(0, 32);

/** Código para levar `texto` no `?erro=`. */
export function codigoDoErro(texto: string): string {
  const t = texto.trim().slice(0, TAMANHO_MAXIMO);
  const fixo = (Object.keys(ERROS) as CodigoErro[]).find((c) => ERROS[c] === t);
  if (fixo) return fixo;
  const k = chave();
  if (!t || !k) return 'falha';
  const corpo = Buffer.from(t, 'utf8').toString('base64url');
  return `s.${corpo}.${assinar(k, corpo)}`;
}

/** `destino` com o `?erro=` do texto (mantém os parâmetros que já estavam). */
export function urlComErro(destino: string, texto: string): string {
  return `${destino}${destino.includes('?') ? '&' : '?'}${PARAM_ERRO}=${encodeURIComponent(codigoDoErro(texto))}`;
}

/** O texto que a página mostra para o `?erro=` recebido (vazio: nada). */
export function textoDoErro(valor: string | string[] | null | undefined): string | undefined {
  const v = Array.isArray(valor) ? valor[0] : valor;
  if (!v) return undefined;
  if (Object.hasOwn(ERROS, v)) return ERROS[v as CodigoErro];
  const m = /^s\.([A-Za-z0-9_-]{1,1600})\.([A-Za-z0-9_-]{32})$/.exec(v);
  const k = chave();
  if (!m || !k) return ERRO_GENERICO;
  const esperado = Buffer.from(assinar(k, m[1]!));
  const recebido = Buffer.from(m[2]!);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return ERRO_GENERICO;
  return Buffer.from(m[1]!, 'base64url').toString('utf8') || ERRO_GENERICO;
}
