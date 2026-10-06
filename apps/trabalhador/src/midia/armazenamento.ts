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

export function criarArmazenamento(db: Db, buscar: typeof fetch = fetch): ArmazenamentoMidia {
  return {
    async baixarESalvar(url, conversaId, nomeArquivo, mime) {
      const r = await buscar(url, { signal: AbortSignal.timeout(PRAZO_DOWNLOAD_MS) });
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
