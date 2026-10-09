import type { Repos, ReposRadar } from '@escritorio/db';
import type { CanalWhatsApp } from '../canal/tipos';
import { enviarDoSistema, type DepsEnvio } from '../envio';

/** Tenta de novo o que só grava (a mensagem já saiu): uma falha passageira do banco não pode virar envio repetido. */
async function gravarComNovasTentativas(rotulo: string, f: () => Promise<void>, tentativas = 3, esperaMs = 250): Promise<boolean> {
  for (let i = 1; i <= tentativas; i++) {
    try {
      await f();
      return true;
    } catch (e) {
      console.error(`[radar envio] ${rotulo} (tentativa ${i} de ${tentativas})`, e);
      if (i < tentativas) await new Promise((r) => setTimeout(r, esperaMs * i));
    }
  }
  return false;
}

/**
 * D14: manda ao contato, na voz do Thiago, a mensagem que uma pessoa do setor aprovou. O mesmo desenho do pedido de pendência
 * (tarefa/pendencias.ts): reserva antes; se o envio falhar, libera e o próximo minuto tenta; se a Z-API aceitou, nunca libera.
 */
export async function enviarEnvioRadar(d: { repos: Repos; radar: ReposRadar; envio: DepsEnvio }, id: string): Promise<'enviado' | 'esperando' | 'nada'> {
  // Pausa geral: nada sai e nada conta no limite (a reserva também confere as três pausas).
  if ((await d.repos.obterConfiguracoes()).agentePausado) return 'nada';
  const e = await d.radar.reservarEnvioRadar(id);
  if (!e) return 'nada';
  let mensagemId: string | null = null;
  let idProvedor: string | null = null;
  const repos: Repos = Object.assign(Object.create(d.envio.repos) as Repos, {
    criarSaidaPendente: async (m: Parameters<Repos['criarSaidaPendente']>[0]) => (mensagemId = await d.envio.repos.criarSaidaPendente(m)),
  });
  const canal: CanalWhatsApp = Object.assign(Object.create(d.envio.canal) as CanalWhatsApp, {
    enviarTexto: async (telefone: string, texto: string) => {
      const r = await d.envio.canal.enviarTexto(telefone, texto);
      idProvedor = r.idProvedor;
      return r;
    },
  });
  try {
    const conversa = await d.repos.obterOuCriarConversa(e.telefone, e.contatoId);
    // A conversa está com uma pessoa do escritório: o Thiago fica calado nela. Solta a reserva; sai quando voltar (até 3 dias).
    if (conversa.estado === 'humano') {
      await d.radar.liberarEnvioRadar(e.id);
      return 'esperando';
    }
    await enviarDoSistema({ ...d.envio, repos, canal }, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: e.clienteId, autor: 'agente', texto: e.texto });
  } catch (erro) {
    if (idProvedor === null) {
      await d.radar.liberarEnvioRadar(e.id).catch((e2) => console.error('[radar envio] reserva não liberada', e.id, e2));
      throw erro;
    }
    // A Z-API aceitou e a gravação falhou: a mensagem saiu. Corrige o status dela (enviarDoSistema a deixou "incerto").
    console.error('[radar envio] a mensagem saiu, mas o status não foi gravado', e.id, erro);
    const mid = mensagemId as string | null, prov = idProvedor as string;
    if (mid) await gravarComNovasTentativas('status da mensagem não gravado', () => d.envio.repos.marcarEnviada(mid, prov));
  }
  if (!mensagemId) return 'nada';
  const mid = mensagemId as string;
  const marcado = await gravarComNovasTentativas('envio não marcado', () => d.radar.marcarEnvioRadar(e.id, mid));
  // Não marcado: a reserva fica (o banco não a solta enquanto a mensagem estiver na conversa); nada é reenviado.
  if (!marcado) console.error('[radar envio] ATENÇÃO: mensagem enviada e não marcada; nada é reenviado', e.id, mid);
  return 'enviado';
}
