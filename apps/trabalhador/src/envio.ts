import { normalizarTelefone } from '@escritorio/core';
import type { Repos } from '@escritorio/db';
import type { CanalWhatsApp, MensagemRecebida } from './canal/tipos';
import type { ArmazenamentoMidia } from './midia/armazenamento';

export class LimitadorEnvio {
  private envios: number[] = [];
  constructor(
    private readonly maxPorMinuto: number,
    private readonly agora: () => number = Date.now,
    private readonly dormir: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  async aguardar(): Promise<void> {
    for (;;) {
      const t = this.agora();
      this.envios = this.envios.filter((x) => t - x < 60_000);
      if (this.envios.length < this.maxPorMinuto) {
        this.envios.push(t);
        return;
      }
      await this.dormir(60_000 - (t - this.envios[0]!));
    }
  }
}

export type DepsEnvio = { repos: Repos; canal: CanalWhatsApp; limitador: LimitadorEnvio; midia: ArmazenamentoMidia };

/**
 * Grava a mensagem como pendente ANTES de enviar, para reconhecer o eco "enviada por mim".
 * O limitador vale só para mensagens de autor "sistema" (avisos, alertas, resumo) — respostas do agente não esperam.
 */
export async function enviarDoSistema(
  d: DepsEnvio,
  p: { conversaId: string; telefone: string; clienteId: string | null; autor: 'agente' | 'sistema'; texto: string },
): Promise<string> {
  const id = await d.repos.criarSaidaPendente({ conversaId: p.conversaId, clienteId: p.clienteId, autor: p.autor, conteudo: p.texto });
  if (p.autor === 'sistema') await d.limitador.aguardar();
  try {
    const { idProvedor } = await d.canal.enviarTexto(p.telefone, p.texto);
    await d.repos.marcarEnviada(id, idProvedor);
    return id;
  } catch (e) {
    await d.repos.marcarFalha(id);
    throw e;
  }
}

/** Nova tentativa aceita "falhou"; a mensagem só fica "falhou" de vez na última tentativa da fila. */
export async function enviarMensagemDoPainel(d: DepsEnvio, mensagemId: string, ultimaTentativa = true): Promise<void> {
  const m = await d.repos.obterMensagem(mensagemId);
  if (m.autor !== 'atendente' || (m.status_envio !== 'pendente' && m.status_envio !== 'falhou')) return;
  // Outra tarefa da fila já está enviando esta resposta: não manda de novo.
  if (!(await d.repos.reservarEnvio(m.id))) return;
  const conversa = await d.repos.obterConversa(m.conversa_id);
  try {
    let idProvedor: string | null = null;
    if (m.conteudo) {
      idProvedor = (await d.canal.enviarTexto(conversa.telefone, m.conteudo)).idProvedor;
      if (m.arquivo_path) await d.repos.separarTextoEnviado(m.id, idProvedor);
    }
    if (m.arquivo_path) {
      const url = await d.midia.urlAssinada(m.arquivo_path, 600);
      idProvedor = (await d.canal.enviarArquivo(conversa.telefone, { url, nome: m.arquivo_nome ?? 'arquivo.pdf' })).idProvedor;
    }
    await d.repos.marcarEnviada(m.id, idProvedor ?? `sem-id-${m.id}`);
  } catch (e) {
    if (ultimaTentativa) await d.repos.marcarFalha(m.id);
    await d.repos.liberarEnvio(m.id);
    throw e;
  }
}

export async function verificarEnviadaPorMim(d: DepsEnvio, m: MensagemRecebida): Promise<'do-sistema' | 'humano'> {
  if (await d.repos.mensagemPorIdProvedor(m.idProvedor)) return 'do-sistema';
  const telefone = normalizarTelefone(m.telefone);
  if (!telefone) return 'do-sistema';
  const conversa = await d.repos.obterOuCriarConversa(telefone, null);
  if (m.texto) {
    const pendente = await d.repos.saidaPendenteComConteudo(conversa.id, m.texto);
    if (pendente) {
      await d.repos.marcarEnviada(pendente.id, m.idProvedor);
      return 'do-sistema';
    }
  }
  await d.repos.inserirSaidaExterna({ conversaId: conversa.id, clienteId: conversa.cliente_em_foco, idProvedor: m.idProvedor, conteudo: m.texto });
  await d.repos.atualizarConversa(conversa.id, { estado: 'humano' });
  return 'humano';
}
