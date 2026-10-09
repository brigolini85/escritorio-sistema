// Auditoria 6.2: o que a cópia e a restauração dividem (manifesto, buckets, guarda da produção, segredos fora do log).
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

export const BUCKETS = ['anexos', 'documentos', 'tarefas'] as const;
export const PROJETO_PRODUCAO_REF_PADRAO = 'xexinbtbzrjfgdxaaxla';
export const AMBIENTES = ['producao', 'homologacao', 'local'] as const;
export type Ambiente = (typeof AMBIENTES)[number];

export const ARQUIVO_BANCO = 'banco/public.dump';
export const ARQUIVO_AUTH = 'banco/auth.dump';
export const ARQUIVO_MANIFESTO = 'manifesto.json';

export type Manifesto = {
  versao: 1;
  /** Início da cópia (ISO). As entradas não processadas mais antigas que isso são marcadas na restauração. */
  criada_em: string;
  /** Última migração aplicada no banco copiado. */
  migracao: string | null;
  /** Contagem exata por tabela: `public.x`, `auth.users`, `auth.identities`. */
  tabelas: Record<string, number>;
  arquivos: { nome: string; sha256: string; bytes: number }[];
  objetos: { bucket: string; nome: string; arquivo: string; sha256: string; bytes: number; tipo: string | null }[];
};

export const NOME_TABELA = /^(public|auth)\.[a-z_][a-z0-9_]*$/;

/**
 * A URL é da produção quando o ref do projeto aparece no endereço (db.<ref>.supabase.co, <ref>.supabase.co) ou no usuário
 * (postgres.<ref> do pooler). A senha não conta.
 */
export function ehProducao(url: string, ref: string): boolean {
  if (!ref) return false;
  let u: URL;
  try { u = new URL(url); } catch { return url.includes(ref); }
  return u.hostname.toLowerCase().includes(ref.toLowerCase()) || decodeURIComponent(u.username).toLowerCase().includes(ref.toLowerCase());
}

/** Troca cada segredo por *** (mensagens de erro do pg_dump/psql e da API nunca levam senha nem chave para o log). */
export function ocultar(texto: string, segredos: (string | undefined)[]): string {
  let r = texto;
  for (const s of segredos) if (s && s.length >= 3) r = r.split(s).join('***');
  return r;
}

export function senhaDaUrl(url: string): string | undefined {
  try { return decodeURIComponent(new URL(url).password) || undefined; } catch { return undefined; }
}

export async function hashArquivo(caminho: string): Promise<{ sha256: string; bytes: number }> {
  const h = createHash('sha256');
  let bytes = 0;
  for await (const p of createReadStream(caminho)) { h.update(p as Buffer); bytes += (p as Buffer).length; }
  return { sha256: h.digest('hex'), bytes };
}

/** Caminho que a pessoa deu na linha de comando (o pnpm roda o script dentro de scripts/copia). */
export function caminhoDoUsuario(p: string): string {
  return isAbsolute(p) ? p : resolve(process.env.INIT_CWD ?? process.cwd(), p);
}

/** Endereço de um objeto do Storage (cada parte do nome codificada: nomes com espaço e acento). */
export function urlObjeto(supabaseUrl: string, bucket: string, nome: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${bucket}/${nome.split('/').map(encodeURIComponent).join('/')}`;
}

export function cabecalhosServico(chaveServico: string): Record<string, string> {
  return { apikey: chaveServico, Authorization: `Bearer ${chaveServico}` };
}

export function argumento(args: string[], nome: string): string | undefined {
  const i = args.indexOf(nome);
  if (i < 0) return undefined;
  const v = args[i + 1];
  if (!v || v.startsWith('--')) throw new Error(`${nome} precisa de um valor.`);
  return v;
}

/**
 * Ref do projeto de produção para a guarda. Vazio ou fora do formato do Supabase (20 letras minúsculas e números) volta ao
 * padrão: uma variável mal preenchida nunca desliga a guarda (revisão da Task 18).
 */
export function refProducao(valor: string | undefined): string {
  const v = (valor ?? '').trim();
  return /^[a-z0-9]{20}$/.test(v) ? v : PROJETO_PRODUCAO_REF_PADRAO;
}
