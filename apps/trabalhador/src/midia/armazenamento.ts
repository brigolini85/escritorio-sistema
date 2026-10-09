import type { Db } from '@escritorio/db';

export interface ArmazenamentoMidia {
  baixarESalvar(url: string, conversaId: string, nomeArquivo: string, mime: string | null): Promise<{ path: string; bytes: Uint8Array; mime: string }>;
  ler(path: string, bucket?: string): Promise<Uint8Array>;
  urlAssinada(path: string, segundos: number, bucket?: string): Promise<string>;
  remover(paths: string[]): Promise<void>;
}

/** Revisão geral I6: o arquivo do cliente acima disto não é baixado (o WhatsApp aceita até 2 GB; a máquina tem pouca memória). */
export const LIMITE_DOWNLOAD_BYTES = 20 * 1024 * 1024;
/** Revisão geral I6/I9: prazo do download da mídia na Z-API. */
const PRAZO_DOWNLOAD_MS = 60_000;

export class ArquivoGrandeDemais extends Error {
  constructor() { super(`arquivo maior que ${LIMITE_DOWNLOAD_BYTES / (1024 * 1024)} MB`); }
}

const BUCKET = 'anexos';

/** Auditoria 3.5: a Z-API entrega a mídia por estes domínios (as capturas reais usam f004.backblazeb2.com). Configurável por MIDIA_HOSTS_PERMITIDOS. */
export const MIDIA_HOSTS_PADRAO = ['z-api.io', 'backblazeb2.com', 'storage.googleapis.com'];
const MAX_SALTOS = 3;

/** Só o host (sem caminho nem consulta) para a mensagem de erro e o log. */
function hostParaLog(url: string): string {
  try { return new URL(url).host.slice(0, 100); } catch { return 'inválido'; }
}

/** Só https, host por nome (nunca IP literal nem localhost) e dentro da lista (o próprio domínio ou subdomínio dele). */
export function hostPermitido(url: string, hosts: readonly string[] = MIDIA_HOSTS_PADRAO): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!h || h === 'localhost' || h.includes(':') || h.startsWith('[') || /^[\d.]+$/.test(h)) return false;
  return hosts.some((d) => h === d || h.endsWith(`.${d}`));
}

function nomeSeguro(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80);
}

/** Lê o corpo até o limite; passou, cancela a leitura e recusa (I6). */
async function lerComLimite(r: Response): Promise<Uint8Array> {
  const tamanho = Number(r.headers.get('content-length') ?? NaN);
  if (Number.isFinite(tamanho) && tamanho > LIMITE_DOWNLOAD_BYTES) {
    await r.body?.cancel().catch(() => undefined);
    throw new ArquivoGrandeDemais();
  }
  if (!r.body) return new Uint8Array(await r.arrayBuffer());
  const pedacos: Uint8Array[] = [];
  let total = 0;
  const leitor = r.body.getReader();
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.length;
    if (total > LIMITE_DOWNLOAD_BYTES) {
      await leitor.cancel().catch(() => undefined);
      throw new ArquivoGrandeDemais();
    }
    pedacos.push(value);
  }
  const bytes = new Uint8Array(total);
  let pos = 0;
  for (const p of pedacos) { bytes.set(p, pos); pos += p.length; }
  return bytes;
}

export function criarArmazenamento(db: Db, buscar: typeof fetch = fetch, hosts: readonly string[] = MIDIA_HOSTS_PADRAO): ArmazenamentoMidia {
  /** Auditoria 3.5: cada salto de redirecionamento é conferido contra a lista antes de ser seguido. */
  async function buscarSeguro(urlInicial: string): Promise<Response> {
    let url = urlInicial;
    for (let salto = 0; salto <= MAX_SALTOS; salto++) {
      if (!hostPermitido(url, hosts)) throw new Error(`endereço da mídia não permitido: ${hostParaLog(url)}`);
      const r = await buscar(url, { signal: AbortSignal.timeout(PRAZO_DOWNLOAD_MS), redirect: 'manual' });
      if (r.status < 300 || r.status >= 400) return r;
      const destino = r.headers.get('location');
      await r.body?.cancel().catch(() => undefined);
      if (!destino) throw new Error('redirecionamento sem destino');
      try { url = new URL(destino, url).toString(); } catch { throw new Error('endereço da mídia não permitido: destino inválido'); }
    }
    throw new Error('redirecionamentos demais no download da mídia');
  }
  return {
    async baixarESalvar(url, conversaId, nomeArquivo, mime) {
      const r = await buscarSeguro(url);
      if (!r.ok) throw new Error(`download da mídia falhou: ${r.status}`);
      const bytes = await lerComLimite(r);
      const tipo = mime ?? r.headers.get('content-type') ?? 'application/octet-stream';
      const path = `conversas/${conversaId}/${Date.now()}-${nomeSeguro(nomeArquivo)}`;
      const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: tipo });
      if (error) throw new Error(`upload falhou: ${error.message}`);
      return { path, bytes, mime: tipo };
    },
    async ler(path, bucket = BUCKET) {
      const { data, error } = await db.storage.from(bucket).download(path);
      if (error || !data) throw new Error(`leitura falhou: ${error?.message}`);
      return new Uint8Array(await data.arrayBuffer());
    },
    async urlAssinada(path, segundos, bucket = BUCKET) {
      const { data, error } = await db.storage.from(bucket).createSignedUrl(path, segundos);
      if (error || !data) throw new Error(`url assinada falhou: ${error?.message}`);
      return data.signedUrl;
    },
    async remover(paths) {
      if (paths.length === 0) return;
      const { error } = await db.storage.from(BUCKET).remove(paths);
      if (error) throw new Error(`remoção falhou: ${error.message}`);
    },
  };
}
