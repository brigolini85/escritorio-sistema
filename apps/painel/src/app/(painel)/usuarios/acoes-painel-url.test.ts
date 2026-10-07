import { beforeEach, describe, expect, it, vi } from 'vitest';

// Segurança do login (item 4): convites e links de senha usam o PAINEL_URL conferido; vazio nunca vira "undefined/auth/confirm".
const falso = vi.hoisted(() => ({ convites: [] as unknown[], links: [] as unknown[], jaEntrou: false }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/sessao', () => ({ exigirAdmin: async () => ({ id: 'adm', papel: 'admin' }) }));
vi.mock('@/lib/supabase/servidor', () => ({ supabaseServidor: async () => ({ rpc: async () => ({ error: null }) }) }));
vi.mock('@/lib/supabase/servico', () => ({
  supabaseServico: () => ({
    from: () => ({ select: () => ({ in: async () => ({ data: [] }) }) }),
    auth: {
      admin: {
        inviteUserByEmail: async (email: string, op: unknown) => { falso.convites.push([email, op]); return { data: { user: { id: 'nova' } }, error: null }; },
        deleteUser: async () => ({ error: null }),
        getUserById: async () => ({ data: { user: { email: 'bia@escritorio.com', last_sign_in_at: falso.jaEntrou ? '2026-10-01T10:00:00Z' : null } }, error: null }),
      },
      resetPasswordForEmail: async (email: string, op: unknown) => { falso.links.push([email, op]); return { error: null }; },
    },
  }),
}));
import { convidarUsuario, reenviarConvite } from './acoes';

const ID = '11111111-1111-4111-8111-111111111111';
function form() {
  const f = new FormData();
  for (const [k, v] of Object.entries({ nome: 'Bia Souza', email: 'bia@escritorio.com', papel: 'atendente', horario_restrito: 'nao' })) f.append(k, v);
  return f;
}

beforeEach(() => {
  Object.assign(falso, { convites: [], links: [], jaEntrou: false });
  vi.stubEnv('PAINEL_URL', 'https://painel.escritorio.test/');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('endereço dos links de convite e senha', () => {
  it('convite novo usa PAINEL_URL', async () => {
    expect(await convidarUsuario(form())).toEqual({ ok: true, id: 'nova' });
    expect(falso.convites).toEqual([['bia@escritorio.com', { redirectTo: 'https://painel.escritorio.test/auth/confirm' }]]);
  });
  it('reenviar (já entrou) usa PAINEL_URL', async () => {
    falso.jaEntrou = true;
    await reenviarConvite(ID);
    expect(falso.links).toEqual([['bia@escritorio.com', { redirectTo: 'https://painel.escritorio.test/auth/confirm' }]]);
  });
  it('PAINEL_URL vazio: nada é enviado e a tela recebe um aviso', async () => {
    vi.stubEnv('PAINEL_URL', '');
    const r = await convidarUsuario(form());
    expect(r.ok).toBe(false);
    expect(falso.convites).toEqual([]);
    const r2 = await reenviarConvite(ID);
    expect(r2).toEqual({ ok: false, erro: 'O endereço do painel (PAINEL_URL) não está configurado. Fale com quem instalou o sistema.' });
    expect(falso.links).toEqual([]);
  });
});
