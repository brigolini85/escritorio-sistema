import { createPrivateKey, createSign, type KeyObject } from 'node:crypto';
import { LIMITES_TAREFA, type ItemDrive } from '@escritorio/core';
import { ErroDrive, type DriveLeitor } from './leitor';

/** D3: só leitura. É o único escopo pedido; o Google recusa qualquer gravação com ele. */
export const ESCOPO_DRIVE = 'https://www.googleapis.com/auth/drive.readonly';
/** F9: o token é pedido sempre aqui, diga o arquivo da chave o que disser (a assinatura não vai para outro endereço). */
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/drive/v3';
const CAMPOS = 'id,name,mimeType,size,modifiedTime,parents,trashed';
/** O código de um item do Drive: só letras, números, _ e -. Qualquer outra coisa nem vai ao Google (nada entra na consulta). */
const ID_DRIVE = /^[A-Za-z0-9_-]{1,200}$/;
/** F2: tempo-limite de cada chamada (token, metadados e lista; download e exportação). */
const TEMPOS = { curto: 30_000, longo: 120_000 };
const LISTADOS_NO_MAXIMO = 1000;

/** A chave fica num KeyObject: nem JSON.stringify nem console.log mostram o conteúdo dela. */
export type ContaServico = { email: string; chave: KeyObject };

let avisouTokenUri = false;

/** A variável GOOGLE_DRIVE_CONTA_SERVICO: o JSON da chave, inteiro ou em base64 (cabe numa linha do .env). */
export function lerContaServico(valor: string): ContaServico {
  const t = valor.trim();
  const texto = t.startsWith('{') ? t : Buffer.from(t, 'base64').toString('utf8');
  let j: unknown;
  try {
    j = JSON.parse(texto);
  } catch {
    // Mensagem fixa: o erro do JSON.parse citaria um trecho do texto (que é a chave).
    throw new Error('A chave da conta de serviço do Drive não é um JSON válido.');
  }
  const o = (j && typeof j === 'object' ? j : {}) as Record<string, unknown>;
  if (o.type !== 'service_account' || typeof o.client_email !== 'string' || !o.client_email || typeof o.private_key !== 'string') {
    throw new Error('A chave do Drive não é de uma conta de serviço.');
  }
  let chave: KeyObject;
  try {
    chave = createPrivateKey(o.private_key);
  } catch {
    throw new Error('A chave privada da conta de serviço do Drive é inválida.');
  }
  if (typeof o.token_uri === 'string' && o.token_uri !== TOKEN_URI && !avisouTokenUri) {
    avisouTokenUri = true;
    console.warn('[drive] o token_uri do arquivo da chave foi ignorado: o acesso é pedido sempre a oauth2.googleapis.com');
  }
  return { email: o.client_email, chave };
}

const b64url = (v: string) => Buffer.from(v).toString('base64url');
/** D2: o JWT da conta de serviço (RS256), trocado por um token de 1 hora. */
export function assinarJwt(c: ContaServico, agoraMs: number): string {
  const iat = Math.floor(agoraMs / 1000);
  const cab = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corpo = b64url(JSON.stringify({ iss: c.email, scope: ESCOPO_DRIVE, aud: TOKEN_URI, iat, exp: iat + 3600 }));
  try {
    const s = createSign('RSA-SHA256');
    s.update(`${cab}.${corpo}`);
    return `${cab}.${corpo}.${s.sign(c.chave).toString('base64url')}`;
  } catch {
    throw new ErroDrive('conta', 'A chave da conta de serviço do Drive não conseguiu assinar o pedido.');
  }
}

type ArquivoApi = { id: string; name: string; mimeType: string; size?: string; modifiedTime: string; parents?: string[]; trashed?: boolean };
const paraItem = (f: ArquivoApi): ItemDrive => {
  const tamanho = f.size === undefined ? null : Number(f.size);
  return { id: f.id, nome: f.name, mime: f.mimeType, tamanho: tamanho !== null && Number.isFinite(tamanho) ? tamanho : null, modificadoEm: f.modifiedTime, pais: f.parents ?? [] };
};

