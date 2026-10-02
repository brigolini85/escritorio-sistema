// apps/painel/src/lib/contato-arquivado-acoes.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A consulta da pergunta com a sessão e o Supabase falsos (sem banco). O banco confere de novo (pgTAP 16).
const falso = vi.hoisted(() => ({
  pode: true,
  rpc: vi.fn(),
  conversa: { telefone: '5531999991702' } as { telefone: string } | null,
  cliente: { razao_social: 'Indústria X Ltda', nome_fantasia: 'Indústria X' } as { razao_social: string; nome_fantasia: string | null } | null,
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'u1' }), temPermissao: () => falso.pode }));
const umaLinha = (dados: () => unknown) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: dados(), error: null }) }) }) });
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    rpc: falso.rpc,
    from: (t: string) => umaLinha(() => (t === 'conversas' ? falso.conversa : falso.cliente)),
  }),
}));

import { consultarContatoArquivado } from './contato-arquivado-acoes';

const X = '16000000-0000-4000-8000-000000000002';
const Y = '16000000-0000-4000-8000-000000000003';
const CONVERSA = '17000000-0000-4000-8000-000000000001';
const arquivado = { id: 'c1', nome: 'Zé Antigo', anonimizado: false,
  vinculos: [{ cliente_id: Y, razao_social: 'Indústria Y', nome_fantasia: null, pode_pedir_nota: true, pode_atualizar_preco: false }] };

beforeEach(() => {
  falso.pode = true;
  falso.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  falso.conversa = { telefone: '5531999991702' };
});

describe('consultarContatoArquivado', () => {
  it('normaliza o telefone digitado e pergunta ao banco', async () => {
    expect(await consultarContatoArquivado({ telefone: '(31) 99999-1702' })).toEqual({ situacao: 'livre' });
    expect(falso.rpc).toHaveBeenCalledWith('contato_arquivado_do_telefone', { p_telefone: '5531999991702' });
  });
  it('pela conversa, o telefone vem da conversa', async () => {
    falso.conversa = { telefone: '5531999991799' };
    await consultarContatoArquivado({ conversaId: CONVERSA });
    expect(falso.rpc).toHaveBeenCalledWith('contato_arquivado_do_telefone', { p_telefone: '5531999991799' });
  });
  it('arquivado com empresas de antes: devolve a lista e o nome da empresa da ação', async () => {
    falso.rpc.mockResolvedValue({ data: arquivado, error: null });
    expect(await consultarContatoArquivado({ telefone: '(31) 99999-1702', clienteId: X })).toEqual({
      situacao: 'arquivado', nome: 'Zé Antigo', empresaNova: 'Indústria X',
      vinculos: [{ clienteId: Y, empresa: 'Indústria Y', podePedirNota: true, podeMudarPreco: false }],
    });
  });
  it('apagado pela LGPD e erro do banco', async () => {
    falso.rpc.mockResolvedValue({ data: { id: 'c1', anonimizado: true, vinculos: [] }, error: null });
    expect(await consultarContatoArquivado({ telefone: '5500123451799' })).toEqual({ situacao: 'anonimizado' });
    falso.rpc.mockResolvedValue({ data: null, error: { message: 'falhou' } });
    expect(await consultarContatoArquivado({ telefone: '5531999991702' })).toEqual({ situacao: 'erro', erro: 'falhou' });
  });
  it('telefone inválido, conversa estranha ou sem permissão: segue o caminho de sempre sem consultar', async () => {
    expect(await consultarContatoArquivado({ telefone: '123' })).toEqual({ situacao: 'livre' });
    expect(await consultarContatoArquivado({ conversaId: 'x' })).toEqual({ situacao: 'livre' });
    falso.pode = false;
    expect(await consultarContatoArquivado({ telefone: '5531999991702' })).toEqual({ situacao: 'livre' });
    expect(falso.rpc).not.toHaveBeenCalled();
  });
});
