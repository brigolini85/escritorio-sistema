import { describe, expect, it } from 'vitest';
import { avisoParaMostrar } from './aviso-login';

describe('aviso da tela de entrada', () => {
  it('vazio, nulo ou só espaços não mostra', () => {
    for (const v of [null, undefined, '', '   \n ']) expect(avisoParaMostrar(v)).toBeNull();
  });
  it('apara e corta em 200 caracteres', () => {
    expect(avisoParaMostrar('  DCTFWeb vence dia 15.  ')).toBe('DCTFWeb vence dia 15.');
    expect(avisoParaMostrar('x'.repeat(250))).toHaveLength(200);
  });
});
