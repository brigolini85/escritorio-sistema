import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const globais = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('largura da conversa do Assistente (spec 7C.3, ~470px)', () => {
  it('token em rem (acompanha a letra) e utilitário w-chat-assistente', () => {
    expect(tokens).toMatch(/--assistant-chat-width:\s*calc\(470rem \/ 14\)/);
    expect(globais).toMatch(/--spacing-chat-assistente:\s*var\(--assistant-chat-width\)/);
  });
});
