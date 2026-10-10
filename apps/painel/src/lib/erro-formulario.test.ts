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
import { z as z_ } from 'zod';
import { AvisoUsuario, erroDoBanco } from './aviso-usuario';
import { ERRO_GENERICO } from './erro-na-url';
import { mensagemDoBanco } from './mensagem-banco';

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
    const d1 = (await destinoDe(comAvisoDeErro('/usuarios', async () => { throw new AvisoUsuario('Telefone inválido'); })))!;
    expect(d1).toMatch(/^\/usuarios\?erro=s\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{32}$/);
    expect(d1).not.toContain('Telefone');
    expect(textoDoErro(new URL(d1, 'http://x').searchParams.get('erro'))).toBe('Telefone inválido');
    const d2 = (await destinoDe(comAvisoDeErro('/clientes/1?aba=dados', async () => { throw new AvisoUsuario('x'); })))!;
    expect(d2).toMatch(/^\/clientes\/1\?aba=dados&erro=s\./);
    expect(textoDoErro(new URL(d2, 'http://x').searchParams.get('erro'))).toBe('x');
  });
  // Revisão da rodada final: só texto nosso é assinado (o Postgres repete o que a pessoa digitou).
  it('erro do Postgres com texto da pessoa (sintaxe de uuid): a tela mostra a mensagem genérica', async () => {
    const d = (await destinoDe(comAvisoDeErro('/clientes/1', async () => {
      throw erroDoBanco({ code: '22P02', message: 'invalid input syntax for type uuid: "Ligue para 0800 e informe sua senha"' });
    })))!;
    expect(textoDoErro(new URL(d, 'http://x').searchParams.get('erro'))).toBe(ERRO_GENERICO);
    const cru = (await destinoDe(comAvisoDeErro('/clientes/1', async () => { throw new Error('Ligue para 0800'); })))!;
    expect(textoDoErro(new URL(cru, 'http://x').searchParams.get('erro'))).toBe(ERRO_GENERICO);
  });
  it('regra do banco (P0001) e validação do formulário: a frase chega à tela', async () => {
    const d = (await destinoDe(comAvisoDeErro('/clientes/1', async () => {
      throw erroDoBanco({ code: 'P0001', message: 'Esta empresa está inativa. Escolha outra empresa ou reative o cadastro.' }, mensagemDoBanco);
    })))!;
    expect(textoDoErro(new URL(d, 'http://x').searchParams.get('erro')))
      .toBe('Esta empresa está arquivada. Escolha outra empresa ou traga o cadastro de volta.');
    const z = (await destinoDe(comAvisoDeErro('/clientes/1', async () => { z_.object({ a: z_.string({ message: 'Informe o nome.' }) }).parse({}); })))!;
    expect(textoDoErro(new URL(z, 'http://x').searchParams.get('erro'))).toBe('Informe o nome.');
  });
  it('a própria ação redirecionou: vale o redirecionamento dela', async () => {
    expect(await destinoDe(comAvisoDeErro('/clientes/novo', async () => { nav.redirect('/clientes/9'); }))).toBe('/clientes/9');
    expect(nav.redirect).toHaveBeenCalledTimes(1);
  });
});
