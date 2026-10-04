import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Cofre das senhas de portais (spec 7D.1 item 8, D1): AES-256-GCM no servidor do painel, com a chave fora do banco
 * (ACESSOS_PORTAIS_CHAVE, base64 de 32 bytes). O banco só guarda o texto cifrado e nunca decifra.
 */

/** Formato guardado no banco (a coluna recusa outro, migração 20261012000200): v1.<iv>.<etiqueta>.<cifra>, em base64url. */
export const FORMATO_CIFRADO = /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$/;

export class ErroCofre extends Error {}

/** Etiqueta inteira (16 bytes): o Node aceitaria etiqueta curta, que enfraquece a autenticação. */
const TAMANHO_ETIQUETA = 16;

/** Ausente ou com tamanho errado: o cofre fica desligado (D8). Nunca há chave padrão. */
function chave(): Buffer | null {
  const bruta = process.env.ACESSOS_PORTAIS_CHAVE?.trim();
  if (!bruta) return null;
  const k = Buffer.from(bruta, 'base64');
  return k.length === 32 ? k : null;
}

export function cofreConfigurado(): boolean {
  return chave() !== null;
}

/** Contexto autenticado da cifra: a senha de uma empresa não abre como se fosse de outra. */
export const contextoAcesso = (clienteId: string) => `acesso:${clienteId}`;

export function cifrar(texto: string, contexto: string): string {
  const k = chave();
  if (!k) throw new ErroCofre('Chave dos acessos não configurada.');
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', k, iv, { authTagLength: TAMANHO_ETIQUETA });
  c.setAAD(Buffer.from(contexto, 'utf8'));
  const cifra = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), cifra.toString('base64url')].join('.');
}

export function decifrar(cifrado: string, contexto: string): string {
  const k = chave();
  if (!k) throw new ErroCofre('Chave dos acessos não configurada.');
  if (!FORMATO_CIFRADO.test(cifrado)) throw new ErroCofre('Formato desconhecido.');
  const [, iv, etiqueta, cifra] = cifrado.split('.') as [string, string, string, string];
  try {
    const d = createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64url'), { authTagLength: TAMANHO_ETIQUETA });
    d.setAAD(Buffer.from(contexto, 'utf8'));
    d.setAuthTag(Buffer.from(etiqueta, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(cifra, 'base64url')), d.final()]).toString('utf8');
  } catch {
    // Etiqueta errada (chave, empresa ou cifra trocada): erro genérico, sem nada do conteúdo.
    throw new ErroCofre('Não foi possível abrir a senha.');
  }
}
