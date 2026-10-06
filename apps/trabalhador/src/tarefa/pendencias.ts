import type { Repos } from '@escritorio/db';
import type { CanalWhatsApp } from '../canal/tipos';
import { enviarDoSistema, type DepsEnvio } from '../envio';

/** Tenta de novo o que só grava (o pedido já saiu): uma falha passageira do banco não pode virar envio repetido. */
async function gravarComNovasTentativas(rotulo: string, f: () => Promise<void>, tentativas = 3, esperaMs = 250): Promise<boolean> {
  for (let i = 1; i <= tentativas; i++) {
    try {
      await f();
      return true;
    } catch (e) {
      console.error(`[pendência] ${rotulo} (tentativa ${i} de ${tentativas})`, e);
      if (i < tentativas) await new Promise((r) => setTimeout(r, esperaMs * i));
    }
  }
  return false;
}

/**
 * Parte I3a (D7): manda ao contato, na voz do Thiago, o pedido que uma pessoa do setor aprovou. Reserva antes de mandar (a nova
 * tentativa da fila não manda duas vezes); se o envio falhar, libera e a fila tenta de novo. Se a Z-API aceitou, nunca libera
 * nem relança (a fila mandaria de novo): só grava, com novas tentativas.
 */
export async function enviarPedidoDePendencia(d: { repos: Repos; envio: DepsEnvio }, pendenciaId: string): Promise<void> {
  // Pausa geral, como em processar-conversa (a reserva também confere as três pausas): nada sai, nada conta no limite;
  // o batimento põe o pedido na fila de novo quando despausar (dentro das 24 h do pedido).
  if ((await d.repos.obterConfiguracoes()).agentePausado) return;
  const p = await d.repos.reservarEnvioPendencia(pendenciaId);
  if (!p) return;
  // Sabe o que aconteceu dentro de enviarDoSistema: a mensagem registrada e se a Z-API aceitou (o erro pode vir só da gravação).
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
    const conversa = await d.repos.obterOuCriarConversa(p.telefone, p.contatoId);
    // Revisão final: a conversa está com uma pessoa do escritório (o Thiago fica calado nela, como em processar-conversa). O pedido
    // espera: solta a reserva (não conta no limite) e o batimento põe na fila quando a conversa voltar para o Thiago, dentro das 24 h.
    if (conversa.estado === 'humano') {
      await d.repos.liberarEnvioPendencia(p.id);
      return;
    }
    await enviarDoSistema({ ...d.envio, repos, canal }, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: p.clienteId, autor: 'agente', texto: p.texto });
  } catch (e) {
    if (idProvedor === null) {
      await d.repos.liberarEnvioPendencia(p.id).catch((e2) => console.error('[pendência] reserva não liberada', p.id, e2));
      throw e;
    }
    // A Z-API aceitou e a gravação falhou: a mensagem saiu. Corrige o status dela (enviarDoSistema a marcou como falha).
    console.error('[pendência] o pedido saiu, mas o status da mensagem não foi gravado', p.id, e);
    const id = mensagemId as string | null, prov = idProvedor as string;
    if (id) await gravarComNovasTentativas('status da mensagem não gravado', () => d.envio.repos.marcarEnviada(id, prov));
  }
  if (!mensagemId) return;
  const id = mensagemId as string;
  const marcada = await gravarComNovasTentativas('pendência não marcada como enviada', () => d.repos.marcarPendenciaEnviada(p.id, id));
  if (!marcada) {
    // A reserva fica (o banco não a solta enquanto houver a mensagem na conversa): o job termina sem erro para a fila não mandar de novo.
    console.error('[pendência] ATENÇÃO: pedido enviado e não marcado; a reserva fica e nada é reenviado', p.id, mensagemId);
  }
}
