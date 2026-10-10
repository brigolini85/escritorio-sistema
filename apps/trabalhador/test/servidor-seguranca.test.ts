// Auditoria 3.1, 3.4, 3.7: webhook fechado. Sem banco: repositório falso.
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import type { Repos } from '@escritorio/db';
import { CanalFalso } from '../src/canal/falso';
import { criarServidor, type DepsServidor } from '../src/servidor';
import { FilaFalsa } from './apoio/fila-falsa';
import * as f from './fixtures/zapi/sinteticos';

const SEGREDO = 'segredo-com-16-caracteres';
const INSTANCIA = 'INST-CERTA';

function montar(extra: Partial<DepsServidor> = {}) {
  const linhas: string[] = [];
  const stream = new Writable({ write(c, _e, cb) { linhas.push(String(c)); cb(); } });
  const gravadas: unknown[] = [];
  const alertas: string[] = [];
  const repos = {
    buscarContato: async () => null,
    obterOuCriarConversa: async () => ({ id: 'conv-1', cliente_em_foco: null }),
    inserirMensagemEntrada: async (m: unknown) => { gravadas.push(m); return { duplicada: false }; },
    alertaRecente: async (m: string) => alertas.includes(m),
    registrarAlerta: async (a: { mensagem: string }) => { alertas.push(a.mensagem); },
  } as unknown as Repos;
  const fila = new FilaFalsa();
  const app = criarServidor({ canal: new CanalFalso(), repos, fila, segredo: SEGREDO, relogio: () => new Date(),
    instancia: INSTANCIA, logStream: stream, ...extra });
  return { app, linhas, gravadas, alertas, fila };
}
const doInstancia = { ...f.texto, instanceId: INSTANCIA };
const URL_OK = `/webhook/zapi/${SEGREDO}`;

describe('segredo fora do log (3.4)', () => {
  it.each([
    ['POST com barra no fim', 'POST', `/webhook/zapi/${SEGREDO}/`, SEGREDO],
    ['GET aberto no navegador', 'GET', `/webhook/zapi/${SEGREDO}`, SEGREDO],
    ['sub-rota desconhecida', 'POST', `/webhook/zapi/${SEGREDO}/received`, SEGREDO],
    ['segredo de 200 caracteres', 'POST', `/webhook/zapi/${'a'.repeat(200)}`, 'a'.repeat(50)],
    ['barra dupla antes de webhook', 'POST', `//webhook/zapi/${SEGREDO}/`, SEGREDO],
    ['token na query', 'GET', `/outra?token=${SEGREDO}`, SEGREDO],
    ['token na query do /saude', 'GET', `/saude?token=${SEGREDO}`, SEGREDO],
  ])('%s', async (_n, method, url, segredo) => {
    const { app, linhas } = montar();
    const r = await app.inject({ method: method as 'GET' | 'POST', url, payload: method === 'POST' ? doInstancia : undefined });
    expect(r.body).not.toContain(segredo);
    expect(linhas.join('')).not.toContain(segredo);
    expect(linhas.length).toBeGreaterThan(0);
  });

  it('404 e 500 próprios respondem sem eco da URL', async () => {
    const { app } = montar();
    const r = await app.inject({ method: 'GET', url: '/qualquer-coisa-123' });
    expect(r.statusCode).toBe(404);
    expect(r.body).not.toContain('qualquer-coisa-123');
  });

  it('o 500 loga a causa (err), sem a URL crua', async () => {
    const { app, linhas } = montar({ canal: { interpretarWebhook: () => { throw new Error('causa-do-erro'); } } as never });
    const r = await app.inject({ method: 'POST', url: URL_OK, payload: doInstancia });
    expect(r.statusCode).toBe(500);
    expect(linhas.join('')).toContain('causa-do-erro');
    expect(linhas.join('')).not.toContain(SEGREDO);
  });
  it('o 401 de segredo errado também não loga o segredo tentado', async () => {
    const { app, linhas } = montar();
    await app.inject({ method: 'POST', url: '/webhook/zapi/tentativa-errada-123', payload: doInstancia });
    expect(linhas.join('')).not.toContain('tentativa-errada-123');
  });
});

