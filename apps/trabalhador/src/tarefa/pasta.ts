import {
  LIMITES_DRIVE, LIMITES_TAREFA, TEXTO_IGNORADO, comoLerDoDrive, ehPasta, pdfValido, type ComoLer, type ItemDrive, type MotivoIgnorado,
} from '@escritorio/core';
import { SemI3b, type PastaDaTarefa, type Repos } from '@escritorio/db';
import { ErroDrive, type DriveLeitor } from '../drive/leitor';
import { ERRO_CONTA_DRIVE } from '../drive/situacao';
import type { GuardarArquivo, RemoverArquivos } from './armazenamento';

export type Ignorado = { nome: string; motivo: MotivoIgnorado };
export type ComoLerArquivo = Exclude<ComoLer, { acao: 'ignorar' }>;
export class ForaDaPasta extends Error {
  constructor() { super('Arquivo fora da pasta deste cliente.'); }
}
/** F5: o conteúdo não é do tipo que o nome diz (um ".pdf" que não é PDF iria à IA e derrubaria a vez). */
class ConteudoNaoBate extends Error {}
/** A subpasta pedida (por nomes) não existe dentro da pasta do cliente; a pasta do cliente em si foi achada. */
class SubpastaNaoAchada extends ErroDrive {}

/** F4: o texto fixo quando a leitura da pasta lança algo inesperado (a vez segue sem a pasta). */
export const FALHA_LEITURA_PASTA = 'O Drive não respondeu agora. Tente de novo mais tarde.';
/** F16: nome do Drive que vai à linha do tempo e ao modelo: sem controle nem barra, até 100 letras. */
const NOMES_NO_MAXIMO = 20;
export const nomeParaMostrar = (nome: string): string =>
  nome.replace(/[\u0000-\u001f\u007f/\\]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100).trimEnd() || '(sem nome)';

const ehJpeg = (b: Uint8Array) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const ehPng = (b: Uint8Array) => b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
function conteudoBate(mime: string, b: Uint8Array): boolean {
  if (mime === 'application/pdf') return pdfValido(b);
  if (mime === 'image/jpeg') return ehJpeg(b);
  if (mime === 'image/png') return ehPng(b);
  return true;
}

/** D5 (barreiras 2 e 3): tudo o que sai do Drive para uma tarefa passa por aqui. */
export class PastaDoCliente {
  private readonly vistos = new Map<string, ItemDrive>();
  constructor(private readonly drive: DriveLeitor, readonly pastaId: string, private readonly outras: ReadonlySet<string>) {}

  /** Subpasta por nomes ("2026/10"), descendo só por pastas deste cliente. */
  private async acharSubpasta(caminho: string): Promise<string> {
    let atual = this.pastaId;
    for (const nome of caminho.split('/').map((x) => x.trim()).filter(Boolean).slice(0, 5)) {
      const achada = (await this.drive.listar(atual)).find((i) => ehPasta(i) && !this.outras.has(i.id)
        && i.nome.trim().toLowerCase() === nome.toLowerCase());
      if (!achada) throw new SubpastaNaoAchada('nao_encontrado', `Subpasta "${caminho}" não encontrada.`);
      atual = achada.id;
    }
    return atual;
  }

  /**
   * Lista a partir da pasta do cliente: até 3 níveis; a pasta de outro cliente fica de fora (nem é listada).
   * F7: no item 301 a listagem para em todos os níveis e avisa uma vez ("muitos").
   */
  async listar(subpasta: string | null): Promise<{ arquivos: ItemDrive[]; ignorados: Ignorado[] }> {
    const arquivos: ItemDrive[] = [];
    const ignorados: Ignorado[] = [];
    let nivel = [subpasta?.trim() ? await this.acharSubpasta(subpasta) : this.pastaId];
    let contados = 0;
    niveis: for (let prof = 0; prof < LIMITES_DRIVE.profundidade && nivel.length > 0; prof++) {
      const proximo: string[] = [];
      for (const pasta of nivel) {
        for (const i of await this.drive.listar(pasta)) {
          if (++contados > LIMITES_DRIVE.itensListados) {
            ignorados.push({ nome: subpasta?.trim() ? nomeParaMostrar(subpasta) : 'pasta do cliente', motivo: 'muitos' });
            break niveis;
          }
          if (ehPasta(i)) {
            if (this.outras.has(i.id)) ignorados.push({ nome: i.nome, motivo: 'outra_pasta' });
            else proximo.push(i.id);
            continue;
          }
          this.vistos.set(i.id, i);
          arquivos.push(i);
        }
      }
      nivel = proximo;
    }
    arquivos.sort((a, b) => b.modificadoEm.localeCompare(a.modificadoEm));
    return { arquivos, ignorados };
  }

