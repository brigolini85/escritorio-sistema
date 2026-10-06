import { beforeEach, describe, expect, it, vi } from 'vitest';

// Revisão geral (painel I1): a resposta já gravada não pode virar erro na tela se a fila falhar, senão a pessoa
// reenvia o texto e o cliente recebe duas vezes (o batimento do trabalhador reenfileira a primeira).
const falso = vi.hoisted(() => ({ rpc: vi.fn(), enfileirar: vi.fn(), redirect: vi.fn(), revalidar: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: falso.revalidar }));
vi.mock('next/navigation', () => ({ redirect: falso.redirect }));
vi.mock('@/lib/fila', () => ({ enfileirarEnvio: falso.enfileirar, enfileirarSugestao: vi.fn() }));
vi.mock('@/lib/cadastro-contato', () => ({ cadastrarContatoPeloTelefone: vi.fn(), lerManter: vi.fn() }));
vi.mock('@/lib/nova-demanda-dados', () => ({ lerDadosNovaDemanda: vi.fn() }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ papel: 'atendente', niveis: {} }) }));
vi.mock('@/lib/supabase/servidor', () => ({ supabaseServidor: async () => ({ rpc: falso.rpc }) }));

import { textoDoAviso } from '@/lib/avisos';
import { responder } from './acoes';

const CONVERSA = '22222222-2222-4222-8222-222222222222';
function form(texto: string) {
  const f = new FormData();
  f.set('texto', texto);
  return f;
}

beforeEach(() => {
  falso.rpc.mockReset().mockResolvedValue({ data: 'msg-1', error: null });
  falso.enfileirar.mockReset().mockResolvedValue(undefined);
  falso.redirect.mockReset();
  falso.revalidar.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('responder', () => {
  it('grava e põe na fila; sem aviso quando tudo dá certo', async () => {
    await responder(CONVERSA, form('Oi'));
    expect(falso.rpc).toHaveBeenCalledWith('registrar_resposta', expect.objectContaining({ p_conversa: CONVERSA, p_texto: 'Oi' }));
    expect(falso.enfileirar).toHaveBeenCalledWith('msg-1');
    expect(falso.redirect).not.toHaveBeenCalled();
  });

  it('fila fora do ar depois de gravar: não lança (a pessoa não reenvia) e avisa que o envio será tentado de novo', async () => {
    falso.enfileirar.mockRejectedValue(new Error('pg-boss fora'));
    await expect(responder(CONVERSA, form('Oi'))).resolves.toBeUndefined();
    expect(falso.rpc).toHaveBeenCalledTimes(1);
    expect(falso.revalidar).toHaveBeenCalledWith(`/atendimento/${CONVERSA}`);
    expect(falso.redirect).toHaveBeenCalledWith(`/atendimento/${CONVERSA}?aviso=resposta-na-fila`);
    expect(textoDoAviso('resposta-na-fila')).toMatch(/salva.*tentado de novo/i);
  });

  it('erro ao gravar continua aparecendo (nada foi salvo)', async () => {
    falso.rpc.mockResolvedValue({ data: null, error: { message: 'Arquivo não encontrado nesta conversa.' } });
    await expect(responder(CONVERSA, form('Oi'))).rejects.toThrow('Arquivo não encontrado');
    expect(falso.enfileirar).not.toHaveBeenCalled();
  });
});