describe('origem do evento (3.1)', () => {
  it('instanceId de outra instância: 200 e nada gravado', async () => {
    const { app, gravadas, fila, linhas } = montar();
    const r = await app.inject({ method: 'POST', url: URL_OK, payload: { ...f.texto, instanceId: 'OUTRA' } });
    expect(r.json()).toEqual({ ok: true });
    expect(gravadas).toHaveLength(0);
    expect(fila.enviados).toHaveLength(0);
    expect(linhas.join('')).toContain('instancia_diferente');
  });
  it('3 descartes por instância: um alerta crítico só', async () => {
    const { app, alertas } = montar();
    for (let i = 0; i < 3; i++) await app.inject({ method: 'POST', url: URL_OK, payload: { ...f.texto, messageId: 'X' + i, instanceId: 'OUTRA' } });
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toContain('ZAPI_INSTANCIA');
  });
  it('compara sem espaço nem maiúscula: "abc " igual a "ABC"', async () => {
    const { app, gravadas, alertas } = montar({ instancia: 'ABC' });
    await app.inject({ method: 'POST', url: URL_OK, payload: { ...f.texto, instanceId: 'abc ' } });
    expect(gravadas).toHaveLength(1);
    expect(alertas).toHaveLength(0);
  });
  it('instanceId certo grava', async () => {
    const { app, gravadas } = montar();
    await app.inject({ method: 'POST', url: URL_OK, payload: doInstancia });
    expect(gravadas).toHaveLength(1);
  });
  it('sem instanceId também é descartado (as capturas reais da Z-API sempre trazem)', async () => {
    const { app, gravadas } = montar();
    await app.inject({ method: 'POST', url: URL_OK, payload: f.texto });
    expect(gravadas).toHaveLength(0);
  });
  it('fromMe de outra instância não vai para a fila de verificação', async () => {
    const { app, fila } = montar();
    await app.inject({ method: 'POST', url: URL_OK, payload: { ...f.enviadaPorMim, instanceId: 'OUTRA' } });
    expect(fila.enviados).toHaveLength(0);
  });
});

describe('limite de requisições', () => {
  // Revisão final (M3): antes, a 121ª da própria Z-API (segredo certo) recebia 429 e a mensagem se perdia num pico. Só a
  // afirmação mudou: o limite conta só o segredo errado.
  it('Z-API autenticada não é limitada: 130 no mesmo minuto, todas gravadas', async () => {
    const { app, gravadas } = montar();
    for (let i = 0; i < 130; i++) {
      const r = await app.inject({ method: 'POST', url: URL_OK, payload: { ...doInstancia, messageId: `M-${i}` } });
      expect(r.statusCode).toBe(200);
    }
    expect(gravadas).toHaveLength(130);
  });
  it('segredo errado: a 121ª no mesmo minuto recebe 429; o segredo certo do mesmo IP continua passando', async () => {
    const { app, gravadas } = montar();
    let ultimo = 0;
    for (let i = 0; i < 121; i++) {
      const r = await app.inject({ method: 'POST', url: `/webhook/zapi/errado-${i}-xxxxxxxxxxxx`, payload: doInstancia });
      ultimo = r.statusCode;
      if (i < 120) expect(r.statusCode).toBe(401);
    }
    expect(ultimo).toBe(429);
    expect((await app.inject({ method: 'POST', url: URL_OK, payload: { ...doInstancia, messageId: 'M-certa' } })).statusCode).toBe(200);
    expect(gravadas).toHaveLength(1);
  });
  it('o IP do limite é o valor mais à direita do x-forwarded-for (o da esquerda é forjável)', async () => {
    const { app } = montar();
    for (let i = 0; i < 121; i++) {
      await app.inject({ method: 'POST', url: '/webhook/zapi/errado-xxxxxxxxxxxxxxx', payload: doInstancia,
        headers: { 'x-forwarded-for': `9.9.9.${i % 250}, 200.1.1.1` } });
    }
    const forjado = await app.inject({ method: 'POST', url: '/webhook/zapi/errado-xxxxxxxxxxxxxxx', payload: doInstancia,
      headers: { 'x-forwarded-for': '1.2.3.4, 200.1.1.1' } });
    expect(forjado.statusCode).toBe(429);
    const outro = await app.inject({ method: 'POST', url: '/webhook/zapi/errado-xxxxxxxxxxxxxxx', payload: doInstancia,
      headers: { 'x-forwarded-for': '200.1.1.1, 200.2.2.2' } });
    expect(outro.statusCode).toBe(401);
  });
  it('31ª no /saude recebe 429; /vivo não é limitado', async () => {
    const { app } = montar();
    let ultimo = 0;
    for (let i = 0; i < 31; i++) ultimo = (await app.inject({ method: 'GET', url: '/saude' })).statusCode;
    expect(ultimo).toBe(429);
    expect((await app.inject({ method: 'GET', url: '/vivo' })).statusCode).toBe(200);
  });
  it('IPs diferentes têm contagens separadas', async () => {
    const { app } = montar();
    for (let i = 0; i < 31; i++) await app.inject({ method: 'GET', url: '/saude', remoteAddress: '10.0.0.1' });
    expect((await app.inject({ method: 'GET', url: '/saude', remoteAddress: '10.0.0.2' })).statusCode).not.toBe(429);
  });
});