  /** A ascendência chega a esta pasta sem passar pela de outro cliente (um pai em outro cliente já recusa). */
  async dentroDaPasta(id: string): Promise<boolean> {
    let atual = [id];
    for (let salto = 0; salto < LIMITES_DRIVE.saltosAteAPasta; salto++) {
      const pais = new Set<string>();
      for (const x of atual) {
        const it = await this.drive.item(x);
        if (!it) return false;
        it.pais.forEach((p) => pais.add(p));
      }
      if ([...pais].some((p) => this.outras.has(p))) return false;
      if (pais.has(this.pastaId)) return true;
      if (pais.size === 0) return false;
      atual = [...pais];
    }
    return false;
  }

  async ler(i: ItemDrive, como: ComoLerArquivo): Promise<Uint8Array> {
    if (!this.vistos.has(i.id) || !(await this.dentroDaPasta(i.id))) throw new ForaDaPasta();
    const bytes = como.acao === 'exportar' ? await this.drive.exportar(i.id, como.mime) : await this.drive.baixar(i.id);
    if (bytes.length > LIMITES_TAREFA.arquivoBytes) throw new ErroDrive('grande', 'passa de 10 MB');
    if (bytes.length > 0 && !conteudoBate(como.mime, bytes)) throw new ConteudoNaoBate();
    return bytes;
  }
}

export type DepsPasta = { repos: Repos; drive: DriveLeitor | null; guardar: GuardarArquivo; remover: RemoverArquivos; relogio: () => Date };
export type LeituraDaPasta =
  | { situacao: 'sem_drive' | 'sem_pasta' | 'sem_i3b' | 'decidida' }
  | { situacao: 'erro'; mensagem: string }
  | { situacao: 'lida'; novos: string[]; ignorados: Ignorado[] };

/** F16: o que ficou de fora para o modelo: até 20 nomes limpos e "e mais N". */
export function ficaramDeFora(ignorados: Ignorado[]): string[] {
  const lista = ignorados.slice(0, NOMES_NO_MAXIMO).map((x) => `${nomeParaMostrar(x.nome)}: ${TEXTO_IGNORADO[x.motivo]}`);
  return ignorados.length > NOMES_NO_MAXIMO ? [...lista, `e mais ${ignorados.length - NOMES_NO_MAXIMO}`] : lista;
}

/** A linha do tempo: quantos entraram e o que ficou de fora (até 20 nomes limpos, F16), em até 500 letras. */
export function textoDaLeitura(novos: string[], ignorados: Ignorado[]): string {
  const n = novos.length;
  const t = `leu a pasta do Drive: ${n} arquivo${n === 1 ? ' novo' : 's novos'}`;
  if (!ignorados.length) return t;
  const cab = `${t}; ficaram de fora: `;
  const partes: string[] = [];
  const fim = (k: number) => (ignorados.length > k ? `${k ? ' ' : ''}e mais ${ignorados.length - k}` : '');
  for (const x of ignorados.slice(0, NOMES_NO_MAXIMO)) {
    const p = `${nomeParaMostrar(x.nome)} (${TEXTO_IGNORADO[x.motivo]})`;
    if ((cab + [...partes, p].join(', ') + fim(partes.length + 1)).length > 500) break;
    partes.push(p);
  }
  return (cab + partes.join(', ') + fim(partes.length)).slice(0, 500);
}
const quando = (x: string | null) => {
  if (!x) return '';
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? x : d.toISOString();
};
const chave = (id: string, modificado: string | null) => `${id}|${quando(modificado)}`;
let avisouSemI3b = false;

/** O texto do erro de listagem, pelo código do Drive (F1, F6). */
function mensagemDoErro(e: unknown, email: string, subpasta: string | null): string {
  if (e instanceof SubpastaNaoAchada) return `Não achei a subpasta "${nomeParaMostrar(subpasta ?? '').slice(0, 80)}" na pasta do cliente.`;
  const codigo = e instanceof ErroDrive ? e.codigo : 'falha';
  if (codigo === 'conta') return ERRO_CONTA_DRIVE;
  if (codigo === 'sem_acesso') return `A pasta do Drive deste cliente não foi compartilhada com ${email} (como Leitor).`;
  if (codigo === 'nao_encontrado') return `A pasta do Drive deste cliente não foi encontrada ou não foi compartilhada com ${email} (como Leitor).`;
  return 'O Drive não respondeu agora. Leia a pasta de novo mais tarde.';
}

