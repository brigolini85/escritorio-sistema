import { z } from 'zod';
import { EnvioIncerto, type CanalWhatsApp, type MensagemRecebida } from './tipos';

const Corpo = z.object({
  type: z.literal('ReceivedCallback'),
  // Auditoria 3.7: id vazio faria duas mensagens colidirem (a segunda viraria duplicada).
  messageId: z.string().min(1).max(128),
  instanceId: z.string().nullish(),
  phone: z.string(),
  fromMe: z.boolean().default(false),
  isGroup: z.boolean().default(false),
  senderName: z.string().nullish(),
  notification: z.string().nullish(),
  text: z.object({ message: z.string() }).optional(),
  audio: z.object({ audioUrl: z.string(), mimeType: z.string().nullish() }).optional(),
  image: z.object({ imageUrl: z.string(), caption: z.string().nullish(), mimeType: z.string().nullish() }).optional(),
  document: z.object({
    documentUrl: z.string(), fileName: z.string().nullish(), mimeType: z.string().nullish(), caption: z.string().nullish(),
  }).optional(),
}).passthrough();

/** Auditoria 3.2: a conexão nem abriu (endereço não resolvido, recusada): a requisição não saiu, é falha certa. */
const CONEXAO_NAO_SAIU = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH']);
function codigoDaCausa(e: unknown): string {
  const causa = (e as { cause?: { code?: unknown } } | null)?.cause;
  const codigo = causa?.code ?? (e as { code?: unknown } | null)?.code;
  return typeof codigo === 'string' ? codigo : '';
}

/** Revisão geral I9: prazo de cada chamada à Z-API (o arquivo vai inteiro em Base64). Abaixo da reserva do envio do painel. */
export const PRAZO_ZAPI_MS = { texto: 30_000, arquivo: 120_000, status: 15_000 } as const;
type Prazos = { texto: number; arquivo: number; status: number };

