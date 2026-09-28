import type { Db } from '@escritorio/db';

export interface ArmazenamentoMidia {
  baixarESalvar(url: string, conversaId: string, nomeArquivo: string, mime: string | null): Promise<{ path: string; bytes: Uint8Array; mime: string }>;
  ler(path: string): Promise<Uint8Array>;
  urlAssinada(path: string, segundos: number, bucket?: string): Promise<string>;
  remover(paths: string[]): Promise<void>;
}

const BUCKET = 'anexos';

function nomeSeguro(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80);
}

export function criarArmazenamento(db: Db, buscar: typeof fetch = fetch): ArmazenamentoMidia {
  return {
    async baixarESalvar(url, conversaId, nomeArquivo, mime) {
      const r = await buscar(url);
      if (!r.ok) throw new Error(`download da mídia falhou: ${r.status}`);
      const bytes = new Uint8Array(await r.arrayBuffer());
      const tipo = mime ?? r.headers.get('content-type') ?? 'application/octet-stream';
      const path = `conversas/${conversaId}/${Date.now()}-${nomeSeguro(nomeArquivo)}`;
      const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: tipo });
      if (error) throw new Error(`upload falhou: ${error.message}`);
      return { path, bytes, mime: tipo };
    },
    async ler(path) {
      const { data, error } = await db.storage.from(BUCKET).download(path);
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
