import { describe, expect, it } from 'vitest';
import { fraseDoEvento } from './linha-do-tempo';

const ev = (tipo: string, texto: string | null = null, usuario: string | null = null) => ({ tipo, texto, usuario, criado_em: '2026-10-01T18:02:00Z' });

describe('fraseDoEvento (imagem 05)', () => {
  it('abertura e prioridade do agente; prazo sugerido pelo Sistema', () => {
    expect(fraseDoEvento(ev('criacao', 'Pediu a guia'), 'agente')).toEqual({ ator: 'Agente', acao: 'abriu', detalhe: null });
    expect(fraseDoEvento(ev('prioridade_alterada', 'urgente'), 'agente')).toEqual({ ator: 'Agente', acao: 'prioridade Urgente', detalhe: null });
    expect(fraseDoEvento(ev('prazo_alterado', '2026-10-01T20:00:00Z'), 'agente')).toEqual({ ator: 'Sistema', acao: 'prazo 01/10 17h', detalhe: null });
  });
  it('ações de pessoas levam o nome; nota interna mostra o texto', () => {
    expect(fraseDoEvento(ev('criacao', null, 'Ana'), 'equipe')).toEqual({ ator: 'Ana', acao: 'abriu', detalhe: null });
    expect(fraseDoEvento(ev('assumido', null, 'Ana'), 'agente').acao).toBe('assumiu');
    expect(fraseDoEvento(ev('status_alterado', 'aguardando_cliente', 'Ana'), 'agente').acao).toBe('status Com o cliente');
    expect(fraseDoEvento(ev('responsavel_alterado', 'Bia', 'Ana'), 'agente').acao).toBe('responsável Bia');
    expect(fraseDoEvento(ev('responsavel_alterado', null, 'Ana'), 'agente').acao).toBe('tirou o responsável');
    expect(fraseDoEvento(ev('transferencia', 'Pessoal', 'Ana'), 'agente').acao).toBe('transferiu para Pessoal');
    expect(fraseDoEvento(ev('editado', 'título, descrição', 'Ana'), 'agente').acao).toBe('editou título, descrição');
    expect(fraseDoEvento(ev('conclusao', null, 'Ana'), 'agente').acao).toBe('concluiu');
    expect(fraseDoEvento(ev('reaberto', null, 'Ana'), 'agente').acao).toBe('reabriu');
    expect(fraseDoEvento(ev('nota_interna', 'Cliente ligou', 'Ana'), 'agente')).toEqual({ ator: 'Ana', acao: 'nota interna', detalhe: 'Cliente ligou' });
    expect(fraseDoEvento(ev('nota_interna', 'Mandou o extrato'), 'agente').ator).toBe('Agente');
  });
  it('prazo recalculado por mudança de regra, com a pessoa (Parte G1)', () => {
    expect(fraseDoEvento(ev('prazo_recalculado', '2026-10-13T21:00:00Z', 'Thiago'), 'agente'))
      .toEqual({ ator: 'Sistema', acao: 'prazo 13/10 18h · recalculado por mudança de regra (Thiago)', detalhe: null });
  });
});
