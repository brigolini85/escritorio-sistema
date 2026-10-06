import { normalizarTelefone } from '@escritorio/core';
import type { DocumentoEmpresa, Repos } from '@escritorio/db';
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
  p: { conversaId: string; telefone: string; clienteId: string | null; autor: 'agente' | 'sistema'; texto: string; turnoAgente?: string | null },
): Promise<string> {
  const id = await d.repos.criarSaidaPendente({ conversaId: p.conversaId, clienteId: p.clienteId, autor: p.autor, conteudo: p.texto, turnoAgente: p.turnoAgente ?? null });
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

/**
 * Conteúdo do arquivo embutido (data URI em Base64), aceito pela Z-API no lugar do link.
 * Com link, quem baixa é a Z-API: um endereço que ela não alcança (ex.: Supabase local) falha sem aviso.
 */
async function arquivoEmBase64(d: DepsEnvio, path: string, mime: string, bucket?: string): Promise<string> {
  const bytes = await d.midia.ler(path, bucket);
  return `data:${mime.split(';')[0]};base64,${Buffer.from(bytes).toString('base64')}`;
}

/** Documento da empresa (bucket "documentos"): registra antes, como em enviarDoSistema, e envia o conteúdo. */
export async function enviarDocumentoDoSistema(
  d: DepsEnvio,
  p: { conversaId: string; telefone: string; clienteId: string; documento: DocumentoEmpresa; turnoAgente?: string | null },
): Promise<string> {
  // O painel mostra o documento com link (download auditado pelo id), não só o nome.
  const id = await d.repos.criarSaidaPendente({ conversaId: p.conversaId, clienteId: p.clienteId, autor: 'agente', conteudo: `📎 ${p.documento.nome}`,
    turnoAgente: p.turnoAgente ?? null, documentoId: p.documento.id });
  try {
    const url = await arquivoEmBase64(d, p.documento.arquivoPath, p.documento.arquivoMime, 'documentos');
    const { idProvedor } = await d.canal.enviarArquivo(p.telefone, { url, nome: p.documento.arquivoNome });
    await d.repos.marcarEnviada(id, idProvedor);
    return id;
  } catch (e) {
    await d.repos.marcarFalha(id);
    throw e;
  }
}

const CAMINHO_DE_ANEXO = /^conversas\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/]+$/;

/** Nova tentativa aceita "falhou"; a mensagem só fica "falhou" de vez na última tentativa da fila. */
export async function enviarMensagemDoPainel(d: DepsEnvio, mensagemId: string, ultimaTentativa = true): Promise<void> {
  const m = await d.repos.obterMensagem(mensagemId);
  if (m.autor !== 'atendente' || (m.status_envio !== 'pendente' && m.status_envio !== 'falhou')) return;
  // Outra tarefa da fila já está enviando esta resposta: não manda de novo.
  if (!(await d.repos.reservarEnvio(m.id))) return;
  // Revisão geral I1: a chave de serviço lê qualquer arquivo; só anexo de conversa sai daqui (o banco já confere quem pediu).
  if (m.arquivo_path && !CAMINHO_DE_ANEXO.test(m.arquivo_path)) {
    console.error(`[envio] caminho de arquivo recusado na mensagem ${m.id}`);
    await d.repos.marcarFalha(m.id);
    await d.repos.liberarEnvio(m.id);
    return;
  }
  const conversa = await d.repos.obterConversa(m.conversa_id);
  try {
    let idProvedor: string | null = null;
    if (m.conteudo) {
      idProvedor = (await d.canal.enviarTexto(conversa.telefone, m.conteudo)).idProvedor;
      if (m.arquivo_path) await d.repos.separarTextoEnviado(m.id, idProvedor);
    }
    if (m.arquivo_path) {
      const url = await arquivoEmBase64(d, m.arquivo_path, m.arquivo_mime ?? 'application/pdf');
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
  // Resposta do assistente interno: não tem linha em `mensagens` e nunca assume a conversa como atendimento humano.
  if (await d.repos.usuarioDoAssistente(telefone)) return 'do-sistema';
  const conversa = await d.repos.obterOuCriarConversa(telefone, null);
  if (m.texto) {
    const pendente = await d.repos.saidaPendenteComConteudo(conversa.id, m.texto);
    if (pendente) {
      await d.repos.marcarEnviada(pendente.id, m.idProvedor);
      return 'do-sistema';
    }
  }
  await d.repos.inserirSaidaExterna({ conversaId: conversa.id, clienteId: conversa.cliente_em_foco, idProvedor: m.idProvedor, conteudo: m.texto });
  // Como assumir pelo painel: limpa a espera e grava o marco "assumida" (sem pessoa: o celular não diz quem respondeu).
  await d.repos.assumirPeloCelular(conversa.id);
  return 'humano';
}
