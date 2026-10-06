import { describe, expect, it } from 'vitest';
import { textoComoAtua, textoTarefas } from './faixas';

const base = { semI3: false, estado: 'ligado' as const, setor: 'Contábil' };

describe('faixa das tarefas (D25) e setor inativo (D24g)', () => {
  it('cada estado do agente de Trabalho', () => {
    expect(textoTarefas({ ...base, semI3: true })).toEqual({ texto: 'As tarefas de trabalho aparecem quando a atualização do banco da Parte I3 for aplicada.', aviso: true });
    expect(textoTarefas({ ...base, estado: 'desligado' })).toEqual({ texto: 'Desligado: não recebe tarefas.', aviso: false });
    expect(textoTarefas({ ...base, estado: 'teste' })).toEqual({ texto: 'Em teste: só o dono e o administrador pedem tarefas.', aviso: false });
    expect(textoTarefas(base)).toEqual({ texto: 'Ligado: recebe tarefas das demandas do setor Contábil.', aviso: false });
    expect(textoTarefas({ ...base, setorAtivo: false })).toEqual({ texto: 'O setor Contábil está inativo: o agente não atende.', aviso: true });
  });
  it('agente de Conversa com setor inativo também avisa', () => {
    expect(textoComoAtua({ semI2: false, estado: 'ligado', modo: 'mesma_voz', tipos: ['conversa'], setor: 'Fiscal', contatosTeste: 0, setorAtivo: false }))
      .toEqual({ texto: 'O setor Fiscal está inativo: o agente não atende.', aviso: true });
  });
});
