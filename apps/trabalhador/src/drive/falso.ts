import { EXPORTAR_DO_DRIVE, LIMITES_TAREFA, MIME_PASTA_DRIVE, type ItemDrive } from '@escritorio/core';
import { ErroDrive, type DriveLeitor } from './leitor';

/**
 * Um item do Drive falso. `lixeira`: some da lista e do item(), como no Google; `semAcesso`: a conta do escritório
 * não pode ler (403, sem_acesso). Atalhos, pastas de unidades compartilhadas e arquivos com dois pais são itens comuns
 * (mime do atalho, `pais` com mais de uma pasta), como o Google devolve.
 */
export type ArquivoFalso = ItemDrive & { conteudo?: string | Uint8Array; exportado?: string | Uint8Array; lixeira?: boolean; semAcesso?: boolean };
const bytes = (v: string | Uint8Array | undefined) => (typeof v === 'string' ? new TextEncoder().encode(v) : v ? new Uint8Array(v) : new Uint8Array());
const semConteudo = ({ conteudo: _c, exportado: _e, lixeira: _l, semAcesso: _s, pais, ...i }: ArquivoFalso): ItemDrive => ({ ...i, pais: [...pais] });

/** Parte I3b: um Drive em memória para testes e cenários (nada vai ao Google). Anota o que foi listado e baixado. */
export function criarDriveFalso(itens: ArquivoFalso[], email = 'drive-teste@escritorio.iam.gserviceaccount.com') {
  const porId = new Map(itens.map((i) => [i.id, i]));
  const baixados: string[] = [];
  const listados: string[] = [];
  const achar = (id: string) => {
    const i = porId.get(id);
    if (!i) throw new ErroDrive('nao_encontrado', 'Não encontrado no Drive.');
    if (i.semAcesso) throw new ErroDrive('sem_acesso', 'A conta do Drive do escritório não tem acesso.');
    return i;
  };
  const limitado = (b: Uint8Array) => {
    if (b.byteLength > LIMITES_TAREFA.arquivoBytes) throw new ErroDrive('grande', 'O arquivo passa de 10 MB.');
    return b;
  };
  const leitor: DriveLeitor & { baixados: string[]; listados: string[] } = {
    email, baixados, listados,
    async verificar() {},
    async item(id) {
      const i = porId.get(id);
      if (i?.semAcesso) throw new ErroDrive('sem_acesso', 'A conta do Drive do escritório não tem acesso.');
      return i && !i.lixeira ? semConteudo(i) : null;
    },
    async listar(pastaId) {
      listados.push(pastaId);
      if (achar(pastaId).mime !== MIME_PASTA_DRIVE) throw new ErroDrive('nao_encontrado', 'Não é pasta.');
      return itens.filter((i) => !i.lixeira && i.pais.includes(pastaId)).map(semConteudo);
    },
    async baixar(id) {
      baixados.push(id);
      const i = achar(id);
      // O tamanho declarado conta como o content-length do Google (F3).
      if (i.tamanho !== null && i.tamanho > LIMITES_TAREFA.arquivoBytes) throw new ErroDrive('grande', 'O arquivo passa de 10 MB.');
      return limitado(bytes(i.conteudo));
    },
    async exportar(id) {
      baixados.push(id);
      const i = achar(id);
      if (!EXPORTAR_DO_DRIVE[i.mime] || i.exportado === undefined) throw new ErroDrive('falha', 'O Drive não entrega este arquivo.');
      return limitado(bytes(i.exportado));
    },
  };
  return leitor;
}
