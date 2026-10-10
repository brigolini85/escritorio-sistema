import { beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => {
  class Redirecionou extends Error { constructor(readonly para: string) { super(`NEXT_REDIRECT ${para}`); } }
  return {
    Redirecionou,
    redirect: vi.fn((para: string) => { throw new Redirecionou(para); }),
    revalidatePath: vi.fn(),
  };
});
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: nav.revalidatePath }));
const tela = vi.hoisted(() => ({ referer: '' }));
vi.mock('next/headers', () => ({ headers: async () => new Headers(tela.referer ? { referer: tela.referer } : {}) }));
vi.mock('next/navigation', () => ({
  redirect: nav.redirect,
  unstable_rethrow: (e: unknown) => { if (e instanceof nav.Redirecionou) throw e; },
}));

import { comAvisoDeErro } from './erro-formulario';
import { textoDoErro } from './erro-na-url-servidor';

process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'chave-de-teste';

const destinoDe = async (p: Promise<void>) => p.then(() => null, (e: unknown) => (e as { para: string }).para);

beforeEach(() => { nav.redirect.mockClear(); nav.revalidatePath.mockClear(); tela.referer = ''; });

describe('comAvisoDeErro (revisão final, G)', () => {
  it('deu certo com o aviso de antes na tela: volta para o destino sem ?erro=, e o aviso some', async () => {
    tela.referer = 'http://localhost:3100/clientes/1?aba=dados&erro=CNPJ%20inv%C3%A1lido';
    expect(await destinoDe(comAvisoDeErro('/clientes/1?aba=dados', async () => {}))).toBe('/clientes/1?aba=dados');
    expect(nav.revalidatePath).toHaveBeenCalledWith('/clientes/1');
  });
  it('deu certo sem aviso na tela: só atualiza os dados, sem navegar', async () => {
    tela.referer = 'http://localhost:3100/clientes/1?aba=precos';
    expect(await destinoDe(comAvisoDeErro('/clientes/1?aba=precos', async () => {}))).toBeNull();
    expect(nav.redirect).not.toHaveBeenCalled();
    expect(nav.revalidatePath).toHaveBeenCalledWith('/clientes/1');
  });
  // Revisão final (T11): antes a frase ia crua no ?erro=. Só a afirmação mudou: vai o código assinado, que a página traduz.
  it('falhou: volta com o código do erro (assinado), que a página traduz de volta na frase', async () => {
    const d1 = (await destinoDe(comAvisoDeErro('/usuarios', async () => { throw new Error('Telefone inválido'); })))!;
    expect(d1).toMatch(/^\/usuarios\?erro=s\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{32}$/);
    expect(d1).not.toContain('Telefone');
    expect(textoDoErro(new URL(d1, 'http://x').searchParams.get('erro'))).toBe('Telefone inválido');
    const d2 = (await destinoDe(comAvisoDeErro('/clientes/1?aba=dados', async () => { throw new Error('x'); })))!;
    expect(d2).toMatch(/^\/clientes\/1\?aba=dados&erro=s\./);
    expect(textoDoErro(new URL(d2, 'http://x').searchParams.get('erro'))).toBe('x');
  });
  it('a própria ação redirecionou: vale o redirecionamento dela', async () => {
    expect(await destinoDe(comAvisoDeErro('/clientes/novo', async () => { nav.redirect('/clientes/9'); }))).toBe('/clientes/9');
    expect(nav.redirect).toHaveBeenCalledTimes(1);
  });
});
