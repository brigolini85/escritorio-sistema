/** Parte I3b (spec 7E.6; D5, D6, D8): a pasta do cliente no Google Drive — regras puras do painel e do trabalhador. */
import { LIMITES_TAREFA, leituraDoArquivo, mimeDoArquivo } from './tarefas';

export const MIME_PASTA_DRIVE = 'application/vnd.google-apps.folder';
export const MIME_ATALHO_DRIVE = 'application/vnd.google-apps.shortcut';
export type MimeExportacao = 'application/pdf' | 'text/csv';
/** D6: o que é do próprio Google vira um tipo que o agente lê (o Drive exporta só a primeira aba de uma planilha). */
export const EXPORTAR_DO_DRIVE: Record<string, { mime: MimeExportacao; extensao: 'pdf' | 'csv' }> = {
  'application/vnd.google-apps.document': { mime: 'application/pdf', extensao: 'pdf' },
  'application/vnd.google-apps.presentation': { mime: 'application/pdf', extensao: 'pdf' },
  'application/vnd.google-apps.spreadsheet': { mime: 'text/csv', extensao: 'csv' },
};
export const LIMITES_DRIVE = { profundidade: 3, itensListados: 300, saltosAteAPasta: 10 } as const;
/** F13: 19 a 200 caracteres (mesmo formato que o banco aceita em clientes.drive_pasta_id). */
export const PADRAO_ID_DRIVE = /^[A-Za-z0-9_-]{19,200}$/;

/** D8: o link copiado do navegador (ou só o código) → o código da pasta. null = não é uma pasta do Drive. */
export function pastaDoLink(texto: string): string | null {
  const t = texto.trim();
  if (PADRAO_ID_DRIVE.test(t)) return t;
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.hostname !== 'drive.google.com') return null;
  const m = /^\/drive\/(?:u\/\d+\/|mobile\/)?folders\/([A-Za-z0-9_-]+)\/?$/.exec(u.pathname);
  const id = m?.[1] ?? (u.pathname === '/open' ? u.searchParams.get('id') : null);
  return id && PADRAO_ID_DRIVE.test(id) ? id : null;
}
export const linkDaPasta = (id: string): string => `https://drive.google.com/drive/folders/${id}`;

export type ItemDrive = { id: string; nome: string; mime: string; tamanho: number | null; modificadoEm: string; pais: string[] };
export const ehPasta = (i: Pick<ItemDrive, 'mime'>): boolean => i.mime === MIME_PASTA_DRIVE;

export type MotivoIgnorado = 'tipo' | 'grande' | 'atalho' | 'outra_pasta' | 'limite' | 'fora_da_pasta' | 'falha' | 'muitos';
/** Na linha do tempo e na tela: por que um arquivo da pasta não entrou na tarefa. */
export const TEXTO_IGNORADO: Record<MotivoIgnorado, string> = {
  tipo: 'o agente não lê este tipo',
  grande: 'passa de 10 MB',
  atalho: 'é um atalho (o agente não segue atalhos)',
  outra_pasta: 'é a pasta de outro cliente',
  limite: 'a tarefa já tem 30 arquivos',
  fora_da_pasta: 'está fora da pasta deste cliente',
  falha: 'o Drive não entregou o arquivo',
  muitos: 'mais de 300 itens, leia uma subpasta',
};

export type ComoLer =
  | { acao: 'baixar'; nome: string; mime: string }
  | { acao: 'exportar'; nome: string; mime: MimeExportacao }
  | { acao: 'ignorar'; motivo: MotivoIgnorado };

// Nome que vira nome de arquivo da tarefa: sem barra nem controle (o Storage e o download usam), até 180 com a extensão.
function nomeLimpo(nome: string, extensao: string | null): string {
  const base = nome.replace(/[\u0000-\u001f\u007f/\\]+/g, ' ').replace(/\s+/g, ' ').trim();
  const comExt = extensao && !base.toLowerCase().endsWith(`.${extensao}`) ? `${base}.${extensao}` : base;
  if (comExt.length <= 180) return comExt;
  const ext = /\.[A-Za-z0-9]{1,5}$/.exec(comExt)?.[0] ?? '';
  return `${comExt.slice(0, 180 - ext.length).trimEnd()}${ext}`;
}

/** F5: o mimeType que o Drive informa tem de ser compatível com a extensão (octet-stream e texto genérico só para formatos de texto). */
const MIMES_POR_EXTENSAO: Record<string, string[]> = {
  pdf: ['application/pdf'],
  jpg: ['image/jpeg'], jpeg: ['image/jpeg'], png: ['image/png'],
  xml: ['application/xml', 'text/xml', 'text/plain', 'application/octet-stream'],
  csv: ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream'],
  txt: ['text/plain', 'application/octet-stream'],
  ofx: ['text/plain', 'application/octet-stream', 'application/x-ofx', 'application/ofx', 'text/x-ofx'],
};
export function mimeBateComExtensao(mime: string, nome: string): boolean {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(nome.trim())?.[1]?.toLowerCase() ?? '';
  return (MIMES_POR_EXTENSAO[ext] ?? []).includes(mime.split(';')[0]!.trim().toLowerCase());
}
/** F5: um PDF de verdade começa com %PDF- (o trabalhador confere os bytes baixados). */
export function pdfValido(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

/** D6: o que fazer com um arquivo da pasta. Pasta não chega aqui (quem lista desce nela). */
export function comoLerDoDrive(i: ItemDrive): ComoLer {
  if (ehPasta(i)) throw new Error('comoLerDoDrive: pasta não é arquivo');
  if (i.mime === MIME_ATALHO_DRIVE) return { acao: 'ignorar', motivo: 'atalho' };
  if (!i.nome.trim()) return { acao: 'ignorar', motivo: 'tipo' };
  const exportar = EXPORTAR_DO_DRIVE[i.mime];
  if (exportar) return { acao: 'exportar', nome: nomeLimpo(i.nome, exportar.extensao), mime: exportar.mime };
  if (i.mime.startsWith('application/vnd.google-apps.')) return { acao: 'ignorar', motivo: 'tipo' };
  const nome = nomeLimpo(i.nome, null);
  if (!leituraDoArquivo(nome) || !mimeBateComExtensao(i.mime, nome)) return { acao: 'ignorar', motivo: 'tipo' };
  if (i.tamanho !== null && i.tamanho > LIMITES_TAREFA.arquivoBytes) return { acao: 'ignorar', motivo: 'grande' };
  return { acao: 'baixar', nome, mime: mimeDoArquivo(nome) };
}
