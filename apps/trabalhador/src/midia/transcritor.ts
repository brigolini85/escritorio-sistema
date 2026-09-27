export interface Transcritor {
  transcrever(audio: Uint8Array, mime: string, nomeArquivo: string): Promise<string>;
}

/** Vocabulário enviado no `prompt` da transcrição (máx. 224 tokens). Sem ele, siglas como INSS saem erradas (V4). */
export const VOCABULARIO_PADRAO =
  'Conversa com escritório de contabilidade: DAS, INSS, FGTS, pró-labore, folha de pagamento, nota fiscal, extrato, Simples Nacional, DCTFWeb, eSocial.';

/** Fornecedor compatível com POST {base}/audio/transcriptions (escolhido na Task 1). */
export function criarTranscritor(
  cfg: { baseUrl: string; apiKey: string; modelo: string; vocabulario?: string },
  buscar: typeof fetch = fetch,
): Transcritor {
  return {
    async transcrever(audio, mime, nomeArquivo) {
      const form = new FormData();
      // A cópia garante um ArrayBuffer comum, que é o que o Blob aceita.
      form.append('file', new Blob([new Uint8Array(audio)], { type: mime }), nomeArquivo);
      form.append('model', cfg.modelo);
      form.append('language', 'pt');
      form.append('prompt', cfg.vocabulario || VOCABULARIO_PADRAO);
      const r = await buscar(`${cfg.baseUrl}/audio/transcriptions`, {
        method: 'POST', headers: { Authorization: `Bearer ${cfg.apiKey}` }, body: form,
      });
      if (!r.ok) throw new Error(`transcrição falhou: ${r.status}`);
      const j = (await r.json()) as { text: string };
      return j.text.trim();
    },
  };
}
