import { describe, expect, it, vi } from 'vitest';

// Revisão geral (painel I4): seletores de empresa e contato não perdem linhas no corte de 1000 do PostgREST.
vi.mock('server-only', () => ({}));
import { lerContatosAtivos, lerEmpresasAtivasDoSeletor } from './listas-ativas';

function sbFalso(total: number, erroNa?: number) {
  const ranges: [number, number][] = [];
  const tabelas: string[] = [];
  const sb = {
    from: (t: string) => {
      tabelas.push(t);
      const q = {
        select: () => q, eq: () => q, order: () => q,
        range: async (de: number, ate: number) => {
          ranges.push([de, ate]);
          if (erroNa !== undefined && de >= erroNa) return { data: null, error: { message: 'timeout' } };
          const n = Math.max(0, Math.min(ate, total - 1) - de + 1);
          return { data: Array.from({ length: n }, (_, i) => ({ id: `id${de + i}`, razao_social: `R${de + i}`, nome_fantasia: null, cnpj: '1', nome: `N${de + i}`, telefone: '5511' })), error: null };
        },
      };
      return q;
    },
  };
  return { sb: sb as never, ranges, tabelas };
}

describe('listas ativas para os seletores', () => {
  it('empresas: passa das 1000 lendo em páginas', async () => {
    const f = sbFalso(2300);
    const r = await lerEmpresasAtivasDoSeletor(f.sb);
    expect(r.linhas).toHaveLength(2300);
    expect(r.linhas[0]).toEqual({ id: 'id0', nome: 'R0', detalhe: '1' });
    expect(r).toMatchObject({ parcial: false, erro: false });
    expect(f.tabelas.every((t) => t === 'clientes')).toBe(true);
  });
  it('contatos: passa das 1000 e marca erro sem esconder o que leu', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const ok = await lerContatosAtivos(sbFalso(1500).sb);
    expect(ok.linhas).toHaveLength(1500);
    expect(ok.linhas[0]).toEqual({ id: 'id0', nome: 'N0', telefone: '5511' });
    const falhou = await lerContatosAtivos(sbFalso(5000, 1000).sb);
    expect(falhou).toMatchObject({ erro: true });
    expect(falhou.linhas).toHaveLength(1000);
  });
});
