import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Segurança do login (item 2): o link do e-mail só aceita os dois tipos que o escritório manda (convite e nova senha).
const verifyOtp = vi.fn();
vi.mock('@/lib/supabase/servidor', () => ({ supabaseServidor: async () => ({ auth: { verifyOtp } }) }));
import { GET } from './route';

const pedir = (q: string) => GET(new NextRequest(`http://localhost/auth/confirm?${q}`));

beforeEach(() => {
  verifyOtp.mockReset();
  verifyOtp.mockResolvedValue({ error: null });
});

describe('/auth/confirm', () => {
  it.each(['invite', 'recovery'])('%s válido segue para definir a senha', async (type) => {
    const r = await pedir(`token_hash=abc&type=${type}`);
    expect(r.headers.get('location')).toBe('/definir-senha');
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type });
  });
  it.each(['email_change', 'signup', 'magiclink', 'email', 'Invite', 'qualquer'])('tipo %s é recusado sem consultar o Supabase', async (type) => {
    const r = await pedir(`token_hash=abc&type=${type}`);
    expect(r.headers.get('location')).toBe('/entrar?erro=link');
    expect(verifyOtp).not.toHaveBeenCalled();
  });
  it('token inválido vai para erro=link', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'expirado' } });
    const r = await pedir('token_hash=abc&type=recovery');
    expect(r.headers.get('location')).toBe('/entrar?erro=link');
  });
  it('atrás do proxy (req.url 0.0.0.0) o destino não leva o endereço interno', async () => {
    const r = await GET(new NextRequest('https://0.0.0.0:3000/auth/confirm?token_hash=abc&type=invite'));
    expect(r.status).toBe(307);
    expect(r.headers.get('location')).toBe('/definir-senha');
  });
  it('sem token vai para erro=link', async () => {
    const r = await pedir('type=recovery');
    expect(r.headers.get('location')).toBe('/entrar?erro=link');
  });
});
