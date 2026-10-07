import { describe, expect, it } from 'vitest';
import {
  assinarAtividade, avaliarSessao, INATIVIDADE_MS, lerAtividade, lerClaims, momentoDoLogin, SESSAO_MAXIMA_MS,
} from './sessao-limites';

// Segurança do login (item 7): sessão de no máximo 12 h e 1 h sem uso, conferidas pelo painel.
const H = 60 * 60 * 1000;
const token = (corpo: object) => `cab.${Buffer.from(JSON.stringify(corpo)).toString('base64url')}.ass`;

describe('limites', () => {
  it('12 h e 1 h', () => {
    expect(SESSAO_MAXIMA_MS).toBe(12 * H);
    expect(INATIVIDADE_MS).toBe(1 * H);
  });
});

describe('lerClaims e momentoDoLogin', () => {
  it('login = o método mais antigo do amr (o segundo fator vem depois e não renova a sessão)', () => {
    const c = lerClaims(token({ session_id: 's1', aal: 'aal2', amr: [{ method: 'totp', timestamp: 2000 }, { method: 'password', timestamp: 1000 }] }));
    expect(c?.session_id).toBe('s1');
    expect(momentoDoLogin(c!)).toBe(1000 * 1000);
  });
  it('token estranho: null', () => {
    expect(lerClaims('xyz')).toBeNull();
    expect(lerClaims('a.%%%.b')).toBeNull();
    expect(momentoDoLogin({})).toBeNull();
    expect(momentoDoLogin({ amr: [{ method: 'password', timestamp: 'x' as unknown as number }] })).toBeNull();
  });
});

describe('cookie de atividade assinado', () => {
  it('lê de volta o momento assinado para a mesma sessão', async () => {
    const v = await assinarAtividade('s1', 123456, 'segredo');
    expect(await lerAtividade(v, 's1', 'segredo')).toBe(123456);
  });
  it('outra sessão, outro segredo ou valor mexido: null', async () => {
    const v = await assinarAtividade('s1', 123456, 'segredo');
    expect(await lerAtividade(v, 's2', 'segredo')).toBeNull();
    expect(await lerAtividade(v, 's1', 'outro')).toBeNull();
    expect(await lerAtividade(v.replace('123456', '999999'), 's1', 'segredo')).toBeNull();
    expect(await lerAtividade(undefined, 's1', 'segredo')).toBeNull();
    expect(await lerAtividade('lixo', 's1', 'segredo')).toBeNull();
  });
});

describe('avaliarSessao', () => {
  const agora = 100 * H;
  it('dentro dos limites: ok', () => {
    expect(avaliarSessao({ login: agora - 11 * H, atividade: agora - 59 * 60 * 1000, agora })).toBe('ok');
  });
  it('mais de 12 h desde o login: vencida, mesmo usando sem parar', () => {
    expect(avaliarSessao({ login: agora - 12 * H - 1000, atividade: agora - 1000, agora })).toBe('vencida');
  });
  it('mais de 1 h sem uso: vencida', () => {
    expect(avaliarSessao({ login: agora - 2 * H, atividade: agora - H - 1000, agora })).toBe('vencida');
  });
  it('sem cookie de atividade: conta desde o login (apagar o cookie não renova a sessão)', () => {
    expect(avaliarSessao({ login: agora - 30 * 60 * 1000, atividade: null, agora })).toBe('ok');
    expect(avaliarSessao({ login: agora - 2 * H, atividade: null, agora })).toBe('vencida');
  });
  it('atividade "no futuro" (relógio mexido) não vale', () => {
    expect(avaliarSessao({ login: agora - 2 * H, atividade: agora + 5 * H, agora })).toBe('vencida');
  });
  it('sem momento do login (token sem amr): só a inatividade vale', () => {
    expect(avaliarSessao({ login: null, atividade: agora - 1000, agora })).toBe('ok');
    expect(avaliarSessao({ login: null, atividade: null, agora })).toBe('ok');
  });
});
