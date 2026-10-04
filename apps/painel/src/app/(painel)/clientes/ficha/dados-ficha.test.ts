import { beforeEach, describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => ({
  falhaEm: null as string | null,
  rpcFalha: [] as string[],
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/cofre', () => ({ cofreConfigurado: () => true }));
vi.mock('@/lib/permissoes', () => ({ temNivel: () => true }));
vi.mock('./ficha-cliente', () => ({ FichaCliente: () => null }));
vi.mock('./acessos-portais', () => ({ AcessosPortais: () => null }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    // Consulta encadeada (select/eq/order) que, ao ser esperada, devolve dados ou o erro da tabela marcada.
    from: (tabela: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'order']) q[m] = () => q;
      q.then = (ok: (v: unknown) => unknown) => ok(falso.falhaEm === tabela
        ? { data: null, error: { code: '08006', message: 'conexão caiu' } }
        : { data: tabela === 'cliente_servicos' ? [{ servico_id: 's1' }] : [], error: null });
      return q;
    },
    rpc: async (nome: string) => (falso.rpcFalha.includes(nome)
      ? { data: null, error: { code: '08006', message: 'conexão caiu' } }
      : { data: nome === 'pode_ver_acessos' ? true : null, error: null }),
  }),
}));

import * as React from 'react';
import type { UsuarioPainel } from '@/lib/sessao';
import { DadosFicha } from './dados-ficha';
import type { ClienteFicha } from './ficha';

const u = { id: 'eu', papel: 'admin', niveis: {}, setores: [] } as unknown as UsuarioPainel;
const c = { id: 'c1', razao_social: 'Padaria Sol ME', cnpj: '12345678000195' } as unknown as ClienteFicha;

// O vitest do painel compila JSX no modo clássico (React.createElement) e não há React global nos testes .ts.
(globalThis as { React?: typeof React }).React = React;

beforeEach(() => { falso.falhaEm = null; falso.rpcFalha = []; });

describe('DadosFicha: leitura que falha não vira formulário vazio (salvar apagaria serviços e inscrições)', () => {
  it.each(['servicos', 'setores', 'usuarios', 'cliente_servicos', 'cliente_responsaveis', 'cliente_inscricoes_st', 'cliente_acessos'])(
    'erro ao ler %s vai para a tela de erro', async (tabela) => {
      falso.falhaEm = tabela;
      await expect(DadosFicha({ c, u })).rejects.toThrow(`Não consegui ler ${tabela}`);
    },
  );

  it('sem erro, a ficha monta com o que o banco devolveu', async () => {
    const el = await DadosFicha({ c, u }) as { props: { contratados: string[] } };
    expect(el.props.contratados).toEqual(['s1']);
  });

  it('permissão e última alteração falham fechadas, sem derrubar a página', async () => {
    falso.rpcFalha = ['pode_ver_acessos', 'ultima_alteracao_cliente'];
    const el = await DadosFicha({ c, u }) as { props: { ultimaAlteracao: string | null; acessos: { props: { podeVer: boolean } } } };
    expect(el.props.ultimaAlteracao).toBeNull();
    expect(el.props.acessos.props.podeVer).toBe(false);
  });

  it('Novo cliente (c = null) também recusa leitura com erro', async () => {
    falso.falhaEm = 'servicos';
    await expect(DadosFicha({ c: null, u })).rejects.toThrow('Não consegui ler servicos');
  });
});
