import { beforeEach, describe, expect, it, vi } from 'vitest';

// Server action "Ensinar o agente" com a sessão e o cliente do Supabase falsos (sem banco).
const falso = vi.hoisted(() => ({
  usuario: { id: 'u1', nome: 'Ana', papel: 'atendente' as 'admin' | 'atendente', permissoes: ['treinar_agente'], setores: [] as string[] },
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: falso.revalidatePath }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw Object.assign(new Error('NEXT_REDIRECT'), { url }); },
  unstable_rethrow: (e: unknown) => { if (e instanceof Error && e.message === 'NEXT_REDIRECT') throw e; },
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/fila', () => ({ enfileirarSimulacao: vi.fn() }));
vi.mock('@/lib/supabase/servidor', () => ({ supabaseServidor: async () => ({ rpc: falso.rpc }) }));
vi.mock('@/lib/sessao', () => ({
  obterUsuario: async () => falso.usuario,
  temPermissao: (u: { papel: string; permissoes: string[] }, p: string) => u.papel === 'admin' || u.permissoes.includes(p),
}));

import { alternarOrientacao, ensinarAgente, restaurarVersao } from './acoes';

const EMPRESA = '11111111-1111-4111-8111-111111111111';
const SETOR = '22222222-2222-4222-8222-222222222222';
const NOVA = '33333333-3333-4333-8333-333333333333';

function form(campos: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  return f;
}
const basico = { situacao: 'Cliente: “Quero a 2ª via”', fazer: 'Mande pelo WhatsApp.', titulo: '2ª via', tipo: 'situacao', vale: 'empresa', cliente_id: EMPRESA };

beforeEach(() => {
  falso.usuario = { id: 'u1', nome: 'Ana', papel: 'atendente', permissoes: ['treinar_agente'], setores: [] };
  falso.rpc.mockReset().mockResolvedValue({ data: NOVA, error: null });
  falso.revalidatePath.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ensinarAgente', () => {
  it('cria desligada (sem "ativo" no formulário) com o texto composto e a empresa', async () => {
    expect(await ensinarAgente(form(basico))).toEqual({ id: NOVA });
    expect(falso.rpc).toHaveBeenCalledWith('salvar_orientacao', {
      p_id: null, p_titulo: '2ª via', p_texto: 'Situação: Cliente: “Quero a 2ª via”\nO que fazer: Mande pelo WhatsApp.', p_tipo: 'situacao',
      p_cliente_id: EMPRESA, p_setor_id: undefined, p_ativo: false,
    });
    expect(falso.revalidatePath).toHaveBeenCalledWith('/treinar-agente');
  });

  it('ligada só quando a chave veio marcada; "Todos" não leva a empresa', async () => {
    await ensinarAgente(form({ ...basico, vale: 'todos', ativo: 'on' }));
    expect(falso.rpc.mock.calls[0]![1]).toMatchObject({ p_cliente_id: undefined, p_ativo: true });
  });

  it('sem a permissão não chama o banco', async () => {
    falso.usuario = { ...falso.usuario, permissoes: [] };
    expect(await ensinarAgente(form(basico))).toEqual({ erro: 'Você não tem permissão para treinar o agente.' });
    expect(falso.rpc).not.toHaveBeenCalled();
  });

  it('administrador pode mesmo sem a marcação', async () => {
    falso.usuario = { ...falso.usuario, papel: 'admin', permissoes: [] };
    expect(await ensinarAgente(form(basico))).toEqual({ id: NOVA });
  });

  it('"o que fazer" vazio, título vazio e texto longo demais voltam com o motivo, sem gravar', async () => {
    expect(await ensinarAgente(form({ ...basico, fazer: '   ' }))).toEqual({ erro: 'Escreva o que o agente deve fazer.' });
    expect(await ensinarAgente(form({ ...basico, titulo: '' }))).toEqual({ erro: 'Informe o título da orientação.' });
    expect(await ensinarAgente(form({ ...basico, fazer: 'x'.repeat(2000) }))).toEqual({ erro: 'O texto pode ter no máximo 2000 caracteres.' });
    expect(falso.rpc).not.toHaveBeenCalled();
  });

  it('"vale para setor" forjado é recusado (o setor não é copiado do formulário)', async () => {
    expect(await ensinarAgente(form({ ...basico, vale: 'setor', setor_id: SETOR }))).toEqual({ erro: 'Escolha o setor.' });
    expect(falso.rpc).not.toHaveBeenCalled();
  });

  it('mensagem do banco (raise exception) chega à pessoa; erro inesperado vira mensagem padrão e vai para o log', async () => {
    falso.rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'Esta empresa está inativa. Escolha outra empresa ou reative o cadastro.' } });
    expect(await ensinarAgente(form(basico))).toEqual({ erro: 'Esta empresa está inativa. Escolha outra empresa ou reative o cadastro.' });

    const cru = { code: '23514', message: 'new row violates check constraint "orientacoes_agente_texto_check"' };
    falso.rpc.mockResolvedValueOnce({ data: null, error: cru });
    expect(await ensinarAgente(form(basico))).toEqual({ erro: 'Não foi possível salvar a orientação. Tente de novo em alguns minutos.' });
    expect(console.error).toHaveBeenCalledWith('[treinar-agente] falha ao salvar a orientação', cru);

    falso.rpc.mockRejectedValueOnce(new Error('fetch failed'));
    expect(await ensinarAgente(form(basico))).toEqual({ erro: 'Não foi possível criar a orientação. Tente de novo em alguns minutos.' });
  });
});

