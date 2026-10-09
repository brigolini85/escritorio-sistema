import { describe, expect, it } from 'vitest';
import {
  assinarAtividade, atividadeNova, avaliarSessao, INATIVIDADE_MS, lerAtividade, lerClaims, momentoDoLogin, momentoDoUso, SESSAO_MAXIMA_MS, veioDeLinkRecente,
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

describe('momentoDoUso e atividadeNova (só uso de verdade conta para a 1 h)', () => {
  const agora = 100 * H;
  it('página aberta direto, cliente sem Sec-Fetch-Mode e ação de formulário: uso agora', () => {
    expect(momentoDoUso({ modo: 'navigate', acao: false, marca: undefined, agora })).toBe(agora);
    expect(momentoDoUso({ modo: null, acao: false, marca: undefined, agora })).toBe(agora);
    expect(momentoDoUso({ modo: 'cors', acao: true, marca: undefined, agora })).toBe(agora);
  });
  it('recarga, pré-carga ou link (fetch): só até o último toque gravado pela tela', () => {
    expect(momentoDoUso({ modo: 'cors', acao: false, marca: String(agora - 5000), agora })).toBe(agora - 5000);
    expect(momentoDoUso({ modo: 'same-origin', acao: false, marca: undefined, agora })).toBeNull();
    expect(momentoDoUso({ modo: 'cors', acao: false, marca: 'lixo', agora })).toBeNull();
  });
  it('toque "no futuro": até 1 min de folga vale como agora; além disso, não vale', () => {
    expect(momentoDoUso({ modo: 'cors', acao: false, marca: String(agora + 30_000), agora })).toBe(agora);
    expect(momentoDoUso({ modo: 'cors', acao: false, marca: String(agora + 5 * H), agora })).toBeNull();
  });
  it('só grava quando o uso é mais novo que a atividade já contada (ou que o login)', () => {
    expect(atividadeNova({ uso: agora, atividade: agora - H / 2, login: agora - H })).toBe(agora);
    expect(atividadeNova({ uso: agora - H, atividade: agora - H / 2, login: agora - 2 * H })).toBeNull();
    expect(atividadeNova({ uso: null, atividade: agora - H / 2, login: null })).toBeNull();
    // Toque de uma sessão anterior (mais velho que o login) não conta.
    expect(atividadeNova({ uso: agora - 3 * H, atividade: null, login: agora - H })).toBeNull();
    expect(atividadeNova({ uso: agora, atividade: null, login: null })).toBe(agora);
  });
});

// Auditoria 2.7: segredo vazio (variável faltando no middleware) não pode assinar nem aceitar cookie.
describe('segredo vazio', () => {
  it('lerAtividade com segredo vazio: null, mesmo com cookie assinado com segredo vazio', async () => {
    const v = await assinarAtividade('s1', 123456, '');
    expect(await lerAtividade(v, 's1', '')).toBeNull();
  });
});

// Auditoria 2.6: troca de senha sem a atual só para quem abriu o link (convite ou nova senha) há menos de 15 min.
describe('veioDeLinkRecente', () => {
  const agora = 1_800_000_000_000;
  const seg = (ms: number) => Math.floor((agora - ms) / 1000);
  it('otp (o que o Supabase grava para convite e nova senha) de menos de 15 min: sim', () => {
    expect(veioDeLinkRecente({ amr: [{ method: 'otp', timestamp: seg(14 * 60 * 1000) }] }, agora)).toBe(true);
    expect(veioDeLinkRecente({ amr: [{ method: 'recovery', timestamp: seg(60 * 1000) }] }, agora)).toBe(true);
    expect(veioDeLinkRecente({ amr: [{ method: 'invite', timestamp: seg(60 * 1000) }] }, agora)).toBe(true);
  });
  it('senha, link antigo, token sem amr ou momento no futuro: não', () => {
    expect(veioDeLinkRecente({ amr: [{ method: 'password', timestamp: seg(60 * 1000) }] }, agora)).toBe(false);
    expect(veioDeLinkRecente({ amr: [{ method: 'otp', timestamp: seg(16 * 60 * 1000) }] }, agora)).toBe(false);
    expect(veioDeLinkRecente({}, agora)).toBe(false);
    expect(veioDeLinkRecente(null, agora)).toBe(false);
    expect(veioDeLinkRecente({ amr: [{ method: 'otp', timestamp: seg(-10 * 60 * 1000) }] }, agora)).toBe(false);
  });
  it('totp depois do link não apaga o link', () => {
    expect(veioDeLinkRecente({ amr: [{ method: 'totp', timestamp: seg(0) }, { method: 'otp', timestamp: seg(5 * 60 * 1000) }] }, agora)).toBe(true);
  });
});
