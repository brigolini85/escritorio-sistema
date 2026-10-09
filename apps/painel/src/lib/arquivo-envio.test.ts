import { describe, expect, it } from 'vitest';
import { TIPO_GENERICO } from '@escritorio/core';
import { prepararAnexoResposta, prepararDocumentoEmpresa } from './arquivo-envio';

const CLIENTE = '11111111-1111-4111-8111-111111111111';
const CONVERSA = '22222222-2222-4222-8222-222222222222';

describe('prepararAnexoResposta (auditoria 6.9, revisão da Task 10)', () => {
  it('tipo fora da lista (.rar, .pfx) sobe como application/octet-stream e a mensagem guarda o original', () => {
    expect(prepararAnexoResposta(CONVERSA, 'notas fiscais.rar', 'application/vnd.rar', 1700000000000)).toEqual({
      path: `conversas/${CONVERSA}/1700000000000-notas_fiscais.rar`, nome: 'notas fiscais.rar', mime: 'application/vnd.rar', contentType: TIPO_GENERICO,
    });
    expect(prepararAnexoResposta(CONVERSA, 'cert.pfx', 'application/x-pkcs12', 1).contentType).toBe(TIPO_GENERICO);
  });
  it('tipo da lista sobe sem parâmetros; sem tipo, octet-stream', () => {
    expect(prepararAnexoResposta(CONVERSA, 'guia.pdf', 'application/pdf', 1)).toMatchObject({ mime: 'application/pdf', contentType: 'application/pdf' });
    expect(prepararAnexoResposta(CONVERSA, 'voz.ogg', 'audio/ogg; codecs=opus', 1).contentType).toBe('audio/ogg');
    expect(prepararAnexoResposta(CONVERSA, 'x', '', 1)).toMatchObject({ mime: TIPO_GENERICO, contentType: TIPO_GENERICO });
  });
});

describe('prepararDocumentoEmpresa (auditoria 1.3, 6.9; revisão da Task 10)', () => {
  it('nome com ".." e barras vira um nome só, dentro da pasta da empresa', () => {
    const r = prepararDocumentoEmpresa(CLIENTE, 'Relatório..final/../x\\y.pdf', 'application/pdf', 10, 1700000000000);
    expect(r).toEqual({ path: `clientes/${CLIENTE}/1700000000000-Relatorio.final_._x_y.pdf`, arquivoNome: 'Relatorio.final_._x_y.pdf',
      mime: 'application/pdf' });
  });
  it('sem tipo do navegador, vale PDF (como antes)', () => {
    expect(prepararDocumentoEmpresa(CLIENTE, 'a.pdf', '', 10, 1)).toMatchObject({ mime: 'application/pdf' });
  });
  it('tipo que o compartimento não aceita ou arquivo grande demais: erro antes de subir', () => {
    expect(prepararDocumentoEmpresa(CLIENTE, 'x.svg', 'image/svg+xml', 10, 1)).toEqual({ erro: expect.stringContaining('Tipo de arquivo') });
    expect(prepararDocumentoEmpresa(CLIENTE, 'a.pdf', 'application/pdf', 20 * 1024 * 1024 + 1, 1)).toEqual({ erro: expect.stringContaining('20 MB') });
    expect(prepararDocumentoEmpresa('', 'a.pdf', 'application/pdf', 10, 1)).toEqual({ erro: expect.any(String) });
  });
});