export function criarCanalZapi(
  cfg: { instancia: string; token: string; clientToken: string },
  buscar: typeof fetch = fetch,
  prazos: Prazos = PRAZO_ZAPI_MS,
): CanalWhatsApp {
  const base = `https://api.z-api.io/instances/${cfg.instancia}/token/${cfg.token}`;

  async function chamar(caminho: string, corpo: object | undefined, prazoMs: number): Promise<Record<string, unknown>> {
    let r: Response;
    try {
      r = await buscar(`${base}${caminho}`, {
        method: corpo ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', 'Client-Token': cfg.clientToken },
        body: corpo ? JSON.stringify(corpo) : undefined,
        signal: AbortSignal.timeout(prazoMs),
      });
    } catch (e) {
      // Auditoria 3.2: depois que a requisição saiu, prazo estourado ou conexão caída não dizem se a Z-API entregou.
      if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw new EnvioIncerto(`Z-API sem resposta no prazo (${prazoMs} ms)`);
      if (CONEXAO_NAO_SAIU.has(codigoDaCausa(e))) throw e;
      throw new EnvioIncerto(`Z-API: conexão interrompida (${e instanceof Error ? e.message : String(e)})`);
    }
    if (!r.ok) {
      const texto = await r.text().catch(() => '');
      // 4xx: a Z-API recusou (falha certa). 5xx: pode ter entregue.
      if (r.status >= 500) throw new EnvioIncerto(`Z-API ${r.status}: ${texto.slice(0, 200)}`);
      throw new Error(`Z-API ${r.status}: ${texto.slice(0, 200)}`);
    }
    try {
      return (await r.json()) as Record<string, unknown>;
    } catch {
      throw new EnvioIncerto('Z-API respondeu sem JSON');
    }
  }

  function idDaResposta(j: Record<string, unknown>): string {
    const id = j.messageId ?? j.id ?? j.zaapId;
    // Aceita (2xx) e sem id: a mensagem pode ter saído.
    if (typeof id !== 'string') throw new EnvioIncerto('Z-API não devolveu id da mensagem');
    return id;
  }

  return {
    interpretarWebhook(corpo: unknown): MensagemRecebida | null {
      const r = Corpo.safeParse(corpo);
      if (!r.success) return null;
      const c = r.data;
      // Criação de grupo e outros avisos chegam como ReceivedCallback com `notification` preenchido.
      if (c.notification) return null;
      // Revisão geral M5: reação (👍 numa mensagem) não é pedido do cliente: não vira mensagem nem chama o agente.
      if ((c as { reaction?: unknown }).reaction) return null;
      // Auditoria 3.7: status, lista de transmissão e canal não são pedido do cliente. (waitingMessage segue como "outro":
      // a equipe vê.) Atenção: a lista de transmissão do próprio cliente (ele manda a mesma mensagem a vários contatos) também
      // sai aqui, como status_ou_canal no log; acompanhe essa contagem e, se aparecer pedido de cliente, revise.
      const e = c as { broadcast?: unknown; isNewsletter?: unknown; isStatusReply?: unknown; isEdit?: unknown; momment?: unknown };
      if (e.broadcast === true || e.isNewsletter === true || e.isStatusReply === true) return null;
      const comum = {
        idProvedor: c.messageId, instanciaId: c.instanceId ?? null, telefone: c.phone, enviadaPorMim: c.fromMe, ehGrupo: c.isGroup, nomeRemetente: c.senderName ?? null,
      };
      if (e.isEdit === true) {
        // Auditoria 3.7 (revisão): a edição é a correção do cliente (ex.: "março" no lugar de "fevereiro"): chega como mensagem
        // de texto nova, com prefixo, para o agente e a equipe verem. O id leva o momento da edição: a mensagem original e
        // cada edição gravam uma vez cada; a mesma edição entregue de novo é descartada pela deduplicação do id.
        const novo = c.text?.message ?? c.image?.caption ?? c.document?.caption ?? '';
        const momento = typeof e.momment === 'number' || typeof e.momment === 'string' ? String(e.momment) : 'sem-momento';
        return { ...comum, idProvedor: `${c.messageId}:edit:${momento}`, tipo: 'texto', texto: `(mensagem editada) ${novo}`.trim(), midia: null };
      }
      if (c.text) return { ...comum, tipo: 'texto', texto: c.text.message, midia: null };
      if (c.audio) return { ...comum, tipo: 'audio', texto: null, midia: { url: c.audio.audioUrl, mime: c.audio.mimeType ?? null, nomeArquivo: null } };
      if (c.image) return { ...comum, tipo: 'imagem', texto: c.image.caption || null, midia: { url: c.image.imageUrl, mime: c.image.mimeType ?? null, nomeArquivo: null } };
      if (c.document) {
        return { ...comum, tipo: 'documento', texto: c.document.caption || null,
          midia: { url: c.document.documentUrl, mime: c.document.mimeType ?? null, nomeArquivo: c.document.fileName ?? null } };
      }
      return { ...comum, tipo: 'outro', texto: null, midia: null };
    },

    async enviarTexto(telefone, texto) {
      return { idProvedor: idDaResposta(await chamar('/send-text', { phone: telefone, message: texto, delayTyping: 2 }, prazos.texto)) };
    },

    async enviarArquivo(telefone, arquivo) {
      // Nome sem ponto (ex.: "contrato") não tem extensão: envia como PDF.
      const extensao = arquivo.nome.includes('.') ? arquivo.nome.split('.').pop()!.toLowerCase() : 'pdf';
      return { idProvedor: idDaResposta(await chamar(`/send-document/${extensao}`, { phone: telefone, document: arquivo.url, fileName: arquivo.nome }, prazos.arquivo)) };
    },

    async status() {
      const j = await chamar('/status', undefined, prazos.status);
      return { conectado: j.connected === true };
    },
  };
}