const P0001 = { code: 'P0001', message: 'Esta empresa está inativa. Escolha outra empresa ou reative o cadastro.' };
const CRU = { code: '42501', message: 'permission denied for table orientacoes_agente' };

describe('alternarOrientacao', () => {
  it('liga e atualiza a tela', async () => {
    falso.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await alternarOrientacao(NOVA, true)).toEqual({ erro: null });
    expect(falso.rpc).toHaveBeenCalledWith('alternar_orientacao', { p_id: NOVA, p_ativo: true });
    expect(falso.revalidatePath).toHaveBeenCalledWith('/treinar-agente');
  });

  it('só a mensagem P0001 chega à pessoa; erro inesperado vira mensagem padrão e vai para o log', async () => {
    falso.rpc.mockResolvedValueOnce({ data: null, error: P0001 });
    expect(await alternarOrientacao(NOVA, true)).toEqual({ erro: P0001.message });

    falso.rpc.mockResolvedValueOnce({ data: null, error: CRU });
    expect(await alternarOrientacao(NOVA, true)).toEqual({ erro: 'Não foi possível mudar a orientação. Tente de novo em alguns minutos.' });
    expect(console.error).toHaveBeenCalledWith('[treinar-agente] falha ao ligar/desligar a orientação', CRU);

    falso.rpc.mockRejectedValueOnce(new Error('fetch failed'));
    expect(await alternarOrientacao(NOVA, false)).toEqual({ erro: 'Não foi possível mudar a orientação. Tente de novo em alguns minutos.' });
    expect(falso.revalidatePath).not.toHaveBeenCalled();
  });

  it('sem a permissão ou com id inválido: motivo claro, sem chamar o banco', async () => {
    expect(await alternarOrientacao('x', true)).toEqual({ erro: 'Orientação não encontrada.' });
    falso.usuario = { ...falso.usuario, permissoes: [] };
    expect(await alternarOrientacao(NOVA, true)).toEqual({ erro: 'Você não tem permissão para treinar o agente.' });
    expect(falso.rpc).not.toHaveBeenCalled();
  });
});

describe('restaurarVersao', () => {
  const voltar = '/treinar-agente?orientacao=' + NOVA;
  async function erroDe(p: Promise<void>): Promise<string | null> {
    try { await p; return null; } catch (e) {
      const url = (e as { url?: string }).url ?? '';
      return new URLSearchParams(url.split('?')[1] ?? '').get('erro');
    }
  }

  it('restaura com a versão pedida', async () => {
    falso.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await erroDe(restaurarVersao(SETOR, voltar))).toBeNull();
    expect(falso.rpc).toHaveBeenCalledWith('restaurar_orientacao', { p_versao_id: SETOR });
  });

  it('só a mensagem P0001 chega à pessoa; erro inesperado vira mensagem padrão e vai para o log', async () => {
    falso.rpc.mockResolvedValueOnce({ data: null, error: P0001 });
    expect(await erroDe(restaurarVersao(SETOR, voltar))).toBe(P0001.message);

    falso.rpc.mockResolvedValueOnce({ data: null, error: CRU });
    expect(await erroDe(restaurarVersao(SETOR, voltar))).toBe('Não foi possível restaurar a versão. Tente de novo em alguns minutos.');
    expect(console.error).toHaveBeenCalledWith('[treinar-agente] falha ao restaurar a versão', CRU);

    falso.rpc.mockRejectedValueOnce(new Error('fetch failed'));
    expect(await erroDe(restaurarVersao(SETOR, voltar))).toBe('Não foi possível restaurar a versão. Tente de novo em alguns minutos.');
  });

  it('id inválido ou sem a permissão: motivo claro, sem chamar o banco', async () => {
    expect(await erroDe(restaurarVersao('x', voltar))).toBe('Versão não encontrada.');
    falso.usuario = { ...falso.usuario, permissoes: [] };
    expect(await erroDe(restaurarVersao(SETOR, voltar))).toBe('Você não tem permissão para treinar o agente.');
    expect(falso.rpc).not.toHaveBeenCalled();
  });
});
