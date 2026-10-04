import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const globais = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('largura do índice da ficha do cliente (imagem 00-cliente-cadastro, D28)', () => {
  it('token em rem (acompanha a letra) e utilitário w-indice-ficha', () => {
    expect(tokens).toMatch(/--client-index-width:\s*calc\(220rem \/ 14\)/);
    expect(globais).toMatch(/--spacing-indice-ficha:\s*var\(--client-index-width\)/);
  });
});
