import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Repos } from '@escritorio/db';
import type { Alertas } from './alertas';
import type { Ambiente } from './canal/trava';
import type { FalhaProcesso } from './servidor';

/**
 * Auditoria 4.3: depois de uma implantação, um contêiner antigo ligado ao mesmo banco (com outro AMBIENTE ou outro código)
 * atendia metade das conversas. Aqui ficam a conferência da partida (AMBIENTE do processo contra o do banco) e o batimento
 * de cada processo (registra a instância e vê se há outra viva).
 */
export type Instancia = { id: string; hostname: string; ambiente: string; versao: string; buildEm: string | null };

/**
 * Revisão: a versão e a data do build vêm da imagem (Dockerfile.trabalhador grava `versao`, um resumo do dist, e
 * `build_em`), sem depender de alguém informar algo a cada publicação. VERSAO do ambiente sobrepõe; fora do contêiner, "dev".
 */
export function lerBuild(dir: string, env: Record<string, string | undefined> = process.env): { versao: string; buildEm: string | null } {
  const ler = (nome: string) => {
    try {
      return readFileSync(join(dir, nome), 'utf8').trim() || null;
    } catch {
      return null;
    }
  };
  const bruto = ler('build_em');
  const data = bruto ? new Date(bruto) : null;
  return { versao: env.VERSAO?.trim() || ler('versao') || 'dev', buildEm: data && !Number.isNaN(data.getTime()) ? data.toISOString() : null };
}

/** O que o /saude precisa saber deste processo. */
export type EstadoInstancia = {
  /** Ambiente do banco quando é diferente do processo (o processo não consome). */
  ambienteDoBanco: string | null;
  /** Hostnames das outras instâncias vistas no último batimento. */
  outras: string[];
  /** Batimentos seguidos com outra instância viva (o alerta espera dois: a sobreposição curta da implantação não acorda o dono). */
  seguidas: number;
  /** Saiu das filas porque há uma instância de build mais novo com versão ou ambiente diferente. */
  parado: boolean;
  /** Parada: batimentos seguidos sem motivo para parar (com dois, volta a consumir). */
  semMotivo: number;
};

export const novoEstadoInstancia = (): EstadoInstancia => ({ ambienteDoBanco: null, outras: [], seguidas: 0, parado: false, semMotivo: 0 });

export function falhasDaInstancia(e: EstadoInstancia): FalhaProcesso[] {
  const f: FalhaProcesso[] = [];
  if (e.ambienteDoBanco) f.push('ambiente');
  if (e.outras.length > 0) f.push('instancias');
  // Revisão: parada sem atender ninguém nunca é "saudável" (a mais nova pode ter caído).
  if (e.parado) f.push('parado');
  return f;
}

export const situacaoDoProcesso = (e: EstadoInstancia) => ({ falhas: falhasDaInstancia(e), instancias: [...e.outras] });

export const mensagemAmbienteErrado = (processo: string, banco: string) =>
  `O trabalhador foi iniciado com AMBIENTE=${processo}, mas este banco é de ${banco}. Ele não vai atender.`;

/** Batimentos seguidos com outra instância antes do alerta crítico (batimento a cada minuto: mais de ~2 min de sobreposição). */
export const BATIMENTOS_PARA_ALERTA = 2;
/** Parada: batimentos seguidos sem outra mais nova antes de voltar a consumir (uma falha de rede não liga e desliga à toa). */
export const BATIMENTOS_PARA_VOLTAR = 2;
/** O mesmo alerta, no máximo uma vez por hora. */
const MINUTOS_ENTRE_ALERTAS = 60;

/** Alerta crítico no máximo uma vez por hora (a mesma deduplicação do servidor: a mensagem igual no banco). */
async function alertarUmaVezPorHora(repos: Pick<Repos, 'alertaRecente'>, alertas: Alertas, mensagem: string): Promise<void> {
  try {
    if (!(await repos.alertaRecente(mensagem, MINUTOS_ENTRE_ALERTAS))) await alertas.alertar({ nivel: 'critico', mensagem });
  } catch (e) {
    console.error('[instancia] alerta não registrado', e);
  }
}

/** Hosts que contam como "esta máquina" (ou o Docker dela) para um processo com AMBIENTE=local. */
const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '[::1]', 'host.docker.internal']);

/** Revisão final (Important 1): endereço de banco fora desta máquina. Um que nem se lê conta como remoto (na dúvida, não carimba). */
export function enderecoRemoto(url: string): boolean {
  try {
    return !HOSTS_LOCAIS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return true;
  }
}

/** O "ambiente do banco" que o /saude mostra quando um processo local aponta para um banco remoto (a falha "ambiente"). */
export const BANCO_REMOTO = 'remoto';

export const MENSAGEM_LOCAL_REMOTO =
  'AMBIENTE=local apontando para banco remoto (DATABASE_URL ou SUPABASE_URL fora desta máquina): o ambiente do banco não ' +
  'foi gravado e o trabalhador não vai atender. Use o AMBIENTE do banco (producao ou homologacao) ou aponte para o banco local.';

