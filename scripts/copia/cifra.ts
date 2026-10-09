// Auditoria 6.2: a cópia sai do Supabase cifrada. AES-256-GCM em fluxo (arquivos grandes não vão inteiros para a memória).
// Formato (versão 1):  "ESCCOPIA" (8 bytes) | versão (1 byte) | IV aleatório (12 bytes) | dados cifrados | marca GCM (16 bytes)
// O cabeçalho (marca + versão) entra como dado autenticado: trocar a versão também falha.
import { createCipheriv, createDecipheriv, randomBytes, type DecipherGCM } from 'node:crypto';
import { Transform } from 'node:stream';

export const VERSAO_FORMATO = 1;
const MAGICA = Buffer.from('ESCCOPIA', 'ascii');
export const CABECALHO_BYTES = MAGICA.length + 1;
const IV_BYTES = 12;
const MARCA_BYTES = 16;

const ERRO_AUTENTICACAO = 'Não foi possível abrir a cópia: chave errada ou o arquivo foi alterado.';

/** COPIA_CHAVE: 32 bytes em base64 (`openssl rand -base64 32`). Nunca é escrita em arquivo nem em log. */
export function lerChave(base64: string | undefined): Buffer {
  if (!base64) throw new Error('Falta a COPIA_CHAVE (32 bytes em base64).');
  const chave = Buffer.from(base64.trim(), 'base64');
  if (chave.length !== 32) throw new Error('A COPIA_CHAVE precisa ter 32 bytes em base64 (gere com: openssl rand -base64 32).');
  return chave;
}

function cabecalho(): Buffer {
  return Buffer.concat([MAGICA, Buffer.from([VERSAO_FORMATO])]);
}

/** Cifra o fluxo: escreve cabeçalho e IV, os dados cifrados e, no fim, a marca de autenticação. */
export function cifrador(chave: Buffer): Transform {
  const iv = randomBytes(IV_BYTES);
  const cab = cabecalho();
  const cifra = createCipheriv('aes-256-gcm', chave, iv);
  cifra.setAAD(cab);
  let comecou = false;
  return new Transform({
    transform(pedaco: Buffer, _c, feito) {
      if (!comecou) { this.push(cab); this.push(iv); comecou = true; }
      feito(null, cifra.update(pedaco));
    },
    flush(feito) {
      if (!comecou) { this.push(cab); this.push(iv); }
      this.push(cifra.final());
      feito(null, cifra.getAuthTag());
    },
  });
}

/**
 * Decifra o fluxo. Os dados decifrados saem antes de a marca ser conferida (ela está no fim): quem consome só pode confiar
 * no que recebeu depois de o fluxo terminar sem erro (a restauração decifra inteiro para um arquivo e só depois o lê).
 */
export function decifrador(chave: Buffer): Transform {
  let inicio = Buffer.alloc(0);
  let decifra: DecipherGCM | null = null;
  // Os últimos 16 bytes podem ser a marca: ficam guardados até chegar mais ou o fluxo acabar.
  let rabo = Buffer.alloc(0);
  const naoECopia = () => new Error('Este arquivo não é uma cópia do sistema (cabeçalho desconhecido).');
  return new Transform({
    transform(pedaco: Buffer, _c, feito) {
      try {
        if (!decifra) {
          inicio = Buffer.concat([inicio, pedaco]);
          if (inicio.length < CABECALHO_BYTES + IV_BYTES) return feito();
          if (!inicio.subarray(0, MAGICA.length).equals(MAGICA)) return feito(naoECopia());
          const versao = inicio[MAGICA.length]!;
          if (versao !== VERSAO_FORMATO) return feito(new Error(`Cópia na versão ${versao} do formato; este programa lê a versão ${VERSAO_FORMATO}.`));
          decifra = createDecipheriv('aes-256-gcm', chave, inicio.subarray(CABECALHO_BYTES, CABECALHO_BYTES + IV_BYTES));
          decifra.setAAD(inicio.subarray(0, CABECALHO_BYTES));
          pedaco = inicio.subarray(CABECALHO_BYTES + IV_BYTES);
          inicio = Buffer.alloc(0);
        }
        const tudo = Buffer.concat([rabo, pedaco]);
        const corte = Math.max(0, tudo.length - MARCA_BYTES);
        rabo = tudo.subarray(corte);
        feito(null, corte > 0 ? decifra.update(tudo.subarray(0, corte)) : undefined);
      } catch (e) {
        feito(e as Error);
      }
    },
    flush(feito) {
      if (!decifra || rabo.length < MARCA_BYTES) return feito(naoECopia());
      try {
        decifra.setAuthTag(rabo);
        feito(null, decifra.final());
      } catch {
        feito(new Error(ERRO_AUTENTICACAO));
      }
    },
  });
}
