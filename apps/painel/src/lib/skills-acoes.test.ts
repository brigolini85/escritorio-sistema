import { beforeEach, describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => ({
  dono: true, erroRpc: null as { code: string; message: string } | null, chamadas: [] as [string, unknown][], revalidados: [] as string[],
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => { falso.revalidados.push(p); } }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'u1', papel: 'admin', niveis: {}, setores: [] }) }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    rpc: async (nome: string, args: unknown) => {
      falso.chamadas.push([nome, args]);
      if (nome === 'eh_dono') return { data: falso.dono, error: null };
      return { data: { skill_id: 's1', versao: 1, nova: true }, error: falso.erroRpc };
    },
  }),
}));
const { subirSkill } = await import('./skills-acoes');

const md = (cab: string) => new File([`---\n${cab}\n---\n# Tabela CFOP\nTexto.`], 'SKILL.md');
const form = (arquivo: File, tipo = '') => { const f = new FormData(); f.append('arquivos', arquivo, arquivo.name); f.append('tipo', tipo); return f; };

beforeEach(() => { Object.assign(falso, { dono: true, erroRpc: null, chamadas: [], revalidados: [] }); });

describe('subirSkill', () => {
  it('monta o pacote e grava; volta o título para o aviso', async () => {
    expect(await subirSkill('atendimento', form(md('name: tabela-cfop\ndescription: CFOPs.\ntipo: conhecimento'))))
      .toEqual({ ok: true, skillId: 's1', versao: 1, nova: true, titulo: 'Tabela CFOP' });
    expect(falso.chamadas[1]).toEqual(['subir_skill', { p_slug: 'atendimento', p_pacote: expect.objectContaining({ nome: 'tabela-cfop', tipo: 'conhecimento' }) }]);
    expect(falso.revalidados).toContain('/agentes');
  });
  it('sem tipo no cabeçalho nem na tela: pergunta, sem gravar', async () => {
    expect(await subirSkill('atendimento', form(md('name: tabela-cfop\ndescription: CFOPs.'))))
      .toEqual({ ok: false, precisaTipo: true, nome: 'tabela-cfop', titulo: 'Tabela CFOP' });
    expect(falso.chamadas.map((c) => c[0])).toEqual(['eh_dono']);
  });
  it('quem não é dono não sobe', async () => {
    falso.dono = false;
    expect(await subirSkill('atendimento', form(md('name: a\ndescription: b\ntipo: limites')))).toEqual({ ok: false, erro: 'Só o dono sobe skills.' });
  });
  it('recusa do banco vira a frase', async () => {
    falso.erroRpc = { code: 'P0001', message: 'Jeito de atuar e Limites ligados passam de 10.000 caracteres (ficariam 10039): desligue ou encurte uma skill.' };
    expect(await subirSkill('atendimento', form(md('name: a\ndescription: b\ntipo: limites')))).toEqual({ ok: false,
      erro: 'Jeito de atuar e Limites ligados passam de 10.000 caracteres (ficariam 10039): desligue ou encurte uma skill.' });
  });
});
