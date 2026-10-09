import { describe, expect, it } from 'vitest';
import { caminhoDaEmpresa, somenteDigitos, validarCnpj } from '../src/documentos';
import { TIPO_GENERICO, TIPOS_ANEXOS, TIPOS_DOCUMENTOS, tipoParaArmazenar } from '../src/tipos-arquivo';

describe('validarCnpj', () => {
  it('aceita CNPJ válido com ou sem máscara', () => {
    expect(validarCnpj('11.222.333/0001-81')).toBe(true);
    expect(validarCnpj('11222333000181')).toBe(true);
  });
  it('recusa dígito verificador errado e sequências repetidas', () => {
    expect(validarCnpj('11222333000182')).toBe(false);
    expect(validarCnpj('11111111111111')).toBe(false);
  });
  it('somenteDigitos', () => {
    expect(somenteDigitos('11.222.333/0001-81')).toBe('11222333000181');
  });
});

describe('caminhoDaEmpresa (auditoria 1.3 e 6.10)', () => {
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';
  it('aceita só arquivo na pasta da própria empresa', () => {
    expect(caminhoDaEmpresa(a, `clientes/${a}/1700000000-contrato.pdf`)).toBe(true);
    expect(caminhoDaEmpresa(a, `clientes/${b}/contrato.pdf`)).toBe(false);
    expect(caminhoDaEmpresa(a, `clientes/${a}x/contrato.pdf`)).toBe(false);
    expect(caminhoDaEmpresa(a, `${a}/contrato.pdf`)).toBe(false);
    expect(caminhoDaEmpresa(a, `clientes/${a}/../${b}/contrato.pdf`)).toBe(false);
    expect(caminhoDaEmpresa('', 'clientes//contrato.pdf')).toBe(false);
  });
});

describe('revisão da Task 10: ".." só conta como pasta', () => {
  const a = '11111111-1111-4111-8111-111111111111';
  it('nome com dois pontos seguidos é aceito; ".." como pasta, não', () => {
    expect(caminhoDaEmpresa(a, `clientes/${a}/1700000000-Relatorio..pdf`)).toBe(true);
    expect(caminhoDaEmpresa(a, `clientes/${a}/..`)).toBe(false);
    expect(caminhoDaEmpresa(a, `clientes/${a}/x/../y.pdf`)).toBe(false);
  });
});

describe('tipoParaArmazenar (auditoria 6.9)', () => {
  it('tipo da lista entra sem parâmetros e em minúsculas', () => {
    expect(tipoParaArmazenar('Audio/OGG; codecs=opus', TIPOS_ANEXOS)).toBe('audio/ogg');
    expect(tipoParaArmazenar('application/pdf', TIPOS_DOCUMENTOS)).toBe('application/pdf');
  });
  it('tipo fora da lista (ou vazio) vira application/octet-stream', () => {
    for (const t of ['application/x-pkcs12', 'application/vnd.rar', 'application/x-7z-compressed', 'binary/octet-stream', 'image/svg+xml', 'text/html', '', null]) {
      expect(tipoParaArmazenar(t, TIPOS_ANEXOS)).toBe(TIPO_GENERICO);
    }
  });
  it('as listas não têm curinga nem tipo que o navegador executa', () => {
    for (const t of [...TIPOS_ANEXOS, ...TIPOS_DOCUMENTOS]) expect(t).not.toMatch(/\*|svg|html|javascript/);
    expect(TIPOS_ANEXOS).toContain(TIPO_GENERICO);
    expect(TIPOS_DOCUMENTOS).not.toContain(TIPO_GENERICO);
    expect(TIPOS_DOCUMENTOS).toEqual(expect.arrayContaining(['image/tiff', 'image/bmp', 'application/zip', 'application/x-zip-compressed']));
  });
});