/**
 * Partida: banco sem ambiente grava o do processo (a primeira partida define). Ambiente diferente: o processo não liga
 * nenhum consumidor, loga, alerta o dono e o /saude falha com "ambiente" (o servidor continua de pé para dizer isso).
 * Revisão final (Important 1): AMBIENTE=local com um endereço de banco remoto nem pergunta ao banco: a primeira partida
 * carimbaria "local" na nuvem para sempre. Só loga (o alerta escreveria no banco remoto) e segue como ambiente errado.
 */
export async function partida(d: {
  repos: Pick<Repos, 'ambienteDoBanco' | 'alertaRecente'>; alertas: Alertas; ambiente: Ambiente; estado: EstadoInstancia;
  ligar: () => Promise<void>;
  /** Endereços do banco que o processo usa (DATABASE_URL, SUPABASE_URL). */
  enderecosBanco?: string[];
}): Promise<boolean> {
  if (d.ambiente === 'local' && (d.enderecosBanco ?? []).some(enderecoRemoto)) {
    d.estado.ambienteDoBanco = BANCO_REMOTO;
    console.error(`[instancia] ${MENSAGEM_LOCAL_REMOTO} Nenhuma fila será consumida.`);
    return false;
  }
  const banco = await d.repos.ambienteDoBanco(d.ambiente);
  if (banco !== d.ambiente) {
    d.estado.ambienteDoBanco = banco;
    const mensagem = mensagemAmbienteErrado(d.ambiente, banco);
    console.error(`[instancia] ${mensagem} Nenhuma fila será consumida.`);
    await alertarUmaVezPorHora(d.repos, d.alertas, mensagem);
    return false;
  }
  await d.ligar();
  return true;
}

type Viva = { hostname: string; ambiente: string; versao: string; buildEm: string | null; para: boolean };
const descrever = (t: Viva) => `${t.hostname} (versão ${t.versao}, build ${t.buildEm ?? 'sem data'}, ${t.ambiente})`;

/** Feita só com a lista do banco (igual para todas as instâncias): o mesmo texto, um alerta só por hora. */
function mensagemDuasInstancias(todas: Viva[]): string {
  const ficou = todas.filter((t) => !t.para);
  const parou = todas.filter((t) => t.para);
  if (parou.length === 0) {
    return `Há mais de um trabalhador ligado a este banco, todos atendendo: ${ficou.map(descrever).join('; ')}. Desligue o que sobrou no Easypanel.`;
  }
  return `Há mais de um trabalhador ligado a este banco. Continua atendendo: ${ficou.map(descrever).join('; ')}. ` +
    `Parou de atender: ${parou.map(descrever).join('; ')}. Desligue no Easypanel o que parou.`;
}

/**
 * Batimento deste processo (a cada minuto, fora do pg-boss: o job "batimento" roda numa instância só por minuto).
 * Grava visto_em e confere as outras vistas nos últimos 2 min:
 *  - outra de build mais novo com versão ou ambiente diferente: esta sai das filas (uma vez);
 *  - parada e, por dois batimentos seguidos, sem motivo (a outra sumiu): volta a consumir e avisa;
 *  - outra viva por dois batimentos seguidos: alerta crítico (uma vez por hora) dizendo quem ficou e quem parou.
 */
export async function batimentoInstancia(d: {
  repos: Pick<Repos, 'registrarInstancia' | 'alertaRecente'>; alertas: Alertas; eu: Instancia; estado: EstadoInstancia;
  pararDeConsumir: () => Promise<void>; voltarAConsumir: () => Promise<void>;
}): Promise<void> {
  const r = await d.repos.registrarInstancia(d.eu);
  d.estado.outras = r.outras.map((o) => o.hostname);
  d.estado.seguidas = r.outras.length > 0 ? d.estado.seguidas + 1 : 0;
  if (r.deveParar) {
    d.estado.semMotivo = 0;
    if (!d.estado.parado) {
      d.estado.parado = true;
      console.error(`[instancia] outra instância de build mais novo (${d.estado.outras.join(', ')}) com versão ou ambiente diferente: esta para de consumir.`);
      await d.pararDeConsumir();
    }
  } else if (d.estado.parado && ++d.estado.semMotivo >= BATIMENTOS_PARA_VOLTAR) {
    await d.voltarAConsumir();
    d.estado.parado = false;
    d.estado.semMotivo = 0;
    const mensagem = `O trabalhador ${d.eu.hostname} (versão ${d.eu.versao}) voltou a atender: o trabalhador mais novo que estava ligado a este banco sumiu. Confira no Easypanel.`;
    console.warn(`[instancia] ${mensagem}`);
    await alertarUmaVezPorHora(d.repos, d.alertas, mensagem);
  }
  if (d.estado.seguidas >= BATIMENTOS_PARA_ALERTA) await alertarUmaVezPorHora(d.repos, d.alertas, mensagemDuasInstancias(r.todas));
}
