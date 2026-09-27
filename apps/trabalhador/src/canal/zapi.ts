import { z } from 'zod';
import type { CanalWhatsApp, MensagemRecebida } from './tipos';

const Corpo = z.object({
  type: z.literal('ReceivedCallback'),
  messageId: z.string(),
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

export function criarCanalZapi(
  cfg: { instancia: string; token: string; clientToken: string },
  buscar: typeof fetch = fetch,
): CanalWhatsApp {
  const base = `https://api.z-api.io/instances/${cfg.instancia}/token/${cfg.token}`;

  async function chamar(caminho: string, corpo?: object): Promise<Record<string, unknown>> {
    const r = await buscar(`${base}${caminho}`, {
      method: corpo ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'Client-Token': cfg.clientToken },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    if (!r.ok) throw new Error(`Z-API ${r.status}: ${await r.text()}`);
    return (await r.json()) as Record<string, unknown>;
  }

  function idDaResposta(j: Record<string, unknown>): string {
    const id = j.messageId ?? j.id ?? j.zaapId;
    if (typeof id !== 'string') throw new Error('Z-API não devolveu id da mensagem');
    return id;
  }

  return {
    interpretarWebhook(corpo: unknown): MensagemRecebida | null {
      const r = Corpo.safeParse(corpo);
      if (!r.success) return null;
      const c = r.data;
      // Criação de grupo e outros avisos chegam como ReceivedCallback com `notification` preenchido.
      if (c.notification) return null;
      const comum = {
        idProvedor: c.messageId, telefone: c.phone, enviadaPorMim: c.fromMe, ehGrupo: c.isGroup, nomeRemetente: c.senderName ?? null,
      };
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
      return { idProvedor: idDaResposta(await chamar('/send-text', { phone: telefone, message: texto, delayTyping: 2 })) };
    },

    async enviarArquivo(telefone, arquivo) {
      const extensao = (arquivo.nome.split('.').pop() ?? 'pdf').toLowerCase();
      return { idProvedor: idDaResposta(await chamar(`/send-document/${extensao}`, { phone: telefone, document: arquivo.url, fileName: arquivo.nome })) };
    },

    async status() {
      const j = await chamar('/status');
      return { conectado: j.connected === true };
    },
  };
}
