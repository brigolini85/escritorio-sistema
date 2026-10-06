import type { ProvedorIa } from '@escritorio/core';

export type Transcricao = { texto: string; segundos: number | null };
export interface Transcritor {
  readonly modelo: string;
  readonly provedor: ProvedorIa;
  transcrever(audio: Uint8Array, mime: string, nomeArquivo: string): Promise<Transcricao>;
}

/** Vocabulário enviado no `prompt` da transcrição (máx. 224 tokens). Sem ele, siglas como INSS saem erradas (V4). */
export const VOCABULARIO_PADRAO =
  'Conversa com escritório de contabilidade: DAS, INSS, FGTS, pró-labore, folha de pagamento, nota fiscal, extrato, Simples Nacional, DCTFWeb, eSocial.';

/** Fornecedor compatível com POST {base}/audio/transcriptions (escolhido na Task 1). */
export function criarTranscritor(
  cfg: { baseUrl: string; apiKey: string; modelo: string; vocabulario?: string; provedor?: ProvedorIa },
  buscar: typeof fetch = fetch,
): Transcritor {
  return {
    modelo: cfg.modelo,
    // O fornecedor configurado hoje é a Groq (spec 7B.1); outro compatível entra com provedor próprio na regra do banco.
    provedor: cfg.provedor ?? 'groq',
    async transcrever(audio, mime, nomeArquivo) {
      const form = new FormData();
      // A cópia garante um ArrayBuffer comum, que é o que o Blob aceita.
      form.append('file', new Blob([new Uint8Array(audio)], { type: mime }), nomeArquivo);
      form.append('model', cfg.modelo);
      form.append('language', 'pt');
      form.append('prompt', cfg.vocabulario || VOCABULARIO_PADRAO);
      // verbose_json traz a duração: é por ela que o fornecedor cobra (spec 7B.2).
      form.append('response_format', 'verbose_json');
      const r = await buscar(`${cfg.baseUrl}/audio/transcriptions`, {
        method: 'POST', headers: { Authorization: `Bearer ${cfg.apiKey}` }, body: form,
        // Revisão geral I6/I9: o fornecedor travado não segura a vez da conversa.
        signal: AbortSignal.timeout(120_000),
      });
      if (!r.ok) throw new Error(`transcrição falhou: ${r.status}`);
      const j = (await r.json()) as { text: string; duration?: unknown };
      const segundos = typeof j.duration === 'number' && Number.isFinite(j.duration) && j.duration >= 0 ? j.duration : null;
      return { texto: j.text.trim(), segundos };
    },
  };
}
