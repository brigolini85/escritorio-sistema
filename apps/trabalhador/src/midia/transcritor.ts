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

// Auditoria 5.7: um áudio de 2 h virava dezenas de milhares de caracteres, reenviados em cada rodada e nas 20 vezes seguintes.
export const MAX_CARACTERES_TRANSCRICAO = 4000;
export const AVISO_TRANSCRICAO_CORTADA = '[áudio longo: transcrição cortada]';
export const AVISO_AUDIO_LONGO = '[áudio longo demais: não foi transcrito]';
const MAX_SEGUNDOS_AUDIO = 10 * 60;
/** Sem duração no cabeçalho: 10 MB de voz do WhatsApp passa bem de 10 min. */
const MAX_BYTES_AUDIO_SEM_DURACAO = 10 * 1024 * 1024;

export function cortarTranscricao(texto: string): string {
  return texto.length > MAX_CARACTERES_TRANSCRICAO ? `${texto.slice(0, MAX_CARACTERES_TRANSCRICAO)} ${AVISO_TRANSCRICAO_CORTADA}` : texto;
}

const OGGS = [0x4f, 0x67, 0x67, 0x53];
const ehOggS = (b: Uint8Array, i: number) => OGGS.every((c, k) => b[i + k] === c);

/**
 * Duração de um Ogg Opus (o áudio do WhatsApp): a posição da última página, em amostras a 48 kHz. Outro formato, ou cabeçalho
 * que não se lê, devolve null (aí vale o tamanho do arquivo).
 */
export function duracaoOpusSegundos(bytes: Uint8Array): number | null {
  if (bytes.length < 36 || !ehOggS(bytes, 0)) return null;
  const inicio = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 200)));
  if (!inicio.includes('OpusHead')) return null;
  for (let i = bytes.length - 27; i > 0; i--) {
    if (!ehOggS(bytes, i)) continue;
    const posicao = new DataView(bytes.buffer, bytes.byteOffset + i + 6, 8).getBigInt64(0, true);
    return posicao > 0n ? Number(posicao) / 48_000 : null;
  }
  return null;
}

/** Mais de 10 min (pela duração do cabeçalho) ou, sem ela, mais de 10 MB: nem vai ao transcritor. */
export function audioLongoDemais(bytes: Uint8Array): boolean {
  const segundos = duracaoOpusSegundos(bytes);
  return segundos !== null ? segundos > MAX_SEGUNDOS_AUDIO : bytes.length > MAX_BYTES_AUDIO_SEM_DURACAO;
}
