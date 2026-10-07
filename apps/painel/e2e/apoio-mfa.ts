import { createHmac } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';

// Segurança do login (item 8): administrador e quem vê acessos de portais confirmam o código do aplicativo autenticador.
// Nos testes, o "aplicativo" é este arquivo: guarda a chave de cada e-mail e calcula o código (RFC 6238, 30 s, 6 números).

const ARQUIVO = join(tmpdir(), 'painel-e2e-segundo-fator', 'chaves.json');

function lerChaves(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(ARQUIVO, 'utf8')) as Record<string, string>;
  } catch {
    return {};
  }
}

export function guardarChave(email: string, segredo: string): void {
  mkdirSync(join(tmpdir(), 'painel-e2e-segundo-fator'), { recursive: true });
  writeFileSync(ARQUIVO, JSON.stringify({ ...lerChaves(), [email]: segredo.replace(/\s+/g, '') }));
}

export function chaveDe(email: string): string {
  const s = lerChaves()[email];
  if (!s) throw new Error(`Sem a chave do aplicativo de ${email}: o teste precisa cadastrar o segundo fator antes.`);
  return s;
}

function base32(texto: string): Buffer {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of texto.replace(/=+$/, '').toUpperCase()) bits += alfabeto.indexOf(c).toString(2).padStart(5, '0');
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function codigoTotp(segredo: string, quando = Date.now()): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(quando / 1000 / 30)));
  const h = createHmac('sha1', base32(segredo)).update(contador).digest();
  const deslocamento = h[h.length - 1]! & 0xf;
  const n = (h.readUInt32BE(deslocamento) & 0x7fffffff) % 1_000_000;
  return String(n).padStart(6, '0');
}

/** Na tela /segundo-fator: cadastra o aplicativo (lendo a chave mostrada) ou confere o código, e espera o destino. */
export async function passarPeloSegundoFator(page: Page, email: string, destino = '**/inicio'): Promise<void> {
  const botao = page.getByRole('button', { name: 'Mostrar o QR code' });
  await botao.or(page.getByLabel('Código do aplicativo')).first().waitFor();
  const cadastro = await botao.isVisible();
  if (cadastro) {
    await botao.click();
    guardarChave(email, (await page.getByTestId('segredo-totp').textContent()) ?? '');
  }
  const segredo = chaveDe(email);
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    await page.getByLabel('Código do aplicativo').fill(codigoTotp(segredo));
    await page.getByRole('button', { name: cadastro ? 'Ativar e entrar' : 'Confirmar' }).click();
    try {
      await page.waitForURL(destino, { timeout: 15_000 });
      return;
    } catch (e) {
      // Código trocou no meio (virada dos 30 s): espera o próximo e tenta de novo.
      if (tentativa === 1) throw e;
      await page.waitForTimeout(31_000 - (Date.now() % 30_000));
    }
  }
}

/** Sessão pela API (supabase-js) com o segundo fator, para chamar as funções sensíveis como o navegador faria. */
export async function elevarSessao(sb: SupabaseClient, email: string): Promise<void> {
  const { data: exige } = await sb.rpc('exige_segundo_fator');
  if (!exige) return;
  const { data: fatores } = await sb.auth.mfa.listFactors();
  let fator = fatores?.totp?.find((f) => f.status === 'verified');
  if (!fator) {
    for (const f of fatores?.all ?? []) if (f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: `e2e ${Date.now()}` });
    if (error) throw error;
    guardarChave(email, data.totp.secret);
    const r = await sb.auth.mfa.challengeAndVerify({ factorId: data.id, code: codigoTotp(data.totp.secret) });
    if (r.error) throw r.error;
    return;
  }
  const r = await sb.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigoTotp(chaveDe(email)) });
  if (r.error) throw r.error;
}
