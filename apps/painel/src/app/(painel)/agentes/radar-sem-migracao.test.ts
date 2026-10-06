import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { radarSemMigracao } = await import('./radar-sem-migracao');

describe('radarSemMigracao', () => {
  const falta = { code: 'PGRST205' };
  it('erro de tabela ausente na contagem', () => {
    expect(radarSemMigracao({ contagem: { count: null, error: falta }, giro: { error: null } })).toBe(true);
  });
  it('contagem nula sem erro e giros sem a tabela', () => {
    expect(radarSemMigracao({ contagem: { count: null, error: null }, giro: { error: falta } })).toBe(true);
  });
  it('tudo certo', () => {
    expect(radarSemMigracao({ contagem: { count: 3, error: null }, giro: { error: null } })).toBe(false);
  });
  it('outro erro na contagem não é falta de migração', () => {
    expect(radarSemMigracao({ contagem: { count: null, error: { code: '57014' } }, giro: { error: null } })).toBe(false);
  });
});