/** Qualquer erro de rede, tempo esgotado ou corpo ilegível vira 'falha' com texto fixo (nada do erro original sai daqui). */
function semResposta(e: unknown): ErroDrive {
  if (e instanceof ErroDrive) return e;
  const nome = e && typeof e === 'object' ? (e as { name?: unknown }).name : undefined;
  if (nome === 'TimeoutError' || nome === 'AbortError') return new ErroDrive('falha', 'O Drive não respondeu a tempo.');
  return new ErroDrive('falha', 'O Drive não respondeu.');
}
const descartar = (r: Response) => { r.body?.cancel().catch(() => {}); };

async function motivoDoErro(r: Response): Promise<string> {
  try {
    const j = (await r.json()) as { error?: { errors?: { reason?: string }[] } };
    return j.error?.errors?.[0]?.reason ?? '';
  } catch {
    return '';
  }
}

/** F3: nunca guarda mais que 10 MB na memória; recusa pelo content-length e, sem ele, corta a leitura em fluxo. */
async function corpoLimitado(r: Response, textoGrande: string): Promise<Uint8Array> {
  const limite = LIMITES_TAREFA.arquivoBytes;
  const declarado = Number(r.headers.get('content-length') ?? '');
  if (Number.isFinite(declarado) && declarado > limite) {
    descartar(r);
    throw new ErroDrive('grande', textoGrande);
  }
  if (!r.body) return new Uint8Array();
  const leitor = r.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.byteLength;
      if (total > limite) {
        leitor.cancel().catch(() => {});
        throw new ErroDrive('grande', textoGrande);
      }
      partes.push(value);
    }
  } catch (e) {
    throw semResposta(e);
  }
  const tudo = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    tudo.set(p, pos);
    pos += p.byteLength;
  }
  return tudo;
}

async function lerJson<T>(r: Response): Promise<T> {
  try {
    return (await r.json()) as T;
  } catch (e) {
    throw semResposta(e);
  }
}

const RECUSADO_POR_LIMITE = new Set(['userRateLimitExceeded', 'rateLimitExceeded', 'dailyLimitExceeded']);
const NAO_ENTREGA = new Set(['fileNotDownloadable', 'fileNotExportable', 'cannotExportFile', 'cannotDownloadAbusiveFile']);

