import type { Repos } from '@escritorio/db';
import type { Alertas } from './alertas';
import type { Ambiente } from './canal/trava';
import type { FalhaProcesso } from './servidor';

/**
 * Auditoria 4.3: depois de uma implantação, um contêiner antigo ligado ao mesmo banco (com outro AMBIENTE ou outro código)
 * atendia metade das conversas. Aqui ficam a conferência da partida (AMBIENTE do processo contra o do banco) e o batimento
 * de cada processo (registra a instância e vê se há outra viva).
 */
export type Instancia = { id: string; hostname: string; ambiente: string; versao: string };

/** O que o /saude precisa saber deste processo. */
export type EstadoInstancia = {
  /** Ambiente do banco quando é diferente do processo (o processo não consome). */
  ambienteDoBanco: string | null;
  /** Hostnames das outras instâncias vistas no último batimento. */
  outras: string[];
  /** Batimentos seguidos com outra instância viva (o alerta espera dois: a sobreposição curta da implantação não acorda o dono). */
  seguidas: number;
  /** Saiu das filas porque há uma instância mais nova de versão ou ambiente diferente. */
  parado: boolean;
};

export const novoEstadoInstancia = (): EstadoInstancia => ({ ambienteDoBanco: null, outras: [], seguidas: 0, parado: false });

export function falhasDaInstancia(e: EstadoInstancia): FalhaProcesso[] {
  const f: FalhaProcesso[] = [];
  if (e.ambienteDoBanco) f.push('ambiente');
  if (e.outras.length > 0) f.push('instancias');
  return f;
}

export const situacaoDoProcesso = (e: EstadoInstancia) => ({ falhas: falhasDaInstancia(e), instancias: [...e.outras] });

export const mensagemAmbienteErrado = (processo: string, banco: string) =>
  `O trabalhador foi iniciado com AMBIENTE=${processo}, mas este banco é de ${banco}. Ele não vai atender.`;

/** Batimentos seguidos com outra instância antes do alerta crítico (batimento a cada minuto: mais de ~2 min de sobreposição). */
export const BATIMENTOS_PARA_ALERTA = 2;
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

/**
 * Partida: banco sem ambiente grava o do processo (a primeira partida define). Ambiente diferente: o processo não liga
 * nenhum consumidor, loga, alerta o dono e o /saude falha com "ambiente" (o servidor continua de pé para dizer isso).
 */
export async function partida(d: {
  repos: Pick<Repos, 'ambienteDoBanco' | 'alertaRecente'>; alertas: Alertas; ambiente: Ambiente; estado: EstadoInstancia;
  ligar: () => Promise<void>;
}): Promise<boolean> {
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

const mensagemDuasInstancias = (hostnames: string[], diferentes: boolean) =>
  `Há mais de um trabalhador ligado a este banco (${hostnames.join(', ')}). ` +
  (diferentes ? 'Eles têm versão ou ambiente diferentes: o mais antigo parou de atender. ' : '') +
  'Desligue o que sobrou no Easypanel.';

/**
 * Batimento deste processo (a cada minuto, fora do pg-boss: o job "batimento" roda numa instância só por minuto).
 * Grava visto_em e confere as outras vistas nos últimos 2 min: mais nova de versão ou ambiente diferente faz esta sair das
 * filas (uma vez); outra viva por dois batimentos seguidos gera alerta crítico (uma vez por hora) com os hostnames.
 */
export async function batimentoInstancia(d: {
  repos: Pick<Repos, 'registrarInstancia' | 'alertaRecente'>; alertas: Alertas; eu: Instancia; estado: EstadoInstancia;
  pararDeConsumir: () => Promise<void>;
}): Promise<void> {
  const r = await d.repos.registrarInstancia(d.eu);
  d.estado.outras = r.outras.map((o) => o.hostname);
  d.estado.seguidas = r.outras.length > 0 ? d.estado.seguidas + 1 : 0;
  if (r.deveParar && !d.estado.parado) {
    d.estado.parado = true;
    console.error(`[instancia] outra instância mais nova (${d.estado.outras.join(', ')}) com versão ou ambiente diferente: esta para de consumir.`);
    await d.pararDeConsumir();
  }
  if (d.estado.seguidas >= BATIMENTOS_PARA_ALERTA) {
    // Os hostnames de todas, em ordem: as duas instâncias geram a mesma mensagem (um alerta só por hora, não um de cada).
    const todos = [d.eu.hostname, ...d.estado.outras].sort();
    const diferentes = r.outras.some((o) => o.versao !== d.eu.versao || o.ambiente !== d.eu.ambiente);
    await alertarUmaVezPorHora(d.repos, d.alertas, mensagemDuasInstancias(todos, diferentes));
  }
}
