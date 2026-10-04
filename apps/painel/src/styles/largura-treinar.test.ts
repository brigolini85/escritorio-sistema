import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const globais = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('larguras do Treinar o agente (spec 7C.5, imagem B)', () => {
  it('tokens em rem (acompanham a letra) e utilitários w-lista-treinar e w-simulador-treinar', () => {
    expect(tokens).toMatch(/--training-list-width:\s*calc\(330rem \/ 14\)/);
    expect(tokens).toMatch(/--training-simulator-width:\s*calc\(410rem \/ 14\)/);
    expect(globais).toMatch(/--spacing-lista-treinar:\s*var\(--training-list-width\)/);
    expect(globais).toMatch(/--spacing-simulador-treinar:\s*var\(--training-simulator-width\)/);
  });
});
