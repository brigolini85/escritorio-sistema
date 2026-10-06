import type { Repos } from '@escritorio/db';
import { enviarDoSistema, type DepsEnvio } from '../envio';

/**
 * Parte I3a (D7): manda ao contato, na voz do Thiago, o pedido que uma pessoa do setor aprovou. Reserva antes de mandar (a nova
 * tentativa da fila não manda duas vezes); se o envio falhar, libera e a fila tenta de novo.
 */
export async function enviarPedidoDePendencia(d: { repos: Repos; envio: DepsEnvio }, pendenciaId: string): Promise<void> {
  const p = await d.repos.reservarEnvioPendencia(pendenciaId);
  if (!p) return;
  let mensagemId: string;
  try {
    const conversa = await d.repos.obterOuCriarConversa(p.telefone, p.contatoId);
    mensagemId = await enviarDoSistema(d.envio, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: p.clienteId, autor: 'agente', texto: p.texto });
  } catch (e) {
    await d.repos.liberarEnvioPendencia(p.id).catch((e2) => console.error('[pendência] reserva não liberada', p.id, e2));
    throw e;
  }
  // A mensagem já saiu: sem a marca, o batimento soltaria a reserva em 10 min e mandaria de novo (F5). Uma segunda tentativa na hora.
  await d.repos.marcarPendenciaEnviada(p.id, mensagemId)
    .catch(() => d.repos.marcarPendenciaEnviada(p.id, mensagemId));
}
