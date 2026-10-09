import { beforeEach, describe, expect, it, vi } from 'vitest';
import { segredoDaSessao } from './segredo-sessao';

// Auditoria 2.7: o cookie de atividade tem segredo próprio (não a chave de serviço). Sem ele fora do computador local, a
// sessão conta como vencida (falha fechada).
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('segredoDaSessao', () => {
  it('usa PAINEL_SEGREDO_SESSAO (nunca a chave de serviço)', () => {
    const v = 'x'.repeat(32);
    expect(segredoDaSessao({ PAINEL_SEGREDO_SESSAO: v, AMBIENTE: 'producao', SUPABASE_SERVICE_ROLE_KEY: 'chave' })).toBe(v);
  });
  it('produção ou homologação sem ele, ou curto: vazio (o middleware trata a sessão como vencida)', () => {
    expect(segredoDaSessao({ AMBIENTE: 'producao', SUPABASE_SERVICE_ROLE_KEY: 'chave' })).toBe('');
    expect(segredoDaSessao({ AMBIENTE: 'homologacao', PAINEL_SEGREDO_SESSAO: 'curto' })).toBe('');
    expect(segredoDaSessao({})).toBe('');
  });
  it('local sem ele: um segredo sorteado, o mesmo durante o processo, com aviso', () => {
    const a = segredoDaSessao({ AMBIENTE: 'local' });
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(segredoDaSessao({ AMBIENTE: 'local' })).toBe(a);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(String((console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![0])).not.toContain(a);
  });
});