/** D4–D7: traz para a tarefa os arquivos novos da pasta do cliente. Nunca baixa nada fora dela. */
export async function lerPastaDaTarefa(d: DepsPasta, tarefaId: string, subpasta: string | null = null): Promise<LeituraDaPasta> {
  let p: PastaDaTarefa | null;
  try {
    p = await d.repos.pastaDriveDaTarefa(tarefaId);
  } catch (e) {
    if (!(e instanceof SemI3b)) throw e;
    if (!avisouSemI3b) { avisouSemI3b = true; console.warn('[drive] o banco ainda não tem a Parte I3b: a pasta do cliente não é lida'); }
    return { situacao: 'sem_i3b' };
  }
  if (!p || p.estado === 'aprovada' || p.estado === 'descartada') return { situacao: 'decidida' };
  if (!d.drive) return { situacao: 'sem_drive' };
  if (!p.pasta) return { situacao: 'sem_pasta' };
  const email = d.drive.email;
  const pasta = new PastaDoCliente(d.drive, p.pasta, new Set(p.outras));
  let lista: Awaited<ReturnType<PastaDoCliente['listar']>>;
  try {
    lista = await pasta.listar(subpasta);
  } catch (e) {
    const mensagem = mensagemDoErro(e, email, subpasta);
    if (!(e instanceof ErroDrive)) console.error('[drive] a listagem falhou', tarefaId, e);
    await d.repos.eventoTarefa(tarefaId, `não leu a pasta do Drive: ${mensagem}`.slice(0, 500));
    // F1: só a conta recusada vai para a situação do Drive; erro de uma pasta fica na linha do tempo desta tarefa.
    if (e instanceof ErroDrive && e.codigo === 'conta') await d.repos.registrarSituacaoDrive({ email, erro: ERRO_CONTA_DRIVE }).catch(() => false);
    return { situacao: 'erro', mensagem };
  }
  const ja = new Set(p.importados.map((x) => chave(x.driveId, x.modificadoEm)));
  const ignorados: Ignorado[] = [...lista.ignorados];
  const novos: string[] = [];
  let total = p.total;
  let contaRecusada = false;
  for (const i of lista.arquivos) {
    const como = comoLerDoDrive(i);
    if (como.acao === 'ignorar') { ignorados.push({ nome: i.nome, motivo: como.motivo }); continue; }
    if (ja.has(chave(i.id, i.modificadoEm))) continue;
    if (total >= LIMITES_TAREFA.arquivos) { ignorados.push({ nome: i.nome, motivo: 'limite' }); continue; }
    let bytes: Uint8Array;
    try {
      bytes = await pasta.ler(i, como);
    } catch (e) {
      const motivo: MotivoIgnorado = e instanceof ForaDaPasta ? 'fora_da_pasta' : e instanceof ConteudoNaoBate ? 'tipo'
        : e instanceof ErroDrive && e.codigo === 'grande' ? 'grande' : 'falha';
      if (e instanceof ErroDrive && e.codigo === 'conta') contaRecusada = true;
      if (motivo === 'falha') console.error('[drive] arquivo não veio', tarefaId, i.id, e instanceof Error ? e.message : e);
      ignorados.push({ nome: i.nome, motivo });
      continue;
    }
    if (bytes.length === 0) { ignorados.push({ nome: i.nome, motivo: 'falha' }); continue; }
    const ext = /\.([A-Za-z0-9]{1,5})$/.exec(como.nome)?.[1]?.toLowerCase() ?? 'bin';
    const caminho = `${tarefaId}/drive/${i.id}-${d.relogio().getTime()}.${ext}`;
    try {
      await d.guardar(caminho, bytes, como.mime);
    } catch (e) {
      // F4: o Storage que falha deixa só este arquivo de fora; os outros seguem.
      console.error('[drive] o arquivo não foi guardado na tarefa', tarefaId, i.id, e instanceof Error ? e.message : e);
      ignorados.push({ nome: i.nome, motivo: 'falha' });
      continue;
    }
    try {
      const r = await d.repos.registrarArquivoDrive({ tarefaId, caminho, nome: como.nome, mime: como.mime, tamanho: bytes.length, driveId: i.id, modificadoEm: i.modificadoEm });
      novos.push(r.nome);
      total++;
    } catch (e) {
      // Nada pela metade no Storage: o objeto sai se o banco não aceitou o registro.
      await d.remover([caminho]).catch((e2) => console.error('[drive] o objeto ficou no Storage', caminho, e2));
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('já está na tarefa')) continue;
      if (msg.includes('30 arquivos')) { ignorados.push({ nome: i.nome, motivo: 'limite' }); total = LIMITES_TAREFA.arquivos; continue; }
      throw e;
    }
  }
  await d.repos.eventoTarefa(tarefaId, textoDaLeitura(novos, ignorados));
  // F1: a leitura que deu certo limpa o erro da conta (a não ser que a conta tenha sido recusada no meio).
  await d.repos.registrarSituacaoDrive({ email, erro: contaRecusada ? ERRO_CONTA_DRIVE : null }).catch(() => false);
  return { situacao: 'lida', novos, ignorados };
}

/** F4: a leitura da pasta que nunca derruba a vez (primeira vez, ferramenta, LER A PASTA DE NOVO na última tentativa). */
export async function lerPastaComAviso(d: DepsPasta, tarefaId: string, subpasta: string | null): Promise<LeituraDaPasta> {
  try {
    return await lerPastaDaTarefa(d, tarefaId, subpasta);
  } catch (e) {
    console.error('[drive] a leitura da pasta falhou', tarefaId, e instanceof Error ? e.message : e);
    await d.repos.eventoTarefa(tarefaId, `não leu a pasta do Drive: ${FALHA_LEITURA_PASTA}`)
      .catch((e2) => console.error('[drive] evento não gravado', tarefaId, e2));
    return { situacao: 'erro', mensagem: FALHA_LEITURA_PASTA };
  }
}
