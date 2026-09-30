import { describe, expect, it } from 'vitest';
import { decidirRolagem, JANELA_ENVIO_MS } from './rolagem-lista';

const longe = JANELA_ENVIO_MS + 1;

describe('decidirRolagem', () => {
  it('primeira exibição vai para o fim', () => {
    expect(decidirRolagem({ anterior: null, ultima: 'a-false', noFim: false, desdeEnvioMs: longe })).toBe('inicio');
  });
  it('nada novo: mantém o fim só de quem está no fim', () => {
    expect(decidirRolagem({ anterior: 'a-false', ultima: 'a-false', noFim: true, desdeEnvioMs: longe })).toBe('manter-fim');
    expect(decidirRolagem({ anterior: 'a-false', ultima: 'a-false', noFim: false, desdeEnvioMs: longe })).toBe('nada');
  });
  it('algo novo: desce no fim ou logo depois de perguntar; senão avisa', () => {
    expect(decidirRolagem({ anterior: 'a-true', ultima: 'b-false', noFim: true, desdeEnvioMs: longe })).toBe('descer');
    expect(decidirRolagem({ anterior: 'a-false', ultima: 'a-true', noFim: false, desdeEnvioMs: 2000 })).toBe('descer');
    expect(decidirRolagem({ anterior: 'a-true', ultima: 'b-false', noFim: false, desdeEnvioMs: longe })).toBe('avisar');
  });
});
