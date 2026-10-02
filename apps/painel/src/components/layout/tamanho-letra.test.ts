import { describe, expect, it } from 'vitest';
import { classeDoTamanho, cookieDoTamanho, OPCOES_LETRA, tamanhoDoValor } from './tamanho-letra';

describe('tamanho da letra', () => {
  it('valor desconhecido, vazio ou de outro formato vira normal', () => {
    for (const v of [undefined, null, '', 'xyz', 'GRANDE', ' grande']) expect(tamanhoDoValor(v)).toBe('normal');
    expect(tamanhoDoValor('grande')).toBe('grande');
    expect(tamanhoDoValor('maior')).toBe('maior');
  });
  it('classe no <html>: normal não põe classe', () => {
    expect(classeDoTamanho('normal')).toBeUndefined();
    expect(classeDoTamanho('grande')).toBe('letra-grande');
    expect(classeDoTamanho('maior')).toBe('letra-maior');
  });
  it('cookie de um ano, no site todo', () => {
    expect(cookieDoTamanho('maior')).toBe('tamanho_letra=maior; Path=/; Max-Age=31536000; SameSite=Lax');
  });
  it('opções na ordem do menu', () => {
    expect(OPCOES_LETRA.map((o) => o.rotulo)).toEqual(['Normal', 'Grande', 'Maior']);
  });
});
