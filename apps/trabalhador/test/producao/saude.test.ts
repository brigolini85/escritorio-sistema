import { describe, expect, it } from 'vitest';
import { lerConfig } from '../../src/config';
import { CanalFalso } from '../../src/canal/falso';
import { avaliarSaude, criarServidor } from '../../src/servidor';

const AGORA = new Date('2026-11-02T13:00:00Z');
const ha = (min: number) => new Date(AGORA.getTime() - min * 60_000);
const repos = (x: { sinais?: Record<string, Date>; bancoFora?: boolean }) => ({
  sinaisVida: async () => { if (x.bancoFora) throw new Error('banco fora'); return x.sinais ?? {}; },
}) as never;
const app = (r: ReturnType<typeof repos>, token?: string) =>
  criarServidor({ canal: new CanalFalso(), repos: r, fila: { enviar: async () => {} } as never, segredo: 'segredo-de-teste-123456',
    relogio: () => AGORA, saudeToken: token, ambiente: 'homologacao' });

describe('avaliarSaude (D3)', () => {
  it('tudo em dia: ok', async () => {
    expect(await avaliarSaude(repos({ sinais: { fila: ha(1), whatsapp: ha(1) } }), AGORA)).toMatchObject({ ok: true, falhas: [] });
  });
  it('cada falha com o seu nome', async () => {
    expect((await avaliarSaude(repos({ sinais: { fila: ha(4), whatsapp: ha(1) } }), AGORA)).falhas).toEqual(['batimento']);
    expect((await avaliarSaude(repos({ sinais: { fila: ha(1) } }), AGORA)).falhas).toEqual(['whatsapp']);
    expect((await avaliarSaude(repos({ bancoFora: true }), AGORA)).falhas).toEqual(['banco']);
  });
});

describe('/saude e /vivo (D3)', () => {
  it('sem token: só o ok, 200 ou 503', async () => {
    const bom = await app(repos({ sinais: { fila: ha(1), whatsapp: ha(1) } })).inject({ url: '/saude' });
    expect(bom.statusCode).toBe(200);
    expect(bom.json()).toEqual({ ok: true });
    const ruim = await app(repos({ sinais: { fila: ha(1) } })).inject({ url: '/saude' });
    expect(ruim.statusCode).toBe(503);
    expect(ruim.json()).toEqual({ ok: false });
  });
  it('banco fora: 503 só com o ok, nada de erro 500 com detalhe', async () => {
    const r = await app(repos({ bancoFora: true })).inject({ url: '/saude' });
    expect(r.statusCode).toBe(503);
    expect(r.json()).toEqual({ ok: false });
  });
  it('com o token certo (cabeçalho ou ?token=): os detalhes e o ambiente; token errado: sem detalhes', async () => {
    const a = app(repos({ sinais: { fila: ha(1) } }), 'tok-123');
    const c = await a.inject({ url: '/saude', headers: { 'x-saude-token': 'tok-123' } });
    expect(c.statusCode).toBe(503);
    expect(c.json()).toMatchObject({ ok: false, falhas: ['whatsapp'], ambiente: 'homologacao' });
    expect(c.json().sinais).toHaveProperty('fila');
    expect((await a.inject({ url: '/saude?token=tok-123' })).json()).toHaveProperty('falhas');
    const e = await a.inject({ url: '/saude', headers: { 'x-saude-token': 'errado' } });
    expect(e.statusCode).toBe(503);
    expect(e.json()).toEqual({ ok: false });
    expect((await a.inject({ url: '/saude?token=tok-12' })).json()).toEqual({ ok: false });
  });
  it('sem SAUDE_TOKEN configurado, ninguém vê detalhes (nem com token vazio)', async () => {
    const a = app(repos({ sinais: { fila: ha(1), whatsapp: ha(1) } }));
    expect((await a.inject({ url: '/saude?token=' })).json()).toEqual({ ok: true });
    expect((await a.inject({ url: '/saude', headers: { 'x-saude-token': '' } })).json()).toEqual({ ok: true });
  });
  it('/vivo: 200 mesmo com o banco e o WhatsApp fora (o contêiner não reinicia por causa do celular)', async () => {
    const r = await app(repos({ bancoFora: true })).inject({ url: '/vivo' });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true });
  });
});

describe('config SAUDE_TOKEN', () => {
  const base = {
    SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: 'k', DATABASE_URL: 'postgresql://x', ANTHROPIC_API_KEY: 'k',
    ZAPI_INSTANCIA: 'i', ZAPI_TOKEN: 't', ZAPI_CLIENT_TOKEN: 'c', WEBHOOK_SEGREDO: 'segredo-com-16-caracteres',
    TRANSCRICAO_BASE_URL: 'https://api.groq.com/openai/v1', TRANSCRICAO_API_KEY: 'k', TRANSCRICAO_MODELO: 'w', SMTP_HOST: 'smtp',
    SMTP_USUARIO: 'u', SMTP_SENHA: 's', SMTP_REMETENTE: 'avisos@escritorio.com.br', AMBIENTE: 'producao',
  };
  it('opcional; vazio conta como não informado', () => {
    expect(lerConfig(base).SAUDE_TOKEN).toBeUndefined();
    expect(lerConfig({ ...base, SAUDE_TOKEN: '  ' }).SAUDE_TOKEN).toBeUndefined();
    expect(lerConfig({ ...base, SAUDE_TOKEN: ' abc ' }).SAUDE_TOKEN).toBe('abc');
  });
});
