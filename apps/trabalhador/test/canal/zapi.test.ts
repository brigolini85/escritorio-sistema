import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { criarCanalZapi } from '../../src/canal/zapi';
import * as f from '../fixtures/zapi/sinteticos';

const cfg = { instancia: 'INST', token: 'TOK', clientToken: 'CLI' };

describe('interpretarWebhook', () => {
  const canal = criarCanalZapi(cfg);
  it('texto', () => {
    expect(canal.interpretarWebhook(f.texto)).toEqual({
      idProvedor: 'MSG-TEXTO-1', instanciaId: null, telefone: '5531999990001', enviadaPorMim: false, ehGrupo: false,
      nomeRemetente: 'João', tipo: 'texto', texto: 'Preciso da guia do DAS', midia: null,
    });
  });
  it('áudio', () => {
    const m = canal.interpretarWebhook(f.audio)!;
    expect(m.tipo).toBe('audio');
    expect(m.midia).toEqual({ url: 'https://z-api.exemplo/audio.ogg', mime: 'audio/ogg; codecs=opus', nomeArquivo: null });
  });
  it('imagem com legenda vira texto da mensagem', () => {
    const m = canal.interpretarWebhook(f.imagem)!;
    expect(m.tipo).toBe('imagem');
    expect(m.texto).toBe('segue o pedido');
  });
  it('documento', () => {
    expect(canal.interpretarWebhook(f.documento)!.midia?.nomeArquivo).toBe('extrato.pdf');
  });
  it('grupo e enviada por mim são sinalizadas', () => {
    expect(canal.interpretarWebhook(f.grupo)!.ehGrupo).toBe(true);
    expect(canal.interpretarWebhook(f.enviadaPorMim)!.enviadaPorMim).toBe(true);
  });
  it('tipo não suportado vira "outro"', () => {
    expect(canal.interpretarWebhook(f.figurinha)!.tipo).toBe('outro');
  });
  it('corpo que não é mensagem recebida devolve null', () => {
    expect(canal.interpretarWebhook({ type: 'MessageStatusCallback', status: 'READ' })).toBeNull();
    expect(canal.interpretarWebhook('lixo')).toBeNull();
  });
  it('evento com notification (ex.: criação de grupo) devolve null', () => {
    expect(canal.interpretarWebhook({ ...f.grupo, notification: 'GROUP_CREATE', text: undefined })).toBeNull();
  });
  it('legenda vazia ("" na imagem, null no documento) vira texto null', () => {
    expect(canal.interpretarWebhook({ ...f.imagem, image: { ...f.imagem.image, caption: '' } })!.texto).toBeNull();
    expect(canal.interpretarWebhook({ ...f.documento, document: { ...f.documento.document, caption: null } })!.texto).toBeNull();
  });
  // Auditoria 3.7 (resto): status, lista de transmissão e canal não viram mensagem do cliente.
  it.each([
    ['broadcast', { broadcast: true }],
    ['isNewsletter', { isNewsletter: true }],
    ['isStatusReply', { isStatusReply: true }],
  ])('%s devolve null', (_n, extra) => {
    expect(canal.interpretarWebhook({ ...f.texto, ...extra })).toBeNull();
  });
  it('auditoria 3.7 (revisão): edição vira mensagem de texto nova, com o prefixo e id próprio (a original não é descartada)', () => {
    const corpo = { ...f.texto, isEdit: true, momment: 1759000000999, text: { message: 'Preciso da guia do DAS de março' } };
    const m = canal.interpretarWebhook(corpo)!;
    expect(m).toMatchObject({ tipo: 'texto', texto: '(mensagem editada) Preciso da guia do DAS de março', idProvedor: 'MSG-TEXTO-1:edit:1759000000999' });
    // A mesma edição entregue de novo tem o mesmo id (a deduplicação do banco descarta a repetição).
    expect(canal.interpretarWebhook(corpo)!.idProvedor).toBe(m.idProvedor);
  });
  it('os mesmos campos falsos (como nas capturas reais) não mudam nada', () => {
    expect(canal.interpretarWebhook({ ...f.texto, broadcast: false, isNewsletter: false, isStatusReply: false, isEdit: false, waitingMessage: false })!.tipo).toBe('texto');
  });
  it('mensagem ainda não decifrada (waitingMessage) continua chegando à equipe como "outro"', () => {
    expect(canal.interpretarWebhook({ ...f.texto, text: undefined, waitingMessage: true })!.tipo).toBe('outro');
  });
  it('interpreta todas as capturas reais da Task 1', () => {
    const pasta = new URL('../fixtures/zapi/reais/', import.meta.url);
    expect(existsSync(pasta), 'faltam as capturas reais da Task 1').toBe(true);
    for (const arquivo of readdirSync(pasta)) {
      const corpo = JSON.parse(readFileSync(new URL(arquivo, pasta), 'utf8'));
      const m = canal.interpretarWebhook(corpo);
      if (arquivo === 'grupo-notificacao.json') {
        expect(m, arquivo).toBeNull();
        continue;
      }
      expect(m, arquivo).not.toBeNull();
      expect(m!.idProvedor, arquivo).toBeTruthy();
    }
  });
  it('capturas reais: tipos e mídia', () => {
    const ler = (n: string) => canal.interpretarWebhook(JSON.parse(readFileSync(new URL(`../fixtures/zapi/reais/${n}.json`, import.meta.url), 'utf8')))!;
    expect(ler('texto').tipo).toBe('texto');
    expect(ler('audio').midia?.url).toMatch(/^https:/);
    expect(ler('imagem')).toMatchObject({ tipo: 'imagem', texto: null });
    expect(ler('documento')).toMatchObject({ tipo: 'documento', texto: null });
    expect(ler('documento').midia?.nomeArquivo).toBeTruthy();
    expect(ler('grupo').ehGrupo).toBe(true);
    expect(ler('enviada-pela-api').enviadaPorMim).toBe(true);
  });
});

describe('envio', () => {
  it('arquivo sem extensão no nome é enviado como PDF', async () => {
    const buscar = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messageId: 'M2' })));
    await criarCanalZapi(cfg, buscar).enviarArquivo('5531999990001', { url: 'https://x/a', nome: 'contrato' });
    expect(buscar.mock.calls[0]![0]).toBe('https://api.z-api.io/instances/INST/token/TOK/send-document/pdf');
  });
  it('envia texto com Client-Token e devolve o id da mensagem', async () => {
    const buscar = vi.fn().mockResolvedValue(new Response(JSON.stringify({ zaapId: 'Z1', messageId: 'M1', id: 'M1' })));
    const canal = criarCanalZapi(cfg, buscar);
    expect(await canal.enviarTexto('5531999990001', 'Olá')).toEqual({ idProvedor: 'M1' });
    const [url, init] = buscar.mock.calls[0]!;
    expect(url).toBe('https://api.z-api.io/instances/INST/token/TOK/send-text');
    expect(init.headers['Client-Token']).toBe('CLI');
    expect(JSON.parse(init.body)).toEqual({ phone: '5531999990001', message: 'Olá', delayTyping: 2 });
  });
  it('falha de envio vira erro', async () => {
    const buscar = vi.fn().mockResolvedValue(new Response('erro', { status: 500 }));
    await expect(criarCanalZapi(cfg, buscar).enviarTexto('5531999990001', 'x')).rejects.toThrow('Z-API 500');
  });
  it('status lê "connected"', async () => {
    const buscar = vi.fn().mockResolvedValue(new Response(JSON.stringify({ connected: true })));
    expect(await criarCanalZapi(cfg, buscar).status()).toEqual({ conectado: true });
  });
});
