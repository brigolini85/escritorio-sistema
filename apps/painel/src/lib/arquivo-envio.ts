import { TIPO_GENERICO, TIPOS_ANEXOS, TIPOS_DOCUMENTOS, caminhoDaEmpresa, tipoBase, tipoParaArmazenar } from '@escritorio/core';

/** Limite do compartimento "documentos" (migração 20261030000900). */
export const LIMITE_DOCUMENTO_EMPRESA_BYTES = 20 * 1024 * 1024;

/**
 * Anexo da resposta do painel (compartimento "anexos"). Auditoria 6.9 (revisão da Task 10): tipo fora da lista (.rar, .pfx)
 * sobe como application/octet-stream; a mensagem guarda o tipo original.
 */
export function prepararAnexoResposta(conversaId: string, nome: string, tipo: string, agora = Date.now()) {
  return {
    path: `conversas/${conversaId}/${agora}-${nome.replace(/[^\w.-]+/g, '_')}`,
    nome,
    mime: tipo || TIPO_GENERICO,
    contentType: tipoParaArmazenar(tipo, TIPOS_ANEXOS),
  };
}

/**
 * Documento da empresa (compartimento "documentos"), conferido antes de subir para não deixar arquivo sem linha.
 * Auditoria 1.3 e revisão da Task 10: o nome perde acentos, barras e ".." (vira "."), e o caminho fica em clientes/<id>/.
 */
export function prepararDocumentoEmpresa(clienteId: string, nome: string, tipo: string, tamanho: number, agora = Date.now()):
  { path: string; arquivoNome: string; mime: string } | { erro: string } {
  const mime = tipoBase(tipo) || 'application/pdf';
  if (!TIPOS_DOCUMENTOS.includes(mime)) return { erro: 'Tipo de arquivo não aceito. Envie PDF, imagem, planilha, Word, XML ou ZIP.' };
  if (tamanho > LIMITE_DOCUMENTO_EMPRESA_BYTES) return { erro: 'O arquivo passa de 20 MB.' };
  const arquivoNome = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').replace(/\.{2,}/g, '.');
  const path = `clientes/${clienteId}/${agora}-${arquivoNome}`;
  if (!caminhoDaEmpresa(clienteId, path)) return { erro: 'Não foi possível montar o caminho do arquivo.' };
  return { path, arquivoNome, mime };
}
