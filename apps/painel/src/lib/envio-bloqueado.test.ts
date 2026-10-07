import { describe, expect, it } from 'vitest';
import { envioBloqueado } from './envio-bloqueado';

describe('envioBloqueado (prontidão, D2)', () => {
  it('só o id que o trabalhador dá ao envio barrado fora da produção', () => {
    expect(envioBloqueado('bloqueado-123')).toBe(true);
    expect(envioBloqueado('3EB0ABC')).toBe(false);
    expect(envioBloqueado(null)).toBe(false);
    expect(envioBloqueado(undefined)).toBe(false);
  });
});
