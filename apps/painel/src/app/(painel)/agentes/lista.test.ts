import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { THIAGO_SEM_MIGRACAO } = await import('@/lib/agentes');
const { contarPorEstado, falaComOCliente, filtrarAgentes, lerFiltrosAgentes, percentualSozinho } = await import('./lista');

const fiscal = { ...THIAGO_SEM_MIGRACAO, id: 'f', slug: 'fiscal', nome: 'Agente Fiscal', portaDeEntrada: false, estado: 'teste' as const,
  tipos: ['conversa', 'trabalho'] as ('conversa' | 'trabalho')[], modoContato: 'mesma_voz' as const, setor: 'Fiscal', descricao: 'notas e guias' };
const radar = { ...fiscal, id: 'r', slug: 'radar', nome: 'Radar de legislação', estado: 'desligado' as const, tipos: ['trabalho'] as 'trabalho'[], modoContato: null, setor: null };

describe('tela Agentes (spec 7E.2)', () => {
  it('filtros pela URL; lixo é ignorado', () => {
    expect(lerFiltrosAgentes({ estado: 'teste', tipo: 'trabalho', q: ' fis ' })).toEqual({ estado: 'teste', tipo: 'trabalho', q: 'fis' });
    expect(lerFiltrosAgentes({ estado: 'xyz', tipo: ['conversa'] })).toEqual({ estado: null, tipo: 'conversa', q: '' });
  });
  it('filtra por estado, tipo e busca (nome, setor, descrição, sem acento)', () => {
    const todos = [THIAGO_SEM_MIGRACAO, fiscal, radar];
    expect(filtrarAgentes(todos, { estado: 'teste', tipo: null, q: '' }).map((a) => a.slug)).toEqual(['fiscal']);
    expect(filtrarAgentes(todos, { estado: null, tipo: 'trabalho', q: '' }).map((a) => a.slug)).toEqual(['fiscal', 'radar']);
    expect(filtrarAgentes(todos, { estado: null, tipo: null, q: 'legislacao' }).map((a) => a.slug)).toEqual(['radar']);
    expect(contarPorEstado(todos)).toEqual({ todos: 3, ligado: 1, teste: 1, desligado: 1 });
  });
  it('"Fala com o cliente": o Thiago é direto; sem modo, a definir', () => {
    expect(falaComOCliente(THIAGO_SEM_MIGRACAO)).toEqual({ modo: 'Direto, é a voz do escritório', detalhe: null });
    expect(falaComOCliente(fiscal)).toEqual({ modo: 'Mesma voz', detalhe: 'responde como Thiago' });
    expect(falaComOCliente(radar)).toEqual({ modo: 'a definir', detalhe: null });
  });
  it('% resolvido sozinho', () => {
    expect(percentualSozinho({ atendimentos: 438, resolvidos: 324, custoUsd: 0, custoTestesUsd: 0, ultimaEm: null, ultimaEmpresa: null })).toBe(74);
    expect(percentualSozinho({ atendimentos: 0, resolvidos: 0, custoUsd: 0, custoTestesUsd: 0, ultimaEm: null, ultimaEmpresa: null })).toBeNull();
    expect(percentualSozinho(undefined)).toBeNull();
  });
});
