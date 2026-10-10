// Revisão final (M2): scripts/publicacao/esperar-saude.sh contra um /saude falso local. 503 com falhas só do dia a dia
// (ia, envios_com_falha, conversas_atrasadas) e build novo passa; ambiente, instancias, parado ou build antigo, não.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../../../../scripts/publicacao/esperar-saude.sh', import.meta.url));
// No Windows, o "bash" do PATH pode ser o do WSL; o do Git é o que roda os scripts aqui (na CI, o do Linux).
const GIT_BASH = 'C:\\Program Files\\Git\\bin\\bash.exe';
const BASH = process.platform === 'win32' && existsSync(GIT_BASH) ? GIT_BASH : 'bash';
const INICIO = '2026-10-30T12:00:00.000Z';
const NOVO = '2026-10-30T12:05:00.000Z';
const ANTIGO = '2026-10-29T12:00:00.000Z';

let servidor: Server | null = null;
afterEach(async () => {
  await new Promise<void>((ok) => (servidor ? servidor.close(() => ok()) : ok()));
  servidor = null;
});

async function saudeFalsa(codigo: number, corpo: object): Promise<string> {
  servidor = createServer((_req, res) => { res.writeHead(codigo, { 'content-type': 'application/json' }); res.end(JSON.stringify(corpo)); });
  await new Promise<void>((ok) => servidor!.listen(0, '127.0.0.1', () => ok()));
  return `http://127.0.0.1:${(servidor!.address() as AddressInfo).port}/saude`;
}

/** Uma consulta só (ESPERA_SAUDE_MINUTOS=0): o resultado dela decide a saída. */
function rodar(url: string): Promise<{ codigo: number; saida: string }> {
  return new Promise((ok) => {
    execFile(BASH, [SCRIPT], {
      env: { ...process.env, SAUDE_URL: url, SAUDE_TOKEN: 'x', INICIO, ESPERA_SAUDE_MINUTOS: '0', ESPERA_SAUDE_INTERVALO: '0' },
      timeout: 30_000,
    }, (erro, stdout, stderr) => ok({ codigo: erro ? Number((erro as { code?: number }).code ?? 1) : 0, saida: `${stdout}${stderr}` }));
  });
}

describe('esperar-saude.sh', () => {
  it('200 com build novo: passa', async () => {
    const r = await rodar(await saudeFalsa(200, { ok: true, falhas: [], build_em: NOVO }));
    expect(r.codigo).toBe(0);
    expect(r.saida).toContain('Trabalhador novo no ar');
  });

  it('503 só com ia, envios_com_falha e conversas_atrasadas, build novo: passa com aviso', async () => {
    const r = await rodar(await saudeFalsa(503, { ok: false, falhas: ['ia', 'envios_com_falha', 'conversas_atrasadas'], build_em: NOVO }));
    expect(r.codigo).toBe(0);
    expect(r.saida).toContain('::warning::');
    expect(r.saida).toContain('ia, envios_com_falha, conversas_atrasadas');
  });

  it.each([['ambiente'], ['instancias'], ['parado'], ['whatsapp']])('503 com %s (build novo): não passa', async (falha) => {
    const r = await rodar(await saudeFalsa(503, { ok: false, falhas: ['ia', falha], build_em: NOVO }));
    expect(r.codigo).toBe(1);
    expect(r.saida).toContain(`falhas: ia, ${falha}`);
  });

  it('503 só com falhas toleradas, mas build antigo: não passa', async () => {
    const r = await rodar(await saudeFalsa(503, { ok: false, falhas: ['ia'], build_em: ANTIGO }));
    expect(r.codigo).toBe(1);
    expect(r.saida).toContain('ainda é o trabalhador antigo');
  });

  it('200 com build antigo: não passa', async () => {
    const r = await rodar(await saudeFalsa(200, { ok: true, falhas: [], build_em: ANTIGO }));
    expect(r.codigo).toBe(1);
  });
});