describe('descartes (3.7)', () => {
  it('corpo fora do esquema: log webhook_descartado com o type, sem o conteúdo', async () => {
    const { app, linhas, gravadas } = montar();
    const r = await app.inject({ method: 'POST', url: URL_OK,
      payload: { ...doInstancia, phone: null, text: { message: 'CONTEUDO-SECRETO' } } });
    expect(r.statusCode).toBe(200);
    expect(gravadas).toHaveLength(0);
    const log = linhas.join('');
    expect(log).toContain('webhook_descartado');
    expect(log).toContain('ReceivedCallback');
    expect(log).not.toContain('CONTEUDO-SECRETO');
  });
  it.each([
    ['status_ou_canal', { broadcast: true }],
    ['status_ou_canal', { isNewsletter: true }],
    ['status_ou_canal', { isStatusReply: true }],
  ])('descarte esperado (%s) deixa o motivo no log, não grava e não conta para o alerta', async (motivo, extra) => {
    const { app, linhas, gravadas, alertas } = montar();
    for (let i = 0; i < 25; i++) await app.inject({ method: 'POST', url: URL_OK, payload: { ...doInstancia, ...extra } });
    expect(gravadas).toHaveLength(0);
    expect(alertas).toHaveLength(0);
    expect(linhas.join('')).toContain(`"motivo":"${motivo}"`);
  });
  it('edição: grava como mensagem nova e deixa o motivo edicao no log', async () => {
    const { app, linhas, gravadas } = montar();
    await app.inject({ method: 'POST', url: URL_OK, payload: { ...doInstancia, isEdit: true, momment: 5, text: { message: 'corrigido' } } });
    expect(gravadas).toHaveLength(1);
    expect(linhas.join('')).toContain('"motivo":"edicao"');
  });
  it('auditoria 3.7 (revisão 2): edição do escritório (fromMe) não grava, não vai para a verificação nem gera alerta', async () => {
    const { app, linhas, gravadas, alertas, fila } = montar();
    await app.inject({ method: 'POST', url: URL_OK, payload: { ...doInstancia, fromMe: true, isEdit: true, momment: 5, text: { message: 'corrigido' } } });
    expect(gravadas).toHaveLength(0);
    expect(fila.enviados).toHaveLength(0);
    expect(alertas).toHaveLength(0);
    expect(linhas.join('')).toContain('"motivo":"edicao"');
  });
  it('auditoria 3.7 (revisão 2): edição vazia só fica no log (edicao), sem gravar nem contar para o alerta', async () => {
    const { app, linhas, gravadas, alertas } = montar();
    for (let i = 0; i < 25; i++) await app.inject({ method: 'POST', url: URL_OK, payload: { ...doInstancia, isEdit: true, momment: i, text: { message: '' } } });
    expect(gravadas).toHaveLength(0);
    expect(alertas).toHaveLength(0);
    expect(linhas.join('')).toContain('"motivo":"edicao"');
  });
  it('messageId vazio não grava', async () => {
    const { app, gravadas } = montar();
    await app.inject({ method: 'POST', url: URL_OK, payload: { ...doInstancia, messageId: '' } });
    expect(gravadas).toHaveLength(0);
  });
  it('mais de 20 descartes em 10 min: um alerta ao dono, uma vez só', async () => {
    const { app, alertas } = montar();
    for (let i = 0; i < 30; i++) await app.inject({ method: 'POST', url: URL_OK, payload: { ...doInstancia, phone: null } });
    expect(alertas).toHaveLength(1);
  });
});
