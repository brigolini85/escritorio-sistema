import { SemI5, type GiroParaRodar, type Repos, type ReposRadar } from '@escritorio/db';
import { erroTemporarioIa, type ClienteIa } from '../agente/cliente-ia';
import type { DepsEnvio } from '../envio';
import { avisosDoGiro } from './avisos';
import { enviarEnvioRadar } from './envios';
import { rodarGiro, type ResultadoGiro } from './giro';

export type DepsRadar = { repos: Repos; radar: ReposRadar; ia: ClienteIa; envio: DepsEnvio; relogio: () => Date };
let avisouSemI5 = false;
function semI5(e: unknown): boolean {
  if (!(e instanceof SemI5)) return false;
  if (!avisouSemI5) {
    avisouSemI5 = true;
    console.warn('[radar] o Radar ainda não está no banco (Parte I5): nada a fazer');
  }
  return true;
}
/** Só para os testes: o aviso "uma vez" volta a valer. */
export const reiniciarAvisoSemI5 = () => { avisouSemI5 = false; };

/** Fila "radar", a cada minuto (D5): fecha o travado, abre o agendado ou a nova tentativa, roda um giro e avisa. */
export async function cicloRadar(d: DepsRadar): Promise<void> {
  let g: GiroParaRodar | null;
  try {
    await d.radar.abrirGirosRadar(d.relogio());
    g = await d.radar.pegarGiroRadar();
  } catch (e) {
    if (semI5(e)) return;
    throw e;
  }
  if (!g) return;
  let r: ResultadoGiro;
  try {
    r = await rodarGiro(d, g);
  } catch (e) {
    console.error('[radar] o giro falhou', g.id, e);
    const msg = erroTemporarioIa(e) ? 'A IA não respondeu agora. O próximo giro tenta de novo.'
      : `O giro falhou: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}`;
    r = { estado: 'falhou', fontes: g.fontes.length, paginas: 0, buscas: 0, fontesFora: [], lidas: [], resumo: null, erro: msg, novas: [] };
  }
  const { novas, ...fim } = r;
  try {
    await d.radar.concluirGiroRadar(g.id, fim);
  } catch (e) {
    // O banco fecha o giro travado em 40 min (D8); as novidades já gravadas ficam.
    console.error('[radar] giro não concluído no banco', g.id, e);
  }
  await avisosDoGiro(d, g.id, g.origem, novas);
}

/** Fila "radar-envios", a cada minuto: manda o que uma pessoa aprovou e pode sair agora (D14). */
export async function enviosRadar(d: Omit<DepsRadar, 'ia'>): Promise<number> {
  let ids: string[];
  try {
    ids = await d.radar.enviosRadarParaEnviar(20);
  } catch (e) {
    if (semI5(e)) return 0;
    throw e;
  }
  let n = 0;
  for (const id of ids) {
    try {
      if ((await enviarEnvioRadar(d, id)) === 'enviado') n++;
    } catch (e) {
      console.error('[radar] envio ao cliente', id, e);
    }
  }
  return n;
}
