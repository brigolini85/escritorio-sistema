import { describe, expect, it } from 'vitest';
import { situacaoDoSinal } from './sinal-vida';

describe('situacaoDoSinal', () => {
  const agora = new Date('2026-09-30T17:00:00Z');
  const ha = (s: number) => new Date(agora.getTime() - s * 1000).toISOString();
  it('pelo tempo desde o último sinal', () => {
    expect(situacaoDoSinal(ha(40), agora)).toBe('ok');
    expect(situacaoDoSinal(ha(120), agora)).toBe('atrasado');
    expect(situacaoDoSinal(ha(599), agora)).toBe('atrasado');
    expect(situacaoDoSinal(ha(600), agora)).toBe('parado');
  });
  it('sem registro ou data inválida: sem sinal', () => {
    expect(situacaoDoSinal(null, agora)).toBe('sem_sinal');
    expect(situacaoDoSinal('ontem', agora)).toBe('sem_sinal');
  });
  it('limites por sinal (a fila pode demorar mais)', () => {
    expect(situacaoDoSinal(ha(300), agora, { atrasadoApos: 900, paradoApos: 3600 })).toBe('ok');
  });
});
