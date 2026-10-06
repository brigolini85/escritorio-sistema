import { textoAvisoAlto, textoResumoDiario } from '@escritorio/core';
import type { Repos, ReposRadar } from '@escritorio/db';
import { enviarDoSistema, type DepsEnvio } from '../envio';

type DepsAviso = { repos: Repos; radar: ReposRadar; envio: DepsEnvio };

/** D13: os avisos do Radar vão só ao WhatsApp do dono (Configurações › Escritório), na voz do sistema. */
export async function avisarDono(d: Pick<DepsAviso, 'repos' | 'envio'>, texto: string): Promise<string | null> {
  const cfg = await d.repos.obterConfiguracoes();
  if (!cfg.telefoneDono) return null;
  const conversa = await d.repos.obterOuCriarConversa(cfg.telefoneDono, null);
  return enviarDoSistema(d.envio, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: null, autor: 'sistema', texto });
}

/** Depois do giro: aviso no painel e WhatsApp do impacto alto (cada novidade nova) e, no agendado, o resumo do dia. Falha de um não para o outro. */
export async function avisosDoGiro(d: DepsAviso, giroId: string, origem: string, novas: string[]): Promise<void> {
  for (const id of novas) {
    try {
      const a = await d.radar.avisarNovidadeNova(id);
      if (!a.whatsapp || !a.avisoId) continue;
      const msg = await avisarDono(d, textoAvisoAlto({ titulo: a.titulo, fonte: a.fonte, vigencia: a.vigencia }));
      if (msg) await d.radar.marcarAvisoRadar(a.avisoId, msg);
    } catch (e) {
      console.error('[radar] aviso da novidade', id, e);
    }
  }
  if (origem !== 'agenda') return;
  try {
    const r = await d.radar.reservarResumoRadar(giroId);
    if (!r) return;
    const msg = await avisarDono(d, textoResumoDiario(r.novidades, r.fontesFora));
    if (msg) await d.radar.marcarAvisoRadar(r.avisoId, msg);
  } catch (e) {
    console.error('[radar] resumo do dia', giroId, e);
  }
}
