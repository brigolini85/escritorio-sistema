/**
 * Auditoria 6.9: tipos que os compartimentos "anexos" e "documentos" aceitam. É a mesma lista de allowed_mime_types da
 * migração 20261030000900 (um teste do trabalhador compara com o Storage). O Storage compara o tipo inteiro, sem curinga:
 * "image/*" aceitaria image/svg+xml, que o navegador executa.
 */
export const TIPO_GENERICO = 'application/octet-stream';

const COMUNS = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/tiff', 'image/bmp',
  'text/xml', 'application/xml', 'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
  'application/vnd.oasis.opendocument.text',
  'application/zip', 'application/x-zip-compressed',
] as const;

/** anexos: o que chega do WhatsApp e o que a equipe anexa na resposta. As duas grafias do opus são do trabalhador antigo. */
export const TIPOS_ANEXOS: readonly string[] = [
  ...COMUNS,
  'audio/ogg', 'audio/ogg; codecs=opus', 'audio/ogg;codecs=opus', 'audio/opus', 'audio/mpeg', 'audio/mp4', 'audio/aac',
  'audio/amr', 'audio/webm', 'audio/wav', 'audio/x-wav',
  'video/mp4', 'video/3gpp', 'video/quicktime',
  'application/x-ofx', 'application/ofx',
  TIPO_GENERICO,
];

/** documentos: os documentos da empresa que a equipe sobe no painel (sem o genérico: o tipo precisa ser conhecido). */
export const TIPOS_DOCUMENTOS: readonly string[] = [...COMUNS, 'audio/ogg', 'audio/mpeg', 'audio/mp4'];

/** Tipo sem parâmetros e em minúsculas ("Audio/OGG; codecs=opus" → "audio/ogg"); vazio fica vazio. */
export function tipoBase(tipo: string | null | undefined): string {
  return (tipo ?? '').split(';')[0]!.trim().toLowerCase();
}

/**
 * Tipo com que o arquivo sobe ao Storage. Fora da lista, sobe como application/octet-stream (o navegador só baixa) e a
 * mensagem guarda o tipo original: um .pfx ou .rar do cliente não se perde.
 */
export function tipoParaArmazenar(tipo: string | null | undefined, aceitos: readonly string[]): string {
  const t = tipoBase(tipo);
  return t && aceitos.includes(t) ? t : TIPO_GENERICO;
}
