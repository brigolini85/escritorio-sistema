import type { Db } from '@escritorio/db';

/** Parte I3b (D4): o compartimento "tarefas" (ArmazenamentoMidia é de "anexos" e muitos testes antigos usam a interface dele). */
export type GuardarArquivo = (caminho: string, bytes: Uint8Array, mime: string) => Promise<void>;
export type RemoverArquivos = (caminhos: string[]) => Promise<void>;

export function guardarNaTarefa(db: Db): GuardarArquivo {
  return async (caminho, bytes, mime) => {
    const { error } = await db.storage.from('tarefas').upload(caminho, bytes, { contentType: mime, upsert: false });
    if (error) throw new Error(`upload falhou: ${error.message}`);
  };
}
export function removerDaTarefa(db: Db): RemoverArquivos {
  return async (caminhos) => {
    if (caminhos.length === 0) return;
    const { error } = await db.storage.from('tarefas').remove(caminhos);
    if (error) throw new Error(`remoção falhou: ${error.message}`);
  };
}