export function criarDriveGoogle(
  c: ContaServico, buscar: typeof fetch = fetch, relogio: () => number = Date.now, tempos: { curto: number; longo: number } = TEMPOS,
): DriveLeitor {
  let token: { valor: string; vence: number } | null = null;
  let pedindo: Promise<string> | null = null;

  async function pedir(url: string, init: RequestInit, ms: number): Promise<Response> {
    try {
      return await buscar(url, { ...init, signal: AbortSignal.timeout(ms) });
    } catch (e) {
      throw semResposta(e);
    }
  }

  async function novoToken(): Promise<string> {
    const r = await pedir(TOKEN_URI, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: assinarJwt(c, relogio()) }).toString(),
    }, tempos.curto);
    if (!r.ok) {
      // O corpo da recusa não é lido nem repassado (só o código HTTP).
      descartar(r);
      if (r.status >= 500 || r.status === 429) throw new ErroDrive('falha', `O Google não respondeu ao pedido de acesso ao Drive (${r.status}).`);
      throw new ErroDrive('conta', `O Google recusou a conta do Drive do escritório (${r.status}).`);
    }
    const j = await lerJson<{ access_token?: unknown; expires_in?: unknown }>(r);
    if (typeof j.access_token !== 'string' || !j.access_token) throw new ErroDrive('falha', 'O Google não entregou o acesso ao Drive.');
    const segundos = Number(j.expires_in);
    token = { valor: j.access_token, vence: relogio() + (Number.isFinite(segundos) && segundos > 0 ? segundos : 3600) * 1000 };
    return token.valor;
  }

  /** O token fica guardado até 60 s antes de vencer; pedidos ao mesmo tempo esperam o mesmo token. */
  async function acesso(): Promise<string> {
    if (token && token.vence - 60_000 > relogio()) return token.valor;
    pedindo ??= novoToken().finally(() => { pedindo = null; });
    return pedindo;
  }

  // Só GET: nenhuma chamada deste arquivo muda algo no Drive (D3).
  async function get(caminho: string, q: Record<string, string>, ms: number): Promise<Response> {
    const url = `${API}${caminho}?${new URLSearchParams(q).toString()}`;
    const r = await pedir(url, { method: 'GET', headers: { authorization: `Bearer ${await acesso()}` } }, ms);
    if (r.ok) return r;
    const motivo = await motivoDoErro(r);
    if (r.status === 401) {
      token = null;
      throw new ErroDrive('conta', 'O Google recusou a conta do Drive do escritório (401).');
    }
    if (r.status === 404) throw new ErroDrive('nao_encontrado', 'Não encontrado no Drive.');
    if (motivo === 'exportSizeLimitExceeded') throw new ErroDrive('grande', 'O arquivo é grande demais para exportar.');
    if (motivo === 'accessNotConfigured') throw new ErroDrive('conta', 'A API do Drive não está ligada para a conta do escritório.');
    if (r.status === 429 || r.status >= 500 || RECUSADO_POR_LIMITE.has(motivo)) throw new ErroDrive('falha', `O Drive respondeu ${r.status}.`);
    if (NAO_ENTREGA.has(motivo)) throw new ErroDrive('falha', 'O Drive não entrega este arquivo.');
    if (r.status === 403) throw new ErroDrive('sem_acesso', 'A conta do Drive do escritório não tem acesso.');
    throw new ErroDrive('falha', `O Drive respondeu ${r.status}.`);
  }
  // F12: os parâmetros das unidades compartilhadas só nas chamadas files.*.
  const arquivos = (id: string, sufixo = '') => `/files/${encodeURIComponent(id)}${sufixo}`;
  const exigirId = (id: string) => {
    if (!ID_DRIVE.test(id)) throw new ErroDrive('nao_encontrado', 'Não encontrado no Drive.');
  };

  return {
    email: c.email,
    async verificar() {
      descartar(await get('/about', { fields: 'user(emailAddress)' }, tempos.curto));
    },
    async item(id) {
      if (!ID_DRIVE.test(id)) return null;
      try {
        const f = await lerJson<ArquivoApi>(await get(arquivos(id), { supportsAllDrives: 'true', fields: CAMPOS }, tempos.curto));
        return f.trashed ? null : paraItem(f);
      } catch (e) {
        if (e instanceof ErroDrive && e.codigo === 'nao_encontrado') return null;
        throw e;
      }
    },
    async listar(pastaId) {
      exigirId(pastaId);
      const itens: ItemDrive[] = [];
      let pagina: string | undefined;
      do {
        const j = await lerJson<{ nextPageToken?: string; files?: ArquivoApi[] }>(await get('/files', {
          q: `'${pastaId}' in parents and trashed = false`, fields: `nextPageToken,files(${CAMPOS})`, pageSize: '200',
          corpora: 'allDrives', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', ...(pagina ? { pageToken: pagina } : {}),
        }, tempos.curto));
        itens.push(...(j.files ?? []).filter((f) => !f.trashed).map(paraItem));
        pagina = j.nextPageToken;
      } while (pagina && itens.length < LISTADOS_NO_MAXIMO);
      return itens;
    },
    async baixar(id) {
      exigirId(id);
      return corpoLimitado(await get(arquivos(id), { supportsAllDrives: 'true', alt: 'media' }, tempos.longo), 'O arquivo passa de 10 MB.');
    },
    async exportar(id, mime) {
      exigirId(id);
      return corpoLimitado(await get(arquivos(id, '/export'), { mimeType: mime }, tempos.longo), 'O arquivo exportado passa de 10 MB.');
    },
  };
}

/** D3: sem a variável, o Drive não está configurado; chave inválida não derruba o trabalhador. */
export function driveDoAmbiente(valor: string | undefined): { leitor: DriveLeitor | null; erro: string | null } {
  if (!valor?.trim()) return { leitor: null, erro: null };
  try {
    return { leitor: criarDriveGoogle(lerContaServico(valor)), erro: null };
  } catch (e) {
    // lerContaServico só lança mensagens fixas; qualquer outra coisa vira o texto genérico (nunca o erro original).
    const fixas = ['A chave da conta de serviço do Drive não é um JSON válido.', 'A chave do Drive não é de uma conta de serviço.', 'A chave privada da conta de serviço do Drive é inválida.'];
    const m = e instanceof Error ? e.message : '';
    return { leitor: null, erro: fixas.includes(m) ? m : 'A chave do Drive não pôde ser lida.' };
  }
}
